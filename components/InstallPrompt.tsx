'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { BRAND } from '@/lib/brand';
import { INSTALL_OPEN_EVENT, usePwaInstall } from './usePwaInstall';

const SNOOZE_KEY = 'sk_install_snoozed_until';
const SNOOZE_DAYS = 7;
/** let the page settle before covering part of it */
const AUTO_DELAY_MS = 4000;

/** Registers the service worker and offers "Install app".
 *
 * The sheet opens by itself a few seconds into the first visit, and again
 * whenever something calls openInstallSheet() — the app strip on the home
 * page and the download page both do. "Later" hides it for a week.
 */
export default function InstallPrompt() {
  const path = usePathname() ?? '';
  const { canInstall, installed, needsIosSteps, install } = usePwaInstall();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Keep the worker out of local development so a stale offline shell cannot
  // mask a crashed or restarted dev server.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') return;

    if (process.env.NODE_ENV !== 'production') {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => void registration.unregister());
      });
      return;
    }

    const id = window.setTimeout(() => {
      void navigator.serviceWorker.register('/sw.js').catch(() => {
        /* an unsupported or blocked worker just means no install offer */
      });
    }, 1200);
    return () => window.clearTimeout(id);
  }, []);

  // …and never over the staff panel, which sits under the same root layout
  const onGameScreen = path.startsWith('/play/') || path.startsWith('/game/')
    || path.startsWith('/admin') || path.startsWith('/agent');

  const snoozed = useCallback(() => {
    try {
      const until = Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
      return Number.isFinite(until) && until > Date.now();
    } catch {
      return false;
    }
  }, []);

  // open on request, from anywhere on the site
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(INSTALL_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(INSTALL_OPEN_EVENT, onOpen);
  }, []);

  // and once by itself, unless the player said "Later" recently. Never over a
  // game — those screens are the game and nothing else.
  useEffect(() => {
    if (onGameScreen || installed || snoozed()) return;
    if (!canInstall && !needsIosSteps) return;
    const id = window.setTimeout(() => setOpen(true), AUTO_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [canInstall, needsIosSteps, installed, snoozed, onGameScreen]);

  if (installed || !open) return null;

  const close = (snooze: boolean) => {
    setOpen(false);
    if (!snooze) return;
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 864e5));
    } catch {
      /* private mode — it will simply ask again next visit */
    }
  };

  const onInstall = async () => {
    setBusy(true);
    const accepted = await install();
    setBusy(false);
    if (accepted) close(false);
  };

  return (
    <>
      <div className="scrim on" onClick={() => close(true)} />
      <div className="pwa" role="dialog" aria-modal="true" aria-labelledby="pwa-title">
        <button className="pwa__x" type="button" aria-label="Close" onClick={() => close(true)}>×</button>

        <div className="pwa__head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="pwa__icon" src="/icons/icon-192.png?v=rr888bd-app-icon" alt="" width={56} height={56} />
          <div>
            <h2 className="pwa__title" id="pwa-title">{BRAND.name} App</h2>
            <p className="pwa__sub">Add it to your phone’s home screen</p>
          </div>
        </div>

        <ul className="pwa__points">
          <li><span aria-hidden>⚡</span> No browser to open — one tap and you are in</li>
          <li><span aria-hidden>📲</span> Full screen, just like an app</li>
          <li><span aria-hidden>🎁</span> ৳18 bonus on install</li>
        </ul>

        {canInstall ? (
          <button className="btn btn--gold btn--block" type="button" disabled={busy} onClick={onInstall}>
            {busy ? 'Installing…' : 'Install'}
          </button>
        ) : needsIosSteps ? (
          <ol className="pwa__ios">
            <li>Tap the <b>Share</b> button below <span aria-hidden>⬆️</span></li>
            <li>Choose <b>Add to Home Screen</b></li>
            <li>Tap <b>Add</b> — done</li>
          </ol>
        ) : (
          <p className="pwa__note">
            Open the browser menu (⋮) and choose <b>Install app</b> or <b>Add to Home screen</b>.
          </p>
        )}

        <button className="pwa__later" type="button" onClick={() => close(true)}>Later</button>
      </div>
    </>
  );
}
