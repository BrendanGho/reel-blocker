window.RB = window.RB || {};
window.RB.fb = window.RB.fb || {};

// Remove the "Reels" shortcut from Facebook's left navigation / shortcuts.
// Anchor on the /reel(s)/ href and the "Reels" aria-label, never on classes.
window.RB.fb.navScan = function () {
  if (!window.RB.storage.get().blockingEnabled) return;
  document.querySelectorAll(
    'a[href^="/reel"][aria-label*="Reel" i], ' +
    'a[href*="/reel/?" i], ' +
    '[role="navigation"] a[href*="/reel"]'
  ).forEach((el) => {
    // Hide the whole nav item (list element) when present.
    const item = el.closest('li, [role="listitem"]') || el;
    window.RB.blockElement(item);
  });
};
