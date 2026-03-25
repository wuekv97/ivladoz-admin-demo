(function() {
  'use strict';

  /* -----------------------------------------------------------
     Utility: Sanitize user input to prevent XSS
     ----------------------------------------------------------- */
  function esc(str) {
    if (str == null) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(String(str)));
    return div.innerHTML;
  }

  /* -----------------------------------------------------------
     Utility: Format date for display
     ----------------------------------------------------------- */
  function fmtDate(val) {
    if (!val) return '<span class="text-slate-600">&mdash;</span>';
    var d = (val instanceof Date) ? val : new Date(val);
    if (isNaN(d.getTime())) return '<span class="text-slate-600">&mdash;</span>';
    var day = d.getDate();
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var h = d.getHours().toString().padStart(2, '0');
    var m = d.getMinutes().toString().padStart(2, '0');
    return day + ' ' + months[d.getMonth()] + ' ' + h + ':' + m;
  }

  /* -----------------------------------------------------------
     Utility: Relative time (e.g. "3m ago")
     ----------------------------------------------------------- */
  function timeAgo(val) {
    if (!val) return 'never';
    var d = (val instanceof Date) ? val : new Date(val);
    if (isNaN(d.getTime())) return 'never';
    var diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return diff + 's ago';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
  }

  /* -----------------------------------------------------------
     Utility: Extract Google Drive Folder ID from URL or raw ID
     ----------------------------------------------------------- */
  function extractDriveId(input) {
    if (!input) return '';
    var match = input.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    match = input.match(/id=([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    return input.trim();
  }

  /* -----------------------------------------------------------
     Utility: Generate initials from name
     ----------------------------------------------------------- */
  function initials(name) {
    if (!name) return '?';
    var parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  /* -----------------------------------------------------------
     Utility: Truncate Drive ID for display
     ----------------------------------------------------------- */
  function truncId(id) {
    if (!id) return '';
    if (id.length <= 12) return id;
    return id.substring(0, 6) + '...' + id.substring(id.length - 4);
  }

  /* -----------------------------------------------------------
     Toast notifications
     ----------------------------------------------------------- */
  function showToast(message, type) {
    type = type || 'info';
    var container = document.getElementById('autoeditors-toast-container');
    if (!container) return;

    var colors = {
      success: 'bg-emerald-600/90 border-emerald-500/50 text-white',
      error: 'bg-red-600/90 border-red-500/50 text-white',
      info: 'bg-violet-600/90 border-violet-500/50 text-white',
      warning: 'bg-amber-600/90 border-amber-500/50 text-white'
    };
    var icons = {
      success: 'ph-check-circle',
      error: 'ph-warning-circle',
      info: 'ph-info',
      warning: 'ph-warning'
    };

    var toast = document.createElement('div');
    toast.className = 'pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium shadow-lg shadow-black/30 transform translate-x-full transition-transform duration-300 ' + (colors[type] || colors.info);
    toast.innerHTML = '<i class="ph-bold ' + (icons[type] || icons.info) + ' text-base"></i><span>' + esc(message) + '</span>';
    container.appendChild(toast);

    requestAnimationFrame(function() {
      toast.classList.remove('translate-x-full');
      toast.classList.add('translate-x-0');
    });

    setTimeout(function() {
      toast.classList.remove('translate-x-0');
      toast.classList.add('translate-x-full');
      setTimeout(function() { toast.remove(); }, 300);
    }, 3500);
  }


  /* -----------------------------------------------------------
     Internal state
     ----------------------------------------------------------- */
  var _state = {
    editors: [],
    folders: [],
    assignments: [],
    logs: [],
    config: {},
    unassignedFiles: [],
    assignmentFilter: 'all',
    assignmentEditorFilter: '',
    assignmentDateFilter: 'all',
    assignmentSearch: '',
    logFilter: 'all',
    selectedPriority: 'normal',
    pendingConfirmAction: null
  };


  /* ===========================================================
     AUTOEDITORS_UI — Public API
     =========================================================== */
  window.AUTOEDITORS_UI = {

    /* ---------------------------------------------------------
       init: Load all data and render everything
       --------------------------------------------------------- */
    init: function() {
      var self = this;
      Promise.all([
        API.autoeditors.getEditors(),
        API.autoeditors.getFolders(),
        API.autoeditors.getAssignments(),
        API.autoeditors.getLogs(),
        API.autoeditors.getConfig(),
        API.autoeditors.getUnassignedFiles()
      ]).then(function(results) {
        _state.editors = results[0] || [];
        _state.folders = results[1] || [];
        _state.assignments = results[2] || [];
        _state.logs = results[3] || [];
        _state.config = results[4] || {};
        _state.unassignedFiles = results[5] || [];

        self.renderAll();
      }).catch(function(err) {
        console.error('AUTOEDITORS_UI init error:', err);
        showToast('Failed to load Autoeditors data', 'error');
      });
    },

    renderAll: function() {
      var stats = this._computeStats();
      this.renderDashboard(stats);
      this.renderEditorsGrid(_state.editors);
      this.renderAssignmentsTable(_state.assignments);
      this.renderFoldersGrid(_state.folders);
      this.renderLogsTable(_state.logs);
      this.renderConfigPanel(_state.config);
    },


    /* ---------------------------------------------------------
       _computeStats: Derive dashboard numbers from raw data
       --------------------------------------------------------- */
    _computeStats: function() {
      var total = _state.assignments.length;
      var active = 0;
      var completedToday = 0;
      var queued = 0;
      var failed = 0;
      var todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      for (var i = 0; i < _state.assignments.length; i++) {
        var a = _state.assignments[i];
        var s = (a.status || '').toUpperCase();
        if (s === 'ASSIGNED' || s === 'PREVIEW' || s === 'ACTIVE') active++;
        else if (s === 'NEW' || s === 'QUEUED') queued++;
        else if (s === 'ERROR' || s === 'FAILED') failed++;
        else if (s === 'DONE' || s === 'COMPLETED') {
          var fin = a.finished_at ? new Date(a.finished_at) : null;
          if (fin && fin >= todayStart) completedToday++;
        }
      }

      return {
        total: total,
        active: active,
        completedToday: completedToday,
        queued: queued,
        failed: failed,
        editorCount: _state.editors.length,
        enabledEditors: _state.editors.filter(function(e) { return e.enabled; }).length,
        folderCount: _state.folders.length
      };
    },


    /* ---------------------------------------------------------
       renderDashboard
       --------------------------------------------------------- */
    renderDashboard: function(stats) {
      var el = document.getElementById('autoeditors-sub-dashboard');
      if (!el) return;

      var testMode = _state.config.TEST_MODE;
      var dryRun = _state.config.DRY_RUN;
      var autoAssign = _state.config.AUTO_ASSIGN_ON_SYNC;

      function modeBadge(label, val) {
        var on = val === true || val === 'true';
        var cls = on ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-slate-600/30 text-slate-400 border-slate-600/30';
        var icon = label === 'AUTO_ASSIGN' ? 'ph-arrows-clockwise' : (label === 'DRY_RUN' ? 'ph-shield-warning' : 'ph-flask');
        if (label === 'AUTO_ASSIGN' && on) cls = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
        return '<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ' + cls + '">' +
          '<i class="ph-bold ' + icon + '"></i>' + esc(label) + ': ' + (on ? 'true' : 'false') + '</span>';
      }

      var html = '';

      // Bot status banner
      html += '<div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5 mb-6">';
      html += '<div class="flex flex-wrap items-center gap-6">';
      html += '<div class="flex items-center gap-3">';
      html += '<span class="relative flex h-3 w-3">';
      html += '<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>';
      html += '<span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>';
      html += '</span>';
      html += '<span class="text-emerald-400 font-semibold text-sm">Bot Online</span>';
      html += '</div>';
      html += '<div class="flex flex-wrap gap-2">';
      html += modeBadge('TEST_MODE', testMode);
      html += modeBadge('DRY_RUN', dryRun);
      html += modeBadge('AUTO_ASSIGN', autoAssign);
      html += '</div>';
      html += '</div></div>';

      // Stat cards
      html += '<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-6">';

      html += _statCard('Total Tracked', stats.total, 'Across all intake folders', 'ph-video-camera', 'violet');
      html += _statCard('Active Assignments', stats.active, stats.enabledEditors + ' editors enabled', 'ph-user-focus', 'violet');
      html += _statCard('Completed Today', stats.completedToday, '', 'ph-check-circle', 'emerald');
      html += _statCard('Awaiting Assignment', stats.queued, 'Ready for round-robin', 'ph-queue', 'amber');

      html += '</div>';

      // Folders overview
      if (_state.folders.length > 0) {
        html += '<h3 class="text-white font-semibold text-sm flex items-center gap-2 mb-4">';
        html += '<i class="ph-bold ph-folder-notch-open text-violet-400"></i>Intake Folders</h3>';
        html += '<div class="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">';
        for (var i = 0; i < _state.folders.length; i++) {
          var f = _state.folders[i];
          html += '<div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">';
          html += '<div class="flex items-center justify-between mb-3">';
          html += '<span class="text-white font-semibold text-sm">' + esc(f.name) + '</span>';
          if (f.type) {
            html += '<span class="badge px-2 py-0.5 rounded-full text-xs font-medium bg-violet-500/20 text-violet-400">' + esc(f.type) + '</span>';
          }
          html += '</div>';
          html += '<div class="space-y-2 text-sm">';
          html += '<div class="flex justify-between"><span class="text-slate-400">Drive ID</span><span class="font-mono text-slate-500 text-xs">' + esc(truncId(f.driveId)) + '</span></div>';
          html += '<div class="flex justify-between"><span class="text-slate-400">Videos</span><span class="font-mono text-white">' + (f.totalFiles || 0) + '</span></div>';
          html += '<div class="flex justify-between"><span class="text-slate-400">Last Sync</span><span class="font-mono text-slate-400 text-xs">' + timeAgo(f.lastSync) + '</span></div>';
          html += '</div></div>';
        }
        html += '</div>';
      }

      // Recent activity
      var recentLogs = _state.logs.slice(0, 5);
      if (recentLogs.length > 0) {
        html += '<div class="bg-slate-800 rounded-xl border border-slate-700/50">';
        html += '<div class="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">';
        html += '<h3 class="text-white font-semibold text-sm flex items-center gap-2">';
        html += '<i class="ph-bold ph-clock-counter-clockwise text-violet-400"></i>Recent Activity</h3>';
        html += '<span class="badge px-2 py-0.5 rounded-full text-xs font-medium bg-slate-600/30 text-slate-400">last ' + recentLogs.length + '</span>';
        html += '</div>';
        html += '<div class="divide-y divide-slate-700/50">';
        for (var j = 0; j < recentLogs.length; j++) {
          html += _activityRow(recentLogs[j]);
        }
        html += '</div></div>';
      } else {
        html += _emptyState('ph-clock-counter-clockwise', 'No recent activity', 'Logs will appear once the bot starts processing.');
      }

      el.innerHTML = html;
    },


    /* ---------------------------------------------------------
       renderEditorsGrid
       --------------------------------------------------------- */
    renderEditorsGrid: function(editors) {
      var el = document.getElementById('autoeditors-sub-editors');
      if (!el) return;

      var html = '';

      // Header with add button
      html += '<div class="flex items-center justify-between mb-6">';
      html += '<h3 class="text-lg font-semibold text-white flex items-center gap-2">';
      html += '<i class="ph-bold ph-users-three text-violet-400"></i>Editor Pool</h3>';
      var enabledCount = editors.filter(function(e) { return e.enabled; }).length;
      html += '<div class="flex items-center gap-3">';
      html += '<span class="text-sm text-slate-400">' + editors.length + ' editors &middot; ' + enabledCount + ' enabled</span>';
      html += '<button onclick="AUTOEDITORS_UI.openEditorModal()" class="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer flex items-center gap-2">';
      html += '<i class="ph-bold ph-user-plus"></i>Add Editor</button>';
      html += '</div></div>';

      if (editors.length === 0) {
        html += _emptyState('ph-users-three', 'No editors yet', 'Add your first editor to start assigning videos.');
        el.innerHTML = html;
        return;
      }

      html += '<div class="grid grid-cols-1 lg:grid-cols-3 gap-5">';

      for (var i = 0; i < editors.length; i++) {
        var ed = editors[i];
        var isActive = _editorActiveCount(ed) > 0;
        var borderCls = isActive ? 'border-violet-500/30' : 'border-slate-700/50';

        html += '<div class="bg-slate-800 rounded-xl border ' + borderCls + ' p-5 relative">';

        // Status dot
        html += '<div class="absolute top-4 right-4">';
        if (isActive) {
          html += '<span class="relative flex h-2.5 w-2.5">';
          html += '<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>';
          html += '<span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span></span>';
        } else if (ed.enabled) {
          html += '<span class="inline-flex rounded-full h-2.5 w-2.5 bg-slate-500"></span>';
        } else {
          html += '<span class="inline-flex rounded-full h-2.5 w-2.5 bg-red-500/60"></span>';
        }
        html += '</div>';

        // Header
        html += '<div class="flex items-center gap-3 mb-4">';
        html += '<div class="w-11 h-11 rounded-full bg-violet-500/20 border border-violet-500/40 flex items-center justify-center text-violet-400 font-bold text-sm">' + esc(initials(ed.name)) + '</div>';
        html += '<div>';
        html += '<p class="text-white font-semibold">' + esc(ed.name) + '</p>';
        html += '<p class="text-xs text-slate-400 font-mono">@' + esc((ed.tg_username || '').replace(/^@/, '')) + ' &middot; ID ' + esc(ed.editor_id) + '</p>';
        html += '</div></div>';

        // Status badge
        html += '<div class="mb-4">';
        if (!ed.enabled) {
          html += '<span class="badge px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400">Disabled</span>';
        } else if (isActive) {
          html += '<span class="badge px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">Active</span>';
        } else {
          html += '<span class="badge px-2 py-0.5 rounded-full text-xs font-medium bg-slate-600/30 text-slate-400">Idle</span>';
        }
        html += '</div>';

        // Current assignment
        var currentAssign = _editorCurrentAssignment(ed);
        html += '<div class="bg-slate-900/60 rounded-lg p-3 mb-4 border border-slate-700/50">';
        html += '<p class="text-xs text-slate-500 uppercase tracking-wider mb-1">Current Assignment</p>';
        if (currentAssign) {
          html += '<p class="text-sm text-violet-400 font-mono truncate">' + esc(currentAssign.video_name) + '</p>';
          html += '<p class="text-xs text-slate-500 mt-1">Assigned ' + timeAgo(currentAssign.assigned_at) + ' &middot; ' + esc(currentAssign.source) + '</p>';
        } else {
          html += '<p class="text-sm text-slate-500 italic">No active video</p>';
        }
        html += '</div>';

        // Stats
        var edStats = _editorStats(ed);
        html += '<div class="grid grid-cols-3 gap-3 mb-4 text-center">';
        html += '<div><p class="text-lg font-bold text-white">' + edStats.completed + '</p><p class="text-xs text-slate-500">Completed</p></div>';
        html += '<div><p class="text-lg font-bold text-violet-400">' + edStats.active + '</p><p class="text-xs text-slate-500">Active</p></div>';
        html += '<div><p class="text-lg font-bold text-slate-400">' + edStats.queued + '</p><p class="text-xs text-slate-500">Queue</p></div>';
        html += '</div>';

        // Allowed sources
        var sources = ed.allowed_sources || [];
        if (sources.length > 0) {
          html += '<div class="mb-4">';
          html += '<p class="text-xs text-slate-500 uppercase tracking-wider mb-2">Allowed Sources</p>';
          html += '<div class="flex flex-wrap gap-1.5">';
          for (var s = 0; s < sources.length; s++) {
            html += '<span class="px-2 py-0.5 rounded text-xs bg-slate-700/60 text-slate-300 border border-slate-600/50">' + esc(sources[s]) + '</span>';
          }
          html += '</div></div>';
        }

        // Footer with toggle, edit, delete, quick assign
        html += '<div class="flex items-center justify-between pt-3 border-t border-slate-700/50">';
        html += '<div class="flex items-center gap-2">';
        html += '<button onclick="AUTOEDITORS_UI.openEditorModal(\'' + esc(ed.editor_id) + '\')" class="btn-ghost p-1.5" title="Edit">';
        html += '<i class="ph-bold ph-pencil-simple text-sm"></i></button>';
        html += '<button onclick="AUTOEDITORS_UI.confirmDeleteEditor(\'' + esc(ed.editor_id) + '\', \'' + esc(ed.name) + '\')" class="btn-ghost p-1.5 hover:!text-red-400" title="Delete">';
        html += '<i class="ph-bold ph-trash text-sm"></i></button>';
        html += '<button onclick="AUTOEDITORS_UI.quickAssign(\'' + esc(ed.editor_id) + '\')" class="btn-ghost p-1.5 hover:!text-violet-400" title="Quick Assign">';
        html += '<i class="ph-bold ph-user-focus text-sm"></i></button>';
        html += '</div>';

        // Enable/disable toggle
        var toggleOn = ed.enabled;
        var toggleCls = toggleOn ? 'bg-emerald-500' : 'bg-slate-600';
        var dotPos = toggleOn ? 'left: 18px' : 'left: 2px';
        html += '<button onclick="AUTOEDITORS_UI.toggleEditor(\'' + esc(ed.editor_id) + '\', this)" class="w-10 h-6 rounded-full ' + toggleCls + ' relative transition-colors duration-200 focus:outline-none cursor-pointer" title="' + (toggleOn ? 'Enabled' : 'Disabled') + '">';
        html += '<span class="absolute top-[2px] w-[18px] h-[18px] bg-white rounded-full shadow-sm transition-all duration-200" style="' + dotPos + '"></span></button>';
        html += '</div>';

        html += '</div>';
      }

      html += '</div>';
      el.innerHTML = html;
    },


    /* ---------------------------------------------------------
       renderAssignmentsTable
       --------------------------------------------------------- */
    renderAssignmentsTable: function(data) {
      var el = document.getElementById('autoeditors-sub-assignments');
      if (!el) return;

      var html = '';

      // Header
      html += '<div class="flex items-center justify-between mb-4">';
      html += '<h3 class="text-lg font-semibold text-white flex items-center gap-2">';
      html += '<i class="ph-bold ph-list-checks text-violet-400"></i>Video Assignments</h3>';
      html += '<button onclick="AUTOEDITORS_UI.openAssignmentModal()" class="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer flex items-center gap-2">';
      html += '<i class="ph-bold ph-user-focus"></i>New Assignment</button>';
      html += '</div>';

      // Filter pills
      html += '<div class="flex flex-wrap gap-2 mb-4">';
      var filters = [
        { key: 'all', label: 'All', icon: '' },
        { key: 'active', label: 'Active', icon: 'ph-circle-notch' },
        { key: 'queued', label: 'Queued', icon: 'ph-clock' },
        { key: 'done', label: 'Completed', icon: 'ph-check' },
        { key: 'error', label: 'Failed', icon: 'ph-warning' }
      ];
      for (var fi = 0; fi < filters.length; fi++) {
        var f = filters[fi];
        var isActive = _state.assignmentFilter === f.key;
        var pillCls = isActive ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700 bg-slate-800 border border-slate-700/50';
        var iconHtml = f.icon ? '<i class="ph-bold ' + f.icon + ' mr-1"></i>' : '';
        html += '<button class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer ' + pillCls + '" onclick="AUTOEDITORS_UI.filterAssignments(\'' + f.key + '\')">' + iconHtml + f.label + '</button>';
      }
      html += '</div>';

      // Additional filters row
      html += '<div class="flex flex-wrap items-center gap-3 mb-5">';

      // Editor filter dropdown
      html += '<select onchange="AUTOEDITORS_UI.filterAssignmentsByEditor(this.value)" class="bg-slate-800 border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-violet-500/60 cursor-pointer appearance-none" style="background-image: url(\'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 12 12%22%3E%3Cpath fill=%22%2394a3b8%22 d=%22M2 4l4 4 4-4%22/%3E%3C/svg%3E\'); background-repeat: no-repeat; background-position: right 8px center; padding-right: 24px;">';
      html += '<option value="">All Editors</option>';
      for (var ei = 0; ei < _state.editors.length; ei++) {
        var edSel = _state.assignmentEditorFilter === _state.editors[ei].editor_id ? ' selected' : '';
        html += '<option value="' + esc(_state.editors[ei].editor_id) + '"' + edSel + '>@' + esc((_state.editors[ei].tg_username || '').replace(/^@/, '')) + '</option>';
      }
      html += '</select>';

      // Date range pills
      html += '<div class="flex gap-1">';
      var dateFilters = [
        { key: 'all', label: 'All Time' },
        { key: 'today', label: 'Today' },
        { key: 'week', label: 'Week' },
        { key: 'month', label: 'Month' }
      ];
      for (var di = 0; di < dateFilters.length; di++) {
        var df = dateFilters[di];
        var dActive = _state.assignmentDateFilter === df.key;
        var dCls = dActive ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300';
        html += '<button class="px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ' + dCls + '" onclick="AUTOEDITORS_UI.filterAssignmentsByDate(\'' + df.key + '\')">' + df.label + '</button>';
      }
      html += '</div>';

      // Search
      html += '<div class="relative flex-1 min-w-[180px]">';
      html += '<div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none"><i class="ph-bold ph-magnifying-glass text-slate-500 text-sm"></i></div>';
      html += '<input type="text" placeholder="Search filename..." value="' + esc(_state.assignmentSearch) + '" oninput="AUTOEDITORS_UI.searchAssignments(this.value)" class="w-full bg-slate-800 border border-slate-700/50 rounded-lg pl-9 pr-4 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/60 transition-colors">';
      html += '</div>';

      html += '</div>';

      // Apply filters
      var filtered = _filterAssignments(data);

      if (filtered.length === 0) {
        html += _emptyState('ph-list-checks', 'No assignments found', 'Adjust filters or create a new assignment.');
        el.innerHTML = html;
        return;
      }

      // Table
      html += '<div class="bg-slate-800 rounded-xl border border-slate-700/50 overflow-hidden">';
      html += '<div class="overflow-x-auto">';
      html += '<table class="w-full text-sm">';
      html += '<thead><tr class="text-slate-500 text-xs uppercase tracking-wider border-b border-slate-700/50">';
      html += '<th class="text-left px-6 py-3 font-medium">Video</th>';
      html += '<th class="text-left px-6 py-3 font-medium">Filename</th>';
      html += '<th class="text-left px-6 py-3 font-medium">Editor</th>';
      html += '<th class="text-left px-6 py-3 font-medium">Source</th>';
      html += '<th class="text-left px-6 py-3 font-medium">Status</th>';
      html += '<th class="text-left px-6 py-3 font-medium">Assigned At</th>';
      html += '<th class="text-left px-6 py-3 font-medium">Finished At</th>';
      html += '</tr></thead>';
      html += '<tbody class="divide-y divide-slate-700/30">';

      for (var ai = 0; ai < filtered.length; ai++) {
        var a = filtered[ai];
        var status = (a.status || 'NEW').toUpperCase();
        var statusMap = {
          'ASSIGNED': { cls: 'bg-violet-500/20 text-violet-400', label: 'Active' },
          'PREVIEW': { cls: 'bg-violet-500/20 text-violet-400', label: 'Preview' },
          'ACTIVE': { cls: 'bg-violet-500/20 text-violet-400', label: 'Active' },
          'DONE': { cls: 'bg-emerald-500/20 text-emerald-400', label: 'Done' },
          'COMPLETED': { cls: 'bg-emerald-500/20 text-emerald-400', label: 'Done' },
          'NEW': { cls: 'bg-amber-500/20 text-amber-400', label: 'Queued' },
          'QUEUED': { cls: 'bg-amber-500/20 text-amber-400', label: 'Queued' },
          'ERROR': { cls: 'bg-red-500/20 text-red-400', label: 'Error' },
          'FAILED': { cls: 'bg-red-500/20 text-red-400', label: 'Failed' }
        };
        var sm = statusMap[status] || statusMap['NEW'];

        var edName = a.editor ? esc(a.editor) : '<span class="text-slate-500 italic">unassigned</span>';
        var finishedCls = (status === 'DONE' || status === 'COMPLETED') ? 'font-mono text-emerald-400/70 text-xs' : '';

        html += '<tr class="hover:bg-slate-700/20 transition-colors duration-200">';
        html += '<td class="px-6 py-3 font-mono text-white font-medium">#' + esc(a.row_num || a.id || '') + '</td>';
        html += '<td class="px-6 py-3 font-mono text-violet-400 text-xs">' + esc(a.video_name || '') + '</td>';
        html += '<td class="px-6 py-3 text-slate-300">' + edName + '</td>';
        html += '<td class="px-6 py-3 text-slate-400">' + esc(a.source || '') + '</td>';
        html += '<td class="px-6 py-3"><span class="badge px-2 py-0.5 rounded-full text-xs font-medium ' + sm.cls + '">' + sm.label + '</span></td>';
        html += '<td class="px-6 py-3 font-mono text-slate-400 text-xs">' + fmtDate(a.assigned_at) + '</td>';
        html += '<td class="px-6 py-3 ' + finishedCls + '">' + fmtDate(a.finished_at) + '</td>';
        html += '</tr>';
      }

      html += '</tbody></table></div></div>';
      el.innerHTML = html;
    },


    /* ---------------------------------------------------------
       renderFoldersGrid
       --------------------------------------------------------- */
    renderFoldersGrid: function(folders) {
      var el = document.getElementById('autoeditors-sub-folders');
      if (!el) return;

      var html = '';

      // Header
      html += '<div class="flex items-center justify-between mb-6">';
      html += '<h3 class="text-lg font-semibold text-white flex items-center gap-2">';
      html += '<i class="ph-bold ph-google-drive-logo text-violet-400"></i>Google Drive Intake Folders</h3>';
      html += '<div class="flex items-center gap-3">';
      html += '<button onclick="AUTOEDITORS_UI.syncAllFolders()" class="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer flex items-center gap-2" id="autoeditors-sync-all-btn">';
      html += '<i class="ph-bold ph-arrows-clockwise"></i>Sync All</button>';
      html += '<button onclick="AUTOEDITORS_UI.openFolderModal()" class="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer flex items-center gap-2">';
      html += '<i class="ph-bold ph-folder-plus"></i>Add Folder</button>';
      html += '</div></div>';

      if (folders.length === 0) {
        html += _emptyState('ph-folder-open', 'No folders configured', 'Add a Google Drive folder to start tracking files.');
        el.innerHTML = html;
        return;
      }

      html += '<div class="grid grid-cols-1 lg:grid-cols-3 gap-5">';

      for (var i = 0; i < folders.length; i++) {
        var f = folders[i];
        var total = f.totalFiles || 0;
        var unassigned = f.unassigned || 0;
        var assigned = f.assigned || 0;
        var completed = f.completed || 0;
        var pct = total > 0 ? Math.round((completed / total) * 100 * 10) / 10 : 0;

        var iconCls = (f.type === 'nsfw' || f.name.indexOf('nsfw') > -1 || f.name.indexOf('rawfolder3') > -1) ? 'ph-folder-lock text-amber-400' : 'ph-folder text-violet-400';
        var iconBg = iconCls.indexOf('amber') > -1 ? 'bg-amber-500/10' : 'bg-violet-500/10';

        html += '<div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">';
        html += '<div class="flex items-center gap-3 mb-4">';
        html += '<div class="w-10 h-10 rounded-lg ' + iconBg + ' flex items-center justify-center">';
        html += '<i class="ph-bold ' + iconCls + ' text-xl"></i></div>';
        html += '<div>';
        html += '<p class="text-white font-semibold">' + esc(f.name) + '</p>';
        html += '<p class="text-xs text-slate-500 font-mono">' + esc(truncId(f.driveId)) + '</p>';
        html += '</div>';
        html += '<div class="ml-auto flex items-center gap-1">';
        html += '<button onclick="AUTOEDITORS_UI.openFolderModal(\'' + esc(f.name) + '\')" class="btn-ghost p-1.5" title="Edit"><i class="ph-bold ph-pencil-simple text-sm"></i></button>';
        html += '<button onclick="AUTOEDITORS_UI.confirmDeleteFolder(\'' + esc(f.name) + '\')" class="btn-ghost p-1.5 hover:!text-red-400" title="Delete"><i class="ph-bold ph-trash text-sm"></i></button>';
        html += '</div></div>';

        // File breakdown
        html += '<div class="space-y-3 mb-4">';
        html += '<div class="flex items-center justify-between text-sm"><span class="text-slate-400">Total Files</span><span class="font-mono text-white font-medium">' + total + '</span></div>';
        html += '<div class="flex items-center justify-between text-sm"><span class="text-slate-400">Unassigned</span><span class="font-mono text-amber-400">' + unassigned + '</span></div>';
        html += '<div class="flex items-center justify-between text-sm"><span class="text-slate-400">Assigned</span><span class="font-mono text-violet-400">' + assigned + '</span></div>';
        html += '<div class="flex items-center justify-between text-sm"><span class="text-slate-400">Completed</span><span class="font-mono text-emerald-400">' + completed + '</span></div>';
        html += '</div>';

        // Progress bar
        html += '<div class="h-2 rounded-full bg-slate-700 overflow-hidden mb-3">';
        html += '<div class="h-full rounded-full bg-emerald-500 transition-all duration-500" style="width: ' + pct + '%"></div></div>';

        // Footer: sync + last sync
        html += '<div class="flex items-center justify-between text-xs pt-3 border-t border-slate-700/50">';
        html += '<span class="text-slate-500 font-mono">Scanned ' + timeAgo(f.lastSync) + '</span>';
        html += '<button onclick="AUTOEDITORS_UI.syncFolder(\'' + esc(f.name) + '\', this)" class="text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors cursor-pointer">';
        html += '<i class="ph-bold ph-arrows-clockwise"></i>Sync Now</button>';
        html += '</div>';

        html += '</div>';
      }

      html += '</div>';
      el.innerHTML = html;
    },


    /* ---------------------------------------------------------
       renderLogsTable
       --------------------------------------------------------- */
    renderLogsTable: function(logs) {
      var el = document.getElementById('autoeditors-sub-logs');
      if (!el) return;

      var html = '';

      // Header
      html += '<div class="flex items-center justify-between mb-4">';
      html += '<h3 class="text-lg font-semibold text-white flex items-center gap-2">';
      html += '<i class="ph-bold ph-scroll text-violet-400"></i>Activity Log</h3>';
      html += '</div>';

      // Filter pills
      html += '<div class="flex gap-2 mb-5 flex-wrap">';
      var logFilters = [
        { key: 'all', label: 'All' },
        { key: 'assign', label: 'Assign' },
        { key: 'finish', label: 'Finish' },
        { key: 'sync', label: 'Sync' },
        { key: 'revoke', label: 'Revoke' },
        { key: 'error', label: 'Error' }
      ];
      for (var li = 0; li < logFilters.length; li++) {
        var lf = logFilters[li];
        var isActive = _state.logFilter === lf.key;
        var pillCls = isActive ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700 bg-slate-800 border border-slate-700/50';
        html += '<button class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer ' + pillCls + '" onclick="AUTOEDITORS_UI.filterLogs(\'' + lf.key + '\')">' + lf.label + '</button>';
      }
      html += '</div>';

      // Apply filter
      var filtered = _state.logFilter === 'all' ? logs : logs.filter(function(l) {
        return (l.action || '').toLowerCase() === _state.logFilter;
      });

      if (filtered.length === 0) {
        html += _emptyState('ph-scroll', 'No log entries', 'Logs will appear as the bot performs actions.');
        el.innerHTML = html;
        return;
      }

      // Table
      html += '<div class="bg-slate-800 rounded-xl border border-slate-700/50 overflow-hidden">';
      html += '<div class="overflow-x-auto">';
      html += '<table class="w-full text-sm">';
      html += '<thead><tr class="text-slate-500 text-xs uppercase tracking-wider border-b border-slate-700/50">';
      html += '<th class="text-left px-6 py-3 font-medium">Timestamp</th>';
      html += '<th class="text-left px-6 py-3 font-medium">Action</th>';
      html += '<th class="text-left px-6 py-3 font-medium">Editor</th>';
      html += '<th class="text-left px-6 py-3 font-medium">Video</th>';
      html += '<th class="text-left px-6 py-3 font-medium">Details</th>';
      html += '</tr></thead>';
      html += '<tbody class="divide-y divide-slate-700/30">';

      var actionBadges = {
        'assign': 'bg-violet-500/20 text-violet-400',
        'finish': 'bg-emerald-500/20 text-emerald-400',
        'sync': 'bg-violet-500/20 text-violet-400',
        'revoke': 'bg-red-500/20 text-red-400',
        'error': 'bg-red-500/20 text-red-400'
      };

      for (var ri = 0; ri < filtered.length; ri++) {
        var row = filtered[ri];
        var act = (row.action || '').toLowerCase();
        var badgeCls = actionBadges[act] || 'bg-slate-600/30 text-slate-400';
        var detCls = act === 'error' ? 'text-red-400/80' : 'text-slate-500';

        html += '<tr class="hover:bg-slate-700/20 transition-colors duration-200">';
        html += '<td class="px-6 py-3 font-mono text-slate-400 text-xs whitespace-nowrap">' + fmtDate(row.timestamp) + '</td>';
        html += '<td class="px-6 py-3"><span class="badge px-2 py-0.5 rounded-full text-xs font-medium ' + badgeCls + '">' + esc(row.action || '') + '</span></td>';
        html += '<td class="px-6 py-3 text-slate-300">' + (row.editor ? esc(row.editor) : '<span class="text-slate-500">&mdash;</span>') + '</td>';
        html += '<td class="px-6 py-3 font-mono text-xs">' + (row.video ? '<span class="' + (act === 'finish' || act === 'revoke' ? 'text-slate-400' : 'text-violet-400') + '">' + esc(row.video) + '</span>' : '<span class="text-slate-500">&mdash;</span>') + '</td>';
        html += '<td class="px-6 py-3 ' + detCls + ' text-xs">' + esc(row.details || '') + '</td>';
        html += '</tr>';
      }

      html += '</tbody></table></div></div>';
      el.innerHTML = html;
    },


    /* ---------------------------------------------------------
       renderConfigPanel
       --------------------------------------------------------- */
    renderConfigPanel: function(config) {
      var el = document.getElementById('autoeditors-sub-config');
      if (!el) return;

      var html = '';

      // Header
      html += '<div class="flex items-center justify-between mb-6">';
      html += '<h3 class="text-lg font-semibold text-white flex items-center gap-2">';
      html += '<i class="ph-bold ph-gear-six text-violet-400"></i>Autoeditors Configuration</h3>';
      html += '<button onclick="AUTOEDITORS_UI.saveConfig()" class="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer flex items-center gap-2">';
      html += '<i class="ph-bold ph-floppy-disk"></i>Save Changes</button>';
      html += '</div>';

      html += '<div class="space-y-3" id="autoeditors-config-items">';

      var items = [
        { key: 'SPREADSHEET_ID', label: 'SPREADSHEET_ID', desc: 'Google Sheets log spreadsheet', type: 'secret' },
        { key: 'TEST_MODE', label: 'TEST_MODE', desc: 'Run bot in test mode (no real Drive changes)', type: 'toggle' },
        { key: 'DRY_RUN', label: 'DRY_RUN', desc: 'Simulate actions without executing (logs only)', type: 'toggle' },
        { key: 'AUTO_ASSIGN_ON_SYNC', label: 'AUTO_ASSIGN_ON_SYNC', desc: 'Automatically assign new videos after sync', type: 'toggle' },
        { key: 'MAX_ACTIVE_VIDEOS_PER_EDITOR', label: 'MAX_ACTIVE_VIDEOS_PER_EDITOR', desc: 'Maximum concurrent videos per editor', type: 'number' },
        { key: 'MIN_FINISH_HOURS', label: 'MIN_FINISH_HOURS', desc: 'Minimum hours before flagging stale assignments', type: 'number' },
        { key: 'AUTO_SYNC_SECONDS', label: 'AUTO_SYNC_SECONDS', desc: 'Interval for automatic folder sync (seconds)', type: 'number' },
        { key: 'REVOKE_VIEWER_ON_FINISH', label: 'REVOKE_VIEWER_ON_FINISH', desc: 'Remove Drive viewer permissions when editor finishes', type: 'toggle' }
      ];

      for (var ci = 0; ci < items.length; ci++) {
        var item = items[ci];
        var val = config[item.key];
        if (val === undefined) val = '';

        html += '<div class="flex items-center justify-between bg-slate-800 rounded-lg p-4 border border-slate-700/50">';
        html += '<div>';
        html += '<div class="text-sm font-medium text-slate-300">' + esc(item.label) + '</div>';
        html += '<div class="text-xs text-slate-500 mt-0.5">' + esc(item.desc) + '</div>';
        html += '</div>';
        html += '<div class="flex items-center gap-3">';

        if (item.type === 'toggle') {
          var isOn = val === true || val === 'true';
          var valCls = isOn ? 'text-emerald-400' : 'text-red-400';
          html += '<span class="font-mono ' + valCls + ' text-sm" id="autoeditors-cfg-val-' + esc(item.key) + '">' + (isOn ? 'true' : 'false') + '</span>';
          var tCls = isOn ? 'bg-emerald-500' : 'bg-slate-600';
          var tDot = isOn ? 'left: 20px' : 'left: 2px';
          html += '<div class="relative">';
          html += '<button onclick="AUTOEDITORS_UI.toggleConfigItem(this, \'' + esc(item.key) + '\')" class="w-11 h-6 rounded-full ' + tCls + ' relative transition-colors duration-200 focus:outline-none cursor-pointer">';
          html += '<span class="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-200" style="' + tDot + '"></span>';
          html += '</button></div>';
        } else if (item.type === 'secret') {
          var masked = val ? (String(val).substring(0, 4) + '...' + String(val).substring(String(val).length - 4)) : 'not set';
          html += '<span class="font-mono text-violet-400 text-sm" id="autoeditors-cfg-val-' + esc(item.key) + '" data-full="' + esc(val) + '" data-masked="' + esc(masked) + '">' + esc(masked) + '</span>';
          html += '<button onclick="AUTOEDITORS_UI.toggleReveal(this, \'' + esc(item.key) + '\')" class="text-slate-400 hover:text-white hover:bg-slate-700 px-2 py-1 rounded-lg text-xs transition-colors duration-200 cursor-pointer flex items-center gap-1">';
          html += '<i class="ph-bold ph-eye text-sm"></i>Reveal</button>';
          html += '<button onclick="AUTOEDITORS_UI.editConfigInline(\'' + esc(item.key) + '\')" class="text-slate-400 hover:text-white hover:bg-slate-700 px-3 py-1.5 rounded-lg text-sm transition-colors duration-200 cursor-pointer flex items-center gap-1.5">';
          html += '<i class="ph-bold ph-pencil-simple"></i>Edit</button>';
        } else {
          html += '<span class="font-mono text-violet-400" id="autoeditors-cfg-val-' + esc(item.key) + '">' + esc(val) + '</span>';
          html += '<button onclick="AUTOEDITORS_UI.editConfigInline(\'' + esc(item.key) + '\')" class="text-slate-400 hover:text-white hover:bg-slate-700 px-3 py-1.5 rounded-lg text-sm transition-colors duration-200 cursor-pointer flex items-center gap-1.5">';
          html += '<i class="ph-bold ph-pencil-simple"></i>Edit</button>';
        }

        html += '</div></div>';
      }

      html += '</div>';
      el.innerHTML = html;
    },


    /* ---------------------------------------------------------
       Modal helpers
       --------------------------------------------------------- */
    openModal: function(name) {
      var modal = document.getElementById('autoeditors-modal-' + name);
      if (modal) modal.classList.remove('hidden');
    },

    closeModal: function(name) {
      var modal = document.getElementById('autoeditors-modal-' + name);
      if (modal) modal.classList.add('hidden');
    },


    /* ---------------------------------------------------------
       Toggle switch helper (used by modals)
       --------------------------------------------------------- */
    toggleSwitch: function(btn) {
      var isOn = btn.getAttribute('data-value') === 'true';
      var dot = btn.querySelector('span');
      if (isOn) {
        btn.setAttribute('data-value', 'false');
        btn.classList.remove('bg-emerald-500');
        btn.classList.add('bg-slate-600');
        dot.style.left = '2px';
      } else {
        btn.setAttribute('data-value', 'true');
        btn.classList.remove('bg-slate-600');
        btn.classList.add('bg-emerald-500');
        dot.style.left = '20px';
      }
    },


    /* ---------------------------------------------------------
       Editor CRUD
       --------------------------------------------------------- */
    openEditorModal: function(editorId) {
      var titleEl = document.getElementById('autoeditors-modal-editor-title');
      var idField = document.getElementById('autoeditors-editor-id');
      var nameField = document.getElementById('autoeditors-editor-name');
      var handleField = document.getElementById('autoeditors-editor-tg-handle');
      var tgIdField = document.getElementById('autoeditors-editor-tg-id');
      var emailField = document.getElementById('autoeditors-editor-email');
      var enabledToggle = document.getElementById('autoeditors-editor-enabled-toggle');
      var maxActiveField = document.getElementById('autoeditors-editor-max-active');

      if (editorId) {
        // Edit mode
        var ed = _state.editors.find(function(e) { return e.editor_id === editorId; });
        if (!ed) return;
        titleEl.innerHTML = '<i class="ph-bold ph-pencil-simple text-violet-400"></i> Edit Editor';
        idField.value = ed.editor_id;
        nameField.value = ed.name || '';
        handleField.value = (ed.tg_username || '').replace(/^@/, '');
        tgIdField.value = ed.tg_user_id || '';
        emailField.value = ed.viewer_email || '';
        maxActiveField.value = ed.max_active || 3;

        // Set enabled toggle
        var isOn = ed.enabled !== false;
        enabledToggle.setAttribute('data-value', isOn ? 'true' : 'false');
        enabledToggle.classList.toggle('bg-emerald-500', isOn);
        enabledToggle.classList.toggle('bg-slate-600', !isOn);
        var dot = enabledToggle.querySelector('span');
        dot.style.left = isOn ? '20px' : '2px';

        // Set source folders
        _populateSourceCheckboxes(ed.allowed_sources || []);
      } else {
        // Add mode
        titleEl.innerHTML = '<i class="ph-bold ph-user-plus text-violet-400"></i> Add Editor';
        idField.value = '';
        nameField.value = '';
        handleField.value = '';
        tgIdField.value = '';
        emailField.value = '';
        maxActiveField.value = 3;

        enabledToggle.setAttribute('data-value', 'true');
        enabledToggle.classList.add('bg-emerald-500');
        enabledToggle.classList.remove('bg-slate-600');
        var addDot = enabledToggle.querySelector('span');
        addDot.style.left = '20px';

        _populateSourceCheckboxes([]);
      }

      this.openModal('editor');
    },

    submitEditor: function(event) {
      event.preventDefault();
      var self = this;

      var editorId = document.getElementById('autoeditors-editor-id').value;
      var name = document.getElementById('autoeditors-editor-name').value.trim();
      var handle = document.getElementById('autoeditors-editor-tg-handle').value.trim().replace(/^@/, '');
      var tgId = document.getElementById('autoeditors-editor-tg-id').value.trim();
      var email = document.getElementById('autoeditors-editor-email').value.trim();
      var enabled = document.getElementById('autoeditors-editor-enabled-toggle').getAttribute('data-value') === 'true';
      var maxActive = parseInt(document.getElementById('autoeditors-editor-max-active').value, 10) || 3;

      // Collect selected sources
      var sourceCheckboxes = document.querySelectorAll('#autoeditors-editor-sources-list input[type="checkbox"]:checked');
      var sources = [];
      sourceCheckboxes.forEach(function(cb) { sources.push(cb.value); });

      // Sanitize
      if (!name) { showToast('Display name is required', 'error'); return; }
      if (!handle) { showToast('Telegram handle is required', 'error'); return; }

      var payload = {
        name: name,
        tg_username: '@' + handle,
        tg_user_id: tgId ? parseInt(tgId, 10) : null,
        viewer_email: email,
        enabled: enabled,
        max_active: maxActive,
        allowed_sources: sources
      };

      var promise;
      if (editorId) {
        payload.editor_id = editorId;
        promise = API.autoeditors.updateEditor(payload);
      } else {
        promise = API.autoeditors.createEditor(payload);
      }

      promise.then(function() {
        showToast(editorId ? 'Editor updated' : 'Editor created', 'success');
        self.closeModal('editor');
        return API.autoeditors.getEditors();
      }).then(function(eds) {
        _state.editors = eds || [];
        self.renderEditorsGrid(_state.editors);
        self.renderDashboard(self._computeStats());
      }).catch(function(err) {
        showToast('Failed to save editor: ' + (err.message || err), 'error');
      });
    },

    toggleEditor: function(editorId, btn) {
      var ed = _state.editors.find(function(e) { return e.editor_id === editorId; });
      if (!ed) return;

      var isOn = btn.classList.contains('bg-emerald-500');
      var dot = btn.querySelector('span');

      if (isOn) {
        btn.classList.remove('bg-emerald-500');
        btn.classList.add('bg-slate-600');
        dot.style.left = '2px';
        btn.title = 'Disabled';
      } else {
        btn.classList.remove('bg-slate-600');
        btn.classList.add('bg-emerald-500');
        dot.style.left = '18px';
        btn.title = 'Enabled';
      }

      ed.enabled = !isOn;
      API.autoeditors.updateEditor({ editor_id: editorId, enabled: !isOn }).then(function() {
        showToast('Editor ' + (isOn ? 'disabled' : 'enabled'), 'info');
      }).catch(function(err) {
        showToast('Failed to update editor', 'error');
        // Revert
        ed.enabled = isOn;
      });
    },

    confirmDeleteEditor: function(editorId, editorName) {
      document.getElementById('autoeditors-confirm-title').textContent = 'Delete Editor';
      document.getElementById('autoeditors-confirm-message').textContent = 'Delete "' + editorName + '"? Active assignments will be unassigned.';
      _state.pendingConfirmAction = function() {
        AUTOEDITORS_UI._deleteEditor(editorId);
      };
      this.openModal('confirm');
    },

    _deleteEditor: function(editorId) {
      var self = this;
      API.autoeditors.deleteEditor(editorId).then(function() {
        showToast('Editor deleted', 'success');
        self.closeModal('confirm');
        _state.editors = _state.editors.filter(function(e) { return e.editor_id !== editorId; });
        self.renderEditorsGrid(_state.editors);
        self.renderDashboard(self._computeStats());
      }).catch(function(err) {
        showToast('Failed to delete editor: ' + (err.message || err), 'error');
      });
    },

    quickAssign: function(editorId) {
      // Pre-select editor in assignment modal
      this.openAssignmentModal();
      setTimeout(function() {
        var sel = document.getElementById('autoeditors-assign-editor');
        if (sel) sel.value = editorId;
      }, 50);
    },


    /* ---------------------------------------------------------
       Folder CRUD
       --------------------------------------------------------- */
    openFolderModal: function(folderKey) {
      var titleEl = document.getElementById('autoeditors-modal-folder-title');
      var keyField = document.getElementById('autoeditors-folder-edit-key');
      var nameField = document.getElementById('autoeditors-folder-name');
      var driveIdField = document.getElementById('autoeditors-folder-drive-id');
      var typeField = document.getElementById('autoeditors-folder-type');
      var syncToggle = document.getElementById('autoeditors-folder-sync-toggle');
      var intervalField = document.getElementById('autoeditors-folder-sync-interval');

      if (folderKey) {
        var folder = _state.folders.find(function(f) { return f.name === folderKey; });
        if (!folder) return;
        titleEl.innerHTML = '<i class="ph-bold ph-pencil-simple text-violet-400"></i> Edit Folder';
        keyField.value = folder.name;
        nameField.value = folder.name;
        driveIdField.value = folder.driveId || '';
        typeField.value = folder.type || 'raw';
        intervalField.value = folder.syncInterval || 30;

        var syncOn = folder.autoSync !== false;
        syncToggle.setAttribute('data-value', syncOn ? 'true' : 'false');
        syncToggle.classList.toggle('bg-emerald-500', syncOn);
        syncToggle.classList.toggle('bg-slate-600', !syncOn);
        var dot = syncToggle.querySelector('span');
        dot.style.left = syncOn ? '20px' : '2px';
      } else {
        titleEl.innerHTML = '<i class="ph-bold ph-folder-plus text-violet-400"></i> Add Folder';
        keyField.value = '';
        nameField.value = '';
        driveIdField.value = '';
        typeField.value = 'raw';
        intervalField.value = 30;

        syncToggle.setAttribute('data-value', 'true');
        syncToggle.classList.add('bg-emerald-500');
        syncToggle.classList.remove('bg-slate-600');
        var addDot = syncToggle.querySelector('span');
        addDot.style.left = '20px';
      }

      // Auto-extract Drive ID from pasted URL
      driveIdField.addEventListener('paste', function(e) {
        setTimeout(function() {
          driveIdField.value = extractDriveId(driveIdField.value);
        }, 10);
      });

      this.openModal('folder');
    },

    submitFolder: function(event) {
      event.preventDefault();
      var self = this;

      var editKey = document.getElementById('autoeditors-folder-edit-key').value;
      var name = document.getElementById('autoeditors-folder-name').value.trim();
      var driveId = extractDriveId(document.getElementById('autoeditors-folder-drive-id').value);
      var type = document.getElementById('autoeditors-folder-type').value;
      var autoSync = document.getElementById('autoeditors-folder-sync-toggle').getAttribute('data-value') === 'true';
      var interval = parseInt(document.getElementById('autoeditors-folder-sync-interval').value, 10) || 30;

      if (!name) { showToast('Folder name is required', 'error'); return; }
      if (!driveId) { showToast('Google Drive Folder ID is required', 'error'); return; }

      var payload = {
        name: name,
        driveId: driveId,
        type: type,
        autoSync: autoSync,
        syncInterval: interval
      };

      var promise;
      if (editKey) {
        payload.originalName = editKey;
        promise = API.autoeditors.updateFolder(payload);
      } else {
        promise = API.autoeditors.createFolder(payload);
      }

      promise.then(function() {
        showToast(editKey ? 'Folder updated' : 'Folder added', 'success');
        self.closeModal('folder');
        return API.autoeditors.getFolders();
      }).then(function(folders) {
        _state.folders = folders || [];
        self.renderFoldersGrid(_state.folders);
        self.renderDashboard(self._computeStats());
      }).catch(function(err) {
        showToast('Failed to save folder: ' + (err.message || err), 'error');
      });
    },

    confirmDeleteFolder: function(folderName) {
      document.getElementById('autoeditors-confirm-title').textContent = 'Delete Folder';
      document.getElementById('autoeditors-confirm-message').textContent = 'Remove "' + folderName + '"? This will NOT delete files from Google Drive.';
      _state.pendingConfirmAction = function() {
        AUTOEDITORS_UI._deleteFolder(folderName);
      };
      this.openModal('confirm');
    },

    _deleteFolder: function(folderName) {
      var self = this;
      API.autoeditors.deleteFolder(folderName).then(function() {
        showToast('Folder removed', 'success');
        self.closeModal('confirm');
        _state.folders = _state.folders.filter(function(f) { return f.name !== folderName; });
        self.renderFoldersGrid(_state.folders);
        self.renderDashboard(self._computeStats());
      }).catch(function(err) {
        showToast('Failed to remove folder: ' + (err.message || err), 'error');
      });
    },

    syncFolder: function(folderName, btn) {
      var icon = btn ? btn.querySelector('i') : null;
      if (icon) icon.classList.add('animate-spin');

      API.autoeditors.syncFolder(folderName).then(function() {
        showToast('Folder "' + folderName + '" synced', 'success');
        return API.autoeditors.getFolders();
      }).then(function(folders) {
        _state.folders = folders || [];
        AUTOEDITORS_UI.renderFoldersGrid(_state.folders);
      }).catch(function(err) {
        showToast('Sync failed: ' + (err.message || err), 'error');
      }).finally(function() {
        if (icon) icon.classList.remove('animate-spin');
      });
    },

    syncAllFolders: function() {
      var btn = document.getElementById('autoeditors-sync-all-btn');
      var icon = btn ? btn.querySelector('i') : null;
      if (icon) icon.classList.add('animate-spin');

      API.autoeditors.syncAllFolders().then(function() {
        showToast('All folders synced', 'success');
        return API.autoeditors.getFolders();
      }).then(function(folders) {
        _state.folders = folders || [];
        AUTOEDITORS_UI.renderFoldersGrid(_state.folders);
        AUTOEDITORS_UI.renderDashboard(AUTOEDITORS_UI._computeStats());
      }).catch(function(err) {
        showToast('Sync failed: ' + (err.message || err), 'error');
      }).finally(function() {
        if (icon) icon.classList.remove('animate-spin');
      });
    },


    /* ---------------------------------------------------------
       Assignment CRUD
       --------------------------------------------------------- */
    openAssignmentModal: function() {
      var fileSel = document.getElementById('autoeditors-assign-file');
      var editorSel = document.getElementById('autoeditors-assign-editor');

      // Populate files
      fileSel.innerHTML = '<option value="">-- Select unassigned file --</option>';
      var files = _state.unassignedFiles || [];
      for (var i = 0; i < files.length; i++) {
        var file = files[i];
        var opt = document.createElement('option');
        opt.value = file.file_id || file.id || '';
        opt.textContent = (file.video_name || file.name || '') + ' (' + (file.source || '') + ')';
        fileSel.appendChild(opt);
      }

      // Populate editors
      editorSel.innerHTML = '<option value="">-- Select editor --</option>';
      for (var j = 0; j < _state.editors.length; j++) {
        var ed = _state.editors[j];
        if (!ed.enabled) continue;
        var activeCount = _editorActiveCount(ed);
        var maxLabel = ed.max_active || 3;
        var opt2 = document.createElement('option');
        opt2.value = ed.editor_id;
        opt2.textContent = ed.name + ' (@' + (ed.tg_username || '').replace(/^@/, '') + ') - ' + activeCount + '/' + maxLabel + ' active';
        editorSel.appendChild(opt2);
      }

      // Reset priority
      this.setPriority('normal');
      document.getElementById('autoeditors-assign-notes').value = '';

      this.openModal('assignment');
    },

    setPriority: function(level) {
      _state.selectedPriority = level;
      document.getElementById('autoeditors-assign-priority-value').value = level;
      var btns = document.querySelectorAll('#autoeditors-assign-priority-group button');
      btns.forEach(function(b) {
        if (b.getAttribute('data-priority') === level) {
          b.className = 'px-4 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer bg-violet-600 text-white';
        } else {
          b.className = 'px-4 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer text-slate-400 bg-slate-900/60 border border-slate-600/50 hover:border-slate-500';
        }
      });
    },

    submitAssignment: function(event) {
      event.preventDefault();
      var self = this;

      var fileId = document.getElementById('autoeditors-assign-file').value;
      var editorId = document.getElementById('autoeditors-assign-editor').value;
      var priority = document.getElementById('autoeditors-assign-priority-value').value;
      var notes = document.getElementById('autoeditors-assign-notes').value.trim();

      if (!fileId) { showToast('Please select a file', 'error'); return; }
      if (!editorId) { showToast('Please select an editor', 'error'); return; }

      var payload = {
        file_id: fileId,
        editor_id: editorId,
        priority: priority,
        notes: notes
      };

      API.autoeditors.createAssignment(payload).then(function() {
        showToast('Assignment created', 'success');
        self.closeModal('assignment');
        return Promise.all([
          API.autoeditors.getAssignments(),
          API.autoeditors.getUnassignedFiles(),
          API.autoeditors.getEditors()
        ]);
      }).then(function(results) {
        _state.assignments = results[0] || [];
        _state.unassignedFiles = results[1] || [];
        _state.editors = results[2] || [];
        self.renderAssignmentsTable(_state.assignments);
        self.renderEditorsGrid(_state.editors);
        self.renderDashboard(self._computeStats());
      }).catch(function(err) {
        showToast('Failed to create assignment: ' + (err.message || err), 'error');
      });
    },


    /* ---------------------------------------------------------
       Assignment filters
       --------------------------------------------------------- */
    filterAssignments: function(status) {
      _state.assignmentFilter = status;
      this.renderAssignmentsTable(_state.assignments);
    },

    filterAssignmentsByEditor: function(editorId) {
      _state.assignmentEditorFilter = editorId;
      this.renderAssignmentsTable(_state.assignments);
    },

    filterAssignmentsByDate: function(range) {
      _state.assignmentDateFilter = range;
      this.renderAssignmentsTable(_state.assignments);
    },

    searchAssignments: function(query) {
      _state.assignmentSearch = query;
      this.renderAssignmentsTable(_state.assignments);
    },


    /* ---------------------------------------------------------
       Log filters
       --------------------------------------------------------- */
    filterLogs: function(action) {
      _state.logFilter = action;
      this.renderLogsTable(_state.logs);
    },


    /* ---------------------------------------------------------
       Config actions
       --------------------------------------------------------- */
    toggleConfigItem: function(btn, key) {
      var label = document.getElementById('autoeditors-cfg-val-' + key);
      var isOn = btn.classList.contains('bg-emerald-500');
      btn.classList.toggle('bg-emerald-500', !isOn);
      btn.classList.toggle('bg-slate-600', isOn);
      var dot = btn.querySelector('span');
      if (isOn) {
        dot.style.left = '2px';
        label.textContent = 'false';
        label.classList.remove('text-emerald-400');
        label.classList.add('text-red-400');
        _state.config[key] = false;
      } else {
        dot.style.left = '20px';
        label.textContent = 'true';
        label.classList.remove('text-red-400');
        label.classList.add('text-emerald-400');
        _state.config[key] = true;
      }
    },

    editConfigInline: function(key) {
      var el = document.getElementById('autoeditors-cfg-val-' + key);
      if (!el) return;
      var current = el.getAttribute('data-full') || el.textContent;
      var input = document.createElement('input');
      input.type = 'text';
      input.value = current;
      input.className = 'bg-slate-700 text-violet-400 font-mono px-2 py-1 rounded text-sm w-48 border border-violet-500/50 focus:outline-none';
      input.onblur = function() {
        var newVal = input.value.trim();
        el.textContent = el.getAttribute('data-masked') ? (newVal.substring(0, 4) + '...' + newVal.substring(newVal.length - 4)) : newVal;
        if (el.getAttribute('data-full') !== null) el.setAttribute('data-full', newVal);
        if (el.getAttribute('data-masked') !== null) el.setAttribute('data-masked', newVal.substring(0, 4) + '...' + newVal.substring(newVal.length - 4));
        el.style.display = '';
        input.remove();
        // Check if value is numeric
        var numVal = parseFloat(newVal);
        _state.config[key] = isNaN(numVal) ? newVal : numVal;
      };
      input.onkeydown = function(e) {
        if (e.key === 'Enter') input.blur();
        if (e.key === 'Escape') { el.style.display = ''; input.remove(); }
      };
      el.style.display = 'none';
      el.parentNode.insertBefore(input, el);
      input.focus();
      input.select();
    },

    toggleReveal: function(btn, key) {
      var el = document.getElementById('autoeditors-cfg-val-' + key);
      if (!el) return;
      var isMasked = el.textContent === el.getAttribute('data-masked');
      if (isMasked) {
        el.textContent = el.getAttribute('data-full');
        btn.innerHTML = '<i class="ph-bold ph-eye-slash text-sm"></i>Hide';
      } else {
        el.textContent = el.getAttribute('data-masked');
        btn.innerHTML = '<i class="ph-bold ph-eye text-sm"></i>Reveal';
      }
    },

    saveConfig: function() {
      API.autoeditors.setConfig(_state.config).then(function() {
        showToast('Configuration saved', 'success');
      }).catch(function(err) {
        showToast('Failed to save config: ' + (err.message || err), 'error');
      });
    },


    /* ---------------------------------------------------------
       Confirm dialog executor
       --------------------------------------------------------- */
    executeConfirmedAction: function() {
      if (typeof _state.pendingConfirmAction === 'function') {
        _state.pendingConfirmAction();
        _state.pendingConfirmAction = null;
      }
    }

  }; // end AUTOEDITORS_UI


  /* ===========================================================
     Private helper functions
     =========================================================== */

  function _statCard(label, value, subtitle, icon, color) {
    var iconBg = 'bg-' + color + '-500/10';
    var iconText = 'text-' + color + '-400';
    var html = '<div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">';
    html += '<div class="flex items-center justify-between mb-3">';
    html += '<span class="text-sm text-slate-400">' + esc(label) + '</span>';
    html += '<div class="w-9 h-9 ' + iconBg + ' rounded-lg flex items-center justify-center">';
    html += '<i class="ph-bold ' + icon + ' ' + iconText + ' text-lg"></i></div></div>';
    html += '<p class="text-3xl font-bold text-white">' + value + '</p>';
    if (subtitle) {
      html += '<p class="text-xs text-slate-500 mt-1">' + esc(subtitle) + '</p>';
    }
    html += '</div>';
    return html;
  }

  function _activityRow(log) {
    var actionIcons = {
      'assign': { icon: 'ph-user-plus', bg: 'bg-violet-500/10', color: 'text-violet-400' },
      'finish': { icon: 'ph-check-circle', bg: 'bg-emerald-500/10', color: 'text-emerald-400' },
      'sync': { icon: 'ph-arrows-clockwise', bg: 'bg-violet-500/10', color: 'text-violet-400' },
      'revoke': { icon: 'ph-shield-slash', bg: 'bg-red-500/10', color: 'text-red-400' },
      'error': { icon: 'ph-warning-circle', bg: 'bg-red-500/10', color: 'text-red-400' }
    };
    var act = (log.action || '').toLowerCase();
    var ai = actionIcons[act] || actionIcons['assign'];

    var html = '<div class="px-6 py-3.5 flex items-center gap-4 hover:bg-slate-800/50 transition-colors duration-200">';
    html += '<div class="w-8 h-8 rounded-lg ' + ai.bg + ' flex items-center justify-center flex-shrink-0">';
    html += '<i class="ph-bold ' + ai.icon + ' ' + ai.color + ' text-sm"></i></div>';
    html += '<div class="flex-1 min-w-0">';
    html += '<p class="text-sm text-slate-300">' + esc(log.details || log.action || '') + '</p>';
    if (log.video) {
      html += '<p class="text-xs text-slate-500">' + esc(log.video) + '</p>';
    }
    html += '</div>';
    html += '<span class="text-xs text-slate-500 font-mono flex-shrink-0">' + timeAgo(log.timestamp) + '</span>';
    html += '</div>';
    return html;
  }

  function _emptyState(icon, title, desc) {
    var html = '<div class="flex flex-col items-center justify-center py-16 text-center">';
    html += '<div class="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4 border border-slate-700/50">';
    html += '<i class="ph-bold ' + icon + ' text-slate-500 text-2xl"></i></div>';
    html += '<p class="text-white font-medium mb-1">' + esc(title) + '</p>';
    html += '<p class="text-sm text-slate-500 max-w-xs">' + esc(desc) + '</p>';
    html += '</div>';
    return html;
  }

  function _editorActiveCount(ed) {
    var count = 0;
    for (var i = 0; i < _state.assignments.length; i++) {
      var a = _state.assignments[i];
      var s = (a.status || '').toUpperCase();
      var editorMatch = a.editor_id === ed.editor_id || a.editor === ('@' + (ed.tg_username || '').replace(/^@/, ''));
      if (editorMatch && (s === 'ASSIGNED' || s === 'PREVIEW' || s === 'ACTIVE')) count++;
    }
    return count;
  }

  function _editorCurrentAssignment(ed) {
    for (var i = 0; i < _state.assignments.length; i++) {
      var a = _state.assignments[i];
      var s = (a.status || '').toUpperCase();
      var editorMatch = a.editor_id === ed.editor_id || a.editor === ('@' + (ed.tg_username || '').replace(/^@/, ''));
      if (editorMatch && (s === 'ASSIGNED' || s === 'PREVIEW' || s === 'ACTIVE')) return a;
    }
    return null;
  }

  function _editorStats(ed) {
    var completed = 0, active = 0, queued = 0;
    for (var i = 0; i < _state.assignments.length; i++) {
      var a = _state.assignments[i];
      var editorMatch = a.editor_id === ed.editor_id || a.editor === ('@' + (ed.tg_username || '').replace(/^@/, ''));
      if (!editorMatch) continue;
      var s = (a.status || '').toUpperCase();
      if (s === 'DONE' || s === 'COMPLETED') completed++;
      else if (s === 'ASSIGNED' || s === 'PREVIEW' || s === 'ACTIVE') active++;
      else if (s === 'NEW' || s === 'QUEUED') queued++;
    }
    return { completed: completed, active: active, queued: queued };
  }

  function _filterAssignments(data) {
    var result = data;

    // Status filter
    if (_state.assignmentFilter !== 'all') {
      result = result.filter(function(a) {
        var s = (a.status || '').toUpperCase();
        switch (_state.assignmentFilter) {
          case 'active': return s === 'ASSIGNED' || s === 'PREVIEW' || s === 'ACTIVE';
          case 'queued': return s === 'NEW' || s === 'QUEUED';
          case 'done': return s === 'DONE' || s === 'COMPLETED';
          case 'error': return s === 'ERROR' || s === 'FAILED';
          default: return true;
        }
      });
    }

    // Editor filter
    if (_state.assignmentEditorFilter) {
      var edId = _state.assignmentEditorFilter;
      var matchEd = _state.editors.find(function(e) { return e.editor_id === edId; });
      result = result.filter(function(a) {
        return a.editor_id === edId || (matchEd && a.editor === ('@' + (matchEd.tg_username || '').replace(/^@/, '')));
      });
    }

    // Date filter
    if (_state.assignmentDateFilter !== 'all') {
      var now = new Date();
      var cutoff;
      switch (_state.assignmentDateFilter) {
        case 'today':
          cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          cutoff = new Date(now.getTime() - 7 * 86400000);
          break;
        case 'month':
          cutoff = new Date(now.getTime() - 30 * 86400000);
          break;
      }
      if (cutoff) {
        result = result.filter(function(a) {
          var d = a.assigned_at ? new Date(a.assigned_at) : (a.created_at ? new Date(a.created_at) : null);
          return d && d >= cutoff;
        });
      }
    }

    // Text search
    if (_state.assignmentSearch) {
      var q = _state.assignmentSearch.toLowerCase();
      result = result.filter(function(a) {
        return (a.video_name || '').toLowerCase().indexOf(q) > -1;
      });
    }

    return result;
  }

  function _populateSourceCheckboxes(selected) {
    var container = document.getElementById('autoeditors-editor-sources-list');
    if (!container) return;
    container.innerHTML = '';

    if (_state.folders.length === 0) {
      container.innerHTML = '<span class="text-xs text-slate-600 italic">No folders configured</span>';
      return;
    }

    for (var i = 0; i < _state.folders.length; i++) {
      var f = _state.folders[i];
      var checked = selected.indexOf(f.name) > -1;
      var label = document.createElement('label');
      label.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-lg cursor-pointer transition-colors ' + (checked ? 'bg-violet-500/20 border border-violet-500/40' : 'bg-slate-700/50 border border-slate-600/40 hover:border-slate-500/50');

      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = f.name;
      cb.checked = checked;
      cb.className = 'sr-only';
      cb.onchange = function() {
        var parent = this.parentNode;
        if (this.checked) {
          parent.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-lg cursor-pointer transition-colors bg-violet-500/20 border border-violet-500/40';
        } else {
          parent.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-lg cursor-pointer transition-colors bg-slate-700/50 border border-slate-600/40 hover:border-slate-500/50';
        }
      };

      var icon = document.createElement('i');
      icon.className = 'ph-bold ' + (checked ? 'ph-check-square text-violet-400' : 'ph-square text-slate-500') + ' text-sm';
      cb.addEventListener('change', (function(iconEl) {
        return function() {
          if (this.checked) {
            iconEl.className = 'ph-bold ph-check-square text-violet-400 text-sm';
          } else {
            iconEl.className = 'ph-bold ph-square text-slate-500 text-sm';
          }
        };
      })(icon));

      var span = document.createElement('span');
      span.className = 'text-xs text-slate-300';
      span.textContent = f.name;

      label.appendChild(cb);
      label.appendChild(icon);
      label.appendChild(span);
      container.appendChild(label);
    }
  }

})();
