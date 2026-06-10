window.RB = window.RB || {};
window.RB.tk = window.RB.tk || {};

// The Following feed's block decision is made by feedScan (which knows about
// the /following surface and the sub-toggle). followingScan delegates to it so
// the entry point can keep a per-surface module list; setOverlay is idempotent
// so the duplicate call is harmless.
window.RB.tk.followingScan = function () {
  if (typeof window.RB.tk.feedScan === 'function') window.RB.tk.feedScan();
};
