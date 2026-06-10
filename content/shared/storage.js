window.RB = window.RB || {};

// Single source of truth for settings access in content scripts.
//
// chrome.storage is async, but the per-surface scan functions need a value
// synchronously every time the MutationObserver fires. So we keep a local
// cache (seeded with the spec defaults) that is readable synchronously via
// get()/getSync(), refreshed once by init(), and kept current by a
// storage.onChanged listener. Writes go straight to storage and the cache is
// updated optimistically.
//
// IMPORTANT — engine compatibility:
// Firefox's native `browser.*` API is PROMISE-based and silently ignores any
// callback argument. Chrome's `chrome.*` (aliased to `browser` by the polyfill)
// returns a Promise under MV3 when called with no callback. So this module
// uses the PROMISE form everywhere and never passes a callback to the storage
// API. (The previous callback form broke entirely on Firefox: the cache never
// loaded real values, so every toggle read as its hardcoded default.)
window.RB.storage = (function () {
  const DEFAULTS = { blockingEnabled: true, allowFollowing: false };
  let cache = Object.assign({}, DEFAULTS);

  // Normalise whatever the storage API returns into a real Promise, so this
  // works whether the call returns a thenable (Firefox / Chrome MV3 promise)
  // or, defensively, undefined.
  function p(thenable) {
    try {
      return Promise.resolve(thenable);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  function get() { return cache; }            // synchronous snapshot

  function set(obj, cb) {
    Object.assign(cache, obj);                // optimistic
    p(browser.storage.sync.set(obj))
      .then(() => { if (cb) cb(); })
      .catch((e) => {
        console.warn('[reel-blocker] storage.set failed:', e);
        if (cb) cb();
      });
  }

  function getLocal(cb) {
    p(browser.storage.local.get(['blockingStartTime', 'pausedElapsed']))
      .then((res) => cb(Object.assign({ blockingStartTime: 0, pausedElapsed: 0 }, res || {})))
      .catch((e) => {
        console.warn('[reel-blocker] storage.getLocal failed:', e);
        cb({ blockingStartTime: 0, pausedElapsed: 0 });
      });
  }

  function setLocal(obj, cb) {
    p(browser.storage.local.set(obj))
      .then(() => { if (cb) cb(); })
      .catch((e) => {
        console.warn('[reel-blocker] storage.setLocal failed:', e);
        if (cb) cb();
      });
  }

  // Load real values into the cache, then invoke cb() so callers can re-scan.
  function init(cb) {
    p(browser.storage.sync.get(['blockingEnabled', 'allowFollowing']))
      .then((res) => {
        cache = Object.assign({}, DEFAULTS, res || {});
        if (cb) cb(cache);
      })
      .catch((e) => {
        console.warn('[reel-blocker] storage.init failed:', e);
        if (cb) cb(cache);
      });

    try {
      browser.storage.onChanged.addListener((changes, area) => {
        if (area !== 'sync') return;
        let touched = false;
        for (const k of Object.keys(DEFAULTS)) {
          if (changes[k]) { cache[k] = changes[k].newValue; touched = true; }
        }
        if (touched && typeof window.RB.storage._onChange === 'function') {
          window.RB.storage._onChange(cache);
        }
      });
    } catch (e) {
      console.warn('[reel-blocker] storage.onChanged unavailable:', e);
    }
  }

  return {
    get,
    getSync: get,        // alias — some modules call getSync()
    set,
    setSync: set,        // alias
    getLocal,
    setLocal,
    init,
    onChanged: (browser && browser.storage && browser.storage.onChanged) || {
      addListener() {}, removeListener() {}
    },
    _onChange: null,     // entry points assign a re-scan callback here
  };
})();
