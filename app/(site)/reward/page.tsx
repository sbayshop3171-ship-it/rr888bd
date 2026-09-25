'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useBonus } from '@/components/useBonus';
import { useAuth } from '@/components/AuthProvider';
import PageHeader from '@/components/PageHeader';
import { CopyIcon, GiftIcon, MedalIcon, PencilIcon, RefreshIcon, UserIcon, UsersIcon } from '@/components/Icons';
import { useUI } from '@/components/UIProvider';
import { phoneOf, toTaka } from '@/lib/auth';
import { money } from '@/lib/brand';
import { useLightSheet } from '@/components/useLightSheet';

/* ============================================================
   Reward Center.

   The reference's version is a hub, not a list: the same account
   card the member screen carries — with the VIP bar and a way
   into the benefits — over a block of big colour tiles, one per
   thing that pays.

   Three of those five need a payout behind them that we do not
   have yet (a daily check-in, a loss-back fund and a promo code
   to redeem). They are on the board because the board is the
   point, and each says so rather than opening an empty screen:
   a tile that quietly goes nowhere is worse than one that is
   honest about being next.
   ============================================================ */

type Tile = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** the tile's own colour, as the reference gives each one its own */
  tone: string;
  href?: string;
};

const TILES: Tile[] = [
  { key: 'bonus',  label: 'Bonus',          icon: GiftIcon,    tone: 'green', href: '/promotions' },
  { key: 'signin', label: 'Sign In',        icon: MedalIcon,   tone: 'blue' },
  { key: 'rescue', label: 'Rescue fund',    icon: RefreshIcon, tone: 'amber' },
  { key: 'invite', label: 'Invite Friends', icon: UsersIcon,   tone: 'pink', href: '/refer' },
  { key: 'promo',  label: 'Promo Code',     icon: CopyIcon,    tone: 'cyan' },
];

export default function RewardPage() {
  useLightSheet();
  const { ready, session, profile, wallet, refresh } = useAuth();
  const { toast } = useUI();
  const [spinning, setSpinning] = useState(false);
  const { state, busy, claim } = useBonus();
  const [code, setCode] = useState('');
  const [asking, setAsking] = useState(false);

  const signedIn = ready && Boolean(session);
  const loginPhone = profile?.phone || phoneOf(session) || '';
  const userId = loginPhone || (profile?.player_no ? String(profile.player_no) : '');
  const nickname = profile?.display_name || loginPhone || 'Player';
  const level = profile?.vip_level ?? 0;

  const copyId = async () => {
    if (!userId) return;
    try {
      await navigator.clipboard.writeText(userId);
      toast(loginPhone ? 'Phone copied' : 'ID copied');
    } catch {
      toast('Could not copy');
    }
  };

  const reload = async () => {
    setSpinning(true);
    await refresh();
    setTimeout(() => setSpinning(false), 600);
  };

  return (
    <>
      <PageHeader title="Reward Center" />

      <div className="rc">
        <div className="rc__card">
          <Link href="/member" className="mc__signin">
            <span aria-hidden>☑</span> Sign In <i aria-hidden>›</i>
          </Link>

          <div className="rc__top">
            <span className="mc__av" aria-hidden><UserIcon /></span>
            <div className="rc__who">
              {signedIn ? (
                <>
                  <div className="mc__id">
                    <b>{userId}</b>
                    <button type="button" onClick={copyId} aria-label="Copy ID"><CopyIcon /></button>
                  </div>
                  <div className="mc__meta">
                    <span>Nickname: {nickname}</span>
                    <Link href="/my-profile" aria-label="Change name"><PencilIcon /></Link>
                  </div>
                </>
              ) : (
                <div className="mc__id"><b>Guest</b></div>
              )}
              <div className="rc__balrow">
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
            </div>
          </div>

          <div className="rc__vip">
            <span className="rc__vipname"><MedalIcon /> VIP{level}</span>
            <Link href="/vip" className="rc__benefits">Benefits ›</Link>
          </div>
          <div className="rc__bar"><i style={{ width: `${Math.min(level, 1) * 100}%` }} /></div>
          <div className="rc__barnum">{level} / {Math.max(level + 1, 1)}</div>
        </div>

        <div className="rc__grid">
          {TILES.map((tile) => {
            /* Three of the five pay out, and what they pay is the operator's
               to set — so the tile shows the figure the server just worked
               out for this player rather than a number written here. */
            const live =
              tile.key === 'signin' ? state?.signIn
              : tile.key === 'rescue' ? state?.rescue
              : tile.key === 'promo' ? state?.promo
              : null;
            const amount =
              tile.key === 'signin' ? state?.signIn.amount
              : tile.key === 'rescue' ? state?.rescue.amount
              : 0;
            const taken =
              tile.key === 'signin' ? state?.signIn.claimed
              : tile.key === 'rescue' ? state?.rescue.claimed
              : false;

            const inner = (
              <>
                <span className="rc__ico"><tile.icon /></span>
                <b>{tile.label}</b>
                {live && !live.active && <small>Off</small>}
                {live?.active && taken && <small>Claimed</small>}
                {live?.active && !taken && tile.key === 'signin' && (
                  <small>Day {state?.signIn.day} · {money(toTaka(amount ?? 0))}</small>
                )}
                {live?.active && !taken && tile.key === 'rescue' && (
                  <small>{(amount ?? 0) > 0 ? money(toTaka(amount ?? 0)) : 'Nothing yet'}</small>
                )}
                {live?.active && tile.key === 'promo' && <small>Enter code</small>}
              </>
            );

            if (tile.href) {
              return <Link key={tile.key} href={tile.href} className={`rc__tile is-${tile.tone}`}>{inner}</Link>;
            }

            const take = async () => {
              if (!signedIn) { toast('Log in first'); return; }
              if (tile.key === 'promo') { setAsking(true); return; }
              const kind = tile.key === 'signin' ? 'signin' : 'rescue';
              const reply = await claim(kind);
              toast(reply.ok
                ? `${money(toTaka(reply.amount))} added`
                : reply.message ?? 'Could not claim — try again');
              if (reply.ok) void reload();
            };

            return (
              <button
                key={tile.key}
                type="button"
                className={`rc__tile is-${tile.tone}${taken || live?.active === false ? ' is-soon' : ''}`}
                disabled={busy !== null}
                onClick={() => void take()}
              >
                {inner}
              </button>
            );
          })}
        </div>

        {asking && (
          <>
            <div className="scrim on" onClick={() => setAsking(false)} />
            <div className="modal cz-modal" role="dialog" aria-modal="true">
              <h3>Promo code</h3>
              <p>Enter the code you received.</p>
              <label className="cz-field">
                <span>Code</span>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="WELCOME50"
                  autoCapitalize="characters"
                  autoFocus
                />
              </label>
              <div className="cz-modal__acts">
                <button type="button" className="btn btn--ghost" onClick={() => setAsking(false)}>Cancel</button>
                <button
                  type="button"
                  className="btn btn--gold"
                  disabled={busy !== null || code.trim().length === 0}
                  onClick={async () => {
                    const reply = await claim('promo', code.trim());
                    toast(reply.ok
                      ? `${money(toTaka(reply.amount))} added`
                      : reply.message ?? 'Could not use that code — try again');
                    if (reply.ok) { setAsking(false); setCode(''); void reload(); }
                  }}
                >
                  Claim
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
