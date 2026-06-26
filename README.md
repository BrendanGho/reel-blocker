# Reel Blocker

A cross-browser extension that blocks short-form video content — **Instagram Reels/feed** and **YouTube Shorts** — to help break the addictive-scroll habit, while keeping the legitimate parts of these platforms fully working (messaging, stories, subscriptions, search, long-form video).

No accounts, no servers, no tracking. Everything runs locally and nothing leaves your device.

## What it blocks

| Platform | Blocked | Always left alone |
|---|---|---|
| **Instagram** | The entire home feed (every post *and* reel), Explore, the Reels nav icon, profile Reels tabs, and all `/reel/` · `/reels/` · `/audio/` · hashtag/location URLs (redirected home) | **Stories** and **DMs/Messages** — including any reel or post shared inside a conversation |
| **YouTube** | Shorts shelves, the Shorts nav item, Shorts cards in search/home/channel grids, and `/shorts/...` URLs (redirected to the homepage) | Long-form video, search, and the subscriptions feed |

When blocking is on, it's **all-or-nothing across both platforms** — there are no per-platform switches. That's intentional: selective blocking defeats the purpose.

## Toggles

The popup has exactly two switches:

- **Block scrollable content** — the master switch. On = short-form/feed content is blocked everywhere; off = nothing is blocked.
- **Allow content from people I follow** — a universal sub-toggle. When on:
  - **Instagram:** your home feed (posts *and* reels from people you follow) is shown again. Explore, search/discovery, and `/reel/` URLs stay blocked. Stories show regardless.
  - **YouTube:** no effect — all Shorts stay blocked. (Channel isn't reliably available per Short card, so a "subscribed-only" filter can't be done cleanly.)

A timer at the top of the popup tracks how long you've had blocking on. Turning blocking off pauses it; turning it back on resets it.

## Privacy

- No data ever leaves your device.
- The only stored state is your two toggle settings and the timer, via `chrome.storage`.
- Permissions are limited to `storage`, URL-redirect handling, and host access for `instagram.com` and `youtube.com`. Nothing else.

## Browser support

| Browser | Engine | Manifest |
|---|---|---|
| Chrome, Edge, Brave, Opera | Chromium | MV3 (`manifest.json`) |
| Firefox | Gecko | MV2 (`manifest.firefox.json`) |

Safari is out of scope. The extension is plain vanilla JS — no build step, no dependencies.

## Install (unpacked)

**Chromium (Chrome/Edge/Brave/Opera):**
1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select this repo's root folder

**Firefox:**
1. Go to `about:debugging` → **This Firefox**
2. **Load Temporary Add-on** → select `manifest.firefox.json`

Optional staged builds live in `scripts/chrome-build.sh` and `scripts/firefox-build.sh`.

## Project layout

```
manifest.json / manifest.firefox.json   Chromium MV3 / Firefox MV2
background/                              URL-redirect rules (service worker + Firefox page)
content/
  shared/                               MutationObserver engine, block logic, storage wrapper
  instagram/                            feed, nav, explore, profile, redirect, pre-paint mask
  youtube/                              Shorts shelves/nav/cards + /shorts/ redirect
popup/                                  Popup UI + timer
lib/                                    browser-namespace shim, pure timer math
test/                                   Unit tests for the timer
```

Both platforms are SPAs, so all DOM work goes through a `MutationObserver`; URL blocking uses both a background redirect layer and a content-script layer to cover client-side navigation.

## Notes

- TikTok and Facebook support were prototyped and removed — both fight blockers hard enough that they're better served by dedicated extensions. The experiments are preserved on the `archive/tiktok-experiment` and `archive/facebook-experiment` branches.
- Platform selectors drift over time. They anchor on stable signals (`aria-label`, `role`, `href` patterns, `<video>` presence, URL paths) rather than obfuscated class names, but may still need occasional updates after a platform UI change.
