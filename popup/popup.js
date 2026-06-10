// Popup logic + timer. Storage is async (Promise-based); the popup lifecycle is
// too short for intervals, so we compute elapsed time once on open.
//
// Timer rules mirror lib/timer.js (the unit-tested source of truth):
//   - ON:  elapsed = now - blockingStartTime
//   - OFF: elapsed = pausedElapsed (frozen)
//   - turning ON resets the clock; turning OFF freezes the elapsed value.

function getSync(keys)  { return browser.storage.sync.get(keys); }
function setSync(obj)   { return browser.storage.sync.set(obj); }
function getLocal(keys) { return browser.storage.local.get(keys); }
function setLocal(obj)  { return browser.storage.local.set(obj); }

// Split a millisecond duration into display components (mirrors timer.js).
function formatElapsed(ms) {
  const totalMin = Math.floor(ms / 60000);
  const totalHrs = Math.floor(totalMin / 60);
  const days = Math.floor(totalHrs / 24);
  return { days, hrs: totalHrs % 24, min: totalMin % 60 };
}

function renderTimer(blockingEnabled, local) {
  const now = Date.now();
  let elapsed;
  if (blockingEnabled) {
    elapsed = local.blockingStartTime != null ? now - local.blockingStartTime : 0;
  } else {
    elapsed = local.pausedElapsed || 0;
  }
  const { days, hrs, min } = formatElapsed(Math.max(0, elapsed));
  document.getElementById('timer').textContent =
    `${days} days ${hrs} hrs ${min} min`;
}

async function init() {
  const blockEl = document.getElementById('block-toggle');
  const followEl = document.getElementById('follow-toggle');

  let sync = { blockingEnabled: false, allowFollowing: false };
  let local = { blockingStartTime: null, pausedElapsed: 0 };
  try {
    sync = Object.assign(sync, await getSync(['blockingEnabled', 'allowFollowing']));
    local = Object.assign(local, await getLocal(['blockingStartTime', 'pausedElapsed']));
  } catch (e) {
    console.warn('[reel-blocker] popup storage read failed:', e);
  }

  blockEl.checked = !!sync.blockingEnabled;
  followEl.checked = !!sync.allowFollowing;
  renderTimer(blockEl.checked, local);

  blockEl.addEventListener('change', async () => {
    const isEnabled = blockEl.checked;
    const now = Date.now();
    try {
      await setSync({ blockingEnabled: isEnabled });
      if (isEnabled) {
        // Turning ON: reset the clock.
        local = { blockingStartTime: now, pausedElapsed: 0 };
        await setLocal(local);
      } else {
        // Turning OFF: freeze elapsed time.
        const cur = await getLocal(['blockingStartTime', 'pausedElapsed']);
        const elapsed = cur.blockingStartTime != null
          ? now - cur.blockingStartTime
          : (cur.pausedElapsed || 0);
        local = { blockingStartTime: null, pausedElapsed: elapsed };
        await setLocal(local);
      }
    } catch (e) {
      console.warn('[reel-blocker] popup toggle write failed:', e);
    }
    renderTimer(isEnabled, local);
  });

  followEl.addEventListener('change', async () => {
    try {
      await setSync({ allowFollowing: followEl.checked });
    } catch (e) {
      console.warn('[reel-blocker] popup sub-toggle write failed:', e);
    }
  });

}

document.addEventListener('DOMContentLoaded', init);
