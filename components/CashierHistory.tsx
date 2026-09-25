'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthProvider';
import Empty from './Empty';
import { CopyIcon } from './Icons';
import { useUI } from './UIProvider';
import { useLightSheet } from './useLightSheet';
import { toTaka } from '@/lib/auth';
import { money } from '@/lib/brand';
import { DEPOSIT_CHANNELS } from '@/lib/payments';

/* ============================================================
   Deposit Record / Withdrawal Record.

   The reference shows one card per request: the channel and when
   it was raised, a block of the request's own detail, and a row
   of four figures underneath — what was asked for, what arrived,
   what the bonus was, and where it stands.

   Every detail the request carries is on the card (the operator
   asked for "full details", 2026-09-12): the number the money
   came from or goes to, the TxnID, the withdrawal charge and its
   TrxID, when it was sent and when it was settled. A line with
   nothing to say shows "—" rather than vanishing.

   Times are the player's own clock. They used to be the raw UTC
   string, six hours behind for everyone in Bangladesh.
   ============================================================ */

type Row = {
  id: number;
  channel_id: string;
  amount: number;
  state: 'pending' | 'approved' | 'rejected' | 'cancelled';
  admin_note: string | null;
  created_at: string;
  reviewed_at?: string | null;
  /** deposits */
  sender_no?: string | null;
  txn_id?: string | null;
  /** deposits, migration 005 */
  bonus_amount?: number | null;
  /** withdrawals */
  account_no?: string | null;
  /** withdrawals, migration 006: the agent cash-out charge and its proof */
  charge_amount?: number | null;
  charge_channel_id?: string | null;
  charge_account_no?: string | null;
  charge_trx_id?: string | null;
  charge_paid_at?: string | null;
};

const STATE_LABEL: Record<Row['state'], string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

type Preset = 'today' | 'yesterday' | '7d';

const dayOf = (d: Date) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

/** "2026-09-11 23:56:49" on this phone's clock. */
const stamp = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${dayOf(d)} ${d.toTimeString().slice(0, 8)}`;
};

const channelName = (id: string | null | undefined) =>
  (id && DEPOSIT_CHANNELS.find((c) => c.id === id)?.name) || id || '—';

/** What the admin typed when they decided. The queue stores it as
    "staffname: text" (or the name alone), and a staff login is nobody's
    business on the player's screen. */
const remark = (note: string | null) => {
  if (!note) return null;
  const at = note.indexOf(': ');
  return at >= 0 ? note.slice(at + 2).trim() || null : null;
};

const shift = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return dayOf(d);
};

const BASE = 'id, channel_id, amount, state, admin_note, created_at';
/* widest first: each later migration added columns, and a database without
   one answers the next select down rather than showing nothing */
const TIERS = {
  deposits: [
    `${BASE}, reviewed_at, sender_no, txn_id, bonus_amount`,
    `${BASE}, reviewed_at, sender_no, txn_id`,
    BASE,
  ],
  withdrawals: [
    `${BASE}, reviewed_at, account_no, charge_amount, charge_channel_id, charge_account_no, charge_trx_id, charge_paid_at`,
    `${BASE}, reviewed_at, account_no`,
    BASE,
  ],
};

export default function CashierHistory({
  table,
  emptyText,
  glyph,
}: {
  table: 'deposits' | 'withdrawals';
  emptyText: string;
  glyph: string;
}) {
  useLightSheet();
  const { ready, backendReady, session, supabase } = useAuth();
  const { toast } = useUI();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [preset, setPreset] = useState<Preset>('today');
  const [state, setState] = useState<'all' | Row['state']>('all');
  const [channel, setChannel] = useState('all');

  useEffect(() => {
    if (!supabase || !session) return;
    let live = true;

    void (async () => {
      for (const cols of TIERS[table]) {
        const { data, error } = await supabase.from(table).select(cols)
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(50);
        if (!live) return;
        if (!error) { setRows((data as unknown as Row[]) ?? []); return; }
      }
      if (live) setRows([]);
    })();

    return () => { live = false; };
  }, [supabase, session, table]);

  const span = useMemo((): [string, string] => {
    if (preset === 'today') return [dayOf(new Date()), dayOf(new Date())];
    if (preset === 'yesterday') return [shift(-1), shift(-1)];
    return [shift(-6), dayOf(new Date())];
  }, [preset]);

  const channels = useMemo(() => {
    const seen = new Set<string>();
    for (const r of rows ?? []) seen.add(r.channel_id);
    return [...seen];
  }, [rows]);

  const shown = useMemo(() => (rows ?? []).filter((r) => {
    const day = dayOf(new Date(r.created_at));
    if (day < span[0] || day > span[1]) return false;
    if (state !== 'all' && r.state !== state) return false;
    if (channel !== 'all' && r.channel_id !== channel) return false;
    return true;
  }), [rows, span, state, channel]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast('কপি হয়েছে');
    } catch {
      toast('কপি করা গেল না');
    }
  };

  const dash = (v: number | null | undefined) =>
    v === null || v === undefined ? '—' : money(toTaka(v), 2);

  const chrome = (
    <>
      <div className="cr__tabs">
        {([['today', 'Today'], ['yesterday', 'Yesterday'], ['7d', '7-days']] as [Preset, string][])
          .map(([key, label]) => (
            <button key={key} type="button" className={preset === key ? 'on' : ''} onClick={() => setPreset(key)}>
              {label}
            </button>
          ))}
      </div>
      <div className="cr__filters">
        <select value={state} onChange={(e) => setState(e.target.value as typeof state)}>
          <option value="all">All</option>
          {(Object.keys(STATE_LABEL) as Row['state'][]).map((s) => (
            <option key={s} value={s}>{STATE_LABEL[s]}</option>
          ))}
        </select>
        {channels.length > 1 && (
          <select value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="all">Types</option>
            {channels.map((c) => (
              <option key={c} value={c}>{channelName(c)}</option>
            ))}
          </select>
        )}
        <span className="cr__span">{span[0].slice(5)} – {span[1].slice(5)}</span>
      </div>
    </>
  );

  if (!ready) return null;

  if (!backendReady || !session) {
    return (
      <>
        {chrome}
        <Empty glyph={glyph} text={emptyText} />
        {backendReady && (
          <div className="note" style={{ margin: 12 }}>
            <Link href="/login">Log in</Link> to see your own records.
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {chrome}
      {rows === null && <Empty glyph={glyph} text="Loading…" />}
      {rows !== null && shown.length === 0 && <Empty glyph={glyph} text="No data" />}

      {shown.map((r) => {
        const isDeposit = table === 'deposits';
        const done = r.state === 'approved';
        const note = remark(r.admin_note);
        const copyable = (value: string | null | undefined) => (value ? (
          <>
            {value}
            <button type="button" onClick={() => copy(value)} aria-label="Copy"><CopyIcon /></button>
          </>
        ) : '—');

        return (
          <article className="cr__card" key={r.id}>
            <header>
              <b>{channelName(r.channel_id).toUpperCase()}</b>
              <time>{stamp(r.created_at)}</time>
            </header>

            <dl className="cr__detail">
              <div><dt>{isDeposit ? 'Deposit' : 'Withdrawal'} ref#</dt><dd>{copyable(String(r.id))}</dd></div>
              <div><dt>Method</dt><dd>{channelName(r.channel_id)}</dd></div>
              {isDeposit ? (
                <>
                  <div><dt>Sent from</dt><dd>{copyable(r.sender_no)}</dd></div>
                  <div><dt>TxnID</dt><dd>{copyable(r.txn_id)}</dd></div>
                  <div><dt>Promotions</dt><dd>{dash(r.bonus_amount)}</dd></div>
                </>
              ) : (
                <>
                  <div><dt>Paid to account</dt><dd>{copyable(r.account_no)}</dd></div>
                  <div><dt>Handling fee</dt><dd>{dash(r.charge_amount)}</dd></div>
                  {Boolean(r.charge_amount) && (
                    <>
                      <div><dt>Fee paid by</dt><dd>{r.charge_channel_id ? channelName(r.charge_channel_id) : '—'}</dd></div>
                      <div><dt>Fee sent to</dt><dd>{copyable(r.charge_account_no)}</dd></div>
                      <div><dt>Fee TxnID</dt><dd>{copyable(r.charge_trx_id)}</dd></div>
                      <div><dt>Fee paid at</dt><dd>{stamp(r.charge_paid_at)}</dd></div>
                    </>
                  )}
                </>
              )}
              <div><dt>Submitted</dt><dd>{stamp(r.created_at)}</dd></div>
              <div>
                <dt>{r.state === 'pending' || done ? (isDeposit ? 'Received time' : 'Paid time') : 'Decided at'}</dt>
                <dd>{r.state === 'pending' ? '—' : stamp(r.reviewed_at)}</dd>
              </div>
              <div><dt>Remarks</dt><dd>{note || '—'}</dd></div>
            </dl>

            <footer className="cr__figs">
              <div><b className="is-req">{money(toTaka(r.amount), 2)}</b><span>Request</span></div>
              <div><b>{done ? money(toTaka(r.amount), 2) : '—'}</b><span>{isDeposit ? 'Received amount' : 'Paid amount'}</span></div>
              {isDeposit
                ? <div><b>{dash(r.bonus_amount)}</b><span>Bonus Amount</span></div>
                : <div><b>{dash(r.charge_amount)}</b><span>Handling fee</span></div>}
              <div>
                <b className={`cr__state cr__state--${r.state}`}>{STATE_LABEL[r.state]}</b>
                <span>Status</span>
              </div>
            </footer>
          </article>
        );
      })}
    </>
  );
}
