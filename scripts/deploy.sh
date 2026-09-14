#!/usr/bin/env bash
# Deploy rr888bd.site from GitHub main onto the VPS. Run it ON the server, as
# the site user (mehedi3) — the FASTPANEL terminal is already that shell:
#
#     ~/www/rr888bd.site/_node_app/scripts/deploy.sh
#
# It pulls main, installs, builds, restarts the app and checks the live site.
# No root needed: the app is a FASTPANEL "Systemd" backend running as this
# same user's own systemd, so `systemctl --user restart` is enough.
#
# Flags:
#   --check        report what is deployed and running, change nothing
#   --skip-install skip `npm ci` (fine when package-lock.json did not change)
#   --no-restart   build only, leave the running app alone

set -uo pipefail

APP_DIR="${APP_DIR:-$HOME/www/rr888bd.site/_node_app}"
PORT="${PORT:-3251}"
SITE="${SITE:-https://rr888bd.site}"
BRANCH="${BRANCH:-main}"

CHECK_ONLY=0
SKIP_INSTALL=0
NO_RESTART=0
for arg in "$@"; do
  case "$arg" in
    --check) CHECK_ONLY=1 ;;
    --skip-install) SKIP_INSTALL=1 ;;
    --no-restart) NO_RESTART=1 ;;
    -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

say()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m  ✓ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m  ! %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

cd "$APP_DIR" || die "app directory not found: $APP_DIR"

running_pid() { pgrep -u "$(id -un)" -f 'next-server|next start' | head -1; }
port_code()   { curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://127.0.0.1:$PORT/" 2>/dev/null; }
live_code()   { curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$SITE/" 2>/dev/null; }
build_id()    { cat .next/BUILD_ID 2>/dev/null || echo none; }

# ---------------------------------------------------------------- status ----
status() {
  say "Status"
  echo "  dir        $APP_DIR"
  echo "  commit     $(git log --oneline -1 2>/dev/null)"
  echo "  build id   $(build_id)"
  local pid; pid="$(running_pid)"
  echo "  process    ${pid:-not running}"
  echo "  port $PORT   $(port_code)"
  echo "  $SITE  $(live_code)"
  local id; id="$(build_id)"
  if [ "$id" != none ] && curl -s --max-time 20 "$SITE/" | grep -q "$id"; then
    ok "the live site is serving this build"
  else
    warn "the live site is NOT serving this build yet"
  fi
}

if [ "$CHECK_ONLY" = 1 ]; then status; exit 0; fi

# ------------------------------------------------------------------ pull ----
say "Pulling $BRANCH"
# `next dev` rewrites tsconfig.json and AGENTS.md; drop any such local edits so
# the pull is always fast-forward. Nothing here is edited by hand on the server.
git checkout -- . 2>/dev/null
BEFORE="$(git rev-parse HEAD)"
git pull --ff-only origin "$BRANCH" || die "git pull failed — resolve it by hand and re-run"
AFTER="$(git rev-parse HEAD)"
git log --oneline -1
[ "$BEFORE" = "$AFTER" ] && warn "already at the newest commit — rebuilding anyway"

# --------------------------------------------------------------- install ----
if [ "$SKIP_INSTALL" = 0 ]; then
  say "Installing dependencies"
  npm ci --no-audit --no-fund || die "npm ci failed"
  ok "dependencies installed"
fi

# ----------------------------------------------------------------- build ----
say "Building"
if ! npm run build; then
  die "build failed — the running site was left untouched"
fi
ok "built $(build_id)"

[ "$NO_RESTART" = 1 ] && { ok "--no-restart: leaving the running app as it is"; exit 0; }

# --------------------------------------------------------------- restart ----
say "Restarting"
OLD_PID="$(running_pid)"
[ -z "$OLD_PID" ] && die "no running app found for user $(id -un).
  Start it from FASTPANEL: rr888bd.site → Settings → Backend → Save."

# The unit that owns the process — its own cgroup line names it, and any user
# may read that.
#
# FASTPANEL runs this backend as a *user* unit, so the cgroup reads
# .../user@1044.service/app.slice/rr888bd_site.service. That one this account
# may restart outright, no root and no killing. Only if it turns out to be a
# system unit instead do we fall back to sudo, and then to a plain signal —
# and that last one only when the unit will start the app again.
CGROUP="$(head -1 "/proc/$OLD_PID/cgroup" 2>/dev/null)"
USER_UNIT="$(printf '%s' "$CGROUP" | sed -n 's#.*/app\.slice/##p')"
UNIT="$(printf '%s' "$CGROUP" | sed -n 's#.*/system\.slice/##p')"

if [ -n "$USER_UNIT" ]; then
  echo "  unit       $USER_UNIT (user, Restart=$(systemctl --user show -p Restart --value "$USER_UNIT" 2>/dev/null))"
else
  RESTART_POLICY="$(systemctl show -p Restart --value "$UNIT" 2>/dev/null)"
  echo "  unit       ${UNIT:-unknown} (Restart=${RESTART_POLICY:-unknown})"
fi

if [ -n "$USER_UNIT" ] && systemctl --user restart "$USER_UNIT" 2>/dev/null; then
  ok "restarted $USER_UNIT"
elif [ -n "$UNIT" ] && sudo -n systemctl restart "$UNIT" 2>/dev/null; then
  ok "restarted via systemd"
elif [ -n "$UNIT" ] && { [ "$RESTART_POLICY" = always ] || [ "$RESTART_POLICY" = on-failure ]; }; then
  # No sudo, but the unit restarts itself: killing our own process is enough.
  kill "$OLD_PID" 2>/dev/null
  ok "signalled pid $OLD_PID — systemd will start it again"
else
  warn "cannot confirm this unit restarts itself, so the app was left running."
  warn "the new build is in place; finish it in FASTPANEL:"
  warn "  rr888bd.site → Settings → Backend → Save"
  exit 0
fi

printf '  waiting for the app'
for i in $(seq 1 40); do
  sleep 2
  printf '.'
  [ "$(port_code)" = "200" ] && { echo; ok "up on port $PORT (pid $(running_pid))"; break; }
  if [ "$i" = 40 ]; then
    echo
    die "the app did not come back on port $PORT.
  Restart it from FASTPANEL: rr888bd.site → Settings → Backend → Save.
   The new build is already in place, so a restart is all that is missing."
  fi
done

# ---------------------------------------------------------------- verify ----
say "Verifying"
ID="$(build_id)"
for i in $(seq 1 10); do
  if curl -s --max-time 20 "$SITE/" | grep -q "$ID"; then
    ok "$SITE is serving build $ID"
    echo
    echo "  deployed: $(git log --oneline -1)"
    exit 0
  fi
  sleep 3
done
warn "$SITE answered $(live_code) but not with build $ID yet — Cloudflare may still be caching. Re-check in a minute with: $0 --check"
