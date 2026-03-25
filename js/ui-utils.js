/* ===========================================================
   1. TOAST — Notification System
   =========================================================== */
const TOAST = {

  MAX_VISIBLE: 5,
  DEFAULT_DURATION: 4000,
  ERROR_DURATION: 6000,

  TYPES: {
    success: { icon: 'ph-check-circle', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-400', iconColor: 'text-emerald-400' },
    error:   { icon: 'ph-x-circle',     bg: 'bg-red-500/15',     border: 'border-red-500/30',     text: 'text-red-400',     iconColor: 'text-red-400' },
    warning: { icon: 'ph-warning',       bg: 'bg-amber-500/15',   border: 'border-amber-500/30',   text: 'text-amber-400',   iconColor: 'text-amber-400' },
    info:    { icon: 'ph-info',          bg: 'bg-cyan-500/15',    border: 'border-cyan-500/30',    text: 'text-cyan-400',    iconColor: 'text-cyan-400' }
  },

  _counter: 0,

  show(message, type) {
    type = type || 'info';
    const cfg = this.TYPES[type] || this.TYPES.info;
    const container = document.getElementById('toast-container');
    if (!container) return;

    // Enforce max visible
    const existing = container.querySelectorAll('.toast-item');
    if (existing.length >= this.MAX_VISIBLE) {
      this._dismiss(existing[0]);
    }

    const id = 'toast-' + (++this._counter);
    const duration = type === 'error' ? this.ERROR_DURATION : this.DEFAULT_DURATION;

    const el = document.createElement('div');
    el.id = id;
    el.className = 'toast-item toast-enter flex items-start gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm shadow-lg shadow-black/20 min-w-[320px] max-w-[420px] ' + cfg.bg + ' ' + cfg.border;
    el.innerHTML =
      '<i class="ph-bold ' + cfg.icon + ' ' + cfg.iconColor + ' text-lg flex-shrink-0 mt-0.5"></i>' +
      '<span class="text-sm ' + cfg.text + ' flex-1">' + this._escapeHtml(message) + '</span>' +
      '<button onclick="TOAST.dismiss(\'' + id + '\')" class="flex-shrink-0 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer ml-2 mt-0.5">' +
        '<i class="ph-bold ph-x text-sm"></i>' +
      '</button>';

    container.appendChild(el);

    // Auto-dismiss
    el._timeout = setTimeout(function() { TOAST.dismiss(id); }, duration);
  },

  dismiss(id) {
    const el = document.getElementById(id);
    if (!el) return;
    this._dismiss(el);
  },

  _dismiss(el) {
    if (el._dismissed) return;
    el._dismissed = true;
    if (el._timeout) clearTimeout(el._timeout);
    el.classList.remove('toast-enter');
    el.classList.add('toast-exit');
    setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 200);
  },

  success(message) { this.show(message, 'success'); },
  error(message)   { this.show(message, 'error'); },
  warning(message) { this.show(message, 'warning'); },
  info(message)    { this.show(message, 'info'); },

  _escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};


/* ===========================================================
   2. CONFIRM — Confirmation Dialog
   =========================================================== */
const CONFIRM = {

  TYPE_CONFIG: {
    danger:  { icon: 'ph-trash',   iconBg: 'bg-red-500/15',   iconColor: 'text-red-400',   btnBg: 'bg-red-600 hover:bg-red-500',   borderColor: 'border-red-500/30' },
    warning: { icon: 'ph-warning', iconBg: 'bg-amber-500/15', iconColor: 'text-amber-400', btnBg: 'bg-amber-600 hover:bg-amber-500', borderColor: 'border-amber-500/30' },
    info:    { icon: 'ph-info',    iconBg: 'bg-cyan-500/15',  iconColor: 'text-cyan-400',  btnBg: 'bg-cyan-600 hover:bg-cyan-500',  borderColor: 'border-cyan-500/30' }
  },

  _onConfirm: null,
  _onCancel: null,
  _keyHandler: null,

  show(opts) {
    opts = opts || {};
    var type = opts.type || 'info';
    var cfg = this.TYPE_CONFIG[type] || this.TYPE_CONFIG.info;

    var modal = document.getElementById('confirm-modal');
    var card  = document.getElementById('confirm-modal-card');
    var iconEl = document.getElementById('confirm-modal-icon');
    var titleEl = document.getElementById('confirm-modal-title');
    var msgEl   = document.getElementById('confirm-modal-message');
    var confirmBtn = document.getElementById('confirm-modal-confirm');
    var cancelBtn  = document.getElementById('confirm-modal-cancel');

    if (!modal) return;

    // Set content
    titleEl.textContent = opts.title || 'Are you sure?';
    msgEl.textContent = opts.message || '';

    // Set icon
    iconEl.className = 'inline-flex items-center justify-center w-14 h-14 rounded-full mb-4 ' + cfg.iconBg;
    iconEl.innerHTML = '<i class="ph-bold ' + cfg.icon + ' ' + cfg.iconColor + ' text-2xl"></i>';

    // Set confirm button
    confirmBtn.className = 'px-5 py-2 rounded-lg text-sm font-medium text-white transition-colors cursor-pointer flex items-center gap-2 ' + cfg.btnBg;
    confirmBtn.textContent = opts.confirmText || 'Confirm';

    // Set cancel button text
    cancelBtn.textContent = opts.cancelText || 'Cancel';

    // Set border color on card
    card.className = card.className.replace(/border-\w+-\d+\/\d+/g, '');
    card.className = 'bg-slate-800 border ' + cfg.borderColor + ' rounded-2xl shadow-2xl shadow-black/40 w-full max-w-sm mx-4 p-6 text-center';

    // Store callbacks
    this._onConfirm = opts.onConfirm || null;
    this._onCancel = opts.onCancel || null;

    // Show modal
    modal.classList.remove('hidden');
    // Animate in
    requestAnimationFrame(function() {
      card.classList.remove('scale-95', 'opacity-0');
      card.classList.add('confirm-enter');
    });

    // Wire buttons
    var self = this;
    confirmBtn.onclick = function() { self._resolve(true); };
    cancelBtn.onclick = function() { self._resolve(false); };

    // Keyboard handling
    this._keyHandler = function(e) {
      if (e.key === 'Enter') { e.preventDefault(); self._resolve(true); }
      if (e.key === 'Escape') { e.preventDefault(); self._resolve(false); }
    };
    document.addEventListener('keydown', this._keyHandler);

    // Focus trap — focus the cancel button initially for safety
    cancelBtn.focus();
  },

  _resolve(confirmed) {
    var modal = document.getElementById('confirm-modal');
    var card  = document.getElementById('confirm-modal-card');
    if (!modal || modal.classList.contains('hidden')) return;

    // Remove keyboard handler
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }

    // Animate out
    card.classList.remove('confirm-enter');
    card.classList.add('confirm-exit');

    var onConfirm = this._onConfirm;
    var onCancel = this._onCancel;
    this._onConfirm = null;
    this._onCancel = null;

    setTimeout(function() {
      modal.classList.add('hidden');
      card.classList.remove('confirm-exit');
      card.classList.add('scale-95', 'opacity-0');
      if (confirmed && typeof onConfirm === 'function') onConfirm();
      if (!confirmed && typeof onCancel === 'function') onCancel();
    }, 150);
  }
};


/* ===========================================================
   3. LOADING — Spinner System
   =========================================================== */
const LOADING = {

  show(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    // Avoid duplicates
    if (container.querySelector('.loading-inline')) return;

    container.style.position = container.style.position || 'relative';
    var wrapper = document.createElement('div');
    wrapper.className = 'loading-inline absolute inset-0 flex items-center justify-center bg-slate-900/60 rounded-xl z-10';
    wrapper.innerHTML =
      '<div class="flex flex-col items-center gap-3">' +
        '<div class="loading-ring w-8 h-8 border-3 border-slate-600 border-t-cyan-400 rounded-full" style="border-width:3px;"></div>' +
        '<span class="text-xs text-slate-400">Loading...</span>' +
      '</div>';
    container.appendChild(wrapper);
  },

  hide(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var spinner = container.querySelector('.loading-inline');
    if (spinner) spinner.remove();
  },

  showOverlay() {
    var overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.remove('hidden');
  },

  hideOverlay() {
    var overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.add('hidden');
  },

  /** Returns inline pulsing dots HTML (for embedding inside buttons, cells, etc.) */
  dots() {
    return '<span class="loading-dots inline-flex gap-1 items-center"><span></span><span></span><span></span></span>';
  }
};


/* ===========================================================
   4. EMPTY — Empty State Component
   =========================================================== */
const EMPTY = {

  render(containerId, opts) {
    opts = opts || {};
    var container = document.getElementById(containerId);
    if (!container) return;

    var iconClass  = opts.icon || 'ph-bold ph-magnifying-glass';
    var title      = opts.title || 'Nothing here yet';
    var desc       = opts.description || '';
    var actionText = opts.actionText || '';
    var actionFn   = opts.actionFn || null;
    var accent     = opts.accent || 'cyan';

    var accentMap = {
      cyan:   { btn: 'bg-cyan-600 hover:bg-cyan-500', icon: 'text-cyan-500/40' },
      violet: { btn: 'bg-violet-600 hover:bg-violet-500', icon: 'text-violet-500/40' },
      amber:  { btn: 'bg-amber-600 hover:bg-amber-500', icon: 'text-amber-500/40' }
    };
    var accentCfg = accentMap[accent] || accentMap.cyan;

    var actionId = 'empty-action-' + containerId;
    var actionHtml = '';
    if (actionText) {
      actionHtml =
        '<button id="' + actionId + '" class="mt-5 px-5 py-2 rounded-lg text-sm font-medium text-white transition-colors cursor-pointer ' + accentCfg.btn + '">' +
          actionText +
        '</button>';
    }

    container.innerHTML =
      '<div class="empty-state-box flex flex-col items-center justify-center py-16 px-8">' +
        '<i class="' + iconClass + ' text-5xl ' + accentCfg.icon + ' mb-4"></i>' +
        '<h3 class="text-white font-semibold text-base mb-1">' + this._esc(title) + '</h3>' +
        (desc ? '<p class="text-slate-500 text-sm text-center max-w-xs">' + this._esc(desc) + '</p>' : '') +
        actionHtml +
      '</div>';

    if (actionText && typeof actionFn === 'function') {
      var btn = document.getElementById(actionId);
      if (btn) btn.addEventListener('click', actionFn);
    }
  },

  _esc(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};


/* ===========================================================
   5. SEARCH — Search Input Component
   =========================================================== */
const SEARCH = {

  _timers: {},

  create(containerId, opts) {
    opts = opts || {};
    var container = document.getElementById(containerId);
    if (!container) return;

    var placeholder = opts.placeholder || 'Search...';
    var debounceMs  = opts.debounceMs || 300;
    var onSearch    = opts.onSearch || function() {};
    var inputId     = 'search-input-' + containerId;

    container.innerHTML =
      '<div class="relative">' +
        '<div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">' +
          '<i class="ph-bold ph-magnifying-glass text-slate-500 text-sm"></i>' +
        '</div>' +
        '<input id="' + inputId + '" type="text" placeholder="' + placeholder + '" ' +
          'class="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg pl-9 pr-9 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-colors">' +
        '<button id="' + inputId + '-clear" class="hidden absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer">' +
          '<i class="ph-bold ph-x text-sm"></i>' +
        '</button>' +
      '</div>';

    var input = document.getElementById(inputId);
    var clearBtn = document.getElementById(inputId + '-clear');
    var self = this;

    input.addEventListener('input', function() {
      var val = input.value;
      clearBtn.classList.toggle('hidden', val.length === 0);
      // Debounce
      if (self._timers[inputId]) clearTimeout(self._timers[inputId]);
      self._timers[inputId] = setTimeout(function() {
        onSearch(val.trim());
      }, debounceMs);
    });

    clearBtn.addEventListener('click', function() {
      input.value = '';
      clearBtn.classList.add('hidden');
      if (self._timers[inputId]) clearTimeout(self._timers[inputId]);
      onSearch('');
      input.focus();
    });
  },

  getValue(containerId) {
    var input = document.querySelector('#' + containerId + ' input[type="text"]');
    return input ? input.value.trim() : '';
  },

  clear(containerId) {
    var input = document.querySelector('#' + containerId + ' input[type="text"]');
    if (input) {
      input.value = '';
      input.dispatchEvent(new Event('input'));
    }
  }
};


/* ===========================================================
   6. FILTERS — Filter Pills Component
   =========================================================== */
const FILTERS = {

  _state: {},

  create(containerId, opts) {
    opts = opts || {};
    var container = document.getElementById(containerId);
    if (!container) return;

    var options  = opts.options || [];
    var onChange  = opts.onChange || function() {};
    var accent   = opts.accentColor || 'cyan';

    var accentClasses = {
      cyan:   'bg-cyan-600 text-white',
      violet: 'bg-violet-600 text-white',
      amber:  'bg-amber-600 text-white'
    };
    var activeCls = accentClasses[accent] || accentClasses.cyan;
    var inactiveCls = 'text-slate-400 hover:text-white hover:bg-slate-700';

    this._state[containerId] = { value: null, onChange: onChange };

    var html = '<div class="filter-pills flex gap-2 overflow-x-auto pb-1">';
    for (var i = 0; i < options.length; i++) {
      var opt = options[i];
      var isActive = !!opt.active;
      if (isActive) this._state[containerId].value = opt.value;

      html +=
        '<button data-filter-value="' + opt.value + '" ' +
          'class="filter-pill px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-200 cursor-pointer whitespace-nowrap ' +
          (isActive ? activeCls : inactiveCls) + '" ' +
          'onclick="FILTERS._select(\'' + containerId + '\', \'' + opt.value + '\', \'' + accent + '\')">' +
          this._esc(opt.label) +
        '</button>';
    }
    html += '</div>';
    container.innerHTML = html;
  },

  _select(containerId, value, accent) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var accentClasses = {
      cyan:   'bg-cyan-600 text-white',
      violet: 'bg-violet-600 text-white',
      amber:  'bg-amber-600 text-white'
    };
    var activeCls = accentClasses[accent] || accentClasses.cyan;
    var inactiveCls = 'text-slate-400 hover:text-white hover:bg-slate-700';

    var pills = container.querySelectorAll('.filter-pill');
    for (var i = 0; i < pills.length; i++) {
      var pill = pills[i];
      var isTarget = pill.getAttribute('data-filter-value') === value;

      // Remove all state classes
      pill.className = pill.className
        .replace(/bg-\w+-\d+/g, '')
        .replace(/text-white/g, '')
        .replace(/text-slate-400/g, '')
        .replace(/hover:text-white/g, '')
        .replace(/hover:bg-slate-700/g, '')
        .trim();

      pill.className = 'filter-pill px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-200 cursor-pointer whitespace-nowrap ' +
        (isTarget ? activeCls : inactiveCls);
    }

    if (this._state[containerId]) {
      this._state[containerId].value = value;
      if (typeof this._state[containerId].onChange === 'function') {
        this._state[containerId].onChange(value);
      }
    }
  },

  getValue(containerId) {
    return this._state[containerId] ? this._state[containerId].value : null;
  },

  _esc(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};


/* ===========================================================
   7. TABLE — Data Table Component
   =========================================================== */
const TABLE = {

  _state: {},

  render(containerId, opts) {
    opts = opts || {};
    var container = document.getElementById(containerId);
    if (!container) return;

    var columns    = opts.columns || [];
    var data       = opts.data || [];
    var emptyState = opts.emptyState || null;
    var sortable   = opts.sortable !== false;
    var pageSize   = opts.pageSize || 20;
    var accent     = opts.accent || 'cyan';

    // Init state
    this._state[containerId] = {
      columns: columns,
      data: data,
      filteredData: data.slice(),
      sortKey: null,
      sortDir: 'asc',
      page: 0,
      pageSize: pageSize,
      accent: accent,
      emptyState: emptyState,
      searchable: !!opts.searchable
    };

    this._renderTable(containerId);
  },

  _renderTable(containerId) {
    var container = document.getElementById(containerId);
    var state = this._state[containerId];
    if (!container || !state) return;

    var data = state.filteredData;
    var columns = state.columns;
    var pageSize = state.pageSize;
    var page = state.page;
    var totalPages = Math.max(1, Math.ceil(data.length / pageSize));

    // Clamp page
    if (page >= totalPages) { page = totalPages - 1; state.page = page; }
    if (page < 0) { page = 0; state.page = 0; }

    var start = page * pageSize;
    var end = Math.min(start + pageSize, data.length);
    var pageData = data.slice(start, end);

    // Empty check
    if (data.length === 0 && state.emptyState) {
      EMPTY.render(containerId, state.emptyState);
      return;
    }

    var html = '<div class="overflow-x-auto">';
    html += '<table class="w-full text-sm">';

    // Header
    html += '<thead><tr class="text-slate-500 text-xs uppercase tracking-wider border-b border-slate-700/50">';
    for (var c = 0; c < columns.length; c++) {
      var col = columns[c];
      var sortAttr = '';
      var sortCls = '';
      if (col.sortable && state.sortKey === col.key) {
        sortCls = state.sortDir === 'asc' ? ' sort-icon sort-asc' : ' sort-icon sort-desc';
      }
      if (col.sortable) {
        sortAttr = ' onclick="TABLE._sort(\'' + containerId + '\', \'' + col.key + '\')" style="cursor:pointer;"';
      }
      var align = col.align === 'right' ? 'text-right' : (col.align === 'center' ? 'text-center' : 'text-left');
      html += '<th class="' + align + ' px-6 py-3 font-medium' + sortCls + '"' + sortAttr + '>' + (col.label || '') + '</th>';
    }
    html += '</tr></thead>';

    // Body
    html += '<tbody>';
    for (var r = 0; r < pageData.length; r++) {
      var row = pageData[r];
      html += '<tr class="border-b border-slate-700/30 hover:bg-slate-800/50 transition-colors">';
      for (var c2 = 0; c2 < columns.length; c2++) {
        var col2 = columns[c2];
        var val = row[col2.key];
        var align2 = col2.align === 'right' ? 'text-right' : (col2.align === 'center' ? 'text-center' : 'text-left');
        var cellHtml = typeof col2.render === 'function' ? col2.render(val, row, r) : this._esc(val != null ? String(val) : '');
        html += '<td class="px-6 py-3 ' + align2 + '">' + cellHtml + '</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table></div>';

    // Pagination
    if (data.length > pageSize) {
      html += '<div class="flex items-center justify-between px-6 py-3 border-t border-slate-700/50">';
      html += '<span class="text-xs text-slate-500">Showing ' + (start + 1) + '-' + end + ' of ' + data.length + '</span>';
      html += '<div class="flex items-center gap-2">';
      html += '<button onclick="TABLE._prevPage(\'' + containerId + '\')" class="px-3 py-1 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer' + (page === 0 ? ' opacity-40 pointer-events-none' : '') + '">' +
        '<i class="ph-bold ph-caret-left text-xs"></i> Prev</button>';
      html += '<span class="text-xs text-slate-500 font-mono">' + (page + 1) + ' / ' + totalPages + '</span>';
      html += '<button onclick="TABLE._nextPage(\'' + containerId + '\')" class="px-3 py-1 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer' + (page >= totalPages - 1 ? ' opacity-40 pointer-events-none' : '') + '">' +
        'Next <i class="ph-bold ph-caret-right text-xs"></i></button>';
      html += '</div></div>';
    }

    container.innerHTML = html;
  },

  _sort(containerId, key) {
    var state = this._state[containerId];
    if (!state) return;

    if (state.sortKey === key) {
      state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      state.sortKey = key;
      state.sortDir = 'asc';
    }

    var dir = state.sortDir === 'asc' ? 1 : -1;
    state.filteredData.sort(function(a, b) {
      var va = a[key], vb = b[key];
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });

    state.page = 0;
    this._renderTable(containerId);
  },

  _prevPage(containerId) {
    var state = this._state[containerId];
    if (!state || state.page <= 0) return;
    state.page--;
    this._renderTable(containerId);
  },

  _nextPage(containerId) {
    var state = this._state[containerId];
    if (!state) return;
    var totalPages = Math.ceil(state.filteredData.length / state.pageSize);
    if (state.page >= totalPages - 1) return;
    state.page++;
    this._renderTable(containerId);
  },

  /** Update the data and re-render */
  update(containerId, newData) {
    var state = this._state[containerId];
    if (!state) return;
    state.data = newData;
    state.filteredData = newData.slice();
    state.page = 0;
    // Re-apply sort if active
    if (state.sortKey) {
      this._sort(containerId, state.sortKey);
      return;
    }
    this._renderTable(containerId);
  },

  /** Filter data in-place and re-render */
  filter(containerId, filterFn) {
    var state = this._state[containerId];
    if (!state) return;
    state.filteredData = typeof filterFn === 'function' ? state.data.filter(filterFn) : state.data.slice();
    state.page = 0;
    this._renderTable(containerId);
  },

  _esc(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};


/* ===========================================================
   8. BADGE — Status / Role / Platform / System Badge Renderer
   =========================================================== */
const BADGE = {

  STATUS_MAP: {
    active:    { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
    done:      { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
    completed: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
    pending:   { bg: 'bg-amber-500/20',   text: 'text-amber-400' },
    queued:    { bg: 'bg-amber-500/20',   text: 'text-amber-400' },
    running:   { bg: 'bg-cyan-500/20',    text: 'text-cyan-400' },
    started:   { bg: 'bg-cyan-500/20',    text: 'text-cyan-400' },
    assigned:  { bg: 'bg-cyan-500/20',    text: 'text-cyan-400' },
    failed:    { bg: 'bg-red-500/20',     text: 'text-red-400' },
    error:     { bg: 'bg-red-500/20',     text: 'text-red-400' },
    paused:    { bg: 'bg-slate-600/30',   text: 'text-slate-400' },
    disabled:  { bg: 'bg-slate-600/30',   text: 'text-slate-400' },
    expired:   { bg: 'bg-rose-500/20',    text: 'text-rose-400' },
    blocked:   { bg: 'bg-rose-500/20',    text: 'text-rose-400' },
    idle:      { bg: 'bg-slate-600/30',   text: 'text-slate-400' },
    locked:    { bg: 'bg-red-500/20',     text: 'text-red-400' }
  },

  ROLE_MAP: {
    super_admin: { bg: 'bg-red-500/20',    text: 'text-red-400',    border: 'border border-red-500/30' },
    admin:       { bg: 'bg-amber-500/20',  text: 'text-amber-400',  border: 'border border-amber-500/30' },
    manager:     { bg: 'bg-cyan-500/20',   text: 'text-cyan-400',   border: 'border border-cyan-500/30' },
    assistant:   { bg: 'bg-slate-500/20',  text: 'text-slate-400',  border: 'border border-slate-500/30' }
  },

  ROLE_LABELS: {
    super_admin: 'Super Admin',
    admin:       'Admin',
    manager:     'Manager',
    assistant:   'Assistant'
  },

  PLATFORM_MAP: {
    telegram:  { bg: 'bg-blue-500/20',   text: 'text-blue-400',   icon: 'ph-telegram-logo' },
    autoeditors:    { bg: 'bg-violet-500/20', text: 'text-violet-400', icon: 'ph-google-drive-logo' },
    youtube:   { bg: 'bg-red-500/20',    text: 'text-red-400',    icon: 'ph-youtube-logo' },
    web:       { bg: 'bg-cyan-500/20',   text: 'text-cyan-400',   icon: 'ph-globe' }
  },

  SYSTEM_MAP: {
    postflow:    { bg: 'bg-cyan-500/20',   text: 'text-cyan-400',   label: 'Postflow' },
    autoeditors:     { bg: 'bg-violet-500/20', text: 'text-violet-400', label: 'Autoeditors' },
    superboost: { bg: 'bg-amber-500/20',  text: 'text-amber-400',  label: 'Superboost' },
    auth:       { bg: 'bg-slate-600/30',  text: 'text-slate-400',  label: 'Auth' }
  },

  /** Render a status badge */
  status(value) {
    if (!value) return '';
    var key = String(value).toLowerCase().replace(/\s+/g, '_');
    var cfg = this.STATUS_MAP[key] || { bg: 'bg-slate-600/30', text: 'text-slate-400' };
    var label = String(value).charAt(0).toUpperCase() + String(value).slice(1);
    return '<span class="badge px-2 py-0.5 rounded-full text-xs font-medium ' + cfg.bg + ' ' + cfg.text + '">' + this._esc(label) + '</span>';
  },

  /** Render a role badge */
  role(value) {
    if (!value) return '';
    var key = String(value).toLowerCase().replace(/\s+/g, '_');
    var cfg = this.ROLE_MAP[key] || { bg: 'bg-slate-500/20', text: 'text-slate-400', border: '' };
    var label = this.ROLE_LABELS[key] || String(value);
    return '<span class="badge px-2 py-0.5 rounded-full text-xs font-medium ' + cfg.bg + ' ' + cfg.text + ' ' + (cfg.border || '') + '">' + this._esc(label) + '</span>';
  },

  /** Render a platform badge with icon */
  platform(value) {
    if (!value) return '';
    var key = String(value).toLowerCase();
    var cfg = this.PLATFORM_MAP[key] || { bg: 'bg-slate-600/30', text: 'text-slate-400', icon: 'ph-globe' };
    var label = String(value).charAt(0).toUpperCase() + String(value).slice(1);
    return '<span class="badge px-2 py-0.5 rounded-full text-xs font-medium inline-flex items-center gap-1 ' + cfg.bg + ' ' + cfg.text + '">' +
      '<i class="ph-bold ' + cfg.icon + ' text-[10px]"></i>' + this._esc(label) +
    '</span>';
  },

  /** Render a system badge */
  system(value) {
    if (!value) return '';
    var key = String(value).toLowerCase();
    var cfg = this.SYSTEM_MAP[key] || { bg: 'bg-slate-600/30', text: 'text-slate-400', label: value };
    return '<span class="badge px-2 py-0.5 rounded-full text-xs font-medium ' + cfg.bg + ' ' + cfg.text + '">' + this._esc(cfg.label) + '</span>';
  },

  _esc(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};


/* ===========================================================
   9. APP — Page Init Orchestrator
   =========================================================== */
const APP = {

  _initialized: false,
  _listeners: {},

  init() {
    if (this._initialized) return;
    this._initialized = true;

    // Initialize API layer if present
    if (typeof API !== 'undefined' && typeof API.init === 'function') {
      API.init();
    }

    // Initialize system UIs if present
    var systems = [
      { key: 'postflow',    ui: 'POSTFLOW_UI' },
      { key: 'autoeditors',     ui: 'AUTOEDITORS_UI' },
      { key: 'superboost', ui: 'SUPERBOOST_UI' }
    ];
    for (var i = 0; i < systems.length; i++) {
      var sys = systems[i];
      var uiObj = window[sys.ui];
      if (uiObj && typeof uiObj.init === 'function') {
        try {
          uiObj.init();
        } catch (e) {
          console.error('[APP] Failed to init ' + sys.ui + ':', e);
        }
      }
    }

    // Wire up data change events from API (if API has event support)
    if (typeof API !== 'undefined' && typeof API.on === 'function') {
      API.on('data:changed', function(detail) {
        APP._emit('data:changed', detail);
        APP.updateBadges();
      });
    }

    // Initial badge update
    this.updateBadges();

    console.log('[APP] Initialized');
  },

  /** Register an event listener */
  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
  },

  /** Remove an event listener */
  off(event, fn) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(function(f) { return f !== fn; });
  },

  _emit(event, data) {
    var fns = this._listeners[event] || [];
    for (var i = 0; i < fns.length; i++) {
      try { fns[i](data); } catch (e) { console.error('[APP] Event handler error:', e); }
    }
  },

  /** Update sidebar badges with problem/issue counts */
  updateBadges() {
    // Problem count badge for postflow
    this._setBadge('nav-badge-problems', this._getCount('problems'));
    // Pending tasks badge
    this._setBadge('nav-badge-tasks', this._getCount('pendingTasks'));
    // Alerts badge
    this._setBadge('nav-badge-alerts', this._getCount('alerts'));
  },

  _getCount(key) {
    // Check if API provides counts
    if (typeof API !== 'undefined' && typeof API.getCounts === 'function') {
      var counts = API.getCounts();
      return counts[key] || 0;
    }
    // Fallback: check for data attributes on badge elements
    var el = document.getElementById('nav-badge-' + key);
    return el ? parseInt(el.textContent, 10) || 0 : 0;
  },

  _setBadge(elementId, count) {
    var el = document.getElementById(elementId);
    if (!el) return;
    if (count > 0) {
      el.textContent = count > 99 ? '99+' : String(count);
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  },

  /** Get the current active system accent color */
  getAccent() {
    if (typeof SYSTEM_CONFIG !== 'undefined' && typeof activeSystem !== 'undefined') {
      var cfg = SYSTEM_CONFIG[activeSystem];
      return cfg ? cfg.accent : 'cyan';
    }
    return 'cyan';
  },

  /** Get system config by key */
  getSystemConfig(system) {
    if (typeof SYSTEM_CONFIG !== 'undefined') {
      return SYSTEM_CONFIG[system] || null;
    }
    return null;
  }
};
