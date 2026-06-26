window.RB = window.RB || {};

window.RB.createObserver = function(scanFn) {
  let debounceTimer;
  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      try {
        scanFn();
      } catch (e) {
        console.error('[reel-blocker] Error in scanFn:', e);
      }
    }, 50);
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Run immediately on creation
  try {
    scanFn();
  } catch (e) {
    console.error('[reel-blocker] Immediate scanFn error:', e);
  }

  return observer;
};