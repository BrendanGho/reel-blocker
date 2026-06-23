// Reel Blocker — TikTok auto-diagnostic / DOM-discovery probe.
//
// PURPOSE
// Automate the manual "inspect the DOM by hand" step for the TikTok creator-page
// bug (a profile you don't follow renders TikTok's "Something went wrong" error
// until you hit its refresh button). It runs READ-ONLY in the page, watches for
// the error to appear, and when it does captures everything needed to diagnose:
//   - the error node's ancestry using STABLE attributes only (data-e2e, role,
//     aria-label, id, href) — never obfuscated class names
//   - the "refresh/try again" control near it (so we know the recovery anchor)
//   - the run-up timeline: SPA navigations + DOM mutation bursts + page errors,
//     each timestamped, so we can see whether the error coincides with our
//     extension's history-patch / scan activity (the leading hypothesis)
//   - the NETWORK run-up: every fetch/XHR with pathname + status + duration
//     (NO query strings — those carry ms_token/signatures), so a failed or slow
//     signed profile request landing right before the error is visible. This is
//     the key signal for the webmssdk/anti-bot timeout hypothesis.
//   - the extension's own state at error time (window.RB, #rb-tk-overlay,
//     html.rb-tk-block, the rb:* localStorage mirror, video count)
//   - a catalogue of every [data-e2e] value on the page (TikTok's stable hooks)
//
// HOW TO RUN
//   1. Open tiktok.com LOGGED IN. To capture the navigation/network run-up, paste
//      this on the FEED/home page FIRST, before navigating to the profile.
//   2. Open DevTools -> Console, paste this whole file, press Enter.
//   3. Navigate to a creator's profile you DON'T follow to trigger the error.
//   4. It auto-prints a JSON report (and copies it to the clipboard) the moment
//      the error appears. Or call __rbProbe.dump() yourself at any time.
//   5. Paste the JSON back to the agent.
//
// To prove whether the extension is implicated, run once with it FULLY DISABLED
// (toggled off in chrome://extensions / about:addons — not just blocking off).
// If the error still appears with the extension gone, it is a TikTok-side issue.
//
// To compare WITH vs WITHOUT the extension: run once as above, then disable the
// extension, reload, and run again. `env.extensionLoaded` distinguishes the two
// (it reads preempt.js's injected <style>, which survives the isolated-world
// boundary that hides the content script's window.RB from this page-context probe).
//
// Controls: __rbProbe.dump()  -> print+copy a report now
//           __rbProbe.stop()  -> uninstall all hooks
//           __rbProbe.report  -> last report object
(function () {
  if (window.__rbProbe) {
    console.warn('[rb-probe] already running — call __rbProbe.stop() first to restart');
    return;
  }

  var START = Date.now();
  var t = function () { return Date.now() - START; };      // ms since probe start
  var ERROR_RE = /something went wrong/i;                  // TikTok error-boundary text
  var REFRESH_RE = /refresh|try again|reload|retry/i;
  var STABLE = ['id', 'role', 'aria-label', 'data-e2e', 'data-testid', 'href', 'title', 'alt'];

  var nav = [];        // { t, type, path }
  var errors = [];     // { t, kind, message, stack }
  var mutations = [];  // { t, added, removed, sample }
  var net = [];        // { t, kind, method, path, status, ms, failed }
  var captured = null; // first error-state snapshot (also stored on report)

  // Strip query/hash so we never log ms_token, signatures, or other secrets.
  function safePath(url) {
    try {
      var u = new URL(url, location.origin);
      return u.pathname;
    } catch (e) {
      return String(url).split('?')[0].split('#')[0];
    }
  }

  function recordNet(rec) {
    net.push(rec);
    if (net.length > 120) net.shift();
    // A failed/slow request is the most likely trigger of the error boundary.
    if (rec.failed || (rec.status >= 400)) scheduleCheck('net:' + (rec.status || 'fail'));
  }

  // --- serialization helpers (stable attributes only) ----------------------
  function sig(el) {
    if (!el || el.nodeType !== 1) return String(el);
    var parts = [el.tagName.toLowerCase()];
    STABLE.forEach(function (a) {
      var v = el.getAttribute && el.getAttribute(a);
      if (v != null && v !== '') {
        if (v.length > 48) v = v.slice(0, 48) + '…';
        parts.push('[' + a + '="' + v + '"]');
      }
    });
    // any other data-* hooks, name only (values can be noisy)
    if (el.attributes) {
      for (var i = 0; i < el.attributes.length; i++) {
        var n = el.attributes[i].name;
        if (n.indexOf('data-') === 0 && STABLE.indexOf(n) < 0) parts.push('[' + n + ']');
      }
    }
    return parts.join('');
  }

  function ancestry(el, depth) {
    var chain = [], p = el, max = depth || 14;
    for (var i = 0; i < max && p; i++, p = p.parentElement) chain.push(sig(p));
    return chain;
  }

  // Find the element actually carrying the error text (deepest text node match).
  function findErrorNode() {
    try {
      var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      var node;
      while ((node = w.nextNode())) {
        if (ERROR_RE.test(node.nodeValue || '')) return node.parentElement;
      }
    } catch (e) { /* document mid-teardown */ }
    return null;
  }

  // Nearest clickable refresh/retry control to the error node.
  function findRefreshControl(errEl) {
    if (!errEl) return null;
    var scope = errEl;
    for (var up = 0; up < 6 && scope.parentElement; up++) scope = scope.parentElement;
    var cands = scope.querySelectorAll('button, [role="button"], a, div[tabindex]');
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i];
      var label = (c.getAttribute('aria-label') || c.textContent || '').trim();
      if (label && label.length < 40 && REFRESH_RE.test(label)) {
        return { label: label, sig: sig(c), ancestry: ancestry(c, 6) };
      }
    }
    return null;
  }

  function dataE2eCatalogue() {
    var out = {};
    try {
      document.querySelectorAll('[data-e2e]').forEach(function (el) {
        var k = el.getAttribute('data-e2e');
        out[k] = (out[k] || 0) + 1;
      });
    } catch (e) {}
    return out;
  }

  function env() {
    var ls = {};
    try {
      ls['rb:blockingEnabled'] = localStorage.getItem('rb:blockingEnabled');
      ls['rb:allowFollowing'] = localStorage.getItem('rb:allowFollowing');
    } catch (e) {}
    var vids = document.querySelectorAll('video');
    var paused = 0, muted = 0;
    vids.forEach(function (v) { if (v.paused) paused++; if (v.muted) muted++; });
    return {
      url: location.href,
      path: location.pathname,
      // Content scripts run in an ISOLATED world, so the page-context probe
      // CANNOT see their window.RB. The reliable cross-world signal that the
      // extension actually ran THIS page load is the <style> preempt.js injects
      // into the shared DOM — use this to tell "enabled" from "disabled".
      extensionLoaded: !!document.getElementById('rb-tk-preempt-style'),
      windowRBVisible: !!(window.RB && window.RB.tk),  // page world only; ~always false (isolated worlds)
      overlayPresent: !!document.getElementById('rb-tk-overlay'),
      htmlBlockClass: document.documentElement.classList.contains('rb-tk-block'),
      mirror: ls,                                       // localStorage persists even when disabled
      videoCount: vids.length,
      videosPaused: paused,
      videosMuted: muted
    };
  }

  // --- error detection (throttled) -----------------------------------------
  function checkForError(reason) {
    if (captured) return;
    var errEl = findErrorNode();
    if (!errEl) return;
    captured = {
      detectedAt: t(),
      detectedVia: reason,
      msSinceLastNav: nav.length ? t() - nav[nav.length - 1].t : null,
      errorText: (errEl.textContent || '').trim().slice(0, 160),
      errorSig: sig(errEl),
      errorAncestry: ancestry(errEl, 14),
      refreshControl: findRefreshControl(errEl),
      recentNetAtError: net.slice(-15),
      env: env()
    };
    dump('auto: error detected');
  }

  var checkTimer = null;
  function scheduleCheck(reason) {
    if (captured || checkTimer) return;
    checkTimer = setTimeout(function () { checkTimer = null; checkForError(reason); }, 250);
  }

  // --- hooks ----------------------------------------------------------------
  function recordNav(type) {
    nav.push({ t: t(), type: type, path: location.pathname });
    if (nav.length > 60) nav.shift();
    scheduleCheck('nav:' + type);
  }

  var _push = history.pushState;
  var _replace = history.replaceState;
  history.pushState = function () { var r = _push.apply(this, arguments); recordNav('pushState'); return r; };
  history.replaceState = function () { var r = _replace.apply(this, arguments); recordNav('replaceState'); return r; };
  window.addEventListener('popstate', function () { recordNav('popstate'); });

  function onError(kind, message, stack) {
    errors.push({ t: t(), kind: kind, message: String(message).slice(0, 300), stack: (stack || '').split('\n').slice(0, 4).join(' | ') });
    if (errors.length > 60) errors.shift();
    scheduleCheck('error');
  }
  var _consoleError = console.error;
  console.error = function () {
    try { onError('console.error', Array.prototype.join.call(arguments, ' '), (arguments[0] && arguments[0].stack)); } catch (e) {}
    return _consoleError.apply(this, arguments);
  };
  window.addEventListener('error', function (e) { onError('window.error', e.message, e.error && e.error.stack); }, true);
  window.addEventListener('unhandledrejection', function (e) {
    onError('unhandledrejection', (e.reason && e.reason.message) || e.reason, e.reason && e.reason.stack);
  });

  // Network instrumentation. The probe runs in the PAGE main world, so it sees
  // every fetch/XHR TikTok makes — including the signed profile API request that
  // webmssdk stalls. We log pathname + status + duration only (NO query string,
  // which carries ms_token/signatures). A failed or slow profile request landing
  // right before "Something went wrong" is the signature we're hunting for.
  var _fetch = window.fetch;
  if (typeof _fetch === 'function') {
    window.fetch = function (input, init) {
      var url = (input && input.url) ? input.url : input;
      var method = (init && init.method) || (input && input.method) || 'GET';
      var path = safePath(url);
      var started = t();
      return _fetch.apply(this, arguments).then(function (res) {
        recordNet({ t: started, kind: 'fetch', method: method, path: path, status: res.status, ms: t() - started, failed: false });
        return res;
      }, function (err) {
        recordNet({ t: started, kind: 'fetch', method: method, path: path, status: 0, ms: t() - started, failed: true, error: String(err && err.message || err).slice(0, 120) });
        throw err;
      });
    };
  }

  var _open = XMLHttpRequest.prototype.open;
  var _send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__rb = { method: method, path: safePath(url) };
    return _open.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    var xhr = this, meta = xhr.__rb || { method: '?', path: '?' }, started = t();
    function done(failed) {
      recordNet({ t: started, kind: 'xhr', method: meta.method, path: meta.path, status: xhr.status, ms: t() - started, failed: failed });
    }
    xhr.addEventListener('load', function () { done(false); });
    xhr.addEventListener('error', function () { done(true); });
    xhr.addEventListener('timeout', function () { done(true); });
    return _send.apply(this, arguments);
  };

  var mo = new MutationObserver(function (recs) {
    var added = 0, removed = 0, sample = null;
    for (var i = 0; i < recs.length; i++) {
      added += recs[i].addedNodes.length;
      removed += recs[i].removedNodes.length;
      if (!sample && recs[i].target && recs[i].target.nodeType === 1) sample = sig(recs[i].target);
    }
    if (added + removed >= 3) {
      mutations.push({ t: t(), added: added, removed: removed, sample: sample });
      if (mutations.length > 80) mutations.shift();
    }
    scheduleCheck('mutation');
  });
  try { mo.observe(document.body, { childList: true, subtree: true }); } catch (e) {}

  var interval = setInterval(function () { scheduleCheck('interval'); }, 1000);

  // --- output ---------------------------------------------------------------
  function dump(note) {
    var report = {
      probeVersion: 2,
      note: note || 'manual',
      generatedAt: new Date().toISOString(),
      uptimeMs: t(),
      env: env(),
      errorCapture: captured,
      recentNav: nav.slice(-20),
      recentErrors: errors.slice(-15),
      recentMutations: mutations.slice(-25),
      recentNet: net.slice(-30),
      failedNet: net.filter(function (r) { return r.failed || r.status >= 400; }).slice(-20),
      dataE2eCatalogue: dataE2eCatalogue()
    };
    window.__rbProbe.report = report;
    var json = JSON.stringify(report, null, 2);
    console.log('%c[rb-probe] report (' + report.note + ') — copied to clipboard if permitted:', 'font-weight:bold;color:#9cf');
    console.log(json);
    try { if (navigator.clipboard) navigator.clipboard.writeText(json).catch(function () {}); } catch (e) {}
    return report;
  }

  function stop() {
    try { history.pushState = _push; } catch (e) {}
    try { history.replaceState = _replace; } catch (e) {}
    try { console.error = _consoleError; } catch (e) {}
    try { if (_fetch) window.fetch = _fetch; } catch (e) {}
    try { XMLHttpRequest.prototype.open = _open; } catch (e) {}
    try { XMLHttpRequest.prototype.send = _send; } catch (e) {}
    try { mo.disconnect(); } catch (e) {}
    clearInterval(interval);
    if (checkTimer) clearTimeout(checkTimer);
    console.log('[rb-probe] stopped.');
  }

  window.__rbProbe = { dump: dump, stop: stop, report: null };

  console.log('%c[rb-probe] installed. Trigger the bug (open a creator profile you don\'t follow).',
    'font-weight:bold;color:#2ecc71');
  console.log('[rb-probe] env right now:', env());
  // Catch the case where the error is already on screen.
  scheduleCheck('startup');
})();
