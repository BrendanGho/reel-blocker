# Agent Summary

Status of the reel-blocker extension. The codebase blocks short-form/feed content
across Instagram and YouTube under a single master toggle, with one universal
sub-toggle ("Allow from following"). Everything is vanilla JS using the
`window.RB.*` namespace and the shared observer/blocker/storage modules.

DMs are never touched — content shared inside a conversation is always left
visible (messaging is sacred), so there is no DM placeholder/replace path.

TikTok support was prototyped and removed (most TikTok use is in the native app,
not the browser, and its obfuscated anti-bot DOM made browser blocking a
maintenance treadmill). The experiment is preserved on the
`archive/tiktok-experiment` git branch.

Facebook support was prototyped and removed (Facebook actively fights blockers;
the home feed cannot be split cleanly into friends' vs. foreign content). The
experiment is preserved on the `archive/facebook-experiment` git branch.

## Completed

- **Firefox toggle bug (root cause).** `content/shared/storage.js` now uses the
  **promise** form of the storage API. Firefox's native `browser.*` is
  promise-based and silently ignored the old callbacks, which froze the settings
  cache on its defaults and made every toggle inert. `onChanged` iterates
  `Object.keys(DEFAULTS)` so settings keys are picked up automatically.
- **Instagram model change.** The master toggle now blocks ALL home-feed content
  — every post AND reel — not just reels. `feed.js` hides all `<article>`s on `/`
  (Stories survive because they are not `<article>`s); `explore.js` hides all
  cards. Only Stories and Messages/DMs survive (DMs are never touched, so any
  reel/post shared in a conversation stays visible).
- **"Entering Instagram doesn't block" bug.** The MutationObserver only catches
  FUTURE mutations, so already-rendered content slipped through. `instagram.js`
  now re-scans after load and on SPA navigation (timed rescans + `pushState`
  patch + `popstate`).
- **Instagram I-1 (suggested posts).** When `allowFollowing` is ON, `feed.js`
  still blocks interleaved "Suggested for you" / "Suggested posts" units (text /
  aria anchor `SUGGESTED_RE`), since suggestions are not from people you follow.
- **Instagram I-3 (profile grid).** `profile.js` blocks the profile post grid
  (anchored on `/p/` and `/reel/` links, walked up to the grid cell). The header
  — avatar, bio, follower counts, action buttons — is preserved. When
  `allowFollowing` is ON and the viewed profile is one you follow (header shows
  "Following"/"Requested"), the grid is shown.
- **YouTube Shorts (Phase 2).** `content/youtube/youtube.js` (full rewrite of a
  broken ES-module stub) blocks Shorts shelves, the Shorts nav item and Shorts
  cards, and redirects `/shorts/` to the homepage (never redirects `/`). The
  `allowFollowing` sub-toggle has no effect on YouTube — all Shorts stay blocked.
  Loads the shared modules via both manifests.
- **Redirect rules.** `background/service-worker.js` (MV3 dynamic rules): IG
  100–101, YouTube 300, all added/removed together under the
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
  content-script chains (Instagram, YouTube), each loading the shared
  modules first.
- No `// AGENT STOP:` comments are present in the code.

## Still needs human / live-DOM verification

The logic is correct in shape, but selectors cannot be confirmed without a
logged-in session. Run the DevTools **selector probe** in `NEXT_STEPS.md` on
each site and update the relevant module if anchors have drifted:

- **YouTube** — Shorts shelf/nav/link anchors.
- **Instagram** — the "Suggested for you" wording (I-1), the profile
  follow-state detection and grid-cell walk (I-3), and that Stories/DMs survive.
