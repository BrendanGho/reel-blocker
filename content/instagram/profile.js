window.RB = window.RB || {};
window.RB.ig = window.RB.ig || {};

// Instagram reserved first-path segments that are NOT usernames. Profile-grid
// blocking must never fire on these.
window.RB.ig.RESERVED_PATHS = new Set([
  'explore', 'reels', 'reel', 'direct', 'stories', 'accounts', 'p',
  'about', 'developer', 'legal', 'directory', 'web', 'challenge',
  'emails', 'session', 'lite', 'your_activity', 'settings', ''
]);

// Is the current URL a user profile page (/<username>/ or /<username>/reels/)?
window.RB.ig.isProfilePage = function () {
  const path = window.location.pathname.replace(/\/+$/, '/');
  const m = path.match(/^\/([^/]+)\/(reels\/?|tagged\/?|saved\/?)?$/);
  if (!m) return false;
  return !window.RB.ig.RESERVED_PATHS.has(m[1].toLowerCase());
};

// Best-effort: does the logged-in user follow the profile being viewed?
// The profile header's main action button reads "Following"/"Requested" when
// you follow them and "Follow" when you still can. We scope to the <header> so
// the "suggested accounts" carousel (rendered below it, full of other people's
// Follow buttons) can't interfere, and reuse the shared first-match follow
// detector. Re-check if IG changes the wording — NEXT_STEPS I-3.
window.RB.ig.isFollowedProfile = function () {
  const header = document.querySelector('header') ||
                 document.querySelector('main header');
  if (!header) return false;   // no header => can't confirm => treat as not-followed
  return window.RB.ig.followState(header) === 'following';
};

// Profile pages: hide the Reels tab, redirect .../<user>/reels/ to the profile
// root, and (Unit I-3) block the post grid. The header — avatar, bio, follower
// counts, action buttons — is always preserved so the page stays navigable.
window.RB.ig.profileScan = function () {
  if (!window.RB.storage.get().blockingEnabled) return;

  // 1) Hide the Reels sub-tab on the profile.
  document.querySelectorAll('a[href$="/reels/"]')
    .forEach((link) => window.RB.blockElement(link));

  const path = window.location.pathname;
  // Match /<user>/reels/ but not the global /reels/ (handled by redirect.js).
  if (/^\/[^/]+\/reels\/?$/.test(path) && path !== '/reels/') {
    history.replaceState(null, '', path.replace(/\/reels\/?$/, '/'));
  }

  // 2) Block the profile post grid (Unit I-3). Only on actual profile pages,
  // and only when not allowed through by the following sub-toggle.
  if (!window.RB.ig.isProfilePage()) return;

  const s = window.RB.storage.get();
  // allowFollowing ON + we follow this person => their grid is "from someone
  // you follow", so leave it visible. Otherwise block the grid.
  if (s.allowFollowing && window.RB.ig.isFollowedProfile()) return;

  // Hide each grid cell by anchoring on its post/reel link, walking up to the
  // grid row/cell. Never hide the header (it has no /p/ or /reel/ links).
  const main = document.querySelector('main') || document.body;
  main.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]').forEach((a) => {
    // Walk up to the immediate grid cell, stopping before <main>.
    let cell = a;
    let hop = a.parentElement;
    for (let i = 0; i < 4 && hop && hop !== main; i++) {
      cell = hop;
      hop = hop.parentElement;
    }
    window.RB.blockElement(cell);
  });
};
