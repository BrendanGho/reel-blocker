# Reel Blocker — Handoff Spec for the Local Agent Harness

This file is written for the local (qwen3-14B) orchestrator. **Most of the
feature work is now implemented in code.** What remains is almost entirely the
one thing no model can do reliably: verifying the live, logged-in DOM selectors
with the **selector probe** below.

Work the units in order. One unit = one commit. Do not refactor working code.

---

## Already fixed (do NOT redo)

- `content/shared/storage.js` — now uses the **promise** form of the storage
  API. Firefox's native `browser.*` is promise-based and ignored the old
  callbacks, which froze every toggle on its default. Keep it promise-based.
- **TikTok prototyped and removed** — most TikTok use is in the native app, and
  its obfuscated anti-bot DOM made browser blocking a maintenance treadmill. The
  full experiment (For You/Explore curtain overlay, Following sub-toggle gating,
  nav hiding, `/video/` redirects, and the auto-diagnostic probe) is preserved on
  the `archive/tiktok-experiment` git branch. Do not re-add without revisiting.
- `scripts/chrome-build.sh` — stages a clean `dist/chrome`. **Always load
  `dist/chrome` in Chrome/Edge/Brave, never the repo root** (the root has
  `__pycache__`, `.venv`, `orchestrator.py`, which Chrome rejects).
- **Instagram model changed** (see CLAUDE.md): the master toggle now blocks ALL
  feed content — every post AND reel — not just reels. Only Stories and
  Messages/DMs survive. `content/instagram/feed.js` hides all `<article>`s on
  `/`; `explore.js` hides all cards; `instagram.js` re-scans after load + on SPA
  nav (fixes "doesn't block on entry"). DMs are never touched — content shared in
  a conversation always stays visible; there is no DM module anymore.
- **YouTube Shorts implemented** (was UNIT A) — `content/youtube/youtube.js`
  blocks Shorts shelves/nav/cards and redirects `/shorts/`. `allowFollowing` has
  NO effect on YouTube (the subscribed-only filter was removed — see Unit A).
  Redirect rules added in both backgrounds (`YT_RANGE = [300]`).
- **Facebook prototyped and removed** (was UNIT B) — Facebook actively fights
  blockers and its home feed can't be split cleanly into friends' vs. foreign
  content, so support was dropped. The experiment is preserved on the
  `archive/facebook-experiment` git branch. Do not re-add without revisiting.
- **Instagram I-1 (suggested posts) and I-3 (profile grid) implemented** —
  `feed.js` still blocks "Suggested for you" units when `allowFollowing` is on;
  `profile.js` blocks the post grid (header preserved) unless `allowFollowing`
  is on and you follow the profile.
- **Firefox background redirect fixed** — `background.firefox.js` now scopes each
  platform's regex to its own host so one rule can never hijack another, uses the
  promise form of storage, and adds the YouTube pattern.

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

## UNIT B — Facebook (ABANDONED — archived)

Facebook support was prototyped and removed. Facebook actively fights blockers
(scrambled "Sponsored" text, no stable `role="feed"`/`role="article"` on real
home posts) and its home feed can't be split cleanly into friends' vs. foreign
content, so partial blocking felt worse than none. The full experiment (Follow-
CTA detection, search-filter handling, redirects) is preserved on the
`archive/facebook-experiment` git branch. Do not re-add to this extension without
revisiting that decision — it may make more sense as a separate, dedicated
extension.

---

## UNIT I — Instagram: verify selectors only

I-1 (suggested posts) and I-3 (profile grid) are implemented; just verify their
text/aria anchors against the live DOM (`feed.js` `SUGGESTED_RE` /
`isSuggested`, and `profile.js` `isFollowedProfile` / grid walk). DMs are never
touched — content shared in a conversation always stays visible, so there is no
DM blocking work left.

Verified Instagram anchors (re-check, may drift): feed item = `article`;
Stories tray is NOT an `article`; DM route = pathname starts `/direct`; reel
URL = `/reel/<id>`; profile post link = `a[href*="/p/"]`; "Suggested for you"
label sits in the article header.

---

## Reminders

- `allowFollowing` is the single **universal** sub-toggle — it governs every
  platform simultaneously. No per-platform toggles.
- Instagram master toggle blocks ALL feed content (posts + reels), keeping only
  Stories and Messages/DMs. Don't regress this back to reels-only.
- Wrap every `scanAndBlock` in try/catch; `console.warn` when zero elements
  matched (stale-selector signal).
- After any change, re-run `./scripts/chrome-build.sh` and
  `./scripts/firefox-build.sh` and load the `dist/` output, not the repo root.
- Update `AGENT_SUMMARY.md` with anything left unverified against live DOM.
