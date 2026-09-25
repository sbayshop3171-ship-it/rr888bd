'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';

/** One row of the player's own ledger. Amounts are paisa and signed:
    credits positive, debits negative — exactly as `transactions` stores them. */
export type LedgerRow = {
  id: number;
  kind: 'deposit' | 'withdraw' | 'bet' | 'win' | 'bonus' | 'rebate' | 'adjust';
  amount: number;
  balance_after: number;
  ref: string | null;
  created_at: string;
};

export const KIND_LABEL: Record<LedgerRow['kind'], string> = {
  deposit: 'Deposit',
  withdraw: 'Withdraw',
  bet: 'Bet',
  win: 'Win',
  bonus: 'Bonus',
  rebate: 'Rebate',
  adjust: 'Adjustment',
};

/**
 * The signed-in player's transactions, newest first. RLS scopes the select to
 * their own rows, so no user filter is needed here. `rows` is null until the
 * first load finishes, so screens can tell "loading" from "empty".
 */
export function useLedger(limit = 200) {
  const { ready, session, supabase } = useAuth();
  const [rows, setRows] = useState<LedgerRow[] | null>(null);

  useEffect(() => {
    // signed out (or switched account): drop the last player's rows rather
    // than leave their figures on /refer and /vip for whoever is next
    if (!supabase || !session) { setRows(null); return; }
    let live = true;
    setRows(null);

    void supabase
      .from('transactions')
      .select('id, kind, amount, balance_after, ref, created_at')
      .eq('user_id', session.user.id)
      .order('id', { ascending: false })
      .limit(limit)
      .then((result) => { if (live) setRows((result.data as LedgerRow[] | null) ?? []); });

    return () => { live = false; };
  }, [supabase, session, limit]);

  return { ready, signedIn: ready && Boolean(session), rows };
}

/** Sum of one kind, in paisa (signed as stored). */
export const sumKind = (rows: LedgerRow[], kind: LedgerRow['kind']) =>
  rows.filter((r) => r.kind === kind).reduce((total, r) => total + r.amount, 0);

export const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
