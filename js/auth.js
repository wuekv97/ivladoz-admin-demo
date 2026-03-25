/* ===========================================================
   AUTH & RBAC JAVASCRIPT
   =========================================================== */
/**
 * AUTH - Authentication and RBAC module
 * Simulates HTTPOnly cookie auth with role-based access control
 */
const AUTH = {

  /* ---- State ---- */
  currentUser: null,
  sessionTimeout: 30 * 60 * 1000,  // 30 minutes
  sessionTimer: null,
  sessionWarningTimer: null,
  sessionEndTime: null,
  timerInterval: null,

  /* ---- Role hierarchy ---- */
  ROLE_LEVELS: {
    assistant:   1,
    manager:     2,
    admin:       3,
    super_admin: 4
  },

  ROLE_LABELS: {
    super_admin: 'Super Admin',
    admin:       'Admin',
    manager:     'Manager',
    assistant:   'Assistant'
  },

  ROLE_BADGE_CLASSES: {
    super_admin: 'bg-red-500/20 text-red-400 border border-red-500/30',
    admin:       'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    manager:     'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
    assistant:   'bg-slate-500/20 text-slate-400 border border-slate-500/30'
  },

  AVATAR_COLORS: {
    super_admin: 'bg-red-600',
    admin:       'bg-amber-600',
    manager:     'bg-cyan-600',
    assistant:   'bg-slate-600'
  },

  /* ---- User database (loaded from API or seeded) ---- */
  users: [
    { id: 1, name: 'Yehor K.',     email: 'yehor@ivladoz.com', role: 'super_admin', systems: ['postflow','autoeditors','superboost'], password: 'Ivladoz2026!', status: 'active', lastLogin: '--', loginCount: 0, weeklyActions: 0 },
    { id: 2, name: 'Vladislav I.', email: 'vlad@ivladoz.com',  role: 'admin',       systems: ['postflow','autoeditors','superboost'], password: 'Vlad2026!',    status: 'active', lastLogin: '--', loginCount: 0, weeklyActions: 0 }
  ],

  /* ---- Audit log entries ---- */
  auditLog: [],


  /* ===========================================================
     LOGIN / LOGOUT
     =========================================================== */

  login(email, password) {
    const user = this.users.find(u => u.email === email && u.password === password);
    if (!user) return { success: false, error: 'Invalid email or password.' };
    if (user.status === 'disabled') return { success: false, error: 'Account is disabled. Contact an administrator.' };
    if (user.status === 'locked') return { success: false, error: 'Account is locked. Too many failed attempts.' };

    this.currentUser = { ...user };
    this.startSessionTimer();
    this.applyRoleRestrictions();
    this.updateAuthHeader();

    this.addAuditEntry('login', 'auth', '--', 'Successful login via password');

    return { success: true, user: this.currentUser };
  },

  logout() {
    var isOnline = typeof API !== 'undefined' && API.config && API.config.baseUrl;
    if (isOnline) {
      API.auth.logout().catch(function() {});
    }
    if (this.currentUser) {
      this.addAuditEntry('logout', 'auth', '--', 'Manual logout');
    }
    this.currentUser = null;
    this.clearSessionTimer();
    this.showLoginPage();
  },

  async handleLoginForm(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    const errorTextEl = document.getElementById('login-error-text');

    var isOnline = typeof API !== 'undefined' && API.config && API.config.baseUrl;
    var result;

    if (isOnline) {
      // Use backend API for login
      try {
        var user = await API.auth.login(email, password);
        this.currentUser = user;
        this.startSessionTimer();
        this.applyRoleRestrictions();
        this.updateAuthHeader();
        errorEl.classList.add('hidden');
        this.hideLoginPage();
        // Init CRUD modules after login
        if (typeof POSTFLOW_UI !== 'undefined' && POSTFLOW_UI.init) POSTFLOW_UI.init();
        if (typeof AUTOEDITORS_UI !== 'undefined' && AUTOEDITORS_UI.init) AUTOEDITORS_UI.init();
        if (typeof SB_UI !== 'undefined' && SB_UI.init) SB_UI.init();
        if (typeof switchSystem === 'function') switchSystem('postflow');
        return;
      } catch (e) {
        result = { success: false, error: e.message || 'Login failed' };
      }
    } else {
      result = this.login(email, password);
    }

    if (!result.success) {
      errorTextEl.textContent = result.error;
      errorEl.classList.remove('hidden');
      const card = errorEl.closest('.bg-slate-800\\/80');
      if (card) {
        card.style.animation = 'none';
        card.offsetHeight;
        card.style.animation = 'shake 0.4s ease-in-out';
      }
      return;
    }

    errorEl.classList.add('hidden');
    this.hideLoginPage();
  },

  showLoginPage() {
    const page = document.getElementById('login-page');
    if (page) {
      page.classList.remove('hidden');
      page.style.display = '';
    }
    const sidebar = document.getElementById('app-sidebar');
    const main = document.getElementById('app-main');
    if (sidebar) sidebar.classList.add('hidden');
    if (main) main.classList.add('hidden');
    const form = document.getElementById('login-form');
    if (form) form.reset();
    const errorEl = document.getElementById('login-error');
    if (errorEl) errorEl.classList.add('hidden');
  },

  hideLoginPage() {
    const page = document.getElementById('login-page');
    if (page) page.style.display = 'none';
    document.getElementById('app-sidebar').classList.remove('hidden');
    document.getElementById('app-main').classList.remove('hidden');
    const header = document.getElementById('auth-header');
    if (header) {
      header.classList.remove('hidden');
      header.classList.add('flex');
    }
  },

  togglePasswordVisibility() {
    const input = document.getElementById('login-password');
    const icon = document.getElementById('password-eye-icon');
    if (input.type === 'password') {
      input.type = 'text';
      icon.className = 'ph-bold ph-eye-slash text-base';
    } else {
      input.type = 'password';
      icon.className = 'ph-bold ph-eye text-base';
    }
  },



  /* ===========================================================
     PERMISSIONS
     =========================================================== */

  checkPermission(system, action) {
    if (!this.currentUser) return false;
    const role = this.currentUser.role;
    const level = this.ROLE_LEVELS[role];
    const hasSys = role === 'super_admin' || this.currentUser.systems.includes(system);
    if (!hasSys) return false;

    const perms = {
      dashboard:    { view: 1 },
      postflow:      { view: 1, run: 2, create: 3, edit: 3, delete: 4 },
      autoeditors:       { view: 1, assign: 2, create: 3, edit: 3, delete: 4 },
      superboost:   { view: 1, do_task: 1, create: 3, edit: 3, delete: 4 },
      config:       { view: 2, edit: 3 },
      users:        { view: 2, create: 3, edit: 3, delete: 4 },
      audit:        { view: 3 },
      alerts:       { view: 2, manage: 3, dismiss: 3 }
    };

    const systemPerms = perms[system];
    if (!systemPerms) return false;
    const requiredLevel = systemPerms[action];
    if (requiredLevel === undefined) return false;

    return level >= requiredLevel;
  },

  hasRole(minRole) {
    if (!this.currentUser) return false;
    const userLevel = this.ROLE_LEVELS[this.currentUser.role];
    const requiredLevel = this.ROLE_LEVELS[minRole];
    return userLevel >= requiredLevel;
  },

  hasSystem(system) {
    if (!this.currentUser) return false;
    if (this.currentUser.role === 'super_admin') return true;
    return this.currentUser.systems.includes(system);
  },


  /* ===========================================================
     ROLE-BASED UI RESTRICTIONS
     =========================================================== */

  applyRoleRestrictions() {
    if (!this.currentUser) return;

    document.querySelectorAll('[data-min-role]').forEach(el => {
      const requiredRole = el.getAttribute('data-min-role');
      if (this.hasRole(requiredRole)) {
        el.style.display = '';
        el.classList.remove('auth-hidden');
      } else {
        el.style.display = 'none';
        el.classList.add('auth-hidden');
      }
    });

    document.querySelectorAll('[data-system]').forEach(el => {
      const sys = el.getAttribute('data-system');
      if (this.hasSystem(sys)) {
        el.style.display = '';
        el.classList.remove('auth-hidden');
      } else {
        el.style.display = 'none';
        el.classList.add('auth-hidden');
      }
    });

    const saOption = document.getElementById('user-modal-role-sa');
    if (saOption) {
      saOption.style.display = this.currentUser.role === 'super_admin' ? '' : 'none';
    }

    this.updateSidebarVisibility();
  },

  updateSidebarVisibility() {
    if (!this.currentUser) return;
    const role = this.currentUser.role;
    const level = this.ROLE_LEVELS[role];

    const navConfig = document.getElementById('nav-config');
    if (navConfig) navConfig.style.display = level >= 2 ? '' : 'none';

    const navAlerts = document.getElementById('nav-alerts');
    if (navAlerts) navAlerts.style.display = level >= 2 ? '' : 'none';

    const navUsers = document.getElementById('nav-users');
    if (navUsers) navUsers.style.display = level >= 3 ? '' : 'none';
    const navAudit = document.getElementById('nav-audit');
    if (navAudit) navAudit.style.display = level >= 3 ? '' : 'none';
  },


  /* ===========================================================
     AUTH HEADER
     =========================================================== */

  updateAuthHeader() {
    if (!this.currentUser) return;

    const user = this.currentUser;
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();

    const avatar = document.getElementById('auth-avatar');
    if (avatar) {
      avatar.textContent = initials;
      avatar.className = 'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ' + this.AVATAR_COLORS[user.role];
    }

    const nameEl = document.getElementById('auth-username');
    if (nameEl) nameEl.textContent = user.name;

    const badgeEl = document.getElementById('auth-role-badge');
    if (badgeEl) {
      badgeEl.textContent = this.ROLE_LABELS[user.role];
      badgeEl.className = 'inline-flex items-center px-1.5 py-0 rounded text-[10px] font-medium leading-relaxed ' + this.ROLE_BADGE_CLASSES[user.role];
    }

    const dName = document.getElementById('dropdown-user-name');
    if (dName) dName.textContent = user.name;
    const dEmail = document.getElementById('dropdown-user-email');
    if (dEmail) dEmail.textContent = user.email;

    const header = document.getElementById('auth-header');
    if (header) header.classList.remove('hidden');
    if (header) header.classList.add('flex');

    this.populateAuditUserFilter();
  },

  toggleUserMenu() {
    const dropdown = document.getElementById('user-dropdown');
    if (dropdown) dropdown.classList.toggle('hidden');
  },

  closeUserMenu() {
    const dropdown = document.getElementById('user-dropdown');
    if (dropdown) dropdown.classList.add('hidden');
  },


  /* ===========================================================
     SESSION TIMER
     =========================================================== */

  startSessionTimer() {
    this.clearSessionTimer();
    this.sessionEndTime = Date.now() + this.sessionTimeout;

    this.timerInterval = setInterval(() => {
      this.updateSessionDisplay();
    }, 1000);

    this.sessionWarningTimer = setTimeout(() => {
      this.showSessionWarning();
    }, this.sessionTimeout - (5 * 60 * 1000));

    this.sessionTimer = setTimeout(() => {
      this.logout();
    }, this.sessionTimeout);

    this.updateSessionDisplay();
  },

  clearSessionTimer() {
    if (this.sessionTimer) clearTimeout(this.sessionTimer);
    if (this.sessionWarningTimer) clearTimeout(this.sessionWarningTimer);
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.sessionTimer = null;
    this.sessionWarningTimer = null;
    this.timerInterval = null;
    this.sessionEndTime = null;
  },

  updateSessionDisplay() {
    if (!this.sessionEndTime) return;
    const remaining = Math.max(0, this.sessionEndTime - Date.now());
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    const timerText = document.getElementById('session-timer-text');
    if (timerText) {
      timerText.textContent = 'Session: ' + minutes + 'm ' + String(seconds).padStart(2, '0') + 's left';
      if (minutes < 5) {
        timerText.classList.remove('text-slate-500');
        timerText.classList.add('text-amber-400');
      } else {
        timerText.classList.remove('text-amber-400');
        timerText.classList.add('text-slate-500');
      }
    }

    if (remaining <= 5 * 60 * 1000) {
      const warningTime = document.getElementById('session-warning-time');
      if (warningTime) {
        warningTime.textContent = minutes + ':' + String(seconds).padStart(2, '0');
      }
    }

    if (remaining === 0) {
      this.logout();
    }
  },

  showSessionWarning() {
    const modal = document.getElementById('session-warning-modal');
    if (modal) modal.classList.remove('hidden');
  },

  hideSessionWarning() {
    const modal = document.getElementById('session-warning-modal');
    if (modal) modal.classList.add('hidden');
  },

  extendSession() {
    this.startSessionTimer();
    this.hideSessionWarning();
  },


  /* ===========================================================
     AUDIT LOG HELPERS
     =========================================================== */

  addAuditEntry(action, system, target, details) {
    const entry = {
      id: this.auditLog.length + 1,
      ts: new Date().toISOString().replace('T', ' ').substring(0, 19),
      user: this.currentUser ? this.currentUser.name : 'System',
      action: action,
      system: system,
      target: target,
      ip: '91.220.41.18',
      details: details
    };
    this.auditLog.unshift(entry);
  },

  populateAuditUserFilter() {
    const select = document.getElementById('audit-filter-user');
    if (!select) return;
    const uniqueUsers = [...new Set(this.auditLog.map(e => e.user))];
    while (select.options.length > 1) select.remove(1);
    uniqueUsers.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u;
      opt.textContent = u;
      select.appendChild(opt);
    });
  },


  /* ===========================================================
     INIT
     =========================================================== */

  init() {
    this.showLoginPage();
    document.getElementById('app-sidebar').classList.add('hidden');
    document.getElementById('app-main').classList.add('hidden');

    document.addEventListener('click', (e) => {
      const wrapper = document.getElementById('user-menu-wrapper');
      if (wrapper && !wrapper.contains(e.target)) {
        this.closeUserMenu();
      }
    });

    if (!document.getElementById('auth-shake-style')) {
      const style = document.createElement('style');
      style.id = 'auth-shake-style';
      style.textContent = '@keyframes shake { 0%, 100% { transform: translateX(0); } 20%, 60% { transform: translateX(-6px); } 40%, 80% { transform: translateX(6px); } }';
      document.head.appendChild(style);
    }

    AUTH_UI.renderUsersTable();
    AUTH_UI.renderAuditTable();
  },

  // No-op in unified layout (header is already in topbar)
  injectAuthHeader() {}
};


/**
 * AUTH_UI - UI rendering helpers for User Management and Audit Log
 */
const AUTH_UI = {

  editingUserId: null,
  modalStatusActive: true,

  /* ===========================================================
     USERS TABLE
     =========================================================== */

  renderUsersTable(filteredUsers) {
    const users = filteredUsers || AUTH.users;
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;

    tbody.innerHTML = users.map(user => {
      const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
      const roleBadge = AUTH.ROLE_BADGE_CLASSES[user.role];
      const roleLabel = AUTH.ROLE_LABELS[user.role];
      const avatarColor = AUTH.AVATAR_COLORS[user.role];

      const statusBadge = user.status === 'active'
        ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400"><i class="ph-bold ph-check-circle text-[10px]"></i> Active</span>'
        : user.status === 'disabled'
          ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/20 text-slate-400"><i class="ph-bold ph-prohibit text-[10px]"></i> Disabled</span>'
          : '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400"><i class="ph-bold ph-lock text-[10px]"></i> Locked</span>';

      const systemTags = user.systems.map(s => {
        const colors = { postflow: 'bg-cyan-500/15 text-cyan-400', autoeditors: 'bg-violet-500/15 text-violet-400', superboost: 'bg-amber-500/15 text-amber-400' };
        return '<span class="px-1.5 py-0.5 rounded text-[10px] font-medium ' + (colors[s] || 'bg-slate-500/15 text-slate-400') + '">' + s + '</span>';
      }).join(' ');

      const canEdit = AUTH.currentUser && (
        AUTH.currentUser.role === 'super_admin' ||
        (AUTH.currentUser.role === 'admin' && AUTH.ROLE_LEVELS[user.role] < AUTH.ROLE_LEVELS['admin'])
      );

      return '<tr class="border-b border-slate-700/50 hover:bg-slate-800/50" data-user-id="' + user.id + '" data-role="' + user.role + '" data-status="' + user.status + '" data-systems="' + user.systems.join(',') + '">'
        + '<td class="px-4 py-3"><input type="checkbox" class="user-select-cb w-3.5 h-3.5 rounded border-slate-600 bg-slate-900/60 text-cyan-500 cursor-pointer" value="' + user.id + '" onchange="AUTH_UI.updateBulkBar()"></td>'
        + '<td class="px-4 py-3"><div class="flex items-center gap-3">'
        + '<div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ' + avatarColor + '">' + initials + '</div>'
        + '<div><p class="text-sm font-medium text-white">' + user.name + '</p><p class="text-xs text-slate-500 font-mono">' + user.email + '</p></div>'
        + '</div></td>'
        + '<td class="px-4 py-3"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ' + roleBadge + '">' + roleLabel + '</span></td>'
        + '<td class="px-4 py-3"><div class="flex flex-wrap gap-1">' + systemTags + '</div></td>'
        + '<td class="px-4 py-3">' + statusBadge + '</td>'
        + '<td class="px-4 py-3 text-xs text-slate-400 font-mono whitespace-nowrap">' + user.lastLogin + '</td>'
        + '<td class="px-4 py-3 text-right">'
        + (canEdit
          ? '<div class="flex items-center justify-end gap-1">'
            + '<button onclick="AUTH_UI.openEditUserModal(' + user.id + ')" class="text-slate-400 hover:text-cyan-400 p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors" title="Edit"><i class="ph-bold ph-pencil-simple text-sm"></i></button>'
            + '<button onclick="AUTH_UI.toggleUserStatus(' + user.id + ')" class="text-slate-400 hover:text-amber-400 p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors" title="Toggle Status"><i class="ph-bold ph-power text-sm"></i></button>'
            + '</div>'
          : '<span class="text-xs text-slate-600">--</span>')
        + '</td>'
        + '</tr>';
    }).join('');

    const countEl = document.getElementById('users-table-count');
    if (countEl) countEl.textContent = 'Showing ' + users.length + ' user' + (users.length !== 1 ? 's' : '');
  },

  filterUsers() {
    const search = (document.getElementById('users-search')?.value || '').toLowerCase();
    const roleFilter = document.getElementById('users-filter-role')?.value || '';
    const statusFilter = document.getElementById('users-filter-status')?.value || '';
    const systemFilter = document.getElementById('users-filter-system')?.value || '';

    const filtered = AUTH.users.filter(u => {
      if (search && !u.name.toLowerCase().includes(search) && !u.email.toLowerCase().includes(search)) return false;
      if (roleFilter && u.role !== roleFilter) return false;
      if (statusFilter && u.status !== statusFilter) return false;
      if (systemFilter && !u.systems.includes(systemFilter)) return false;
      return true;
    });

    this.renderUsersTable(filtered);
  },

  toggleSelectAll() {
    const master = document.getElementById('users-select-all');
    document.querySelectorAll('.user-select-cb').forEach(cb => {
      cb.checked = master.checked;
    });
    this.updateBulkBar();
  },

  updateBulkBar() {
    const checked = document.querySelectorAll('.user-select-cb:checked');
    const bar = document.getElementById('users-bulk-bar');
    const count = document.getElementById('users-bulk-count');
    if (checked.length > 0) {
      bar.classList.remove('hidden');
      count.textContent = checked.length + ' selected';
    } else {
      bar.classList.add('hidden');
    }
  },

  bulkAction(action) {
    const checked = document.querySelectorAll('.user-select-cb:checked');
    const ids = Array.from(checked).map(cb => parseInt(cb.value));
    ids.forEach(id => {
      const user = AUTH.users.find(u => u.id === id);
      if (!user) return;
      if (action === 'enable') user.status = 'active';
      if (action === 'disable') user.status = 'disabled';
      if (action === 'delete') {
        const idx = AUTH.users.findIndex(u => u.id === id);
        if (idx >= 0) AUTH.users.splice(idx, 1);
      }
    });
    document.getElementById('users-select-all').checked = false;
    this.renderUsersTable();
    this.updateBulkBar();
  },


  /* ===========================================================
     USER MODAL
     =========================================================== */

  openAddUserModal() {
    this.editingUserId = null;
    this.modalStatusActive = true;

    document.getElementById('user-modal-title').innerHTML = '<i class="ph-bold ph-user-plus text-cyan-400"></i> <span>Add User</span>';
    document.getElementById('user-modal-name').value = '';
    document.getElementById('user-modal-email').value = '';
    document.getElementById('user-modal-role').value = 'assistant';
    document.getElementById('user-modal-sys-postflow').checked = false;
    document.getElementById('user-modal-sys-autoeditors').checked = false;
    document.getElementById('user-modal-sys-superboost').checked = false;
    this.syncChipStates();
    document.getElementById('user-modal-info').classList.add('hidden');
    this.setToggleState(true);

    document.getElementById('user-modal-overlay').classList.remove('hidden');
  },

  openEditUserModal(userId) {
    const user = AUTH.users.find(u => u.id === userId);
    if (!user) return;
    this.editingUserId = userId;
    this.modalStatusActive = user.status === 'active';

    document.getElementById('user-modal-title').innerHTML = '<i class="ph-bold ph-user-gear text-cyan-400"></i> <span>Edit User</span>';
    document.getElementById('user-modal-name').value = user.name;
    document.getElementById('user-modal-email').value = user.email;
    document.getElementById('user-modal-role').value = user.role;
    document.getElementById('user-modal-sys-postflow').checked = user.systems.includes('postflow');
    document.getElementById('user-modal-sys-autoeditors').checked = user.systems.includes('autoeditors');
    document.getElementById('user-modal-sys-superboost').checked = user.systems.includes('superboost');
    this.syncChipStates();
    this.setToggleState(user.status === 'active');

    document.getElementById('user-modal-info').classList.remove('hidden');
    document.getElementById('user-modal-last-login').textContent = user.lastLogin;
    document.getElementById('user-modal-login-count').textContent = user.loginCount;
    document.getElementById('user-modal-weekly-actions').textContent = user.weeklyActions;

    document.getElementById('user-modal-overlay').classList.remove('hidden');
  },

  closeUserModal() {
    document.getElementById('user-modal-overlay').classList.add('hidden');
    this.editingUserId = null;
  },

  toggleSystemChip(system) {
    const cb = document.getElementById('user-modal-sys-' + system);
    if (!cb) return;
    cb.checked = !cb.checked;
    this.syncChipStates();
  },

  syncChipStates() {
    var chipColors = { postflow: 'cyan', autoeditors: 'violet', superboost: 'amber' };
    ['postflow', 'autoeditors', 'superboost'].forEach(function(sys) {
      var cb = document.getElementById('user-modal-sys-' + sys);
      var chip = document.getElementById('sys-chip-' + sys);
      if (!cb || !chip) return;
      var color = chipColors[sys];
      if (cb.checked) {
        chip.className = 'sys-chip flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer border-2 border-' + color + '-500/60 bg-' + color + '-500/15 text-' + color + '-400 shadow-sm shadow-' + color + '-500/10';
      } else {
        chip.className = 'sys-chip flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer border-2 border-slate-600/40 bg-slate-900/40 text-slate-500 hover:border-' + color + '-500/40';
      }
    });
  },

  toggleModalStatus() {
    this.modalStatusActive = !this.modalStatusActive;
    this.setToggleState(this.modalStatusActive);
  },

  setToggleState(active) {
    const toggle = document.getElementById('user-modal-status-toggle');
    const dot = toggle.querySelector('span');
    if (active) {
      toggle.classList.remove('bg-slate-600');
      toggle.classList.add('bg-emerald-500');
      dot.style.left = '1.25rem';
    } else {
      toggle.classList.remove('bg-emerald-500');
      toggle.classList.add('bg-slate-600');
      dot.style.left = '0.125rem';
    }
  },

  saveUser() {
    const name = document.getElementById('user-modal-name').value.trim();
    const email = document.getElementById('user-modal-email').value.trim();
    const role = document.getElementById('user-modal-role').value;
    const systems = [];
    if (document.getElementById('user-modal-sys-postflow').checked) systems.push('postflow');
    if (document.getElementById('user-modal-sys-autoeditors').checked) systems.push('autoeditors');
    if (document.getElementById('user-modal-sys-superboost').checked) systems.push('superboost');
    const status = this.modalStatusActive ? 'active' : 'disabled';

    if (!name || !email) return;

    if (this.editingUserId) {
      const user = AUTH.users.find(u => u.id === this.editingUserId);
      if (user) {
        const oldRole = user.role;
        user.name = name;
        user.email = email;
        user.role = role;
        user.systems = systems;
        user.status = status;

        if (oldRole !== role) {
          AUTH.addAuditEntry('permission_changed', 'auth', name, 'Role changed from ' + AUTH.ROLE_LABELS[oldRole] + ' to ' + AUTH.ROLE_LABELS[role]);
        }
      }
    } else {
      const newId = Math.max(...AUTH.users.map(u => u.id)) + 1;
      AUTH.users.push({
        id: newId,
        name: name,
        email: email,
        role: role,
        systems: systems,
        password: 'Change1!',
        status: status,
        lastLogin: '--',
        loginCount: 0,
        weeklyActions: 0
      });
      AUTH.addAuditEntry('user_created', 'auth', name + ' (' + role + ')', 'New ' + AUTH.ROLE_LABELS[role] + ' account created');
    }

    this.closeUserModal();
    this.renderUsersTable();
  },

  toggleUserStatus(userId) {
    const user = AUTH.users.find(u => u.id === userId);
    if (!user) return;
    user.status = user.status === 'active' ? 'disabled' : 'active';
    this.renderUsersTable();
  },

  resetPassword() {
    if (this.editingUserId) {
      const user = AUTH.users.find(u => u.id === this.editingUserId);
      if (user) {
        user.password = 'Change1!';
        AUTH.addAuditEntry('permission_changed', 'auth', user.name, 'Password reset to default');
        const btn = document.querySelector('#user-modal-info button');
        if (btn) {
          const orig = btn.innerHTML;
          btn.innerHTML = '<i class="ph-bold ph-check text-sm"></i> Password Reset';
          btn.classList.remove('text-amber-400');
          btn.classList.add('text-emerald-400');
          setTimeout(() => {
            btn.innerHTML = orig;
            btn.classList.remove('text-emerald-400');
            btn.classList.add('text-amber-400');
          }, 2000);
        }
      }
    }
  },


  /* ===========================================================
     AUDIT LOG TABLE
     =========================================================== */

  renderAuditTable(filteredLogs) {
    const logs = filteredLogs || AUTH.auditLog;
    const tbody = document.getElementById('audit-table-body');
    if (!tbody) return;

    const actionBadges = {
      login:              'bg-emerald-500/20 text-emerald-400',
      logout:             'bg-slate-500/20 text-slate-400',
      failed_login:       'bg-red-500/20 text-red-400',
      config_change:      'bg-amber-500/20 text-amber-400',
      user_created:       'bg-cyan-500/20 text-cyan-400',
      task_completed:     'bg-emerald-500/20 text-emerald-400',
      batch_triggered:    'bg-violet-500/20 text-violet-400',
      permission_changed: 'bg-amber-500/20 text-amber-400'
    };

    const actionIcons = {
      login:              'ph-sign-in',
      logout:             'ph-sign-out',
      failed_login:       'ph-warning',
      config_change:      'ph-gear-six',
      user_created:       'ph-user-plus',
      task_completed:     'ph-check-circle',
      batch_triggered:    'ph-play',
      permission_changed: 'ph-shield-check'
    };

    tbody.innerHTML = logs.map(entry => {
      const badge = actionBadges[entry.action] || 'bg-slate-500/20 text-slate-400';
      const icon = actionIcons[entry.action] || 'ph-info';
      const actionLabel = entry.action.replace(/_/g, ' ');

      const systemColors = {
        auth:       'text-slate-400',
        postflow:    'text-cyan-400',
        autoeditors:     'text-violet-400',
        superboost: 'text-amber-400'
      };
      const sysColor = systemColors[entry.system] || 'text-slate-400';

      return '<tr class="border-b border-slate-700/50 hover:bg-slate-800/50">'
        + '<td class="px-5 py-3 text-xs text-slate-400 font-mono whitespace-nowrap">' + entry.ts + '</td>'
        + '<td class="px-5 py-3 text-sm text-white whitespace-nowrap">' + entry.user + '</td>'
        + '<td class="px-5 py-3"><span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ' + badge + '"><i class="ph-bold ' + icon + ' text-[10px]"></i> ' + actionLabel + '</span></td>'
        + '<td class="px-5 py-3 text-sm ' + sysColor + ' font-medium">' + entry.system + '</td>'
        + '<td class="px-5 py-3 text-sm text-slate-300 font-mono text-xs">' + entry.target + '</td>'
        + '<td class="px-5 py-3 text-xs text-slate-500 font-mono">' + entry.ip + '</td>'
        + '<td class="px-5 py-3 text-xs text-slate-400 max-w-[200px] truncate" title="' + entry.details + '">' + entry.details + '</td>'
        + '</tr>';
    }).join('');

    const countEl = document.getElementById('audit-table-count');
    if (countEl) countEl.textContent = 'Showing ' + logs.length + ' entr' + (logs.length !== 1 ? 'ies' : 'y');
  },

  filterAuditLogs() {
    const search = (document.getElementById('audit-search')?.value || '').toLowerCase();
    const userFilter = document.getElementById('audit-filter-user')?.value || '';
    const actionFilter = document.getElementById('audit-filter-action')?.value || '';
    const systemFilter = document.getElementById('audit-filter-system')?.value || '';
    const dateFrom = document.getElementById('audit-date-from')?.value || '';
    const dateTo = document.getElementById('audit-date-to')?.value || '';

    const filtered = AUTH.auditLog.filter(e => {
      if (search && !e.user.toLowerCase().includes(search) && !e.details.toLowerCase().includes(search) && !e.target.toLowerCase().includes(search)) return false;
      if (userFilter && e.user !== userFilter) return false;
      if (actionFilter && e.action !== actionFilter) return false;
      if (systemFilter && e.system !== systemFilter) return false;
      if (dateFrom) {
        const entryDate = e.ts.substring(0, 10);
        if (entryDate < dateFrom) return false;
      }
      if (dateTo) {
        const entryDate = e.ts.substring(0, 10);
        if (entryDate > dateTo) return false;
      }
      return true;
    });

    this.renderAuditTable(filtered);
  },

  exportAuditLog() {
    const btn = event.currentTarget;
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="ph-bold ph-check text-base"></i> Exported';
    btn.classList.add('text-emerald-400', 'border-emerald-500/30');
    setTimeout(() => {
      btn.innerHTML = orig;
      btn.classList.remove('text-emerald-400', 'border-emerald-500/30');
    }, 2000);
  }
};
