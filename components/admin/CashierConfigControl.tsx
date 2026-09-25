'use client';

import { useState } from 'react';
import {
  bonusBadge,
  PAY_TYPE_LABEL,
  calculateFeePaisa,
  type AmountPreset,
  type CashierConfig,
  type DepositMethod,
  type PayType,
  type WithdrawMethod,
} from '@/lib/cashier-config';

type Channel = { id: string; name: string };
type Side = 'deposit' | 'withdraw';

const ERROR_LABEL: Record<string, string> = {
  'invalid-method': 'A method name needs at least 2 characters.',
  'invalid-amounts': 'Amount and fee values must be valid numbers within their limits.',
  'invalid-limit': 'Those limits are wrong — the minimum must be below the maximum.',
  'unknown-channel': 'Unknown payment channel.',
  'invalid-pattern': 'That TrxID format (regex) is not valid.',
  'invalid-url': 'The link must start with https://.',
  unauthorized: 'Your session has expired — log in again.',
};

const PAY_TYPES = Object.keys(PAY_TYPE_LABEL) as PayType[];

const DEPOSIT_TEXTS: [keyof CashierConfig['deposit'], string, boolean][] = [
  ['noticeTitle', 'Minimum-deposit notice heading (leave blank to hide the notice)', false],
  ['noticeText', 'Minimum-deposit notice text — {min} and {max} are filled in from the selected method’s limits', true],
  ['methodTitle', 'Method section heading', false],
  ['channelTitle', 'Channel section heading', false],
  ['amountTitle', 'Amount section heading', false],
  ['channelNote', 'Pink note under the channel card', true],
  ['stepHeaderNote', 'Small line in the payment screen header', false],
  ['stepWarning', 'Red warning on the payment screen', true],
  ['walletLabel', 'Wallet number label', false],
  ['howToTitle', 'How to send — heading', false],
  ['howToSteps', 'How to send — steps (one per line; the “Pick the menu above” line is replaced by the method’s menu name)', true],
  ['trxLabel', 'TrxID input label', false],
  ['trxHelpText', 'TrxID help link text', false],
  ['trxHelpUrl', 'TrxID help link (URL; blank makes it toggle the instructions)', false],
  ['trxPlaceholder', 'TrxID input placeholder', false],
  ['trxPattern', 'TrxID format (regex; blank accepts any text)', false],
  ['confirmTitle', 'Confirmation dialog heading', false],
  ['confirmText', 'Confirmation dialog text', true],
  ['cautionTitle', 'Caution block heading', false],
  ['cautionText', 'Caution block text', true],
  ['successTitle', 'Success screen heading', false],
  ['successText', 'Success screen text', true],
  ['promoTitle', 'Promotion section heading (leave blank to drop the section)', false],
  ['promoText', 'Promotion section text', true],
];

const WITHDRAW_TEXTS: [keyof CashierConfig['withdraw'], string, boolean][] = [
  ['processingTime', 'Withdrawal time (e.g. 24 hours)', false],
  ['walletsTitle', 'Saved wallets section heading', false],
  ['reminder', 'Friendly reminder', true],
  ['emptyWalletsText', 'Text shown when there is no wallet', false],
  ['amountLabel', 'Amount section heading', false],
  ['passwordLabel', 'Password field label', false],
  ['passwordHint', 'Hint under the password field', false],
  ['note', 'Note under the button', true],
  ['summaryTitle', 'Withdrawal review heading', false],
  ['rulesTitle', 'Rules box heading', false],
  ['rules', 'Rules — one per line. Start a line with ! to show it in red.', true],
  ['applyLabel', 'Submit button text', false],
];

const blankDeposit = (channelId: string): DepositMethod => ({
  id: '', name: '', channelId, payType: 'transfer', bonusLabel: '', bonusPercent: 0,
  icon: '💳', color: '#0f766e', channelLabel: '', tag: 'GATEWAY', min: 500, max: 30000, trxRequired: true, note: '', active: true,
});

const blankWithdraw = (channelId: string): WithdrawMethod => ({
  id: '', name: '', channelId, icon: '💳', color: '#0f766e', min: 500, max: 50000, accountHint: '01XXXXXXXXX', active: true,
});

function FeeSettingsCard({
  side,
  enabled,
  percent,
  fixed,
  busy,
  onChange,
}: {
  side: 'Deposit' | 'Withdraw';
  enabled: boolean;
  percent: number;
  fixed: number;
  busy: boolean;
  onChange: (patch: { feeEnabled?: boolean; feePercent?: number; feeFixed?: number }) => void;
}) {
  const sample = calculateFeePaisa(100_000, { feeEnabled: true, feePercent: percent, feeFixed: fixed }) / 100;
  return (
    <div className="adm__card">
      <h2 className="adm__cardh">{side} Fee</h2>
      <div className="adm__formgrid">
        <label className="adm__f">
          <span>Automatic fee</span>
          <select value={enabled ? '1' : '0'} disabled={busy} onChange={(e) => onChange({ feeEnabled: e.target.value === '1' })}>
            <option value="1">On</option>
            <option value="0">Off</option>
          </select>
        </label>
        <label className="adm__f">
          <span>Percentage (%)</span>
          <input type="number" min={0} max={100} step="0.01" value={Number.isFinite(percent) ? percent : ''} disabled={busy} onChange={(e) => onChange({ feePercent: Number(e.target.value) })} />
        </label>
        <label className="adm__f">
          <span>Fixed price (৳)</span>
          <input type="number" min={0} max={100000000} step="0.01" value={Number.isFinite(fixed) ? fixed : ''} disabled={busy} onChange={(e) => onChange({ feeFixed: Number(e.target.value) })} />
        </label>
      </div>
      <p className="adm__hint">
        {enabled ? `When enabled, ৳1,000 uses ৳${sample.toFixed(2)} fee (${percent}% + ৳${fixed.toFixed(2)} fixed).` : 'Fee is disabled. Players pay/receive the full amount.'}
        {side === 'Deposit' ? ' The fee is deducted before wallet credit.' : ' The request holds the gross amount and pays the net amount after this fee.'}
      </p>
    </div>
  );
}

export default function CashierConfigControl({ initial, channels }: { initial: CashierConfig; channels: Channel[] }) {
  const [saved, setSaved] = useState(initial);
  const [form, setForm] = useState(initial);
  const [side, setSide] = useState<Side>('deposit');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const setDep = (patch: Partial<CashierConfig['deposit']>) =>
    setForm((f) => ({ ...f, deposit: { ...f.deposit, ...patch } }));
  const setWd = (patch: Partial<CashierConfig['withdraw']>) =>
    setForm((f) => ({ ...f, withdraw: { ...f.withdraw, ...patch } }));

  const patchDepMethod = (i: number, patch: Partial<DepositMethod>) =>
    setDep({ methods: form.deposit.methods.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
  const patchWdMethod = (i: number, patch: Partial<WithdrawMethod>) =>
    setWd({ methods: form.withdraw.methods.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
  const patchAmount = (i: number, patch: Partial<AmountPreset>) =>
    setDep({ amounts: form.deposit.amounts.map((a, j) => (j === i ? { ...a, ...patch } : a)) });

  const move = <T,>(list: T[], i: number, dir: -1 | 1): T[] => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return list;
    const out = [...list];
    [out[i], out[j]] = [out[j], out[i]];
    return out;
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/admin/cashier-config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deposit: form.deposit, withdraw: form.withdraw }),
      });
      const data = (await res.json()) as
        | { ok: true; config: CashierConfig }
        | { ok: false; reason: string; field?: string };
      if (!data.ok) {
        setError((ERROR_LABEL[data.reason] ?? `Something went wrong (${data.reason})`) + (data.field ? ` (${data.field})` : ''));
        return;
      }
      setSaved(data.config);
      setForm(data.config);
      setNotice('Cashier saved — live on the site now.');
    } catch {
      setError('Could not reach the server — try again.');
    } finally {
      setBusy(false);
    }
  }

  const num = (value: number) => (Number.isFinite(value) ? value : '');

  return (
    <form onSubmit={submit}>
      <div className="adm__seg">
        <button type="button" className={side === 'deposit' ? 'on' : ''} onClick={() => setSide('deposit')}>Deposit</button>
        <button type="button" className={side === 'withdraw' ? 'on' : ''} onClick={() => setSide('withdraw')}>Withdraw</button>
      </div>

      {side === 'deposit' && (
        <>
          <div className="adm__card">
            <h2 className="adm__cardh">Deposit Methods</h2>
            <div className="adm__tablewrap" style={{ marginBottom: 6 }}>
              <table className="adm__table adm__table--edit">
                <thead>
                  <tr>
                    <th>Order</th><th>Name</th><th>Channel (number)</th><th>Menu</th><th>Bonus %</th><th>Shown on tile</th>
                    <th>Icon</th><th>Colour</th><th>Channel label</th><th>Tag</th><th>Min</th><th>Max</th><th>TrxID</th><th>Active</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {form.deposit.methods.map((m, i) => (
                    <tr key={i}>
                      <td>
                        <button type="button" className="adm__mini adm__iconbtn" onClick={() => setDep({ methods: move(form.deposit.methods, i, -1) })} aria-label="Move up">↑</button>
                        <button type="button" className="adm__mini adm__iconbtn" onClick={() => setDep({ methods: move(form.deposit.methods, i, 1) })} aria-label="Move down">↓</button>
                      </td>
                      <td><input className="adm__mini" style={{ width: 150 }} value={m.name} disabled={busy} onChange={(e) => patchDepMethod(i, { name: e.target.value })} /></td>
                      <td>
                        <select className="adm__mini" value={m.channelId} disabled={busy} onChange={(e) => patchDepMethod(i, { channelId: e.target.value })}>
                          {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </td>
                      <td>
                        <select className="adm__mini" value={m.payType} disabled={busy} onChange={(e) => patchDepMethod(i, { payType: e.target.value as PayType })}>
                          {PAY_TYPES.map((p) => <option key={p} value={p}>{PAY_TYPE_LABEL[p]}</option>)}
                        </select>
                      </td>
                      <td>
                        <input
                          className="adm__mini" type="number" min={0} max={100} style={{ width: 62 }}
                          value={num(m.bonusPercent)}
                          disabled={busy}
                          onChange={(e) => patchDepMethod(i, { bonusPercent: Number(e.target.value) })}
                        />
                      </td>
                      {/* not an input: the tile says whatever the percent is */}
                      <td>
                        <span className="adm__preview">
                          {bonusBadge(m.bonusPercent) || 'No bonus'}
                        </span>
                      </td>
                      <td><input className="adm__mini" style={{ width: 70 }} value={m.icon} placeholder="🅱️ or /path.png" disabled={busy} onChange={(e) => patchDepMethod(i, { icon: e.target.value })} /></td>
                      <td><input className="adm__mini" type="color" style={{ width: 44, padding: 2 }} value={/^#[0-9a-f]{6}$/i.test(m.color) ? m.color : '#0f766e'} disabled={busy} onChange={(e) => patchDepMethod(i, { color: e.target.value })} /></td>
                      <td><input className="adm__mini" style={{ width: 110 }} value={m.channelLabel} placeholder={m.name || 'Bkash VIP'} disabled={busy} onChange={(e) => patchDepMethod(i, { channelLabel: e.target.value })} /></td>
                      <td><input className="adm__mini" style={{ width: 84 }} value={m.tag} placeholder="GATEWAY" disabled={busy} onChange={(e) => patchDepMethod(i, { tag: e.target.value })} /></td>
                      <td><input className="adm__mini" type="number" min={0} style={{ width: 80 }} value={num(m.min)} disabled={busy} onChange={(e) => patchDepMethod(i, { min: Number(e.target.value) })} /></td>
                      <td><input className="adm__mini" type="number" min={0} style={{ width: 96 }} value={num(m.max)} disabled={busy} onChange={(e) => patchDepMethod(i, { max: Number(e.target.value) })} /></td>
                      <td>
                        <select className="adm__mini" value={m.trxRequired ? '1' : '0'} disabled={busy} onChange={(e) => patchDepMethod(i, { trxRequired: e.target.value === '1' })}>
                          <option value="1">Required</option><option value="0">Optional</option>
                        </select>
                      </td>
                      <td>
                        <select className="adm__mini" value={m.active ? '1' : '0'} disabled={busy} onChange={(e) => patchDepMethod(i, { active: e.target.value === '1' })}>
                          <option value="1">Yes</option><option value="0">Off</option>
                        </select>
                      </td>
                      <td><button type="button" className="adm__mini adm__iconbtn adm__iconbtn--danger" disabled={busy} onClick={() => setDep({ methods: form.deposit.methods.filter((_, j) => j !== i) })} aria-label="Delete">✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {form.deposit.methods.map((m, i) => (
              <label className="adm__f adm__f--wide" key={`note-${i}`} style={{ marginBottom: 8 }}>
                <span>{m.name || `Method ${i + 1}`} — the line shown below once this method is picked</span>
                <input value={m.note} disabled={busy} maxLength={300} onChange={(e) => patchDepMethod(i, { note: e.target.value })} />
              </label>
            ))}
            <button type="button" className="btn btn--ghost" disabled={busy || form.deposit.methods.length >= 20}
                    onClick={() => setDep({ methods: [...form.deposit.methods, blankDeposit(channels[0].id)] })}>
              + Add method
            </button>
            <p className="adm__hint">
              “Menu” tells the player which option to use in the bKash/Nagad app — Payment
              shows a merchant number, Cash Out an agent number, Send Money a personal
              number (if the Payments tab has no number of that kind, any active number
              on the channel is used). The icon takes an emoji or an image link.
            </p>
          </div>

          <div className="adm__card">
            <h2 className="adm__cardh">Amount Chips</h2>
            <div className="adm__tablewrap" style={{ marginBottom: 6 }}>
              <table className="adm__table" style={{ minWidth: 0 }}>
                <thead><tr><th>Amount (৳)</th><th>Bonus badge</th><th></th></tr></thead>
                <tbody>
                  {form.deposit.amounts.map((a, i) => (
                    <tr key={i}>
                      <td><input className="adm__mini" type="number" min={1} style={{ width: 110 }} value={num(a.amount)} disabled={busy} onChange={(e) => patchAmount(i, { amount: Number(e.target.value) })} /></td>
                      <td><input className="adm__mini" style={{ width: 110 }} value={a.bonusLabel} placeholder="+50" disabled={busy} onChange={(e) => patchAmount(i, { bonusLabel: e.target.value })} /></td>
                      <td><button type="button" className="adm__mini adm__iconbtn adm__iconbtn--danger" disabled={busy} onClick={() => setDep({ amounts: form.deposit.amounts.filter((_, j) => j !== i) })} aria-label="Delete">✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className="btn btn--ghost" disabled={busy || form.deposit.amounts.length >= 12}
                    onClick={() => setDep({ amounts: [...form.deposit.amounts, { amount: 0, bonusLabel: '' }] })}>
              + Add chip
            </button>
            <p className="adm__hint">They are sorted low to high on save. A blank badge is not shown.</p>
          </div>

          <FeeSettingsCard
            side="Deposit"
            enabled={form.deposit.feeEnabled}
            percent={form.deposit.feePercent}
            fixed={form.deposit.feeFixed}
            busy={busy}
            onChange={setDep}
          />

          <div className="adm__card">
            <h2 className="adm__cardh">Copy &amp; Instructions</h2>
            <div className="adm__formgrid">
              {DEPOSIT_TEXTS.map(([key, label, long]) => (
                <label className={`adm__f${long ? ' adm__f--wide' : ''}`} key={key}>
                  <span>{label}</span>
                  {long
                    ? <textarea value={String(form.deposit[key])} disabled={busy} onChange={(e) => setDep({ [key]: e.target.value })} />
                    : <input value={String(form.deposit[key])} disabled={busy} onChange={(e) => setDep({ [key]: e.target.value })} />}
                </label>
              ))}
            </div>
          </div>
        </>
      )}

      {side === 'withdraw' && (
        <>
          <div className="adm__card">
            <h2 className="adm__cardh">Withdraw Methods</h2>
            <div className="adm__tablewrap" style={{ marginBottom: 6 }}>
              <table className="adm__table adm__table--edit">
                <thead>
                  <tr><th>Order</th><th>Name</th><th>Channel</th><th>Icon</th><th>Colour</th><th>Min</th><th>Max</th><th>Number hint</th><th>Active</th><th></th></tr>
                </thead>
                <tbody>
                  {form.withdraw.methods.map((m, i) => (
                    <tr key={i}>
                      <td>
                        <button type="button" className="adm__mini adm__iconbtn" onClick={() => setWd({ methods: move(form.withdraw.methods, i, -1) })} aria-label="Move up">↑</button>
                        <button type="button" className="adm__mini adm__iconbtn" onClick={() => setWd({ methods: move(form.withdraw.methods, i, 1) })} aria-label="Move down">↓</button>
                      </td>
                      <td><input className="adm__mini" style={{ width: 130 }} value={m.name} disabled={busy} onChange={(e) => patchWdMethod(i, { name: e.target.value })} /></td>
                      <td>
                        <select className="adm__mini" value={m.channelId} disabled={busy} onChange={(e) => patchWdMethod(i, { channelId: e.target.value })}>
                          {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </td>
                      <td><input className="adm__mini" style={{ width: 70 }} value={m.icon} disabled={busy} onChange={(e) => patchWdMethod(i, { icon: e.target.value })} /></td>
                      <td><input className="adm__mini" type="color" style={{ width: 44, padding: 2 }} value={/^#[0-9a-f]{6}$/i.test(m.color) ? m.color : '#0f766e'} disabled={busy} onChange={(e) => patchWdMethod(i, { color: e.target.value })} /></td>
                      <td><input className="adm__mini" type="number" min={0} style={{ width: 80 }} value={num(m.min)} disabled={busy} onChange={(e) => patchWdMethod(i, { min: Number(e.target.value) })} /></td>
                      <td><input className="adm__mini" type="number" min={0} style={{ width: 96 }} value={num(m.max)} disabled={busy} onChange={(e) => patchWdMethod(i, { max: Number(e.target.value) })} /></td>
                      <td><input className="adm__mini" style={{ width: 120 }} value={m.accountHint} disabled={busy} onChange={(e) => patchWdMethod(i, { accountHint: e.target.value })} /></td>
                      <td>
                        <select className="adm__mini" value={m.active ? '1' : '0'} disabled={busy} onChange={(e) => patchWdMethod(i, { active: e.target.value === '1' })}>
                          <option value="1">Yes</option><option value="0">Off</option>
                        </select>
                      </td>
                      <td><button type="button" className="adm__mini adm__iconbtn adm__iconbtn--danger" disabled={busy} onClick={() => setWd({ methods: form.withdraw.methods.filter((_, j) => j !== i) })} aria-label="Delete">✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className="btn btn--ghost" disabled={busy || form.withdraw.methods.length >= 20}
                    onClick={() => setWd({ methods: [...form.withdraw.methods, blankWithdraw(channels[0].id)] })}>
              + Add method
            </button>
          </div>

          <div className="adm__card">
            <h2 className="adm__cardh">Rules</h2>
            <div className="adm__formgrid">
              <label className="adm__f">
                <span>Withdrawals per day (0 = no limit)</span>
                <input type="number" min={0} max={999} value={num(form.withdraw.dailyLimit)} disabled={busy} onChange={(e) => setWd({ dailyLimit: Number(e.target.value) })} />
              </label>
              <label className="adm__f">
                <span>Max saved wallets per method</span>
                <input type="number" min={1} max={20} value={num(form.withdraw.maxWallets)} disabled={busy} onChange={(e) => setWd({ maxWallets: Number(e.target.value) })} />
              </label>
            </div>
          </div>

          <FeeSettingsCard
            side="Withdraw"
            enabled={form.withdraw.feeEnabled}
            percent={form.withdraw.feePercent}
            fixed={form.withdraw.feeFixed}
            busy={busy}
            onChange={setWd}
          />

          <div className="adm__card">
            <h2 className="adm__cardh">Copy</h2>
            <div className="adm__formgrid">
              {WITHDRAW_TEXTS.map(([key, label, long]) => (
                <label className={`adm__f${long ? ' adm__f--wide' : ''}`} key={key}>
                  <span>{label}</span>
                  {long
                    ? <textarea value={String(form.withdraw[key])} disabled={busy} onChange={(e) => setWd({ [key]: e.target.value })} />
                    : <input value={String(form.withdraw[key])} disabled={busy} onChange={(e) => setWd({ [key]: e.target.value })} />}
                </label>
              ))}
            </div>
          </div>

        </>
      )}

      {error && <p className="adm__err">{error}</p>}
      {notice && <p className="adm__note">{notice}</p>}

      <div className="adm__actions">
        <button type="submit" className="btn btn--gold" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => { setForm(saved); setError(''); setNotice(''); }}>Cancel</button>
      </div>
      {saved.updatedAt && <p className="adm__hint">Last saved: {new Date(saved.updatedAt).toLocaleString('en-GB')}</p>}
    </form>
  );
}
