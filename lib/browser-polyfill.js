// Browser namespace shim.
// Chromium exposes `chrome`; Firefox exposes both `browser` and `chrome`.
// All extension code uses `browser.*`, so ensure it exists in every context
// (window, content script, and the MV3 service worker — which has no `window`,
// hence globalThis/self).
(function (global) {
  if (typeof global.browser === 'undefined' && typeof global.chrome !== 'undefined') {
    global.browser = global.chrome;
  }
})(typeof globalThis !== 'undefined' ? globalThis
   : typeof self !== 'undefined' ? self
   : this);
