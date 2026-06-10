'use strict';
// Pure timer functions used by popup.js and tested by test/timer.test.js.
// Node-side CommonJS — NOT loaded as a browser content script.

/**
 * Returns the local-storage patch to apply on extension install.
 * @param {boolean} blockingEnabled
 * @param {number}  now  – Date.now() at install time
 */
exports.installPatch = function(blockingEnabled, now) {
  if (blockingEnabled) {
    return { blockingStartTime: now, pausedElapsed: 0 };
  }
  return { blockingStartTime: null };
};

/**
 * Returns the local-storage patch when the master toggle changes.
 * Returns {} when the toggle value did not actually change.
 * @param {boolean} wasEnabled
 * @param {boolean} isEnabled
 * @param {Object}  localState  – current browser.storage.local snapshot
 * @param {number}  now         – Date.now()
 */
exports.applyToggleChange = function(wasEnabled, isEnabled, localState, now) {
  if (wasEnabled === isEnabled) return {};
  if (isEnabled) {
    // Turning ON: reset clock, discard any prior paused accumulation.
    return { blockingStartTime: now, pausedElapsed: 0 };
  }
  // Turning OFF: freeze elapsed time.
  const elapsed = localState.blockingStartTime != null
    ? now - localState.blockingStartTime
    : (localState.pausedElapsed || 0);
  return { pausedElapsed: elapsed };
};

/**
 * Returns total elapsed milliseconds to display in the popup.
 * @param {boolean} blockingEnabled
 * @param {Object}  localState
 * @param {number}  now
 */
exports.elapsedMs = function(blockingEnabled, localState, now) {
  if (blockingEnabled) {
    return localState.blockingStartTime != null ? now - localState.blockingStartTime : 0;
  }
  return localState.pausedElapsed || 0;
};

/**
 * Splits a millisecond duration into display components.
 * @param {number} ms
 * @returns {{ days: number, hrs: number, min: number }}
 */
exports.formatElapsed = function(ms) {
  const totalMin = Math.floor(ms / 60000);
  const totalHrs = Math.floor(totalMin / 60);
  const days     = Math.floor(totalHrs / 24);
  return { days, hrs: totalHrs % 24, min: totalMin % 60 };
};
