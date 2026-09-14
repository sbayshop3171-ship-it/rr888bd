#!/usr/bin/env bash
#
# Production deploy, run on the server from the app root.
#
#   ~/apps/rr888bd/laravel/deploy.sh
#
# Assumes the code is already on the box (rsync or git pull) and that
# .env carries the real APP_KEY and database credentials. Front-end assets
# are built on the developer's machine and shipped in public/build, because
# the box has Node 20 and the build toolchain wants Node 22+.
set -euo pipefail

cd "$(dirname "$0")"

echo "==> composer"
composer install --no-dev --optimize-autoloader --no-interaction

echo "==> database"
php artisan migrate --force

echo "==> caches"
php artisan config:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache

echo "==> storage"
[ -L public/storage ] || php artisan storage:link
chmod -R ug+rwX storage bootstrap/cache

if [ ! -d public/build ]; then
  echo "!! public/build is missing — run 'npm run build' locally and rsync it up" >&2
  exit 1
fi

echo "==> done"
php artisan about --only=environment
