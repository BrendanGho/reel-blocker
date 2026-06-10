window.RB = window.RB || {};
window.RB.tk = window.RB.tk || {};

// SPA redirects for TikTok. The root and /video/ URLs go to /following when the
// sub-toggle is on; otherwise the blocked overlay (owned by feed.js) covers them.
window.RB.checkAndRedirect = function () {
  const s = window.RB.storage.get();
  if (!s.blockingEnabled) {
    if (window.RB.tk.setOverlay) window.RB.tk.setOverlay(false);
    return;
  }
  const path = window.location.pathname;
  if (path === '/') {
    if (s.allowFollowing) window.location.href = 'https://www.tiktok.com/following';
    return; // For You overlay handled by feedScan
  }
  if (path.startsWith('/video/')) {
    if (s.allowFollowing) {
      window.location.href = 'https://www.tiktok.com/following';
      return;
    }
    if (window.RB.tk.setOverlay) window.RB.tk.setOverlay(true);
  }
};

const _pushState = history.pushState.bind(history);
history.pushState = function (...args) {
  _pushState(...args);
  window.RB.checkAndRedirect();
};
window.addEventListener('popstate', window.RB.checkAndRedirect);
