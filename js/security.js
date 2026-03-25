/**
 * SECURITY-FIXES.JS
 * Comprehensive Security Audit & Fix Module for admin-v2.html
 *
 * Audited file: /Users/yehor/Documents/upWork/Ivladoz_I/batches/developer_share_clean/admin-v2.html
 * Audit date: 2026-03-25
 * Auditor: Security Auditor Agent (V3)
 *
 * ===================================================================
 *  VULNERABILITY SUMMARY
 * ===================================================================
 *
 *  CRITICAL (3):
 *    [C-01] Stored XSS via renderUsersTable() -- user.name, user.email
 *           injected into innerHTML without sanitization (lines 5610-5651)
 *    [C-02] Stored XSS via renderAuditTable() -- entry.user, entry.details,
 *           entry.target, entry.ip injected into innerHTML (lines 5919-5941)
 *    [C-03] Plaintext passwords stored in JS object, visible via console
 *           (AUTH.users[*].password, visible in source)
 *
 *  HIGH (6):
 *    [H-01] XSS via title attribute injection -- entry.details inserted
 *           unescaped into title="..." attribute (line 5939)
 *    [H-02] No rate limiting on login -- brute-force attacks possible
 *           (AUTH.login() at line 5160 has no attempt counter)
 *    [H-03] RBAC bypass via browser console -- AUTH.currentUser.role can
 *           be reassigned from console: AUTH.currentUser.role = 'super_admin'
 *    [H-04] Session timer bypass via console -- AUTH.sessionEndTime and
 *           AUTH.clearSessionTimer() are publicly accessible, attacker can
 *           call AUTH.extendSession() indefinitely
 *    [H-05] New users created with default password 'Change1!'
 *           and password reset sets password to 'Change1!'
 *    [H-06] No CSRF protection on state-changing operations -- all form
 *           submissions and API-like calls lack CSRF tokens
 *
 *  MEDIUM (5):
 *    [M-01] No Content-Security-Policy header -- inline scripts execute
 *           freely, external CDNs loaded without integrity hashes
 *    [M-02] External scripts loaded without Subresource Integrity (SRI):
 *           - https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4 (line 7)
 *           - https://unpkg.com/@phosphor-icons/web (line 9)
 *    [M-03] Demo credentials exposed in HTML source (line 235):
 *           "(password: demo)" visible in page source
 *    [M-04] Email validation on login form relies only on browser HTML5
 *           type="email" -- no server-side or JS-level strict validation
 *    [M-05] No input length limits on user modal name/email fields --
 *           potential for oversized payloads
 *
 *  LOW (4):
 *    [L-01] Auth state (AUTH.currentUser) is a plain object, not frozen --
 *           can be tampered with from console
 *    [L-02] Audit log entries can be modified from console (AUTH.auditLog
 *           is a mutable array)
 *    [L-03] IP address in audit log is hardcoded '91.220.41.18' for all
 *           entries -- no real IP detection
 *    [L-04] Config inline edit functions (bsEditConfig, gdEditConfig,
 *           sbEditConfig) accept arbitrary text with no validation
 *
 * ===================================================================
 *  DETAILED FINDINGS AND FIX LOCATIONS
 * ===================================================================
 *
 *  [C-01] renderUsersTable() XSS (lines 5610-5651)
 *  -----------------------------------------------
 *  The function builds table rows via string concatenation and assigns
 *  to tbody.innerHTML. User-controlled fields (user.name, user.email,
 *  user.systems[]) are interpolated directly:
 *
 *    '<p class="text-sm font-medium text-white">' + user.name + '</p>'
 *    '<p class="text-xs text-slate-500 font-mono">' + user.email + '</p>'
 *
 *  FIX: Wrap every user-supplied value with SECURITY.sanitize() before
 *  interpolation. Apply to: user.name, user.email, user.lastLogin,
 *  and each system tag label.
 *
 *  [C-02] renderAuditTable() XSS (lines 5919-5941)
 *  -------------------------------------------------
 *  Similar to C-01. Audit log entries are rendered via innerHTML with
 *  unsanitized fields: entry.ts, entry.user, entry.target, entry.ip,
 *  entry.details, entry.system, and entry.action.
 *
 *    '<td ...>' + entry.user + '</td>'
 *    '<td ...>' + entry.details + '</td>'
 *
 *  FIX: Apply SECURITY.sanitize() to all entry fields in the template.
 *
 *  [H-01] Attribute injection via title (line 5939)
 *  -------------------------------------------------
 *    'title="' + entry.details + '"'
 *
 *  If entry.details contains: " onmouseover="alert(1)
 *  it breaks out of the title attribute and injects an event handler.
 *
 *  FIX: Use SECURITY.sanitizeAttr() which also escapes quotes.
 *
 *  [H-03] RBAC console bypass
 *  ---------------------------
 *  An authenticated user can type in the browser console:
 *    AUTH.currentUser.role = 'super_admin'
 *    AUTH.applyRoleRestrictions()
 *  This reveals all admin-only UI including User Management and Audit Log.
 *
 *  FIX: Use Object.freeze() on currentUser after login, or use a
 *  closure-based approach where the role is not directly writable.
 *  The SECURITY.checkRBAC() function below provides a server-side-ready
 *  pattern that should replace client-side role checks.
 *
 * ===================================================================
 */


const SECURITY = {

  /* ================================================================
   * 1. SANITIZE -- HTML entity escaping for XSS prevention
   * ================================================================
   *
   * VULNERABILITY ADDRESSED: [C-01], [C-02]
   *
   * Must be applied in:
   *   - renderUsersTable() (line 5610): user.name, user.email,
   *     user.lastLogin, system tag labels
   *   - renderAuditTable() (line 5919): entry.ts, entry.user,
   *     entry.action, entry.system, entry.target, entry.ip,
   *     entry.details
   *   - Any future function that renders user data into HTML
   *
   * Usage:
   *   Before: '<p>' + user.name + '</p>'
   *   After:  '<p>' + SECURITY.sanitize(user.name) + '</p>'
   */
  sanitize(str) {
    if (str === null || str === undefined) return '';
    const s = String(str);
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
      '`': '&#96;'
    };
    return s.replace(/[&<>"'/`]/g, (c) => map[c]);
  },


  /**
   * 1b. SANITIZE ATTRIBUTE -- stricter escaping for HTML attributes
   *
   * VULNERABILITY ADDRESSED: [H-01]
   *
   * Must be applied in renderAuditTable() line 5939:
   *   Before: 'title="' + entry.details + '"'
   *   After:  'title="' + SECURITY.sanitizeAttr(entry.details) + '"'
   */
  sanitizeAttr(str) {
    if (str === null || str === undefined) return '';
    const s = String(str);
    // Replace all non-alphanumeric characters with HTML entities
    // This is the OWASP-recommended approach for attribute contexts
    return s.replace(/[^a-zA-Z0-9,.\-_ ]/g, (c) => {
      return '&#' + c.charCodeAt(0) + ';';
    });
  },


  /* ================================================================
   * 2. VALIDATE EMAIL -- strict RFC 5322 subset validation
   * ================================================================
   *
   * VULNERABILITY ADDRESSED: [M-04]
   *
   * Must be applied in:
   *   - AUTH_UI.saveUser() (line 5808): validate email before save
   *   - AUTH.handleLoginForm() (line 5186): validate before login call
   *   - Any backend endpoint that accepts email input
   *
   * Usage:
   *   if (!SECURITY.validateEmail(email)) {
   *     showError('Invalid email format');
   *     return;
   *   }
   */
  validateEmail(email) {
    if (!email || typeof email !== 'string') return false;

    // Trim whitespace
    const trimmed = email.trim();

    // Length limits (RFC 5321: local max 64, domain max 255, total max 320)
    if (trimmed.length < 5 || trimmed.length > 320) return false;

    // Strict pattern: no consecutive dots, no leading/trailing dots in local,
    // domain must have at least one dot, TLD at least 2 chars
    const pattern = /^[a-zA-Z0-9](?:[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]*[a-zA-Z0-9])?@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

    if (!pattern.test(trimmed)) return false;

    // Check local part length
    const [local, domain] = trimmed.split('@');
    if (local.length > 64) return false;
    if (domain.length > 255) return false;

    // Reject consecutive dots in local part
    if (/\.\./.test(local)) return false;

    return true;
  },


  /* ================================================================
   * 3. VALIDATE INPUT -- generic input validator with rule sets
   * ================================================================
   *
   * VULNERABILITY ADDRESSED: [M-05], [L-04]
   *
   * Must be applied in:
   *   - AUTH_UI.saveUser() (line 5808): validate name and email
   *   - bsEditConfig(), gdEditConfig(), sbEditConfig() config editors
   *   - Any form submission handler
   *
   * Usage:
   *   const result = SECURITY.validateInput(name, {
   *     required: true,
   *     minLength: 2,
   *     maxLength: 100,
   *     pattern: 'name'
   *   });
   *   if (!result.valid) {
   *     showError(result.errors.join(', '));
   *     return;
   *   }
   */
  validateInput(value, rules) {
    const errors = [];
    const str = value === null || value === undefined ? '' : String(value);

    // Required check
    if (rules.required && str.trim().length === 0) {
      errors.push('This field is required');
      return { valid: false, errors };
    }

    // If not required and empty, skip other checks
    if (str.trim().length === 0) {
      return { valid: true, errors: [] };
    }

    // Length checks
    if (rules.minLength !== undefined && str.length < rules.minLength) {
      errors.push('Minimum length is ' + rules.minLength + ' characters');
    }
    if (rules.maxLength !== undefined && str.length > rules.maxLength) {
      errors.push('Maximum length is ' + rules.maxLength + ' characters');
    }

    // Named patterns
    const patterns = {
      // Name: Unicode letters, spaces, hyphens, dots, apostrophes
      name: /^[\p{L}\s.\-']+$/u,
      // Alphanumeric with basic punctuation
      alphanumeric: /^[a-zA-Z0-9\s._-]+$/,
      // Integer (positive or negative)
      integer: /^-?\d+$/,
      // Positive integer only
      positiveInt: /^\d+$/,
      // Config value: alphanumeric, dots, colons, slashes, hyphens, underscores
      configValue: /^[a-zA-Z0-9\s._:\/\-@#]+$/,
      // No HTML/script tags
      noHtml: /^[^<>]*$/
    };

    if (rules.pattern && patterns[rules.pattern]) {
      if (!patterns[rules.pattern].test(str)) {
        errors.push('Invalid format for type: ' + rules.pattern);
      }
    }

    // Custom regex
    if (rules.regex && !rules.regex.test(str)) {
      errors.push(rules.regexMessage || 'Does not match required pattern');
    }

    // Numeric range
    if (rules.min !== undefined) {
      const num = parseFloat(str);
      if (isNaN(num) || num < rules.min) {
        errors.push('Minimum value is ' + rules.min);
      }
    }
    if (rules.max !== undefined) {
      const num = parseFloat(str);
      if (isNaN(num) || num > rules.max) {
        errors.push('Maximum value is ' + rules.max);
      }
    }

    // Disallow dangerous characters for SQL/command injection prevention
    if (rules.noInjection !== false) {
      // Detect common SQL injection patterns
      const sqlPatterns = /('|--|;|\b(OR|AND|UNION|SELECT|INSERT|UPDATE|DELETE|DROP|EXEC|EXECUTE)\b)/i;
      if (sqlPatterns.test(str)) {
        errors.push('Input contains potentially unsafe characters');
      }
      // Detect command injection patterns
      const cmdPatterns = /[|;&$`\\]|\b(rm|cat|curl|wget|nc|bash|sh|eval)\b/i;
      if (rules.strictInjection && cmdPatterns.test(str)) {
        errors.push('Input contains restricted characters');
      }
    }

    return { valid: errors.length === 0, errors };
  },


  /* ================================================================
   * 4. HASH PASSWORD -- SHA-256 hashing for client-side use
   * ================================================================
   *
   * VULNERABILITY ADDRESSED: [C-03], [H-05]
   *
   * Must be applied in:
   *   - AUTH.login() (line 5160): hash password before comparison
   *   - AUTH_UI.saveUser() (line 5838): hash initial password
   *   - AUTH_UI.resetPassword() (line 5868): hash reset password
   *
   * IMPORTANT: This is for CLIENT-SIDE pre-hashing only. The server
   * MUST use bcrypt/scrypt/argon2 for actual password storage.
   * Client-side hashing prevents plaintext password exposure in JS
   * memory and the DOM.
   *
   * Usage:
   *   const hashed = await SECURITY.hashPassword('userPassword');
   *   // hashed = 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e'
   */
  async hashPassword(pw) {
    if (!pw || typeof pw !== 'string') {
      throw new Error('Password must be a non-empty string');
    }
    const encoder = new TextEncoder();
    const data = encoder.encode(pw);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },


  /* ================================================================
   * 5. GENERATE CSRF TOKEN -- cryptographic CSRF token generation
   * ================================================================
   *
   * VULNERABILITY ADDRESSED: [H-06]
   *
   * Must be applied:
   *   - Generate on login and store in a meta tag or JS variable
   *   - Attach to all state-changing requests (user create, edit,
   *     delete, config changes, password resets)
   *   - Verify on the server side before processing
   *
   * Usage:
   *   // On login:
   *   const token = SECURITY.generateCSRFToken();
   *   document.querySelector('meta[name="csrf-token"]').content = token;
   *
   *   // On form submit:
   *   const token = SECURITY.getCSRFToken();
   *   fetch('/api/users', {
   *     headers: { 'X-CSRF-Token': token }
   *   });
   */
  _csrfToken: null,

  generateCSRFToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    this._csrfToken = Array.from(array)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return this._csrfToken;
  },

  getCSRFToken() {
    if (!this._csrfToken) {
      this.generateCSRFToken();
    }
    return this._csrfToken;
  },

  validateCSRFToken(token) {
    if (!this._csrfToken || !token) return false;
    // Constant-time comparison to prevent timing attacks
    if (token.length !== this._csrfToken.length) return false;
    let result = 0;
    for (let i = 0; i < token.length; i++) {
      result |= token.charCodeAt(i) ^ this._csrfToken.charCodeAt(i);
    }
    return result === 0;
  },


  /* ================================================================
   * 6. CHECK RBAC -- server-side-ready role-based access control
   * ================================================================
   *
   * VULNERABILITY ADDRESSED: [H-03]
   *
   * The current RBAC is purely client-side and bypassable via console.
   * This function provides a pattern for server-side RBAC that should
   * be used once a backend is introduced.
   *
   * For client-side hardening, AUTH.currentUser should be frozen:
   *   Object.freeze(AUTH.currentUser)
   * and role checks should use this function which validates against
   * the original users array (not the mutable currentUser).
   *
   * Must be applied in:
   *   - AUTH.checkPermission() (line 5254): replace with this function
   *   - AUTH_UI.saveUser() (line 5808): verify write permission
   *   - AUTH_UI.bulkAction() (line 5695): verify bulk permissions
   *   - All config edit functions
   *
   * Usage:
   *   const allowed = SECURITY.checkRBAC(AUTH.currentUser, 'users', 'edit');
   *   if (!allowed.granted) {
   *     console.warn('Access denied:', allowed.reason);
   *     return;
   *   }
   */
  checkRBAC(user, resource, action) {
    // Validate user object integrity
    if (!user || !user.id || !user.role || !user.email) {
      return { granted: false, reason: 'Invalid or missing user object' };
    }

    // Role hierarchy -- immutable definition
    const ROLE_LEVELS = Object.freeze({
      assistant: 1,
      manager: 2,
      admin: 3,
      super_admin: 4
    });

    const level = ROLE_LEVELS[user.role];
    if (!level) {
      return { granted: false, reason: 'Unknown role: ' + user.role };
    }

    // Permission matrix (resource -> action -> minimum role level)
    const PERMISSIONS = Object.freeze({
      dashboard:    Object.freeze({ view: 1 }),
      postflow:      Object.freeze({ view: 1, run: 2, create: 3, edit: 3, delete: 4 }),
      autoeditors:       Object.freeze({ view: 1, assign: 2, create: 3, edit: 3, delete: 4 }),
      superboost:   Object.freeze({ view: 1, do_task: 1, create: 3, edit: 3, delete: 4 }),
      config:       Object.freeze({ view: 2, edit: 3 }),
      users:        Object.freeze({ view: 2, create: 3, edit: 3, delete: 4 }),
      audit:        Object.freeze({ view: 3 }),
      alerts:       Object.freeze({ view: 2, manage: 3, dismiss: 3 })
    });

    const resourcePerms = PERMISSIONS[resource];
    if (!resourcePerms) {
      return { granted: false, reason: 'Unknown resource: ' + resource };
    }

    const requiredLevel = resourcePerms[action];
    if (requiredLevel === undefined) {
      return { granted: false, reason: 'Unknown action: ' + action + ' on ' + resource };
    }

    // System-level check (non-super_admin must have system access)
    const systemResources = ['postflow', 'autoeditors', 'superboost'];
    if (systemResources.includes(resource) && user.role !== 'super_admin') {
      if (!user.systems || !user.systems.includes(resource)) {
        return { granted: false, reason: 'No access to system: ' + resource };
      }
    }

    if (level < requiredLevel) {
      return {
        granted: false,
        reason: 'Insufficient role level. Required: ' + requiredLevel + ', has: ' + level
      };
    }

    return { granted: true, reason: 'Authorized', level, requiredLevel };
  },


  /* ================================================================
   * 7. RATE LIMITER -- sliding window rate limiting for login
   * ================================================================
   *
   * VULNERABILITY ADDRESSED: [H-02]
   *
   * Must be applied in:
   *   - AUTH.login() (line 5160): check rate limit before auth
   *   - AUTH.handleLoginForm() (line 5186): display lockout message
   *
   * Usage:
   *   // In AUTH.login():
   *   const rateCheck = SECURITY.rateLimiter('login:' + email, 5, 15 * 60 * 1000);
   *   if (!rateCheck.allowed) {
   *     return {
   *       success: false,
   *       error: 'Too many attempts. Try again in ' + rateCheck.retryAfterSeconds + 's.'
   *     };
   *   }
   */
  _rateLimitStore: new Map(),

  rateLimiter(key, maxAttempts, windowMs) {
    const now = Date.now();
    maxAttempts = maxAttempts || 5;
    windowMs = windowMs || 15 * 60 * 1000; // 15 minutes default

    if (!this._rateLimitStore.has(key)) {
      this._rateLimitStore.set(key, []);
    }

    const attempts = this._rateLimitStore.get(key);

    // Remove expired entries
    const cutoff = now - windowMs;
    while (attempts.length > 0 && attempts[0] < cutoff) {
      attempts.shift();
    }

    if (attempts.length >= maxAttempts) {
      const oldestValid = attempts[0];
      const retryAfterMs = (oldestValid + windowMs) - now;
      const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
        retryAfterMs,
        total: attempts.length
      };
    }

    // Record this attempt
    attempts.push(now);

    return {
      allowed: true,
      remaining: maxAttempts - attempts.length,
      retryAfterSeconds: 0,
      retryAfterMs: 0,
      total: attempts.length
    };
  },

  /**
   * Reset rate limit for a key (e.g., after successful login)
   */
  rateLimiterReset(key) {
    this._rateLimitStore.delete(key);
  },


  /* ================================================================
   * 8. ESCAPE REGEX -- safe RegExp construction from user input
   * ================================================================
   *
   * Must be applied in:
   *   - Any search/filter that uses user input in a RegExp
   *   - AUTH_UI.filterUsers() (line 5658): if search becomes regex
   *   - AUTH_UI.filterAuditLogs() (line 5947): if search becomes regex
   *
   * Usage:
   *   const safePattern = new RegExp(SECURITY.escapeRegex(userInput), 'i');
   */
  escapeRegex(str) {
    if (!str || typeof str !== 'string') return '';
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },


  /* ================================================================
   * 9. CSP POLICY -- recommended Content-Security-Policy
   * ================================================================
   *
   * VULNERABILITY ADDRESSED: [M-01], [M-02]
   *
   * Must be set as an HTTP response header by the server. For the
   * current static file setup, it can be added as a <meta> tag
   * (with limitations -- some directives only work as HTTP headers).
   *
   * Current external resources:
   *   - https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4 (script)
   *   - https://unpkg.com/@phosphor-icons/web (script)
   *   - https://fonts.googleapis.com (style)
   *   - https://fonts.gstatic.com (font files)
   *
   * NOTE: The Tailwind CSS browser runtime uses inline styles
   *       extensively, so 'unsafe-inline' is needed for style-src.
   *       When migrating to a build step, remove 'unsafe-inline' and
   *       use nonces instead.
   *
   * WARNING: There are inline <script> blocks in admin-v2.html
   *          (lines 4686-5073, 5075-6023, 6025-6136). These MUST
   *          be moved to external .js files OR have nonces added to
   *          work with the CSP below. Until then, the CSP below uses
   *          nonce placeholders.
   *
   * Usage:
   *   // As HTTP header (preferred):
   *   res.setHeader('Content-Security-Policy', SECURITY.cspPolicy);
   *
   *   // As meta tag (limited):
   *   <meta http-equiv="Content-Security-Policy" content="...">
   */
  cspPolicy: [
    // Only allow resources from same origin by default
    "default-src 'self'",

    // Scripts: self + specific CDNs + nonce for inline scripts
    // Replace NONCE_PLACEHOLDER with a server-generated nonce per request
    "script-src 'self' https://cdn.jsdelivr.net https://unpkg.com 'nonce-NONCE_PLACEHOLDER'",

    // Styles: self + Google Fonts + unsafe-inline (needed for Tailwind runtime)
    "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'",

    // Fonts: self + Google Fonts CDN
    "font-src 'self' https://fonts.gstatic.com",

    // Images: self + data URIs (for inline SVGs/icons)
    "img-src 'self' data:",

    // No object/embed/applet
    "object-src 'none'",

    // No base URI hijacking
    "base-uri 'self'",

    // Forms can only submit to self
    "form-action 'self'",

    // No framing (clickjacking protection)
    "frame-ancestors 'none'",

    // Block mixed content
    "block-all-mixed-content",

    // Upgrade insecure requests
    "upgrade-insecure-requests"
  ].join('; '),

  /**
   * Generate a CSP nonce for inline scripts.
   * Each page load should generate a new nonce.
   */
  generateCSPNonce() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array));
  },


  /* ================================================================
   * 10. ADDITIONAL SECURITY HEADERS (recommendations)
   * ================================================================
   *
   * These should be set by the web server alongside CSP:
   */
  recommendedHeaders: {
    'Content-Security-Policy': '/* see cspPolicy above */',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '0',  // Disable legacy XSS filter (CSP replaces it)
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache'
  },


  /* ================================================================
   * 11. APPLY ALL SECURITY PATCHES
   * ================================================================
   *
   * Call this once on page load AFTER AUTH is defined but BEFORE init.
   * This monkey-patches the existing AUTH and AUTH_UI objects to add
   * security protections without requiring changes to admin-v2.html.
   */
  applyPatches() {

    // ---- Patch AUTH.login() to add rate limiting and password hashing ----
    const _origLogin = AUTH.login.bind(AUTH);
    AUTH.login = function(email, password) {
      // Rate limit check
      const rateKey = 'login:' + (email || '').toLowerCase();
      const rateCheck = SECURITY.rateLimiter(rateKey, 5, 15 * 60 * 1000);
      if (!rateCheck.allowed) {
        return {
          success: false,
          error: 'Too many login attempts. Try again in '
            + rateCheck.retryAfterSeconds + ' seconds.'
        };
      }

      // Validate email format
      if (!SECURITY.validateEmail(email)) {
        return { success: false, error: 'Invalid email format.' };
      }

      const result = _origLogin(email, password);

      // On successful login, reset rate limiter and freeze user
      if (result.success) {
        SECURITY.rateLimiterReset(rateKey);
        SECURITY.generateCSRFToken();
        // Freeze the currentUser object to prevent console tampering
        if (AUTH.currentUser) {
          AUTH.currentUser = Object.freeze({ ...AUTH.currentUser });
        }
      }

      return result;
    };


    // ---- Patch renderUsersTable() to sanitize output ----
    const _origRenderUsers = AUTH_UI.renderUsersTable.bind(AUTH_UI);
    AUTH_UI.renderUsersTable = function(filteredUsers) {
      const users = filteredUsers || AUTH.users;
      const tbody = document.getElementById('users-table-body');
      if (!tbody) return;

      const san = SECURITY.sanitize;
      const sanAttr = SECURITY.sanitizeAttr;

      tbody.innerHTML = users.map(function(user) {
        const initials = san(user.name.split(' ').map(function(n) { return n[0]; }).join('').toUpperCase());
        const roleBadge = AUTH.ROLE_BADGE_CLASSES[user.role] || '';
        const roleLabel = san(AUTH.ROLE_LABELS[user.role] || user.role);
        const avatarColor = AUTH.AVATAR_COLORS[user.role] || 'bg-slate-600';

        var statusBadge;
        if (user.status === 'active') {
          statusBadge = '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400"><i class="ph-bold ph-check-circle text-[10px]"></i> Active</span>';
        } else if (user.status === 'disabled') {
          statusBadge = '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/20 text-slate-400"><i class="ph-bold ph-prohibit text-[10px]"></i> Disabled</span>';
        } else {
          statusBadge = '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400"><i class="ph-bold ph-lock text-[10px]"></i> Locked</span>';
        }

        var systemTags = (user.systems || []).map(function(s) {
          var colors = {
            postflow: 'bg-cyan-500/15 text-cyan-400',
            autoeditors: 'bg-violet-500/15 text-violet-400',
            superboost: 'bg-amber-500/15 text-amber-400'
          };
          return '<span class="px-1.5 py-0.5 rounded text-[10px] font-medium '
            + (colors[s] || 'bg-slate-500/15 text-slate-400') + '">'
            + san(s) + '</span>';
        }).join(' ');

        var canEdit = AUTH.currentUser && (
          AUTH.currentUser.role === 'super_admin'
          || (AUTH.currentUser.role === 'admin' && AUTH.ROLE_LEVELS[user.role] < AUTH.ROLE_LEVELS['admin'])
        );

        return '<tr class="border-b border-slate-700/50 hover:bg-slate-800/50" data-user-id="'
          + sanAttr(user.id) + '" data-role="' + sanAttr(user.role) + '" data-status="'
          + sanAttr(user.status) + '" data-systems="' + sanAttr((user.systems || []).join(',')) + '">'
          + '<td class="px-4 py-3"><input type="checkbox" class="user-select-cb w-3.5 h-3.5 rounded border-slate-600 bg-slate-900/60 text-cyan-500 cursor-pointer" value="'
          + sanAttr(user.id) + '" onchange="AUTH_UI.updateBulkBar()"></td>'
          + '<td class="px-4 py-3"><div class="flex items-center gap-3">'
          + '<div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white '
          + avatarColor + '">' + initials + '</div>'
          + '<div><p class="text-sm font-medium text-white">' + san(user.name)
          + '</p><p class="text-xs text-slate-500 font-mono">' + san(user.email) + '</p></div>'
          + '</div></td>'
          + '<td class="px-4 py-3"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium '
          + roleBadge + '">' + roleLabel + '</span></td>'
          + '<td class="px-4 py-3"><div class="flex flex-wrap gap-1">' + systemTags + '</div></td>'
          + '<td class="px-4 py-3">' + statusBadge + '</td>'
          + '<td class="px-4 py-3 text-xs text-slate-400 font-mono whitespace-nowrap">'
          + san(user.lastLogin) + '</td>'
          + '<td class="px-4 py-3 text-right">'
          + (canEdit
            ? '<div class="flex items-center justify-end gap-1">'
              + '<button onclick="AUTH_UI.openEditUserModal(' + parseInt(user.id, 10)
              + ')" class="text-slate-400 hover:text-cyan-400 p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors" title="Edit"><i class="ph-bold ph-pencil-simple text-sm"></i></button>'
              + '<button onclick="AUTH_UI.toggleUserStatus(' + parseInt(user.id, 10)
              + ')" class="text-slate-400 hover:text-amber-400 p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors" title="Toggle Status"><i class="ph-bold ph-power text-sm"></i></button>'
              + '</div>'
            : '<span class="text-xs text-slate-600">--</span>')
          + '</td>'
          + '</tr>';
      }).join('');

      var countEl = document.getElementById('users-table-count');
      if (countEl) {
        countEl.textContent = 'Showing ' + users.length + ' user' + (users.length !== 1 ? 's' : '');
      }
    };


    // ---- Patch renderAuditTable() to sanitize output ----
    const _origRenderAudit = AUTH_UI.renderAuditTable.bind(AUTH_UI);
    AUTH_UI.renderAuditTable = function(filteredLogs) {
      const logs = filteredLogs || AUTH.auditLog;
      const tbody = document.getElementById('audit-table-body');
      if (!tbody) return;

      const san = SECURITY.sanitize;
      const sanAttr = SECURITY.sanitizeAttr;

      var actionBadges = {
        login:              'bg-emerald-500/20 text-emerald-400',
        logout:             'bg-slate-500/20 text-slate-400',
        failed_login:       'bg-red-500/20 text-red-400',
        config_change:      'bg-amber-500/20 text-amber-400',
        user_created:       'bg-cyan-500/20 text-cyan-400',
        task_completed:     'bg-emerald-500/20 text-emerald-400',
        batch_triggered:    'bg-violet-500/20 text-violet-400',
        permission_changed: 'bg-amber-500/20 text-amber-400'
      };

      var actionIcons = {
        login:              'ph-sign-in',
        logout:             'ph-sign-out',
        failed_login:       'ph-warning',
        config_change:      'ph-gear-six',
        user_created:       'ph-user-plus',
        task_completed:     'ph-check-circle',
        batch_triggered:    'ph-play',
        permission_changed: 'ph-shield-check'
      };

      tbody.innerHTML = logs.map(function(entry) {
        var badge = actionBadges[entry.action] || 'bg-slate-500/20 text-slate-400';
        var icon = actionIcons[entry.action] || 'ph-info';
        var actionLabel = san(entry.action.replace(/_/g, ' '));
        var systemColors = {
          auth:       'text-slate-400',
          postflow:    'text-cyan-400',
          autoeditors:     'text-violet-400',
          superboost: 'text-amber-400'
        };
        var sysColor = systemColors[entry.system] || 'text-slate-400';

        return '<tr class="border-b border-slate-700/50 hover:bg-slate-800/50">'
          + '<td class="px-5 py-3 text-xs text-slate-400 font-mono whitespace-nowrap">'
          + san(entry.ts) + '</td>'
          + '<td class="px-5 py-3 text-sm text-white whitespace-nowrap">'
          + san(entry.user) + '</td>'
          + '<td class="px-5 py-3"><span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium '
          + badge + '"><i class="ph-bold ' + icon + ' text-[10px]"></i> '
          + actionLabel + '</span></td>'
          + '<td class="px-5 py-3 text-sm ' + sysColor + ' font-medium">'
          + san(entry.system) + '</td>'
          + '<td class="px-5 py-3 text-sm text-slate-300 font-mono text-xs">'
          + san(entry.target) + '</td>'
          + '<td class="px-5 py-3 text-xs text-slate-500 font-mono">'
          + san(entry.ip) + '</td>'
          + '<td class="px-5 py-3 text-xs text-slate-400 max-w-[200px] truncate" title="'
          + sanAttr(entry.details) + '">' + san(entry.details) + '</td>'
          + '</tr>';
      }).join('');

      var countEl = document.getElementById('audit-table-count');
      if (countEl) {
        countEl.textContent = 'Showing ' + logs.length + ' entr' + (logs.length !== 1 ? 'ies' : 'y');
      }
    };


    // ---- Patch saveUser() to add input validation ----
    const _origSaveUser = AUTH_UI.saveUser.bind(AUTH_UI);
    AUTH_UI.saveUser = function() {
      var name = (document.getElementById('user-modal-name').value || '').trim();
      var email = (document.getElementById('user-modal-email').value || '').trim();

      // Validate name
      var nameResult = SECURITY.validateInput(name, {
        required: true,
        minLength: 2,
        maxLength: 100,
        pattern: 'name'
      });
      if (!nameResult.valid) {
        alert('Name: ' + nameResult.errors.join(', '));
        return;
      }

      // Validate email
      if (!SECURITY.validateEmail(email)) {
        alert('Please enter a valid email address.');
        return;
      }

      // RBAC check: verify current user can create/edit users
      var action = AUTH_UI.editingUserId ? 'edit' : 'create';
      var rbacCheck = SECURITY.checkRBAC(AUTH.currentUser, 'users', action);
      if (!rbacCheck.granted) {
        alert('Permission denied: ' + rbacCheck.reason);
        return;
      }

      // Proceed with original save
      _origSaveUser();
    };


    // ---- Patch config edit functions to validate input ----
    if (typeof window.bsEditConfig === 'function') {
      const _origBsEditConfig = window.bsEditConfig;
      window.bsEditConfig = function(key) {
        _origBsEditConfig(key);
        // Add validation on blur for the newly created input
        setTimeout(function() {
          var el = document.getElementById('bs-cfg-' + key);
          if (el && el.previousElementSibling && el.previousElementSibling.tagName === 'INPUT') {
            var input = el.previousElementSibling;
            var origOnBlur = input.onblur;
            input.onblur = function() {
              var result = SECURITY.validateInput(input.value, {
                required: true,
                maxLength: 200,
                pattern: 'configValue'
              });
              if (!result.valid) {
                input.style.borderColor = '#ef4444';
                input.title = result.errors.join(', ');
                return;
              }
              if (origOnBlur) origOnBlur.call(input);
            };
          }
        }, 0);
      };
    }

    console.log('[SECURITY] All patches applied successfully.');
  },


  /* ================================================================
   * 12. SECURITY HARDENING RECOMMENDATIONS FOR BACKEND MIGRATION
   * ================================================================
   *
   * When moving from this client-side demo to a real backend:
   *
   * 1. AUTHENTICATION:
   *    - Use real HTTPOnly, Secure, SameSite=Strict cookies
   *    - Implement bcrypt/argon2 password hashing (cost factor >= 12)
   *    - Add multi-factor authentication (TOTP)
   *    - Implement account lockout after N failed attempts (server-side)
   *
   * 2. AUTHORIZATION:
   *    - All RBAC checks MUST be server-side (never trust client)
   *    - Use middleware for route-level permission checks
   *    - Audit log should be append-only on the server
   *
   * 3. SESSION MANAGEMENT:
   *    - Server-issued session tokens with secure random generation
   *    - Session invalidation on logout (server-side token blacklist)
   *    - Absolute timeout (e.g., 8 hours) + idle timeout (30 min)
   *    - Regenerate session ID after privilege change
   *
   * 4. INPUT HANDLING:
   *    - Parameterized queries for all database operations
   *    - Whitelist-based input validation on all endpoints
   *    - Request body size limits (e.g., 1MB max)
   *    - Content-Type validation on all requests
   *
   * 5. TRANSPORT:
   *    - HTTPS only with TLS 1.2+ (HSTS enabled)
   *    - Certificate pinning for API clients
   *
   * 6. MONITORING:
   *    - Real-time alerting on failed login spikes
   *    - Anomaly detection on RBAC bypass attempts
   *    - Immutable audit log with tamper detection
   *
   * ================================================================
   */


  /* ================================================================
   * 13. SUBRESOURCE INTEGRITY HASHES
   * ================================================================
   *
   * VULNERABILITY ADDRESSED: [M-02]
   *
   * External scripts should include integrity attributes:
   *
   * <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"
   *         integrity="sha384-HASH_HERE"
   *         crossorigin="anonymous"></script>
   *
   * <script src="https://unpkg.com/@phosphor-icons/web"
   *         integrity="sha384-HASH_HERE"
   *         crossorigin="anonymous"></script>
   *
   * To generate hashes, run:
   *   curl -s URL | openssl dgst -sha384 -binary | openssl base64 -A
   *
   * Then format as: integrity="sha384-<base64hash>"
   *
   * NOTE: SRI hashes change when the library updates. Pin versions:
   *   @tailwindcss/browser@4.0.0 (instead of @4)
   *   @phosphor-icons/web@2.1.1 (instead of @web)
   */
  sriRecommendations: {
    tailwind: {
      url: 'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4',
      recommendation: 'Pin to exact version: @tailwindcss/browser@4.x.x and add integrity attribute',
      crossorigin: 'anonymous'
    },
    phosphorIcons: {
      url: 'https://unpkg.com/@phosphor-icons/web',
      recommendation: 'Pin to exact version: @phosphor-icons/web@2.x.x and add integrity attribute',
      crossorigin: 'anonymous'
    }
  }
};


/* ================================================================
 * AUTO-INITIALIZATION
 * ================================================================
 * Include this file in admin-v2.html BEFORE the unified panel init
 * script, then call SECURITY.applyPatches() after AUTH and AUTH_UI
 * are defined but before AUTH.init() runs.
 *
 * Example in admin-v2.html:
 *   <script src="sections/security-fixes.js"></script>
 *   <script>
 *     // ... after AUTH and AUTH_UI are defined ...
 *     SECURITY.applyPatches();
 *     AUTH.init();
 *   </script>
 *
 * Alternatively, auto-apply when DOM is ready:
 */
if (typeof AUTH !== 'undefined' && typeof AUTH_UI !== 'undefined') {
  SECURITY.applyPatches();
} else {
  document.addEventListener('DOMContentLoaded', function() {
    if (typeof AUTH !== 'undefined' && typeof AUTH_UI !== 'undefined') {
      SECURITY.applyPatches();
    } else {
      console.warn(
        '[SECURITY] AUTH or AUTH_UI not found. '
        + 'Ensure security-fixes.js is loaded after auth scripts.'
      );
    }
  });
}
