'use client';

import { useMemo, useState } from 'react';
import {
  KIND_LABEL,
  MAX_PER_CHANNEL,
  USE_HELP,
  USE_LABEL,
  type PaymentAccount,
  type PaymentAccountInput,
} from '@/lib/payment-accounts';

type Channel = { id: string; name: string; glyph: string; art: string };

const ERROR_LABEL: Record<string, string> = {
  forbidden: 'You are not allowed to change payment numbers — ask the super admin.',
  'channel-full': `A channel can hold at most ${MAX_PER_CHANNEL} numbers.`,
  'duplicate-number': 'That number is already on this channel.',
  'invalid-number': 'That number is not valid — it must be 4 to 64 characters.',
  'invalid-holder': 'Enter the account name (at least 2 characters).',
  'unknown-channel': 'That channel was not recognised.',
  'not-found': 'Account not found — refresh the page.',
  unauthorized: 'Your session has expired — log in again.',
};

const BLANK = (channelId: string): PaymentAccountInput => ({
  channelId,
  number: '',
  holder: '',
  kind: 'personal',
  use: 'deposit',
  note: '',
  status: 'active',
  weight: 1,
});

export default function PaymentAccountsControl({
  channels,
  initialAccounts,
  canWrite,
}: {
  channels: Channel[];
  initialAccounts: PaymentAccount[];
  /** false for an admin or agent: the numbers are readable, not editable.
      The API refuses the write too — this only keeps the screen honest. */
  canWrite: boolean;
}) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [form, setForm] = useState<PaymentAccountInput>(BLANK(channels[0].id));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const perChannel = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of accounts) counts[a.channelId] = (counts[a.channelId] ?? 0) + 1;
    return counts;
  }, [accounts]);

  const activeCount = accounts.filter((a) => a.status === 'active').length;
  const channelsCovered = channels.filter((c) => (perChannel[c.id] ?? 0) > 0).length;
  const full = !editingId && (perChannel[form.channelId] ?? 0) >= MAX_PER_CHANNEL;

  async function send(body: Record<string, unknown>, okMessage: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/admin/payment-accounts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as
        | { ok: true; accounts: PaymentAccount[] }
        | { ok: false; reason: string };

      if (!data.ok) {
        setError(ERROR_LABEL[data.reason] ?? `Something went wrong (${data.reason})`);
        return false;
      }
      setAccounts(data.accounts);
      setNotice(okMessage);
      return true;
    } catch {
      setError('Could not reach the server — try again.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ok = editingId
      ? await send({ action: 'update', id: editingId, ...form }, 'Account updated.')
      : await send({ action: 'add', ...form }, 'New account added.');

    if (ok) {
      setForm(BLANK(form.channelId));
      setEditingId(null);
    }
  }

  function edit(account: PaymentAccount) {
    setEditingId(account.id);
    setError('');
    setNotice('');
    setForm({
      channelId: account.channelId,
      number: account.number,
      holder: account.holder,
      kind: account.kind,
      use: account.use,
      note: account.note,
      status: account.status,
      weight: account.weight,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(BLANK(form.channelId));
    setError('');
    setNotice('');
  }

  const set = <K extends keyof PaymentAccountInput>(key: K, value: PaymentAccountInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <>
      <div className="adm__tiles" style={{ marginBottom: 14 }}>
        <div className="adm__tile"><b>{accounts.length}</b><small>Accounts</small></div>
        <div className="adm__tile"><b>{activeCount}</b><small>Active</small></div>
        <div className="adm__tile"><b>{channelsCovered}/{channels.length}</b><small>Channels covered</small></div>
        <div className="adm__tile"><b>{MAX_PER_CHANNEL}</b><small>Max per channel</small></div>
      </div>

      {!canWrite && (
        <p className="adm__note" style={{ marginBottom: 14 }}>
          These numbers are read-only — only the super admin can add, edit or delete
          them.
        </p>
      )}

      {canWrite && (
      <form className="adm__card" onSubmit={submit}>
        <h2 className="adm__cardh">
          {editingId ? 'Edit account' : 'Add a new account'}
        </h2>

        <div className="adm__formgrid">
          <label className="adm__f">
            <span>Channel</span>
            <select
              value={form.channelId}
              onChange={(e) => set('channelId', e.target.value)}
              disabled={busy}
            >
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({perChannel[c.id] ?? 0}/{MAX_PER_CHANNEL})
                </option>
              ))}
            </select>
          </label>

          <label className="adm__f">
            <span>Number / account</span>
            <input
              value={form.number}
              onChange={(e) => set('number', e.target.value)}
              placeholder="01XXXXXXXXX"
              inputMode="text"
              disabled={busy}
            />
          </label>

          <label className="adm__f">
            <span>Account name</span>
            <input
              value={form.holder}
              onChange={(e) => set('holder', e.target.value)}
              placeholder="e.g. rr888bd Agent 1"
              disabled={busy}
            />
          </label>

          <label className="adm__f">
            <span>Kind</span>
            <select value={form.kind} onChange={(e) => set('kind', e.target.value as PaymentAccountInput['kind'])} disabled={busy}>
              {Object.entries(KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>

          <label className="adm__f">
            <span>Used for</span>
            <select value={form.use} onChange={(e) => set('use', e.target.value as PaymentAccountInput['use'])} disabled={busy}>
              {Object.entries(USE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <em className="adm__hint">{USE_HELP[form.use]}</em>
          </label>

          <label className="adm__f">
            <span>Weight (1-10)</span>
            <input
              type="number" min={1} max={10}
              value={form.weight}
              onChange={(e) => set('weight', Number(e.target.value))}
              disabled={busy}
            />
          </label>

          <label className="adm__f">
            <span>Status</span>
            <select value={form.status} onChange={(e) => set('status', e.target.value as PaymentAccountInput['status'])} disabled={busy}>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>

          <label className="adm__f adm__f--wide">
            <span>Note (optional — players see it)</span>
            <input
              value={form.note}
              onChange={(e) => set('note', e.target.value)}
              placeholder="e.g. Use Send Money, not Cash Out"
              disabled={busy}
            />
          </label>
        </div>

        {full && (
          <p className="adm__warn" style={{ margin: '0 0 10px' }}>
            This channel already holds {MAX_PER_CHANNEL} numbers. Delete one before adding another.
          </p>
        )}
        {error && <p className="adm__err">{error}</p>}
        {notice && <p className="adm__note">{notice}</p>}

        <div className="adm__actions">
          <button type="submit" className="btn btn--gold" disabled={busy || full}>
            {editingId ? 'Update' : 'Add'}
          </button>
          {editingId && (
            <button type="button" className="btn btn--ghost" onClick={cancelEdit} disabled={busy}>
              Cancel
            </button>
          )}
        </div>

        <p className="adm__hint">
          A higher weight sends more players to that number. Give every number the same
          weight and the traffic splits evenly.
        </p>
      </form>
      )}

      <div className="adm__tablewrap">
        <table className="adm__table">
          <thead>
            <tr>
              <th>Channel</th><th>Number</th><th>Name</th><th>Kind</th>
              <th>Used for</th><th>Weight</th><th>Hits</th><th>Status</th>{canWrite && <th></th>}
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={canWrite ? 9 : 8} className="adm__empty">
                  No accounts yet — add one with the form above.
                </td>
              </tr>
            ) : (
              accounts.map((a) => {
                const channel = channels.find((c) => c.id === a.channelId);
                return (
                  <tr key={a.id}>
                    <td>{channel?.name ?? a.channelId}</td>
                    <td><code>{a.number}</code></td>
                    <td>{a.holder}</td>
                    <td>{KIND_LABEL[a.kind]}</td>
                    <td>{USE_LABEL[a.use]}</td>
                    <td>{a.weight}</td>
                    <td>{a.usageCount}</td>
                    <td>
                      {a.status === 'active'
                        ? <span className="adm__ok">Active</span>
                        : <span className="adm__miss">Disabled</span>}
                    </td>
                    {canWrite && (
                    <td className="adm__rowacts">
                      <button type="button" className="btn btn--ghost" onClick={() => edit(a)} disabled={busy}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        disabled={busy}
                        onClick={() => send(
                          { action: 'update', ...a, status: a.status === 'active' ? 'disabled' : 'active' },
                          a.status === 'active' ? 'Account disabled.' : 'Account enabled.',
                        )}
                      >
                        {a.status === 'active' ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost adm__danger"
                        disabled={busy}
                        onClick={() => send({ action: 'remove', id: a.id }, 'Account deleted.')}
                      >
                        Delete
                      </button>
                    </td>
                    )}
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
