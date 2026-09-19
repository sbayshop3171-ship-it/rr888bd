'use client';

import { useCallback, useEffect, useState } from 'react';

/** Chrome's install event. It fires once, early — often before React has
    hydrated — so a script in the root layout catches it and parks it on
    `window`; this hook reads it from there. */
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

declare global {
  interface Window {
    __skInstallEvent?: InstallEvent | null;
  }
}

/** fired by the layout script when the browser offers an install */
export const INSTALL_READY_EVENT = 'sk:installable';
/** fired by anything that wants the install sheet opened */
export const INSTALL_OPEN_EVENT = 'sk:install-open';

export const openInstallSheet = () => {
  window.dispatchEvent(new Event(INSTALL_OPEN_EVENT));
};

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  // iOS Safari reports it here instead
  (window.navigator as { standalone?: boolean }).standalone === true;

const isIosSafari = () => {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios && !/CriOS|FxiOS|EdgiOS/.test(ua);
};

export type PwaInstall = {
  /** the browser has an install prompt waiting for us */
  canInstall: boolean;
  /** already running as an installed app */
  installed: boolean;
  /** iOS has no prompt API — the user adds it from the share sheet */
  needsIosSteps: boolean;
  /** shows the browser's own dialog; resolves true when the user accepted */
  install: () => Promise<boolean>;
  /** opens the web app shell from the installed app or home-page CTA */
  openApp: () => void;
};

export function usePwaInstall(): PwaInstall {
  const [canInstall, setCanInstall] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [needsIosSteps, setNeedsIosSteps] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      return;
    }
    setCanInstall(Boolean(window.__skInstallEvent));
    setNeedsIosSteps(isIosSafari());

    const onReady = () => setCanInstall(true);
    const onInstalled = () => {
      window.__skInstallEvent = null;
      setCanInstall(false);
      setInstalled(true);
    };
    window.addEventListener(INSTALL_READY_EVENT, onReady);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener(INSTALL_READY_EVENT, onReady);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    const event = window.__skInstallEvent;
    if (!event) return false;
    await event.prompt();
    const { outcome } = await event.userChoice;
    // the event is single-use, whatever the answer was
    window.__skInstallEvent = null;
    setCanInstall(false);
    return outcome === 'accepted';
  }, []);

  const openApp = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.location.assign('/');
  }, []);

  return { canInstall, installed, needsIosSteps, install, openApp };
}
