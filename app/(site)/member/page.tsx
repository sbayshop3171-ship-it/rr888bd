'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import LockNotice, { useWithdrawLock } from '@/components/LockNotice';
import PageHeader from '@/components/PageHeader';
import { useUI } from '@/components/UIProvider';
import {
  BankIcon, ChatIcon, CopyIcon, DepositIcon, GiftIcon, LedgerIcon,
  LogoutIcon, MailIcon, PencilIcon, RebateIcon, RecordIcon, RefreshIcon,
  ShieldIcon, SuggestIcon, TargetIcon, TrendIcon, UserIcon, UsersIcon, WithdrawIcon,
} from '@/components/Icons';
import { toTaka } from '@/lib/auth';
import { money } from '@/lib/brand';
import { t } from '@/lib/strings';
import { useLightSheet } from '@/components/useLightSheet';

type Tile = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  /** small count bubble on the icon */
  badge?: number;
};

/* The reference's Member Center, tile for tile and in its order. VIP Club
   and App Download are not on it — they are still reachable from the drawer
   and the home strip, but this grid is the one screen players arrive at
   already knowing, so it matches. */
const TILES: Tile[] = [
  { icon: GiftIcon,     label: 'Reward Center',    href: '/reward' },
  { icon: RecordIcon,   label: 'Betting Record',   href: '/bets-history' },
  { icon: TrendIcon,    label: 'Profit And Loss',  href: '/balance-overview' },
  { icon: DepositIcon,  label: 'Deposit Record',   href: '/deposit-history' },
  { icon: WithdrawIcon, label: 'Withdrawal Record', href: '/withdraw-history' },
  { icon: LedgerIcon,   label: 'Account Record',   href: '/account-statement' },
  { icon: UserIcon,     label: 'My Account',       href: '/my-profile' },
  { icon: ShieldIcon,   label: 'Security Center',  href: '/security' },
  { icon: UsersIcon,    label: 'Invite Friends',   href: '/refer' },
  { icon: TargetIcon,   label: 'Mission',          href: '/promotions' },
  { icon: RebateIcon,   label: 'Rebate',           href: '/turnover' },
  { icon: MailIcon,     label: 'Internal Message', href: '/messages' },
  { icon: SuggestIcon,  label: 'Suggestion',       href: '/suggestion' },
  { icon: ChatIcon,     label: 'Customer Service', href: '/support' },
];

export default function MemberPage() {
  useLightSheet();
  const router = useRouter();
  const { toast } = useUI();
  const { ready, session, profile, wallet, signOut, refresh } = useAuth();
  const [spinning, setSpinning] = useState(false);
  const [mounted, setMounted] = useState(false);
  const lock = useWithdrawLock();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!session && typeof window !== 'undefined') {
      const raw = localStorage.getItem('rr888bd_session');
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed?.user?.id) {
            void refresh();
          }
        } catch {
          // Ignore malformed persisted session data and fall back to guest.
        }
      }
    }
  }, [session, refresh]);

  if (!mounted) return null;

  const signedIn = Boolean(session) || Boolean(localStorage.getItem('rr888bd_session'));
  /* the player ID (migration 012) is the number support asks for; before it
     exists the phone number stands in, as it always did */
  const userId = profile?.player_no ? String(profile.player_no) : profile?.phone ?? '';
  const nickname = profile?.display_name || profile?.phone || 'Player';

  /* Supabase stamps the auth row, and that is the account's real birthday —
     `profiles` has its own created_at but the provider does not load it. */
  const joined = session?.user.created_at
    ? new Date(session.user.created_at).toLocaleDateString('en-CA')
    : null;

  const copyId = async () => {
    if (!userId) return;
    try {
      await navigator.clipboard.writeText(userId);
      toast('ID copied');
    } catch {
      toast('Could not copy');
    }
  };

  const reload = async () => {
    setSpinning(true);
    await Promise.all([refresh(), lock.reload()]);
    // let the turn finish even when the request comes back instantly
    setTimeout(() => setSpinning(false), 600);
  };

  return (
    <div suppressHydrationWarning>
      <PageHeader title="My Account" />

      <div className="mc" suppressHydrationWarning>
        <div className="mc__card">
          {/* the reference hangs the daily sign-in off the card's corner —
              it is the one thing on this screen that pays, so it does not
              wait its turn down in the grid */}
          {!signedIn && (
            <Link href="/reward" className="mc__signin">
              <span aria-hidden>☑</span> Sign In <i aria-hidden>›</i>
            </Link>
          )}

          <div className="mc__top">
            <span className="mc__av" aria-hidden><UserIcon /></span>

            <div className="mc__who">
              <span className="mc__vip">★ VIP{profile?.vip_level ?? 0}</span>

              {signedIn ? (
                <>
                  <div className="mc__id">
                    <b>{userId}</b>
                    <button type="button" onClick={copyId} aria-label="Copy ID">
                      <CopyIcon />
                    </button>
                  </div>
                  <div className="mc__meta">
                    <span>Name: {nickname}</span>
                    <Link href="/my-profile" aria-label="Change name"><PencilIcon /></Link>
                  </div>
                  {joined && <div className="mc__meta">Joined: {joined}</div>}
                </>
              ) : (
                <>
                  <div className="mc__id"><b>Guest</b></div>
                  <div className="mc__meta">Log in to play</div>
                </>
              )}
            </div>
          </div>

          <div className="mc__balrow">
            <b className="mc__bal">{money(toTaka(wallet?.balance ?? 0), 2)}</b>
            {signedIn && (
              <button
                type="button"
                className={`mc__refresh${spinning ? ' is-spin' : ''}`}
                onClick={reload}
                aria-label="Refresh balance"
              >
                <RefreshIcon />
              </button>
            )}
          </div>

          {signedIn ? (
            <div className="mc__acts">
              <Link href="/deposit"><DepositIcon />{t.deposit}</Link>
              <Link href="/withdraw"><WithdrawIcon />{t.withdraw}</Link>
              <Link href="/bank-account"><BankIcon />Bank Account</Link>
            </div>
          ) : (
            <div className="mc__acts">
              <Link href="/login">{t.login}</Link>
              <Link href="/register" className="is-gold">{t.registerNow}</Link>
            </div>
          )}
        </div>

        {signedIn && lock.status?.locked && (
          <LockNotice status={lock.status} onChange={lock.setStatus} />
        )}

          {!lock.status?.locked && <div className="mc__sechd">
              <span>Member Center</span>
          <i aria-hidden />
          </div>}

          {!lock.status?.locked && <div className="mc__grid">
          {TILES.map((tile) => (
            <Link className="mc__tile" key={tile.href + tile.label} href={tile.href}>
              <span className="mc__ico">
                <tile.icon />
                {tile.badge ? <i className="mc__badge">{tile.badge}</i> : null}
              </span>
              <span className="mc__lbl">{tile.label}</span>
            </Link>
          ))}

          {signedIn && (
            <button
              type="button"
              className="mc__tile"
              onClick={async () => { await signOut(); toast('Logged out'); router.push('/'); }}
            >
              <span className="mc__ico"><LogoutIcon /></span>
              <span className="mc__lbl">{t.logout}</span>
            </button>
          )}
        </div>}
      </div>
    </div>
  );
}
