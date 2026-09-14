# Developer setup

Two apps live in this one repo:

| Path        | What it is                                             | Status |
|-------------|--------------------------------------------------------|--------|
| `/` (root)  | Next.js 16 + React 19 website, admin and demo signal API | builds clean |
| `mobile/signal_app/` | Flutter signal APK with device-bound app key unlock | builds clean |
| `laravel/`  | Laravel 12 + Inertia + React port (the app being built) | active work happens here |
| `legacy/`   | the original static HTML build                          | reference only, do not edit |

Support mailbox and Supabase account: **tsportscom70@gmail.com**. The support
address is admin-editable at `/admin/settings`; the value above is the
fallback in `lib/brand.ts`.

## Requirements

- PHP 8.4 with the usual Laravel extensions
- Composer 2
- Node 20+
- MySQL 8 (SQLite also works for local dev)
- Flutter 3.24+ and Android Studio/JDK 21 for the APK

## Next.js app (root)

```bash
npm install
cp .env.example .env.local
npm run dev                    # http://localhost:3000
npm run build
```

Admin login comes from the environment and nowhere else. Set
`ADMIN_USERNAME` and `ADMIN_PASSWORD` in `.env.local` (and `.env.production`
on the server), then restart. There is deliberately no default: this
repository is public, so a password in the source would be the admin password
of every deployment that had not overridden it. With `ADMIN_PASSWORD` unset,
`/admin` refuses every login and says so.

Changing either value logs any open admin session out.

That environment account is the **super admin**. Everybody else gets a login
from `/admin/staff`, in one of two roles:

| রোল | কী পারে |
| --- | --- |
| **অ্যাডমিন** | ক্যাশিয়ার, ইউজার (ব্যালেন্স/ব্লক), গেম, ব্যানার, সিগন্যাল। পেমেন্ট নাম্বার শুধু দেখতে পারে |
| **এজেন্ট** | ডিপোজিট-উইথড্র অনুমোদন আর ইউজার দেখা — আর কিছু না |

Payment numbers, app keys, site settings and the staff list itself are super
admin only, so an agent can approve a deposit but can never repoint where the
next one lands. The check is on every `/api/admin/*` route, not just in the
nav — a hidden tab is a courtesy, the 403 is the lock.

Staff passwords are scrypt-hashed in `.data/admin-users-store.json`. The super
admin is deliberately not in that file: a lost or corrupted store can never
lock the operator out of their own panel.

Important admin routes:

- `/admin` dashboard
- `/admin/staff` admin and agent logins (super admin only)
- `/admin/aviator-signal` demo signal brain
- `/admin/app-keys` device-bound APK access keys
- `/admin/settings` site settings (limits, support links, slides)

`SUPABASE_SERVICE_ROLE_KEY` is server-only — never prefix it `NEXT_PUBLIC_`
and never import it into a client component.

## Flutter signal app (`mobile/signal_app/`)

```bash
cd mobile/signal_app
flutter pub get
flutter analyze
flutter test
flutter build apk --debug --dart-define=SIGNAL_API_BASE_URL=http://127.0.0.1:3000
```

For a real live APK, build with the public HTTPS domain:

```bash
flutter build apk --release --dart-define=SIGNAL_API_BASE_URL=https://your-domain.com
```

The app opens locked. Generate an app key from `/admin/app-keys`, paste it into
the APK, and the device becomes bound to that key.

## Laravel app (`laravel/`)

```bash
cd laravel
composer install
cp .env.example .env
php artisan key:generate
```

Then set the DB credentials in `.env`. For MySQL, create the database first:

```sql
CREATE DATABASE rr888bd CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'rr888bd'@'localhost' IDENTIFIED BY 'change-me';
GRANT ALL ON rr888bd.* TO 'rr888bd'@'localhost'; FLUSH PRIVILEGES;
```

For a quicker start, put `DB_CONNECTION=sqlite` in `.env`, delete the other
`DB_*` lines, and `touch database/database.sqlite`.

```bash
php artisan migrate --seed
npm install
composer run dev      # serves Laravel + Vite + queue together
```

Front-end code is Inertia + React under `resources/js/`
(`pages/`, `components/`, `layouts/`, `lib/`). Server routes are in
`routes/web.php`.

`supabase/schema.sql` is the Supabase schema for this app. `.vercelignore`
keeps `laravel/`, `legacy/`, `docs/` and `scripts/` out of the Vercel build.

## Live server

Read `DEPLOYMENT.md`. Quick VPS flow:

```bash
git clone https://github.com/sbayshop3171-ship-it/rr888bd.git
cd rr888bd
cp .env.production.example .env.production
npm ci
npm run build
npm run start
```

## What is NOT in this repo

These are gitignored and have to be supplied separately by the owner:

- `.env.local` (root) — Supabase URL + keys
- `.data/` (root) — local admin/app-key/session/demo-round runtime store
- `laravel/.env` — `APP_KEY`, DB credentials
- anything generated: `node_modules/`, `laravel/vendor/`, `.next/`,
  `laravel/public/build/`

## Re-branding

`lib/brand.ts` (Next.js) and `laravel/resources/js/lib/brand.ts` (Laravel) hold
the name, wordmark halves, domain, support email and socials. Colours are the
`:root` custom properties in the global stylesheet. Nothing else hard-codes the
brand.

## Ground rules

- Read `AGENTS.md` at the repo root and `laravel/CLAUDE.md` before writing code.
- Run `vendor/bin/pint --dirty` after touching PHP.
- Run `php artisan test` before pushing Laravel changes.
- Do not commit `.env` files, real API keys, or provider game assets.
- Game thumbnails are CSS gradients on purpose — real game art belongs to the
  providers and needs a licence.
