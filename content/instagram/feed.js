window.RB = window.RB || {};
window.RB.ig = window.RB.ig || {};

// Home feed (pathname "/"): block ALL content — every post and reel — not just
// reels. The home timeline is the "people you follow" feed, so:
//   - allowFollowing OFF -> hide every feed item.
//   - allowFollowing ON  -> show the whole home feed (content from people you
//                           follow comes through).
// Stories are NEVER <article> elements (they live in a separate horizontal
// tray), so hiding articles leaves Stories untouched by construction.
//
// When allowFollowing is ON we must show ONLY posts from people you follow.
// Instagram's home feed is no longer a pure follow graph — it interleaves
// "Suggested for you" units, algorithmic recommendations, and ads.
//
// We CANNOT allowlist on a positive "this is from someone you follow" signal:
// IG renders NO "Following" badge on a home-feed post from an account you
// already follow — its header is just `username • 5h • •••`, no follow control
// at all. So there is no positive marker to key on, and requiring one would hide
// your real follows. Instead we DENYLIST on the negative markers IG does expose,
// blocking a card only when it announces itself as not-from-a-follow:
//   - a "Follow" / "Follow back" button  -> you do NOT follow them yet
//   - a "Suggested for you / posts" label -> recommendation
//   - a "Sponsored" label                 -> ad
// Everything else is treated as a follow and kept. Trade-off (accepted): a fully
// unlabelled recommendation could slip through; in exchange we never hide your
// actual follows. Text/role anchors, not class anchors — re-check if IG changes
// wording (NEXT_STEPS.md, Instagram Unit I-1).
window.RB.ig.SUGGESTED_RE = /suggested (for you|posts?)/i;
window.RB.ig.SPONSORED_RE = /^sponsored$/i;
// Branded-content ads carry a "Paid partnership" label (sometimes "Paid
// partnership with <brand>"), so anchor at the start rather than exact-match.
window.RB.ig.PAID_RE = /^paid partnership/i;

// Follow-state control text. CASE-SENSITIVE on purpose: IG renders the button
// label capitalised ("Follow" / "Following" / "Requested"), but the profile
// stats render the count label lower-case ("1,234 following"). Matching only the
// capitalised forms lets us distinguish the action button from that count label,
// which otherwise produces a false "following" on every profile.
window.RB.ig.FOLLOW_RE = /^(Follow|Follow Back|Follow back)$/;
window.RB.ig.FOLLOWING_RE = /^(Following|Requested)$/;

// True if the article is a "Suggested for you" unit (not from someone you follow).
window.RB.ig.isSuggested = function (article) {
  // Header text anchor: IG labels these units explicitly.
  const text = (article.textContent || '');
  if (window.RB.ig.SUGGESTED_RE.test(text.slice(0, 400))) return true;
  // Aria/role fallback: some variants carry the label on a header element.
  const labelled = article.querySelector(
    '[aria-label*="Suggested" i], header span'
  );
  if (labelled && window.RB.ig.SUGGESTED_RE.test(labelled.textContent || '')) {
    return true;
  }
  return false;
};

// True if the article is an ad unit — either a plain "Sponsored" post or a
// "Paid partnership" branded-content post. IG renders the label as a small
// element in the header; match short exact-text nodes (and aria-labels) so a
// caption that merely contains the word "sponsored" can't trigger a false
// positive. Length caps keep long captions from matching: "Sponsored" is exact,
// "Paid partnership" allows a short "with <brand>" suffix.
window.RB.ig.isSponsored = function (article) {
  const els = article.querySelectorAll('span, div, a, [aria-label]');
  for (const el of els) {
    const t = (el.textContent || '').trim();
    if (t.length <= 20 && window.RB.ig.SPONSORED_RE.test(t)) return true;
    if (t.length <= 40 && window.RB.ig.PAID_RE.test(t)) return true;
    const al = (el.getAttribute && el.getAttribute('aria-label') || '').trim();
    if (al && (window.RB.ig.SPONSORED_RE.test(al) || window.RB.ig.PAID_RE.test(al))) {
      return true;
    }
  }
  return false;
};

// A home-feed profile link: "/username/" — one path segment, trailing slash.
// Excludes post/reel/explore/dm/story permalinks so only real account links
// count. Usernames may contain dots/underscores (e.g. /ado._.hachan/), which
// [^/]+ covers.
window.RB.ig.PROFILE_HREF_RE = /^\/[^/]+\/$/;
window.RB.ig.isProfileHref = function (h) {
  if (!h || !window.RB.ig.PROFILE_HREF_RE.test(h)) return false;
  return !(
    h.startsWith('/p/') || h.startsWith('/reel/') || h.startsWith('/reels/') ||
    h.startsWith('/explore/') || h.startsWith('/direct/') || h.startsWith('/stories/')
  );
};

// True if the post is a collab / co-authored post (TWO creators in the byline,
// e.g. "X and Y"). Why this needs special handling: IG serves collab posts as
// algorithmic recommendations WITHOUT a "Suggested" label, and the "Follow"
// button on them is HOVER-ONLY (absent from the DOM at rest), so neither
// isSuggested nor hasFollowCta can flag them — they slip through isFromFollowing's
// default-keep and leak under allowFollowing.
//
// Structural anchor (verified against live DOM 2026-06-09): the byline renders
// the two co-authors as the post's FIRST TWO profile links, both DISTINCT. A
// single-creator post instead repeats ONE author (header byline + caption both
// link the same account), so its first two profile links are identical. Reading
// only the first two links keeps a commenter's username (rendered far below the
// media) from being mistaken for a co-author.
//
// Trade-off (accepted, denylist philosophy): because follow status is
// unverifiable at rest, this blocks ALL collab posts under allowFollowing —
// including a collab between accounts you DO follow. Collabs are rare; closing
// the leak wins.
window.RB.ig.isCollab = function (article) {
  const users = [];
  for (const a of article.querySelectorAll('a[href]')) {
    const h = a.getAttribute('href');
    if (!window.RB.ig.isProfileHref(h)) continue;
    users.push(h);
    if (users.length >= 2) break;
  }
  return users.length === 2 && users[0] !== users[1];
};

// True if the card contains a "Follow" / "Follow back" call-to-action. That
// button is rendered ONLY for accounts you do not already follow, so its
// presence is a reliable "not from someone you follow" marker. Order-independent
// (unlike followState) and capped in length to skip large containers.
window.RB.ig.hasFollowCta = function (root) {
  const els = root.querySelectorAll('button, [role="button"], div, span, a');
  for (const el of els) {
    const t = (el.textContent || '').trim();
    if (!t || t.length > 12) continue;
    if (window.RB.ig.FOLLOW_RE.test(t)) return true;
  }
  return false;
};

// Inspect a region (a feed <article> or a profile <header>) and report the
// relationship encoded by its FIRST follow control:
//   'following' -> reads "Following"/"Requested"  (you follow them)
//   'follow'    -> reads "Follow"/"Follow Back"    (you do NOT — you still can)
//   null        -> no follow control found
// First-match-wins is deliberate: the main action button is the first such
// control in DOM order, so a "suggested accounts" carousel rendered lower down
// (full of other people's Follow/Following buttons) can't override it. IG
// renders the control inconsistently (<button>, <div role=button>, bare <div>),
// so we match exact element text across common tags, capped in length to skip
// large containers, rather than relying on a button role.
window.RB.ig.followState = function (root) {
  const els = root.querySelectorAll('button, [role="button"], div, span, a');
  for (const el of els) {
    const t = (el.textContent || '').trim();
    if (!t || t.length > 12) continue;
    if (window.RB.ig.FOLLOWING_RE.test(t)) return 'following';
    if (window.RB.ig.FOLLOW_RE.test(t)) return 'follow';
  }
  return null;
};

// Under allowFollowing, keep a home-feed post UNLESS it carries a positive
// not-from-a-follow marker: a "Suggested" label, a "Sponsored" label, a "Follow"
// CTA, or a two-creator collab byline (see isCollab — collabs are unverifiable
// at rest and are blocked by default). A post from someone you follow has none
// of these (IG shows no "Following" badge on it), so it is kept.
window.RB.ig.isFromFollowing = function (article) {
  if (window.RB.ig.isSuggested(article)) return false;
  if (window.RB.ig.isSponsored(article)) return false;
  if (window.RB.ig.hasFollowCta(article)) return false;
  if (window.RB.ig.isCollab(article)) return false;
  return true;
};

// Block-all mode: hide the whole feed list with a single display:none rather
// than each post individually. Two payoffs:
//   1. Keeps the Stories tray fixed. An emptied-but-present feed column collapses
//      and lets IG's centering reflow the Stories tray; removing the column
//      entirely leaves the tray in its natural position.
//   2. Stops the collapsed-column churn (and, in practice, IG's "near the end"
//      infinite-load trigger, since the posts it observes have no layout box).
//
// The container is the LOWEST COMMON ANCESTOR of all posts — the smallest node
// that contains every <article>. Because it's minimal, it cannot swallow the
// Stories tray or the suggestions sidebar: both live in SIBLING branches outside
// the post list (verified against the live DOM, 2026-06-09). This deliberately
// does NOT walk up toward <main> — that overshoots into the wrapper that also
// holds Stories + sidebar and hides everything. Returns false (-> per-article
// fallback) only if a multi-post list can't be isolated.
window.RB.ig.hideFeedContainer = function () {
  const arts = document.querySelectorAll('article');
  const total = arts.length;
  if (!total) return false;
  // Climb only until the node contains EVERY post; stop there.
  let node = arts[0];
  while (node.parentElement && node.querySelectorAll('article').length < total) {
    node = node.parentElement;
  }
  if (node === arts[0]) return false;  // couldn't expand past a single post
  window.RB.blockElement(node);
  return true;
};

window.RB.ig.feedScan = function () {
  const s = window.RB.storage.get();
  if (!s.blockingEnabled) return;
  if (window.location.pathname !== '/') return;   // home timeline only

  const followingOnly = s.allowFollowing; // when on, keep only followed content

  // Block-all (sub-toggle off): try the single-shot column hide first; it also
  // stops IG fetching more posts and keeps the Stories tray fixed. Falls through
  // to per-article hiding if no clean column is found.
  if (!followingOnly && window.RB.ig.hideFeedContainer()) return;

  // Decide per post on EVERY scan — do NOT cache the verdict. A post's
  // "Follow" / "Suggested" / "Sponsored" markers frequently render a tick AFTER
  // its <article> first appears, so a cached early verdict locks in a wrong
  // "keep" and leaks non-followed content. Re-evaluating each scan lets a
  // later-rendered marker still block the post. (Block-all mode never reaches
  // here — it's handled O(1) by hideFeedContainer above — so this re-scan cost
  // only applies while browsing your follows.)
  const articles = document.querySelectorAll('article');
  articles.forEach((article) => {
    // Defensive: never touch anything inside the Stories UI.
    let p = article.parentElement;
    while (p) {
      if ((p.getAttribute('aria-label') || '').toLowerCase().includes('stories')) return;
      p = p.parentElement;
    }

    // allowFollowing ON: keep posts from people you follow (denylist lives in
    // isFromFollowing); block recommendations, suggested units and ads.
    if (followingOnly && window.RB.ig.isFromFollowing(article)) return;

    window.RB.blockElement(article);
  });

  // Stale-selector signal: warn only when blocking-all is expected AND there are
  // no article elements at all (not merely "all already evaluated/cached").
  if (!followingOnly && articles.length === 0) {
    console.warn('[reel-blocker] No feed posts matched on / — selector may be stale');
  }
};
