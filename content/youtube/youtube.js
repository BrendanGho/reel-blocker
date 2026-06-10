window.RB = window.RB || {};
window.RB.yt = window.RB.yt || {};

// YouTube Shorts blocker.
//
// Runs under the single master toggle, exactly like the other platforms. The
// universal "Allow from following" sub-toggle has NO effect on YouTube.
//
// (A "show only Shorts from channels I'm subscribed to" mode was prototyped and
// removed: YouTube's homepage/shelf Short cards do not expose the channel in the
// DOM, so subscription status can't be determined per-card reliably. Filtering
// would hide everything anyway, so it was dropped for simplicity. allowFollowing
// is therefore a no-op here, same as on Facebook.)
//
// When blockingEnabled is on, ALL Shorts are blocked: the homepage / feed Shorts
// shelves, the Shorts guide/nav entry, every Shorts card in grids/search, and the
// /shorts/ player (redirected to the homepage).
//
// SELECTORS: tag names plus the /shorts/ href are the stable anchors. Re-verify
// with the probe in NEXT_STEPS.md. Never anchor on obfuscated class names.

// --- selectors ---------------------------------------------------------------
window.RB.yt.SHORTS_SHELF =
  'ytd-rich-shelf-renderer[is-shorts], ' +
  'ytd-reel-shelf-renderer, ' +
  'ytd-rich-shelf-renderer:has(ytd-reel-item-renderer), ' +
  'ytd-rich-shelf-renderer:has(a[href^="/shorts/"])';

window.RB.yt.SHORTS_NAV =
  'ytd-guide-entry-renderer:has(a[href="/shorts"]), ' +
  'ytd-mini-guide-entry-renderer:has(a[href="/shorts"]), ' +
  'a[title="Shorts"], ' +
  'ytd-guide-entry-renderer:has(yt-formatted-string[title="Shorts"])';

window.RB.yt.SHORTS_LINK = 'a[href^="/shorts/"]';
window.RB.yt.REEL_ITEM = 'ytd-reel-item-renderer';

// Card containers a /shorts/ link may sit inside, anywhere on the site.
window.RB.yt.SHORTS_CARD =
  'ytd-video-renderer, ytd-grid-video-renderer, ytd-rich-item-renderer, ' +
  'ytd-reel-item-renderer, ytd-compact-video-renderer, ytm-shorts-lockup-view-model';

// --- main scan ---------------------------------------------------------------
window.RB.yt.shortsScan = function () {
  const s = window.RB.storage.get();
  if (!s.blockingEnabled) return;

  // 1) Shorts nav/guide entry.
  document.querySelectorAll(window.RB.yt.SHORTS_NAV).forEach((el) => {
    const entry = el.closest('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer') || el;
    window.RB.blockElement(entry);
  });

  // 2) Shorts shelves (whole shelf).
  document.querySelectorAll(window.RB.yt.SHORTS_SHELF).forEach((shelf) => {
    window.RB.blockElement(shelf);
  });

  // 3) Standalone Shorts cards (search, home grid, channel pages).
  document.querySelectorAll(window.RB.yt.SHORTS_LINK).forEach((a) => {
    const card = a.closest(window.RB.yt.SHORTS_CARD) || a;
    window.RB.blockElement(card);
  });

  // 4) Standalone reel-item elements not covered above.
  document.querySelectorAll(window.RB.yt.REEL_ITEM).forEach((el) => {
    window.RB.blockElement(el);
  });
};

// /shorts/<id> watch URLs are always bounced to the homepage while blocking is on.
window.RB.yt.checkAndRedirect = function () {
  const s = window.RB.storage.get();
  if (!s.blockingEnabled) return;
  if (!window.location.pathname.startsWith('/shorts/')) return;
  window.location.href = 'https://www.youtube.com/';
};

// --- entry point -------------------------------------------------------------
// One observer, gated on the master toggle, plus SPA + timed rescans so
// already-rendered Shorts are caught on first paint. YouTube is a heavy SPA
// built from <ytd-*> custom elements and fires `yt-navigate-finish` on internal
// navigation (in addition to history.pushState).
(function () {
  function scanAll() {
    const s = window.RB.storage.get();
    if (!s.blockingEnabled) { window.RB.unblockAll(); return; }
    try { window.RB.yt.checkAndRedirect(); } catch (e) { console.error('[reel-blocker] YT redirect failed:', e); }
    try { window.RB.yt.shortsScan(); } catch (e) { console.error('[reel-blocker] YT shortsScan failed:', e); }
  }

  window.RB.createObserver(scanAll);
  // Clear hides first on a toggle flip so re-enabling reveals/re-hides cleanly;
  // scanAll() alone only hides, never un-hides.
  window.RB.storage._onChange = function () { window.RB.unblockAll(); scanAll(); };
  window.RB.storage.init(scanAll);

  [250, 600, 1200, 2500].forEach((t) => setTimeout(scanAll, t));
  window.addEventListener('load', scanAll);

  const _push = history.pushState.bind(history);
  history.pushState = function (...a) { _push(...a); scanAll(); setTimeout(scanAll, 400); };
  window.addEventListener('popstate', () => { scanAll(); setTimeout(scanAll, 400); });
  window.addEventListener('yt-navigate-finish', scanAll);
})();
