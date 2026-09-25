'use client';

import { useEffect, useState } from 'react';
import { toTaka } from '@/lib/auth';
import { money } from '@/lib/brand';
import type { CashierRow, RequestState } from '@/lib/cashier';
import { LOCK_PRESETS } from '@/lib/withdraw-lock';

type Table = 'deposits' | 'withdrawals';

const STATE_TABS: { value: RequestState | 'all'; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

const STATE_LABEL: Record<RequestState, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export default function CashierControl({
  table,
  initialRows,
  initialError = '',
  backendReady,
  canLock = false,
}: {
  table: Table;
  initialRows: CashierRow[];
  /** the first load failed: say so, rather than "no requests" while players wait */
  initialError?: string;
  backendReady: boolean;
  /** withdrawals only: stop the player's withdrawals from the queue */
  canLock?: boolean;
}) {
  const [rows, setRows] = useState(initialRows);
  const [state, setState] = useState<RequestState | 'all'>('pending');
  const [notes, setNotes] = useState<Record<number, string>>({});
  /** the request whose lock box is open, and the reason typed into it */
  const [lockFor, setLockFor] = useState(0);
  const [reason, setReason] = useState('');
  const [busyId, setBusyId] = useState(0);
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  /** what the list on screen was filtered by — the box may have moved on */
  const [applied, setApplied] = useState('');

  const isDeposit = table === 'deposits';

  useEffect(() => {
    if (!backendReady || state !== 'pending') return;
    const timer = setInterval(() => { void load('pending', applied); }, 5000);
    return () => clearInterval(timer);
  }, [backendReady, state, applied]);

  async function load(next: RequestState | 'all', term = applied) {
    setState(next);
    setError('');
    setNotice('');
    try {
      const q = term ? `&search=${encodeURIComponent(term)}` : '';
      const res = await fetch(`/api/admin/cashier?table=${table}&state=${next}${q}`, { cache: 'no-store' });
      const data = (await res.json()) as
        | { ok: true; rows: CashierRow[] }
        | { ok: false; reason: string; message?: string };
      if (!data.ok) {
        setError(data.message ?? `Could not load (${data.reason})`);
        return;
      }
      setRows(data.rows);
      setApplied(term);
    } catch {
      setError('Could not reach the server.');
    }
  }

  async function review(id: number, decision: 'approve' | 'reject' | 'lock') {
    setBusyId(id);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/admin/cashier', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          table, id, decision, note: notes[id] ?? '', reason: decision === 'lock' ? reason : '',
          state, search: applied,
        }),
      });
      const data = (await res.json()) as
        | { ok: true; rows: CashierRow[] }
        | { ok: false; reason: string; message?: string };

      if (!data.ok) {
        setError(data.message ?? `That did not work (${data.reason})`);
        return;
      }
      setRows(data.rows);
      setNotes((n) => ({ ...n, [id]: '' }));
      if (decision === 'lock') {
        setLockFor(0);
        setReason('');
      }
      setNotice(
        decision === 'lock'
          ? 'Player locked and the request turned down — My Account shows them the reason.'
          : decision === 'approve'
          ? isDeposit ? 'Deposit approved — the money is in the player’s balance.'
                      : 'Withdrawal approved — the money is out of the player’s balance.'
          : isDeposit ? 'Deposit rejected.'
                      : 'Withdrawal rejected — anything taken from the player’s balance is back.',
      );
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusyId(0);
    }
  }

  if (!backendReady) {
    return (
      <p className="adm__warn">
        The database is not connected. Put the Supabase keys in <code>.env.local</code> and
        restart the server and this screen starts working — the code is all here.
      </p>
    );
  }

  const pending = rows.filter((r) => r.state === 'pending');
  const total = rows.reduce((sum, r) => sum + r.amount, 0);

  return (
    <>
      <div className="adm__tiles" style={{ marginBottom: 14 }}>
        <div className="adm__tile"><b>{rows.length}</b><small>In this list</small></div>
        <div className="adm__tile"><b>{pending.length}</b><small>Pending</small></div>
        <div className="adm__tile"><b>{money(toTaka(total))}</b><small>Total amount</small></div>
      </div>

      <form
        className="adm__card"
        style={{ marginBottom: 12 }}
        onSubmit={(e) => { e.preventDefault(); void load(state, search.trim()); }}
      >
        <div className="adm__formgrid">
          <label className="adm__f adm__f--wide">
            <span>Search by player ID, phone number or TxnID</span>
            <input
              value={search} autoCapitalize="characters" autoCorrect="off" spellCheck={false}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="100023, 01XXXXXXXXX or a TxnID"
            />
          </label>
        </div>
        <div className="adm__actions">
          <button type="submit" className="btn btn--gold">Search</button>
          {applied && (
            <button type="button" className="btn btn--ghost" onClick={() => { setSearch(''); void load(state, ''); }}>
              Show all
            </button>
          )}
        </div>
        {applied && (
          <p className="adm__hint">
            Showing only requests matching “{applied}”
            {isDeposit ? ' (player ID, phone or TxnID)' : ' (player ID or phone)'}. The tabs below keep this filter.
          </p>
        )}
      </form>

      <div className="adm__seg">
        {STATE_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={state === tab.value ? 'on' : ''}
            onClick={() => void load(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <p className="adm__err">{error}</p>}
      {notice && <p className="adm__note">{notice}</p>}

      <div className="adm__tablewrap">
        <table className="adm__table">
          <thead>
            <tr>
              <th>#</th><th>Player</th><th>Channel</th><th>Amount</th>
              <th>{isDeposit ? 'Sender / TxnID' : 'Paid to account'}</th>
              {!isDeposit && <th>Fee / Payout</th>}
              <th>Time</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={isDeposit ? 8 : 9} className="adm__empty">
                  {isDeposit ? 'No deposit requests.' : 'No withdrawal requests.'}
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const busy = busyId === r.id;
                return (
                  <tr key={r.id}>
                    <td className="adm__muted">{r.id}</td>
                    <td>
                      {r.playerNo && <b style={{ display: 'block' }}>ID {r.playerNo}</b>}
                      {r.phone}
                      {r.displayName && <div className="adm__muted" style={{ fontSize: 11 }}>{r.displayName}</div>}
                    </td>
                    <td>{r.channelId}</td>
                    <td>
                      <b style={{ color: 'var(--gold)' }}>{money(toTaka(r.amount))}</b>
                      {isDeposit && (r.feeAmount ?? 0) > 0 && (
                        <div className="adm__muted" style={{ fontSize: 11 }}>
                          Fee {money(toTaka(r.feeAmount ?? 0))} · Credit {money(toTaka(r.netAmount ?? r.amount))}
                        </div>
                      )}
                    </td>
                    <td>
                      {isDeposit ? (
                        <>
                          <code>{r.senderNo || '—'}</code>
                          {r.txnId && <div className="adm__muted" style={{ fontSize: 11 }}>{r.txnId}</div>}
                        </>
                      ) : (
                        <code>{r.accountNo || '—'}</code>
                      )}
                    </td>
                    {!isDeposit && (
                      <td>
                        <b style={{ color: 'var(--gold)' }}>
                          Fee {money(toTaka(r.feeAmount ?? r.chargeAmount ?? 0))}
                        </b>
                        <div className="adm__muted" style={{ fontSize: 11 }}>
                          Payout {money(toTaka(
                            (r.payoutAmount ?? 0) > 0
                              ? r.payoutAmount!
                              : r.amount - (r.feeAmount ?? r.chargeAmount ?? 0),
                          ))}
                        </div>
                      </td>
                    )}
                    <td className="adm__muted">{when(r.createdAt)}</td>
                    <td>
                      {r.state === 'pending' && <span className="adm__miss">{STATE_LABEL.pending}</span>}
                      {r.state === 'approved' && <span className="adm__ok">{STATE_LABEL.approved}</span>}
                      {(r.state === 'rejected' || r.state === 'cancelled') && (
                        <span className="adm__muted">{STATE_LABEL[r.state]}</span>
                      )}
                      {r.adminNote && (
                        <div className="adm__muted" style={{ fontSize: 10.5 }}>{r.adminNote}</div>
                      )}
                    </td>
                    <td>
                      {r.state === 'pending' && lockFor === r.id ? (
                        <div className="adm__review">
                          <input
                            className="adm__mini" autoFocus maxLength={200}
                            placeholder="Lock reason — the player sees this"
                            value={reason}
                            disabled={busy}
                            onChange={(e) => setReason(e.target.value)}
                          />
                          <select
                            className="adm__mini" value="" disabled={busy}
                            onChange={(e) => e.target.value && setReason(e.target.value)}
                          >
                            <option value="">Pick a reason…</option>
                            {LOCK_PRESETS.map((text) => <option key={text} value={text}>{text}</option>)}
                          </select>
                          <div className="adm__rowacts">
                            <button type="button" className="btn btn--ghost adm__danger" disabled={busy}
                                    onClick={() => void review(r.id, 'lock')}>
                              Lock &amp; turn down
                            </button>
                            <button type="button" className="btn btn--ghost" disabled={busy}
                                    onClick={() => { setLockFor(0); setReason(''); }}>
                              Cancel
                            </button>
                          </div>
                          <span className="adm__muted" style={{ fontSize: 10.5, whiteSpace: 'normal' }}>
                            Turns this request down and stops all their withdrawals until you unlock
                            them at Players. They can still deposit and play.
                          </span>
                        </div>
                      ) : r.state === 'pending' ? (
                        <div className="adm__review">
                          <input
                            className="adm__mini"
                            placeholder="Note (optional)"
                            value={notes[r.id] ?? ''}
                            disabled={busy}
                            onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                          />
                          <div className="adm__rowacts">
                            <button type="button" className="btn btn--gold" disabled={busy}
                                    onClick={() => void review(r.id, 'approve')}>
                              Approve
                            </button>
                            <button type="button" className="btn btn--ghost adm__danger" disabled={busy}
                                    onClick={() => void review(r.id, 'reject')}>
                              Reject
                            </button>
                            {!isDeposit && canLock && (
                              <button type="button" className="btn btn--ghost adm__lock" disabled={busy}
                                      onClick={() => { setLockFor(r.id); setReason(''); }}>
                                Lock
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="adm__muted" style={{ fontSize: 11 }}>{when(r.reviewedAt)}</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function when(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-GB')} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}
