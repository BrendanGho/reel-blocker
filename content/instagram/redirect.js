window.RB = window.RB || {};

// /reels/, /reel/<id>/ and /audio/* are blocked regardless of the sub-toggle,
// so a single master-toggle check is all that's needed here.
window.RB.checkAndRedirect = function () {
  const s = window.RB.storage.get();
  if (!s.blockingEnabled) return;
  const path = window.location.pathname;
  if (path === '/reels/' || /^\/reel\/[^/]+\/?$/.test(path) || path.startsWith('/audio/')) {
    window.location.href = 'https://www.instagram.com/?variant=following';
  }
};

// SPA routing on Instagram is driven by history.pushState, which fires no
// event — patch it. popstate covers back/forward.
const _pushState = history.pushState.bind(history);
history.pushState = function (...args) {
  _pushState(...args);
  window.RB.checkAndRedirect();
};
window.addEventListener('popstate', window.RB.checkAndRedirect);
