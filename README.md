# rr888bd — Gaming Platform

[![CI - Build And Test](https://github.com/sbayshop3171-ship-it/rr888bd/actions/workflows/ci.yml/badge.svg)](https://github.com/sbayshop3171-ship-it/rr888bd/actions/workflows/ci.yml)

Next.js (App Router) + TypeScript plus a Flutter signal APK. Bangla-first, BDT
(৳), mobile-first phone-width column centred on desktop.

New here? Read **[SETUP.md](SETUP.md)** first — it covers both apps in this
repo (the Next.js front-end at the root and the Laravel + Inertia port in
`laravel/`), the local setup steps and the secrets you need from the owner.

For live server setup, read **[DEPLOYMENT.md](DEPLOYMENT.md)**.

Reference build for a client. The design follows a competitor site's layout
and flow; the brand, code, copy and artwork here are our own — no provider or
competitor assets are copied. Game thumbnails are CSS gradients + a glyph on
purpose: real game art belongs to the providers and must be served from their
CDN under licence.

## Run

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
```

## Admin And Signal App

- `/admin` is protected by username/password.
- `/admin/settings` changes the admin password.
- `/admin/aviator-signal` controls the demo signal/round brain.
- `/admin/app-keys` generates device-bound app keys.
- The Flutter APK opens a lock screen first and only reads signal API data after
  a valid app key unlocks the device.

## Layout

```
app/
  layout.tsx          root shell (AppShell + globals.css)
  page.tsx            home
  globals.css         all styling; design tokens in :root
  login/ register/ forgot-password/
  deposit/ withdraw/ deposit-history/ withdraw-history/
  member/ my-profile/ account-statement/ bets-history/
  balance-overview/ turnover/ security/
  promotions/ refer/ reward/ vip/
  casino/ casino/[id]/
  sports/ support/ download/
components/           shared UI (chrome, cards, forms)
lib/
  brand.ts            name, wordmark halves, currency, socials
  strings.ts          every user-facing Bangla string
  catalogue.ts        game data (placeholder → Supabase `games` later)
  payments.ts         deposit/withdraw channels + limits
  promotions.ts       bonus offers + VIP tiers
legacy/               the earlier static HTML build, kept for reference
```

## Re-branding

1. `lib/brand.ts` — `name`, `light` + `accent` (the two wordmark halves),
   `domain`, socials.
2. `app/globals.css` `:root` — `--gold`, `--mint`, `--bg*`, `--surface*`.

Nothing else hard-codes the brand.

## Status

Front-end, demo admin, Aviator signal control, app-key security, and the Flutter
signal APK build clean. Still needs production provider/database work:

- **Real accounts/wallet** — needs Supabase or another database.
- **Licensed games** — needs an aggregator/provider account.
- **Sports odds** — sample fixtures only until a feed is connected.
- **Persistent cloud storage** — current local `.data/` store is best for a VPS
  with persistent disk. Move it to Supabase before using serverless production.

## Note

Demo build. No real payments, no real accounts, no real games. 18+.
