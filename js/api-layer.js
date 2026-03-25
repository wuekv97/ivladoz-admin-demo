/**
 * IVLADOZ Admin Panel -- API Service Layer
 *
 * localStorage-backed data layer that mirrors a REST API surface.
 * Every public method returns a Promise for future real-backend compatibility.
 *
 * Usage:  await API.init();  const b = await API.postflow.getAll();
 * @file api-layer.js
 */
/* global localStorage, sessionStorage, crypto */
/* eslint-disable no-unused-vars */

const API = (() => {
  'use strict';

  const STORAGE_KEY = 'ivladoz_data';
  const SESSION_KEY = 'ivladoz_session';
  const VERSION_KEY = 'ivladoz_version';
  const CURRENT_VERSION = '2.1.0'; // bump to force data reset on deploy
  let _listeners = {};
  let _db = null;
  let _baseUrl = null;

  // -- Helpers ----------------------------------------------------------------
  const uid  = () => (crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10));
  const now  = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
  const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(_db));
  const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const san  = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : v);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const ok   = (v) => Promise.resolve(v);

  const req = (obj, fields, label) => {
    for (const f of fields) {
      if (obj[f] === undefined || obj[f] === null || obj[f] === '') throw new Error(`${label}: missing required field "${f}"`);
    }
  };

  const _emit = (ev, d) => { (_listeners[ev] || []).forEach((fn) => { try { fn(d); } catch (e) { console.error('[API]', e); } }); };

  // -- Audit ------------------------------------------------------------------
  const _audit = (action, system, target, details) => {
    if (!_db) return;
    const s = _getSession();
    _db.auditLog.unshift({ id: uid(), ts: now(), user: s ? s.name : 'System', action, system, target: String(target), details: String(details) });
    if (_db.auditLog.length > 500) _db.auditLog.length = 500;
    save();
  };

  // -- Session ----------------------------------------------------------------
  const _setSession = (u) => { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: u.id, name: u.name, email: u.email, role: u.role, systems: u.systems })); };
  const _clearSession = () => sessionStorage.removeItem(SESSION_KEY);
  const _getSession = () => { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; } };

  // -- Remote -----------------------------------------------------------------
  const _fetch = async (method, path, body) => {
    const opts = { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include' };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(`${_baseUrl}${path}`, opts);
    if (!res.ok) { const e = await res.json().catch(() => ({ message: res.statusText })); throw new Error(e.message || `HTTP ${res.status}`); }
    return res.status === 204 ? null : res.json();
  };

  // -- CRUD factory -----------------------------------------------------------
  /** Build getAll / getById / create / update / delete for a collection */
  const crud = (col, label, sys, reqFields) => ({
    async getAll()       { return _baseUrl ? _fetch('GET', `/${sys}/${col}`) : ok(clone(_db[col])); },
    async getById(id)    { if (_baseUrl) return _fetch('GET', `/${sys}/${col}/${id}`); const r = _db[col].find((x) => x.id === id); if (!r) throw new Error(`${label} not found`); return clone(r); },
    async create(data) {
      if (_baseUrl) return _fetch('POST', `/${sys}/${col}`, data);
      req(data, reqFields, label);
      const e = { id: uid(), ...data, createdAt: now(), updatedAt: now() };
      _db[col].push(e); _audit(`${col}_created`, sys, e.id, `${label}: ${data.name || e.id}`); save();
      _emit('data:changed', { collection: col, action: 'create', id: e.id }); return clone(e);
    },
    async update(id, data) {
      if (_baseUrl) return _fetch('PATCH', `/${sys}/${col}/${id}`, data);
      const i = _db[col].findIndex((x) => x.id === id); if (i === -1) throw new Error(`${label} not found`);
      Object.assign(_db[col][i], data, { updatedAt: now() });
      _audit(`${col}_updated`, sys, id, JSON.stringify(data).slice(0, 120)); save();
      _emit('data:changed', { collection: col, action: 'update', id }); return clone(_db[col][i]);
    },
    async delete(id) {
      if (_baseUrl) return _fetch('DELETE', `/${sys}/${col}/${id}`);
      const i = _db[col].findIndex((x) => x.id === id); if (i === -1) throw new Error(`${label} not found`);
      const rm = _db[col].splice(i, 1)[0]; _audit(`${col}_deleted`, sys, id, `${label}: ${rm.name || id}`); save();
      _emit('data:changed', { collection: col, action: 'delete', id });
    }
  });

  /** Build toggle enabled/disabled for a collection item */
  const toggleFn = (col, label, sys) => async function toggle(id) {
    if (_baseUrl) return _fetch('POST', `/${sys}/${col}/${id}/toggle`);
    const r = _db[col].find((x) => x.id === id); if (!r) throw new Error(`${label} not found`);
    r.enabled = !r.enabled; r.updatedAt = now();
    _audit(`${col}_toggled`, sys, id, `${r.name || id} -> ${r.enabled ? 'enabled' : 'disabled'}`); save();
    _emit('data:changed', { collection: col, action: 'update', id }); return clone(r);
  };

  /** Build config get / set pair */
  const configPair = (key, sys) => ({
    async getConfig()       { return _baseUrl ? _fetch('GET', `/${sys}/config`) : ok(clone(_db[key])); },
    async setConfig(k, v)   { if (_baseUrl) return _fetch('PUT', `/${sys}/config`, { key: k, value: v }); const old = _db[key][k]; _db[key][k] = v; _audit('config_change', sys, k, `${old} -> ${v}`); save(); _emit('data:changed', { collection: key, action: 'update' }); }
  });

  /** Filter helper -- applies an object of filter fns */
  const applyFilters = (list, filters, map) => {
    if (!filters) return list;
    let out = list;
    for (const [k, fn] of Object.entries(map)) { if (filters[k]) out = out.filter((r) => fn(r, filters[k])); }
    return out;
  };

  // -- Default seed -----------------------------------------------------------
  const _defaults = () => ({
    users: [
      { id: 'u1', name: 'Yehor K.',  email: 'yehor@ivladoz.com', role: 'super_admin', systems: ['postflow','autoeditors','superboost'], password: 'Ivladoz2026!', status: 'active', lastLogin: null, loginCount: 0, createdAt: now(), updatedAt: now() },
      { id: 'u2', name: 'Vladislav I.', email: 'vlad@ivladoz.com', role: 'admin', systems: ['postflow','autoeditors','superboost'], password: 'Vlad2026!', status: 'active', lastLogin: null, loginCount: 0, createdAt: now(), updatedAt: now() }
    ],
    auditLog: [],
    postflow_items: [], postflow_runs: [], postflow_problems: [], postflow_editors: [], postflow_alerts: [],
    postflow_config: { DRY_RUN: 'false', POST_INTERVAL_SECONDS: '120', MAX_RETRIES: '3', QUARANTINE_HOURS: '24', TIMEZONE: 'Europe/Kyiv' },
    autoeditors_editors: [], autoeditors_assignments: [], autoeditors_folders: [], autoeditors_logs: [],
    autoeditors_config: { SYNC_INTERVAL_MINUTES: '15', MAX_ACTIVE_PER_EDITOR: '5', AUTO_ASSIGN: 'true', NOTIFY_ON_ASSIGN: 'true' },
    superboost_accounts: [], superboost_tasks: [], superboost_rules: [], superboost_assistants: [],
    superboost_config: { MAX_DAILY_TASKS: '50', COOLDOWN_MINUTES: '30', AUTO_ROTATE: 'true', DEFAULT_PLATFORM: 'telegram' },
    notification_settings: {
      postflow:    { enabled: true, onError: true, onComplete: false, channel: 'telegram' },
      autoeditors:     { enabled: true, onAssign: true, onComplete: true, channel: 'telegram' },
      superboost: { enabled: true, onTask: true, onRule: false, channel: 'telegram' }
    }
  });

  // ==========================================================================
  //  PUBLIC API
  // ==========================================================================
  const api = {
    config: { baseUrl: null },

    // -- Core -----------------------------------------------------------------
    /** Initialize the API layer. Loads from localStorage or seeds defaults. */
    async init() {
      // Version check: wipe old data on version mismatch
      const storedVersion = localStorage.getItem(VERSION_KEY);
      if (storedVersion !== CURRENT_VERSION) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem('ivladoz_setup_complete');
        localStorage.removeItem('ivladoz_setup');
        localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
        _db = null;
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) try { _db = JSON.parse(raw); } catch { _db = null; }
      if (!_db) { _db = _defaults(); save(); }
      _baseUrl = this.config.baseUrl || null;
    },
    /** Switch all future calls to a real REST endpoint. */
    async setBackend(url) { _baseUrl = url || null; this.config.baseUrl = _baseUrl; },
    /** @returns {Promise<boolean>} true when using a remote backend */
    async isOnline() { return ok(!!_baseUrl); },
    /** Export all data as a JSON string. */
    async export() { return _baseUrl ? _fetch('GET', '/export') : ok(JSON.stringify(_db, null, 2)); },
    /** Import data from a JSON string (full replace). */
    async import(json) {
      if (_baseUrl) return _fetch('POST', '/import', JSON.parse(json));
      const p = JSON.parse(json); if (!p || typeof p !== 'object') throw new Error('Invalid import data');
      _db = p; save(); _audit('data_imported', 'auth', '--', 'Full data import'); _emit('data:changed', { action: 'import' });
    },
    /** Reset to clean state with only the default super admin. */
    async reset() { _db = _defaults(); save(); _clearSession(); _emit('data:changed', { action: 'reset' }); },

    // -- Events ---------------------------------------------------------------
    on(ev, cb)  { if (!_listeners[ev]) _listeners[ev] = []; _listeners[ev].push(cb); },
    off(ev, cb) { _listeners[ev] = (_listeners[ev] || []).filter((f) => f !== cb); },
    emit(ev, d) { _emit(ev, d); },

    // =========================================================================
    //  Auth
    // =========================================================================
    auth: {
      /** Authenticate by email + password. Returns user (no password). */
      async login(email, password) {
        if (_baseUrl) return _fetch('POST', '/auth/login', { email, password });
        if (!email || !password) throw new Error('Email and password are required');
        const e = san(email).toLowerCase();
        const u = _db.users.find((x) => x.email === e && x.password === password);
        if (!u) throw new Error('Invalid email or password');
        if (u.status === 'disabled') throw new Error('Account is disabled');
        if (u.status === 'locked') throw new Error('Account is locked');
        u.lastLogin = now(); u.loginCount = (u.loginCount || 0) + 1; save();
        _setSession(u); _audit('login', 'auth', '--', 'Successful login via password');
        _emit('auth:login', { id: u.id, name: u.name, role: u.role });
        const { password: _, ...safe } = clone(u); return safe;
      },
      /** Clear the current session. */
      async logout() { if (_baseUrl) return _fetch('POST', '/auth/logout'); _audit('logout', 'auth', '--', 'Manual logout'); _clearSession(); _emit('auth:logout', {}); },
      /** Returns the current session user or null. */
      async getSession() { return _baseUrl ? _fetch('GET', '/auth/session') : ok(_getSession()); },
      /** List all users (passwords stripped). */
      async getUsers() { if (_baseUrl) return _fetch('GET', '/auth/users'); return ok(_db.users.map((u) => { const { password: _, ...s } = u; return clone(s); })); },
      /** Create a new user. @param {object} data {name, email, role, systems, password} */
      async createUser(data) {
        if (_baseUrl) return _fetch('POST', '/auth/users', data);
        req(data, ['name','email','role','password'], 'User');
        const email = san(data.email).toLowerCase();
        if (!isEmail(email)) throw new Error('Invalid email format');
        if (_db.users.some((u) => u.email === email)) throw new Error('Email already exists');
        if (!['super_admin','admin','manager','assistant'].includes(data.role)) throw new Error('Invalid role');
        const u = { id: uid(), name: san(data.name), email, role: data.role, systems: Array.isArray(data.systems) ? data.systems : [], password: data.password, status: 'active', lastLogin: null, loginCount: 0, createdAt: now(), updatedAt: now() };
        _db.users.push(u); _audit('user_created', 'auth', u.id, `Created: ${u.name} (${u.role})`); save();
        _emit('data:changed', { collection: 'users', action: 'create', id: u.id });
        const { password: _, ...safe } = clone(u); return safe;
      },
      /** Update an existing user. */
      async updateUser(id, data) {
        if (_baseUrl) return _fetch('PATCH', `/auth/users/${id}`, data);
        const i = _db.users.findIndex((u) => u.id === id); if (i === -1) throw new Error('User not found');
        if (data.email) { const e = san(data.email).toLowerCase(); if (!isEmail(e)) throw new Error('Invalid email'); if (_db.users.some((u) => u.email === e && u.id !== id)) throw new Error('Email taken'); data.email = e; }
        if (data.name) data.name = san(data.name);
        Object.assign(_db.users[i], data, { updatedAt: now() });
        _audit('user_updated', 'auth', id, JSON.stringify(data).slice(0, 120)); save();
        _emit('data:changed', { collection: 'users', action: 'update', id });
        const { password: _, ...safe } = clone(_db.users[i]); return safe;
      },
      /** Delete a user. */
      async deleteUser(id) {
        if (_baseUrl) return _fetch('DELETE', `/auth/users/${id}`);
        const i = _db.users.findIndex((u) => u.id === id); if (i === -1) throw new Error('User not found');
        const rm = _db.users.splice(i, 1)[0]; _audit('user_deleted', 'auth', id, `Deleted: ${rm.name}`); save();
        _emit('data:changed', { collection: 'users', action: 'delete', id });
      },
      /** Toggle a user between active/disabled. */
      async toggleUserStatus(id) {
        if (_baseUrl) return _fetch('POST', `/auth/users/${id}/toggle`);
        const u = _db.users.find((x) => x.id === id); if (!u) throw new Error('User not found');
        u.status = u.status === 'active' ? 'disabled' : 'active'; u.updatedAt = now();
        _audit('user_status_changed', 'auth', id, `${u.name} -> ${u.status}`); save();
        _emit('data:changed', { collection: 'users', action: 'update', id });
        const { password: _, ...safe } = clone(u); return safe;
      },
      /** Reset a user's password. */
      async resetPassword(id, newPw) {
        if (_baseUrl) return _fetch('POST', `/auth/users/${id}/reset-password`, { password: newPw });
        if (!newPw || newPw.length < 4) throw new Error('Password must be >= 4 chars');
        const u = _db.users.find((x) => x.id === id); if (!u) throw new Error('User not found');
        u.password = newPw; u.updatedAt = now(); _audit('password_reset', 'auth', id, `Reset for ${u.name}`); save();
      },
      /** Get audit log with optional filters {action, user, system, dateFrom, dateTo}. */
      async getAuditLog(f) {
        if (_baseUrl) return _fetch('GET', '/auth/audit');
        return ok(clone(applyFilters(_db.auditLog, f, {
          action: (r, v) => r.action === v, user: (r, v) => r.user.toLowerCase().includes(v.toLowerCase()),
          system: (r, v) => r.system === v, dateFrom: (r, v) => r.ts >= v, dateTo: (r, v) => r.ts <= v
        })));
      },
      /** Write an audit entry manually. */
      async logAction(action, system, target, details) {
        if (_baseUrl) return _fetch('POST', '/auth/audit', { action, system, target, details });
        _audit(action, system, target, details);
      }
    },

    // =========================================================================
    //  Postflow
    // =========================================================================
    postflow: {
      ...crud('postflow_items', 'Batch', 'postflow', ['name']),
      /** Manually trigger a batch run. */
      async trigger(id) {
        if (_baseUrl) return _fetch('POST', `/postflow/items/${id}/trigger`);
        const b = _db.postflow_items.find((x) => x.id === id); if (!b) throw new Error('Batch not found');
        const run = { id: uid(), batchId: id, batchName: b.name, status: 'running', startedAt: now(), finishedAt: null, targetsQueued: 0, targetsPosted: 0, errors: 0 };
        _db.postflow_runs.push(run); _audit('batch_triggered', 'postflow', id, `Manual: ${b.name}`); save();
        _emit('data:changed', { collection: 'postflow_runs', action: 'create' }); return clone(run);
      },
      /** Get runs, optionally filtered by batchId. */
      async getRuns(batchId) {
        if (_baseUrl) return _fetch('GET', `/postflow/runs${batchId ? '?batchId=' + batchId : ''}`);
        let r = _db.postflow_runs; if (batchId) r = r.filter((x) => x.batchId === batchId); return ok(clone(r));
      },
      /** Get quarantine/problem items. */
      async getProblems() { return _baseUrl ? _fetch('GET', '/postflow/problems') : ok(clone(_db.postflow_problems)); },
      /** Release an item from quarantine. */
      async releaseQuarantine(id) {
        if (_baseUrl) return _fetch('POST', `/postflow/problems/${id}/release`);
        const p = _db.postflow_problems.find((x) => x.id === id); if (!p) throw new Error('Problem not found');
        p.status = 'released'; p.releasedAt = now(); _audit('quarantine_released', 'postflow', id, 'Released'); save();
        _emit('data:changed', { collection: 'postflow_problems', action: 'update', id });
      },
      /** Get coverage stats per tier. */
      async getCoverage() {
        if (_baseUrl) return _fetch('GET', '/postflow/coverage');
        const tiers = {};
        for (const b of _db.postflow_items) { const t = b.tier || 'default'; if (!tiers[t]) tiers[t] = { tier: t, total: 0, covered: 0 }; tiers[t].total++; if (b.status === 'active') tiers[t].covered++; }
        Object.values(tiers).forEach((t) => { t.percent = t.total ? Math.round((t.covered / t.total) * 100) : 0; });
        return ok(Object.values(tiers));
      },
      // Editors sub-CRUD
      getEditors: async () => (_baseUrl ? _fetch('GET', '/postflow/editors') : ok(clone(_db.postflow_editors))),
      createEditor: crud('postflow_editors', 'Postflow Editor', 'postflow', ['name']).create,
      updateEditor: crud('postflow_editors', 'Postflow Editor', 'postflow', ['name']).update,
      deleteEditor: crud('postflow_editors', 'Postflow Editor', 'postflow', ['name']).delete,
      // Config
      ...configPair('postflow_config', 'postflow'),
      // Alerts
      async getAlerts() { return _baseUrl ? _fetch('GET', '/postflow/alerts') : ok(clone(_db.postflow_alerts)); },
      async dismissAlert(id) {
        if (_baseUrl) return _fetch('POST', `/postflow/alerts/${id}/dismiss`);
        const a = _db.postflow_alerts.find((x) => x.id === id); if (!a) throw new Error('Alert not found');
        a.dismissed = true; a.dismissedAt = now(); _audit('alert_dismissed', 'postflow', id, 'Dismissed'); save();
        _emit('data:changed', { collection: 'postflow_alerts', action: 'update', id });
      },
      /** Computed dashboard statistics. */
      async getDashboardStats() {
        if (_baseUrl) return _fetch('GET', '/postflow/dashboard');
        return ok({ totalBatches: _db.postflow_items.length, activeBatches: _db.postflow_items.filter((b) => b.status === 'active').length, totalRuns: _db.postflow_runs.length, runningRuns: _db.postflow_runs.filter((r) => r.status === 'running').length, problems: _db.postflow_problems.filter((p) => p.status !== 'released').length, editors: _db.postflow_editors.length, activeAlerts: _db.postflow_alerts.filter((a) => !a.dismissed).length });
      }
    },

    // =========================================================================
    //  Autoeditors
    // =========================================================================
    autoeditors: {
      // Editors
      getEditors: async () => (_baseUrl ? _fetch('GET', '/autoeditors/editors') : ok(clone(_db.autoeditors_editors))),
      createEditor: async (data) => {
        if (_baseUrl) return _fetch('POST', '/autoeditors/editors', data);
        req(data, ['name'], 'Autoeditors Editor');
        const e = { id: uid(), enabled: true, maxActive: 5, ...data, createdAt: now(), updatedAt: now() };
        _db.autoeditors_editors.push(e); _audit('gdrive_editor_created', 'autoeditors', e.id, `Editor: ${data.name}`); save();
        _emit('data:changed', { collection: 'autoeditors_editors', action: 'create' }); return clone(e);
      },
      updateEditor: crud('autoeditors_editors', 'Autoeditors Editor', 'autoeditors', ['name']).update,
      deleteEditor: crud('autoeditors_editors', 'Autoeditors Editor', 'autoeditors', ['name']).delete,
      toggleEditor: toggleFn('autoeditors_editors', 'Autoeditors Editor', 'autoeditors'),
      // Assignments
      async getAssignments(f) {
        if (_baseUrl) return _fetch('GET', '/autoeditors/assignments');
        return ok(clone(applyFilters(_db.autoeditors_assignments, f, { status: (r, v) => r.status === v, editorId: (r, v) => r.editorId === v })));
      },
      ...(() => { const c = crud('autoeditors_assignments', 'Assignment', 'autoeditors', ['fileId','editorId']); return { createAssignment: async (data) => { if (_baseUrl) return _fetch('POST', '/autoeditors/assignments', data); req(data, ['fileId','editorId'], 'Assignment'); const e = { id: uid(), status: 'pending', ...data, createdAt: now(), updatedAt: now() }; _db.autoeditors_assignments.push(e); _audit('assignment_created', 'autoeditors', e.id, `File ${data.fileId} -> ${data.editorId}`); save(); _emit('data:changed', { collection: 'autoeditors_assignments', action: 'create' }); return clone(e); }, updateAssignment: c.update, deleteAssignment: c.delete }; })(),
      // Folders
      ...(() => { const c = crud('autoeditors_folders', 'Folder', 'autoeditors', ['name']); return { getFolders: c.getAll, createFolder: c.create, updateFolder: c.update, deleteFolder: c.delete }; })(),
      /** Trigger sync for a folder. */
      async syncFolder(id) {
        if (_baseUrl) return _fetch('POST', `/autoeditors/folders/${id}/sync`);
        const f = _db.autoeditors_folders.find((x) => x.id === id); if (!f) throw new Error('Folder not found');
        f.lastSync = now(); f.updatedAt = now(); _audit('folder_synced', 'autoeditors', id, `Sync: ${f.name}`); save();
        _emit('data:changed', { collection: 'autoeditors_folders', action: 'update', id }); return clone(f);
      },
      /** Get activity logs with optional filters. */
      async getLogs(f) {
        if (_baseUrl) return _fetch('GET', '/autoeditors/logs');
        return ok(clone(applyFilters(_db.autoeditors_logs, f, { editorId: (r, v) => r.editorId === v, action: (r, v) => r.action === v, dateFrom: (r, v) => r.ts >= v, dateTo: (r, v) => r.ts <= v })));
      },
      ...configPair('autoeditors_config', 'autoeditors'),
      /** Computed dashboard statistics. */
      async getDashboardStats() {
        if (_baseUrl) return _fetch('GET', '/autoeditors/dashboard');
        const a = _db.autoeditors_assignments;
        return ok({ totalEditors: _db.autoeditors_editors.length, activeEditors: _db.autoeditors_editors.filter((e) => e.enabled).length, totalAssignments: a.length, pending: a.filter((x) => x.status === 'pending').length, inProgress: a.filter((x) => x.status === 'in_progress').length, completed: a.filter((x) => x.status === 'completed').length, folders: _db.autoeditors_folders.length });
      }
    },

    // =========================================================================
    //  Superboost
    // =========================================================================
    superboost: {
      // Accounts
      async getAccounts(f) {
        if (_baseUrl) return _fetch('GET', '/superboost/accounts');
        return ok(clone(applyFilters(_db.superboost_accounts, f, { platform: (r, v) => r.platform === v, status: (r, v) => r.status === v })));
      },
      ...(() => { const c = crud('superboost_accounts', 'Account', 'superboost', ['username','platform']); return { createAccount: c.create, updateAccount: c.update, deleteAccount: c.delete }; })(),
      // Tasks
      async getTasks(f) {
        if (_baseUrl) return _fetch('GET', '/superboost/tasks');
        return ok(clone(applyFilters(_db.superboost_tasks, f, { status: (r, v) => r.status === v, platform: (r, v) => r.platform === v, accountId: (r, v) => r.accountId === v })));
      },
      ...(() => {
        const c = crud('superboost_tasks', 'Task', 'superboost', ['type']);
        return { createTask: async (data) => { if (_baseUrl) return _fetch('POST', '/superboost/tasks', data); req(data, ['type'], 'Task'); const e = { id: uid(), status: 'pending', assignedTo: null, result: null, ...data, createdAt: now(), updatedAt: now() }; _db.superboost_tasks.push(e); _audit('task_created', 'superboost', e.id, `Type: ${data.type}`); save(); _emit('data:changed', { collection: 'superboost_tasks', action: 'create' }); return clone(e); }, updateTask: c.update, deleteTask: c.delete };
      })(),
      /** Assign a task to an assistant. */
      async assignTask(taskId, assistantId) {
        if (_baseUrl) return _fetch('POST', `/superboost/tasks/${taskId}/assign`, { assistantId });
        const t = _db.superboost_tasks.find((x) => x.id === taskId); if (!t) throw new Error('Task not found');
        t.assignedTo = assistantId; t.status = 'assigned'; t.updatedAt = now();
        _audit('task_assigned', 'superboost', taskId, `-> ${assistantId}`); save();
        _emit('data:changed', { collection: 'superboost_tasks', action: 'update', id: taskId }); return clone(t);
      },
      /** Complete a task with a result. */
      async completeTask(id, result) {
        if (_baseUrl) return _fetch('POST', `/superboost/tasks/${id}/complete`, { result });
        const t = _db.superboost_tasks.find((x) => x.id === id); if (!t) throw new Error('Task not found');
        t.status = 'completed'; t.result = result; t.completedAt = now(); t.updatedAt = now();
        _audit('task_completed', 'superboost', id, 'Completed'); save();
        _emit('data:changed', { collection: 'superboost_tasks', action: 'update', id }); return clone(t);
      },
      // Rules
      ...(() => { const c = crud('superboost_rules', 'Rule', 'superboost', ['name']); return { getRules: c.getAll, createRule: async (data) => { if (_baseUrl) return _fetch('POST', '/superboost/rules', data); req(data, ['name'], 'Rule'); const e = { id: uid(), enabled: true, ...data, createdAt: now(), updatedAt: now() }; _db.superboost_rules.push(e); _audit('rule_created', 'superboost', e.id, `Rule: ${data.name}`); save(); _emit('data:changed', { collection: 'superboost_rules', action: 'create' }); return clone(e); }, updateRule: c.update, deleteRule: c.delete }; })(),
      toggleRule: toggleFn('superboost_rules', 'Rule', 'superboost'),
      // Assistants
      ...(() => { const c = crud('superboost_assistants', 'Assistant', 'superboost', ['name']); return { getAssistants: c.getAll, createAssistant: c.create, updateAssistant: c.update, deleteAssistant: c.delete }; })(),
      ...configPair('superboost_config', 'superboost'),
      /** Computed dashboard statistics. */
      async getDashboardStats() {
        if (_baseUrl) return _fetch('GET', '/superboost/dashboard');
        const t = _db.superboost_tasks;
        return ok({ totalAccounts: _db.superboost_accounts.length, activeAccounts: _db.superboost_accounts.filter((a) => a.status === 'active').length, totalTasks: t.length, pending: t.filter((x) => x.status === 'pending').length, assigned: t.filter((x) => x.status === 'assigned').length, completed: t.filter((x) => x.status === 'completed').length, rules: _db.superboost_rules.length, activeRules: _db.superboost_rules.filter((r) => r.enabled).length, assistants: _db.superboost_assistants.length });
      }
    },

    // =========================================================================
    //  Notifications
    // =========================================================================
    notifications: {
      /** Get notification preferences per system. */
      async getSettings() { return _baseUrl ? _fetch('GET', '/notifications/settings') : ok(clone(_db.notification_settings)); },
      /** Update notification settings for a system. */
      async updateSettings(system, settings) {
        if (_baseUrl) return _fetch('PUT', `/notifications/settings/${system}`, settings);
        if (!_db.notification_settings[system]) throw new Error('Unknown system: ' + system);
        Object.assign(_db.notification_settings[system], settings);
        _audit('notification_settings_updated', system, system, JSON.stringify(settings).slice(0, 120)); save();
        _emit('data:changed', { collection: 'notification_settings', action: 'update' });
        return clone(_db.notification_settings[system]);
      }
    },

    // =========================================================================
    //  Demo Seeder
    // =========================================================================
    /** Reset all data to clean state (no demo data). */
    async seedDemo() {
      // No demo data — production-ready clean state
      save(); _emit('data:changed', { action: 'seed' });
    }
  };

  return api;
})();
