'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useGameGate } from '@/components/GameGate';
import { useUI } from '@/components/UIProvider';
import { toPaisa, toTaka } from '@/lib/auth';
import {
  MAX_STAKE_PAISA,
  MINI_ERROR,
  MIN_STAKE_PAISA,
  randomHex,
  type FlightRoundView,
  type FlightSettled,
  type InstantResult,
  type MiniGameId,
  type MiniReason,
} from '@/lib/mini-games';

const SEED_KEY = 'rr888bd:client-seed';

export const MIN_STAKE = MIN_STAKE_PAISA / 100;
export const MAX_STAKE = MAX_STAKE_PAISA / 100;

/** One past round, kept on the client only — the ledger is the real record. */
export interface Played {
  id: string;
  multiplier: number;
  won: boolean;
}

/**
 * Everything the six game screens share: the player's seed, the stake box,
 * the call to /api/mini-games, and the balance that comes back with the
 * result. The wallet is the seat balance — there is no separate game credit,
 * so every screen reads the same number the cashier does.
 */
export function useMiniGame(game: MiniGameId) {
  const { wallet, refresh } = useAuth();
  const { toast } = useUI();
  /* Anyone may sit and watch the board; the sheet only comes up when they
     reach for the stake. */
  const requireFunds = useGameGate();

  const walletBalance = toTaka(wallet?.balance ?? 0);
  /** what the last settled round said, so the number moves the instant it
      changes rather than a fetch later */
  const [settledBalance, setSettledBalance] = useState<number | null>(null);
  const balance = settledBalance ?? walletBalance;

  /* Auto-bet fires rounds back to back, and a `play` closure captured before
     the previous one settled would still be reading the old balance and the
     old busy flag — it would either refuse a bet the player can afford or let
     two rounds overlap. These two are written the moment the truth changes,
     not on the next render, so a loop always sees the current state. */
  const balanceRef = useRef(balance);
  balanceRef.current = balance;
  const busyRef = useRef(false);

  const [clientSeed, setClientSeed] = useState('');
  const [stake, setStake] = useState(50);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [history, setHistory] = useState<Played[]>([]);

  // a fresh wallet fetch always wins over the cached number
  useEffect(() => { setSettledBalance(null); }, [wallet?.balance]);

  // storage and crypto only exist in the browser
  useEffect(() => {
    try {
      let seed = localStorage.getItem(SEED_KEY);
      if (!seed) { seed = randomHex(8); localStorage.setItem(SEED_KEY, seed); }
      setClientSeed(seed);
    } catch {
      setClientSeed(randomHex(8));
    }
  }, []);

  const newSeed = useCallback(() => {
    const seed = randomHex(8);
    setClientSeed(seed);
    try { localStorage.setItem(SEED_KEY, seed); } catch { /* private window */ }
    toast('A new seed has been created');
  }, [toast]);

  const remember = useCallback((multiplier: number, won: boolean) => {
    setHistory((h) => [{ id: randomHex(4), multiplier, won }, ...h].slice(0, 12));
  }, []);

  const call = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch('/api/mini-games', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ game, clientSeed, ...body }),
    });
    return (await res.json()) as
      | { ok: true; result?: InstantResult; round?: FlightRoundView; settled?: FlightSettled }
      | { ok: false; reason: MiniReason };
  }, [game, clientSeed]);

  /**
   * One instant round. Returns the settled result, or null if it was refused.
   * `bet` overrides the stake box for this round alone — auto-bet walks the
   * stake up and down between rounds without waiting for the box to re-render.
   */
  const play = useCallback(async (
    terms: Record<string, unknown>,
    bet?: number,
  ): Promise<InstantResult | null> => {
    if (busyRef.current) return null;
    if (!requireFunds()) return null;
    const amount = bet ?? stake;
    if (!Number.isFinite(amount) || amount < MIN_STAKE) { setErr(MINI_ERROR['below-minimum']); return null; }
    if (amount > MAX_STAKE) { setErr(MINI_ERROR['above-maximum']); return null; }
    if (amount > balanceRef.current) { setErr(MINI_ERROR['insufficient-balance']); return null; }

    busyRef.current = true;
    setBusy(true);
    setErr('');
    try {
      const data = await call({ action: 'play', stake: toPaisa(amount), ...terms });
      if (!data.ok) { setErr(MINI_ERROR[data.reason] ?? MINI_ERROR['db-error']); return null; }
      const result = data.result!;
      balanceRef.current = toTaka(result.balance);
      setSettledBalance(toTaka(result.balance));
      remember(result.multiplier, result.won);
      void refresh();
      return result;
    } catch {
      setErr(MINI_ERROR['db-error']);
      return null;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [stake, call, remember, refresh, requireFunds]);

  return {
    balance, stake, setStake, busy, setBusy, err, setErr,
    clientSeed, newSeed, history, remember, call, play,
    setSettledBalance, requireFunds,
  };
}
