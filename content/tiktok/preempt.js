// Anti-flash pre-emptive hide for TikTok (runs at document_start, before paint).
//
// PROBLEM: feed.js blocks the For You / Explore feeds with a JS overlay added on
// each scan. But the overlay is REMOVED whenever you're on a non-blocked surface
// (Messages, Following-with-allow), so returning to For You — or switching tabs
// into it — leaves a gap: TikTok reveals the cached first reel a frame before
// scanAll re-shows the overlay. That is the single-frame flicker.
//
// FIX (mirrors instagram/preempt.js): a persistent stylesheet, injected before
// first paint, that hides the feed's <video> whenever a class is present on
// <html>. The class is toggled SYNCHRONOUSLY on every navigation (document_start
// load, pushState, replaceState, popstate) — the earliest possible hook, ahead
// of TikTok's own async render — so the reel never paints during the gap. The JS
// overlay still provides the visible "blocked" screen + nav-rail offset; this
// only kills the flash window the overlay can't reach.
//
// chrome.storage is async, so settings are read synchronously from a localStorage
// mirror (rb:blockingEnabled / rb:allowFollowing) that tiktok.js keeps in sync.
// Unknown mirror (first load after install) -> don't pre-hide; tiktok.js applies
// real settings once chrome.storage resolves.
//
// The class is scoped to the feed (<video> + known feed-list containers), never
// the left nav rail (a separate subtree), so navigation stays clickable.
(function () {
  window.RB = window.RB || {};
  window.RB.tk = window.RB.tk || {};
  var STYLE_ID = 'rb-tk-preempt-style';
  var BLOCK_CLASS = 'rb-tk-block';

  // True when the CURRENT path is a feed surface we block. Mirrors
  // feed.js feedScan: For You + Explore always; Following only when the
  // allowFollowing sub-toggle is off.
  function blockedPath() {
    try {
      if (localStorage.getItem('rb:blockingEnabled') !== '1') return false;
      var p = location.pathname;
      var allowFollowing = localStorage.getItem('rb:allowFollowing') === '1';
      if (p === '/' || p === '/foryou') return true;
      if (p.indexOf('/explore') === 0) return true;
      if (p.indexOf('/following') === 0) return !allowFollowing;
      return false;
    } catch (e) {
      return false;  // unknown state -> don't pre-hide
    }
  }

  function ensureStyle() {
    var el = document.getElementById(STYLE_ID);
    if (el) return;
    el = document.createElement('style');
    el.id = STYLE_ID;
    // Only bites while html.rb-tk-block is present (set only on blocked feed
    // paths). The broad `video` rule is safe BECAUSE of that scoping: on
    // Following-with-allow, Messages, and profiles the class is absent, so their
    // video is untouched. Known feed-list containers are included so the caption
    // column collapses too, not just the media.
    el.textContent =
      'html.' + BLOCK_CLASS + ' video,' +
      'html.' + BLOCK_CLASS + ' [data-e2e="feed-video"],' +
      'html.' + BLOCK_CLASS + ' [data-e2e*="video-feed-item"],' +
      'html.' + BLOCK_CLASS + ' [data-e2e="recommend-list-item-container"],' +
      'html.' + BLOCK_CLASS + ' [id*="column-list-container"]' +
      '{visibility:hidden !important}';
    (document.head || document.documentElement).appendChild(el);
  }

  function muteVideo(v) {
    try {
      v.muted = true;
      v.volume = 0;
      if (!v.paused) v.pause();
    } catch (e) { /* ignore individual media errors */ }
  }

  function apply() {
    ensureStyle();
    var on = blockedPath();
    document.documentElement.classList.toggle(BLOCK_CLASS, on);
    // Visibility:hidden does NOT stop audio — mute any video already present.
    if (on) {
      try { document.querySelectorAll('video').forEach(muteVideo); } catch (e) {}
    }
  }

  // The CSS hides the reel but can't silence it, and feed.js's muteAll only runs
  // on the next scan — so an autoplaying reel leaks a sliver of audio in between.
  // A CAPTURING 'play' listener installed at document_start fires the instant any
  // video begins (before it bubbles), so on a blocked path we mute it immediately.
  // 'volumechange' re-mutes if TikTok tries to restore volume.
  document.addEventListener('play', function (e) {
    var t = e.target;
    if (t && t.tagName === 'VIDEO' && blockedPath()) muteVideo(t);
  }, true);
  document.addEventListener('volumechange', function (e) {
    var t = e.target;
    if (t && t.tagName === 'VIDEO' && blockedPath() && (t.volume > 0 || !t.muted)) muteVideo(t);
  }, true);

  apply();

  // Toggle synchronously on SPA navigation, BEFORE TikTok's own render reacts to
  // the route change. preempt.js loads at document_start, so these patches sit
  // beneath tiktok.js's later pushState patch and both run.
  var _push = history.pushState;
  history.pushState = function () {
    var r = _push.apply(this, arguments);
    try { apply(); } catch (e) {}
    return r;
  };
  var _replace = history.replaceState;
  history.replaceState = function () {
    var r = _replace.apply(this, arguments);
    try { apply(); } catch (e) {}
    return r;
  };
  window.addEventListener('popstate', apply);

  // tiktok.js calls this after real settings resolve and on every toggle change.
  window.RB.tk.preemptApply = apply;
})();
