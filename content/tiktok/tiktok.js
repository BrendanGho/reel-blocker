window.RB = window.RB || {};
window.RB.tk = window.RB.tk || {};

// TikTok entry point: owns the single observer and gates all scans on the
// master toggle. Sub-modules only define window.RB.tk.*Scan.
(function () {
  function scanAll() {
    const s = window.RB.storage.get();
    if (!s.blockingEnabled) {
      if (window.RB.tk.setOverlay) window.RB.tk.setOverlay(false);
      window.RB.unblockAll();
      return;
    }
    try { window.RB.checkAndRedirect(); } catch (e) { console.error('[reel-blocker] TK redirect failed:', e); }
    const scans = ['feedScan', 'followingScan', 'navScan'];
    for (const name of scans) {
      try {
        if (typeof window.RB.tk[name] === 'function') window.RB.tk[name]();
      } catch (e) {
        console.error('[reel-blocker] TikTok ' + name + ' failed:', e);
      }
    }
  }

  // Mirror real settings into page-origin localStorage and re-apply preempt.js's
  // document_start anti-flash class. preempt.js reads only this mirror (sync,
  // before paint); here — once chrome.storage resolves or a toggle flips — we
  // write the true values so the class tracks the live settings.
  function syncMirror() {
    const s = window.RB.storage.get();
    try {
      localStorage.setItem('rb:blockingEnabled', s.blockingEnabled ? '1' : '0');
      localStorage.setItem('rb:allowFollowing', s.allowFollowing ? '1' : '0');
    } catch (e) { /* localStorage unavailable; preempt falls back to defaults */ }
    if (typeof window.RB.tk.preemptApply === 'function') window.RB.tk.preemptApply();
  }

  window.RB.createObserver(scanAll);    // observes body + runs once
  // On a toggle flip, clear hides first so flipping allowFollowing ON (or
  // re-enabling) reveals now-allowed content; scanAll() then re-hides whatever
  // should stay blocked. scanAll() alone only hides, never un-hides.
  window.RB.storage._onChange = function () { syncMirror(); window.RB.unblockAll(); scanAll(); };
  window.RB.storage.init(function () { syncMirror(); window.RB.unblockAll(); scanAll(); });

  // SPA navigation + timed rescans. Without these the overlay could linger on a
  // surface it shouldn't cover (e.g. a creator's profile or search), which would
  // block the Follow button. feedScan removes the overlay on any non-feed path,
  // so we must re-run it on every route change, not only on DOM mutations.
  [250, 600, 1200, 2500].forEach((t) => setTimeout(scanAll, t));
  window.addEventListener('load', scanAll);

  const _push = history.pushState.bind(history);
  history.pushState = function (...a) { _push(...a); scanAll(); setTimeout(scanAll, 300); };
  const _replace = history.replaceState.bind(history);
  history.replaceState = function (...a) { _replace(...a); scanAll(); setTimeout(scanAll, 300); };
  window.addEventListener('popstate', () => { scanAll(); setTimeout(scanAll, 300); });
})();
