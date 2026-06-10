window.RB = window.RB || {};
window.RB.fb = window.RB.fb || {};

// Facebook entry point: one debounced observer + SPA nav watcher.
// The feed overlay covers News Feed (/) and Watch (/watch, /videos).
// Reels pages (/reel/<id>, /reels/) are hard-redirected by redirect.js.
// Groups, Events, Messages, Marketplace and profile pages are never touched.
//
// OUT OF SCOPE: Facebook messaging lives on a separate host (messenger.com)
// and is not injected here.
(function () {
  function scanAll() {
    const s = window.RB.storage.get();
    if (!s.blockingEnabled) {
      window.RB.unblockAll();
      if (typeof window.RB.fb.setOverlay === 'function') window.RB.fb.setOverlay(false);
      return;
    }
    try { window.RB.fbCheckAndRedirect(); } catch (e) { console.error('[reel-blocker] FB redirect failed:', e); }
    const scans = ['navScan', 'feedScan'];
    for (const name of scans) {
      try {
        if (typeof window.RB.fb[name] === 'function') window.RB.fb[name]();
      } catch (e) {
        console.error('[reel-blocker] FB ' + name + ' failed:', e);
      }
    }
  }

  window.RB.createObserver(scanAll);
  // Clear hides first on a toggle flip so re-enabling reveals/re-hides cleanly;
  // scanAll() alone only hides, never un-hides.
  window.RB.storage._onChange = function () { window.RB.unblockAll(); scanAll(); };
  window.RB.storage.init(function () { window.RB.unblockAll(); scanAll(); });

  [250, 600, 1200, 2500].forEach((t) => setTimeout(scanAll, t));
  window.addEventListener('load', scanAll);

  const _push = history.pushState.bind(history);
  history.pushState = function (...a) { _push(...a); scanAll(); setTimeout(scanAll, 400); };
  window.addEventListener('popstate', () => { scanAll(); setTimeout(scanAll, 400); });
})();
