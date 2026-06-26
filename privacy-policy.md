# Privacy Policy — Reel Blocker

**Last updated: June 2026**

Reel Blocker is a browser extension that blocks short-form video content on
Instagram and YouTube. This policy explains what data the extension does and
does not collect.

## Data collected

Reel Blocker collects no personal data. It does not track browsing history,
transmit any information to external servers, or communicate with any third
party.

## Local storage

The extension stores two user preferences on your device using the browser's
built-in storage API:

- Whether blocking is currently enabled (on/off)
- Whether content from people you follow is allowed

It also stores a timestamp for the "blocked for" timer. All of this data
remains on your device and is never transmitted anywhere.

## Permissions

The extension requests the following permissions solely to perform its
blocking function:

- **storage** — to save your toggle preferences across sessions
- **declarativeNetRequest** — to redirect blocked URLs before they load
- **webNavigation** — to re-run blocking after single-page-app navigation
- **instagram.com, youtube.com** — to hide blocked content in the page

## Contact

If you have questions, open an issue at
https://github.com/BrendanGho/reel-blocker/issues
