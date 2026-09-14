# Prime Signal App

Flutter mobile UI for the demo signal terminal shown in the reference screenshot.

## Screen Breakdown

- Top game switcher: `[ AVIATOR ]` and `[ CRASH ]`
- Glowing brand panel: `RR888BD`, terminal subtitle, active mode badge
- Three stat cards: accuracy, mode, win rate
- Main circular neon gauge with target multiplier, live clock, and signal status
- Auto signal bar, recent rounds chips, and Bangla access status pill

## Access Key

The app opens on a lock screen. Generate an app key in the website admin panel:

```text
/admin/app-keys
```

Unlock binds the key to the local device and stores short-lived API tokens in
secure storage, so the app opens automatically next time until the key/session is
revoked or expired.

## Dynamic Data

The screen reads from `SignalApiClient`. A backend URL and valid unlock token are
required; the snapshot endpoint returns `401` without app access.

Expected endpoint:

```text
GET {SIGNAL_API_BASE_URL}/api/signal-terminal/snapshot?game=aviator
Authorization: Bearer <access_token>
```

Example response:

```json
{
  "game": "aviator",
  "branding": {
    "title": "RR888BD",
    "subtitle": "ENCRYPTED SIGNAL TERMINAL",
    "modeBadge": "MODE: BASS"
  },
  "stats": {
    "accuracy": 60,
    "mode": "AUTO",
    "winRate": 80
  },
  "targetMultiplier": 60.17,
  "timestamp": "2026-09-05T05:25:31Z",
  "signal": {
    "active": true,
    "label": "SIGNAL ACTIVE",
    "auto": true
  },
  "recentRounds": [3.03, 2.38, 1.83, 2.64, 3.02, 2.18],
  "notice": "এক্সেস গ্রান্টেড"
}
```

Local build:

```bash
flutter run --dart-define=SIGNAL_API_BASE_URL=https://rr888bd.site
```

For Android emulator, use `http://10.0.2.2:3000` instead of localhost.
For a physical Xiaomi device with `adb reverse tcp:3000 tcp:3000`, use
`http://127.0.0.1:3000`.

Live APK:

```bash
flutter build apk --release --dart-define=SIGNAL_API_BASE_URL=https://rr888bd.site
```
