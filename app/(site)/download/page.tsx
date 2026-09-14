'use client';

import PageHeader from '@/components/PageHeader';
import { usePwaInstall } from '@/components/usePwaInstall';
import { BRAND } from '@/lib/brand';

/** Two things live here: the web app (installed straight from the browser,
    no store, always the current build) and the separate signal APK. */
export default function DownloadPage() {
  const { canInstall, installed, needsIosSteps, install } = usePwaInstall();

  return (
    <>
      <PageHeader title="App Download" />
      <div className="hero">
        <h1>{BRAND.name} App</h1>
        <p>Install it and it opens straight from your home screen</p>
      </div>

      <div className="dl-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="dl-card__icon" src="/icons/icon-192.png" alt="" width={64} height={64} />
        <div className="dl-card__b">
          <b>{BRAND.name} Web App</b>
          <small>Full screen · always up to date · ৳18 bonus on install</small>
        </div>
      </div>

      <div style={{ margin: 12 }}>
        {installed ? (
          <div className="note" style={{ margin: 0 }}>
            ✓ The app is already installed — you are in it right now.
          </div>
        ) : canInstall ? (
          <button className="btn btn--gold btn--block" type="button" onClick={() => void install()}>
            Install the app
          </button>
        ) : needsIosSteps ? (
          <ol className="pwa__ios" style={{ margin: 0 }}>
            <li>Tap the <b>Share</b> button below <span aria-hidden>⬆️</span></li>
            <li>Choose <b>Add to Home Screen</b></li>
            <li>Tap <b>Add</b> — done</li>
          </ol>
        ) : (
          <div className="note" style={{ margin: 0 }}>
            Open the browser menu (⋮) and choose <b>Install app</b> or <b>Add to Home screen</b>.
            Opening the site in Chrome puts the button right here.
          </div>
        )}
      </div>

      <h2 className="sec__title" style={{ margin: '22px 12px 10px' }}>Signal App</h2>
      <div className="wallet-bar">
        {/* the file lives on the server only (public/downloads is gitignored —
            a 50MB APK has no place in the repo); it saves as the app's name */}
        <a className="btn btn--gold" href="/rr888bd.apk" download="rr888bd.apk" style={{ padding: 12 }}>
          Android APK
        </a>
        <span className="btn btn--ghost" style={{ padding: 12, opacity: .55 }}>iOS</span>
      </div>
      <div className="note" style={{ margin: 12 }}>
        After installing the APK, generate an access key in the admin panel under <b>App Keys</b>
        and unlock the app with it. The app then reads signal data from the live server.
      </div>
    </>
  );
}
