'use client';

import Link from 'next/link';
import { BRAND, money } from '@/lib/brand';
import { toTaka } from '@/lib/auth';
import { t } from '@/lib/strings';
import { useAuth } from './AuthProvider';
import { MenuIcon } from './Icons';
import { useUI } from './UIProvider';

export function Wordmark() {
  return (
    <span className="logo__mark">
      <i className="tk">{BRAND.light}</i>
      <i className="num">{BRAND.accent}</i>
    </span>
  );
}

/** Optional suffix for text-only logo fallbacks. */
export function Tagline() {
  return (
    <span className="logo__sub">
      {BRAND.tag}<b>{BRAND.tagAccent}</b>
    </span>
  );
}

export default function Header() {
  const { openDrawer } = useUI();
  const { ready, session, wallet } = useAuth();

  return (
    <header className={`hdr${ready && !session ? ' hdr--guest' : ''}`}>
      <button className="icon-btn" type="button" aria-label="Menu" onClick={openDrawer}>
        <MenuIcon />
      </button>

      <Link href="/" className="logo" aria-label={BRAND.name}>
        <img className="logo__image" src="/rr888bd-logo.png" alt="" />
      </Link>

      <div className="hdr__actions">
        {/* render nothing until the session is known, so the buttons do not flip */}
        {!ready ? null : session ? (
          <Link href="/member" className="bal-pill">
            <b>{money(toTaka(wallet?.balance ?? 0))}</b>
            <i className="av" aria-hidden>👤</i>
          </Link>
        ) : (
          <>
            <Link href="/login" className="btn btn--ghost">{t.login}</Link>
            <Link href="/register" className="btn btn--gold">{t.registerNow}</Link>
          </>
        )}
      </div>
    </header>
  );
}
