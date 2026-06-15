window.RB = window.RB || {};
window.RB.ig = window.RB.ig || {};

// Instagram entry point: owns the single debounced observer and gates every
// per-surface scan on the master toggle. Sub-module files only define
// window.RB.ig.*Scan; orchestration lives here.
(function () {
  function scanAll() {
    // Reconcile the document_start mask on EVERY pass (the observer runs scanAll
    // on every DOM mutation). The mask is home-only and permanent while there, so
    // it must self-remove the instant we leave '/'. Doing it here — not just on
    // the pushState/popstate hooks — means an SPA route IG drives without firing
    // our history patch (-> messages, profile) still un-masks on its first DOM
    // mutation, instead of stranding those pages behind a hidden <main>.
    try {
      if (typeof window.RB.preemptApply === 'function') window.RB.preemptApply();
    } catch (e) { /* preempt absent; nothing to reconcile */ }

    const s = window.RB.storage.get();
    if (!s.blockingEnabled) {
      window.RB.unblockAll();
      return;
    }
    try { window.RB.checkAndRedirect(); } catch (e) { console.error('[reel-blocker] IG redirect failed:', e); }
    const scans = ['navScan', 'feedScan', 'exploreScan', 'profileScan'];
    for (const name of scans) {
      try {
        if (typeof window.RB.ig[name] === 'function') window.RB.ig[name]();
      } catch (e) {
        console.error('[reel-blocker] IG ' + name + ' failed:', e);
      }
    }
  }

  // Mirror the real settings into page-origin localStorage and refresh the
  // document_start anti-flash style (preempt.js). preempt.js can only read this
  // mirror synchronously before paint; here — once chrome.storage has resolved
  // or a toggle has flipped — we write the true values and re-apply so the style
  // is correct (and is removed when blocking is off or allowFollowing is on).
  function syncPreempt() {
    const s = window.RB.storage.get();
    try {
      localStorage.setItem('rb:blockingEnabled', s.blockingEnabled ? '1' : '0');
      localStorage.setItem('rb:allowFollowing', s.allowFollowing ? '1' : '0');
    } catch (e) { /* localStorage unavailable; preempt falls back to defaults */ }
    if (typeof window.RB.preemptApply === 'function') window.RB.preemptApply();
  }

  // createObserver() already observes document.body and runs scanAll once.
  window.RB.createObserver(scanAll);

  // Track the master toggle's prior value so _onChange can detect an OFF->ON flip
  // (which gets the reload/redirect treatment below).
  let prevBlocking = false;

  // Re-scan the instant a toggle flips. A flip can both REVEAL and HIDE: turning
  // allowFollowing ON must un-hide already-blocked followed posts, and re-enabling
  // the master toggle must re-hide cleanly. scanAll() alone only hides (its scans
  // skip allowed items without clearing their existing data-rb-blocked mark), so
  // we unblockAll() first to start from a clean slate, then re-derive what stays
  // hidden. (Mirrors youtube.js onSettingsChange.)
  //
  // OFF->ON gets special handling: an already-rendered (and possibly scrolled)
  // page can't be masked from document_start, so blocking it in place flickers.
  // Instead, on a reel/audio URL redirect straight out, and on the home feed do
  // a full reload so preempt.js masks cleanly from the top.
  window.RB.storage._onChange = function () {
    const s = window.RB.storage.get();
    const turnedOn = !prevBlocking && s.blockingEnabled;
    prevBlocking = s.blockingEnabled;
    syncPreempt();
    if (turnedOn) {
      try { window.RB.checkAndRedirect(); } catch (e) {}
      if (window.location.pathname === '/') { location.reload(); return; }
    }
    window.RB.unblockAll();
    scanAll();
  };

  // Pull real settings into the cache, then re-scan with the true values.
  // MUST unblockAll() first: early timeout scans (below) may have already run
  // with stale default settings (allowFollowing: false) and blocked articles
  // that should be visible under the real settings. Without clearing those
  // marks, scanAll() skips them (blockElement bails on data-rb-blocked).
  window.RB.storage.init(function () {
    prevBlocking = window.RB.storage.get().blockingEnabled;
    syncPreempt();
    window.RB.unblockAll();
    scanAll();
  });

  // Fix: "entering Instagram with blocking on doesn't block on first load."
  // The MutationObserver only fires for FUTURE mutations, and the feed is
  // frequently already in the DOM at document_idle — so those initial posts
  // were never (re)scanned once storage resolved. Re-scan a few times after
  // load and on every SPA navigation to catch already-present + late content.
  [250, 600, 1200, 2500].forEach((t) => setTimeout(scanAll, t));
  window.addEventListener('load', scanAll);

  // Instagram routes via history.pushState (no event) — patch it, plus a
  // delayed pass so the new view's content has time to render before we scan.
  const _push = history.pushState.bind(history);
  history.pushState = function (...a) {
    _push(...a);
    scanAll();
    setTimeout(scanAll, 400);
  };
  window.addEventListener('popstate', () => { scanAll(); setTimeout(scanAll, 400); });

  // Returning to a backgrounded tab: IG resumes fetching and re-renders the feed,
  // so a loading spinner / late posts could surface. Re-assert preempt.js's mask
  // (self-gates to block-all home; the mask is permanent so this is idempotent and
  // cannot flash) and re-scan so the resuming render stays suppressed. pageshow
  // also covers bfcache restores, which don't re-run document_start.
  function onShow() {
    try { if (typeof window.RB.preemptRearm === 'function') window.RB.preemptRearm(); } catch (e) {}
    scanAll();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') onShow();
  });
  window.addEventListener('pageshow', (e) => { if (e.persisted) onShow(); });
})();
