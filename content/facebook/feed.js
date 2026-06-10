window.RB = window.RB || {};
window.RB.fb = window.RB.fb || {};

// Facebook scope: block the SCROLLABLE feeds (the addictive infinite scroll) —
// the home News Feed, the Groups feed, the Watch video feed — plus Reels.
//
// We do this by hiding every `[role="feed"]` container. That is the stable ARIA
// anchor Facebook puts on the scrollable feed list, and hiding just that element
// removes the whole scroll surface while leaving EVERYTHING else usable: the top
// bar/search, the left nav, the right rail (contacts/chat), the status composer,
// and destination pages like Marketplace, Groups landing, Events, profiles and
// Messenger. This is more reliable than a full-screen overlay (no fragile
// nav-width measurement, never covers chat) and never swallows clicks.
//
// Reels: /reel/<id> and /reels/ are bounced to home by redirect.js.
//
// allowFollowing has NO effect on Facebook: the News Feed is an algorithmic mix
// (friends, followed Pages, Groups, Marketplace, ads) with no clean "people you
// follow" feed to expose, so there is nothing to selectively allow through.
//
// SELECTORS: Facebook class names are fully obfuscated — anchor ONLY on stable
// signals (role="feed", a /reel/ href, an aria-label containing "Reel"). Never
// add class-name selectors. Verify with the probe in NEXT_STEPS.md.

// The scrollable feed list(s). role="feed" is reused for home, groups and watch.
window.RB.fb.FEED = '[role="feed"]';

// Reel units that can appear outside a feed (e.g. a reels tray/shelf).
window.RB.fb.REEL_CARD =
  '[role="article"]:has(a[href*="/reel/"]), ' +
  'div[aria-label*="Reel" i]:has(a[href*="/reel/"]), ' +
  'a[href*="/reels/tray" i]';

window.RB.fb.feedScan = function () {
  const s = window.RB.storage.get();
  if (!s.blockingEnabled) return;

  let matched = 0;
  try {
    // 1) Hide every scrollable feed container.
    document.querySelectorAll(window.RB.fb.FEED).forEach((el) => {
      window.RB.blockElement(el); matched++;
    });

    // 2) Hide any standalone reel units / trays not inside a feed.
    document.querySelectorAll(window.RB.fb.REEL_CARD).forEach((el) => {
      window.RB.blockElement(el); matched++;
    });
    document.querySelectorAll('a[href*="/reel/"]').forEach((a) => {
      const card = a.closest('[role="article"]');
      if (card) { window.RB.blockElement(card); matched++; }
    });
  } catch (e) {
    console.warn('[reel-blocker] FB feed scan error:', e);
  }

  if (matched === 0 && window.location.pathname === '/') {
    console.warn('[reel-blocker] No Facebook feed matched on / — selector may be stale');
  }
};
