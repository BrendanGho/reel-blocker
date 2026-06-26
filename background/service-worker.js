// MV3 service worker. Runs in a worker context (no DOM globals) and no
// content-script polyfill loaded, so it uses `chrome.*` directly.
//
// All redirect rules live under the single master toggle: when blockingEnabled
// turns on, every platform's rules are added; when it turns off, all are
// removed. Dynamic rules only (no static rule_resources).

const IG_RANGE = [100, 101];
const YT_RANGE = [300];

function rules() {
  return [
    {
      id: IG_RANGE[0],
      priority: 1,
      action: { type: 'redirect',
        redirect: { url: 'https://www.instagram.com/' } },
      condition: { regexFilter: '^https?://([a-z]+\\.)?instagram\\.com/reels/',
        resourceTypes: ['main_frame'] }
    },
    {
      id: IG_RANGE[1],
      priority: 1,
      action: { type: 'redirect',
        redirect: { url: 'https://www.instagram.com/' } },
      condition: { regexFilter: '^https?://([a-z]+\\.)?instagram\\.com/reel/',
        resourceTypes: ['main_frame'] }
    },
    {
      id: YT_RANGE[0],
      priority: 1,
      action: { type: 'redirect',
        redirect: { url: 'https://www.youtube.com/' } },
      condition: { regexFilter: '^https?://([a-z]+\\.)?youtube\\.com/shorts/',
        resourceTypes: ['main_frame'] }
    }
  ];
}

function allRuleIds() {
  return [...IG_RANGE, ...YT_RANGE];
}

function updateDynamicRules(enabled) {
  // Always clear our ID range first so toggling never leaves stale rules.
  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: allRuleIds(),
    addRules: enabled ? rules() : []
  }).catch((e) => console.error('[reel-blocker] rule update failed:', e));
}

function syncFromStorage() {
  chrome.storage.sync.get(['blockingEnabled'], (res) => {
    // Default OFF when unset: all toggles start disabled on first install.
    updateDynamicRules(res.blockingEnabled === true);
  });
}

chrome.runtime.onInstalled.addListener(() => {
  // Blocking defaults OFF on install, so the timer's start time is seeded only
  // when the user later turns blocking on (handled in popup.js), not here.
  chrome.storage.sync.get('blockingEnabled', (s) => {
    const enabled = s.blockingEnabled === true;
    if (enabled) {
      chrome.storage.local.get('blockingStartTime', (l) => {
        if (l.blockingStartTime == null) {
          chrome.storage.local.set({ blockingStartTime: Date.now(), pausedElapsed: 0 });
        }
      });
    }
    syncFromStorage();
  });
});

// Service workers restart; re-apply rules whenever the worker spins up.
syncFromStorage();

chrome.storage.onChanged.addListener((changes, area) => {
  // Re-evaluate only on the master toggle: no redirect rule depends on the
  // allowFollowing sub-toggle (it has no effect on background redirects).
  if (area === 'sync' && changes.blockingEnabled) {
    syncFromStorage();
  }
});
