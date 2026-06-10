# Reel Blocker — Agent Instructions

## Project Purpose
A cross-browser extension that blocks short-form video content (Instagram Reels, TikTok, YouTube Shorts) to help users break addictive scroll habits while preserving legitimate use of these platforms (messaging, subscriptions, long-form content).

This is a real, personal-use tool. Correctness and robustness matter more than speed of delivery. When in doubt, do less and do it right.

---

## Guiding Principles

- **Never break core platform functionality.** Instagram DMs, Stories, photo posts, and profile browsing must always work. TikTok DMs and Following feed (when sub-toggle allows) must work. YouTube subscriptions, search, and long-form video must always work.
- **Hide the entire card, not just part of it.** When blocking a reel, Short, or TikTok, hide the whole container — video, caption, like count, comment count, share button, audio tag, hashtag row, everything. Never target only the video element and leave the surrounding card visible.
- **All three platforms are SPAs.** All DOM manipulation must use MutationObserver. Never assume the DOM is static.
- **Selectors will break.** Prefer stable selectors: `aria-label`, `role`, `href` patterns, `<video>` tag presence, URL path patterns, `data-*` attributes. Never rely solely on obfuscated class names.
- **One codebase, two manifests.** Logic lives in shared JS. `manifest.json` targets Chromium MV3. `manifest.firefox.json` targets Firefox MV2. Differences isolated to manifests only.
- **No external dependencies.** Vanilla JS only. No npm, no bundler, no frameworks. Must work as a plain unpacked directory.
- **Privacy:** No data leaves the device. Everything is stored locally via `chrome.storage`.
- **Safari:** Explicitly out of scope.

---

## Toggle Structure

This is the exact model. Implement it precisely.

```
[Block short-form content]            [on/off]   — master switch
[Allow content from people I follow]  [on/off]   — universal sub-toggle
[Allow messaged content]              [on/off]   — universal sub-toggle
```

### Rules:
- There is exactly ONE master toggle, and it is all-or-nothing: either short-form/feed content is blocked across all supported platforms, or none is. Users **cannot** block a subset of platforms — selective blocking defeats the purpose of the extension and is intentionally not offered.
- When the master toggle is ON, blocking is active on all supported platforms simultaneously. On **Instagram this means ALL feed content — every post AND reel — is blocked, not just reels.** The only Instagram content that survives the master toggle is: **Stories** (always shown), **Messages/DMs** (always functional), and **messaged content** (only when the "Allow messaged content" sub-toggle is on). TikTok blocks the video feed; Phase 2 adds YouTube Shorts under the **same** master switch — there is no separate YouTube control, ever.
- The "Allow from following" sub-toggle is **universal** — it applies to all platforms simultaneously.
- When "Allow from following" is ON:
  - **Instagram**: the home feed (content from people you follow — posts AND reels) is shown. Explore, search/discovery, and /reel/ URLs remain blocked. (Stories are shown regardless.)
  - **TikTok**: the `/following` feed is accessible (For You, Explore, /video/ URLs remain blocked)
  - **YouTube**: Shorts from subscribed channels in the Subscriptions feed are shown (Shorts shelf, Shorts tab, /shorts/ URLs remain blocked)
- The "Allow messaged content" sub-toggle is **universal**. When ON, content shared inside a conversation (e.g. a reel/post sent to you in Instagram DMs) is left visible instead of being replaced with a placeholder, so you can discuss it. When OFF (default), shared content is replaced with a "Content blocked" placeholder. Messaging itself always works regardless.
- The sub-toggles are only meaningful when the master toggle is on.
- Each sub-toggle state persists independently of the master toggle.
- No per-platform toggles and no per-platform sub-toggles. One master toggle, two universal sub-toggles.

---

## Phase Scope

### Phase 1 — Instagram Reels + TikTok (implement now)
### Phase 2 — YouTube Shorts (scaffold only — empty stub file, no logic)

Design shared abstractions (observer, blocker, storage) to be platform-agnostic. Each platform gets its own content script. Core logic is shared.

---

## Browser Support

| Browser | Engine | Manifest |
|---|---|---|
| Chrome | Chromium | MV3 |
| Microsoft Edge | Chromium | MV3 (same package) |
| Brave, Opera | Chromium | MV3 (same package) |
| Firefox | Gecko | MV2 (separate manifest, same JS) |

Use `browser` namespace with a polyfill shim. Chromium uses `chrome` namespace; the shim normalises this so all code uses `browser.*`.

---

## Manifest Permissions

### manifest.json (Chromium MV3)
```json
{
  "manifest_version": 3,
  "permissions": ["storage", "declarativeNetRequest", "webNavigation"],
  "host_permissions": [
    "*://*.instagram.com/*",
    "*://*.tiktok.com/*",
    "*://*.youtube.com/*"
  ]
}
```

### manifest.firefox.json (Firefox MV2)
```json
{
  "manifest_version": 2,
  "permissions": [
    "storage",
    "webNavigation",
    "*://*.instagram.com/*",
    "*://*.tiktok.com/*",
    "*://*.youtube.com/*"
  ]
}
```

Do not request any permissions not listed above. If a feature requires an unlisted permission, stop and flag it.

All content scripts use `"run_at": "document_idle"`. Feed content on Instagram and TikTok is loaded asynchronously regardless of injection timing, so earlier injection doesn't prevent a content flash. The MutationObserver handles everything added after load.

---

## Repository File Structure

```
reel-blocker/
├── CLAUDE.md
├── manifest.json                    ← Chromium MV3
├── manifest.firefox.json            ← Firefox MV2
├── background/
│   ├── service-worker.js            ← URL redirect rules (MV3)
│   └── background.firefox.js       ← Firefox background page (MV2)
├── content/
│   ├── shared/
│   │   ├── observer.js             ← MutationObserver engine, platform-agnostic
│   │   ├── blocker.js              ← Core block/replace logic
│   │   └── storage.js             ← Wrapper around browser.storage
│   ├── instagram/
│   │   ├── instagram.js            ← Entry point, initialises all Instagram modules
│   │   ├── feed.js                 ← Blocks reels in home feed, redirects For You → Following
│   │   ├── nav.js                  ← Removes Reels icon from nav bar
│   │   ├── explore.js              ← Blocks reels on Explore page
│   │   ├── profile.js              ← Hides Reels tab on profile pages
│   │   ├── dms.js                  ← Replaces reel preview cards in DMs with placeholder
│   │   └── redirect.js             ← Handles /reels/ and /reel/XXXX/ URLs
│   ├── tiktok/
│   │   ├── tiktok.js               ← Entry point, initialises all TikTok modules
│   │   ├── feed.js                 ← Blocks For You and Explore feeds
│   │   ├── following.js            ← Handles Following feed based on sub-toggle
│   │   ├── nav.js                  ← Hides For You / Explore nav items
│   │   ├── dms.js                  ← Replaces TikTok video previews in DMs
│   │   └── redirect.js             ← Handles /video/ URLs and root / redirect
│   ├── youtube/
│   │   └── youtube.js              ← Blocks Shorts shelves/nav/cards + /shorts/ redirect
│   └── facebook/
│       ├── facebook.js             ← Entry point, initialises all Facebook modules
│       ├── feed.js                 ← Hides Reels units in feed (Reels-only scope)
│       ├── nav.js                  ← Removes Reels shortcut from left nav
│       └── redirect.js             ← Handles /reel/ and /reels/ URLs
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── assets/
│   └── icons/                      ← 16, 32, 48, 128px PNG icons (generate simple placeholder icons)
├── scripts/
│   ├── chrome-build.sh             ← Stage clean dist/chrome (no "_"-prefixed files)
│   └── firefox-build.sh            ← Stage dist/firefox with MV2 manifest as manifest.json
├── test/
│   └── timer.test.js               ← Unit tests for lib/timer.js
└── lib/
    ├── browser-polyfill.js         ← chrome/browser namespace shim
    └── timer.js                    ← Pure timer math (install/toggle/elapsed/format)
```

Note: YouTube is now implemented (Phase 2 complete) and Facebook Reels blocking
has been added. Both run under the single master toggle alongside Instagram and
TikTok — there are still no per-platform controls.

---

## Feature Specification

### Instagram — Surfaces

| Surface | Behaviour |
|---|---|
| Home feed — ALL items (posts AND reels) | Block the entire card for every feed item, unless "Allow from following" sub-toggle is on. Each feed item is an `<article>`; hide all of them. |
| Stories tray / Stories viewer | Always shown — never blocked. (Stories are not `<article>` elements, so hiding articles leaves them intact.) |
| Reels icon in nav bar | Remove element entirely |
| `/reels/` URL | Redirect to `instagram.com/?variant=following` |
| `/reel/XXXXXX/` URL | Redirect to `instagram.com/?variant=following` |
| External link to any reel | Same redirect |
| Explore page | Block ALL cards (photos AND reels) — discovery is never "from people you follow", so blocked regardless of the sub-toggle |
| Profile page — Reels tab | Remove tab; if URL path ends in `/reels/`, redirect to profile root. |
| Profile page — post grid | Block the grid (anchored on `/p/` and `/reel/` links). Header — avatar, bio, follower counts, action buttons — is always preserved. When "Allow from following" is ON **and** the viewed profile is one you follow (header shows "Following"/"Requested"), the grid is shown. (Follow-detection is a text anchor; see NEXT_STEPS.md Unit I-3 for the selector caveat.) |
| Home feed — "Suggested for you" posts | Blocked even when "Allow from following" is ON, since suggestions are not from people you follow. Anchored on the "Suggested for you"/"Suggested posts" label. |
| DMs — shared reel/post preview | Replace with placeholder ("Content blocked") UNLESS "Allow messaged content" is on, in which case leave it visible. Never fully remove; messaging always works. |
| Audio pages (`/audio/...`) | Redirect to home |
| Hashtag/location pages | Block all entries |
| Messages / DMs (`/direct/...`) | Always functional — never blocked |

### "Allow from following" detection — Instagram
- Following tab URL: `window.location.href` contains `?variant=following` OR the active tab element has `aria-label` containing "Following"
- When sub-toggle is ON and user is on the Following tab: skip blocking for reel cards in that feed
- All other surfaces block regardless of sub-toggle state

### TikTok — Surfaces

TikTok's entire UI is short-form video. Strategy is more aggressive.

| Surface | Behaviour |
|---|---|
| For You feed (`tiktok.com/` or `/foryou`) | Replace feed container with blocked screen (see design below) |
| Following feed (`tiktok.com/following`) | Show normally if "Allow from following" sub-toggle is on; otherwise show blocked screen |
| Explore / Trending | Replace with blocked screen |
| LIVE tab | Block / hide |
| Profile video grid | Hide all video thumbnails; keep profile header, bio, follower count visible |
| DMs with video previews | Replace with "TikTok video blocked" placeholder |
| `/video/XXXXXX` URL | Redirect to `/following` if sub-toggle on, else show blocked screen |
| Search results | Block video entries |

#### TikTok Blocked Screen Design
An overlay covering the feed area. Simple and clean:
- Dark background (`#0a0a0a`)
- Centred text: "Short-form content blocked" in white, medium size
- Smaller subtext below: "Focus Guard is active"
- No buttons, no navigation prompts
- **The overlay must NOT cover the left nav rail.** It is offset so its left edge
  sits at the nav rail's right edge (measured at runtime, fallback 240px). The
  sidebar — Following, Friends, Messages, Profile — must stay clickable so the
  user can always reach their inbox.
- **Audio must be muted while blocked.** TikTok keeps playing the video's audio
  behind any visual cover, so every `<video>` is muted, volume-zeroed and paused
  on each scan (`window.RB.tk.muteAll()`).

### YouTube Shorts (Phase 2 — implemented)

Runs under the same master toggle; there is no YouTube-specific control. The
universal "Allow from following" sub-toggle has **NO effect on YouTube** (same as
Facebook). When the master toggle is on, ALL Shorts are blocked, full stop.

A "show only Shorts from subscribed channels under allowFollowing" mode was
prototyped and **removed**: YouTube's homepage/shelf Short cards do not expose
the channel in the DOM, so subscription status can't be determined per-card
reliably — the filter would just hide everything. Not worth the complexity.

| Surface | Behaviour (master toggle ON) |
|---|---|
| Shorts shelf on homepage/feed | Hide the whole shelf (`ytd-rich-shelf-renderer[is-shorts]`, `ytd-reel-shelf-renderer`) |
| Shorts entry in the left/guide nav | Hide the nav item |
| `/shorts/XXXX` URL | Redirect to `https://www.youtube.com/` (background rule + SPA `yt-navigate-finish` hook). Never redirect `/`. |
| Shorts cards in search / channel / home grids | Hide each card (walk `a[href^="/shorts/"]` up to its renderer container) |
| Long-form video, search, subscriptions (non-Shorts) | Never touched |

Anchor on tag names plus the `/shorts/` href — never on obfuscated classes.

### Facebook (implemented)

Facebook blocks the **scrollable feeds** — the addictive infinite scroll — not
the whole site. The mechanism is to hide every `[role="feed"]` container (the
stable ARIA anchor Facebook puts on the scrollable feed list: home News Feed,
Groups feed, Watch feed) plus Reels. Hiding just that element removes the scroll
surface while leaving everything else usable: the top bar/search, the left nav,
the right rail (contacts/chat), the status composer, and destination pages like
Marketplace, Groups landing, Events, profiles and Messenger. This is preferred
over a full-screen overlay (no fragile nav-width measurement, never covers chat,
never swallows clicks).

Because the News Feed is an algorithmic mix (friends, followed Pages, Groups,
Marketplace, ads) with no clean "people you follow" feed, the "Allow from
following" sub-toggle has **NO effect on Facebook**. Messaging lives on a
separate host (`messenger.com`) and is out of scope.

| Surface | Behaviour |
|---|---|
| Scrollable feed (`[role="feed"]`: home, Groups, Watch) | Hide the whole feed container |
| Reels unit / tray | Hide the `role="article"` unit containing a `/reel/` link; hide `a[href*="/reels/tray"]` |
| Reels shortcut in left nav | Remove the nav item |
| `/reel/<id>` and `/reels/...` URLs | Redirect to `https://www.facebook.com/` (background rule + SPA hook) |
| Top bar, left nav, right rail, composer | Never touched — stay fully usable |
| Marketplace, Groups landing, Events, profiles | Never touched |
| Messenger (`messenger.com`) | Out of scope — not injected |

SELECTORS: Facebook class names are fully obfuscated. Anchor only on stable
signals — `role="feed"`, a `/reel/` href, an `aria-label` containing "Reel".
Never add class-name selectors.

---

## Popup UI

### Layout

```
┌──────────────────────────────┐
│  Reel Blocker                │
│                              │
│  Blocked for                 │
│  ┌──────────────────────┐    │
│  │ 12 days  4 hrs  7 min│    │
│  └──────────────────────┘    │
│                              │
│  ────────────────────────    │
│                              │
│  Block short-form   [ ● ]    │
│  content                     │
│                              │
│  ────────────────────────    │
│                              │
│  Allow from people           │
│  I follow           [ ○ ]    │
│                              │
└──────────────────────────────┘
```

### Popup Rules
- Dark background (`#111`), white text, minimal
- Timer is the visual hero — large, prominent, top of popup
- ONE master toggle: "Block short-form content" — controls all platforms at once
- No per-platform toggles. Selective blocking is intentionally not offered. (YouTube is covered by this same switch once Phase 2 ships; it needs no UI of its own.)
- Universal "Allow from following" sub-toggle at the bottom, separated by a divider
- Both toggle states persist via `browser.storage.sync`
- Popup width: 280px fixed

### Timer
- Displayed as: `X days  Y hrs  Z min`
- Counts elapsed time since the master toggle was last turned on
- Tracks `blockingStartTime` — set when blocking is turned on (blocking ships OFF on install, so the timer starts only once the user enables it)
- Turning the master toggle OFF pauses the timer and freezes the last elapsed value (`pausedElapsed`)
- Turning it back ON resets the timer to zero and starts counting again
- Calculate elapsed time once when the popup opens — no polling needed, popup lifecycle is too short for intervals to matter
- Persists across browser sessions via `browser.storage.local`
- Use the pure functions in `lib/timer.js` — do not reinvent this logic

---

## Storage Schema

```javascript
// browser.storage.sync — syncs across user's browsers
{
  blockingEnabled: false,         // master switch — all feed/short-form content on/off (ships OFF; user opts in)
  allowFollowing: false,          // universal sub-toggle — show content from people you follow
}

// browser.storage.local — device-specific, not synced
{
  blockingStartTime: 1748000000000, // Date.now() when the master toggle was turned on
  // Not set on install (blockingEnabled ships OFF); set the first time blocking is turned on.
  // Reset to now whenever blocking is turned on after being off.
  pausedElapsed: 0,                 // ms elapsed, frozen when blocking is turned off
}
```

---

## DOM Manipulation

### Blocking an Element
```javascript
function blockElement(el) {
  if (el.dataset.rbBlocked) return; // skip already-processed
  el.dataset.rbBlocked = 'true';
  el.style.display = 'none';
}
```

Use `display: none` not `remove()` — platforms re-render removed elements and the observer would have to re-catch them. `display: none` is idempotent.

For DM placeholders, instead of hiding, replace innerHTML:
```javascript
function placeholderElement(el, text) {
  if (el.dataset.rbBlocked) return;
  el.dataset.rbBlocked = 'true';
  el.innerHTML = '';
  el.style.cssText = 'padding:12px;background:#1a1a1a;color:#888;border-radius:8px;font-size:13px;';
  el.textContent = text;
}
```

### MutationObserver
```javascript
let debounceTimer;
const observer = new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(scanAndBlock, 50);
});
observer.observe(document.body, { childList: true, subtree: true });
scanAndBlock(); // run once on load
```

### URL Redirects — Two Layers
1. **Background** (`declarativeNetRequest` rules in MV3 / `webNavigation` listener in MV2) for network-level interception
2. **Content script** (`redirect.js` per platform) checking `window.location.pathname` on load and on navigation events for SPA routing

Both layers are required. SPA client-side routing frequently bypasses background-level rules alone.

#### SPA Navigation Interception

`popstate` alone is insufficient — Instagram and TikTok route primarily via `history.pushState`, which fires no event. Each `redirect.js` must monkey-patch pushState:

```javascript
function checkAndRedirect() {
  // platform-specific redirect logic here
}

const _pushState = history.pushState.bind(history);
history.pushState = function(...args) {
  _pushState(...args);
  checkAndRedirect();
};
window.addEventListener('popstate', checkAndRedirect);
checkAndRedirect(); // initial load
```

#### Dynamic Rule Management (MV3 only)

Do NOT use static rules in the manifest's `declarative_net_request.rule_resources`. Use `chrome.declarativeNetRequest.updateDynamicRules` exclusively so rules can be added and removed when toggles change.

Assign stable ID ranges per platform (e.g. Instagram: 100–109, TikTok: 200–209). The service worker must listen to `browser.storage.onChanged` for `blockingEnabled` and, under the single master toggle, add ALL redirect rules (Instagram + TikTok together) when it turns on and remove them all when it turns off. There is no per-platform rule management — the master toggle governs every platform's rules at once. When blocking is turned off, all redirect rules must be removed immediately.

### Selector Health Check

After each `scanAndBlock()` pass on a surface where matches are expected, if zero elements were processed, log:
```javascript
console.warn('[reel-blocker] No elements matched on', window.location.pathname, '— selector may be stale');
```
Do not surface this to the user. It exists only to make debugging faster after platform updates.

### Unhiding on Toggle Off

When the master toggle turns off, every content script must restore previously hidden elements:
```javascript
function unblockAll() {
  document.querySelectorAll('[data-rb-blocked]').forEach(el => {
    el.removeAttribute('data-rb-blocked');
    el.style.display = '';
  });
}
```
Exception: DM placeholder elements cannot have their original content restored (it was replaced with `innerHTML = ''`). Leave placeholders in place when toggling off and note this limitation in `AGENT_SUMMARY.md`.

### Known Selector Starting Points
These are best-known selectors as of mid-2025. They may have drifted — verify against live DOM if they don't work and update accordingly. Never use these as the only detection method; combine with video tag presence and URL patterns.

**Instagram:**
- Nav Reels link: `a[href="/reels/"]`
- Nav item aria: `nav a[aria-label*="Reels" i]`
- Following tab: URL contains `?variant=following`, or `div[role="tablist"] a[aria-selected="true"]` containing "Following"
- Feed reel card: `article:has(video)` — exclude if ancestor has `[aria-label*="Stories" i]`
- Profile reels tab: `a[href$="/reels/"]` on a profile page

**TikTok:**
- Feed video items: `div[data-e2e*="video-feed-item"]` or any element containing `<video>` in the feed container
- Following feed: URL is `tiktok.com/following`
- For You: URL is `tiktok.com/` or `tiktok.com/foryou`
- Video URL: pathname starts with `/video/`

**YouTube (phase 2 reference only):**
- Shorts shelf: `ytd-rich-shelf-renderer[is-shorts]`
- Shorts tab in nav: look for `a[title="Shorts"]` or `tp-yt-paper-tab:has([title="Shorts"])`
- Shorts URL: pathname starts with `/shorts/`

---

## Error Handling

- Wrap all `browser.storage` calls in try/catch. On failure, fall back to defaults (`blockingEnabled` on, sub-toggle off). Never throw.
- Wrap `scanAndBlock()` in try/catch per platform. Log the exception with `console.error` and continue — a broken selector must not crash the entire content script.
- Use `console.warn` for expected degraded conditions (e.g. no elements matched).
- Use `console.error` only for genuine exceptions.

---

## What Must Never Break

- Instagram DMs / Messages — fully functional at all times (the whole point is that messaging still works)
- Instagram Stories — not blocked, not interfered with
- Instagram navigation rail — must stay usable (so the user can always reach Messages); never cover it with a blocking overlay
- TikTok DMs / inbox — fully functional
- TikTok Following feed — functional when "Allow from following" is on
- YouTube long-form video — untouched
- YouTube subscriptions feed — untouched

**If any change risks breaking these, stop and leave a clearly marked `// AGENT STOP:` comment in the relevant file explaining the issue. Do not proceed.**

---

## Implementation Order

Follow this sequence exactly. Commit after each step. Do not skip or combine steps.

1. File structure — create all directories and empty files per the structure above
2. `lib/browser-polyfill.js` — namespace shim
3. `content/shared/storage.js` — storage wrapper with defaults
4. `content/shared/blocker.js` — blockElement and placeholderElement functions
5. `content/shared/observer.js` — debounced MutationObserver factory
6. Popup — `popup.html`, `popup.css`, `popup.js` with the master toggle + "Allow from following" sub-toggle, timer display, storage wiring
7. `manifest.json` and `manifest.firefox.json` — with correct permissions and content script declarations
8. `background/service-worker.js` — declarativeNetRequest URL redirect rules for Instagram and TikTok
9. `background/background.firefox.js` — webNavigation-based redirect for Firefox
10. `content/instagram/nav.js` — remove Reels nav icon
11. `content/instagram/redirect.js` — /reels/ and /reel/XXXX/ interception + SPA navigation listener
12. `content/instagram/feed.js` — auto-redirect For You → Following; block reels in Following when sub-toggle off
13. `content/instagram/explore.js` — block reel cards, keep photo posts
14. `content/instagram/profile.js` — hide Reels tab, redirect /username/reels/ to profile root
15. `content/instagram/dms.js` — reel preview card placeholder
16. `content/instagram/instagram.js` — entry point, initialises all Instagram modules
17. `content/tiktok/redirect.js` — /video/ URL interception, root / redirect logic
18. `content/tiktok/feed.js` — For You and Explore blocked screen overlay
19. `content/tiktok/following.js` — Following feed conditional on sub-toggle
20. `content/tiktok/nav.js` — hide For You / Explore nav items
21. `content/tiktok/dms.js` — video preview placeholder
22. `content/tiktok/tiktok.js` — entry point, initialises all TikTok modules
23. `content/youtube/youtube.js` — phase 2 stub comment only
24. Wire all content scripts to read from storage and respect toggle state on load and on storage change
25. Timer — implement countdown logic in popup.js, connect to storage
26. End-to-end review — verify "must never break" list, check all surfaces listed in the spec are covered

---

## When All Steps Are Complete

Stop. Do not invent new features or refactor working code. Write a file called `AGENT_SUMMARY.md` in the repo root containing:

- Which steps were completed successfully
- Which steps (if any) were skipped or partially implemented, and why
- Any `// AGENT STOP:` comments that were left in the code, reproduced here with file and line context
- Anything that needs manual testing or human verification before the extension is used
- Any selector that could not be verified against a live DOM and may need updating

Then stop.

---

## Commit Discipline

- One step = one commit
- Format: `feat(instagram): remove reels nav icon` / `fix(tiktok): observer missing lazy-loaded feed items`
- Do not mix platform changes in one commit
- Commit only working, complete units — not partial implementations

---

## Development & Testing Notes

- Load unpacked: `chrome://extensions` → Developer mode → Load unpacked → select repo root
- Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → select `manifest.firefox.json`
- Test SPA navigation — navigate between pages within the app, not just hard-loading URLs
- Test DM surface explicitly — send a reel/TikTok from another account, verify placeholder appears
- Test "Allow from following" toggle on and off for each platform
- When a selector stops working after a platform update: inspect live DOM, find new stable anchor, update only the relevant module
