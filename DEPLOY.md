# Deploy

GitHub `main` is what goes live. Push there, then run one command.

- **Server**: `5.189.168.13`, FASTPANEL, site user `mehedi3` (no sudo)
- **App**: `~/www/rr888bd.site/_node_app`, Next.js on `127.0.0.1:3251`
- **Process**: a FASTPANEL *Systemd* backend running as `mehedi3`, behind
  nginx → Cloudflare. Killing it is enough to restart it; no root needed.
- **Shell**: FASTPANEL → `rr888bd.site` → **Terminal** is already a `mehedi3`
  shell in the browser. https://5.189.168.13:8888

## Deploy

In the FASTPANEL terminal (or over SSH as `mehedi3`):

```bash
~/www/rr888bd.site/_node_app/scripts/deploy.sh
```

It pulls `main`, runs `npm ci`, builds, restarts the app, waits for it to
answer, then confirms rr888bd.site is serving the new build. A failed build
stops before the restart, so the running site is never left broken.

```bash
scripts/deploy.sh --check          # what is deployed and running right now
scripts/deploy.sh --skip-install   # package-lock.json unchanged
scripts/deploy.sh --no-restart     # build only
```

### First time (before the script is on the server)

```bash
cd ~/www/rr888bd.site/_node_app && git checkout -- . && git pull --ff-only origin main \
  && chmod +x scripts/deploy.sh && scripts/deploy.sh --skip-install
```

That pull brings the script itself onto the server. Every deploy after it is
just the one line above.

### If the app does not come back

FASTPANEL → `rr888bd.site` → Settings → **Backend** → **Save**. That re-writes
the systemd unit and starts it. The build is already in place by then.

## Server-side config that is not in git

- `.env.production` — Supabase URL + anon key + service-role key, admin
  username/password. Without the Supabase values the cashier and wallet are
  dead and `/admin` says "ডেটাবেস যুক্ত হয়নি".
- `.data/` — payment numbers, banners, site settings, cashier design, and the
  staff logins with their password hashes. Written by the admin panel, never
  committed. **Do not delete it** — deleting it takes every admin and agent
  login with it (the super admin, being in `.env.production`, survives).
- Supabase migrations are applied by hand in the Supabase SQL editor
  (project `zqhzygmxquhehmxeoljr`). `supabase/005_cashier_v2.sql` is the
  newest and is still pending.

## Rollback

```bash
cd ~/www/rr888bd.site/_node_app
git log --oneline -5
git checkout <good-commit> && npm ci && npm run build
pkill -u "$(id -un)" -f next-server
```
