window.RB = window.RB || {};
window.RB.ig = window.RB.ig || {};

// Remove the Reels entry from the nav bar. Called by the entry-point observer.
window.RB.ig.navScan = function () {
  document.querySelectorAll('a[href="/reels/"], nav a[aria-label*="Reels" i]')
    .forEach((el) => window.RB.blockElement(el));
};
