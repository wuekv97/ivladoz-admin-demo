/**
 * IVLADOZ Admin Panel -- Settings Page
 *
 * Lets admins view/edit API keys, bot tokens, Google credentials,
 * and system config values — all stored in localStorage.
 *
 * @file settings-page.js
 */
/* global SETUP_WIZARD, API, TOAST */
/* eslint-disable no-unused-vars */

const SETTINGS_PAGE = (() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const san = (s) => String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));

  /** Render the full settings page */
  function render() {
    const container = $('settings-content');
    if (!container) return;

    const cfg = (typeof SETUP_WIZARD !== 'undefined') ? SETUP_WIZARD.getConfig() : {};
    const pf = cfg.postflow || {};
    const ae = cfg.autoeditors || {};
    const sb = cfg.superboost || {};

    container.innerHTML = `
      ${renderSection('postflow', 'ph-stack', 'Postflow', 'cyan', [
        { key: 'telegram_bot_token', label: 'Telegram Bot Token', value: pf.telegram_bot_token, type: 'password', icon: 'ph-telegram-logo' },
        { key: 'post_interval_seconds', label: 'Post Interval (sec)', value: pf.post_interval_seconds, type: 'number', icon: 'ph-timer' },
        { key: 'max_retries', label: 'Max Retries', value: pf.max_retries, type: 'number', icon: 'ph-arrow-counter-clockwise' },
        { key: 'quarantine_hours', label: 'Quarantine Hours', value: pf.quarantine_hours, type: 'number', icon: 'ph-shield-warning' },
        { key: 'timezone', label: 'Timezone', value: pf.timezone, icon: 'ph-globe' }
      ])}

      ${renderSection('autoeditors', 'ph-google-drive-logo', 'Autoeditors', 'violet', [
        { key: 'telegram_bot_token', label: 'Telegram Bot Token', value: ae.telegram_bot_token, type: 'password', icon: 'ph-telegram-logo' },
        { key: 'service_account_status', label: 'Service Account', value: ae.service_account_json ? 'Uploaded' : 'Not uploaded', icon: 'ph-file-arrow-up', readonly: true },
        { key: 'google_service_account_email', label: 'Service Account Email', value: ae.google_service_account_email, icon: 'ph-envelope' },
        { key: 'google_sheets_id', label: 'Google Sheets ID', value: ae.google_sheets_id, icon: 'ph-table' },
        { key: 'sync_interval_minutes', label: 'Sync Interval (min)', value: ae.sync_interval_minutes, type: 'number', icon: 'ph-arrows-clockwise' },
        { key: 'max_active_per_editor', label: 'Max Active / Editor', value: ae.max_active_per_editor, type: 'number', icon: 'ph-user-list' }
      ])}

      ${renderSection('superboost', 'ph-rocket-launch', 'Superboost', 'amber', [
        { key: 'telegram_bot_token', label: 'Telegram Bot Token', value: sb.telegram_bot_token, type: 'password', icon: 'ph-telegram-logo' },
        { key: 'max_daily_tasks', label: 'Max Daily Tasks', value: sb.max_daily_tasks, type: 'number', icon: 'ph-list-checks' },
        { key: 'cooldown_minutes', label: 'Cooldown (min)', value: sb.cooldown_minutes, type: 'number', icon: 'ph-hourglass' },
        { key: 'default_platform', label: 'Default Platform', value: sb.default_platform, icon: 'ph-device-mobile' }
      ])}

      <div class="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-slate-300">Reset all data</p>
            <p class="text-xs text-slate-600">Clear all localStorage data and run setup wizard again.</p>
          </div>
          <button onclick="SETTINGS_PAGE.resetAll()" class="px-4 py-2 rounded-lg text-sm text-red-400 hover:text-white hover:bg-red-500/20 border border-red-500/30 transition-colors cursor-pointer">
            <i class="ph-bold ph-trash mr-1"></i> Reset
          </button>
        </div>
      </div>
    `;
  }

  function renderSection(system, icon, title, accent, fields) {
    const borderColor = accent === 'violet' ? 'border-violet-500/20' : accent === 'amber' ? 'border-amber-500/20' : 'border-cyan-500/20';
    const iconColor = accent === 'violet' ? 'text-violet-400' : accent === 'amber' ? 'text-amber-400' : 'text-cyan-400';
    const bgColor = accent === 'violet' ? 'bg-violet-500/10' : accent === 'amber' ? 'bg-amber-500/10' : 'bg-cyan-500/10';
    const btnColor = accent === 'violet' ? 'text-violet-400 hover:bg-violet-500/20' : accent === 'amber' ? 'text-amber-400 hover:bg-amber-500/20' : 'text-cyan-400 hover:bg-cyan-500/20';

    const fieldsHtml = fields.map(function(f) {
      const inputId = 'settings-' + system + '-' + f.key;
      const inputType = f.type || 'text';
      const isPassword = inputType === 'password';

      return `
        <div class="flex items-center gap-3 py-2.5 border-b border-slate-700/30 last:border-0">
          <i class="ph-bold ${f.icon || 'ph-text-aa'} text-slate-600 w-5 text-center"></i>
          <label class="text-sm text-slate-400 w-44 shrink-0">${san(f.label)}</label>
          <div class="flex-1 relative">
            <input id="${inputId}" type="${isPassword ? 'password' : inputType}" value="${san(f.value || '')}"
                   class="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-700 focus:outline-none focus:ring-1 focus:ring-${accent}-500/50 transition-colors font-mono"
                   onchange="SETTINGS_PAGE.saveField('${system}', '${f.key}', this.value)">
            ${isPassword ? '<button onclick="SETTINGS_PAGE.toggleVisibility(\'' + inputId + '\', this)" class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 cursor-pointer"><i class="ph-bold ph-eye text-sm"></i></button>' : ''}
          </div>
        </div>`;
    }).join('');

    return `
      <div class="bg-slate-800/50 border ${borderColor} rounded-xl overflow-hidden">
        <div class="flex items-center justify-between px-5 py-3 border-b border-slate-700/30">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg ${bgColor} flex items-center justify-center">
              <i class="ph-bold ${icon} ${iconColor}"></i>
            </div>
            <h3 class="text-sm font-semibold text-white">${san(title)}</h3>
          </div>
          <button onclick="SETTINGS_PAGE.testConnection('${system}')" class="px-3 py-1 rounded-lg text-xs ${btnColor} transition-colors cursor-pointer flex items-center gap-1">
            <i class="ph-bold ph-plugs-connected"></i> Test
          </button>
        </div>
        <div class="px-5 py-2">
          ${fieldsHtml}
        </div>
      </div>`;
  }

  // ---- Public API ----
  return {
    render: render,

    /** Save a single field change */
    saveField(system, key, value) {
      if (typeof SETUP_WIZARD === 'undefined') return;
      const cfg = SETUP_WIZARD.getConfig();
      if (cfg[system]) {
        cfg[system][key] = value;
        SETUP_WIZARD.saveConfig(cfg);
      }
      // Also push to API config if applicable
      this.syncToApiConfig(system, key, value);
    },

    /** Sync setting to API layer config */
    syncToApiConfig(system, key, value) {
      const keyMap = {
        post_interval_seconds: 'POST_INTERVAL_SECONDS',
        max_retries: 'MAX_RETRIES',
        quarantine_hours: 'QUARANTINE_HOURS',
        timezone: 'TIMEZONE',
        sync_interval_minutes: 'SYNC_INTERVAL_MINUTES',
        max_active_per_editor: 'MAX_ACTIVE_PER_EDITOR',
        max_daily_tasks: 'MAX_DAILY_TASKS',
        cooldown_minutes: 'COOLDOWN_MINUTES',
        default_platform: 'DEFAULT_PLATFORM',
        telegram_bot_token: 'TELEGRAM_BOT_TOKEN',
        service_account_json: 'SERVICE_ACCOUNT_JSON',
        google_service_account_email: 'GOOGLE_SERVICE_ACCOUNT',
        google_sheets_id: 'GOOGLE_SHEETS_ID'
      };
      const configKey = keyMap[key];
      if (!configKey || typeof API === 'undefined') return;
      const ns = system === 'postflow' ? API.postflow : system === 'autoeditors' ? API.autoeditors : API.superboost;
      if (ns && ns.setConfig) {
        ns.setConfig(configKey, value).catch(function() {});
      }
    },

    /** Toggle password field visibility */
    toggleVisibility(inputId, btn) {
      const input = $(inputId);
      if (!input) return;
      const icon = btn.querySelector('i');
      if (input.type === 'password') {
        input.type = 'text';
        if (icon) { icon.classList.remove('ph-eye'); icon.classList.add('ph-eye-slash'); }
      } else {
        input.type = 'password';
        if (icon) { icon.classList.remove('ph-eye-slash'); icon.classList.add('ph-eye'); }
      }
    },

    /** Test connection placeholder */
    testConnection(system) {
      if (typeof TOAST !== 'undefined' && TOAST.show) {
        TOAST.show('Connection test for ' + system + ' is not yet implemented (requires backend).', 'info');
      } else {
        alert('Connection test requires a backend server.');
      }
    },

    /** Re-run setup wizard */
    runWizard() {
      if (typeof SETUP_WIZARD !== 'undefined') {
        SETUP_WIZARD.reset();
        location.reload();
      }
    },

    /** Reset all data */
    resetAll() {
      if (typeof TOAST !== 'undefined' && TOAST.confirm) {
        TOAST.confirm({
          title: 'Reset All Data',
          message: 'This will clear all data including users, config, and wizard settings. Are you sure?',
          confirmText: 'Reset Everything',
          onConfirm: function() {
            localStorage.clear();
            location.reload();
          }
        });
      } else if (confirm('This will clear ALL data. Are you sure?')) {
        localStorage.clear();
        location.reload();
      }
    }
  };
})();
