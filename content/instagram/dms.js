window.RB = window.RB || {};
window.RB.ig = window.RB.ig || {};

// DMs: replace a shared reel/post preview with a styled placeholder so the
// recipient knows something was sent. Never remove — messaging must keep working.
window.RB.ig.dmsScan = function () {
  const s = window.RB.storage.get();
  if (!s.blockingEnabled) return;
  if (!window.location.pathname.startsWith('/direct')) return;
  try {
    // Reel shares in DMs render a <video> inside a row/link element.
    document.querySelectorAll('div[role="row"]:has(video), a[href*="/reel/"]:has(video)')
      .forEach((el) => window.RB.placeholderElement(el, 'Content blocked'));
  } catch (e) {
    console.warn('[reel-blocker] IG DM scan error:', e);
  }
};
