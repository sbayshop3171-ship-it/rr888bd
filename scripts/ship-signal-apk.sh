#!/usr/bin/env bash
# Build the ARIYAN KHAN signal app and publish it — every installed copy
# (0.2.0+2 and later) then offers the update itself, no cable needed.
#
#   scripts/ship-signal-apk.sh "what changed, in Bangla"      # optional notes
#   FORCE=true scripts/ship-signal-apk.sh "…"                 # no "পরে" button
#
# Raise the build number in mobile/signal_app/pubspec.yaml (the part after +)
# first — the app only offers a build whose number is higher than its own.
set -euo pipefail
cd "$(dirname "$0")/.."

NOTES="${1:-}"
FORCE="${FORCE:-false}"
HOST=mehedi3@5.189.168.13
DIR=www/rr888bd.site/_node_app/public/downloads
PUBLIC_DIR=www/rr888bd.site/_node_app/public

ver=$(grep -m1 '^version:' mobile/signal_app/pubspec.yaml | awk '{print $2}')
name=${ver%%+*}
code=${ver##*+}
echo "building $name (build $code)"

(cd mobile/signal_app && ~/flutter/bin/flutter build apk --release \
  --dart-define=SIGNAL_API_BASE_URL=https://rr888bd.site)
APK=mobile/signal_app/build/app/outputs/flutter-apk/app-release.apk
size=$(stat -c %s "$APK")

rsync -az "$APK" "$HOST:$DIR/ariyan-khan.apk"
rsync -az "$APK" "$HOST:$PUBLIC_DIR/rr888bd.apk"

# ?v= gives each build its own Cloudflare cache entry — it keeps an .apk for hours
json=$(NOTES="$NOTES" FORCE="$FORCE" CODE="$code" NAME="$name" python3 -c '
import json, os
print(json.dumps({
  "versionCode": int(os.environ["CODE"]),
  "versionName": os.environ["NAME"],
  "url": "/downloads/ariyan-khan.apk?v=" + os.environ["CODE"],
  "notes": os.environ["NOTES"],
  "force": os.environ["FORCE"] == "true",
}, ensure_ascii=False))')
printf '%s\n' "$json" | ssh "$HOST" "cat > $DIR/ariyan-khan.json"

echo "offered: $(curl -s https://rr888bd.site/api/signal-terminal/app-version)"
served=$(curl -sI "https://rr888bd.site/downloads/ariyan-khan.apk?v=$code" | awk 'tolower($1)=="content-length:" {print $2}' | tr -d '\r')
if [ "$served" != "$size" ]; then
  echo "the site serves $served bytes, the build is $size — restarting so it picks the file up"
  ssh "$HOST" 'systemctl --user restart rr888bd_site.service'
  sleep 6
  served=$(curl -sI "https://rr888bd.site/downloads/ariyan-khan.apk?v=$code" | awk 'tolower($1)=="content-length:" {print $2}' | tr -d '\r')
fi
[ "$served" = "$size" ] && echo "ok: $size bytes at /downloads/ariyan-khan.apk?v=$code" || { echo "APK size still wrong ($served vs $size)"; exit 1; }
