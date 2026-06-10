# Reel Blocker — Handoff Spec for the Local Agent Harness

This file is written for the local (qwen3-14B) orchestrator. **Most of the
feature work is now implemented in code.** What remains is almost entirely the
one thing no model can do reliably: verifying the live, logged-in DOM selectors
with the **selector probe** below, plus one small carve-out (I-2).

Work the units in order. One unit = one commit. Do not refactor working code.

---

## Already fixed (do NOT redo)

- `content/shared/storage.js` — now uses the **promise** form of the storage
  API. Firefox's native `browser.*` is promise-based and ignored the old
  callbacks, which froze every toggle on its default. Keep it promise-based.
- `content/tiktok/feed.js` — the blocked overlay now leaves the left nav rail
  clickable (`setOverlay` offsets `left` to the rail's right edge) and
  `muteAll()` pauses + mutes all `<video>`s while blocked.
- `scripts/chrome-build.sh` — stages a clean `dist/chrome`. **Always load
  `dist/chrome` in Chrome/Edge/Brave, never the repo root** (the root has
  `__pycache__`, `.venv`, `orchestrator.py`, which Chrome rejects).
- **Instagram model changed** (see CLAUDE.md): the master toggle now blocks ALL
  feed content — every post AND reel — not just reels. Only Stories, Messages,
  and (when its sub-toggle is on) messaged content survive. `content/instagram/
  feed.js` hides all `<article>`s on `/`; `explore.js` hides all cards;
  `instagram.js` re-scans after load + on SPA nav (fixes "doesn't block on
  entry"); `dms.js` is gated on the new `allowMessagedContent` setting; the
  popup has a third "Allow messaged content" toggle.
- **YouTube Shorts implemented** (was UNIT A) — `content/youtube/youtube.js`
  blocks Shorts shelves/nav/cards and redirects `/shorts/`. `allowFollowing` has
  NO effect on YouTube (the subscribed-only filter was removed — see Unit A).
  Redirect rules added in both backgrounds (`YT_RANGE = [300]`).
- **Facebook Reels implemented** (was UNIT B) — `content/facebook/{facebook,
  feed,nav,redirect}.js`, manifests wired, redirect rules added
  (`FB_RANGE = [400,401]`). Reels-only scope; `allowFollowing` has no Facebook
  effect; Messenger (messenger.com) is out of scope.
- **Instagram I-1 (suggested posts) and I-3 (profile grid) implemented** —
  `feed.js` still blocks "Suggested for you" units when `allowFollowing` is on;
  `profile.js` blocks the post grid (header preserved) unless `allowFollowing`
  is on and you follow the profile.
- **Firefox background redirect fixed** — `background.firefox.js` now scopes the
  Instagram regex to `instagram.com` (it previously hijacked `facebook.com/reel/`),
  uses the promise form of storage, and adds the YouTube + Facebook patterns.

All of the above still needs **live-DOM selector verification** — the code is
correct in shape but the class/aria anchors must be confirmed with the probe.

---

## The selector probe (run this FIRST for any platform work)

Selectors drift. Before writing or fixing any blocking module, open the target
site **logged in**, open DevTools console, and run this. It reports which
candidate selectors actually match right now. Feed the winning selectors into
the module — never hardcode guessed class names.

```js
// Reel Blocker selector probe — paste into DevTools console on the live site.
(function (candidates) {
  console.log('%c[probe] ' + location.href, 'font-weight:bold');
  for (const sel of candidates) {
    let n = 0;
    try { n = document.querySelectorAll(sel).length; } catch (e) { n = -1; }
    const tag = n > 0 ? '%c✓' : (n === 0 ? '%c·' : '%c✗(bad selector)');
    const col = n > 0 ? 'color:#2ecc71' : (n === 0 ? 'color:#888' : 'color:#e74c3c');
    console.log(tag + ' %c' + n + '\t' + sel, col, 'color:#fff', 'color:#9cf');
  }
  // Also dump the wrapper of the first <video> so you can spot a stable anchor.
  const v = document.querySelector('video');
  if (v) {
    let p = v, chain = [];
    for (let i = 0; i < 6 && p; i++, p = p.parentElement) {
      chain.push(p.tagName.toLowerCase() +
        (p.getAttribute('role') ? '[role=' + p.getAttribute('role') + ']' : '') +
        (p.getAttribute('aria-label') ? '[aria-label]' : ''));
    }
    console.log('[probe] first <video> ancestry:', chain.join(' < '));
  }
})([
  // --- edit this list per platform before running ---
  'a[href^="/shorts/"]',
  'ytd-rich-shelf-renderer[is-shorts]',
  'ytd-reel-shelf-renderer',
  'a[title="Shorts"]',
  'article:has(video)',
  '[data-e2e*="video-feed-item"]',
]);
```

Record the matching selectors in the relevant module as a comment dated with
the day you verified them.

---

## UNIT A — YouTube Shorts (IMPLEMENTED — verify selectors only)

Done in code: ALL Shorts are blocked whenever the master toggle is on.
`allowFollowing` has **no effect on YouTube** — the subscribed-only filter that
once lived here was **removed** because YouTube's homepage/shelf Short cards do
not expose the channel in the DOM, so "subscribed-only" can't be done reliably.
Run the probe on youtube.com logged in and confirm these anchors in
`content/youtube/youtube.js` still match; update the module if they drifted:
- Shorts shelves: `ytd-rich-shelf-renderer[is-shorts]`, `ytd-reel-shelf-renderer`
- Shorts nav item: `a[title="Shorts"]` (and the guide/pivot variants)
- Shorts links/cards: `a[href^="/shorts/"]` (walked up to its renderer container)
- Standalone reel items: `ytd-reel-item-renderer`

Also confirm the `/shorts/` redirect still fires (background rule +
`yt-navigate-finish` hook) and the homepage `/` is NEVER redirected.

---

## UNIT B — Facebook Reels (IMPLEMENTED — verify selectors only)

Done in code (`content/facebook/{facebook,feed,nav,redirect}.js`, manifests,
`FB_RANGE = [400,401]` rules). Reels-only scope; `allowFollowing` has no effect
on Facebook; Messenger is out of scope. Run the probe on facebook.com logged in
and confirm:
- Reel feed unit: `[role="article"]:has(a[href*="/reel/"])` still selects the
  whole card (not just the video).
- Reels tray entry: `a[href*="/reels/tray"]`.
- Reels nav shortcut: `a[href^="/reel"][aria-label*="Reel" i]`.
- **Must never break** (re-test manually): Messenger/DMs, normal photo/text
  posts, Groups, Marketplace, profile pages, long-form Watch videos. If a change
  risks any of these, leave a `// AGENT STOP:` comment and stop.

---

## UNIT I — Instagram: one carve-out left (I-2)

I-1 (suggested posts) and I-3 (profile grid) are implemented; just verify their
text/aria anchors against the live DOM (`feed.js` `SUGGESTED_RE` /
`isSuggested`, and `profile.js` `isFollowedProfile` / grid walk). The one piece
NOT yet done:

- **I-2 — DM shared *photo* posts.** `dms.js` currently placeholders shared
  reels (video-based) only. Extend it to also placeholder shared *photo* posts
  in DMs WITHOUT touching avatars, inline images, or message bubbles (those must
  keep working). This is delicate — anchor on the share-card container, verify
  on a real thread, and leave an `// AGENT STOP:` if you can't isolate it
  cleanly. Both behaviours must stay gated on `allowMessagedContent`.

Verified Instagram anchors (re-check, may drift): feed item = `article`;
Stories tray is NOT an `article`; DM route = pathname starts `/direct`; reel
URL = `/reel/<id>`; profile post link = `a[href*="/p/"]`; "Suggested for you"
label sits in the article header.

---

## Reminders

- `allowFollowing` and `allowMessagedContent` are both **universal** — each one
  sub-toggle governs every platform simultaneously. No per-platform toggles.
- Instagram master toggle blocks ALL feed content (posts + reels), keeping only
  Stories, Messages, and (sub-toggle) messaged content. Don't regress this back
  to reels-only.
- Wrap every `scanAndBlock` in try/catch; `console.warn` when zero elements
  matched (stale-selector signal).
- After any change, re-run `./scripts/chrome-build.sh` and
  `./scripts/firefox-build.sh` and load the `dist/` output, not the repo root.
- Update `AGENT_SUMMARY.md` with anything left unverified against live DOM.
