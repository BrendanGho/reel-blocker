# Agent Summary

Status of the reel-blocker extension after the latest round of fixes and the
addition of YouTube Shorts (Phase 2). The codebase blocks short-form/feed content
across Instagram, TikTok and YouTube under a single master toggle, with two
universal sub-toggles ("Allow from following", "Allow messaged content").
Everything is vanilla JS using the `window.RB.*` namespace and the shared
observer/blocker/storage modules.

Facebook support was prototyped and removed (Facebook actively fights blockers;
the home feed cannot be split cleanly into friends' vs. foreign content). The
experiment is preserved on the `archive/facebook-experiment` git branch.

## Completed

- **Firefox toggle bug (root cause).** `content/shared/storage.js` now uses the
  **promise** form of the storage API. Firefox's native `browser.*` is
  promise-based and silently ignored the old callbacks, which froze the settings
  cache on its defaults and made every toggle inert. Added the third setting
  `allowMessagedContent` to defaults; `onChanged` iterates `Object.keys(DEFAULTS)`
  so new keys are picked up automatically.
- **Instagram model change.** The master toggle now blocks ALL home-feed content
  — every post AND reel — not just reels. `feed.js` hides all `<article>`s on `/`
  (Stories survive because they are not `<article>`s); `explore.js` hides all
  cards. Only Stories, Messages, and (when its sub-toggle is on) messaged content
  survive.
- **"Entering Instagram doesn't block" bug.** The MutationObserver only catches
  FUTURE mutations, so already-rendered content slipped through. `instagram.js`
  now re-scans after load and on SPA navigation (timed rescans + `pushState`
  patch + `popstate`).
- **`allowMessagedContent` toggle.** New third popup toggle (`popup.html` /
  `popup.js`); `dms.js` leaves shared content visible when on, placeholders it
  ("Content blocked") when off. Messaging itself always works.
- **Instagram I-1 (suggested posts).** When `allowFollowing` is ON, `feed.js`
  still blocks interleaved "Suggested for you" / "Suggested posts" units (text /
  aria anchor `SUGGESTED_RE`), since suggestions are not from people you follow.
- **Instagram I-3 (profile grid).** `profile.js` blocks the profile post grid
  (anchored on `/p/` and `/reel/` links, walked up to the grid cell). The header
  — avatar, bio, follower counts, action buttons — is preserved. When
  `allowFollowing` is ON and the viewed profile is one you follow (header shows
  "Following"/"Requested"), the grid is shown.
- **TikTok overlay + audio.** `tiktok/feed.js`: the blocked overlay is offset so
  it never covers the left nav rail (Following/Friends/Messages/Profile stay
  clickable); `muteAll()` mutes, zero-volumes and pauses every `<video>` on each
  scan so audio no longer plays behind the block.
- **YouTube Shorts (Phase 2).** `content/youtube/youtube.js` (full rewrite of a
  broken ES-module stub) blocks Shorts shelves, the Shorts nav item and Shorts
  cards, redirects `/shorts/` to the homepage (never redirects `/`), and exposes
  subscribed-channel Shorts in `/feed/subscriptions` when `allowFollowing` is on.
  Loads the shared modules via both manifests.
- **Redirect rules.** `background/service-worker.js` (MV3 dynamic rules): IG
  100–101, TikTok 200–201, YouTube 300, all added/removed together under the
  master toggle. `background/background.firefox.js` (MV2 webNavigation) rewritten
  to the promise form, default-ON semantics, and **per-host scoped regexes** —
  each platform's pattern is scoped to its own host so one rule can never hijack
  another. Top-level frame only (`frameId === 0`).
- **Build hygiene.** `scripts/chrome-build.sh` and `scripts/firefox-build.sh`
  stage clean `dist/chrome` and `dist/firefox` directories. Chrome rejects any
  unpacked dir containing `_`-prefixed files (e.g. `__pycache__`); the build
  strips them and copies only runtime files, with the correct manifest as
  `manifest.json`. **Always load the `dist/` output, never the repo root.**

## Verification performed (this environment)

- `node --check` passes on every changed/added JS file (all 17 listed clean).
- `lib/timer.js` unit tests (`test/timer.test.js`) pass — 9/9.
- Both `dist/chrome` and `dist/firefox` rebuild cleanly; a `find` for
  `_`-prefixed / `.pyc` / `__pycache__` files in `dist/` returns nothing.
- Both manifests parse as JSON and declare the correct host permissions and
  content-script chains (Instagram, TikTok, YouTube), each loading the shared
  modules first.
- No `// AGENT STOP:` comments are present in the code.

## Still needs human / live-DOM verification

The logic is correct in shape, but selectors cannot be confirmed without a
logged-in session. Run the DevTools **selector probe** in `NEXT_STEPS.md` on
each site and update the relevant module if anchors have drifted:

- **YouTube** — Shorts shelf/nav/link anchors and the `/feed/subscriptions`
  carve-out.
- **Instagram** — the "Suggested for you" wording (I-1), the profile
  follow-state detection and grid-cell walk (I-3), and that Stories/DMs survive.
- **TikTok** — that the nav-rail offset matches the live rail width and that
  `muteAll()` reaches every player.

## Not implemented (one remaining unit)

- **Instagram I-2 — DM shared *photo* posts.** `dms.js` currently placeholders
  shared reels (video) only. Extending it to also placeholder shared *photo*
  posts without touching avatars, inline images or message bubbles is delicate
  and needs a live thread to anchor safely. Left as a documented task in
  `NEXT_STEPS.md`; both behaviours must stay gated on `allowMessagedContent`.

## Known limitation

- DM placeholder elements have their `innerHTML` replaced, so toggling the
  master switch OFF cannot restore their original content (per the design in
  CLAUDE.md). All other blocked elements are restored via `unblockAll()`.
