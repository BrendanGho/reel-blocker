window.RB = window.RB || {};

// Block an element by hiding it with display: none
// Idempotent via the data-rb-blocked attribute. The guard MUST test attribute
// PRESENCE, not truthiness: the saved original display is usually the empty
// string (no inline style), which is falsy. A truthiness guard let repeat scans
// fall through and overwrite the saved original with the current 'none', so
// unblockAll() would later "restore" the element to display:none and it could
// never be revealed again.
window.RB.blockElement = function(el) {
  if (el.hasAttribute('data-rb-blocked')) return;
  el.setAttribute('data-rb-blocked', el.style.display);  // save original ('' = no inline style)
  el.style.display = 'none';
};

// Restore all blocked elements when toggle is turned off
window.RB.unblockAll = function() {
  document.querySelectorAll('[data-rb-blocked]').forEach(el => {
    el.style.display = el.dataset.rbBlocked;  // restore original
    el.removeAttribute('data-rb-blocked');
  });
};