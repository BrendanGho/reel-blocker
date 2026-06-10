// Firefox MV2 background page. Mirrors the MV3 service-worker's redirect rules
// using webNavigation. Each pattern is scoped to its own host so one platform's
// rule can never hijack another (e.g. instagram.com/reel/ vs facebook.com/reel/).
browser.webNavigation.onBeforeNavigate.addListener(function(details) {
  // Only redirect top-level frame navigations, never sub-frames.
  if (details.frameId !== 0) return;

  const url = details.url;
  let newUrl = null;

  // Instagram reels — scoped to instagram.com so it never matches
  // facebook.com/reel/, which Facebook also uses.
  if (/^https?:\/\/([a-z]+\.)?instagram\.com\/(reels\/|reel\/)/.test(url)) {
    newUrl = 'https://www.instagram.com/?variant=following';
  }
  // TikTok video URLs.
  else if (/^https?:\/\/([a-z]+\.)?tiktok\.com\/video\//.test(url)) {
    newUrl = 'https://www.tiktok.com/following';
  }
  // YouTube Shorts.
  else if (/^https?:\/\/([a-z]+\.)?youtube\.com\/shorts\//.test(url)) {
    newUrl = 'https://www.youtube.com/';
  }
  // Facebook reels.
  else if (/^https?:\/\/([a-z]+\.)?facebook\.com\/(reel\/|reels\/)/.test(url)) {
    newUrl = 'https://www.facebook.com/';
  }

  if (!newUrl) return;

  // Promise form: Firefox's browser.* ignores callbacks. Default OFF when unset.
  Promise.resolve(browser.storage.sync.get(['blockingEnabled']))
    .then(function(result) {
      if (result.blockingEnabled !== true) return;
      browser.tabs.update(details.tabId, { url: newUrl });
    })
    .catch(function(e) { console.error('[reel-blocker] storage read failed:', e); });
}, { url: [ '<all_urls>' ] });