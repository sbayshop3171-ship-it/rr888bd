'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import AviatorCanvas from '@/components/aviator/AviatorCanvas';
import BetPanel, { MIN_STAKE, emptySlot, fmtAmt, type Slot } from '@/components/aviator/BetPanel';
import HistoryStrip from '@/components/aviator/HistoryStrip';
import LiveBets from '@/components/aviator/LiveBets';
import { useCrowdCount } from '@/components/aviator/useCrowdCount';
import { useAviatorRound } from '@/components/aviator/useAviatorRound';
import { useAuth } from '@/components/AuthProvider';
import GameGate, { useGameGate } from '@/components/GameGate';
import { MenuIcon, ShieldIcon } from '@/components/Icons';
import PageHeader from '@/components/PageHeader';
import { useUI } from '@/components/UIProvider';
import { BETTING_MS, fmtX, randomHex } from '@/lib/aviator';
import { BET_ERROR, type BetReason } from '@/lib/aviator-bets';
import { toPaisa, toTaka } from '@/lib/auth';
import { money } from '@/lib/brand';

const SEED_KEY = 'rr888bd:client-seed';

export default function AviatorPage() {
  return <GameGate curtain="aviator"><Board /></GameGate>;
}

function Board() {
  const { toast } = useUI();
  const requireFunds = useGameGate();
  const { wallet, refresh } = useAuth();

  /* The seat balance IS the player's wallet — there is no separate game
     credit. Bets are placed and settled by /api/aviator/play, which moves the
     money and then this refetches, so the number on screen is always what the
     ledger says. */
  const balance = toTaka(wallet?.balance ?? 0);
  /** a request is on its way for this seat — per seat, so a bet on one
      never makes a tap on the other do nothing */
  const [busy, setBusy] = useState<[boolean, boolean]>([false, false]);
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const balanceRef = useRef(balance);
  balanceRef.current = balance;
  const gateRef = useRef(requireFunds);
  gateRef.current = requireFunds;
  const [clientSeed, setClientSeed] = useState('');
  /** two independent seats, exactly like the reference game — both open at
      its 10.00 default */
  const [slots, setSlots] = useState<[Slot, Slot]>([emptySlot(10), emptySlot(10)]);

  // storage and crypto only exist on the client
  useEffect(() => {
    try {
      let seed = localStorage.getItem(SEED_KEY);
      if (!seed) { seed = randomHex(8); localStorage.setItem(SEED_KEY, seed); }
      setClientSeed(seed);
    } catch {
      setClientSeed(randomHex(8));
    }
  }, []);

  /* Immersive: while Aviator is open the site chrome (bottom nav, floating
     buttons) is hidden and the column fills the screen, so the game stands
     alone the way the reference lobby opens it. */
  useEffect(() => {
    document.body.classList.add('aviator-immersive');
    return () => document.body.classList.remove('aviator-immersive');
  }, []);

  const patch = useCallback((i: 0 | 1, p: Partial<Slot>) => {
    setSlots((s) => {
      const next: [Slot, Slot] = [{ ...s[0] }, { ...s[1] }];
      next[i] = { ...next[i], ...p };
      return next;
    });
  }, []);

  const slotsRef = useRef(slots);
  slotsRef.current = slots;

  const onCrash = useCallback((crashAt: number) => {
    const lost = slotsRef.current
      .filter((s) => s.staked !== null && s.cashedAt === null)
      .reduce((a, s) => a + (s.staked ?? 0), 0);
    if (lost > 0) toast(`Flew away at ${fmtX(crashAt)} — you lost ${money(lost)}`);

    // clear the round; seats on auto queue themselves up again, and a bet
    // placed mid-flight for the next round must survive this crash — it used
    // to be reset here, so it never reached the betting window it waited for
    setSlots((s) => s.map((x) => ({
      ...x, staked: null, cashedAt: null, queued: x.queued || x.auto,
    })) as [Slot, Slot]);
  }, [toast]);

  const { phase, round, multiplier, bettingLeft, history } = useAviatorRound(clientSeed, onCrash);
  const crowd = useCrowdCount(round?.id, phase);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const setSeatBusy = useCallback((i: 0 | 1, on: boolean) => {
    busyRef.current = (i === 0 ? [on, busyRef.current[1]] : [busyRef.current[0], on]) as [boolean, boolean];
    setBusy(busyRef.current);
  }, []);

  /* Every bet and cash-out goes through the server: it owns the wallet and it
     alone decides what multiplier was actually reached. The screen just asks,
     then refetches the balance from the answer. */
  const send = useCallback(async (
    action: 'bet' | 'cancel' | 'cashout',
    i: 0 | 1,
    stake?: number,
  ) => {
    setSeatBusy(i, true);
    try {
      const res = await fetch('/api/aviator/play', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, slot: i, stake: stake === undefined ? undefined : toPaisa(stake) }),
      });
      const data = (await res.json()) as
        | { ok: true; cashedAt?: number; payout?: number }
        | { ok: false; reason: BetReason };

      // the balance catches up in the background — the seat answers now,
      // not after a second round trip for the wallet
      void refresh();
      if (!data.ok) {
        if (action === 'bet') patch(i, { staked: null, queued: false, cashedAt: null });
        if (action === 'cancel') patch(i, { staked: null, queued: false, cashedAt: null });
        toast(BET_ERROR[data.reason] ?? 'Something went wrong');
        return null;
      }
      return data;
    } catch {
      toast('Could not reach the server');
      return null;
    } finally {
      setSeatBusy(i, false);
    }
  }, [patch, refresh, setSeatBusy, toast]);

  // Restore a live seat from the server after a round transition or a reload.
  // This closes the small window where a successful debit can arrive while
  // the local crash animation is clearing its optimistic state.
  useEffect(() => {
    const roundId = round?.id;
    if (!roundId) return;
    let alive = true;
    void fetch('/api/aviator/play', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data: { ok?: boolean; roundId?: number; bets?: { slot: 0 | 1; roundId: number; stake: number; cashedAt: number | null; settled: boolean }[] }) => {
        if (!alive || !data.ok || data.roundId !== roundId) return;
        setSlots((current) => current.map((slot, index) => {
          const bet = data.bets?.find((item) => item.slot === index && !item.settled);
          return bet
            ? { ...slot, stake: toTaka(bet.stake), staked: toTaka(bet.stake), cashedAt: bet.cashedAt, queued: false }
            : slot;
        }) as [Slot, Slot]);
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [round?.id]);

  // queued seats go live the moment the next betting window opens
  useEffect(() => {
    if (phase !== 'betting') return;

    slotsRef.current.forEach((slot, i) => {
      if (!slot.queued && !slot.auto) return;
      if (slot.staked !== null) return;
      if (slot.stake < MIN_STAKE || slot.stake > balance) {
        patch(i as 0 | 1, { queued: false });
        return;
      }
      void send('bet', i as 0 | 1, slot.stake).then((res) => {
        patch(i as 0 | 1, res
          ? { staked: slot.stake, cashedAt: null, queued: false }
          : { queued: false });
      });
    });
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const cashOut = useCallback(async (i: 0 | 1) => {
    const slot = slotsRef.current[i];
    if (slot.staked === null || slot.cashedAt !== null) return;


    // Claim the seat straight away so a fast second tap — or the auto
    // cash-out firing on the next frame — cannot send two requests.
    patch(i, { cashedAt: 0 });

    const res = await send('cashout', i);
    if (!res) {
      patch(i, { cashedAt: null });
      return;
    }

    const m = res.cashedAt ?? 0;
    patch(i, { cashedAt: m });
    if (m > 0) toast(`You have cashed out! ${fmtX(m)} — ${money(toTaka(res.payout ?? 0))}`);
  }, [patch, send, toast]);

  /* The red Cancel: a seat waiting for the next round just stops waiting; a
     stake already placed on the open round goes back through the server,
     which refunds it while the betting window is still open. */
  const cancel = useCallback(async (i: 0 | 1) => {
    const slot = slotsRef.current[i];
    if (slot.staked === null) {
      patch(i, { queued: false, auto: false });
      return;
    }
    if (busyRef.current[i]) return;
    const res = await send('cancel', i);
    if (res) patch(i, { staked: null, cashedAt: null, queued: false, auto: false });
  }, [patch, send]);

  // auto cash-out, checked per seat
  useEffect(() => {
    if (phase !== 'flying') return;
    slots.forEach((s, i) => {
      if (s.staked === null || s.cashedAt !== null) return;
      const target = Number(s.autoAt);
      if (Number.isFinite(target) && target > 1 && multiplier >= target) {
        void cashOut(i as 0 | 1);
      }
    });
  }, [phase, multiplier, slots, cashOut]);

  /* The seat turns red the instant it is tapped and the server is asked
     behind it; a refusal puts it back to green with the reason. Waiting for
     the answer before changing the button is what made taps feel dead. */
  const place = useCallback(async (i: 0 | 1) => {
    if (busyRef.current[i]) return;      // this seat's request is already out
    if (!gateRef.current()) return;      // watching is free; staking is not
    const slot = slotsRef.current[i];
    if (slot.stake < MIN_STAKE) { toast(`Minimum bet is ${money(MIN_STAKE)}`); return; }
    if (slot.stake > balanceRef.current) { toast('Not enough balance'); return; }

    if (phaseRef.current !== 'betting') {
      patch(i, { queued: true });
      toast('Your bet goes on the next round');
      return;
    }

    patch(i, { staked: slot.stake, cashedAt: null, queued: false });
    const res = await send('bet', i, slot.stake);
    if (!res) patch(i, { staked: null });
  }, [patch, send, toast]);

  return (
    <>
      <PageHeader
        title={<img className="av-wordmark" src="/games/aviator/wordmark.png" alt="Aviator" />}
        action={
          <>
            {/* the board's header: green figure, "BDT" after it, a menu glyph
                on the far right — the balance is a link into the cashier */}
            <Link href="/deposit" className="av-bal" title="Deposit">
              <b>{fmtAmt(balance)}</b><span>BDT</span>
            </Link>
            <Link href="/game/aviator/fairness" className="icon-btn av-menu" aria-label="Game menu">
              <MenuIcon />
            </Link>
          </>
        }
      />

      <div className="av-skin">
      <HistoryStrip history={history} />

      <AviatorCanvas
        phase={phase}
        multiplier={multiplier}
        bettingLeft={bettingLeft}
        bettingTotal={BETTING_MS}
        players={crowd}
      />

      <div className="av-slots">
        {([0, 1] as const).map((i) => (
          <BetPanel
            key={i}
            index={i}
            slot={slots[i]}
            phase={phase}
            multiplier={slots[i].staked !== null && slots[i].cashedAt === null ? multiplier : 1}
            balance={balance}
            busy={busy[i]}
            onPatch={patch}
            onPlace={place}
            onCancel={cancel}
            onCashOut={cashOut}
          />
        ))}
      </div>

      {/* the table only compares against two-decimal targets, so it redraws
          when the figure crosses a hundredth, not on every frame */}
      <LiveBets phase={phase} multiplier={Math.floor(multiplier * 100) / 100} players={crowd} roundId={round?.id} />

      {/* the board's foot: the fairness link on the left, the maker on the right */}
      <footer className="av-foot">
        <Link href="/game/aviator/fairness"><ShieldIcon /> Provably Fair Game</Link>
        <span>Powered by <b>SPRIBE</b></span>
      </footer>
      </div>
    </>
  );
}
