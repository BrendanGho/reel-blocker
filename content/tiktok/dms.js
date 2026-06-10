window.RB = window.RB || {};
window.RB.tk = window.RB.tk || {};

// DMs: replace shared-video previews with a placeholder; keep the inbox usable.
window.RB.tk.dmsScan = function () {
  if (!window.RB.storage.get().blockingEnabled) return;
  if (!window.location.pathname.startsWith('/messages')) return;
  try {
    document.querySelectorAll('div[data-e2e*="chat"] div:has(> video), a[href*="/video/"]:has(video)')
      .forEach((el) => window.RB.placeholderElement(el, 'TikTok video blocked'));
  } catch (e) {
    console.warn('[reel-blocker] TikTok DM scan error:', e);
  }
};
