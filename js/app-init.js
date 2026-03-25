/* ===========================================================
   APP-INIT: System Navigation + Page Orchestrator
   Loads AFTER: api-layer, security, ui-utils, auth,
                postflow-crud, autoeditors-crud, superboost-crud
   =========================================================== */

/* ---- Global state ---- */
let activeSystem = 'postflow';

const SYSTEM_CONFIG = {
  postflow:    { accent: 'cyan',   label: 'Postflow',     icon: 'ph-stack' },
  autoeditors: { accent: 'violet', label: 'Autoeditors',  icon: 'ph-google-drive-logo' },
  superboost:  { accent: 'amber',  label: 'Superboost',   icon: 'ph-rocket-launch' }
};


/* ===========================================================
   SYSTEM SWITCHING
   =========================================================== */

function switchSystem(system) {
  if (!SYSTEM_CONFIG[system]) return;
  activeSystem = system;
  const config = SYSTEM_CONFIG[system];

  // Hide all system pages
  document.querySelectorAll('.system-page').forEach(p => {
    p.classList.remove('active');
  });

  // Show the selected system page
  const target = document.getElementById('system-' + system);
  if (target) target.classList.add('active');

  // Hide global pages
  document.querySelectorAll('.section-page').forEach(p => {
    p.classList.remove('active');
    p.style.display = 'none';
  });

  // Update system buttons
  document.querySelectorAll('.system-btn').forEach(btn => {
    btn.classList.remove('active', 'bg-slate-800/80', 'text-white');
    btn.classList.add('text-slate-400', 'hover:bg-slate-800');
    const span = btn.querySelector('span:last-child');
    if (span) span.classList.remove('text-white', 'font-medium');
  });
  const activeBtn = document.getElementById('sys-btn-' + system);
  if (activeBtn) {
    activeBtn.classList.add('active', 'bg-slate-800/80');
    activeBtn.classList.remove('text-slate-400', 'hover:bg-slate-800');
    const span = activeBtn.querySelector('span:last-child');
    if (span) {
      span.classList.add('text-white', 'font-medium');
    }
  }

  // Update sidebar nav groups visibility
  document.querySelectorAll('[data-nav-system]').forEach(g => {
    g.classList.toggle('hidden', g.getAttribute('data-nav-system') !== system);
  });

  // Update topbar accent
  const topbar = document.getElementById('app-topbar');
  if (topbar) {
    topbar.classList.remove('topbar-accent-postflow', 'topbar-accent-autoeditors', 'topbar-accent-superboost');
    topbar.classList.add('topbar-accent-' + system);
  }

  // Update system label in topbar
  const sysLabel = document.getElementById('system-label');
  if (sysLabel) {
    sysLabel.textContent = config.label;
    sysLabel.className = 'text-xs font-medium px-2 py-0.5 rounded-full bg-' + config.accent + '-500/15 text-' + config.accent + '-400 border border-' + config.accent + '-500/30';
  }

  // Update page title
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = 'Dashboard';

  // Re-apply role restrictions
  if (typeof AUTH !== 'undefined' && AUTH.applyRoleRestrictions) {
    AUTH.applyRoleRestrictions();
  }
}


/* ===========================================================
   GLOBAL PAGE SWITCHING (Users, Audit, Notifications)
   =========================================================== */

function switchToGlobalPage(page) {
  document.querySelectorAll('.system-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.section-page').forEach(p => {
    p.classList.remove('active');
    p.style.display = 'none';
  });

  const target = document.getElementById('page-' + page);
  if (target) {
    target.classList.add('active');
    target.style.display = '';
  }

  const titles = { users: 'User Management', audit: 'Audit Log', notifications: 'Notifications', settings: 'Settings' };
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = titles[page] || page;

  // Render settings page content when navigating to it
  if (page === 'settings' && typeof SETTINGS_PAGE !== 'undefined') {
    SETTINGS_PAGE.render();
  }

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navItem = document.getElementById('nav-' + page);
  if (navItem) navItem.classList.add('active');
}

window.switchPage = function(page) {
  const globalPages = { users: 1, audit: 1, settings: 1 };
  if (globalPages[page]) {
    switchToGlobalPage(page);
  }
};


/* ===========================================================
   NOTIFICATIONS PAGE
   =========================================================== */

function showNotificationsPage(system) {
  switchToGlobalPage('notifications');
  document.querySelectorAll('.notif-system-block').forEach(b => b.classList.add('hidden'));
  const block = document.getElementById('notif-' + system);
  if (block) block.classList.remove('hidden');

  const iconEl = document.getElementById('notif-icon');
  const titleEl = document.getElementById('notif-title');
  const config = SYSTEM_CONFIG[system];
  if (iconEl) {
    iconEl.className = 'ph-bold ph-paper-plane-tilt text-' + config.accent + '-400 text-2xl';
  }
  if (titleEl) {
    titleEl.textContent = config.label + ' — Telegram Notifications';
  }
}

function toggleNotif(btn) {
  const isOn = btn.classList.contains('on');
  btn.classList.toggle('on', !isOn);
  btn.classList.toggle('off', isOn);
}


/* ===========================================================
   BATCHES SUB-PAGE NAVIGATION
   =========================================================== */

function switchSubPage(system, subPage) {
  if (system !== 'postflow') return;
  document.querySelectorAll('.postflow-sub-page').forEach(function(el) {
    el.classList.add('hidden');
  });
  var target = document.getElementById('postflow-sub-' + subPage);
  if (target) target.classList.remove('hidden');
  // Update sidebar nav active states
  var navGroup = document.getElementById('nav-group-postflow');
  if (navGroup) {
    navGroup.querySelectorAll('.nav-item').forEach(function(item) {
      item.classList.remove('active');
      var oc = item.getAttribute('onclick') || '';
      if (oc.indexOf("'" + subPage + "'") !== -1) {
        item.classList.add('active');
      }
    });
  }
  // Update page title
  var titles = {
    'dashboard': 'Dashboard', 'list': 'Batches', 'runs': 'Runs',
    'problems': 'Problems', 'coverage': 'Coverage', 'editors': 'Editors',
    'config': 'Config', 'alerts': 'Alerts'
  };
  var titleEl = document.getElementById('page-title');
  if (titleEl && titles[subPage]) titleEl.textContent = titles[subPage];
}

// Batch detail expand/collapse
function toggleBatchDetail(batchId) {
  var el = document.getElementById('batch-detail-' + batchId);
  if (!el) return;
  var card = el.closest('[data-expanded]');
  var isHidden = el.classList.contains('hidden');
  el.classList.toggle('hidden');
  if (card) card.setAttribute('data-expanded', isHidden ? 'true' : 'false');
}

// Batches config inline edit
function bsEditConfig(key) {
  var el = document.getElementById('bs-cfg-' + key);
  if (!el) return;
  var current = el.textContent;
  var input = document.createElement('input');
  input.type = 'text';
  input.value = current;
  input.className = 'bg-slate-700 text-cyan-400 font-mono px-2 py-1 rounded text-sm w-24 border border-cyan-500/50 focus:outline-none';
  input.onblur = function() { el.textContent = input.value; el.style.display = ''; input.remove(); };
  input.onkeydown = function(e) {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { el.textContent = current; el.style.display = ''; input.remove(); }
  };
  el.style.display = 'none';
  el.parentNode.insertBefore(input, el);
  input.focus();
  input.select();
}

// Batches config toggle
function bsToggleConfig(key) {
  var btn = document.getElementById('bs-toggle-' + key);
  var label = document.getElementById('bs-cfg-' + key);
  if (!btn || !label) return;
  var isOn = btn.classList.contains('bg-emerald-500');
  btn.classList.toggle('bg-emerald-500', !isOn);
  btn.classList.toggle('bg-slate-600', isOn);
  var dot = btn.querySelector('span');
  if (isOn) {
    dot.classList.remove('left-5'); dot.classList.add('left-0.5');
    label.textContent = 'false';
    label.classList.remove('text-emerald-400'); label.classList.add('text-red-400');
  } else {
    dot.classList.remove('left-0.5'); dot.classList.add('left-5');
    label.textContent = 'true';
    label.classList.remove('text-red-400'); label.classList.add('text-emerald-400');
  }
}

// Release quarantine
function bsReleaseQuarantine(btn) {
  btn.innerHTML = '<i class="ph-bold ph-check-circle"></i> Released';
  btn.classList.remove('text-emerald-400', 'hover:text-emerald-300');
  btn.classList.add('text-slate-500');
  btn.disabled = true;
  btn.style.pointerEvents = 'none';
  var card = btn.closest('.border-red-500');
  if (card) card.classList.add('opacity-50');
}


/* ===========================================================
   GDRIVE SUB-PAGE NAVIGATION
   =========================================================== */

function switchGdriveSubPage(page) {
  document.querySelectorAll('.autoeditors-sub-page').forEach(function(el) {
    el.classList.add('hidden');
  });
  var target = document.getElementById('autoeditors-sub-' + page);
  if (target) target.classList.remove('hidden');
  // Update sidebar nav active states
  var navGroup = document.getElementById('nav-group-autoeditors');
  if (navGroup) {
    navGroup.querySelectorAll('.nav-item').forEach(function(item) {
      item.classList.remove('active');
      var oc = item.getAttribute('onclick') || '';
      if (oc.indexOf("'" + page + "'") !== -1) {
        item.classList.add('active');
      }
    });
  }
  // Update page title
  var titles = {
    'dashboard': 'Dashboard', 'editors': 'Editors', 'assignments': 'Assignments',
    'folders': 'Drive Folders', 'logs': 'Logs', 'config': 'Config'
  };
  var titleEl = document.getElementById('page-title');
  if (titleEl && titles[page]) titleEl.textContent = titles[page];
}

// Autoeditors editor toggle
function toggleGdriveEditor(btn, editorKey) {
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
}

// Autoeditors assignment filter
function filterGdriveAssignments(btn, status) {
  document.querySelectorAll('.autoeditors-filter-pill').forEach(function(pill) {
    pill.classList.remove('bg-violet-600', 'text-white');
    pill.classList.add('text-slate-400', 'bg-slate-800', 'border', 'border-slate-700/50');
  });
  btn.classList.remove('text-slate-400', 'bg-slate-800', 'border', 'border-slate-700/50');
  btn.classList.add('bg-violet-600', 'text-white');
  var rows = document.querySelectorAll('#autoeditors-assignments-table tbody tr');
  rows.forEach(function(row) {
    if (status === 'all' || row.getAttribute('data-status') === status) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

// Autoeditors log filter
function filterGdriveLogs(btn, action) {
  document.querySelectorAll('.autoeditors-log-pill').forEach(function(pill) {
    pill.classList.remove('bg-violet-600', 'text-white');
    pill.classList.add('text-slate-400', 'bg-slate-800', 'border', 'border-slate-700/50');
  });
  btn.classList.remove('text-slate-400', 'bg-slate-800', 'border', 'border-slate-700/50');
  btn.classList.add('bg-violet-600', 'text-white');
  var rows = document.querySelectorAll('#autoeditors-logs-table tbody tr');
  rows.forEach(function(row) {
    if (action === 'all' || row.getAttribute('data-action') === action) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

// Autoeditors config inline edit
function editGdriveConfig(key) {
  var el = document.getElementById('autoeditors-cfg-val-' + key);
  var current = el.textContent;
  var input = document.createElement('input');
  input.type = 'text';
  input.value = current;
  input.className = 'bg-slate-700 text-violet-400 font-mono px-2 py-1 rounded text-sm w-24 border border-violet-500/50 focus:outline-none';
  input.onblur = function() { el.textContent = input.value; el.style.display = ''; input.remove(); };
  input.onkeydown = function(e) {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { el.textContent = current; el.style.display = ''; input.remove(); }
  };
  el.style.display = 'none';
  el.parentNode.insertBefore(input, el);
  input.focus();
  input.select();
}

// Autoeditors config toggle
function toggleGdriveConfig(btn, key) {
  var label = document.getElementById('autoeditors-cfg-val-' + key);
  var isOn = btn.classList.contains('bg-emerald-500');
  btn.classList.toggle('bg-emerald-500', !isOn);
  btn.classList.toggle('bg-slate-600', isOn);
  var dot = btn.querySelector('span');
  if (isOn) {
    dot.style.left = '2px';
    label.textContent = 'false'; label.classList.remove('text-emerald-400'); label.classList.add('text-red-400');
  } else {
    dot.style.left = '20px';
    label.textContent = 'true'; label.classList.remove('text-red-400'); label.classList.add('text-emerald-400');
  }
}


/* ===========================================================
   SUPERBOOST SUB-PAGE NAVIGATION
   =========================================================== */

function sbSwitchSubPage(subpage) {
  document.querySelectorAll('#sb-section .superboost-subpage').forEach(function(p) {
    p.classList.add('hidden');
  });
  var target = document.getElementById('superboost-' + subpage);
  if (target) target.classList.remove('hidden');
  // Update sidebar nav active states
  var navGroup = document.getElementById('nav-group-superboost');
  if (navGroup) {
    navGroup.querySelectorAll('.nav-item').forEach(function(item) {
      item.classList.remove('active');
      var oc = item.getAttribute('onclick') || '';
      if (oc.indexOf("'" + subpage + "'") !== -1) {
        item.classList.add('active');
      }
    });
  }
  // Update page title
  var titles = {
    'dashboard': 'Dashboard', 'accounts': 'Accounts', 'tasks': 'Tasks',
    'rules': 'Rules', 'assistants': 'Assistants', 'sheets-sync': 'Sheets Sync', 'config': 'Config'
  };
  var titleEl = document.getElementById('page-title');
  if (titleEl && titles[subpage]) titleEl.textContent = titles[subpage];
}

function sbSwitchSubPageNav(subpage) {
  sbSwitchSubPage(subpage);
}

// Superboost scheduling toggle
function sbToggleScheduling() {
  var btn = document.getElementById('sb-scheduling-btn');
  if (!btn) return;
  var isPaused = btn.classList.contains('bg-slate-600');
  if (isPaused) {
    btn.classList.remove('bg-slate-600', 'hover:bg-slate-500');
    btn.classList.add('bg-amber-600', 'hover:bg-amber-500');
    btn.innerHTML = '<i class="ph-bold ph-pause"></i><span>Pause</span>';
  } else {
    btn.classList.remove('bg-amber-600', 'hover:bg-amber-500');
    btn.classList.add('bg-slate-600', 'hover:bg-slate-500');
    btn.innerHTML = '<i class="ph-bold ph-play"></i><span>Resume</span>';
  }
}

// Superboost config inline edit
function sbEditConfig(key) {
  var el = document.getElementById('sb-cfg-' + key);
  if (!el) return;
  var current = el.textContent;
  var input = document.createElement('input');
  input.type = 'text';
  input.value = current;
  input.className = 'bg-slate-700 text-amber-400 font-mono px-2 py-1 rounded text-sm w-24 border border-amber-500/50 focus:outline-none';
  input.onblur = function() { el.textContent = input.value; el.style.display = ''; input.remove(); };
  input.onkeydown = function(e) {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { el.textContent = current; el.style.display = ''; input.remove(); }
  };
  el.style.display = 'none';
  el.parentNode.insertBefore(input, el);
  input.focus();
  input.select();
}

// Superboost config toggle
function sbToggleConfig(key) {
  var btn = document.getElementById('sb-toggle-' + key);
  var label = document.getElementById('sb-cfg-val-' + key);
  if (!label) return;
  var isOn = btn.classList.contains('bg-emerald-500');
  btn.classList.toggle('bg-emerald-500', !isOn);
  btn.classList.toggle('bg-slate-600', isOn);
  var dot = btn.querySelector('span');
  if (isOn) {
    dot.classList.remove('left-5'); dot.classList.add('left-0.5');
    label.textContent = 'false'; label.classList.remove('text-emerald-400'); label.classList.add('text-red-400');
  } else {
    dot.classList.remove('left-0.5'); dot.classList.add('left-5');
    label.textContent = 'true'; label.classList.remove('text-red-400'); label.classList.add('text-emerald-400');
  }
}


/* ===========================================================
   INIT — Called on DOMContentLoaded
   =========================================================== */

(function() {
  function initApp() {
    // 0. Check if setup wizard needs to run
    if (typeof SETUP_WIZARD !== 'undefined' && !SETUP_WIZARD.isComplete()) {
      // Hide login page, show wizard
      var loginPage = document.getElementById('login-page');
      if (loginPage) loginPage.classList.add('hidden');
      SETUP_WIZARD.init();
      // Still init API so wizard can write to it on completion
      if (typeof API !== 'undefined' && API.init) API.init();
      return; // Don't init the rest until wizard completes
    }

    // 1. Init API layer (seeds data if empty)
    if (typeof API !== 'undefined' && API.init) {
      API.init();
    }

    // 2. Apply security patches
    if (typeof SECURITY !== 'undefined' && SECURITY.applyPatches) {
      SECURITY.applyPatches();
    }

    // 3. Init AUTH (shows login page)
    if (typeof AUTH !== 'undefined' && AUTH.init) {
      AUTH.init();
    }

    // 4. Init CRUD modules (they render into their containers)
    if (typeof POSTFLOW_UI !== 'undefined' && POSTFLOW_UI.init) {
      POSTFLOW_UI.init();
    }
    if (typeof AUTOEDITORS_UI !== 'undefined' && AUTOEDITORS_UI.init) {
      AUTOEDITORS_UI.init();
    }
    if (typeof SB_UI !== 'undefined' && SB_UI.init) {
      SB_UI.init();
    }

    // 5. Default: show Postflow system
    switchSystem('postflow');
  }

  // Expose so wizard can call it after completion
  window._initApp = initApp;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
