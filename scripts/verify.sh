#!/usr/bin/env bash
# Deterministic gate for the build. Soft on absence (a stage may not have built a
# file yet), HARD on malformed. Exit non-zero on any real failure.
# Catches the failure classes seen in the first run: CommonJS/ESM in browser code,
# `window` in the MV3 service worker, inheriting undefined classes, missing icons.
set -uo pipefail
cd "$(dirname "$0")/.."
fail=0
note() { printf '  %s\n' "$1"; }

echo "[verify] JS syntax (node --check)"
while IFS= read -r f; do
  node --check "$f" || { note "SYNTAX FAIL: $f"; fail=1; }
done < <(find . -name '*.js' -not -path './node_modules/*' -not -path './.git/*')

echo "[verify] module system — content/ + background/ must be plain browser JS"
# require()/import/export/module.exports don't exist in content scripts or MV3
# workers. Scoped to browser-injected code; lib/ and test/ are exempt (Node-side).
if grep -rnE "require\(|module\.exports|exports\.|^[[:space:]]*export |^[[:space:]]*import " \
     content background 2>/dev/null | grep -v node_modules; then
  note "CommonJS/ESM syntax in browser code — share via window.RB namespace instead"
  fail=1
fi
if [ -f background/service-worker.js ] && grep -nE "\bwindow\b" background/service-worker.js; then
  note "service-worker.js references window — MV3 workers have no window; use self/globalThis"
  fail=1
fi

echo "[verify] no inheritance from undefined classes"
node -e '
  const fs=require("fs"),path=require("path");
  const walk=d=>fs.existsSync(d)?fs.readdirSync(d).flatMap(f=>{const p=path.join(d,f);
    return fs.statSync(p).isDirectory()?walk(p):[p];}):[];
  const files=[...walk("content"),...walk("lib")].filter(f=>f.endsWith(".js"));
  const defined=new Set(); const ext=[];
  for(const f of files){const s=fs.readFileSync(f,"utf8");
    for(const m of s.matchAll(/class\s+(\w+)/g)) defined.add(m[1]);
    for(const m of s.matchAll(/extends\s+(\w+)/g)) ext.push([f,m[1]]);}
  let bad=0;
  for(const [f,n] of ext){ if(!defined.has(n)){ console.log("  extends undefined class "+n+" in "+f); bad=1; } }
  process.exit(bad);
' || fail=1

echo "[verify] manifest cross-reference (scripts + icons must exist)"
for mf in manifest.json manifest.firefox.json; do
  [ -f "$mf" ] || { note "absent (ok if not built yet): $mf"; continue; }
  node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))' "$mf" \
    || { note "INVALID JSON: $mf"; fail=1; continue; }
  node -e '
    const fs=require("fs"); const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
    const paths=[];
    (m.content_scripts||[]).forEach(c=>{(c.js||[]).forEach(p=>paths.push(p));(c.css||[]).forEach(p=>paths.push(p));});
    const b=m.background||{};
    if(b.service_worker) paths.push(b.service_worker);
    (b.scripts||[]).forEach(p=>paths.push(p));
    if(m.icons) Object.values(m.icons).forEach(p=>paths.push(p));
    const act=m.action||m.browser_action||{};
    if(act.default_icon){ typeof act.default_icon==="string"
      ? paths.push(act.default_icon)
      : Object.values(act.default_icon).forEach(p=>paths.push(p)); }
    if(act.default_popup) paths.push(act.default_popup);
    let bad=0;
    paths.forEach(p=>{ if(!fs.existsSync(p)){ console.log("  MISSING REF: "+p); bad=1; }});
    process.exit(bad);
  ' "$mf" || fail=1
done

echo "[verify] behavioral invariants (conditional on file existence)"
# Each check fires ONLY if its target file exists AND is in the current stage's
# expected file list (RB_STAGE_EXPECTS, colon-separated). When RB_STAGE_EXPECTS
# is unset, all existing files are checked (useful for a final full pass).
# This prevents out-of-scope files Qwen created early from failing checks that
# belong to a later stage.
_in_expects() {
  local f="$1"
  [ -z "${RB_STAGE_EXPECTS:-}" ] && return 0  # unset = check everything
  local IFS=':'
  for e in ${RB_STAGE_EXPECTS}; do
    [ "$e" = "$f" ] && return 0
  done
  return 1  # file not in this stage's expects — skip its invariant
}
must_contain() {  # must_contain <file> <regex> <human reason>
  local f="$1" pat="$2" why="$3"
  [ -f "$f" ] || return 0        # file absent — not built yet, fine
  _in_expects "$f" || return 0   # file built out-of-scope — skip until its stage
  if ! grep -qE "$pat" "$f"; then
    note "INVARIANT FAIL: $f — $why (expected /$pat/)"
    fail=1
  fi
}

# Instagram: For You -> Following auto-redirect lives in feed.js
must_contain content/instagram/feed.js "variant=following|following" \
  "feed must redirect For You -> Following (CLAUDE.md: Home feed For You tab)"
# SPA routing: pushState patch is mandated for both redirect modules
must_contain content/instagram/redirect.js "pushState" \
  "redirect must monkey-patch history.pushState (CLAUDE.md: SPA Navigation Interception)"
must_contain content/tiktok/redirect.js "pushState" \
  "redirect must monkey-patch history.pushState (CLAUDE.md: SPA Navigation Interception)"
# TikTok blocked-screen overlay must carry the spec's subtext
must_contain content/tiktok/feed.js "Focus Guard|blocked" \
  "feed must render the blocked-screen overlay (CLAUDE.md: TikTok Blocked Screen Design)"
# DMs must use a placeholder, never removal — check the placeholder text exists
must_contain content/instagram/dms.js "[Rr]eel blocked|placeholder" \
  "DM reels must become a placeholder, not be removed (CLAUDE.md: DMs surface)"
# Service worker: dynamic rules only, and it must react to the master toggle
must_contain background/service-worker.js "updateDynamicRules" \
  "MV3 worker must use updateDynamicRules, not static rules (CLAUDE.md: Dynamic Rule Management)"
must_contain background/service-worker.js "onChanged" \
  "MV3 worker must listen to storage.onChanged for blockingEnabled (CLAUDE.md: Dynamic Rule Management)"
# Every platform entry point must restore hidden elements on toggle-off
must_contain content/instagram/instagram.js "unblock|data-rb-blocked|rbBlocked" \
  "must restore hidden elements when master toggle turns off (CLAUDE.md: Unhiding on Toggle Off)"
must_contain content/tiktok/tiktok.js "unblock|data-rb-blocked|rbBlocked" \
  "must restore hidden elements when master toggle turns off (CLAUDE.md: Unhiding on Toggle Off)"
# Popup must drive the timer from the shared pure functions, not reinvent it
must_contain popup/popup.js "elapsed|blockingStartTime|formatElapsed" \
  "popup must use lib/timer.js timer logic (CLAUDE.md: Timer)"
# YouTube stays a stub in Phase 1/2-scaffold — flag if real logic appears
if [ -f content/youtube/youtube.js ] && \
   grep -qE "addEventListener|querySelector|MutationObserver|updateDynamicRules" content/youtube/youtube.js; then
  note "INVARIANT FAIL: content/youtube/youtube.js contains logic — Phase 2 is scaffold only (stub comment)"
  fail=1
fi

echo "[verify] unit tests"
if [ -d test ] && compgen -G "test/*.test.js" >/dev/null; then
  node --test test/*.test.js || fail=1
else
  note "no tests yet (ok)"
fi

echo "[verify] no forgotten AGENT STOP markers"
grep -rn "AGENT STOP:" --include='*.js' . 2>/dev/null | grep -v node_modules \
  && note "AGENT STOP comments present — review before shipping (non-fatal)"

[ "$fail" -eq 0 ] && echo "[verify] PASS" || echo "[verify] FAIL"
exit "$fail"
