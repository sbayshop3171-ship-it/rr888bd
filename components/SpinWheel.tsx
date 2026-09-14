'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { useBonus } from './useBonus';
import { toTaka } from '@/lib/auth';
import { money } from '@/lib/brand';

/* ============================================================
   The free spin.

   A player who has deposited gets one turn of the wheel, and the
   reference puts it in front of them on the way in rather than
   filing it under a menu — it is the one thing on the site that
   pays for arriving.

   The result is the server's. GO asks /api/bonus/claim, which
   picks the slice, writes the credit and answers with which one
   it was; the wheel then spins to that slice. It never lands
   somewhere and then reports it, because a browser that decides
   its own prize is a browser that can be told to decide better.

   Shown once per session. Somebody who closes it has not lost
   the spin — it is still on the Reward Center — but being asked
   again on every page would be nagging, not an offer.
   ============================================================ */

const SEEN_KEY = 'rr888bd:spin-offered';
const SPIN_MS = 4200;

export default function SpinWheel() {
  const { ready, session } = useAuth();
  const { state, busy, claim } = useBonus();

  const [open, setOpen] = useState(false);
  const [turn, setTurn] = useState(0);
  const [won, setWon] = useState<number | null>(null);

  const wheel = state?.wheel;
  const slices = wheel?.segments ?? [];

  /* Offer it once a session, and only to somebody who can actually take it. */
  useEffect(() => {
    if (!ready || !session || !wheel?.available) return;
    try {
      if (sessionStorage.getItem(SEEN_KEY)) return;
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch { /* private mode — it just gets offered again */ }
    setOpen(true);
  }, [ready, session, wheel?.available]);

  if (!open || slices.length === 0) return null;

  const step = 360 / slices.length;

  const go = async () => {
    if (busy || won !== null) return;
    const reply = await claim('spin');
    if (!reply.ok) {
      setOpen(false);
      return;
    }
    /* Five whole turns, then bring the winning slice under the pointer at
       the top. The slice's own middle is what has to arrive there. */
    const middle = (reply.slot ?? 0) * step + step / 2;
    setTurn(360 * 5 - middle);
    window.setTimeout(() => setWon(reply.amount), SPIN_MS);
  };

  return (
    <>
      <div className="scrim on" onClick={() => won !== null && setOpen(false)} />
      <div className="spin" role="dialog" aria-modal="true" aria-label="Free spin">
        <button type="button" className="spin__x" onClick={() => setOpen(false)} aria-label="Close">×</button>

        <h2 className="spin__h">ফ্রি স্পিন</h2>
        <p className="spin__sub">
          {won === null ? 'ডিপোজিটের জন্য একটি ফ্রি স্পিন — ঘুরিয়ে দেখুন' : 'অভিনন্দন!'}
        </p>

        <div className="spin__wrap">
          <div
            className="spin__wheel"
            style={{
              transform: `rotate(${turn}deg)`,
              transitionDuration: `${SPIN_MS}ms`,
              background: `conic-gradient(${slices
                .map((_, i) => `${i % 2 ? '#fdf1dc' : '#ffffff'} ${i * step}deg ${(i + 1) * step}deg`)
                .join(',')})`,
            }}
          >
            {slices.map((amount, i) => (
              <span
                key={i}
                className="spin__slice"
                style={{ transform: `rotate(${i * step + step / 2}deg)` }}
              >
                <b>৳{amount.toLocaleString('en-IN')}</b>
              </span>
            ))}
          </div>

          <span className="spin__pin" aria-hidden />
          <button
            type="button"
            className="spin__go"
            onClick={() => void go()}
            disabled={busy !== null || won !== null}
          >
            {busy ? '…' : 'GO'}
          </button>
        </div>

        {won !== null ? (
          <>
            <p className="spin__won">{money(toTaka(won))}</p>
            <button type="button" className="spin__claim" onClick={() => setOpen(false)}>Claim</button>
          </>
        ) : (
          <p className="spin__note">যা উঠবে সাথে সাথে আপনার ব্যালেন্সে যোগ হবে।</p>
        )}
      </div>
    </>
  );
}
