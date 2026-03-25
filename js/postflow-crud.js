/**
 * POSTFLOW_UI -- Dynamic rendering, CRUD modals, slide-over, config editing, alert management.
 * Depends on: API.postflow.*, SECURITY.sanitize(), TOAST.show(), AUTH (for role checks).
 */
const POSTFLOW_UI = {

  /* ----------------------------------------------------------------
     Internal state
     ---------------------------------------------------------------- */
  _batchTimeTags: [],
  _deleteCallback: null,
  _cachedBatches: [],

  /* ================================================================
     PLATFORM ICON MAP
     ================================================================ */
  PLATFORM_ICONS: {
    instagram: { icon: 'ph-instagram-logo', color: 'text-pink-400',   label: 'Instagram' },
    x:         { icon: 'ph-x-logo',         color: 'text-slate-200',  label: 'X' },
    facebook:  { icon: 'ph-facebook-logo',  color: 'text-blue-400',   label: 'Facebook' },
    reddit:    { icon: 'ph-reddit-logo',    color: 'text-orange-400', label: 'Reddit' },
    threads:   { icon: 'ph-threads-logo',   color: 'text-slate-300',  label: 'Threads' },
    snapchat:  { icon: 'ph-snapchat-logo',  color: 'text-yellow-400', label: 'Snapchat' }
  },

  /* ================================================================
     SANITIZE HELPER -- wraps SECURITY.sanitize if available
     ================================================================ */
  _s: function(val) {
    if (typeof val !== 'string') val = String(val == null ? '' : val);
    if (typeof SECURITY !== 'undefined' && SECURITY.sanitize) return SECURITY.sanitize(val);
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(val));
    return d.innerHTML;
  },

  /* ================================================================
     EMPTY STATE HELPER
     ================================================================ */
  _emptyState: function(icon, title, subtitle, btnLabel, btnAction) {
    return '<div class="flex flex-col items-center justify-center py-16 text-center">' +
      '<div class="w-16 h-16 bg-slate-700/30 rounded-2xl flex items-center justify-center mb-4">' +
        '<i class="ph-bold ' + icon + ' text-slate-600 text-3xl"></i>' +
      '</div>' +
      '<p class="text-slate-400 font-medium mb-1">' + title + '</p>' +
      '<p class="text-slate-600 text-sm mb-5">' + subtitle + '</p>' +
      (btnLabel ? '<button onclick="' + btnAction + '" class="px-4 py-2 rounded-lg text-sm font-medium bg-cyan-600 hover:bg-cyan-500 text-white transition-colors cursor-pointer flex items-center gap-2">' +
        '<i class="ph-bold ph-plus"></i> ' + btnLabel + '</button>' : '') +
    '</div>';
  },

  /* ================================================================
     STATUS BADGE HELPER
     ================================================================ */
  _statusBadge: function(status) {
    var map = {
      done:      'bg-emerald-500/20 text-emerald-400',
      ok:        'bg-emerald-500/20 text-emerald-400',
      running:   'bg-cyan-500/20 text-cyan-400',
      error:     'bg-red-500/20 text-red-400',
      failed:    'bg-red-500/20 text-red-400',
      active:    'bg-emerald-500/20 text-emerald-400',
      paused:    'bg-amber-500/20 text-amber-400',
      disabled:  'bg-slate-600/30 text-slate-400',
      scheduled: 'bg-cyan-500/20 text-cyan-400',
      manual:    'bg-slate-600/30 text-slate-400',
      test:      'bg-violet-500/20 text-violet-400',
      critical:  'bg-red-500/20 text-red-400',
      warning:   'bg-amber-500/20 text-amber-400',
      info:      'bg-cyan-500/20 text-cyan-400',
      sent:      'bg-emerald-500/20 text-emerald-400',
      skipped:   'bg-slate-600/30 text-slate-400'
    };
    var cls = map[(status || '').toLowerCase()] || 'bg-slate-600/30 text-slate-400';
    return '<span class="px-2 py-0.5 rounded-full text-xs font-medium ' + cls + '">' + this._s(status) + '</span>';
  },

  /* ================================================================
     1. RENDER: DASHBOARD
     ================================================================ */
  renderDashboard: function(stats) {
    var el = document.getElementById('postflow-sub-dashboard');
    if (!el) return;
    if (!stats) { el.innerHTML = this._emptyState('ph-chart-pie-slice', 'No dashboard data', 'Waiting for first pipeline run...', '', ''); return; }

    var s = this._s.bind(this);
    var html = '';

    // Stat cards
    html += '<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">';
    var cards = [
      { label: 'Total Videos',   val: stats.totalVideos,   icon: 'ph-video-camera',    iconBg: 'bg-cyan-500/10',    iconColor: 'text-cyan-400',    sub: 'Across all tiers' },
      { label: 'Active Targets', val: stats.activeTargets, icon: 'ph-crosshair',       iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-400', sub: 'Channels & groups' },
      { label: 'Success Rate',   val: stats.successRate,   icon: 'ph-chart-line-up',   iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-400', sub: null, isPercent: true },
      { label: 'Quarantined',    val: stats.quarantined,   icon: 'ph-shield-warning',  iconBg: 'bg-red-500/10',     iconColor: 'text-red-400',     sub: 'Requires review' }
    ];
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      html += '<div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">';
      html += '<div class="flex items-center justify-between mb-3">';
      html += '<span class="text-sm text-slate-400">' + s(c.label) + '</span>';
      html += '<div class="w-9 h-9 ' + c.iconBg + ' rounded-lg flex items-center justify-center"><i class="ph-bold ' + c.icon + ' ' + c.iconColor + ' text-lg"></i></div>';
      html += '</div>';
      html += '<p class="text-3xl font-bold text-white font-mono">' + s(c.isPercent ? c.val + '%' : c.val) + '</p>';
      if (c.isPercent) {
        html += '<div class="h-2 rounded-full bg-slate-700 overflow-hidden mt-2"><div class="h-full rounded-full bg-emerald-500" style="width:' + Math.min(parseFloat(c.val) || 0, 100) + '%"></div></div>';
      } else if (c.sub) {
        html += '<p class="text-xs text-slate-500 mt-1">' + s(c.sub) + '</p>';
      }
      html += '</div>';
    }
    html += '</div>';

    // Inventory by Tier
    if (stats.inventory && stats.inventory.length) {
      html += '<div class="bg-slate-800 rounded-xl border border-slate-700/50 mb-8">';
      html += '<div class="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">';
      html += '<h2 class="text-white font-semibold text-sm flex items-center gap-2"><i class="ph-bold ph-package text-cyan-400"></i>Inventory by Tier</h2>';
      html += '<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-400">' + s(stats.inventory.length) + ' tiers</span>';
      html += '</div><div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="text-slate-500 text-xs uppercase tracking-wider border-b border-slate-700/50">';
      html += '<th class="text-left px-6 py-3 font-medium">Tier</th><th class="text-right px-6 py-3 font-medium">Unused</th><th class="text-right px-6 py-3 font-medium">Reserved</th><th class="text-right px-6 py-3 font-medium">Burned</th><th class="text-right px-6 py-3 font-medium">Total</th></tr></thead><tbody>';
      for (var t = 0; t < stats.inventory.length; t++) {
        var tier = stats.inventory[t];
        var isEmpty = (tier.total || 0) === 0;
        html += '<tr class="border-b border-slate-700/50 hover:bg-slate-800/50">';
        html += '<td class="px-6 py-3 font-medium ' + (isEmpty ? 'text-slate-500' : 'text-white') + '">' + s(tier.name) + '</td>';
        html += '<td class="px-6 py-3 text-right font-mono ' + (isEmpty ? 'text-slate-600' : 'text-emerald-400') + '">' + s(tier.unused) + '</td>';
        html += '<td class="px-6 py-3 text-right font-mono ' + (isEmpty ? 'text-slate-600' : 'text-amber-400') + '">' + s(tier.reserved) + '</td>';
        html += '<td class="px-6 py-3 text-right font-mono ' + (isEmpty ? 'text-slate-600' : 'text-red-400') + '">' + s(tier.burned) + '</td>';
        html += '<td class="px-6 py-3 text-right font-medium font-mono ' + (isEmpty ? 'text-slate-500' : 'text-white') + '">' + s(tier.total) + '</td>';
        html += '</tr>';
      }
      html += '</tbody></table></div></div>';
    }

    // Recent Runs mini-table
    if (stats.recentRuns && stats.recentRuns.length) {
      html += '<div class="bg-slate-800 rounded-xl border border-slate-700/50 mb-8">';
      html += '<div class="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">';
      html += '<h2 class="text-white font-semibold text-sm flex items-center gap-2"><i class="ph-bold ph-play-circle text-cyan-400"></i>Recent Runs</h2>';
      html += '<button class="text-slate-400 hover:text-white hover:bg-slate-700 px-3 py-1.5 rounded-lg text-xs transition-colors duration-200 cursor-pointer" onclick="switchSubPage(\'postflow\',\'runs\')">View all</button>';
      html += '</div><div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="text-slate-500 text-xs uppercase tracking-wider border-b border-slate-700/50">';
      html += '<th class="text-left px-6 py-3 font-medium">Run</th><th class="text-left px-6 py-3 font-medium">Trigger</th><th class="text-left px-6 py-3 font-medium">When</th><th class="text-left px-6 py-3 font-medium">Results</th><th class="text-left px-6 py-3 font-medium">Status</th></tr></thead><tbody>';
      for (var r = 0; r < Math.min(stats.recentRuns.length, 5); r++) {
        var run = stats.recentRuns[r];
        html += '<tr class="border-b border-slate-700/50 hover:bg-slate-800/50">';
        html += '<td class="px-6 py-3 font-mono text-white font-medium">#' + s(run.id) + '</td>';
        html += '<td class="px-6 py-3">' + this._statusBadge(run.trigger) + '</td>';
        html += '<td class="px-6 py-3 text-slate-400">' + s(run.when) + '</td>';
        html += '<td class="px-6 py-3"><span class="text-emerald-400">' + s(run.ok) + ' ok</span><span class="text-slate-600 mx-1">/</span><span class="text-red-400">' + s(run.fail) + ' fail</span><span class="text-slate-600 mx-1">/</span><span class="text-slate-400">' + s(run.skip) + ' skip</span></td>';
        html += '<td class="px-6 py-3">' + this._statusBadge(run.status) + '</td>';
        html += '</tr>';
      }
      html += '</tbody></table></div></div>';
    }

    // Active Alerts summary
    if (stats.alerts && stats.alerts.length) {
      html += '<div class="bg-slate-800 rounded-xl border border-slate-700/50">';
      html += '<div class="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">';
      html += '<h2 class="text-white font-semibold text-sm flex items-center gap-2"><i class="ph-bold ph-bell-ringing text-amber-400"></i>Active Alerts</h2>';
      html += '<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400">' + s(stats.alerts.length) + ' active</span>';
      html += '</div><div class="divide-y divide-slate-700/50">';
      for (var a = 0; a < stats.alerts.length; a++) {
        var al = stats.alerts[a];
        var sevIcon = al.severity === 'critical' ? 'ph-prohibit text-red-400' : al.severity === 'warning' ? 'ph-warning text-amber-400' : 'ph-info text-cyan-400';
        html += '<div class="px-6 py-3.5 flex items-center gap-3 hover:bg-slate-800/50 transition-colors duration-200 cursor-pointer" onclick="switchSubPage(\'postflow\',\'alerts\')">';
        html += '<i class="ph-bold ' + sevIcon + ' text-base"></i>';
        html += '<span class="text-sm text-slate-300">' + this._s(al.message) + '</span>';
        html += '<span class="ml-auto">' + this._statusBadge(al.severity) + '</span>';
        html += '</div>';
      }
      html += '</div></div>';
    }

    el.innerHTML = html;
  },

  /* ================================================================
     2. RENDER: BATCH GRID
     ================================================================ */
  renderBatchGrid: function(batches) {
    var el = document.getElementById('postflow-sub-list');
    if (!el) return;
    this._cachedBatches = batches || [];

    if (!batches || !batches.length) {
      el.innerHTML = this._emptyState('ph-stack', 'No batches yet', 'Create your first batch to get started', 'Create Batch', 'POSTFLOW_UI.openBatchModal()');
      return;
    }

    var s = this._s.bind(this);
    var self = this;
    var html = '';

    // Header
    html += '<div class="flex items-center justify-between mb-6">';
    html += '<h2 class="text-2xl font-bold text-white">Batch Overview</h2>';
    html += '<div class="flex items-center gap-3">';
    html += '<span class="text-sm text-slate-400">' + s(batches.length) + ' batches</span>';
    html += '<button onclick="POSTFLOW_UI.openBatchModal()" class="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer flex items-center gap-2" data-min-role="admin"><i class="ph-bold ph-plus"></i> Add Batch</button>';
    html += '</div></div>';

    // Grid
    html += '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">';
    for (var i = 0; i < batches.length; i++) {
      var b = batches[i];
      var platforms = b.platforms || [];
      var okCount = 0;
      var totalCount = platforms.length;
      for (var p = 0; p < platforms.length; p++) {
        if (platforms[p].lastStatus === 'ok' || platforms[p].lastStatus === 'sent') okCount++;
      }
      var statusColor = okCount === totalCount ? 'text-emerald-400' : 'text-red-400';

      html += '<div class="bg-slate-800 rounded-xl border border-slate-700/50 overflow-hidden hover:border-cyan-400/30 transition-colors duration-200 cursor-pointer" onclick="POSTFLOW_UI.openSlideOver(\'' + s(b.id) + '\')">';
      html += '<div class="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">';
      html += '<h3 class="text-white font-semibold">' + s(b.name) + '</h3>';
      html += '<div class="flex items-center gap-2">';
      if (b.status === 'paused') html += '<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400">paused</span>';
      html += '<span class="text-xs font-mono ' + statusColor + '">' + s(okCount) + '/' + s(totalCount) + ' OK</span>';
      html += '</div></div>';

      html += '<div class="px-4 py-3 space-y-2">';
      for (var p2 = 0; p2 < platforms.length; p2++) {
        var plat = platforms[p2];
        var pi = self.PLATFORM_ICONS[plat.platform] || { icon: 'ph-globe', color: 'text-slate-400', label: plat.platform };
        var dotColor = (plat.lastStatus === 'ok' || plat.lastStatus === 'sent') ? 'bg-emerald-400' : plat.lastStatus === 'failed' ? 'bg-red-400' : 'bg-slate-600';
        var timeText = plat.lastAt ? s(plat.lastAt) : 'no data';
        var timeColor = plat.lastAt ? 'text-slate-400' : 'text-slate-500';
        html += '<div class="flex items-center justify-between text-sm">';
        html += '<span class="flex items-center gap-2 text-slate-300"><i class="ph-bold ' + pi.icon + ' ' + pi.color + '"></i> ' + s(pi.label) + '</span>';
        html += '<span class="flex items-center gap-2"><span class="w-2 h-2 rounded-full ' + dotColor + ' inline-block"></span><span class="font-mono text-xs ' + timeColor + '">' + timeText + '</span></span>';
        html += '</div>';
      }
      html += '</div></div>';
    }
    html += '</div>';

    el.innerHTML = html;
  },

  /* ================================================================
     3. RENDER: RUNS TABLE
     ================================================================ */
  renderRunsTable: function(runs) {
    var el = document.getElementById('postflow-sub-runs');
    if (!el) return;

    if (!runs || !runs.length) {
      el.innerHTML = this._emptyState('ph-play-circle', 'No runs yet', 'Trigger your first pipeline run', 'Trigger Run', 'POSTFLOW_UI.triggerRun()');
      return;
    }

    var s = this._s.bind(this);
    var html = '';

    html += '<div class="flex items-center justify-between mb-6">';
    html += '<h2 class="text-2xl font-bold text-white">Pipeline Runs</h2>';
    html += '<button onclick="POSTFLOW_UI.triggerRun()" class="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer flex items-center gap-2" data-min-role="manager"><i class="ph-bold ph-play"></i> Trigger Run</button>';
    html += '</div>';

    html += '<div class="bg-slate-800 rounded-xl border border-slate-700/50 overflow-hidden"><div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="border-b border-slate-700/50">';
    html += '<th class="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase tracking-wider">#</th>';
    html += '<th class="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase tracking-wider">Trigger</th>';
    html += '<th class="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase tracking-wider">Started</th>';
    html += '<th class="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase tracking-wider">Duration</th>';
    html += '<th class="text-right px-4 py-3 text-slate-400 font-medium text-xs uppercase tracking-wider">OK</th>';
    html += '<th class="text-right px-4 py-3 text-slate-400 font-medium text-xs uppercase tracking-wider">Fail</th>';
    html += '<th class="text-right px-4 py-3 text-slate-400 font-medium text-xs uppercase tracking-wider">Skip</th>';
    html += '<th class="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase tracking-wider">Status</th>';
    html += '<th class="text-right px-4 py-3 text-slate-400 font-medium text-xs uppercase tracking-wider">Actions</th>';
    html += '</tr></thead><tbody class="text-slate-300">';

    for (var i = 0; i < runs.length; i++) {
      var r = runs[i];
      html += '<tr class="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors duration-200">';
      html += '<td class="px-4 py-3 font-mono font-semibold text-white">' + s(r.id) + '</td>';
      html += '<td class="px-4 py-3"><span class="flex items-center gap-2"><i class="ph-bold ' + (r.trigger === 'scheduled' ? 'ph-clock text-cyan-400' : r.trigger === 'manual' ? 'ph-hand-pointing text-slate-400' : 'ph-flask text-violet-400') + '"></i> ' + s(r.trigger) + '</span></td>';
      html += '<td class="px-4 py-3 font-mono text-slate-400">' + s(r.started) + '</td>';
      html += '<td class="px-4 py-3 font-mono text-slate-400">' + s(r.duration || '--') + '</td>';
      html += '<td class="px-4 py-3 text-right font-mono text-emerald-400">' + s(r.ok) + '</td>';
      html += '<td class="px-4 py-3 text-right font-mono text-red-400">' + s(r.fail) + '</td>';
      html += '<td class="px-4 py-3 text-right font-mono text-slate-400">' + s(r.skip) + '</td>';
      html += '<td class="px-4 py-3">' + this._statusBadge(r.status) + '</td>';
      html += '<td class="px-4 py-3 text-right">';
      if (r.fail > 0 && r.status === 'done') {
        html += '<button onclick="event.stopPropagation();POSTFLOW_UI.retryRun(\'' + s(r.id) + '\')" class="text-cyan-400 hover:text-cyan-300 text-xs font-medium transition-colors cursor-pointer px-2 py-1 rounded hover:bg-slate-700/50" data-min-role="manager"><i class="ph-bold ph-arrow-counter-clockwise"></i> Retry</button>';
      }
      html += '</td></tr>';
    }

    html += '</tbody></table></div></div>';
    el.innerHTML = html;
  },

  /* ================================================================
     4. RENDER: PROBLEMS PANEL
     ================================================================ */
  renderProblemsPanel: function(problems) {
    var el = document.getElementById('postflow-sub-problems');
    if (!el) return;

    if (!problems || !problems.length) {
      el.innerHTML = this._emptyState('ph-check-circle', 'No problems', 'All targets are operating normally', '', '');
      return;
    }

    var s = this._s.bind(this);
    var self = this;
    var html = '';

    html += '<div class="flex items-center gap-3 mb-6">';
    html += '<div class="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center"><i class="ph-bold ph-warning text-red-400 text-xl"></i></div>';
    html += '<div><h2 class="text-2xl font-bold text-white">Failed Posts</h2>';
    html += '<p class="text-sm text-slate-400 mt-0.5"><span class="text-red-400 font-semibold">' + s(problems.length) + ' problems</span></p></div>';
    html += '</div>';

    html += '<div class="bg-slate-800 rounded-xl border border-slate-700/50 overflow-hidden"><div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="border-b border-slate-700/50">';
    html += '<th class="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase tracking-wider">Target</th>';
    html += '<th class="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase tracking-wider">Platform</th>';
    html += '<th class="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase tracking-wider">Chat ID</th>';
    html += '<th class="text-right px-4 py-3 text-slate-400 font-medium text-xs uppercase tracking-wider">Fails</th>';
    html += '<th class="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase tracking-wider">Last Error</th>';
    html += '</tr></thead><tbody class="text-slate-300">';

    for (var i = 0; i < problems.length; i++) {
      var p = problems[i];
      var pi = self.PLATFORM_ICONS[p.platform] || { icon: 'ph-globe', color: 'text-slate-400', label: p.platform };
      html += '<tr class="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors duration-200 border-l-2 border-l-red-500">';
      html += '<td class="px-4 py-3 font-semibold text-white">' + s(p.target) + '</td>';
      html += '<td class="px-4 py-3"><span class="flex items-center gap-2"><i class="ph-bold ' + pi.icon + ' ' + pi.color + '"></i> ' + s(pi.label) + '</span></td>';
      html += '<td class="px-4 py-3 font-mono text-slate-400">' + s(p.chatId) + '</td>';
      html += '<td class="px-4 py-3 text-right font-mono text-red-400 font-semibold">' + s(p.failCount) + '</td>';
      html += '<td class="px-4 py-3"><span class="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400">' + s(p.lastError) + '</span></td>';
      html += '</tr>';
    }

    html += '</tbody></table></div></div>';
    el.innerHTML = html;
  },

  /* ================================================================
     5. RENDER: COVERAGE TABLE
     ================================================================ */
  renderCoverageTable: function(coverage) {
    var el = document.getElementById('postflow-sub-coverage');
    if (!el) return;

    if (!coverage || (!coverage.tiers && !coverage.summary)) {
      el.innerHTML = this._emptyState('ph-chart-bar', 'No coverage data', 'Coverage stats will appear after runs complete', '', '');
      return;
    }

    var s = this._s.bind(this);
    var html = '';

    html += '<div class="flex items-center gap-3 mb-6"><i class="ph-bold ph-chart-bar text-cyan-400 text-2xl"></i><h2 class="text-2xl font-bold text-white">Coverage Progress</h2></div>';

    // Tier Cards
    if (coverage.tiers && coverage.tiers.length) {
      html += '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">';
      for (var i = 0; i < coverage.tiers.length; i++) {
        var t = coverage.tiers[i];
        var isEmpty = (t.total || 0) === 0;
        var pct = t.total > 0 ? Math.round((t.fullyCovered / t.total) * 100) : 0;
        html += '<div class="bg-slate-800 rounded-xl border border-slate-700/50 p-6' + (isEmpty ? ' opacity-50' : '') + '">';
        html += '<div class="flex items-center justify-between mb-4">';
        html += '<h3 class="text-lg font-semibold ' + (isEmpty ? 'text-slate-500' : 'text-white') + '">' + s(t.name) + '</h3>';
        html += '<span class="text-xs font-mono px-2.5 py-1 rounded-full ' + (isEmpty ? 'bg-slate-600/15 text-slate-500 border border-slate-600/30' : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30') + '">' + s(t.total) + ' videos</span>';
        html += '</div>';
        html += '<div class="mb-1 flex items-center justify-between text-xs text-slate-400"><span>Coverage</span><span class="font-mono ' + (isEmpty ? '' : 'text-emerald-400') + '">' + s(pct) + '%</span></div>';
        html += '<div class="h-2 rounded-full bg-slate-700 overflow-hidden mb-5"><div class="h-full rounded-full ' + (isEmpty ? 'bg-slate-600' : 'bg-emerald-500') + ' transition-all duration-500" style="width:' + pct + '%"></div></div>';
        html += '<div class="grid grid-cols-2 gap-3">';
        var subCards = [
          { label: 'Fully Covered', val: t.fullyCovered, color: isEmpty ? 'text-slate-600' : 'text-emerald-400', note: '4/4 platforms' },
          { label: 'In Progress',   val: t.inProgress,   color: isEmpty ? 'text-slate-600' : 'text-cyan-400' },
          { label: 'Unused',        val: t.unused,        color: isEmpty ? 'text-slate-600' : 'text-slate-400' },
          { label: 'Burned',        val: t.burned,        color: isEmpty ? 'text-slate-600' : 'text-red-400' }
        ];
        for (var j = 0; j < subCards.length; j++) {
          var sc = subCards[j];
          html += '<div class="bg-slate-900/60 rounded-lg p-3 text-center"><div class="text-xs text-slate-500 mb-1">' + s(sc.label) + '</div><div class="font-mono text-xl font-bold ' + sc.color + '">' + s(sc.val) + '</div>';
          if (sc.note) html += '<div class="text-[10px] text-slate-600 mt-0.5">' + s(sc.note) + '</div>';
          html += '</div>';
        }
        html += '</div></div>';
      }
      html += '</div>';
    }

    // Overall Summary
    if (coverage.summary) {
      var sm = coverage.summary;
      html += '<div class="bg-slate-800 rounded-xl border border-slate-700/50 p-6">';
      html += '<h3 class="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Overall Summary</h3>';
      html += '<div class="grid grid-cols-2 md:grid-cols-5 gap-4">';
      var sumCards = [
        { label: 'Total',         val: sm.total,         color: 'text-white',        pct: '' },
        { label: 'Fully Covered', val: sm.fullyCovered,  color: 'text-emerald-400',  pct: sm.total > 0 ? Math.round(sm.fullyCovered / sm.total * 100) + '%' : '0%' },
        { label: 'In Progress',   val: sm.inProgress,    color: 'text-cyan-400',     pct: sm.total > 0 ? Math.round(sm.inProgress / sm.total * 100) + '%' : '0%' },
        { label: 'Unused',        val: sm.unused,        color: 'text-slate-400',    pct: sm.total > 0 ? Math.round(sm.unused / sm.total * 100) + '%' : '0%' },
        { label: 'Burned',        val: sm.burned,        color: 'text-red-400',      pct: sm.total > 0 ? Math.round(sm.burned / sm.total * 100) + '%' : '0%' }
      ];
      for (var k = 0; k < sumCards.length; k++) {
        var sc2 = sumCards[k];
        html += '<div class="bg-slate-900/60 rounded-lg p-4 text-center"><div class="text-xs text-slate-500 mb-1">' + s(sc2.label) + '</div><div class="font-mono text-2xl font-bold ' + sc2.color + '">' + s(sc2.val) + '</div>';
        if (sc2.pct) html += '<div class="text-xs text-slate-500 mt-0.5">' + s(sc2.pct) + '</div>';
        else html += '<div class="text-xs text-slate-500 mt-0.5">videos</div>';
        html += '</div>';
      }
      html += '</div></div>';
    }

    el.innerHTML = html;
  },

  /* ================================================================
     6. RENDER: EDITORS TABLE
     ================================================================ */
  renderEditorsTable: function(editors) {
    var el = document.getElementById('postflow-sub-editors');
    if (!el) return;

    if (!editors || !editors.length) {
      el.innerHTML = this._emptyState('ph-user-circle-gear', 'No editors yet', 'Add your first editor to start tracking', 'Add Editor', 'POSTFLOW_UI.openEditorModal()');
      return;
    }

    var s = this._s.bind(this);
    var html = '';

    html += '<div class="flex items-center justify-between mb-6">';
    html += '<div class="flex items-center gap-3"><i class="ph-bold ph-users text-cyan-400 text-2xl"></i><h2 class="text-2xl font-bold text-white">Editor Tracking</h2></div>';
    html += '<button onclick="POSTFLOW_UI.openEditorModal()" class="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer flex items-center gap-2" data-min-role="admin"><i class="ph-bold ph-plus"></i> Add Editor</button>';
    html += '</div>';

    // Table
    html += '<div class="bg-slate-800 rounded-xl border border-slate-700/50 overflow-hidden mb-8"><div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="border-b border-slate-700/50">';
    html += '<th class="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-4">Editor</th>';
    html += '<th class="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-4">Batch</th>';
    html += '<th class="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-4">Tier</th>';
    html += '<th class="text-right text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-4">Done</th>';
    html += '<th class="text-right text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-4">Expected</th>';
    html += '<th class="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-4">Progress</th>';
    html += '<th class="text-right text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-4">Last Active</th>';
    html += '<th class="text-right text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-4">Actions</th>';
    html += '</tr></thead><tbody class="divide-y divide-slate-700/30">';

    var tierColors = {
      sfw:         'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
      nsfw_blur:   'bg-amber-500/15 text-amber-400 border border-amber-500/30',
      nsfw_noblur: 'bg-red-500/15 text-red-400 border border-red-500/30',
      nsfw_risky:  'bg-red-500/15 text-red-400 border border-red-500/30'
    };

    for (var i = 0; i < editors.length; i++) {
      var ed = editors[i];
      var pct = ed.expected > 0 ? Math.round((ed.done / ed.expected) * 100) : 0;
      var isComplete = pct >= 100;
      var isStale = ed.stale === true;
      var barColor = isComplete ? 'bg-emerald-500' : pct < 25 ? 'bg-red-500' : 'bg-cyan-500';
      var pctColor = isComplete ? 'text-emerald-400' : pct === 0 ? 'text-red-400' : 'text-slate-300';
      var nameColor = isComplete ? 'text-emerald-400' : 'text-slate-300';
      var tierCls = tierColors[ed.tier] || 'bg-slate-600/15 text-slate-400 border border-slate-600/30';

      html += '<tr class="' + (isStale ? 'bg-amber-500/10 hover:bg-amber-500/15' : 'hover:bg-slate-700/20') + ' transition-colors duration-200">';
      html += '<td class="px-6 py-4"><span class="font-medium ' + nameColor + '">' + s(ed.name) + '</span></td>';
      html += '<td class="px-6 py-4"><span class="font-mono text-sm text-slate-300">' + s(ed.batch) + '</span></td>';
      html += '<td class="px-6 py-4"><span class="text-xs px-2 py-0.5 rounded ' + tierCls + '">' + s(ed.tierLabel || ed.tier) + '</span></td>';
      html += '<td class="px-6 py-4 text-right"><span class="font-mono text-sm ' + (isComplete ? 'text-emerald-400' : ed.done === 0 ? 'text-red-400' : 'text-slate-300') + '">' + s(ed.done) + '</span></td>';
      html += '<td class="px-6 py-4 text-right"><span class="font-mono text-sm text-slate-400">' + s(ed.expected) + '</span></td>';
      html += '<td class="px-6 py-4"><div class="flex items-center gap-2"><div class="w-24 h-2 rounded-full bg-slate-700 overflow-hidden"><div class="h-full rounded-full ' + barColor + '" style="width:' + pct + '%"></div></div><span class="font-mono text-sm ' + pctColor + '">' + s(pct) + '%</span>';
      if (isComplete) html += '<i class="ph-bold ph-check-circle text-emerald-400 text-sm"></i>';
      html += '</div></td>';
      html += '<td class="px-6 py-4 text-right">';
      if (isStale) {
        html += '<span class="text-sm text-amber-400 flex items-center justify-end gap-1.5"><i class="ph-bold ph-warning text-amber-400"></i>' + s(ed.lastActive) + '</span>';
      } else {
        html += '<span class="text-sm text-slate-400">' + s(ed.lastActive) + '</span>';
      }
      html += '</td>';
      html += '<td class="px-6 py-4 text-right"><button onclick="event.stopPropagation();POSTFLOW_UI.openEditorModal(\'' + s(ed.id) + '\')" class="text-slate-400 hover:text-cyan-400 p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors cursor-pointer" data-min-role="admin"><i class="ph-bold ph-pencil-simple"></i></button></td>';
      html += '</tr>';
    }

    html += '</tbody></table></div></div>';

    // Summary cards
    var totalClips = 0, activeCount = 0, totalPct = 0;
    for (var e = 0; e < editors.length; e++) {
      totalClips += editors[e].done || 0;
      if (!editors[e].stale && editors[e].done > 0) activeCount++;
      if (editors[e].expected > 0) totalPct += (editors[e].done / editors[e].expected);
    }
    var avgPct = editors.length > 0 ? Math.round((totalPct / editors.length) * 100) : 0;

    html += '<div class="grid grid-cols-1 md:grid-cols-3 gap-4">';
    html += '<div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5 text-center"><div class="text-xs text-slate-500 uppercase tracking-wider mb-2">Total Clips Received</div><div class="font-mono text-3xl font-bold text-cyan-400">' + s(totalClips) + '</div></div>';
    html += '<div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5 text-center"><div class="text-xs text-slate-500 uppercase tracking-wider mb-2">Active Editors</div><div class="font-mono text-3xl font-bold text-emerald-400">' + s(activeCount) + '</div></div>';
    html += '<div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5 text-center"><div class="text-xs text-slate-500 uppercase tracking-wider mb-2">Completion Rate</div><div class="font-mono text-3xl font-bold text-amber-400">' + s(avgPct) + '%</div></div>';
    html += '</div>';

    el.innerHTML = html;
  },

  /* ================================================================
     7. RENDER: CONFIG PANEL
     ================================================================ */
  renderConfigPanel: function(config) {
    var el = document.getElementById('postflow-sub-config');
    if (!el) return;

    if (!config || !config.length) {
      el.innerHTML = this._emptyState('ph-gear-six', 'No configuration', 'Configuration data is not available', '', '');
      return;
    }

    var s = this._s.bind(this);
    var html = '';

    html += '<div class="flex items-center gap-3 mb-6"><i class="ph-bold ph-gear-six text-cyan-400 text-2xl"></i><h2 class="text-2xl font-bold text-white">Bot Configuration</h2></div>';
    html += '<div class="space-y-3">';

    for (var i = 0; i < config.length; i++) {
      var cfg = config[i];
      html += '<div class="flex items-center justify-between bg-slate-800 rounded-lg p-4 border border-slate-700/50">';
      html += '<div><div class="text-sm font-medium text-slate-300">' + s(cfg.key) + '</div>';
      html += '<div class="text-xs text-slate-500 mt-0.5">' + s(cfg.description) + '</div></div>';
      html += '<div class="flex items-center gap-3">';

      if (cfg.type === 'boolean') {
        var isOn = cfg.value === true || cfg.value === 'true';
        html += '<span class="font-mono text-sm ' + (isOn ? 'text-emerald-400' : 'text-red-400') + '" id="bc-cfg-label-' + s(cfg.key) + '">' + (isOn ? 'true' : 'false') + '</span>';
        html += '<button onclick="POSTFLOW_UI.toggleConfigValue(\'' + s(cfg.key) + '\')" id="bc-cfg-toggle-' + s(cfg.key) + '" class="w-11 h-6 rounded-full ' + (isOn ? 'bg-emerald-500' : 'bg-slate-600') + ' relative transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 cursor-pointer" data-min-role="admin">';
        html += '<span class="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-200" style="left:' + (isOn ? '20px' : '2px') + '"></span>';
        html += '</button>';
      } else {
        html += '<span class="font-mono text-cyan-400" id="bc-cfg-val-' + s(cfg.key) + '">' + s(cfg.value) + '</span>';
        html += '<button class="text-slate-400 hover:text-cyan-400 px-3 py-1.5 rounded-md hover:bg-slate-700/50 transition-colors duration-200 text-sm flex items-center gap-1.5 cursor-pointer" onclick="POSTFLOW_UI.inlineEditConfig(\'' + s(cfg.key) + '\')" data-min-role="admin"><i class="ph-bold ph-pencil-simple"></i> Edit</button>';
      }

      html += '</div></div>';
    }

    html += '</div>';
    el.innerHTML = html;
  },

  /* ================================================================
     8. RENDER: ALERTS PANEL
     ================================================================ */
  renderAlertsPanel: function(alerts) {
    var el = document.getElementById('postflow-sub-alerts');
    if (!el) return;

    if (!alerts || !alerts.length) {
      el.innerHTML = this._emptyState('ph-bell-ringing', 'No active alerts', 'The system is operating normally', '', '');
      return;
    }

    var s = this._s.bind(this);
    var html = '';

    // Header
    html += '<div class="flex items-center justify-between mb-6">';
    html += '<h2 class="text-2xl font-bold text-white flex items-center gap-3"><i class="ph-bold ph-bell-ringing text-cyan-400 text-3xl"></i>Active Alerts</h2>';
    html += '<button onclick="POSTFLOW_UI.openAlertModal()" class="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer flex items-center gap-2" data-min-role="admin"><i class="ph-bold ph-plus"></i> Create Alert</button>';
    html += '</div>';

    // Summary bar
    var critCount = 0, warnCount = 0, infoCount = 0;
    for (var c = 0; c < alerts.length; c++) {
      if (alerts[c].severity === 'critical') critCount++;
      else if (alerts[c].severity === 'warning') warnCount++;
      else infoCount++;
    }

    html += '<div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">';
    if (critCount > 0) html += '<div class="bg-slate-800 rounded-lg px-4 py-3 flex items-center gap-3 border border-red-500/30"><i class="ph-bold ph-prohibit text-red-400 text-xl"></i><div><div class="text-xs text-slate-400 uppercase tracking-wider">Critical</div><div class="text-xl font-bold text-red-400 font-mono">' + s(critCount) + '</div></div></div>';
    if (warnCount > 0) html += '<div class="bg-slate-800 rounded-lg px-4 py-3 flex items-center gap-3 border border-amber-500/30"><i class="ph-bold ph-warning text-amber-400 text-xl"></i><div><div class="text-xs text-slate-400 uppercase tracking-wider">Warning</div><div class="text-xl font-bold text-amber-400 font-mono">' + s(warnCount) + '</div></div></div>';
    if (infoCount > 0) html += '<div class="bg-slate-800 rounded-lg px-4 py-3 flex items-center gap-3 border border-cyan-500/30"><i class="ph-bold ph-info text-cyan-400 text-xl"></i><div><div class="text-xs text-slate-400 uppercase tracking-wider">Info</div><div class="text-xl font-bold text-cyan-400 font-mono">' + s(infoCount) + '</div></div></div>';
    html += '</div>';

    // Alert items
    html += '<div class="space-y-3">';
    for (var i = 0; i < alerts.length; i++) {
      var al = alerts[i];
      var borderColor = al.severity === 'critical' ? 'border-l-red-500' : al.severity === 'warning' ? 'border-l-amber-500' : 'border-l-cyan-500';
      var sevIcon = al.severity === 'critical' ? 'ph-prohibit text-red-400' : al.severity === 'warning' ? 'ph-warning text-amber-400' : 'ph-info text-cyan-400';

      html += '<div class="bg-slate-800 rounded-lg p-4 border-l-4 ' + borderColor + ' flex items-center justify-between" id="bc-alert-item-' + s(al.id) + '">';
      html += '<div class="flex items-center gap-4">';
      html += '<i class="ph-bold ' + sevIcon + ' text-xl flex-shrink-0"></i>';
      html += '<div><div class="text-sm text-slate-300">' + s(al.message) + '</div>';
      if (al.detail) html += '<div class="text-xs text-slate-500 mt-0.5">' + s(al.detail) + '</div>';
      html += '</div></div>';
      html += '<button onclick="POSTFLOW_UI.dismissAlert(\'' + s(al.id) + '\')" class="text-slate-500 hover:text-white flex items-center gap-1.5 text-sm font-medium transition-colors duration-200 cursor-pointer px-3 py-1.5 rounded-lg hover:bg-slate-700 flex-shrink-0" data-min-role="manager"><i class="ph-bold ph-x"></i> Dismiss</button>';
      html += '</div>';
    }
    html += '</div>';

    el.innerHTML = html;
  },

  /* ================================================================
     MODAL: BATCH (OPEN / CLOSE / SAVE)
     ================================================================ */
  openBatchModal: function(batchId) {
    var titleEl = document.querySelector('#bc-batch-modal-title span');
    var saveLabel = document.getElementById('bc-batch-save-label');
    var idField = document.getElementById('bc-batch-id');

    // Reset
    document.getElementById('bc-batch-name').value = '';
    document.querySelectorAll('.bc-platform-chip').forEach(function(c) {
      c.classList.remove('border-cyan-500/60', 'bg-cyan-500/15', 'text-cyan-400');
      c.classList.add('border-slate-600/50', 'bg-slate-900/40', 'text-slate-400');
      c.dataset.selected = 'false';
    });
    this._batchTimeTags = [];
    this._renderTimeTags();
    document.getElementById('bc-batch-vpa').value = '3';
    document.getElementById('bc-batch-coverage').value = '100';
    document.getElementById('bc-batch-coverage-val').textContent = '100%';
    this._setBatchStatusUI(true);

    if (batchId) {
      // Edit mode - populate from cached data
      idField.value = batchId;
      titleEl.textContent = 'Edit Batch';
      saveLabel.textContent = 'Update Batch';
      var batch = this._cachedBatches.find(function(b) { return b.id === batchId; });
      if (batch) {
        document.getElementById('bc-batch-name').value = batch.name || '';
        if (batch.platforms) {
          batch.platforms.forEach(function(p) {
            var chip = document.querySelector('.bc-platform-chip[data-platform="' + p.platform + '"]');
            if (chip) { chip.dataset.selected = 'true'; chip.classList.add('border-cyan-500/60', 'bg-cyan-500/15', 'text-cyan-400'); chip.classList.remove('border-slate-600/50', 'bg-slate-900/40', 'text-slate-400'); }
          });
        }
        if (batch.postTimes) { this._batchTimeTags = batch.postTimes.slice(); this._renderTimeTags(); }
        if (batch.videosPerAccount) document.getElementById('bc-batch-vpa').value = batch.videosPerAccount;
        if (batch.coverageRequired != null) { document.getElementById('bc-batch-coverage').value = batch.coverageRequired; document.getElementById('bc-batch-coverage-val').textContent = batch.coverageRequired + '%'; }
        this._setBatchStatusUI(batch.status !== 'paused');
      }
    } else {
      idField.value = '';
      titleEl.textContent = 'Add Batch';
      saveLabel.textContent = 'Save Batch';
    }

    document.getElementById('bc-modal-backdrop').classList.remove('hidden');
    document.getElementById('bc-batch-modal').classList.remove('hidden');
    document.getElementById('bc-batch-name').focus();
  },

  closeBatchModal: function() {
    document.getElementById('bc-batch-modal').classList.add('hidden');
    document.getElementById('bc-modal-backdrop').classList.add('hidden');
  },

  saveBatch: async function() {
    var name = document.getElementById('bc-batch-name').value.trim();
    if (!name) {
      if (typeof TOAST !== 'undefined') TOAST.show('Batch name is required', 'error');
      document.getElementById('bc-batch-name').focus();
      return;
    }

    var platforms = [];
    document.querySelectorAll('.bc-platform-chip').forEach(function(c) {
      if (c.dataset.selected === 'true') platforms.push(c.dataset.platform);
    });

    var data = {
      name: name,
      platforms: platforms,
      postTimes: this._batchTimeTags.slice(),
      videosPerAccount: parseInt(document.getElementById('bc-batch-vpa').value) || 3,
      coverageRequired: parseInt(document.getElementById('bc-batch-coverage').value) || 100,
      status: document.getElementById('bc-batch-status-label').textContent === 'active' ? 'active' : 'paused'
    };

    var batchId = document.getElementById('bc-batch-id').value;

    try {
      if (typeof API !== 'undefined' && API.postflow) {
        if (batchId) {
          await API.postflow.update(batchId, data);
          if (typeof TOAST !== 'undefined') TOAST.show('Batch updated successfully', 'success');
        } else {
          await API.postflow.create(data);
          if (typeof TOAST !== 'undefined') TOAST.show('Batch created successfully', 'success');
        }
      }
      this.closeBatchModal();
      this.init();
    } catch (err) {
      if (typeof TOAST !== 'undefined') TOAST.show('Failed to save batch: ' + (err.message || err), 'error');
    }
  },

  togglePlatformChip: function(chip) {
    var isSelected = chip.dataset.selected === 'true';
    chip.dataset.selected = isSelected ? 'false' : 'true';
    if (isSelected) {
      chip.classList.remove('border-cyan-500/60', 'bg-cyan-500/15', 'text-cyan-400');
      chip.classList.add('border-slate-600/50', 'bg-slate-900/40', 'text-slate-400');
    } else {
      chip.classList.add('border-cyan-500/60', 'bg-cyan-500/15', 'text-cyan-400');
      chip.classList.remove('border-slate-600/50', 'bg-slate-900/40', 'text-slate-400');
    }
  },

  toggleBatchStatus: function() {
    var label = document.getElementById('bc-batch-status-label');
    var isActive = label.textContent === 'active';
    this._setBatchStatusUI(!isActive);
  },

  _setBatchStatusUI: function(active) {
    var label = document.getElementById('bc-batch-status-label');
    var btn = document.getElementById('bc-batch-status-toggle');
    var dot = btn.querySelector('span');
    if (active) {
      label.textContent = 'active';
      label.className = 'text-sm font-mono text-emerald-400';
      btn.classList.add('bg-emerald-500'); btn.classList.remove('bg-slate-600');
      dot.style.left = '20px';
    } else {
      label.textContent = 'paused';
      label.className = 'text-sm font-mono text-amber-400';
      btn.classList.remove('bg-emerald-500'); btn.classList.add('bg-slate-600');
      dot.style.left = '2px';
    }
  },

  /* ================================================================
     TIME TAG INPUT
     ================================================================ */
  _renderTimeTags: function() {
    var wrap = document.getElementById('bc-batch-times-wrap');
    var input = document.getElementById('bc-batch-times-input');
    // Remove existing tags
    wrap.querySelectorAll('.bc-time-tag').forEach(function(t) { t.remove(); });
    // Add tags before input
    var self = this;
    for (var i = 0; i < this._batchTimeTags.length; i++) {
      var tag = document.createElement('span');
      tag.className = 'bc-time-tag inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-400 text-xs font-mono border border-cyan-500/30';
      tag.innerHTML = this._s(this._batchTimeTags[i]) + '<button type="button" class="hover:text-white ml-0.5 cursor-pointer" data-idx="' + i + '"><i class="ph-bold ph-x text-[10px]"></i></button>';
      tag.querySelector('button').addEventListener('click', function(e) {
        var idx = parseInt(e.currentTarget.dataset.idx);
        self._batchTimeTags.splice(idx, 1);
        self._renderTimeTags();
      });
      wrap.insertBefore(tag, input);
    }
  },

  _initTimeTagInput: function() {
    var self = this;
    var input = document.getElementById('bc-batch-times-input');
    if (!input) return;
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        var val = input.value.trim();
        if (val && /^\d{1,2}:\d{2}$/.test(val)) {
          if (self._batchTimeTags.indexOf(val) === -1) {
            self._batchTimeTags.push(val);
            self._renderTimeTags();
          }
          input.value = '';
        }
      }
    });
  },

  /* ================================================================
     MODAL: EDITOR (OPEN / CLOSE / SAVE)
     ================================================================ */
  openEditorModal: function(editorId) {
    var titleEl = document.querySelector('#bc-editor-modal-title span');
    var saveLabel = document.getElementById('bc-editor-save-label');

    // Reset
    document.getElementById('bc-editor-id').value = '';
    document.getElementById('bc-editor-name').value = '';
    document.getElementById('bc-editor-telegram').value = '';
    document.getElementById('bc-editor-max-videos').value = '10';
    this._setEditorStatusUI(true);

    // Populate batch checkboxes
    var batchesWrap = document.getElementById('bc-editor-batches');
    if (this._cachedBatches.length > 0) {
      var s = this._s.bind(this);
      var cbHtml = '';
      for (var i = 0; i < this._cachedBatches.length; i++) {
        var b = this._cachedBatches[i];
        cbHtml += '<label class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-700/30 cursor-pointer transition-colors">';
        cbHtml += '<input type="checkbox" value="' + s(b.id) + '" class="bc-editor-batch-cb">';
        cbHtml += '<span class="text-sm text-slate-300">' + s(b.name) + '</span></label>';
      }
      batchesWrap.innerHTML = cbHtml;
    } else {
      batchesWrap.innerHTML = '<p class="text-xs text-slate-600">No batches available</p>';
    }

    if (editorId) {
      document.getElementById('bc-editor-id').value = editorId;
      titleEl.textContent = 'Edit Editor';
      saveLabel.textContent = 'Update Editor';
      // Would populate from API in production
    } else {
      titleEl.textContent = 'Add Editor';
      saveLabel.textContent = 'Save Editor';
    }

    document.getElementById('bc-modal-backdrop').classList.remove('hidden');
    document.getElementById('bc-editor-modal').classList.remove('hidden');
    document.getElementById('bc-editor-name').focus();
  },

  closeEditorModal: function() {
    document.getElementById('bc-editor-modal').classList.add('hidden');
    document.getElementById('bc-modal-backdrop').classList.add('hidden');
  },

  saveEditor: async function() {
    var name = document.getElementById('bc-editor-name').value.trim();
    if (!name) {
      if (typeof TOAST !== 'undefined') TOAST.show('Editor name is required', 'error');
      document.getElementById('bc-editor-name').focus();
      return;
    }

    var telegram = document.getElementById('bc-editor-telegram').value.trim();
    if (telegram && !telegram.startsWith('@')) telegram = '@' + telegram;

    var assignedBatches = [];
    document.querySelectorAll('.bc-editor-batch-cb:checked').forEach(function(cb) {
      assignedBatches.push(cb.value);
    });

    var data = {
      name: name,
      telegram: telegram,
      assignedBatches: assignedBatches,
      maxActiveVideos: parseInt(document.getElementById('bc-editor-max-videos').value) || 10,
      status: document.getElementById('bc-editor-status-label').textContent === 'active' ? 'active' : 'disabled'
    };

    var editorId = document.getElementById('bc-editor-id').value;

    try {
      if (typeof API !== 'undefined' && API.postflow) {
        if (editorId) {
          await API.postflow.updateEditor(editorId, data);
          if (typeof TOAST !== 'undefined') TOAST.show('Editor updated successfully', 'success');
        } else {
          await API.postflow.createEditor(data);
          if (typeof TOAST !== 'undefined') TOAST.show('Editor created successfully', 'success');
        }
      }
      this.closeEditorModal();
      this.init();
    } catch (err) {
      if (typeof TOAST !== 'undefined') TOAST.show('Failed to save editor: ' + (err.message || err), 'error');
    }
  },

  toggleEditorStatus: function() {
    var label = document.getElementById('bc-editor-status-label');
    var isActive = label.textContent === 'active';
    this._setEditorStatusUI(!isActive);
  },

  _setEditorStatusUI: function(active) {
    var label = document.getElementById('bc-editor-status-label');
    var btn = document.getElementById('bc-editor-status-toggle');
    var dot = btn.querySelector('span');
    if (active) {
      label.textContent = 'active';
      label.className = 'text-sm font-mono text-emerald-400';
      btn.classList.add('bg-emerald-500'); btn.classList.remove('bg-slate-600');
      dot.style.left = '20px';
    } else {
      label.textContent = 'disabled';
      label.className = 'text-sm font-mono text-red-400';
      btn.classList.remove('bg-emerald-500'); btn.classList.add('bg-slate-600');
      dot.style.left = '2px';
    }
  },

  /* ================================================================
     SLIDE-OVER: BATCH DETAIL
     ================================================================ */
  openSlideOver: async function(batchId) {
    var batch = this._cachedBatches.find(function(b) { return b.id === batchId; });
    if (!batch) return;

    var s = this._s.bind(this);
    var self = this;
    var content = document.getElementById('bc-slide-content');
    var titleEl = document.querySelector('#bc-slide-title span');
    titleEl.textContent = batch.name;

    var html = '';

    // Status + Platforms row
    html += '<div class="flex items-center gap-2 flex-wrap">';
    html += this._statusBadge(batch.status || 'active');
    if (batch.platforms) {
      for (var i = 0; i < batch.platforms.length; i++) {
        var pi = self.PLATFORM_ICONS[batch.platforms[i].platform] || { icon: 'ph-globe', color: 'text-slate-400', label: batch.platforms[i].platform };
        html += '<span class="flex items-center gap-1 text-xs text-slate-400"><i class="ph-bold ' + pi.icon + ' ' + pi.color + '"></i>' + s(pi.label) + '</span>';
      }
    }
    html += '</div>';

    // Info grid
    html += '<div class="grid grid-cols-2 gap-3">';
    html += '<div class="bg-slate-900/60 rounded-lg p-3"><div class="text-xs text-slate-500 mb-1">Videos/Account</div><div class="font-mono text-lg font-bold text-white">' + s(batch.videosPerAccount || '--') + '</div></div>';
    html += '<div class="bg-slate-900/60 rounded-lg p-3"><div class="text-xs text-slate-500 mb-1">Coverage</div><div class="font-mono text-lg font-bold text-white">' + s(batch.coverageRequired != null ? batch.coverageRequired + '%' : '--') + '</div></div>';
    html += '</div>';

    // Post times
    if (batch.postTimes && batch.postTimes.length) {
      html += '<div><div class="text-xs text-slate-500 uppercase tracking-wider mb-2">Post Times (UTC)</div><div class="flex flex-wrap gap-1.5">';
      for (var t = 0; t < batch.postTimes.length; t++) {
        html += '<span class="px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-400 text-xs font-mono border border-cyan-500/30">' + s(batch.postTimes[t]) + '</span>';
      }
      html += '</div></div>';
    }

    // Recent runs for this batch
    if (batch.recentRuns && batch.recentRuns.length) {
      html += '<div><div class="text-xs text-slate-500 uppercase tracking-wider mb-2">Recent Runs</div><div class="space-y-2">';
      for (var r = 0; r < batch.recentRuns.length; r++) {
        var run = batch.recentRuns[r];
        html += '<div class="bg-slate-900/60 rounded-lg p-3 flex items-center justify-between">';
        html += '<div class="flex items-center gap-3"><span class="font-mono text-sm text-white font-medium">#' + s(run.id) + '</span>' + this._statusBadge(run.status) + '</div>';
        html += '<span class="text-xs text-slate-400">' + s(run.when) + '</span>';
        html += '</div>';
      }
      html += '</div></div>';
    }

    // Coverage per tier
    if (batch.coverageByTier && batch.coverageByTier.length) {
      html += '<div><div class="text-xs text-slate-500 uppercase tracking-wider mb-2">Coverage by Tier</div><div class="space-y-2">';
      for (var ct = 0; ct < batch.coverageByTier.length; ct++) {
        var tier = batch.coverageByTier[ct];
        var pct = tier.total > 0 ? Math.round((tier.covered / tier.total) * 100) : 0;
        html += '<div class="bg-slate-900/60 rounded-lg p-3">';
        html += '<div class="flex items-center justify-between mb-1"><span class="text-sm text-slate-300">' + s(tier.name) + '</span><span class="font-mono text-xs text-cyan-400">' + s(pct) + '%</span></div>';
        html += '<div class="h-1.5 rounded-full bg-slate-700 overflow-hidden"><div class="h-full rounded-full bg-cyan-500" style="width:' + pct + '%"></div></div>';
        html += '</div>';
      }
      html += '</div></div>';
    }

    // Action buttons
    html += '<div class="border-t border-slate-700/50 pt-5 space-y-3">';
    html += '<button onclick="POSTFLOW_UI.triggerRunForBatch(\'' + s(batchId) + '\')" class="w-full bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-2" data-min-role="manager"><i class="ph-bold ph-play"></i> Trigger Run</button>';
    html += '<div class="grid grid-cols-2 gap-3">';
    html += '<button onclick="POSTFLOW_UI.openBatchModal(\'' + s(batchId) + '\');POSTFLOW_UI.closeSlideOver();" class="bg-slate-700/50 hover:bg-slate-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-2" data-min-role="admin"><i class="ph-bold ph-pencil-simple"></i> Edit</button>';

    var isPaused = batch.status === 'paused';
    html += '<button onclick="POSTFLOW_UI.toggleBatchPause(\'' + s(batchId) + '\')" class="' + (isPaused ? 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400' : 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-400') + ' px-4 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-2" data-min-role="admin"><i class="ph-bold ' + (isPaused ? 'ph-play' : 'ph-pause') + '"></i> ' + (isPaused ? 'Resume' : 'Pause') + '</button>';
    html += '</div>';
    html += '<button onclick="POSTFLOW_UI.confirmDeleteBatch(\'' + s(batchId) + '\')" class="w-full bg-red-600/10 hover:bg-red-600/20 text-red-400 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-2 border border-red-500/20" data-min-role="admin"><i class="ph-bold ph-trash"></i> Delete Batch</button>';
    html += '</div>';

    content.innerHTML = html;

    // Show
    document.getElementById('bc-slideover-backdrop').classList.remove('hidden');
    var panel = document.getElementById('bc-slideover');
    panel.classList.remove('translate-x-full');
    panel.classList.add('translate-x-0');
  },

  closeSlideOver: function() {
    document.getElementById('bc-slideover-backdrop').classList.add('hidden');
    var panel = document.getElementById('bc-slideover');
    panel.classList.add('translate-x-full');
    panel.classList.remove('translate-x-0');
  },

  /* ================================================================
     CONFIG: INLINE EDIT + TOGGLE
     ================================================================ */
  inlineEditConfig: function(key) {
    var el = document.getElementById('bc-cfg-val-' + key);
    if (!el) return;
    var current = el.textContent;
    var input = document.createElement('input');
    input.type = 'text';
    input.value = current;
    input.className = 'bg-slate-700 text-cyan-400 font-mono px-2 py-1 rounded text-sm w-28 border border-cyan-500/50 focus:outline-none';
    input.onblur = async function() {
      var newVal = input.value.trim();
      el.textContent = newVal;
      el.style.display = '';
      input.remove();
      try {
        if (typeof API !== 'undefined' && API.postflow && API.postflow.setConfig) {
          await API.postflow.setConfig(key, newVal);
          if (typeof TOAST !== 'undefined') TOAST.show('Config "' + key + '" updated', 'success');
        }
      } catch (err) {
        el.textContent = current;
        if (typeof TOAST !== 'undefined') TOAST.show('Failed to update config', 'error');
      }
    };
    input.onkeydown = function(e) {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') { el.textContent = current; el.style.display = ''; input.remove(); }
    };
    el.style.display = 'none';
    el.parentNode.insertBefore(input, el);
    input.focus();
    input.select();
  },

  toggleConfigValue: async function(key) {
    var btn = document.getElementById('bc-cfg-toggle-' + key);
    var label = document.getElementById('bc-cfg-label-' + key);
    if (!btn || !label) return;

    var isOn = btn.classList.contains('bg-emerald-500');
    var newVal = !isOn;

    btn.classList.toggle('bg-emerald-500', newVal);
    btn.classList.toggle('bg-slate-600', !newVal);
    var dot = btn.querySelector('span');
    dot.style.left = newVal ? '20px' : '2px';
    label.textContent = newVal ? 'true' : 'false';
    label.classList.toggle('text-emerald-400', newVal);
    label.classList.toggle('text-red-400', !newVal);

    try {
      if (typeof API !== 'undefined' && API.postflow && API.postflow.setConfig) {
        await API.postflow.setConfig(key, String(newVal));
        if (typeof TOAST !== 'undefined') TOAST.show('Config "' + key + '" set to ' + newVal, 'success');
      }
    } catch (err) {
      // Revert
      btn.classList.toggle('bg-emerald-500', isOn);
      btn.classList.toggle('bg-slate-600', !isOn);
      dot.style.left = isOn ? '20px' : '2px';
      label.textContent = isOn ? 'true' : 'false';
      label.classList.toggle('text-emerald-400', isOn);
      label.classList.toggle('text-red-400', !isOn);
      if (typeof TOAST !== 'undefined') TOAST.show('Failed to toggle config', 'error');
    }
  },

  /* ================================================================
     ALERTS: DISMISS + CREATE
     ================================================================ */
  dismissAlert: async function(alertId) {
    try {
      if (typeof API !== 'undefined' && API.postflow && API.postflow.dismissAlert) {
        await API.postflow.dismissAlert(alertId);
      }
      var item = document.getElementById('bc-alert-item-' + alertId);
      if (item) {
        item.style.opacity = '0.3';
        item.style.pointerEvents = 'none';
        setTimeout(function() { item.remove(); }, 300);
      }
      if (typeof TOAST !== 'undefined') TOAST.show('Alert dismissed', 'success');
    } catch (err) {
      if (typeof TOAST !== 'undefined') TOAST.show('Failed to dismiss alert', 'error');
    }
  },

  openAlertModal: function() {
    document.getElementById('bc-alert-severity').value = 'warning';
    document.getElementById('bc-alert-message').value = '';
    document.getElementById('bc-modal-backdrop').classList.remove('hidden');
    document.getElementById('bc-alert-modal').classList.remove('hidden');
    document.getElementById('bc-alert-message').focus();
  },

  closeAlertModal: function() {
    document.getElementById('bc-alert-modal').classList.add('hidden');
    document.getElementById('bc-modal-backdrop').classList.add('hidden');
  },

  createAlert: async function() {
    var message = document.getElementById('bc-alert-message').value.trim();
    if (!message) {
      if (typeof TOAST !== 'undefined') TOAST.show('Alert message is required', 'error');
      return;
    }
    var severity = document.getElementById('bc-alert-severity').value;
    try {
      if (typeof API !== 'undefined' && API.postflow && API.postflow.createAlert) {
        await API.postflow.createAlert({ severity: severity, message: message });
      }
      this.closeAlertModal();
      if (typeof TOAST !== 'undefined') TOAST.show('Alert created', 'success');
      this.init();
    } catch (err) {
      if (typeof TOAST !== 'undefined') TOAST.show('Failed to create alert', 'error');
    }
  },

  /* ================================================================
     DELETE CONFIRMATION
     ================================================================ */
  confirmDeleteBatch: function(batchId) {
    document.getElementById('bc-confirm-text').textContent = 'Are you sure you want to delete this batch? All associated data will be lost. This action cannot be undone.';
    this._deleteCallback = async function() {
      try {
        if (typeof API !== 'undefined' && API.postflow && API.postflow.delete) {
          await API.postflow.delete(batchId);
        }
        POSTFLOW_UI.closeSlideOver();
        if (typeof TOAST !== 'undefined') TOAST.show('Batch deleted', 'success');
        POSTFLOW_UI.init();
      } catch (err) {
        if (typeof TOAST !== 'undefined') TOAST.show('Failed to delete batch', 'error');
      }
    };
    document.getElementById('bc-modal-backdrop').classList.remove('hidden');
    document.getElementById('bc-confirm-modal').classList.remove('hidden');
  },

  executeDelete: function() {
    this.closeConfirmModal();
    if (this._deleteCallback) { this._deleteCallback(); this._deleteCallback = null; }
  },

  closeConfirmModal: function() {
    document.getElementById('bc-confirm-modal').classList.add('hidden');
    document.getElementById('bc-modal-backdrop').classList.add('hidden');
  },

  closeAllModals: function() {
    document.getElementById('bc-batch-modal').classList.add('hidden');
    document.getElementById('bc-editor-modal').classList.add('hidden');
    document.getElementById('bc-confirm-modal').classList.add('hidden');
    document.getElementById('bc-alert-modal').classList.add('hidden');
    document.getElementById('bc-modal-backdrop').classList.add('hidden');
  },

  /* ================================================================
     ACTION HELPERS
     ================================================================ */
  triggerRun: async function() {
    try {
      if (typeof API !== 'undefined' && API.postflow && API.postflow.triggerRun) {
        await API.postflow.triggerRun();
        if (typeof TOAST !== 'undefined') TOAST.show('Pipeline run triggered', 'success');
        this.init();
      }
    } catch (err) {
      if (typeof TOAST !== 'undefined') TOAST.show('Failed to trigger run: ' + (err.message || err), 'error');
    }
  },

  triggerRunForBatch: async function(batchId) {
    try {
      if (typeof API !== 'undefined' && API.postflow && API.postflow.triggerRun) {
        await API.postflow.triggerRun(batchId);
        if (typeof TOAST !== 'undefined') TOAST.show('Run triggered for batch', 'success');
      }
    } catch (err) {
      if (typeof TOAST !== 'undefined') TOAST.show('Failed to trigger run', 'error');
    }
  },

  retryRun: async function(runId) {
    try {
      if (typeof API !== 'undefined' && API.postflow && API.postflow.retryRun) {
        await API.postflow.retryRun(runId);
        if (typeof TOAST !== 'undefined') TOAST.show('Retrying failed targets for run #' + runId, 'success');
      }
    } catch (err) {
      if (typeof TOAST !== 'undefined') TOAST.show('Retry failed', 'error');
    }
  },

  toggleBatchPause: async function(batchId) {
    var batch = this._cachedBatches.find(function(b) { return b.id === batchId; });
    if (!batch) return;
    var newStatus = batch.status === 'paused' ? 'active' : 'paused';
    try {
      if (typeof API !== 'undefined' && API.postflow && API.postflow.update) {
        await API.postflow.update(batchId, { status: newStatus });
        if (typeof TOAST !== 'undefined') TOAST.show('Batch ' + (newStatus === 'paused' ? 'paused' : 'resumed'), 'success');
        this.closeSlideOver();
        this.init();
      }
    } catch (err) {
      if (typeof TOAST !== 'undefined') TOAST.show('Failed to update batch status', 'error');
    }
  },

  /* ================================================================
     INIT -- Load all data from API and render every sub-page
     ================================================================ */
  init: async function() {
    this._initTimeTagInput();

    // Guard: if API is not available, do nothing (static HTML remains)
    if (typeof API === 'undefined' || !API.postflow) return;

    try {
      // Load all data in parallel
      var results = await Promise.allSettled([
        API.postflow.getDashboard  ? API.postflow.getDashboard()  : Promise.resolve(null),
        API.postflow.getAll        ? API.postflow.getAll()        : Promise.resolve(null),
        API.postflow.getRuns       ? API.postflow.getRuns()       : Promise.resolve(null),
        API.postflow.getProblems   ? API.postflow.getProblems()   : Promise.resolve(null),
        API.postflow.getCoverage   ? API.postflow.getCoverage()   : Promise.resolve(null),
        API.postflow.getEditors    ? API.postflow.getEditors()    : Promise.resolve(null),
        API.postflow.getConfig     ? API.postflow.getConfig()     : Promise.resolve(null),
        API.postflow.getAlerts     ? API.postflow.getAlerts()     : Promise.resolve(null)
      ]);

      var val = function(r) { return r.status === 'fulfilled' ? r.value : null; };

      var dashboard = val(results[0]);
      var batches   = val(results[1]);
      var runs      = val(results[2]);
      var problems  = val(results[3]);
      var coverage  = val(results[4]);
      var editors   = val(results[5]);
      var config    = val(results[6]);
      var alerts    = val(results[7]);

      if (dashboard) this.renderDashboard(dashboard);
      if (batches)   this.renderBatchGrid(batches);
      if (runs)      this.renderRunsTable(runs);
      if (problems !== null) this.renderProblemsPanel(problems);
      if (coverage)  this.renderCoverageTable(coverage);
      if (editors)   this.renderEditorsTable(editors);
      if (config)    this.renderConfigPanel(config);
      if (alerts !== null) this.renderAlertsPanel(alerts);

    } catch (err) {
      console.error('[POSTFLOW_UI] init failed:', err);
    }
  }

};

/* Auto-init when DOM is ready */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() { POSTFLOW_UI.init(); });
} else {
  POSTFLOW_UI.init();
}
