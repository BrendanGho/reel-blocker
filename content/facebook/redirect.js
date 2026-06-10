window.RB = window.RB || {};

// Facebook reel watch surfaces: /reel/<id> and /reels/... — bounce to the
// normal Facebook home. Blocked regardless of any sub-toggle. The background
// rules cover hard navigations; this covers SPA (pushState) routing.
window.RB.fbCheckAndRedirect = function () {
  const s = window.RB.storage.get();
  if (!s.blockingEnabled) return;
  const path = window.location.pathname;
  if (/^\/reel\//.test(path) || path === '/reels/' || path.startsWith('/reels/')) {
    window.location.href = 'https://www.facebook.com/';
  }
};

const _push = history.pushState.bind(history);
history.pushState = function (...args) {
  _push(...args);
  window.RB.fbCheckAndRedirect();
};
window.addEventListener('popstate', window.RB.fbCheckAndRedirect);
