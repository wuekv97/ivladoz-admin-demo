/**
 * IVLADOZ Admin Panel -- Setup Wizard
 *
 * First-run configuration wizard. Guides the user through setting up
 * all three systems (Postflow, Autoeditors, Superboost) without
 * touching any .env files or config files.
 *
 * Config is stored in localStorage under 'ivladoz_setup'.
 * @file setup-wizard.js
 */
/* global localStorage */
/* eslint-disable no-unused-vars */

const SETUP_WIZARD = (() => {
  'use strict';

  const STORAGE_KEY = 'ivladoz_setup';
  const COMPLETE_KEY = 'ivladoz_setup_complete';

  let _step = 0;
  const TOTAL_STEPS = 5; // 0-indexed: 0=Welcome, 1=Postflow, 2=Autoeditors, 3=Superboost, 4=Review

  // ---- Helpers ----
  const $ = (id) => document.getElementById(id);
  const san = (s) => String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));

  /** Check if setup is already complete */
  function isComplete() {
    return localStorage.getItem(COMPLETE_KEY) === 'true';
  }

  /** Get saved config or defaults */
  function getConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {
      postflow: {
        telegram_bot_token: '',
        post_interval_seconds: '120',
        max_retries: '3',
        quarantine_hours: '24',
        timezone: 'Europe/Athens'
      },
      autoeditors: {
        telegram_bot_token: '',
        service_account_json: '',
        google_service_account_email: '',
        google_sheets_id: '',
        sync_interval_minutes: '15',
        max_active_per_editor: '5',
        auto_assign: true,
        folders: []
      },
      superboost: {
        telegram_bot_token: '',
        max_daily_tasks: '50',
        cooldown_minutes: '30',
        auto_rotate: true,
        default_platform: 'telegram'
      },
      admin: {
        name: '',
        email: '',
        password: ''
      }
    };
  }

  /** Save config to localStorage */
  function saveConfig(cfg) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  }

  // ---- Step rendering ----

  function renderStep(step) {
    _step = step;
    const cfg = getConfig();

    // Update progress bar
    const pct = ((step + 1) / (TOTAL_STEPS + 1)) * 100;
    const bar = $('wiz-progress-bar');
    if (bar) bar.style.width = pct + '%';

    // Update step indicators
    for (let i = 0; i <= TOTAL_STEPS; i++) {
      const dot = $('wiz-step-' + i);
      if (!dot) continue;
      dot.className = i < step
        ? 'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-cyan-500 text-white'
        : i === step
          ? 'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-cyan-500/20 text-cyan-400 ring-2 ring-cyan-500'
          : 'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-slate-700 text-slate-500';
    }

    // Update nav buttons
    const prevBtn = $('wiz-prev-btn');
    const nextBtn = $('wiz-next-btn');
    if (prevBtn) prevBtn.style.display = step === 0 ? 'none' : '';
    if (nextBtn) {
      if (step === TOTAL_STEPS) {
        nextBtn.innerHTML = '<i class="ph-bold ph-rocket-launch"></i> Launch Panel';
        nextBtn.className = 'px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-400 hover:to-blue-400 transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-cyan-500/25';
      } else {
        nextBtn.innerHTML = 'Next <i class="ph-bold ph-arrow-right"></i>';
        nextBtn.className = 'px-6 py-2.5 rounded-xl text-sm font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition-colors cursor-pointer flex items-center gap-2';
      }
    }

    // Render content
    const container = $('wiz-step-content');
    if (!container) return;

    switch (step) {
      case 0: container.innerHTML = stepWelcome(); break;
      case 1: container.innerHTML = stepPostflow(cfg); break;
      case 2: container.innerHTML = stepAutoeditors(cfg); break;
      case 3: container.innerHTML = stepSuperboost(cfg); break;
      case 4: container.innerHTML = stepReview(cfg); break;
    }

    // Attach live token checkers after DOM is ready
    requestAnimationFrame(function() {
      if (step === 1) attachTokenChecker('wiz-pf-bot-token', 'wiz-pf-bot-info', 'cyan');
      if (step === 2) attachTokenChecker('wiz-ae-bot-token', 'wiz-ae-bot-info', 'violet');
      if (step === 3) attachTokenChecker('wiz-sb-bot-token', 'wiz-sb-bot-info', 'amber');
    });
  }

  // ---- Step templates ----

  function stepWelcome() {
    return `
      <div class="text-center max-w-lg mx-auto">
        <div class="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 mb-6">
          <i class="ph-bold ph-gear-six text-3xl text-cyan-400"></i>
        </div>
        <h2 class="text-2xl font-bold text-white mb-3">Welcome to Setup</h2>
        <p class="text-slate-400 mb-8 leading-relaxed">
          This wizard will guide you through configuring all three systems.
          You'll set up Telegram bot tokens, Google Drive integration,
          and your admin account — all from this interface.
        </p>
        <div class="grid grid-cols-3 gap-4 text-center">
          <div class="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
            <i class="ph-bold ph-stack text-2xl text-cyan-400 mb-2"></i>
            <p class="text-xs text-slate-400">Postflow</p>
          </div>
          <div class="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
            <i class="ph-bold ph-google-drive-logo text-2xl text-violet-400 mb-2"></i>
            <p class="text-xs text-slate-400">Autoeditors</p>
          </div>
          <div class="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
            <i class="ph-bold ph-rocket-launch text-2xl text-amber-400 mb-2"></i>
            <p class="text-xs text-slate-400">Superboost</p>
          </div>
        </div>
      </div>`;
  }

  function inputField(id, label, value, opts) {
    const type = (opts && opts.type) || 'text';
    const placeholder = (opts && opts.placeholder) || '';
    const hint = (opts && opts.hint) || '';
    const icon = (opts && opts.icon) || '';
    const required = opts && opts.required;

    return `
      <div class="space-y-1.5">
        <label for="${id}" class="flex items-center gap-2 text-sm font-medium text-slate-300">
          ${icon ? '<i class="ph-bold ' + icon + ' text-slate-500"></i>' : ''}
          ${san(label)}
          ${required ? '<span class="text-red-400 text-xs">*</span>' : ''}
        </label>
        <input id="${id}" type="${type}" value="${san(value || '')}"
               placeholder="${san(placeholder)}"
               class="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-colors font-mono">
        ${hint ? '<p class="text-xs text-slate-600">' + hint + '</p>' : ''}
      </div>`;
  }

  function toggleField(id, label, checked, hint) {
    return `
      <div class="flex items-center justify-between py-2">
        <div>
          <p class="text-sm text-slate-300">${san(label)}</p>
          ${hint ? '<p class="text-xs text-slate-600">' + hint + '</p>' : ''}
        </div>
        <button type="button" id="${id}" onclick="SETUP_WIZARD.toggleSwitch('${id}')"
                class="relative w-11 h-6 rounded-full transition-colors cursor-pointer ${checked ? 'bg-cyan-500' : 'bg-slate-600'}">
          <span class="absolute top-0.5 ${checked ? 'left-5.5' : 'left-0.5'} w-5 h-5 bg-white rounded-full shadow transition-all"></span>
        </button>
      </div>`;
  }

  function selectField(id, label, value, options, opts) {
    const icon = (opts && opts.icon) || '';
    const hint = (opts && opts.hint) || '';
    const optionsHtml = options.map(function(o) {
      const val = typeof o === 'string' ? o : o.value;
      const text = typeof o === 'string' ? o : o.label;
      return '<option value="' + san(val) + '"' + (val === value ? ' selected' : '') + '>' + san(text) + '</option>';
    }).join('');

    return `
      <div class="space-y-1.5">
        <label for="${id}" class="flex items-center gap-2 text-sm font-medium text-slate-300">
          ${icon ? '<i class="ph-bold ' + icon + ' text-slate-500"></i>' : ''}
          ${san(label)}
        </label>
        <select id="${id}" class="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-colors">
          ${optionsHtml}
        </select>
        ${hint ? '<p class="text-xs text-slate-600">' + hint + '</p>' : ''}
      </div>`;
  }

  function sectionHeader(icon, title, accent) {
    const colorClass = accent === 'violet' ? 'text-violet-400' : accent === 'amber' ? 'text-amber-400' : 'text-cyan-400';
    const bgClass = accent === 'violet' ? 'bg-violet-500/10' : accent === 'amber' ? 'bg-amber-500/10' : 'bg-cyan-500/10';
    return `
      <div class="flex items-center gap-3 mb-5">
        <div class="w-10 h-10 rounded-lg ${bgClass} flex items-center justify-center">
          <i class="ph-bold ${icon} text-lg ${colorClass}"></i>
        </div>
        <h2 class="text-lg font-semibold text-white">${san(title)}</h2>
      </div>`;
  }

  function stepPostflow(cfg) {
    const c = cfg.postflow;
    return sectionHeader('ph-stack', 'Postflow Configuration', 'cyan') + `
      <p class="text-sm text-slate-400 mb-6">Configure the batch posting bot that schedules and publishes content across platforms.</p>
      <div class="space-y-4">
        ${inputField('wiz-pf-bot-token', 'Telegram Bot Token', c.telegram_bot_token, { placeholder: '123456:ABC-DEF...', icon: 'ph-telegram-logo', required: true, hint: 'Get from @BotFather on Telegram' })}
        <div id="wiz-pf-bot-info" class="mt-2 hidden"></div>
        <div class="grid grid-cols-2 gap-4">
          ${inputField('wiz-pf-interval', 'Post Interval (sec)', c.post_interval_seconds, { type: 'number', icon: 'ph-timer', placeholder: '120' })}
          ${inputField('wiz-pf-retries', 'Max Retries', c.max_retries, { type: 'number', icon: 'ph-arrow-counter-clockwise', placeholder: '3' })}
        </div>
        <div class="grid grid-cols-2 gap-4">
          ${inputField('wiz-pf-quarantine', 'Quarantine Hours', c.quarantine_hours, { type: 'number', icon: 'ph-shield-warning', placeholder: '24' })}
          ${selectField('wiz-pf-timezone', 'Timezone', c.timezone, [
            'Europe/Athens', 'Europe/Kyiv', 'Europe/London', 'Europe/Berlin', 'America/New_York',
            'America/Los_Angeles', 'Asia/Tokyo', 'Asia/Singapore', 'UTC'
          ], { icon: 'ph-globe' })}
        </div>
      </div>`;
  }

  function stepAutoeditors(cfg) {
    const c = cfg.autoeditors;
    const foldersHtml = (c.folders && c.folders.length)
      ? c.folders.map(function(f, i) {
        return `<div class="flex gap-2 items-center" id="wiz-ae-folder-${i}">
          <input type="text" value="${san(f.name || '')}" placeholder="Folder name" class="flex-1 bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 font-mono" data-folder-name="${i}">
          <input type="text" value="${san(f.driveId || '')}" placeholder="Drive folder ID" class="flex-[2] bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 font-mono" data-folder-id="${i}">
          <select class="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-2 text-sm text-white focus:outline-none" data-folder-type="${i}">
            <option value="source"${f.type === 'source' ? ' selected' : ''}>Source</option>
            <option value="archive"${f.type === 'archive' ? ' selected' : ''}>Archive</option>
          </select>
          <button onclick="SETUP_WIZARD.removeFolder(${i})" class="text-red-400 hover:text-red-300 p-1 cursor-pointer"><i class="ph-bold ph-trash text-sm"></i></button>
        </div>`;
      }).join('')
      : '';

    return sectionHeader('ph-google-drive-logo', 'Autoeditors Configuration', 'violet') + `
      <p class="text-sm text-slate-400 mb-6">Configure the Google Drive editor assignment bot that manages file editing workflows.</p>
      <div class="space-y-4">
        ${inputField('wiz-ae-bot-token', 'Telegram Bot Token', c.telegram_bot_token, { placeholder: '123456:ABC-DEF...', icon: 'ph-telegram-logo', required: true, hint: 'Bot for editor notifications' })}
        <div id="wiz-ae-bot-info" class="mt-2 hidden"></div>
        <div class="space-y-1.5">
          <label class="flex items-center gap-2 text-sm font-medium text-slate-300">
            <i class="ph-bold ph-file-arrow-up text-slate-500"></i>
            Service Account JSON
            <span class="text-red-400 text-xs">*</span>
          </label>
          <div id="wiz-ae-sa-dropzone" onclick="document.getElementById('wiz-ae-sa-file').click()"
               class="relative border-2 border-dashed border-slate-700 hover:border-violet-500/50 rounded-lg px-4 py-5 text-center cursor-pointer transition-colors">
            <input type="file" id="wiz-ae-sa-file" accept=".json" class="hidden" onchange="SETUP_WIZARD.handleServiceAccountFile(this)">
            <div id="wiz-ae-sa-placeholder" class="${c.service_account_json ? 'hidden' : ''}">
              <i class="ph-bold ph-cloud-arrow-up text-2xl text-slate-600 mb-1"></i>
              <p class="text-sm text-slate-500">Drop or click to upload <span class="text-violet-400 font-mono">service-account.json</span></p>
              <p class="text-xs text-slate-700 mt-1">Downloaded from Google Cloud Console</p>
            </div>
            <div id="wiz-ae-sa-result" class="${c.service_account_json ? '' : 'hidden'}">
              <i class="ph-bold ph-check-circle text-lg text-emerald-400"></i>
              <p class="text-sm text-emerald-400 font-medium mt-1">Service Account Loaded</p>
              <p class="text-xs text-slate-500 font-mono mt-0.5" id="wiz-ae-sa-email">${san(c.google_service_account_email || '')}</p>
            </div>
          </div>
          <p class="text-xs text-slate-600">Required for Google Drive & Sheets access. Bot won't work without it.</p>
        </div>
        ${inputField('wiz-ae-service-email', 'Service Account Email', c.google_service_account_email, { placeholder: 'Auto-filled from JSON', icon: 'ph-envelope', hint: 'Auto-filled when you upload the JSON file' })}
        ${inputField('wiz-ae-sheets-id', 'Google Sheets ID', c.google_sheets_id, { placeholder: '1BxiM...', icon: 'ph-table', hint: 'Tracking spreadsheet ID' })}
        <div class="grid grid-cols-2 gap-4">
          ${inputField('wiz-ae-sync-interval', 'Sync Interval (min)', c.sync_interval_minutes, { type: 'number', icon: 'ph-arrows-clockwise', placeholder: '15' })}
          ${inputField('wiz-ae-max-active', 'Max Active / Editor', c.max_active_per_editor, { type: 'number', icon: 'ph-user-list', placeholder: '5' })}
        </div>
        ${toggleField('wiz-ae-auto-assign', 'Auto-assign files', c.auto_assign, 'Automatically assign new files to available editors')}

        <div class="border-t border-slate-700/50 pt-4 mt-4">
          <div class="flex items-center justify-between mb-3">
            <p class="text-sm font-medium text-slate-300"><i class="ph-bold ph-folder-open text-slate-500 mr-1"></i> Google Drive Folders</p>
            <button onclick="SETUP_WIZARD.addFolder()" class="text-xs text-violet-400 hover:text-violet-300 cursor-pointer flex items-center gap-1">
              <i class="ph-bold ph-plus-circle"></i> Add Folder
            </button>
          </div>
          <div id="wiz-ae-folders-list" class="space-y-2">
            ${foldersHtml || '<p class="text-xs text-slate-600">No folders added. Click "Add Folder" to add Google Drive folders.</p>'}
          </div>
        </div>
      </div>`;
  }

  function stepSuperboost(cfg) {
    const c = cfg.superboost;
    return sectionHeader('ph-rocket-launch', 'Superboost Configuration', 'amber') + `
      <p class="text-sm text-slate-400 mb-6">Configure the promotion workflow bot for scheduling boost tasks across platforms.</p>
      <div class="space-y-4">
        ${inputField('wiz-sb-bot-token', 'Telegram Bot Token', c.telegram_bot_token, { placeholder: '123456:ABC-DEF...', icon: 'ph-telegram-logo', required: true, hint: 'Grammy bot token' })}
        <div id="wiz-sb-bot-info" class="mt-2 hidden"></div>
        <div class="grid grid-cols-2 gap-4">
          ${inputField('wiz-sb-max-tasks', 'Max Daily Tasks', c.max_daily_tasks, { type: 'number', icon: 'ph-list-checks', placeholder: '50' })}
          ${inputField('wiz-sb-cooldown', 'Cooldown (min)', c.cooldown_minutes, { type: 'number', icon: 'ph-hourglass', placeholder: '30' })}
        </div>
        ${toggleField('wiz-sb-auto-rotate', 'Auto-rotate accounts', c.auto_rotate, 'Automatically rotate between boost accounts')}
        ${selectField('wiz-sb-platform', 'Default Platform', c.default_platform, [
          { value: 'telegram', label: 'Telegram' },
          { value: 'instagram', label: 'Instagram' },
          { value: 'tiktok', label: 'TikTok' },
          { value: 'youtube', label: 'YouTube' }
        ], { icon: 'ph-device-mobile' })}
      </div>`;
  }

  function stepReview(cfg) {
    function cfgLine(label, value, masked) {
      const display = masked && value ? value.substring(0, 8) + '...' : (value || '—');
      const cls = value ? 'text-white' : 'text-slate-600';
      return `<div class="flex justify-between py-1.5 border-b border-slate-700/30">
        <span class="text-xs text-slate-500">${san(label)}</span>
        <span class="text-xs font-mono ${cls}">${san(display)}</span>
      </div>`;
    }

    const folderCount = (cfg.autoeditors.folders && cfg.autoeditors.folders.length) || 0;

    return `
      <div class="text-center mb-6">
        <h2 class="text-lg font-semibold text-white mb-2">Review Configuration</h2>
        <p class="text-sm text-slate-400">Verify your settings before launching the panel.</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-slate-800/50 border border-cyan-500/20 rounded-xl p-4">
          <div class="flex items-center gap-2 mb-3">
            <i class="ph-bold ph-stack text-cyan-400"></i>
            <span class="text-sm font-semibold text-white">Postflow</span>
            ${cfg.postflow.telegram_bot_token ? '<span class="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">Ready</span>' : '<span class="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-400">Skip</span>'}
          </div>
          ${cfgLine('Bot Token', cfg.postflow.telegram_bot_token, true)}
          ${cfgLine('Interval', cfg.postflow.post_interval_seconds + 's')}
          ${cfgLine('Timezone', cfg.postflow.timezone)}
        </div>

        <div class="bg-slate-800/50 border border-violet-500/20 rounded-xl p-4">
          <div class="flex items-center gap-2 mb-3">
            <i class="ph-bold ph-google-drive-logo text-violet-400"></i>
            <span class="text-sm font-semibold text-white">Autoeditors</span>
            ${cfg.autoeditors.telegram_bot_token ? '<span class="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">Ready</span>' : '<span class="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-400">Skip</span>'}
          </div>
          ${cfgLine('Bot Token', cfg.autoeditors.telegram_bot_token, true)}
          ${cfgLine('Service Account', cfg.autoeditors.service_account_json ? 'Uploaded' : '')}
          ${cfgLine('Folders', folderCount + ' configured')}
        </div>

        <div class="bg-slate-800/50 border border-amber-500/20 rounded-xl p-4">
          <div class="flex items-center gap-2 mb-3">
            <i class="ph-bold ph-rocket-launch text-amber-400"></i>
            <span class="text-sm font-semibold text-white">Superboost</span>
            ${cfg.superboost.telegram_bot_token ? '<span class="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">Ready</span>' : '<span class="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-400">Skip</span>'}
          </div>
          ${cfgLine('Bot Token', cfg.superboost.telegram_bot_token, true)}
          ${cfgLine('Max Tasks', cfg.superboost.max_daily_tasks + '/day')}
          ${cfgLine('Platform', cfg.superboost.default_platform)}
        </div>
      </div>

      <div class="mt-6 bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
        <p class="text-xs text-slate-500 text-center">
          <i class="ph-bold ph-info mr-1"></i>
          You can update these settings anytime from <strong class="text-slate-300">Settings</strong> in the sidebar.
          Systems without a bot token will run in demo mode.
        </p>
      </div>`;
  }

  // ---- Collect data from current step ----

  function collectCurrentStep() {
    const cfg = getConfig();

    switch (_step) {
      case 1: // Postflow
        cfg.postflow.telegram_bot_token = ($('wiz-pf-bot-token') || {}).value || '';
        cfg.postflow.post_interval_seconds = ($('wiz-pf-interval') || {}).value || '120';
        cfg.postflow.max_retries = ($('wiz-pf-retries') || {}).value || '3';
        cfg.postflow.quarantine_hours = ($('wiz-pf-quarantine') || {}).value || '24';
        cfg.postflow.timezone = ($('wiz-pf-timezone') || {}).value || 'Europe/Athens';
        break;

      case 2: // Autoeditors
        cfg.autoeditors.telegram_bot_token = ($('wiz-ae-bot-token') || {}).value || '';
        // service_account_json is set by file upload handler, don't overwrite
        cfg.autoeditors.google_service_account_email = ($('wiz-ae-service-email') || {}).value || '';
        cfg.autoeditors.google_sheets_id = ($('wiz-ae-sheets-id') || {}).value || '';
        cfg.autoeditors.sync_interval_minutes = ($('wiz-ae-sync-interval') || {}).value || '15';
        cfg.autoeditors.max_active_per_editor = ($('wiz-ae-max-active') || {}).value || '5';
        cfg.autoeditors.auto_assign = isToggleOn('wiz-ae-auto-assign');
        // Collect folders
        cfg.autoeditors.folders = [];
        var i = 0;
        while (true) {
          var nameInput = document.querySelector('[data-folder-name="' + i + '"]');
          var idInput = document.querySelector('[data-folder-id="' + i + '"]');
          var typeInput = document.querySelector('[data-folder-type="' + i + '"]');
          if (!nameInput) break;
          cfg.autoeditors.folders.push({
            name: nameInput.value,
            driveId: idInput.value,
            type: typeInput ? typeInput.value : 'source'
          });
          i++;
        }
        break;

      case 3: // Superboost
        cfg.superboost.telegram_bot_token = ($('wiz-sb-bot-token') || {}).value || '';
        cfg.superboost.max_daily_tasks = ($('wiz-sb-max-tasks') || {}).value || '50';
        cfg.superboost.cooldown_minutes = ($('wiz-sb-cooldown') || {}).value || '30';
        cfg.superboost.auto_rotate = isToggleOn('wiz-sb-auto-rotate');
        cfg.superboost.default_platform = ($('wiz-sb-platform') || {}).value || 'telegram';
        break;
    }

    saveConfig(cfg);
    return cfg;
  }

  function isToggleOn(id) {
    const btn = $(id);
    return btn ? btn.classList.contains('bg-cyan-500') : false;
  }

  // ---- Validation ----

  function showStepError(msg) {
    let el = $('wiz-step-error');
    if (!el) {
      const container = $('wiz-step-content');
      if (!container) return;
      el = document.createElement('div');
      el.id = 'wiz-step-error';
      el.className = 'mt-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2';
      container.appendChild(el);
    }
    el.innerHTML = '<i class="ph-bold ph-warning-circle shrink-0"></i><span>' + san(msg) + '</span>';
    el.classList.remove('hidden');
  }

  function hideStepError() {
    const el = $('wiz-step-error');
    if (el) el.classList.add('hidden');
  }

  /** Validate Telegram bot token via API — returns { error, bot } */
  async function validateBotToken(token) {
    if (!token || !token.match(/^\d+:[A-Za-z0-9_-]{30,}$/)) {
      return { error: 'Invalid token format. Expected: 123456:ABC-DEF...' };
    }
    try {
      const resp = await fetch('https://api.telegram.org/bot' + token + '/getMe');
      const data = await resp.json();
      if (!data.ok) return { error: 'Token rejected by Telegram: ' + (data.description || 'unknown error') };
      return { error: null, bot: data.result };
    } catch (e) {
      return { error: 'Could not reach Telegram API. Check your connection.' };
    }
  }

  /** Live-check a bot token field and show result below it */
  let _tokenCheckTimers = {};
  function attachTokenChecker(inputId, infoId, accent) {
    const input = $(inputId);
    if (!input) return;
    const handler = function() {
      clearTimeout(_tokenCheckTimers[inputId]);
      _tokenCheckTimers[inputId] = setTimeout(function() { checkTokenField(inputId, infoId, accent); }, 400);
    };
    input.addEventListener('input', handler);
    input.addEventListener('paste', function() { setTimeout(handler, 50); });
    // If there's already a value, check immediately
    if (input.value && input.value.includes(':')) handler();
  }

  async function checkTokenField(inputId, infoId, accent) {
    const input = $(inputId);
    const info = $(infoId);
    if (!input || !info) return;
    const token = input.value.trim();

    if (!token) { info.innerHTML = ''; info.className = 'mt-2 hidden'; return; }
    if (!token.match(/^\d+:[A-Za-z0-9_-]{30,}$/)) {
      info.className = 'mt-2';
      info.innerHTML = '';
      return;
    }

    // Show loading
    const accentColor = accent === 'violet' ? 'text-violet-400' : accent === 'amber' ? 'text-amber-400' : 'text-cyan-400';
    info.className = 'mt-2 flex items-center gap-2 text-xs text-slate-400';
    const spinColor = accent === 'violet' ? '#a78bfa' : accent === 'amber' ? '#fbbf24' : '#22d3ee';
    info.innerHTML = '<span class="inline-block w-3 h-3 rounded-full animate-spin" style="border:2px solid #475569;border-top-color:' + spinColor + '"></span> Checking bot...';

    const result = await validateBotToken(token);
    if (result.error) {
      info.className = 'mt-2 flex items-center gap-2 text-xs text-red-400';
      info.innerHTML = '<i class="ph-bold ph-warning-circle"></i> ' + san(result.error);
    } else {
      const bot = result.bot;
      const name = san(bot.first_name || '') + (bot.last_name ? ' ' + san(bot.last_name) : '');
      info.className = 'mt-2 flex items-center gap-2 text-xs ' + accentColor;
      info.innerHTML = '<i class="ph-bold ph-check-circle"></i> <span class="font-mono">@' + san(bot.username) + '</span> <span class="text-slate-500">' + name + '</span>';
    }
  }

  /** Validate step before advancing */
  async function validateStep(step, cfg) {
    const setLoading = (on) => {
      const btn = $('wiz-next-btn');
      if (!btn) return;
      if (on) {
        btn.disabled = true;
        btn.dataset.origHtml = btn.innerHTML;
        btn.innerHTML = '<span class="loading-dots"><span></span><span></span><span></span></span> Validating...';
        btn.classList.add('opacity-60');
      } else {
        btn.disabled = false;
        btn.innerHTML = btn.dataset.origHtml || 'Next <i class="ph-bold ph-arrow-right"></i>';
        btn.classList.remove('opacity-60');
      }
    };

    switch (step) {
      case 1: { // Postflow
        const token = cfg.postflow.telegram_bot_token;
        if (!token) return 'Telegram Bot Token is required.';
        setLoading(true);
        const res = await validateBotToken(token);
        setLoading(false);
        return res.error;
      }
      case 2: { // Autoeditors
        const token = cfg.autoeditors.telegram_bot_token;
        if (!token) return 'Telegram Bot Token is required.';
        if (!cfg.autoeditors.service_account_json) return 'Service Account JSON file is required. Upload it above.';
        if (!cfg.autoeditors.google_service_account_email) return 'Service Account Email is missing. Re-upload the JSON file.';
        setLoading(true);
        const res = await validateBotToken(token);
        setLoading(false);
        return res.error;
      }
      case 3: { // Superboost
        const token = cfg.superboost.telegram_bot_token;
        if (!token) return 'Telegram Bot Token is required.';
        setLoading(true);
        const res = await validateBotToken(token);
        setLoading(false);
        return res.error;
      }
    }
    return null;
  }

  // ---- Public API ----

  return {
    /** Check if wizard should be shown */
    isComplete: isComplete,

    /** Initialize and show the wizard */
    init() {
      if (isComplete()) return false;
      const page = $('setup-wizard-page');
      if (page) {
        page.classList.remove('hidden');
        renderStep(0);
      }
      return true;
    },

    /** Go to next step (with validation) */
    async next() {
      const cfg = collectCurrentStep();
      const err = await validateStep(_step, cfg);
      if (err) {
        showStepError(err);
        return;
      }
      hideStepError();
      if (_step < TOTAL_STEPS) {
        renderStep(_step + 1);
      } else {
        this.complete(cfg);
      }
    },

    /** Go to previous step */
    prev() {
      collectCurrentStep();
      if (_step > 0) renderStep(_step - 1);
    },

    /** Complete the wizard */
    async complete(cfg) {
      var isOnline = typeof API !== 'undefined' && API.config && API.config.baseUrl;

      if (isOnline) {
        // Save wizard config to backend
        try {
          await fetch('/api/setup', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
            body: JSON.stringify({ completed: true, postflow: cfg.postflow, autoeditors: cfg.autoeditors, superboost: cfg.superboost })
          });
          // Push configs to backend
          var cfgMaps = [
            { sys: 'postflow', pairs: { POST_INTERVAL_SECONDS: cfg.postflow.post_interval_seconds, MAX_RETRIES: cfg.postflow.max_retries, QUARANTINE_HOURS: cfg.postflow.quarantine_hours, TIMEZONE: cfg.postflow.timezone, TELEGRAM_BOT_TOKEN: cfg.postflow.telegram_bot_token } },
            { sys: 'autoeditors', pairs: { SYNC_INTERVAL_MINUTES: cfg.autoeditors.sync_interval_minutes, MAX_ACTIVE_PER_EDITOR: cfg.autoeditors.max_active_per_editor, AUTO_ASSIGN: String(cfg.autoeditors.auto_assign), TELEGRAM_BOT_TOKEN: cfg.autoeditors.telegram_bot_token, SERVICE_ACCOUNT_JSON: cfg.autoeditors.service_account_json ? 'uploaded' : '', GOOGLE_SERVICE_ACCOUNT: cfg.autoeditors.google_service_account_email, GOOGLE_SHEETS_ID: cfg.autoeditors.google_sheets_id } },
            { sys: 'superboost', pairs: { MAX_DAILY_TASKS: cfg.superboost.max_daily_tasks, COOLDOWN_MINUTES: cfg.superboost.cooldown_minutes, AUTO_ROTATE: String(cfg.superboost.auto_rotate), DEFAULT_PLATFORM: cfg.superboost.default_platform, TELEGRAM_BOT_TOKEN: cfg.superboost.telegram_bot_token } }
          ];
          for (var m = 0; m < cfgMaps.length; m++) {
            var sm = cfgMaps[m];
            for (var k in sm.pairs) {
              if (sm.pairs[k] !== undefined && sm.pairs[k] !== '') {
                await API[sm.sys].setConfig(k, sm.pairs[k]);
              }
            }
          }
          // Create autoeditors folders via API
          if (cfg.autoeditors.folders && cfg.autoeditors.folders.length) {
            for (var fi = 0; fi < cfg.autoeditors.folders.length; fi++) {
              var f = cfg.autoeditors.folders[fi];
              await API.autoeditors.createFolder({ name: f.name, driveId: f.driveId, type: f.type || 'source' });
            }
          }
        } catch (e) { console.warn('Setup: backend save error', e); }
      } else {
        // Fallback: localStorage mode
        var db = localStorage.getItem(STORAGE_KEY);
        if (db) {
          try {
            var data = JSON.parse(db);
            data.postflow_config = Object.assign(data.postflow_config || {}, { POST_INTERVAL_SECONDS: cfg.postflow.post_interval_seconds, MAX_RETRIES: cfg.postflow.max_retries, QUARANTINE_HOURS: cfg.postflow.quarantine_hours, TIMEZONE: cfg.postflow.timezone, TELEGRAM_BOT_TOKEN: cfg.postflow.telegram_bot_token });
            data.autoeditors_config = Object.assign(data.autoeditors_config || {}, { SYNC_INTERVAL_MINUTES: cfg.autoeditors.sync_interval_minutes, MAX_ACTIVE_PER_EDITOR: cfg.autoeditors.max_active_per_editor, AUTO_ASSIGN: String(cfg.autoeditors.auto_assign), TELEGRAM_BOT_TOKEN: cfg.autoeditors.telegram_bot_token, SERVICE_ACCOUNT_JSON: cfg.autoeditors.service_account_json ? 'uploaded' : '', GOOGLE_SERVICE_ACCOUNT: cfg.autoeditors.google_service_account_email, GOOGLE_SHEETS_ID: cfg.autoeditors.google_sheets_id });
            data.superboost_config = Object.assign(data.superboost_config || {}, { MAX_DAILY_TASKS: cfg.superboost.max_daily_tasks, COOLDOWN_MINUTES: cfg.superboost.cooldown_minutes, AUTO_ROTATE: String(cfg.superboost.auto_rotate), DEFAULT_PLATFORM: cfg.superboost.default_platform, TELEGRAM_BOT_TOKEN: cfg.superboost.telegram_bot_token });
            if (cfg.autoeditors.folders && cfg.autoeditors.folders.length) {
              data.autoeditors_folders = cfg.autoeditors.folders.map(function(f, i) { return { id: 'wiz_f' + (i + 1), name: f.name, driveId: f.driveId, type: f.type || 'source', lastSync: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; });
            }
            localStorage.setItem('ivladoz_admin_db', JSON.stringify(data));
          } catch (e) { console.warn('Setup: could not patch DB', e); }
        }
        localStorage.setItem(COMPLETE_KEY, 'true');
      }

      // Hide wizard, boot the full app
      const wizPage = $('setup-wizard-page');
      if (wizPage) wizPage.classList.add('hidden');
      if (typeof window._initApp === 'function') {
        window._initApp();
      } else {
        const loginPage = $('login-page');
        if (loginPage) loginPage.classList.remove('hidden');
      }
    },

    /** Toggle a switch button */
    toggleSwitch(id) {
      const btn = $(id);
      if (!btn) return;
      const dot = btn.querySelector('span');
      if (btn.classList.contains('bg-cyan-500')) {
        btn.classList.remove('bg-cyan-500');
        btn.classList.add('bg-slate-600');
        if (dot) { dot.classList.remove('left-5.5'); dot.classList.add('left-0.5'); }
      } else {
        btn.classList.remove('bg-slate-600');
        btn.classList.add('bg-cyan-500');
        if (dot) { dot.classList.remove('left-0.5'); dot.classList.add('left-5.5'); }
      }
    },

    /** Add a folder row */
    addFolder() {
      // Collect current state first
      const cfg = getConfig();
      collectCurrentStep();
      const updatedCfg = getConfig();
      updatedCfg.autoeditors.folders.push({ name: '', driveId: '', type: 'source' });
      saveConfig(updatedCfg);
      renderStep(2); // Re-render the autoeditors step
    },

    /** Remove a folder row */
    removeFolder(index) {
      collectCurrentStep();
      const cfg = getConfig();
      cfg.autoeditors.folders.splice(index, 1);
      saveConfig(cfg);
      renderStep(2);
    },

    /** Handle service-account.json file upload */
    handleServiceAccountFile(input) {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const json = JSON.parse(e.target.result);
          if (!json.client_email || !json.private_key) {
            showStepError('Invalid service account file. Must contain client_email and private_key.');
            return;
          }
          hideStepError();
          // Save to config
          const cfg = getConfig();
          cfg.autoeditors.service_account_json = e.target.result;
          cfg.autoeditors.google_service_account_email = json.client_email;
          saveConfig(cfg);
          // Update UI
          const emailField = $('wiz-ae-service-email');
          if (emailField) emailField.value = json.client_email;
          const placeholder = $('wiz-ae-sa-placeholder');
          const result = $('wiz-ae-sa-result');
          const emailDisplay = $('wiz-ae-sa-email');
          if (placeholder) placeholder.classList.add('hidden');
          if (result) result.classList.remove('hidden');
          if (emailDisplay) emailDisplay.textContent = json.client_email;
          // Change dropzone border to success
          const dropzone = $('wiz-ae-sa-dropzone');
          if (dropzone) {
            dropzone.classList.remove('border-slate-700');
            dropzone.classList.add('border-emerald-500/50');
          }
        } catch (err) {
          showStepError('Could not parse JSON file: ' + err.message);
        }
      };
      reader.readAsText(file);
    },

    /** Skip wizard (for demo) */
    async skip() {
      var isOnline = typeof API !== 'undefined' && API.config && API.config.baseUrl;
      if (isOnline) {
        try { await fetch('/api/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ completed: true }) }); } catch (e) {}
      } else {
        localStorage.setItem(COMPLETE_KEY, 'true');
      }
      const wizPage = $('setup-wizard-page');
      if (wizPage) wizPage.classList.add('hidden');
      if (typeof window._initApp === 'function') {
        window._initApp();
      } else {
        const loginPage = $('login-page');
        if (loginPage) loginPage.classList.remove('hidden');
      }
    },

    /** Reset wizard (for settings page) */
    async reset() {
      var isOnline = typeof API !== 'undefined' && API.config && API.config.baseUrl;
      if (isOnline) {
        try { await fetch('/api/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ completed: false }) }); } catch (e) {}
      } else {
        localStorage.removeItem(COMPLETE_KEY);
        localStorage.removeItem(STORAGE_KEY);
      }
    },

    /** Get current config for settings page */
    getConfig: getConfig,
    saveConfig: saveConfig
  };
})();
