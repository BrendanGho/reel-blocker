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
// change). Toggles ship DISABLED on first install, so an unknown mirror means
// "don't pre-hide"; instagram.js re-runs apply() once real settings resolve and
// adds the style if blocking is actually on (worst case before the mirror is
// seeded: one reel flash on the very first page load after install).
//
// TWO MODES, both driven by CSS injected before first paint so nothing flashes:
//
// BLOCK mode (blocking ON, allowFollowing OFF) — "hide EVERY post". The home
// feed, the pre-<article> raw media IG paints before wrapping a post, and the
// infinite-scroll spinner all live inside <main> (verified against live DOM
// 2026-06-10). The left nav rail, DMs and search live OUTSIDE <main>. So we mask
// ALL of <main> with visibility:hidden and never lift it: there is no reveal
// window in which anything can flash. The pieces of <main> the user still wants
// (Stories tray, the right "Suggested for you"/footer column) live in
// article-free branches beside the feed, so feed.js tags each with data-rb-show
// and the rule flips just those subtrees back to visible. visibility (not
// display) is what makes this possible: a hidden ancestor still lets a descendant
// opt back in, and layout is preserved so IG's measurement/fetch is unaffected.
//
// FOLLOW mode (blocking ON, allowFollowing ON) — "show only posts from people
// you follow". The keep/block decision is dynamic (a post is judged from its
// Suggested/Sponsored/Follow markers, which render a tick AFTER the <article>
// appears), so we can't express it as static CSS. Instead we HIDE EVERY post by
// default (article:not([data-rb-keep])) and let feed.js add data-rb-keep to a
// post only once it has settled as a confirmed follow. A recommendation thus
// never paints-then-collapses (the jerky show-then-hide); it simply never earns
// the keep flag. No <main> mask and no scroll lock here — under allowFollowing we
// want to scroll the follow feed normally.
(function () {
  window.RB = window.RB || {};
  var STYLE_ID = 'rb-preempt-hide-feed';
  // feed.js stamps the keep-visible regions (Stories, suggestions, footer) with
  // this attribute; the stylesheet pokes them back through the mask.
  var SHOW_ATTR = 'data-rb-show';
  // Entry-curtain state (follow mode only — see apply()). When we ENTER the home
  // feed via SPA nav, IG reuses cached <article> nodes that still carry
  // data-rb-keep from the prior visit, so the normal follow rule reveals them
  // through the mask in the first frame — before feedScan re-validates — which is
  // the entry flash. For a short window we hold a full curtain over the feed
  // (Stories/suggestions still show) and reveal kept posts only once they've
  // re-settled. ENTRY_MS sits just past feed.js's SETTLE_MS (400ms).
  var ENTRY_MS = 500;
  var _entryTimer = null;
  var _homeEnteredAt = 0;
  var _lastMode = 'none';

  // 'block' | 'follow' | 'none', read synchronously from the localStorage mirror.
  function mode() {
    if (location.pathname !== '/') return 'none';  // home timeline only
    try {
      var blocking = localStorage.getItem('rb:blockingEnabled') === '1';
      var follow = localStorage.getItem('rb:allowFollowing') === '1';
      if (!blocking) return 'none';  // default OFF (toggles ship disabled)
      return follow ? 'follow' : 'block';
    } catch (e) {
      return 'none';  // unknown state -> don't pre-hide; instagram.js applies real settings
    }
  }

  function cssFor(m) {
    if (m === 'block') {
      return (
        // article: the steady-state hide once posts are wrapped. Stories are not
        //   <article> elements, so this never touches them.
        'article{display:none !important}' +
        // spinner: IG's infinite-scroll sentinel — hiding it (no layout box)
        //   stops the idle fetch loop and the spinner/skeleton flicker.
        'svg[aria-label*="Loading" i],[role="progressbar"]{display:none !important}' +
        // main: the permanent pre-paint mask over the whole content column.
        'main{visibility:hidden !important}' +
        // [data-rb-show]: Stories + suggestions/footer poked back through the mask.
        '[' + SHOW_ATTR + ']{visibility:visible !important}'
      );
    }
    if (m === 'follow') {
      // Hide-first + masked. Two problems to cover before first paint:
      //   1. A recommendation must never paint-then-collapse (the jerk). The
      //      display:none rule keeps every unconfirmed post collapsed (no layout
      //      box, no gap), and feed.js adds data-rb-keep only to settled follows.
      //   2. IG paints raw post media BEFORE wrapping it in <article>, so the
      //      article rule above can't catch that first frame — it would flash.
      //      Masking <main> (visibility:hidden) suppresses that raw paint exactly
      //      as in block mode. Confirmed follows are revealed back THROUGH the
      //      mask via visibility:visible (display:none is already lifted by their
      //      keep flag), alongside the Stories tray + suggestions/footer column
      //      (data-rb-show). The nav rail / DMs live outside <main>, untouched.
      return (
        'main{visibility:hidden !important}' +
        'article:not([data-rb-keep]){display:none !important}' +
        '[' + SHOW_ATTR + '],article[data-rb-keep]{visibility:visible !important}'
      );
    }
    if (m === 'follow-entry') {
      // The entry curtain. Identical to 'follow' EXCEPT it does NOT poke
      // article[data-rb-keep] back through the mask — so every post (stale-kept
      // or not) stays hidden during the entry window while feedScan re-settles.
      // Stories + suggestions (data-rb-show) still show, so the page isn't blank.
      return (
        'main{visibility:hidden !important}' +
        'article:not([data-rb-keep]){display:none !important}' +
        '[' + SHOW_ATTR + ']{visibility:visible !important}'
      );
    }
    return '';
  }

  // True only when the master toggle is actually on (read synchronously from the
  // localStorage mirror). mode() collapses both "blocking off" and "off-home" to
  // 'none', so the off-home article-hide below needs this to tell them apart —
  // otherwise it would also hide the home feed when the extension is OFF.
  function blockingOn() {
    try { return localStorage.getItem('rb:blockingEnabled') === '1'; }
    catch (e) { return false; }
  }

  function apply() {
    var m = mode();
    var have = document.getElementById(STYLE_ID);
    // Permalinks (/p/, /reel/, /reels/, /tv/) legitimately render an <article>
    // and are NOT the home feed — never hide anything there.
    var permalink = /^\/(p|reel|reels|tv)\//.test(location.pathname);
    if (m === 'none') {
      document.documentElement.style.removeProperty('overflow');
      _lastMode = 'none';
      if (_entryTimer) { clearTimeout(_entryTimer); _entryTimer = null; }
      // Only keep the off-home article-hide when blocking is ON and we're genuinely
      // away from the home feed. If blocking is OFF (extension disabled) or we're on
      // a permalink, hide nothing — remove the style entirely.
      if (!blockingOn() || permalink || location.pathname === '/') {
        if (have) have.remove();
        return;
      }
      // OFF-HOME (messages / profile / settings / explore / ...): keep a minimal,
      // ALWAYS-ON article-hide instead of tearing the style down. Two flashes this
      // kills, both caused by the old full-teardown leaving a gap:
      //   - LEAVING home, IG keeps the old feed's <article> nodes mounted for a
      //     beat during the route transition — with no rule they'd flash.
      //   - RETURNING to home, IG repaints the cached first <article> a frame
      //     BEFORE apply() can reinstall the mask — the reported first-item flash.
      // Because the rule never goes away, the feed's first item is already hidden
      // before we arrive back, so there is no gap to flash through. This is safe
      // on these surfaces: they render their real content OUTSIDE <main> with zero
      // <article>s (verified live 2026-06-10), so hiding <article> is a no-op for
      // them. We deliberately do NOT mask <main> here — that WOULD hide
      // messages/profile content.
      if (!have) {
        have = document.createElement('style');
        have.id = STYLE_ID;
        (document.head || document.documentElement).appendChild(have);
      }
      if (have.getAttribute('data-rb-mode') !== 'away') {
        have.textContent = 'article{display:none !important}';
        have.setAttribute('data-rb-mode', 'away');
      }
      return;
    }
    // Did we just ARRIVE on the home feed (from a non-home view or fresh load)?
    var entering = (_lastMode === 'none');
    if (entering) _homeEnteredAt = Date.now();
    _lastMode = m;
    if (!have) {
      have = document.createElement('style');
      have.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(have);
    }
    // In follow mode, hold the entry curtain for ENTRY_MS after arrival so cached
    // kept posts can't flash before feedScan re-validates; then fall through to
    // the normal follow rules. Block mode is already a permanent full curtain, so
    // it needs no entry handling.
    var effective = m;
    if (m === 'follow' && (Date.now() - _homeEnteredAt) < ENTRY_MS) {
      effective = 'follow-entry';
      // Lift the curtain even if DOM mutations (which drive apply) go quiet.
      if (!_entryTimer) {
        _entryTimer = setTimeout(function () {
          _entryTimer = null;
          apply();
        }, ENTRY_MS - (Date.now() - _homeEnteredAt));
      }
    }
    // Rebuild only on an effective-mode change (block<->follow<->follow-entry), so
    // toggling allowFollowing or lifting the curtain swaps rules without flashing.
    if (have.getAttribute('data-rb-mode') !== effective) {
      have.textContent = cssFor(effective);
      have.setAttribute('data-rb-mode', effective);
    }
    if (m === 'block') {
      // Bring the viewport to the top BEFORE locking: Stories live at the top of
      // the home page, so freezing a scrolled-down position (e.g. blocking turned
      // on mid-scroll) would strand them off-screen with no way to scroll back.
      window.scrollTo(0, 0);
      // Lock the root scroller. The feed is fully blocked here so there's nothing
      // below to reach, and scrolling is what makes IG fetch+hydrate the next
      // batch — no scroll, no fetch. Must be inline + 'important': IG's own
      // class-scoped `html{overflow:scroll !important}` rule outranks a plain
      // stylesheet rule of ours on specificity, but inline !important beats any
      // stylesheet rule.
      document.documentElement.style.setProperty('overflow', 'hidden', 'important');
    } else {
      // follow mode: ensure no leftover scroll lock from a prior block pass.
      document.documentElement.style.removeProperty('overflow');
    }
  }

  apply();

  // Re-apply on SPA navigation so the style matches the new path (e.g. removed
  // when leaving '/' for a profile or /p/ permalink, re-added on return).
  var _push = history.pushState;
  history.pushState = function () {
    var r = _push.apply(this, arguments);
    try { apply(); } catch (e) {}
    return r;
  };
  window.addEventListener('popstate', apply);

  // instagram.js calls preemptApply after real settings resolve / on every toggle
  // change, and preemptRearm when a backgrounded tab regains focus. With a
  // permanent mask both are just apply() — re-asserting the mask + scroll lock is
  // idempotent and cannot flash (there is no masked->revealed transition).
  window.RB.preemptApply = apply;
  window.RB.preemptRearm = apply;
})();
