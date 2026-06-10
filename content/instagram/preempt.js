// Anti-flash pre-emptive hide (runs at document_start, before the feed paints).
//
// PROBLEM: every other module hides content AFTER it has rendered — the observer
// can only fire once IG inserts a post, so there is always a visible flash
// before display:none lands. That flash is unavoidable for the cases where the
// keep/block decision is dynamic (e.g. allowFollowing ON keeps SOME posts).
//
// But one case is fully static: home feed ('/') with blocking ON and
// allowFollowing OFF means "hide EVERY post". That can be expressed as CSS and
// applied before first paint, eliminating the flash entirely on the home feed.
//
// chrome.storage is async, so we can't read the real settings synchronously at
// document_start. Instead we read a mirror of the toggle state kept in the
// page-origin localStorage (written by instagram.js whenever settings load or
// change). Unknown -> assume the spec default (blocking on, following off) and
// hide; instagram.js re-runs apply() once real settings resolve and removes the
// style if that assumption was wrong (worst case: a brief blank feed, never a
// reel flash).
(function () {
  window.RB = window.RB || {};
  var STYLE_ID = 'rb-preempt-hide-feed';

  function wantHide() {
    if (location.pathname !== '/') return false;  // home timeline only
    try {
      var b = localStorage.getItem('rb:blockingEnabled');
      var f = localStorage.getItem('rb:allowFollowing');
      var blocking = b === null ? true : b === '1';  // default ON
      var follow = f === '1';                         // default OFF
      return blocking && !follow;
    } catch (e) {
      return true;  // localStorage blocked -> fail toward hiding on home
    }
  }

  function apply() {
    var have = document.getElementById(STYLE_ID);
    if (wantHide()) {
      if (!have) {
        var st = document.createElement('style');
        st.id = STYLE_ID;
        // Stories are not <article> elements, so this never touches them.
        st.textContent = 'article{display:none !important}';
        (document.head || document.documentElement).appendChild(st);
      }
    } else if (have) {
      have.remove();
    }
  }

  apply();

  // Re-apply on SPA navigation so the style matches the new path (e.g. removed
  // when leaving '/' for a profile or /p/ permalink).
  var _push = history.pushState;
  history.pushState = function () {
    var r = _push.apply(this, arguments);
    try { apply(); } catch (e) {}
    return r;
  };
  window.addEventListener('popstate', apply);

  // instagram.js calls this after real settings resolve / on every toggle change.
  window.RB.preemptApply = apply;
})();
