window.RB = window.RB || {};
window.RB.ig = window.RB.ig || {};

// Explore page: discovery content is never "from people you follow", so it is
// blocked in full regardless of the allowFollowing sub-toggle. Hide every grid
// card (photos AND reels), leaving the nav rail and search bar usable.
window.RB.ig.exploreScan = function () {
  if (!window.RB.storage.get().blockingEnabled) return;
  if (!window.location.pathname.startsWith('/explore')) return;
  let matched = 0;
  document.querySelectorAll('main a[href*="/p/"], main a[href*="/reel/"], article')
    .forEach((el) => { window.RB.blockElement(el); matched++; });
  if (matched === 0) {
    console.warn('[reel-blocker] No explore cards matched on /explore — selector may be stale');
  }
};
