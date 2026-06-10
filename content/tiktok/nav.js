window.RB = window.RB || {};
window.RB.tk = window.RB.tk || {};

// Hide the For You / Explore nav items so they can't be reopened.
window.RB.tk.navScan = function () {
  if (!window.RB.storage.get().blockingEnabled) return;
  document.querySelectorAll(
    'a[href="/foryou"], a[href="/explore"], ' +
    'a[aria-label*="For You" i], a[aria-label*="Explore" i]'
  ).forEach((el) => window.RB.blockElement(el));
};
