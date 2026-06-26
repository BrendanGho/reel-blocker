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
// IG's standard feed ad: a discrete "Ad" label node under the advertiser name
// (verified live 2026-06-10 — e.g. amazonwebservices/googleworkspace ads).
// CASE-SENSITIVE exact match: IG renders the label capitalised as "Ad", and a
// 2-char loose match would risk catching unrelated text.
window.RB.ig.AD_RE = /^Ad$/;

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

// True if the article is an ad unit — a standard "Ad"-labelled feed ad, a plain
// "Sponsored" post, or a "Paid partnership" branded-content post. IG renders the
// label as a small element in the header; match short exact-text nodes (and
// aria-labels) so a caption that merely contains the word can't trigger a false
// positive. Length caps keep long captions from matching: "Ad"/"Sponsored" are
// exact, "Paid partnership" allows a short "with <brand>" suffix.
window.RB.ig.isSponsored = function (article) {
  const els = article.querySelectorAll('span, div, a, [aria-label]');
  for (const el of els) {
    const t = (el.textContent || '').trim();
    if (t.length <= 4 && window.RB.ig.AD_RE.test(t)) return true;
    if (t.length <= 20 && window.RB.ig.SPONSORED_RE.test(t)) return true;
    if (t.length <= 40 && window.RB.ig.PAID_RE.test(t)) return true;
    const al = (el.getAttribute && el.getAttribute('aria-label') || '').trim();
    if (al && (window.RB.ig.SPONSORED_RE.test(al) || window.RB.ig.PAID_RE.test(al))) {
      return true;
    }
  }
  return false;
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

// True if the post is a collab / co-authored post ("alice and bob", "alice, bob
// and carol", "alice and 2 others"). Why this needs special handling: IG serves
// collab posts as algorithmic recommendations WITHOUT a "Suggested" label, and
// renders the "Follow" button HOVER-ONLY (absent from the DOM at rest — verified
// live 2026-06-10, e.g. kingdomhearts+squareenix leaked through with no Follow
// control), so neither isSuggested nor hasFollowCta can flag them. With no at-rest
// signal to tell a recommended collab from one you follow, we block ALL collabs (a
// deliberate product call: collabs are rare and the leak is worse than losing the
// occasional followed collab).
//
// IG feed posts have NO <header> element (verified live 2026-06-10), so detection
// works off the article's TEXT, anchored on the byline prefix: the author names
// are the text BEFORE the first "•" (U+2022, char 8226) that separates the byline
// from the relative timestamp ("user1 and user2•11w..."). Everything that could
// cause a false positive — the "Liked by <user>" social line, the caption — renders
// AFTER that timestamp, so the prefix is the clean byline. Handles never contain
// spaces, so " and " inside the prefix can ONLY be the co-author separator (this
// also catches "and N others"). The byline-readiness gate (bylineReady) ensures
// the timestamp — hence the full byline — has rendered before isCollab is trusted.
window.RB.ig.isCollab = function (article) {
  const txt = article.textContent || '';
  const dot = txt.indexOf('•');           // "•" separates byline from timestamp
  if (dot === -1 || dot > 120) return false;    // byline bullet not found / not a byline
  return /\sand\s/i.test(txt.slice(0, dot));
};

// Under allowFollowing, keep a home-feed post UNLESS it carries a positive
// not-from-a-follow marker: a "Suggested" label, a "Sponsored" label, a "Follow"
// CTA, or a collab byline (see isCollab — collabs are unverifiable at rest, so all
// are blocked). A post from someone you follow has none of these (IG shows no
// "Following" badge on it), so it is kept.
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

// Poke a wanted region back through preempt.js's full-<main> mask. preempt.js
// masks the entire content column (visibility:hidden) and never lifts it in
// block-all mode, so nothing in the feed can flash — but a few things the user
// still wants (Stories tray, the right suggestions/footer column) live inside
// <main> too. tagShow stamps a region with data-rb-show; preempt.js's stylesheet
// flips that subtree back to visibility:visible.
//
// The tagged node is the LARGEST ancestor of the anchor that still contains NO
// <article> — so it grabs the whole region (Stories row, or the suggestions+
// footer column beside the feed) but can never re-expose the feed branch.
// Walking by "no article descendant" is self-correcting against IG nesting
// changes (display:none articles still match querySelector, so the boundary is
// found even after hideFeedContainer runs). Safe failure mode: if an anchor goes
// stale the region just stays hidden — the feed never un-hides.
window.RB.ig.SHOW_ATTR = 'data-rb-show';
window.RB.ig.tagShow = function (anchor) {
  if (!anchor) return;
  let node = anchor;
  while (
    node.parentElement &&
    node.parentElement !== document.body &&
    node.parentElement.tagName.toLowerCase() !== 'main' &&
    node.parentElement.querySelector('article') === null
  ) {
    node = node.parentElement;
  }
  if (!node.hasAttribute(window.RB.ig.SHOW_ATTR)) {
    node.setAttribute(window.RB.ig.SHOW_ATTR, '');
  }
};

// Un-mask the regions kept visible in block-all mode: the Stories tray and the
// right column (suggestions "See All" -> /explore/people, plus the about/help/
// privacy footer nav). Each anchor resolves to its own article-free column; if
// they share one the tag is idempotent, if separate each is shown independently.
window.RB.ig.revealKeptRegions = function () {
  window.RB.ig.tagShow(document.querySelector('[aria-label*="Stor" i]'));
  window.RB.ig.tagShow(document.querySelector('a[href*="/explore/people"]'));
  window.RB.ig.tagShow(
    document.querySelector('nav a[href*="about"], nav a[href*="help"], nav a[href*="privacy"]')
  );
};

// True if the article sits inside the Stories UI (defensive — Stories aren't
// <article>s, but never risk touching them).
window.RB.ig.inStories = function (article) {
  let p = article.parentElement;
  while (p) {
    if ((p.getAttribute('aria-label') || '').toLowerCase().includes('stories')) return true;
    p = p.parentElement;
  }
  return false;
};

// How long a post must be present before we trust its keep/block verdict. IG's
// "Suggested"/"Sponsored"/"Follow" markers render a tick AFTER the <article> first
// appears, so judging immediately would mis-keep a recommendation. Waiting this
// long lets the markers land before we reveal anything.
window.RB.ig.SETTLE_MS = 400;

// Hard ceiling on the wait. The keep decision is normally gated on the byline
// having rendered (bylineReady); this is the fallback so a post whose <time>
// never appears still gets judged eventually rather than staying hidden forever.
window.RB.ig.MAX_SETTLE_MS = 3000;

// True once a post's byline has rendered. The relative timestamp is a <time>
// element that renders AFTER the byline's "user1 and user2•" prefix, so its
// presence means the full byline — including any " and <co-author>" / "and N
// others" — is in the DOM and isCollab can be trusted. (IG posts have no <header>,
// so this is article-scoped — verified live 2026-06-10: exactly one <time> per
// post.) Scroll-loaded posts hydrate progressively: the <article> appears BEFORE
// its byline, so without this gate a collab gets judged (and wrongly kept) before
// its collab markers exist, then latches as shown.
window.RB.ig.bylineReady = function (article) {
  return article.querySelector('time') !== null;
};

// allowFollowing ON — hide-first, reveal-after-settle. preempt.js's CSS hides
// EVERY post by default (article:not([data-rb-keep])), so nothing paints before
// we judge it — no show-then-hide collapse jerk. Here we just decide, per post,
// when to add the keep flag that reveals it:
//   - first sighting          -> stamp data-rb-seen (start its settle clock), stay hidden
//   - within settle, or byline not yet rendered -> leave hidden; wait
//   - settled + byline ready + isFromFollowing  -> add data-rb-keep (CSS reveals
//       it). LATCHED: we never remove keep, so a revealed follow-post can't later
//       collapse. The byline-ready gate (bylineReady) is what stops a scroll-loaded
//       collab from being judged — and wrongly kept — before its "and <co-author>"
//       byline has hydrated.
//   - settled + recommendation/collab -> never keep; stays hidden by the CSS rule.
//   - settled past MAX_SETTLE_MS -> judge regardless of readiness (fallback so a
//       post whose <time> never renders isn't hidden forever).
// A guaranteed re-scan after the settle window flips posts seen during a quiet
// moment (when no DOM mutation would otherwise re-trigger feedScan).
window.RB.ig.followScan = function (articles) {
  const now = Date.now();
  let pending = false;
  articles.forEach((article) => {
    if (window.RB.ig.inStories(article)) return;
    if (article.hasAttribute('data-rb-keep')) return;  // already revealed (latched)
    const seen = article.getAttribute('data-rb-seen');
    if (seen === null) {
      article.setAttribute('data-rb-seen', String(now));
      pending = true;
      return;
    }
    const age = now - Number(seen);
    const settled = age >= window.RB.ig.SETTLE_MS;
    const ready = window.RB.ig.bylineReady(article) || age >= window.RB.ig.MAX_SETTLE_MS;
    if (settled && ready) {
      if (window.RB.ig.isFromFollowing(article)) {
        article.setAttribute('data-rb-keep', '');  // confirmed follow -> reveal
      }
      // else: recommendation/ad/collab -> leave hidden by preempt.js's hide-first rule.
    } else {
      pending = true;  // still settling, or byline not rendered yet
    }
  });
  if (pending && !window.RB.ig._followTimer) {
    window.RB.ig._followTimer = setTimeout(function () {
      window.RB.ig._followTimer = null;
      try { window.RB.ig.feedScan(); } catch (e) {}
    }, window.RB.ig.SETTLE_MS);
  }
};

window.RB.ig.feedScan = function () {
  const s = window.RB.storage.get();
  if (!s.blockingEnabled) return;
  if (window.location.pathname !== '/') return;   // home timeline only

  const followingOnly = s.allowFollowing; // when on, keep only followed content

  // Block-all (sub-toggle off): try the single-shot column hide first; it also
  // stops IG fetching more posts and keeps the Stories tray fixed. Falls through
  // to per-article hiding if no clean column is found.
  if (!followingOnly && window.RB.ig.hideFeedContainer()) {
    // preempt.js masks ALL of <main> (visibility:hidden) and never lifts it, so
    // the feed can't flash — but Stories and the suggestions/footer sidebar live
    // inside <main> too. Poke those wanted regions back through the mask.
    window.RB.ig.revealKeptRegions();
    return;
  }

  const articles = document.querySelectorAll('article');

  // allowFollowing ON: reveal only confirmed follow-posts, hide-first (above).
  if (followingOnly) {
    // preempt.js's follow-mode CSS masks ALL of <main> (visibility:hidden) to
    // suppress the pre-<article> raw-media paint, then reveals confirmed follows
    // back through it. Stories + the suggestions/footer sidebar live inside <main>
    // too, so poke them back through the mask exactly as in block-all mode.
    window.RB.ig.revealKeptRegions();
    window.RB.ig.followScan(articles);
    return;
  }

  // Block-all fallback (hideFeedContainer found no clean column): hide each post
  // individually with display:none.
  articles.forEach((article) => {
    if (window.RB.ig.inStories(article)) return;
    window.RB.blockElement(article);
  });

  // Stale-selector signal: warn only when blocking-all is expected AND there are
  // no article elements at all (not merely "all already evaluated/cached").
  if (articles.length === 0) {
    console.warn('[reel-blocker] No feed posts matched on / — selector may be stale');
  }
};
