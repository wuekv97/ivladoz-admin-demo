(function() {
  'use strict';

  /* ---- Constants ---- */
  var PLATFORMS = ['X', 'IG', 'FACEBOOK', 'REDDIT', 'THREADS', 'SNAPCHAT'];

  var PLATFORM_ICONS = {
    X:        'ph-bold ph-x-logo',
    IG:       'ph-bold ph-instagram-logo',
    FACEBOOK: 'ph-bold ph-facebook-logo',
    REDDIT:   'ph-bold ph-reddit-logo',
    THREADS:  'ph-bold ph-threads-logo',
    SNAPCHAT: 'ph-bold ph-snapchat-logo'
  };

  var PLATFORM_COLORS = {
    X:        'slate',
    IG:       'pink',
    FACEBOOK: 'blue',
    REDDIT:   'orange',
    THREADS:  'purple',
    SNAPCHAT: 'yellow'
  };

  var PLATFORM_LABELS = {
    X: 'X', IG: 'IG', FACEBOOK: 'Facebook',
    REDDIT: 'Reddit', THREADS: 'Threads', SNAPCHAT: 'Snapchat'
  };

  var TASK_STATUSES = ['Pending', 'Assigned', 'Started', 'Done', 'Failed', 'Skipped', 'Problem', 'Expired'];
  var OPEN_STATUSES = ['Pending', 'Assigned', 'Started', 'Problem'];

  var STATUS_BADGE = {
    'Pending':  'bg-slate-600/30 text-slate-400',
    'Assigned': 'bg-cyan-500/20 text-cyan-400',
    'Started':  'bg-blue-500/20 text-blue-400',
    'Done':     'bg-emerald-500/20 text-emerald-400',
    'Failed':   'bg-red-500/20 text-red-400',
    'Skipped':  'bg-purple-500/20 text-purple-400',
    'Problem':  'bg-amber-500/20 text-amber-400',
    'Expired':  'bg-slate-500/20 text-slate-500'
  };

  var WORKFLOW_STATUS_BADGE = {
    'Not Done':   'bg-emerald-500/20 text-emerald-400',
    'In Process': 'bg-blue-500/20 text-blue-400',
    'Done':       'bg-emerald-500/20 text-emerald-400'
  };

  /* ---- Local state for filters ---- */
  var _accountFilters = { platform: 'All', status: 'All', search: '', sort: 'username' };
  var _taskFilters    = { status: 'All', platform: 'All', assistant: 'All', search: '' };
  var _pendingDelete  = null;

  /* ---- Sanitize helper ---- */
  function esc(str) {
    if (str == null) return '';
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str)));
    return d.innerHTML;
  }

  function elById(id) { return document.getElementById(id); }

  /* ---- Platform icon HTML ---- */
  function platformIcon(p, size) {
    var c = PLATFORM_COLORS[p] || 'slate';
    var sz = size || 'text-sm';
    return '<i class="' + (PLATFORM_ICONS[p] || 'ph-bold ph-globe') + ' text-' + c + '-400 ' + sz + '"></i>';
  }

  function platformChip(p, selected) {
    var c = PLATFORM_COLORS[p] || 'slate';
    var cls = selected
      ? 'bg-' + c + '-500/20 text-' + c + '-400 border border-' + c + '-500/40'
      : 'text-slate-400 border border-slate-600/50 hover:text-white hover:bg-slate-700';
    return '<button type="button" data-platform="' + p + '" class="sb-platform-chip flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer ' + cls + '">' +
      '<i class="' + (PLATFORM_ICONS[p] || '') + '"></i>' + PLATFORM_LABELS[p] + '</button>';
  }

  /* ---- Toast ---- */
  function toast(message, type) {
    var container = elById('sb-toast-container');
    if (!container) return;
    var bg = type === 'error' ? 'bg-red-600' : type === 'warning' ? 'bg-amber-600' : 'bg-emerald-600';
    var icon = type === 'error' ? 'ph-warning-circle' : type === 'warning' ? 'ph-warning' : 'ph-check-circle';
    var el = document.createElement('div');
    el.className = 'pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-lg text-sm text-white shadow-lg ' + bg + ' transition-all duration-300 translate-x-0 opacity-100';
    el.innerHTML = '<i class="ph-bold ' + icon + '"></i><span>' + esc(message) + '</span>';
    container.appendChild(el);
    setTimeout(function() {
      el.style.opacity = '0';
      el.style.transform = 'translateX(100px)';
      setTimeout(function() { el.remove(); }, 300);
    }, 3000);
  }

  /* ---- Relative time ---- */
  function relTime(iso) {
    if (!iso) return '--';
    var diff = Date.now() - new Date(iso).getTime();
    var m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + ' min ago';
    var h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    var d = Math.floor(h / 24);
    return d + 'd ago';
  }

  function shortDate(iso) {
    if (!iso) return '--';
    var d = new Date(iso);
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  }


  /* ============================================================
     SB_UI — Public API
     ============================================================ */
  window.SB_UI = {

    /* ---- Init entry point ---- */
    init: function() {
      this._bindGlobalClicks();
    },

    _bindGlobalClicks: function() {
      document.addEventListener('click', function(e) {
        // Close account dropdowns on outside click
        if (!e.target.closest('#sb-task-source-dropdown') && !e.target.closest('#sb-task-source-search')) {
          var dd = elById('sb-task-source-dropdown');
          if (dd) dd.classList.add('hidden');
        }
        if (!e.target.closest('#sb-task-target-dropdown') && !e.target.closest('#sb-task-target-search')) {
          var dd2 = elById('sb-task-target-dropdown');
          if (dd2) dd2.classList.add('hidden');
        }
      });
    },

    /* ============================================================
       DASHBOARD
       ============================================================ */
    renderDashboard: function(stats) {
      var el = elById('superboost-dashboard');
      if (!el) return;
      if (!stats) {
        el.innerHTML = this._emptyState('ph-chart-pie-slice', 'No dashboard data', 'Connect to the Superboost API to load statistics.');
        return;
      }
      var pct = stats.totalAccounts > 0 ? ((stats.activeAccounts / stats.totalAccounts) * 100).toFixed(1) : '0';
      var pauseLabel = stats.paused ? 'Resume' : 'Pause';
      var pauseIcon = stats.paused ? 'ph-play' : 'ph-pause';
      var pauseBg = stats.paused ? 'bg-slate-600 hover:bg-slate-500' : 'bg-amber-600 hover:bg-amber-500';
      var statusDot = stats.paused
        ? '<span class="w-2.5 h-2.5 rounded-full bg-slate-500 inline-block"></span><span class="text-sm font-medium text-slate-400">Paused</span>'
        : '<span class="relative flex h-2.5 w-2.5"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span></span><span class="text-sm font-medium text-emerald-400">Active</span>';

      var html = '';

      // Status bar
      html += '<div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5 mb-6">';
      html += '<div class="flex flex-wrap items-center gap-6">';
      html += '<div class="flex items-center gap-3"><span class="text-sm text-slate-400">Scheduling:</span>' + statusDot;
      html += '<button onclick="SB_UI.toggleScheduling()" class="ml-2 ' + pauseBg + ' text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer flex items-center gap-1.5"><i class="ph-bold ' + pauseIcon + '"></i><span>' + pauseLabel + '</span></button></div>';
      html += '<div class="h-6 w-px bg-slate-700 hidden sm:block"></div>';
      html += '<div class="flex items-center gap-2"><i class="ph-bold ph-cloud-arrow-down text-amber-400"></i><span class="text-sm text-slate-400">Last Sync:</span>';
      html += '<span class="text-sm font-mono text-slate-300">' + (stats.lastSheetSyncAt ? esc(shortDate(stats.lastSheetSyncAt)) : 'Never') + '</span></div>';
      html += '</div></div>';

      // Stats grid
      html += '<div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">';
      html += this._statCard('Total Accounts', stats.totalAccounts, 'ph-user-list', 'amber', 'Across all platforms');
      html += this._statCard('Active Accounts', stats.activeAccounts, 'ph-user-check', 'emerald', pct + '% active rate');
      html += this._statCard('Active Rules', stats.totalRules, 'ph-funnel', 'cyan', 'Configured');
      html += this._statCard('Pending', stats.pendingTasks, 'ph-hourglass-medium', 'slate', 'Awaiting assignment', 'slate');
      html += this._statCard('Started', stats.startedTasks, 'ph-play', 'blue', 'In progress');
      html += this._statCard('Problems', stats.problemTasks, 'ph-warning', 'amber', 'Needs attention');
      html += this._statCard('Completed', stats.completedTasks, 'ph-check-circle', 'emerald', 'All time');
      html += this._statCard('Open Tasks', stats.openTasks, 'ph-clipboard-text', 'amber', 'Pending + Started + Problem');
      html += '</div>';

      // Platform breakdown
      if (stats.platforms) {
        html += '<h3 class="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2"><i class="ph-bold ph-browsers text-amber-400"></i>Platform Breakdown</h3>';
        html += '<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">';
        PLATFORMS.forEach(function(p) {
          var d = stats.platforms[p] || { total: 0, active: 0 };
          var c = PLATFORM_COLORS[p];
          html += '<div class="bg-slate-800 rounded-xl border border-slate-700/50 p-4 text-center hover:border-amber-500/30 transition-colors duration-200">';
          html += '<div class="w-10 h-10 mx-auto mb-2 bg-' + c + '-500/10 rounded-lg flex items-center justify-center">';
          html += '<i class="' + PLATFORM_ICONS[p] + ' text-' + c + '-400 text-xl"></i></div>';
          html += '<p class="text-xs text-slate-400 mb-1">' + PLATFORM_LABELS[p] + '</p>';
          html += '<p class="text-2xl font-bold text-white font-mono">' + d.total + '</p>';
          html += '<p class="text-xs text-emerald-400 mt-1">' + d.active + ' active</p></div>';
        });
        html += '</div>';
      }

      el.innerHTML = html;
    },

    _statCard: function(label, value, icon, color, sub, iconColor) {
      var ic = iconColor || color;
      return '<div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">' +
        '<div class="flex items-center justify-between mb-3">' +
        '<span class="text-sm text-slate-400">' + esc(label) + '</span>' +
        '<div class="w-9 h-9 bg-' + ic + '-500/10 rounded-lg flex items-center justify-center">' +
        '<i class="ph-bold ' + icon + ' text-' + ic + '-400 text-lg"></i></div></div>' +
        '<p class="text-3xl font-bold text-white font-mono">' + (value != null ? value : 0) + '</p>' +
        '<p class="text-xs text-slate-500 mt-1">' + esc(sub) + '</p></div>';
    },


    /* ============================================================
       ACCOUNTS TABLE
       ============================================================ */
    renderAccountsTable: function(accounts) {
      var el = elById('superboost-accounts');
      if (!el) return;

      var html = '';

      // Header + Add button
      html += '<div class="flex items-center justify-between mb-5">';
      html += '<h3 class="text-lg font-semibold text-slate-100 flex items-center gap-2"><i class="ph-bold ph-users text-amber-400"></i>Accounts</h3>';
      html += '<button onclick="SB_UI.openAccountModal()" class="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer flex items-center gap-2"><i class="ph-bold ph-plus"></i>Add Account</button>';
      html += '</div>';

      // Filters
      html += '<div class="flex flex-wrap items-center gap-3 mb-5">';
      html += '<div class="relative"><i class="ph-bold ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm"></i>';
      html += '<input type="text" placeholder="Search username..." value="' + esc(_accountFilters.search) + '" oninput="SB_UI.setAccountFilter(\'search\', this.value)" class="bg-slate-800 border border-slate-700/50 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 w-56 transition-colors duration-200"></div>';

      // Platform pills
      html += '<div class="flex gap-1.5">';
      ['All'].concat(PLATFORMS).forEach(function(p) {
        var lbl = p === 'All' ? 'All' : PLATFORM_LABELS[p];
        var active = _accountFilters.platform === p;
        var cls = active ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700';
        html += '<button onclick="SB_UI.setAccountFilter(\'platform\', \'' + p + '\')" class="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors duration-200 ' + cls + '">' + lbl + '</button>';
      });
      html += '</div>';

      // Status pills
      html += '<div class="flex gap-1.5 ml-auto">';
      ['All', 'Active', 'Inactive'].forEach(function(s) {
        var active = _accountFilters.status === s;
        var cls = active ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-700';
        html += '<button onclick="SB_UI.setAccountFilter(\'status\', \'' + s + '\')" class="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors duration-200 ' + cls + '">' + s + '</button>';
      });
      html += '</div></div>';

      // Filter data
      var filtered = (accounts || []).filter(function(a) {
        if (_accountFilters.platform !== 'All' && a.platform !== _accountFilters.platform) return false;
        if (_accountFilters.status === 'Active' && !a.active) return false;
        if (_accountFilters.status === 'Inactive' && a.active) return false;
        if (_accountFilters.search && a.username.toLowerCase().indexOf(_accountFilters.search.toLowerCase()) === -1) return false;
        return true;
      });

      // Sort
      filtered.sort(function(a, b) {
        if (_accountFilters.sort === 'platform') return a.platform.localeCompare(b.platform);
        if (_accountFilters.sort === 'status') return (a.sheetStatus || '').localeCompare(b.sheetStatus || '');
        return a.username.localeCompare(b.username);
      });

      if (!filtered.length) {
        html += this._emptyState('ph-users', 'No accounts found', accounts && accounts.length ? 'Try adjusting your filters.' : 'Add your first account to get started.');
        el.innerHTML = html;
        return;
      }

      // Table
      html += '<div class="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden">';
      html += '<div class="overflow-x-auto"><table class="w-full text-sm"><thead>';
      html += '<tr class="border-b border-slate-700/50 text-slate-500 text-xs uppercase tracking-wider">';
      html += '<th class="text-left px-4 py-3 font-medium">Platform</th>';
      html += '<th class="text-left px-4 py-3 font-medium">Username</th>';
      html += '<th class="text-left px-4 py-3 font-medium">Assistant</th>';
      html += '<th class="text-left px-4 py-3 font-medium">Sheet Status</th>';
      html += '<th class="text-left px-4 py-3 font-medium">Active</th>';
      html += '<th class="text-left px-4 py-3 font-medium">Last Seen</th>';
      html += '<th class="text-left px-4 py-3 font-medium">Actions</th>';
      html += '</tr></thead><tbody class="text-slate-300">';

      filtered.forEach(function(a) {
        var stBadge = a.sheetStatus ? '<span class="badge ' + (WORKFLOW_STATUS_BADGE[a.sheetStatus] || 'bg-slate-600/30 text-slate-400') + '">' + esc(a.sheetStatus) + '</span>' : '<span class="text-slate-600">--</span>';
        var activeDot = a.active ? '<span class="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>' : '<span class="w-2.5 h-2.5 rounded-full bg-slate-600 inline-block"></span>';
        html += '<tr class="border-b border-slate-700/50 hover:bg-slate-800/50">';
        html += '<td class="px-4 py-3"><span class="flex items-center gap-2">' + platformIcon(a.platform) + ' ' + esc(PLATFORM_LABELS[a.platform] || a.platform) + '</span></td>';
        html += '<td class="px-4 py-3 font-mono text-amber-400">@' + esc(a.username) + '</td>';
        html += '<td class="px-4 py-3">' + (a.assistantTelegram ? esc(a.assistantTelegram) : '<span class="text-slate-600">--</span>') + '</td>';
        html += '<td class="px-4 py-3">' + stBadge + '</td>';
        html += '<td class="px-4 py-3">' + activeDot + '</td>';
        html += '<td class="px-4 py-3 font-mono text-xs text-slate-400">' + relTime(a.lastSeenAt) + '</td>';
        html += '<td class="px-4 py-3"><div class="flex items-center gap-1">';
        html += '<button onclick="SB_UI.openAccountModal(' + a.id + ')" class="btn-ghost p-1.5" title="Edit"><i class="ph-bold ph-pencil-simple text-amber-400"></i></button>';
        html += '<button onclick="SB_UI.askDelete(\'account\', ' + a.id + ', \'' + esc(a.username) + '\')" class="btn-ghost p-1.5" title="Delete"><i class="ph-bold ph-trash text-red-400"></i></button>';
        html += '</div></td></tr>';
      });

      html += '</tbody></table></div>';
      html += '<div class="px-4 py-3 text-xs text-slate-500 border-t border-slate-700/50">Showing ' + filtered.length + ' of ' + (accounts || []).length + ' accounts</div>';
      html += '</div>';

      el.innerHTML = html;
    },


    /* ============================================================
       TASKS TABLE
       ============================================================ */
    renderTasksTable: function(tasks) {
      var el = elById('superboost-tasks');
      if (!el) return;

      var html = '';

      // Header
      html += '<div class="flex items-center justify-between mb-5">';
      html += '<h3 class="text-lg font-semibold text-slate-100 flex items-center gap-2"><i class="ph-bold ph-list-checks text-amber-400"></i>Tasks</h3>';
      html += '<button onclick="SB_UI.openTaskModal()" class="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer flex items-center gap-2"><i class="ph-bold ph-plus"></i>Create Task</button>';
      html += '</div>';

      // Filters
      html += '<div class="flex flex-wrap items-center gap-3 mb-5">';
      html += '<div class="flex gap-1.5">';
      ['All', 'Pending', 'Assigned', 'Started', 'Problem', 'Done', 'Failed', 'Expired'].forEach(function(s) {
        var active = _taskFilters.status === s;
        var cls = active ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700';
        html += '<button onclick="SB_UI.setTaskFilter(\'status\', \'' + s + '\')" class="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors duration-200 ' + cls + '">' + s + '</button>';
      });
      html += '</div>';

      // Bulk actions
      html += '<div class="flex gap-2 ml-auto">';
      html += '<button onclick="SB_UI.bulkAssignPending()" class="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer flex items-center gap-1.5"><i class="ph-bold ph-user-plus"></i>Assign All Pending</button>';
      html += '<button onclick="SB_UI.bulkAutoComplete()" class="bg-slate-700 hover:bg-slate-600 text-slate-300 px-4 py-2 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer flex items-center gap-1.5"><i class="ph-bold ph-clock-countdown"></i>Auto-Complete Overdue</button>';
      html += '</div></div>';

      // Filter data
      var filtered = (tasks || []).filter(function(t) {
        if (_taskFilters.status !== 'All' && t.status !== _taskFilters.status) return false;
        if (_taskFilters.platform !== 'All' && t.targetPlatform !== _taskFilters.platform && t.sourcePlatform !== _taskFilters.platform) return false;
        if (_taskFilters.assistant !== 'All' && (t.assignedAssistant || '') !== _taskFilters.assistant) return false;
        return true;
      });

      if (!filtered.length) {
        html += this._emptyState('ph-list-checks', 'No tasks found', tasks && tasks.length ? 'Try adjusting your filters.' : 'Create your first task to get started.');
        el.innerHTML = html;
        return;
      }

      // Table
      html += '<div class="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden">';
      html += '<div class="overflow-x-auto"><table class="w-full text-sm"><thead>';
      html += '<tr class="border-b border-slate-700/50 text-slate-500 text-xs uppercase tracking-wider">';
      ['ID','Source','Target','Type','Assistant','Status','Created','Due','Actions'].forEach(function(h) {
        html += '<th class="text-left px-4 py-3 font-medium">' + h + '</th>';
      });
      html += '</tr></thead><tbody class="text-slate-300">';

      filtered.forEach(function(t) {
        html += '<tr class="border-b border-slate-700/50 hover:bg-slate-800/50">';
        html += '<td class="px-4 py-3 font-mono text-xs text-slate-500">#' + t.id + '</td>';
        html += '<td class="px-4 py-3"><span class="flex items-center gap-1.5">' + platformIcon(t.sourcePlatform, 'text-xs') + '<span class="font-mono text-xs">@' + esc(t.sourceUsername) + '</span></span></td>';
        html += '<td class="px-4 py-3"><span class="flex items-center gap-1.5">' + platformIcon(t.targetPlatform, 'text-xs') + '<span class="font-mono text-xs">@' + esc(t.targetUsername) + '</span></span></td>';
        html += '<td class="px-4 py-3 text-xs">' + esc(t.promotionType) + '</td>';
        html += '<td class="px-4 py-3 text-xs">' + (t.assignedAssistant ? esc(t.assignedAssistant) : '<span class="text-slate-500">--</span>') + '</td>';
        html += '<td class="px-4 py-3"><span class="badge ' + (STATUS_BADGE[t.status] || '') + '">' + esc(t.status) + '</span></td>';
        html += '<td class="px-4 py-3 font-mono text-xs text-slate-500">' + shortDate(t.createdAt) + '</td>';
        html += '<td class="px-4 py-3 font-mono text-xs text-slate-500">' + shortDate(t.dueAt) + '</td>';
        html += '<td class="px-4 py-3">' + SB_UI._taskActions(t) + '</td>';
        html += '</tr>';
      });

      html += '</tbody></table></div>';
      html += '<div class="px-4 py-3 text-xs text-slate-500 border-t border-slate-700/50">Showing ' + filtered.length + ' of ' + (tasks || []).length + ' tasks</div>';
      html += '</div>';

      el.innerHTML = html;
    },

    _taskActions: function(t) {
      var s = t.status;
      if (s === 'Done' || s === 'Failed' || s === 'Skipped' || s === 'Expired') {
        if (s === 'Failed') {
          return '<button onclick="SB_UI.taskAction(' + t.id + ', \'retry\')" class="text-amber-400 hover:text-amber-300 text-xs cursor-pointer transition-colors duration-200" title="Retry"><i class="ph-bold ph-arrow-counter-clockwise"></i></button>';
        }
        return '<span class="text-xs text-slate-600">--</span>';
      }
      var html = '<div class="flex items-center gap-1">';
      if (s === 'Pending') {
        html += '<button onclick="SB_UI.taskAction(' + t.id + ', \'assign\')" class="text-amber-400 hover:text-amber-300 text-xs cursor-pointer transition-colors duration-200" title="Assign"><i class="ph-bold ph-user-plus"></i></button>';
        html += '<button onclick="SB_UI.taskAction(' + t.id + ', \'start\')" class="text-blue-400 hover:text-blue-300 text-xs cursor-pointer transition-colors duration-200" title="Start"><i class="ph-bold ph-play"></i></button>';
      }
      if (s === 'Assigned') {
        html += '<button onclick="SB_UI.taskAction(' + t.id + ', \'start\')" class="text-blue-400 hover:text-blue-300 text-xs cursor-pointer transition-colors duration-200" title="Start"><i class="ph-bold ph-play"></i></button>';
      }
      if (s === 'Started') {
        html += '<button onclick="SB_UI.taskAction(' + t.id + ', \'done\')" class="text-emerald-400 hover:text-emerald-300 text-xs cursor-pointer transition-colors duration-200" title="Done"><i class="ph-bold ph-check"></i></button>';
        html += '<button onclick="SB_UI.taskAction(' + t.id + ', \'fail\')" class="text-red-400 hover:text-red-300 text-xs cursor-pointer transition-colors duration-200" title="Fail"><i class="ph-bold ph-x"></i></button>';
        html += '<button onclick="SB_UI.taskAction(' + t.id + ', \'problem\')" class="text-amber-400 hover:text-amber-300 text-xs cursor-pointer transition-colors duration-200" title="Problem"><i class="ph-bold ph-warning"></i></button>';
      }
      if (s === 'Problem') {
        html += '<button onclick="SB_UI.taskAction(' + t.id + ', \'start\')" class="text-emerald-400 hover:text-emerald-300 text-xs cursor-pointer transition-colors duration-200" title="Resolve"><i class="ph-bold ph-check"></i></button>';
        html += '<button onclick="SB_UI.taskAction(' + t.id + ', \'fail\')" class="text-red-400 hover:text-red-300 text-xs cursor-pointer transition-colors duration-200" title="Fail"><i class="ph-bold ph-x"></i></button>';
      }
      html += '</div>';
      return html;
    },


    /* ============================================================
       RULES GRID
       ============================================================ */
    renderRulesGrid: function(rules) {
      var el = elById('superboost-rules');
      if (!el) return;

      var html = '';
      html += '<div class="flex items-center justify-between mb-5">';
      html += '<h3 class="text-lg font-semibold text-slate-100 flex items-center gap-2"><i class="ph-bold ph-funnel text-amber-400"></i>Promotion Rules</h3>';
      html += '<button onclick="SB_UI.openRuleModal()" class="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer flex items-center gap-2"><i class="ph-bold ph-plus"></i>Add Rule</button>';
      html += '</div>';

      if (!rules || !rules.length) {
        html += this._emptyState('ph-funnel', 'No rules configured', 'Add your first promotion rule to start generating tasks.');
        el.innerHTML = html;
        return;
      }

      html += '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">';
      rules.forEach(function(r) {
        var sc = PLATFORM_COLORS[r.sourcePlatform] || 'slate';
        var tc = PLATFORM_COLORS[r.targetPlatform] || 'slate';
        var activeBadge = r.active ? '<span class="badge bg-emerald-500/20 text-emerald-400">Active</span>' : '<span class="badge bg-slate-600/30 text-slate-400">Inactive</span>';
        var randomBadge = r.randomAllowed ? '<span class="badge bg-emerald-500/20 text-emerald-400">Allowed</span>' : '<span class="badge bg-slate-600/30 text-slate-400">Not Allowed</span>';

        html += '<div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5 hover:border-amber-500/30 transition-colors duration-200">';
        html += '<div class="flex items-center justify-between mb-4">';
        html += '<span class="font-mono text-xs text-slate-500">R' + r.id + '</span>';
        html += '<div class="flex items-center gap-2">' + activeBadge;
        html += '<button onclick="SB_UI.openRuleModal(' + r.id + ')" class="btn-ghost p-1" title="Edit"><i class="ph-bold ph-pencil-simple text-amber-400 text-sm"></i></button>';
        html += '<button onclick="SB_UI.askDelete(\'rule\', ' + r.id + ', \'R' + r.id + '\')" class="btn-ghost p-1" title="Delete"><i class="ph-bold ph-trash text-red-400 text-sm"></i></button>';
        html += '</div></div>';

        // Source -> Target
        html += '<div class="flex items-center gap-3 mb-4">';
        html += '<div class="flex items-center gap-2 bg-slate-700/50 rounded-lg px-3 py-2"><i class="' + (PLATFORM_ICONS[r.sourcePlatform] || '') + ' text-' + sc + '-400"></i><span class="text-sm font-medium text-slate-300">' + esc(PLATFORM_LABELS[r.sourcePlatform] || r.sourcePlatform) + '</span></div>';
        html += '<i class="ph-bold ph-arrow-right text-amber-400"></i>';
        html += '<div class="flex items-center gap-2 bg-slate-700/50 rounded-lg px-3 py-2"><i class="' + (PLATFORM_ICONS[r.targetPlatform] || '') + ' text-' + tc + '-400"></i><span class="text-sm font-medium text-slate-300">' + esc(PLATFORM_LABELS[r.targetPlatform] || r.targetPlatform) + '</span></div>';
        html += '</div>';

        // Details
        html += '<div class="space-y-2 text-sm">';
        html += '<div class="flex items-center justify-between"><span class="text-slate-400">Type:</span><span class="text-white font-medium">' + esc(r.promotionType) + '</span></div>';
        html += '<div class="flex items-center justify-between"><span class="text-slate-400">Duration:</span><span class="font-mono text-slate-300">' + r.defaultDurationHours + 'h</span></div>';
        html += '<div class="flex items-center justify-between"><span class="text-slate-400">Random:</span>' + randomBadge + '</div>';

        // Toggle
        html += '<div class="flex items-center justify-between pt-1">';
        html += '<span class="text-slate-400">Toggle:</span>';
        var toggleBg = r.active ? 'bg-emerald-500' : 'bg-slate-600';
        var togglePos = r.active ? 'left-5' : 'left-0.5';
        html += '<button onclick="SB_UI.toggleRule(' + r.id + ', ' + !r.active + ')" class="w-11 h-6 rounded-full ' + toggleBg + ' relative transition-colors duration-200 focus:outline-none cursor-pointer"><span class="absolute ' + togglePos + ' top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-200"></span></button>';
        html += '</div></div></div>';
      });
      html += '</div>';

      el.innerHTML = html;
    },


    /* ============================================================
       ASSISTANTS GRID
       ============================================================ */
    renderAssistantsGrid: function(assistants) {
      var el = elById('superboost-assistants');
      if (!el) return;

      var html = '';
      html += '<div class="flex items-center justify-between mb-5">';
      html += '<h3 class="text-lg font-semibold text-slate-100 flex items-center gap-2"><i class="ph-bold ph-headset text-amber-400"></i>Assistants</h3>';
      html += '<button onclick="SB_UI.openAssistantModal()" class="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer flex items-center gap-2"><i class="ph-bold ph-plus"></i>Add Assistant</button>';
      html += '</div>';

      if (!assistants || !assistants.length) {
        html += this._emptyState('ph-headset', 'No assistants registered', 'Add your first assistant to start assigning tasks.');
        el.innerHTML = html;
        return;
      }

      html += '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">';
      assistants.forEach(function(a) {
        var onlineDot = a.isActive
          ? '<span class="relative flex h-2.5 w-2.5"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span></span><span class="text-xs font-medium text-emerald-400">Active</span>'
          : '<span class="w-2.5 h-2.5 rounded-full bg-slate-600 inline-block"></span><span class="text-xs font-medium text-slate-500">Inactive</span>';

        html += '<div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5 hover:border-amber-500/30 transition-colors duration-200">';
        html += '<div class="flex items-center justify-between mb-4">';
        html += '<div class="flex items-center gap-3">';
        html += '<div class="w-10 h-10 bg-amber-500/10 rounded-full flex items-center justify-center"><i class="ph-bold ph-user text-amber-400 text-lg"></i></div>';
        html += '<div><p class="text-white font-medium">' + esc(a.name) + '</p><p class="text-xs text-slate-500 font-mono">' + esc(a.telegramHandle || '') + '</p></div></div>';
        html += '<div class="flex items-center gap-2">' + onlineDot + '</div></div>';

        // Stats
        html += '<div class="grid grid-cols-2 gap-3 text-sm mb-3">';
        html += '<div class="bg-slate-700/30 rounded-lg p-3 text-center"><p class="text-xs text-slate-400 mb-1">Assigned</p><p class="text-xl font-bold text-amber-400 font-mono">' + (a.assignedCount || 0) + '</p></div>';
        html += '<div class="bg-slate-700/30 rounded-lg p-3 text-center"><p class="text-xs text-slate-400 mb-1">Completed</p><p class="text-xl font-bold text-emerald-400 font-mono">' + (a.completedCount || 0) + '</p></div>';
        html += '</div>';

        // Actions
        html += '<div class="flex items-center gap-2 pt-2 border-t border-slate-700/30">';
        html += '<button onclick="SB_UI.openAssistantModal(\'' + esc(a.telegramHandle || a.id) + '\')" class="btn-ghost px-3 py-1.5 text-xs flex items-center gap-1.5"><i class="ph-bold ph-pencil-simple text-amber-400"></i>Edit</button>';
        html += '<button onclick="SB_UI.askDelete(\'assistant\', \'' + esc(a.telegramHandle || a.id) + '\', \'' + esc(a.name) + '\')" class="btn-ghost px-3 py-1.5 text-xs flex items-center gap-1.5"><i class="ph-bold ph-trash text-red-400"></i>Remove</button>';
        html += '</div></div>';
      });
      html += '</div>';

      el.innerHTML = html;
    },


    /* ============================================================
       SHEETS SYNC PANEL
       ============================================================ */
    renderSheetsSyncPanel: function(config) {
      var el = elById('superboost-sheets-sync');
      if (!el) return;
      if (!config) {
        el.innerHTML = this._emptyState('ph-table', 'Sheets sync not configured', 'Enable Google Sheets integration in config to use this feature.');
        return;
      }

      var html = '';

      // Sync status + trigger
      html += '<div class="flex items-center justify-between mb-5">';
      html += '<div class="flex items-center gap-3">';
      var syncing = config.syncing;
      html += syncing
        ? '<span class="relative flex h-2.5 w-2.5"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span></span><span class="text-sm font-medium text-amber-400">Syncing...</span>'
        : '<span class="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span><span class="text-sm font-medium text-emerald-400">Idle</span>';
      html += '<span class="text-xs text-slate-500">Last: ' + (config.lastSyncAt ? esc(shortDate(config.lastSyncAt)) : 'Never') + '</span>';
      html += '</div>';
      html += '<button onclick="SB_UI.triggerSync()" class="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer flex items-center gap-2"><i class="ph-bold ph-cloud-arrow-down"></i>Sync Now</button>';
      html += '</div>';

      // Last sync summary
      if (config.lastResult) {
        var r = config.lastResult;
        html += '<div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5 mb-6">';
        html += '<h4 class="text-sm font-semibold text-slate-100 mb-4 flex items-center gap-2"><i class="ph-bold ph-clock-counter-clockwise text-amber-400"></i>Last Sync Summary</h4>';
        html += '<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">';
        html += '<div class="text-center"><p class="text-xs text-slate-500 mb-1">Synced At</p><p class="text-sm font-mono text-slate-300">' + esc(shortDate(r.syncedAt)) + '</p></div>';
        html += '<div class="text-center"><p class="text-xs text-slate-500 mb-1">Inserted</p><p class="text-xl font-bold text-emerald-400 font-mono">' + (r.accountsInserted || 0) + '</p></div>';
        html += '<div class="text-center"><p class="text-xs text-slate-500 mb-1">Updated</p><p class="text-xl font-bold text-cyan-400 font-mono">' + (r.accountsUpdated || 0) + '</p></div>';
        html += '<div class="text-center"><p class="text-xs text-slate-500 mb-1">Deactivated</p><p class="text-xl font-bold text-red-400 font-mono">' + (r.accountsDeactivated || 0) + '</p></div>';
        html += '<div class="text-center"><p class="text-xs text-slate-500 mb-1">Rules</p><p class="text-xl font-bold text-amber-400 font-mono">' + (r.rulesLoaded || 0) + '</p></div>';
        html += '<div class="text-center"><p class="text-xs text-slate-500 mb-1">Tasks Created</p><p class="text-xl font-bold text-blue-400 font-mono">' + (r.tasksCreated || 0) + '</p></div>';
        html += '</div></div>';
      }

      // History
      if (config.history && config.history.length) {
        html += '<div class="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden">';
        html += '<div class="px-5 py-3 border-b border-slate-700/50"><h4 class="text-sm font-semibold text-slate-100 flex items-center gap-2"><i class="ph-bold ph-list-bullets text-amber-400"></i>Sync History</h4></div>';
        html += '<div class="overflow-x-auto"><table class="w-full text-sm"><thead>';
        html += '<tr class="border-b border-slate-700/50 text-slate-500 text-xs uppercase tracking-wider">';
        ['Timestamp','Status','Inserted','Updated','Deactivated','Rules','Tasks','Auto-Completed'].forEach(function(h) {
          html += '<th class="text-left px-4 py-3 font-medium">' + h + '</th>';
        });
        html += '</tr></thead><tbody class="text-slate-300">';
        config.history.forEach(function(h, i) {
          var border = i < config.history.length - 1 ? 'border-b border-slate-700/50' : '';
          var stBadge = h.error ? '<span class="badge bg-red-500/20 text-red-400">Error</span>' : '<span class="badge bg-emerald-500/20 text-emerald-400">OK</span>';
          html += '<tr class="' + border + ' hover:bg-slate-800/50">';
          html += '<td class="px-4 py-3 font-mono text-xs">' + esc(shortDate(h.syncedAt)) + '</td>';
          html += '<td class="px-4 py-3">' + stBadge + '</td>';
          if (h.error) {
            for (var x = 0; x < 6; x++) html += '<td class="px-4 py-3 font-mono text-slate-500">--</td>';
          } else {
            html += '<td class="px-4 py-3 font-mono">' + (h.accountsInserted || 0) + '</td>';
            html += '<td class="px-4 py-3 font-mono">' + (h.accountsUpdated || 0) + '</td>';
            html += '<td class="px-4 py-3 font-mono">' + (h.accountsDeactivated || 0) + '</td>';
            html += '<td class="px-4 py-3 font-mono">' + (h.rulesLoaded || 0) + '</td>';
            html += '<td class="px-4 py-3 font-mono">' + (h.tasksCreated || 0) + '</td>';
            html += '<td class="px-4 py-3 font-mono">' + (h.tasksAutoCompleted || 0) + '</td>';
          }
          html += '</tr>';
        });
        html += '</tbody></table></div></div>';
      }

      el.innerHTML = html;
    },


    /* ============================================================
       CONFIG PANEL
       ============================================================ */
    renderConfigPanel: function(config) {
      var el = elById('superboost-config');
      if (!el) return;
      if (!config) {
        el.innerHTML = this._emptyState('ph-gear-six', 'No configuration loaded', 'Connect to the Superboost API to load configuration.');
        return;
      }

      var html = '';
      html += '<div class="flex items-center gap-3 mb-6"><i class="ph-bold ph-gear-six text-amber-400 text-2xl"></i><h3 class="text-lg font-semibold text-slate-100">Superboost Configuration</h3></div>';
      html += '<div class="space-y-3">';

      var entries = Array.isArray(config) ? config : Object.keys(config).map(function(k) { return { key: k, value: config[k], label: k, description: '', secret: false, toggle: false }; });

      entries.forEach(function(c) {
        html += '<div class="flex items-center justify-between bg-slate-800 rounded-lg p-4 border border-slate-700/50">';
        html += '<div><div class="text-sm font-medium text-slate-300">' + esc(c.label || c.key) + '</div>';
        if (c.description) html += '<div class="text-xs text-slate-500 mt-0.5">' + esc(c.description) + '</div>';
        html += '</div><div class="flex items-center gap-3">';

        if (c.toggle) {
          var isOn = c.value === true || c.value === 'true';
          var tBg = isOn ? 'bg-emerald-500' : 'bg-slate-600';
          var tPos = isOn ? 'left-5' : 'left-0.5';
          var valText = isOn ? 'true' : 'false';
          var valCls = isOn ? 'text-emerald-400' : 'text-red-400';
          html += '<span class="font-mono text-sm ' + valCls + '">' + valText + '</span>';
          html += '<button onclick="SB_UI.toggleConfig(\'' + esc(c.key) + '\')" class="w-11 h-6 rounded-full ' + tBg + ' relative transition-colors duration-200 focus:outline-none cursor-pointer"><span class="absolute ' + tPos + ' top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-200"></span></button>';
        } else if (c.secret) {
          html += '<span class="font-mono text-amber-400 text-sm">' + esc(String(c.value).substring(0, 5)) + '****</span>';
          html += '<button class="text-slate-400 hover:text-amber-400 px-3 py-1.5 rounded-md hover:bg-slate-700/50 transition-colors duration-200 flex items-center gap-1.5 text-sm cursor-pointer"><i class="ph-bold ph-eye"></i>Reveal</button>';
        } else {
          html += '<span class="font-mono text-amber-400 text-sm" id="sb-cfg-' + esc(c.key) + '">' + esc(String(c.value)) + '</span>';
          html += '<button onclick="sbEditConfig(\'' + esc(c.key) + '\')" class="text-slate-400 hover:text-amber-400 px-3 py-1.5 rounded-md hover:bg-slate-700/50 transition-colors duration-200 flex items-center gap-1.5 text-sm cursor-pointer"><i class="ph-bold ph-pencil-simple"></i>Edit</button>';
        }

        html += '</div></div>';
      });

      html += '</div>';
      el.innerHTML = html;
    },


    /* ============================================================
       MODAL OPEN / CLOSE
       ============================================================ */
    openAccountModal: function(id) {
      this._showModal('sb-modal-account');
      var titleEl = elById('sb-modal-account-title');
      elById('sb-acc-id').value = id || '';
      elById('sb-acc-username').value = '';
      elById('sb-acc-telegram').value = '';
      elById('sb-acc-status').value = 'Not Done';
      elById('sb-acc-active').value = 'true';
      this._setToggleState('sb-acc-active', true);

      // Build platform chips
      var chipsEl = elById('sb-acc-platform-chips');
      chipsEl.innerHTML = PLATFORMS.map(function(p) { return platformChip(p, false); }).join('');
      elById('sb-acc-platform').value = '';
      chipsEl.querySelectorAll('.sb-platform-chip').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var plat = btn.getAttribute('data-platform');
          elById('sb-acc-platform').value = plat;
          chipsEl.innerHTML = PLATFORMS.map(function(p) { return platformChip(p, p === plat); }).join('');
          // Re-bind
          SB_UI.openAccountModal.__rebindChips(chipsEl);
        });
      });
      this.openAccountModal.__rebindChips = function(container) {
        container.querySelectorAll('.sb-platform-chip').forEach(function(btn) {
          btn.addEventListener('click', function() {
            var plat = btn.getAttribute('data-platform');
            elById('sb-acc-platform').value = plat;
            container.innerHTML = PLATFORMS.map(function(p) { return platformChip(p, p === plat); }).join('');
            SB_UI.openAccountModal.__rebindChips(container);
          });
        });
      };

      if (id) {
        titleEl.textContent = 'Edit Account';
        // Load data from API
        if (typeof API !== 'undefined' && API.superboost && API.superboost.getAccount) {
          var acc = API.superboost.getAccount(id);
          if (acc) {
            elById('sb-acc-username').value = acc.username || '';
            elById('sb-acc-telegram').value = acc.assistantTelegram || '';
            elById('sb-acc-status').value = acc.sheetStatus || 'Not Done';
            elById('sb-acc-platform').value = acc.platform || '';
            elById('sb-acc-active').value = acc.active ? 'true' : 'false';
            this._setToggleState('sb-acc-active', acc.active);
            chipsEl.innerHTML = PLATFORMS.map(function(p) { return platformChip(p, p === acc.platform); }).join('');
            this.openAccountModal.__rebindChips(chipsEl);
          }
        }
      } else {
        titleEl.textContent = 'Add Account';
      }
    },

    openRuleModal: function(id) {
      this._showModal('sb-modal-rule');
      var titleEl = elById('sb-modal-rule-title');
      elById('sb-rule-id').value = id || '';
      elById('sb-rule-type').value = '';
      elById('sb-rule-duration').value = '24';
      elById('sb-rule-random').value = 'false';
      elById('sb-rule-active').value = 'true';
      this._setToggleState('sb-rule-random', false);
      this._setToggleState('sb-rule-active', true);

      // Populate platform selects
      var opts = '<option value="">Select platform...</option>';
      PLATFORMS.forEach(function(p) { opts += '<option value="' + p + '">' + PLATFORM_LABELS[p] + '</option>'; });
      elById('sb-rule-source').innerHTML = opts;
      elById('sb-rule-target').innerHTML = opts;

      if (id) {
        titleEl.textContent = 'Edit Rule';
        if (typeof API !== 'undefined' && API.superboost && API.superboost.getRule) {
          var rule = API.superboost.getRule(id);
          if (rule) {
            elById('sb-rule-source').value = rule.sourcePlatform || '';
            elById('sb-rule-target').value = rule.targetPlatform || '';
            elById('sb-rule-type').value = rule.promotionType || '';
            elById('sb-rule-duration').value = rule.defaultDurationHours || 24;
            elById('sb-rule-random').value = rule.randomAllowed ? 'true' : 'false';
            elById('sb-rule-active').value = rule.active ? 'true' : 'false';
            this._setToggleState('sb-rule-random', rule.randomAllowed);
            this._setToggleState('sb-rule-active', rule.active);
          }
        }
      } else {
        titleEl.textContent = 'Add Rule';
      }
    },

    openTaskModal: function() {
      this._showModal('sb-modal-task');
      elById('sb-modal-task-title').textContent = 'Create Task';
      elById('sb-task-id').value = '';
      elById('sb-task-source-search').value = '';
      elById('sb-task-target-search').value = '';
      elById('sb-task-source-id').value = '';
      elById('sb-task-target-id').value = '';
      elById('sb-task-duration').value = '24';
      elById('sb-task-notes').value = '';

      // Populate rule dropdown
      var ruleOpts = '<option value="">Select rule...</option>';
      if (typeof API !== 'undefined' && API.superboost && API.superboost.listRules) {
        var rules = API.superboost.listRules();
        (rules || []).forEach(function(r) {
          ruleOpts += '<option value="' + r.id + '">' + esc(PLATFORM_LABELS[r.sourcePlatform]) + ' -> ' + esc(PLATFORM_LABELS[r.targetPlatform]) + ' (' + esc(r.promotionType) + ')</option>';
        });
      }
      elById('sb-task-rule').innerHTML = ruleOpts;

      // Populate assistant dropdown
      var asstOpts = '<option value="">Unassigned</option>';
      if (typeof API !== 'undefined' && API.superboost && API.superboost.listAssistants) {
        var assts = API.superboost.listAssistants();
        (assts || []).forEach(function(a) {
          asstOpts += '<option value="' + esc(a.telegramHandle || a.id) + '">' + esc(a.name) + '</option>';
        });
      }
      elById('sb-task-assistant').innerHTML = asstOpts;
    },

    openAssistantModal: function(id) {
      this._showModal('sb-modal-assistant');
      var titleEl = elById('sb-modal-assistant-title');
      elById('sb-asst-id').value = id || '';
      elById('sb-asst-name').value = '';
      elById('sb-asst-telegram').value = '';
      elById('sb-asst-max-tasks').value = '10';
      elById('sb-asst-active').value = 'true';
      this._setToggleState('sb-asst-active', true);

      if (id) {
        titleEl.textContent = 'Edit Assistant';
        if (typeof API !== 'undefined' && API.superboost && API.superboost.getAssistant) {
          var a = API.superboost.getAssistant(id);
          if (a) {
            elById('sb-asst-name').value = a.name || '';
            elById('sb-asst-telegram').value = a.telegramHandle || '';
            elById('sb-asst-max-tasks').value = a.maxConcurrentTasks || 10;
            elById('sb-asst-active').value = a.isActive ? 'true' : 'false';
            this._setToggleState('sb-asst-active', a.isActive);
          }
        }
      } else {
        titleEl.textContent = 'Add Assistant';
      }
    },

    _showModal: function(id) {
      elById('sb-modal-backdrop').classList.remove('hidden');
      elById(id).classList.remove('hidden');
    },

    closeModal: function() {
      elById('sb-modal-backdrop').classList.add('hidden');
      ['sb-modal-account', 'sb-modal-rule', 'sb-modal-task', 'sb-modal-assistant', 'sb-modal-confirm', 'sb-modal-task-action'].forEach(function(id) {
        var m = elById(id);
        if (m) m.classList.add('hidden');
      });
    },


    /* ============================================================
       FORM SUBMISSIONS
       ============================================================ */
    submitAccount: function(e) {
      e.preventDefault();
      var id = elById('sb-acc-id').value;
      var platform = elById('sb-acc-platform').value;
      var username = elById('sb-acc-username').value.trim();
      var telegram = elById('sb-acc-telegram').value.trim();
      var status = elById('sb-acc-status').value;
      var active = elById('sb-acc-active').value === 'true';

      if (!platform) { toast('Please select a platform', 'error'); return; }
      if (!username) { toast('Username is required', 'error'); return; }

      // Sanitize
      username = username.replace(/[<>"'&]/g, '');
      telegram = telegram.replace(/[<>"'&]/g, '');

      var data = { platform: platform, username: username, assistantTelegram: telegram || null, sheetStatus: status, active: active };

      if (typeof API !== 'undefined' && API.superboost) {
        try {
          if (id) {
            API.superboost.updateAccount(id, data);
            toast('Account updated successfully', 'success');
          } else {
            API.superboost.createAccount(data);
            toast('Account created successfully', 'success');
          }
        } catch (err) {
          toast('Failed: ' + (err.message || err), 'error');
          return;
        }
      } else {
        toast(id ? 'Account updated (demo)' : 'Account created (demo)', 'success');
      }
      this.closeModal();
    },

    submitRule: function(e) {
      e.preventDefault();
      var id = elById('sb-rule-id').value;
      var source = elById('sb-rule-source').value;
      var target = elById('sb-rule-target').value;
      var type = elById('sb-rule-type').value.trim().replace(/[<>"'&]/g, '');
      var duration = parseInt(elById('sb-rule-duration').value) || 24;
      var random = elById('sb-rule-random').value === 'true';
      var active = elById('sb-rule-active').value === 'true';

      if (!source || !target) { toast('Source and target platforms are required', 'error'); return; }
      if (!type) { toast('Promotion type is required', 'error'); return; }

      var data = { sourcePlatform: source, targetPlatform: target, promotionType: type, defaultDurationHours: duration, randomAllowed: random, active: active };

      if (typeof API !== 'undefined' && API.superboost) {
        try {
          if (id) {
            API.superboost.updateRule(id, data);
            toast('Rule updated successfully', 'success');
          } else {
            API.superboost.createRule(data);
            toast('Rule created successfully', 'success');
          }
        } catch (err) {
          toast('Failed: ' + (err.message || err), 'error');
          return;
        }
      } else {
        toast(id ? 'Rule updated (demo)' : 'Rule created (demo)', 'success');
      }
      this.closeModal();
    },

    submitTask: function(e) {
      e.preventDefault();
      var sourceId = elById('sb-task-source-id').value;
      var targetId = elById('sb-task-target-id').value;
      var ruleId = elById('sb-task-rule').value;
      var assistant = elById('sb-task-assistant').value;
      var duration = parseInt(elById('sb-task-duration').value) || 24;
      var notes = elById('sb-task-notes').value.trim().replace(/[<>"'&]/g, '');

      if (!sourceId) { toast('Please select a source account', 'error'); return; }
      if (!targetId) { toast('Please select a target account', 'error'); return; }

      var data = { sourceAccountId: parseInt(sourceId), targetAccountId: parseInt(targetId), ruleId: ruleId ? parseInt(ruleId) : null, assignedAssistant: assistant || null, durationHours: duration, notes: notes || null };

      if (typeof API !== 'undefined' && API.superboost) {
        try {
          API.superboost.createTask(data);
          toast('Task created successfully', 'success');
        } catch (err) {
          toast('Failed: ' + (err.message || err), 'error');
          return;
        }
      } else {
        toast('Task created (demo)', 'success');
      }
      this.closeModal();
    },

    submitAssistant: function(e) {
      e.preventDefault();
      var id = elById('sb-asst-id').value;
      var name = elById('sb-asst-name').value.trim().replace(/[<>"'&]/g, '');
      var telegram = elById('sb-asst-telegram').value.trim().replace(/[<>"'&]/g, '');
      var maxTasks = parseInt(elById('sb-asst-max-tasks').value) || 10;
      var active = elById('sb-asst-active').value === 'true';

      if (!name) { toast('Name is required', 'error'); return; }
      if (!telegram) { toast('Telegram handle is required', 'error'); return; }

      var data = { name: name, telegramHandle: telegram, maxConcurrentTasks: maxTasks, isActive: active };

      if (typeof API !== 'undefined' && API.superboost) {
        try {
          if (id) {
            API.superboost.updateAssistant(id, data);
            toast('Assistant updated successfully', 'success');
          } else {
            API.superboost.createAssistant(data);
            toast('Assistant added successfully', 'success');
          }
        } catch (err) {
          toast('Failed: ' + (err.message || err), 'error');
          return;
        }
      } else {
        toast(id ? 'Assistant updated (demo)' : 'Assistant added (demo)', 'success');
      }
      this.closeModal();
    },


    /* ============================================================
       DELETE CONFIRM
       ============================================================ */
    askDelete: function(type, id, label) {
      _pendingDelete = { type: type, id: id };
      elById('sb-confirm-msg').textContent = 'Are you sure you want to delete ' + type + ' "' + (label || id) + '"? This action cannot be undone.';
      this._showModal('sb-modal-confirm');
    },

    confirmDelete: function() {
      if (!_pendingDelete) return;
      var t = _pendingDelete.type;
      var id = _pendingDelete.id;
      _pendingDelete = null;

      if (typeof API !== 'undefined' && API.superboost) {
        try {
          if (t === 'account') API.superboost.deleteAccount(id);
          else if (t === 'rule') API.superboost.deleteRule(id);
          else if (t === 'assistant') API.superboost.deleteAssistant(id);
          toast(t.charAt(0).toUpperCase() + t.slice(1) + ' deleted', 'success');
        } catch (err) {
          toast('Delete failed: ' + (err.message || err), 'error');
        }
      } else {
        toast(t.charAt(0).toUpperCase() + t.slice(1) + ' deleted (demo)', 'success');
      }
      this.closeModal();
    },


    /* ============================================================
       TASK ACTIONS
       ============================================================ */
    taskAction: function(taskId, action) {
      if (action === 'retry') {
        if (typeof API !== 'undefined' && API.superboost && API.superboost.retryTask) {
          try {
            API.superboost.retryTask(taskId);
            toast('Task #' + taskId + ' retried - new task created', 'success');
          } catch (err) { toast('Retry failed: ' + (err.message || err), 'error'); }
        } else { toast('Task #' + taskId + ' retried (demo)', 'success'); }
        return;
      }

      if (action === 'assign') {
        elById('sb-task-action-id').value = taskId;
        elById('sb-task-action-type').value = 'assign';
        elById('sb-task-action-title').innerHTML = '<i class="ph-bold ph-user-plus text-amber-400"></i> Assign Task #' + taskId;
        elById('sb-task-action-note').value = '';

        // Populate assistant dropdown
        var asstOpts = '<option value="">Select assistant...</option>';
        if (typeof API !== 'undefined' && API.superboost && API.superboost.listAssistants) {
          var assts = API.superboost.listAssistants();
          (assts || []).forEach(function(a) {
            asstOpts += '<option value="' + esc(a.telegramHandle || a.id) + '">' + esc(a.name) + '</option>';
          });
        }
        elById('sb-task-action-assistant').innerHTML = asstOpts;
        this._showModal('sb-modal-task-action');
        return;
      }

      // Direct actions: start, done, fail, problem
      var actionLabels = { start: 'Start', done: 'Complete', fail: 'Fail', problem: 'Report Problem' };
      elById('sb-task-action-id').value = taskId;
      elById('sb-task-action-type').value = action;
      elById('sb-task-action-title').innerHTML = '<i class="ph-bold ph-arrows-clockwise text-amber-400"></i> ' + (actionLabels[action] || action) + ' Task #' + taskId;
      elById('sb-task-action-note').value = '';
      elById('sb-task-action-assistant').innerHTML = '<option value="">Keep current</option>';
      this._showModal('sb-modal-task-action');
    },

    executeTaskAction: function() {
      var taskId = parseInt(elById('sb-task-action-id').value);
      var action = elById('sb-task-action-type').value;
      var assistant = elById('sb-task-action-assistant').value;
      var note = elById('sb-task-action-note').value.trim().replace(/[<>"'&]/g, '');

      if (typeof API !== 'undefined' && API.superboost && API.superboost.updateTask) {
        try {
          var payload = { action: action, note: note || null };
          if (assistant) payload.assignedAssistant = assistant;
          API.superboost.updateTask(taskId, payload);
          toast('Task #' + taskId + ' updated', 'success');
        } catch (err) {
          toast('Update failed: ' + (err.message || err), 'error');
        }
      } else {
        toast('Task #' + taskId + ' ' + action + ' (demo)', 'success');
      }
      this.closeModal();
    },

    bulkAssignPending: function() {
      if (typeof API !== 'undefined' && API.superboost && API.superboost.bulkAssignPending) {
        try {
          var count = API.superboost.bulkAssignPending();
          toast(count + ' pending tasks assigned', 'success');
        } catch (err) { toast('Bulk assign failed: ' + (err.message || err), 'error'); }
      } else { toast('Bulk assign triggered (demo)', 'success'); }
    },

    bulkAutoComplete: function() {
      if (typeof API !== 'undefined' && API.superboost && API.superboost.bulkAutoComplete) {
        try {
          var count = API.superboost.bulkAutoComplete();
          toast(count + ' overdue tasks auto-completed', 'success');
        } catch (err) { toast('Auto-complete failed: ' + (err.message || err), 'error'); }
      } else { toast('Auto-complete triggered (demo)', 'success'); }
    },


    /* ============================================================
       TOGGLE HELPERS
       ============================================================ */
    toggleField: function(hiddenId) {
      var hidden = elById(hiddenId);
      var toggleBtn = elById(hiddenId + '-toggle');
      if (!hidden || !toggleBtn) return;
      var isOn = hidden.value === 'true';
      hidden.value = isOn ? 'false' : 'true';
      this._setToggleState(hiddenId, !isOn);
    },

    _setToggleState: function(hiddenId, isOn) {
      var toggleBtn = elById(hiddenId + '-toggle');
      if (!toggleBtn) return;
      var dot = toggleBtn.querySelector('span');
      if (isOn) {
        toggleBtn.classList.remove('bg-slate-600');
        toggleBtn.classList.add('bg-emerald-500');
        if (dot) { dot.style.left = '20px'; }
      } else {
        toggleBtn.classList.remove('bg-emerald-500');
        toggleBtn.classList.add('bg-slate-600');
        if (dot) { dot.style.left = '2px'; }
      }
    },

    toggleRule: function(ruleId, active) {
      if (typeof API !== 'undefined' && API.superboost && API.superboost.updateRule) {
        try {
          API.superboost.updateRule(ruleId, { active: active });
          toast('Rule R' + ruleId + (active ? ' activated' : ' deactivated'), 'success');
        } catch (err) { toast('Toggle failed: ' + (err.message || err), 'error'); }
      } else { toast('Rule R' + ruleId + (active ? ' activated' : ' deactivated') + ' (demo)', 'success'); }
    },

    toggleScheduling: function() {
      if (typeof API !== 'undefined' && API.superboost && API.superboost.togglePause) {
        try {
          API.superboost.togglePause();
          toast('Scheduling toggled', 'success');
        } catch (err) { toast('Toggle failed: ' + (err.message || err), 'error'); }
      } else { toast('Scheduling toggled (demo)', 'success'); }
    },

    toggleConfig: function(key) {
      if (typeof API !== 'undefined' && API.superboost && API.superboost.updateConfig) {
        try {
          API.superboost.updateConfig(key);
          toast('Config "' + key + '" toggled', 'success');
        } catch (err) { toast('Toggle failed: ' + (err.message || err), 'error'); }
      } else { toast('Config "' + key + '" toggled (demo)', 'success'); }
    },

    triggerSync: function() {
      if (typeof API !== 'undefined' && API.superboost && API.superboost.triggerSync) {
        try {
          API.superboost.triggerSync();
          toast('Sheets sync triggered', 'success');
        } catch (err) { toast('Sync failed: ' + (err.message || err), 'error'); }
      } else { toast('Sheets sync triggered (demo)', 'success'); }
    },


    /* ============================================================
       ACCOUNT DROPDOWN (Searchable) for Task Modal
       ============================================================ */
    showAccountDropdown: function(field) {
      var dd = elById('sb-task-' + field + '-dropdown');
      if (!dd) return;
      this.filterAccountDropdown(field, elById('sb-task-' + field + '-search').value);
      dd.classList.remove('hidden');
    },

    filterAccountDropdown: function(field, query) {
      var dd = elById('sb-task-' + field + '-dropdown');
      if (!dd) return;
      var accounts = [];
      if (typeof API !== 'undefined' && API.superboost && API.superboost.listAccounts) {
        accounts = API.superboost.listAccounts() || [];
      }
      var q = (query || '').toLowerCase();
      var filtered = accounts.filter(function(a) {
        return !q || a.username.toLowerCase().indexOf(q) !== -1 || (a.platform || '').toLowerCase().indexOf(q) !== -1;
      }).slice(0, 20);

      if (!filtered.length) {
        dd.innerHTML = '<div class="px-4 py-3 text-xs text-slate-500">No accounts found</div>';
        dd.classList.remove('hidden');
        return;
      }

      dd.innerHTML = filtered.map(function(a) {
        return '<button type="button" onclick="SB_UI.selectAccount(\'' + field + '\', ' + a.id + ', \'' + esc(a.username) + '\', \'' + esc(a.platform) + '\')" class="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-800 transition-colors flex items-center gap-2 cursor-pointer">' +
          platformIcon(a.platform, 'text-xs') +
          '<span class="font-mono text-amber-400 text-xs">@' + esc(a.username) + '</span>' +
          '<span class="text-slate-500 text-xs ml-auto">' + esc(PLATFORM_LABELS[a.platform]) + '</span></button>';
      }).join('');
      dd.classList.remove('hidden');
    },

    selectAccount: function(field, id, username, platform) {
      elById('sb-task-' + field + '-search').value = '@' + username + ' (' + (PLATFORM_LABELS[platform] || platform) + ')';
      elById('sb-task-' + field + '-id').value = id;
      elById('sb-task-' + field + '-dropdown').classList.add('hidden');
    },


    /* ============================================================
       FILTER SETTERS
       ============================================================ */
    setAccountFilter: function(key, value) {
      _accountFilters[key] = value;
      // Re-render by fetching data from API
      if (typeof API !== 'undefined' && API.superboost && API.superboost.listAccounts) {
        this.renderAccountsTable(API.superboost.listAccounts());
      }
    },

    setTaskFilter: function(key, value) {
      _taskFilters[key] = value;
      if (typeof API !== 'undefined' && API.superboost && API.superboost.listTasks) {
        this.renderTasksTable(API.superboost.listTasks());
      }
    },


    /* ============================================================
       EMPTY STATE
       ============================================================ */
    _emptyState: function(icon, title, msg) {
      return '<div class="bg-slate-800/40 rounded-xl border border-dashed border-slate-700/50 p-12 text-center">' +
        '<div class="w-16 h-16 mx-auto mb-4 bg-slate-800 rounded-full flex items-center justify-center">' +
        '<i class="ph-bold ' + icon + ' text-slate-500 text-3xl"></i></div>' +
        '<h4 class="text-lg font-semibold text-slate-400 mb-2">' + esc(title) + '</h4>' +
        '<p class="text-sm text-slate-500">' + esc(msg) + '</p></div>';
    }

  };

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { SB_UI.init(); });
  } else {
    SB_UI.init();
  }

})();
