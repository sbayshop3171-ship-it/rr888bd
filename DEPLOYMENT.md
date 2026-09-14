# Live Server Deployment

This repo contains the Next.js website/admin/signal backend and a Flutter APK
client. The current signal/admin access stores use local JSON files under
`.data/`, so a VPS or hosting with a persistent disk is the safest quick live
option.

## 1. Push To GitHub

```bash
git init
git branch -M main
git remote add origin https://github.com/sbayshop3171-ship-it/rr888bd.git
git add .
git commit -m "Prepare rr888bd live server build"
git push -u origin main
```

GitHub Actions workflow name: `CI - Build And Test`.

After every push, open:

```text
https://github.com/sbayshop3171-ship-it/rr888bd/actions/workflows/ci.yml
```

If both `Web / Next.js` and `Mobile / Flutter APK` are green, the project is
ready to deploy from that commit.

## 2. VPS / Persistent Node Server

Use Node 20+.

```bash
git clone https://github.com/sbayshop3171-ship-it/rr888bd.git
cd rr888bd
cp .env.production.example .env.production
npm ci
npm run build
npm run start
```

The server starts on port `3000`. Put Nginx/Caddy in front of it and enable
HTTPS for your domain.

Required production notes:

- `ADMIN_USERNAME` / `ADMIN_PASSWORD` must be set in `.env.production`. There
  is no default — unset means `/admin` refuses every login. Six wrong guesses
  from one address locks that address out for fifteen minutes.
- Keep `.data/` on persistent disk. It stores the admin session secret, payment
  numbers, banners, site settings, the cashier design, app key hash, device
  bindings and demo round state.
- Do not upload `.env*`, `.data/`, APK signing keys, or `node_modules/`.
- Generate app keys from `/admin/app-keys`.

## 3. Vercel Note

The website can build on Vercel, but the current file-based admin/app-key store
is not durable on serverless hosting. For Vercel production, move these stores
to Supabase/Postgres first:

- `admin-auth-store`
- `signal-app-access-store`
- `aviator-signal-store`

## 4. Flutter APK For Live Domain

Build the APK with your real backend URL:

```bash
cd mobile/signal_app
flutter pub get
flutter build apk --release --dart-define=SIGNAL_API_BASE_URL=https://rr888bd.site
cp build/app/outputs/flutter-apk/app-release.apk ../../apk/rr888bd.apk
```

For local Xiaomi testing from the same machine:

```bash
adb reverse tcp:3000 tcp:3000
flutter build apk --debug --dart-define=SIGNAL_API_BASE_URL=http://127.0.0.1:3000
adb install -r build/app/outputs/flutter-apk/app-debug.apk
```

## 5. Live Checklist

- `/admin` login works.
- `/admin/settings` site settings save and reload.
- `/admin/app-keys` can generate/revoke/reset device access.
- `/api/signal-terminal/snapshot` returns `401` without app token.
- The live APK is served from `/rr888bd.apk` after the GitHub Actions deploy job.
- Flutter app unlocks with app key and then auto-opens signal screen.
- `/game/aviator` and mobile app show matching controlled demo signal rounds.
