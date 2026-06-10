window.RB = window.RB || {};
window.RB.tk = window.RB.tk || {};

// Candidate selectors for TikTok's left navigation rail. We measure whichever
// one matches and start the overlay at its right edge, so the rail (For You,
// Friends, Messages, Profile, etc.) stays visible and clickable. These are
// obfuscation-resistant anchors; if TikTok drifts, re-verify with the selector
// probe in NEXT_STEPS.md and update this list — nothing else needs to change.
window.RB.tk.NAV_SELECTORS = [
  '#main-content-homepage_hot ~ * nav',     // defensive
  '[class*="SideNav"]',
  '[class*="DivSideNavContainer"]',
  '[data-e2e="nav-foryou"]',                // measure its containing rail
  'nav[aria-label]',
];

// Width to leave clear on the left when the nav rail can't be located, so the
// user is never fully locked out of navigation. TikTok's expanded rail is
// ~240px; the collapsed rail is ~72px. 240 is the safe default.
window.RB.tk.NAV_FALLBACK_WIDTH = 240;

// Bounds for a plausible nav rail: collapsed ~72px, expanded ~240px. We never
// trust a measurement outside [60, 320]; outside that range we use the safe
// fallback. This guarantees the overlay (a) never covers the nav rail — which
// would block reaching profiles/search to follow people — and (b) never
// collapses to zero width (which would leave the feed visible).
window.RB.tk.NAV_MIN_EDGE = 60;
window.RB.tk.NAV_MAX_EDGE = 320;

function rbTkNavRightEdge() {
  for (const sel of window.RB.tk.NAV_SELECTORS) {
    let el;
    try { el = document.querySelector(sel); } catch (e) { continue; }
    if (!el) continue;
    // Walk up looking for a node shaped like the rail: left-anchored, tall,
    // and narrow. Only such a node is trusted as the rail's right edge.
    let node = el;
    for (let i = 0; i < 6 && node; i++) {
      const r = node.getBoundingClientRect();
      if (r.left <= 2 && r.height > 200 &&
          r.right >= window.RB.tk.NAV_MIN_EDGE &&
          r.right <= window.RB.tk.NAV_MAX_EDGE) {
        return Math.round(r.right);
      }
      node = node.parentElement;
    }
  }
  return window.RB.tk.NAV_FALLBACK_WIDTH;
}

// Blocked screen that covers the feed/content area but NOT the left nav rail.
// Idempotent: identified by #rb-tk-overlay so repeated scans never stack it.
// The left offset is recomputed on each show so it tracks rail collapse/expand.
window.RB.tk.setOverlay = function (show) {
  let o = document.getElementById('rb-tk-overlay');
  if (show) {
    const left = rbTkNavRightEdge();
    if (!o) {
      o = document.createElement('div');
      o.id = 'rb-tk-overlay';
      const main = document.createElement('div');
      main.textContent = 'Short-form content blocked';
      main.style.cssText = 'color:#fff;font-size:20px;font-weight:600;';
      const sub = document.createElement('div');
      sub.textContent = 'Focus Guard is active';
      sub.style.cssText = 'color:#ccc;font-size:14px;';
      o.appendChild(main);
      o.appendChild(sub);
      (document.body || document.documentElement).appendChild(o);
    }
    // (Re)apply position every time so the rail stays exposed even if the
    // layout reflows or the rail width changes.
    o.style.cssText = 'position:fixed;top:0;bottom:0;right:0;left:' + left + 'px;' +
      'background:#0a0a0a;z-index:2147483647;display:flex;flex-direction:column;' +
      'align-items:center;justify-content:center;gap:8px;';
  } else if (o) {
    o.remove();
  }
};

// Pause and mute every video so audio never plays behind the blocked screen.
// Called on every scan because TikTok autoplays freshly-inserted <video>s.
window.RB.tk.muteAll = function () {
  document.querySelectorAll('video').forEach((v) => {
    try {
      v.muted = true;
      v.volume = 0;
      if (!v.paused) v.pause();
    } catch (e) { /* ignore individual media errors */ }
  });
};

// Decide whether the current full-page surface should be blocked:
// For You + Explore always; Following only when the sub-toggle is off.
window.RB.tk.feedScan = function () {
  const s = window.RB.storage.get();
  const path = window.location.pathname;
  const isForYou = path === '/' || path === '/foryou';
  const isExplore = path.startsWith('/explore');
  const isFollowing = path.startsWith('/following');

  let block = false;
  if (s.blockingEnabled) {
    if (isForYou || isExplore) block = true;
    else if (isFollowing && !s.allowFollowing) block = true;
  }
  window.RB.tk.setOverlay(block);
  if (block) window.RB.tk.muteAll();
};
