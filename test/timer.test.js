'use strict';
const assert = require('node:assert');
const test = require('node:test');
const t = require('../lib/timer.js');

const MIN = 60000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

test('install with blocking on starts the clock', () => {
  const p = t.installPatch(true, 1000);
  assert.equal(p.blockingStartTime, 1000);
  assert.equal(p.pausedElapsed, 0);
});

test('install with blocking off does not start the clock', () => {
  const p = t.installPatch(false, 1000);
  assert.equal(p.blockingStartTime, null);
});

test('turning blocking on starts the clock', () => {
  const patch = t.applyToggleChange(false, true, { blockingStartTime: null, pausedElapsed: 3 * HOUR }, 50000);
  assert.equal(patch.blockingStartTime, 50000);
  assert.equal(patch.pausedElapsed, 0);
});

test('turning blocking off freezes elapsed', () => {
  const patch = t.applyToggleChange(true, false, { blockingStartTime: 1000 }, 1000 + 3 * HOUR);
  assert.equal(patch.pausedElapsed, 3 * HOUR);
  assert.equal('blockingStartTime' in patch, false);
});

test('no state change leaves storage untouched', () => {
  assert.deepEqual(t.applyToggleChange(true, true, { blockingStartTime: 500 }, 9000), {});
  assert.deepEqual(t.applyToggleChange(false, false, {}, 9000), {});
});

test('re-enabling resets the clock to now (no carry-over)', () => {
  const patch = t.applyToggleChange(false, true, { blockingStartTime: 1000, pausedElapsed: 5 * DAY }, 80000);
  assert.equal(patch.blockingStartTime, 80000);
  assert.equal(patch.pausedElapsed, 0);
});

test('elapsedMs counts from start while on', () => {
  assert.equal(t.elapsedMs(true, { blockingStartTime: 1000 }, 1000 + 2 * DAY), 2 * DAY);
});

test('elapsedMs returns frozen value while off', () => {
  assert.equal(t.elapsedMs(false, { pausedElapsed: 5 * MIN }, 9_999_999), 5 * MIN);
});

test('formatElapsed splits days/hrs/min', () => {
  assert.deepEqual(t.formatElapsed(12 * DAY + 4 * HOUR + 7 * MIN), { days: 12, hrs: 4, min: 7 });
});
