'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import CashierHeader from '@/components/CashierHeader';
import { useCashierConfig } from '@/components/useCashierConfig';
import { useUI } from '@/components/UIProvider';
import { useBackLayer } from '@/components/useBackLayer';
import { toPaisa } from '@/lib/auth';
import { money } from '@/lib/brand';
import {
  HOWTO_TILES,
  PAY_TYPE_KINDS,
  PAY_TYPE_LABEL,
  calculateFeePaisa,
  fillTokens,
  bonusBadge,
  isImageIcon,
  type DepositMethod,
} from '@/lib/cashier-config';
import { KIND_LABEL, type PublicDepositAccount } from '@/lib/payment-accounts';
import { PROMOTIONS } from '@/lib/promotions';
import { t } from '@/lib/strings';

type Step = 'pick' | 'pay' | 'done';

/** The one step whose text the method's own menu name replaces. The shipped
    steps have been English and Bangla at different times and the operator may
    have typed either, so match both rather than the language of the day. */
const PICK_MENU_STEPS = ['Pick the menu above', 'উপরের মেনু বেছে নিন'];

const ACCOUNT_KIND_PAY_TYPE: Record<PublicDepositAccount['kind'], Exclude<DepositMethod['payType'], 'transfer'>> = {
  personal: 'sendmoney',
  agent: 'cashout',
  merchant: 'payment',
};

const PAY_TYPE_ACTION: Record<Exclude<DepositMethod['payType'], 'transfer'>, string> = {
  sendmoney: 'SEND MONEY',
  cashout: 'CASH OUT',
  payment: 'PAYMENT',
};

function gatewayName(name: string) {
  return name.replace(/\s+(SEND MONEY|CASH OUT|PAYMENT)$/i, '').trim() || name;
}

/** Three screens, like the cashiers players already know: pick a method and
    an amount → pay into the number shown and type the TrxID → done. Every
    label, method and amount comes from the admin's cashier design. */
export default function DepositPage() {
  /* Deposit wears the same white sheet as withdraw — see the `cz-light`
     block in globals.css. The class is held only while the page is mounted,
     so the rest of the lobby stays dark. */
  useEffect(() => {
    document.body.classList.add('cz-light');
    return () => document.body.classList.remove('cz-light');
  }, []);

  const router = useRouter();
  const { toast } = useUI();
  const { ready, backendReady, session, supabase, refresh } = useAuth();
  const { config, ready: configReady } = useCashierConfig();
  const cfg = config.deposit;

  const methods = useMemo(() => cfg.methods.filter((m) => m.active), [cfg.methods]);
  const channelKeys = useMemo(
    () => [...new Set(methods.map((m) => m.channelId))].sort().join(','),
    [methods],
  );
  const [availableChannels, setAvailableChannels] = useState<Set<string> | null>(null);
  const [checkingAccounts, setCheckingAccounts] = useState(false);
  useEffect(() => {
    if (!configReady) return;
    const channels = channelKeys ? channelKeys.split(',') : [];
    if (channels.length === 0) {
      setAvailableChannels(new Set());
      setCheckingAccounts(false);
      return;
    }

    let live = true;
    setCheckingAccounts(true);
    setAvailableChannels(null);
    void Promise.all(channels.map(async (channel) => {
      try {
        const response = await fetch(
          `/api/deposit/account?channel=${encodeURIComponent(channel)}&available=1`,
          { cache: 'no-store' },
        );
        const data = await response.json() as { available?: boolean };
        return data.available === true ? channel : null;
      } catch {
        return null;
      }
    })).then((found) => {
      if (live) setAvailableChannels(new Set(found.filter((channel): channel is string => Boolean(channel))));
    }).finally(() => {
      if (live) setCheckingAccounts(false);
    });

    return () => { live = false; };
  }, [channelKeys, configReady]);

  const availableMethods = useMemo(
    () => availableChannels === null
      ? methods
      : methods.filter((m) => availableChannels.has(m.channelId)),
    [availableChannels, methods],
  );
  const [methodId, setMethodId] = useState('');
  const method: DepositMethod | undefined = availableMethods.find((m) => m.id === methodId) ?? availableMethods[0];

  const [step, setStep] = useState<Step>('pick');
  const [amount, setAmount] = useState('');
  const [trx, setTrx] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);

  // The phone's Back does what the arrows on this screen do — payment step
  // back to the method list, a dialog or sheet closed — instead of leaving.
  useBackLayer(step === 'pay', () => { setStep('pick'); setErr(''); });
  useBackLayer(confirming, () => setConfirming(false));
  useBackLayer(promoOpen, () => setPromoOpen(false));
  const [howOpen, setHowOpen] = useState(true);
  const [account, setAccount] = useState<PublicDepositAccount | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(false);

  useEffect(() => {
    const requestedAmount = Number(new URLSearchParams(window.location.search).get('amount'));
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) return;
    setAmount(String(requestedAmount));
    setErr('');
  }, []);

  const n = Number(amount);
  const amountOk = Boolean(method) && Number.isFinite(n) && n >= (method?.min ?? 0) && n <= (method?.max ?? 0);
  const grossPaisa = amountOk ? toPaisa(n) : 0;
  const feePaisa = calculateFeePaisa(grossPaisa, cfg);
  const netPaisa = grossPaisa - feePaisa;
  const trxPattern = useMemo(() => {
    try { return cfg.trxPattern ? new RegExp(cfg.trxPattern) : null; } catch { return null; }
  }, [cfg.trxPattern]);
  // stored the way the database stores it (migration 015): letters and
  // digits, upper case — so a space or a lower-case letter is not a new ID
  const trxClean = trx.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const trxShapeOk = trxClean.length >= 6 && trxClean.length <= 20 && !/^(.)\1+$/.test(trxClean)
    && (method?.channelId !== 'bkash' || trxClean.length === 10);
  const trxOk = trxClean.length > 0 && trxShapeOk && (!trxPattern || trxPattern.test(trxClean));

  // One operator number per visit to the pay screen; a re-entry asks again
  // so players spread across the numbers the admin added.
  useEffect(() => {
    if (step !== 'pay' || !method) return;
    let live = true;
    setLoadingAccount(true);
    setAccount(null);
    const kinds = PAY_TYPE_KINDS[method.payType].join(',');
    fetch(`/api/deposit/account?channel=${encodeURIComponent(method.channelId)}&kinds=${kinds}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { ok: true; account: PublicDepositAccount } | null) => {
        if (live) setAccount(data?.ok ? data.account : null);
      })
      .catch(() => { if (live) setAccount(null); })
      .finally(() => { if (live) setLoadingAccount(false); });
    return () => { live = false; };
  }, [step, method]);

  const pickMethod = (m: DepositMethod) => {
    setMethodId(m.id);
    setErr('');
  };

  const next = () => {
    if (!method) return;
    if (!amountOk) {
      setErr(`Enter between ${money(method.min)} and ${money(method.max)} for ${method.name}`);
      return;
    }
    if (feePaisa >= grossPaisa) {
      setErr('The configured deposit fee is greater than this amount. Enter a larger amount or contact support.');
      return;
    }
    if (ready && !session) {
      toast('Log in first to deposit');
      router.push('/login');
      return;
    }
    setErr('');
    setTrx('');
    setStep('pay');
    window.scrollTo({ top: 0 });
  };

  const copyNumber = async () => {
    if (!account) return;
    try {
      await navigator.clipboard.writeText(account.number);
      toast('Number copied');
    } catch {
      toast('Could not copy — write it down');
    }
  };

  const askConfirm = () => {
    if (!method || !account) return;
    if (method.trxRequired && !trxOk) {
      setErr(trxClean ? 'That TrxID format is not right' : 'Enter the TrxID');
      return;
    }
    setErr('');
    setConfirming(true);
  };

  const submit = async () => {
    if (!method) return;
    setConfirming(false);
    if (!backendReady || !session || !supabase) {
      toast('Deposits run from here once a payment gateway is connected');
      return;
    }

    setBusy(true);
    try {
      const response = await fetch('/api/deposit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          user_id: session.user.id,
          amount: toPaisa(n),
          gateway: method.channelId,
          method_id: method.id,
          trxid: trxClean,
          sender_number: null,
        }),
      });
      const data = await response.json() as { ok?: boolean; message?: string; reason?: string };
      if (!response.ok || !data.ok) {
        const message = data.message ?? data.reason ?? '';
        if (/txn used|duplicate/i.test(message)) setErr('এই TrxID আগেই ব্যবহার করা হয়েছে — একই TrxID দুইবার দেওয়া যায় না');
        else if (/txn format|trxid/i.test(message)) setErr('TrxID সঠিক নয় — মেসেজ থেকে পুরো TrxID দেখে লিখুন');
        else if (/too many pending/i.test(message)) setErr('আপনার ৩টি ডিপোজিট অপেক্ষায় আছে — আগে সেগুলো শেষ হোক');
        else setErr(message || 'Could not send the request — try again');
        return;
      }

      setStep('done');
      window.scrollTo({ top: 0 });
      void refresh().catch(() => undefined);
    } catch {
      setErr('Could not reach the server — try again');
    } finally {
      setBusy(false);
    }
  };

  const resubmit = () => {
    setTrx('');
    setErr('');
    setStep('pay');
    window.scrollTo({ top: 0 });
  };

  if (!method) {
    return (
      <>
        <CashierHeader title={t.deposit} historyHref="/deposit-history" direction="in" />
        <div className="note" style={{ margin: 12 }}>
          {!configReady || checkingAccounts
            ? 'Loading…'
            : 'No deposit method has a payment number configured right now. Please contact support.'}
        </div>
      </>
    );
  }

  // {min} / {max} in the admin's notice always read the picked method's own
  // limits, so the line stays true when bank or crypto is selected.
  const limits = { min: money(method.min), max: money(method.max) };

  /* ---------------- step 3: done ---------------- */
  if (step === 'done') {
    return (
      <>
        <div className="cz-top">
          <button type="button" className="cz-top__back" aria-label="Back" onClick={() => setStep('pick')}>‹</button>
          <div>
            <b>BDT {n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b>
            <small>{cfg.stepHeaderNote}</small>
          </div>
        </div>
        <div className="cz-done">
          <span className="cz-done__tick" aria-hidden>✓</span>
          <h2>{cfg.successTitle}</h2>
          <p>{cfg.successText}</p>
          <button type="button" className="btn btn--gold" onClick={resubmit}>TrxID আবার দিন</button>
          <div className="cz-done__links">
            <Link href="/deposit-history">View history</Link>
            <Link href="/">Back to home</Link>
          </div>
        </div>
      </>
    );
  }

  /* ---------------- step 2: pay ---------------- */
  if (step === 'pay') {
    const accountPayType = account ? ACCOUNT_KIND_PAY_TYPE[account.kind] : null;
    const payType = accountPayType ?? method.payType;
    const payLabel = PAY_TYPE_LABEL[payType];
    const gatewayTitle = accountPayType
      ? `${gatewayName(method.name)} ${PAY_TYPE_ACTION[accountPayType]}`
      : method.name;
    const steps = cfg.howToSteps.split('\n').map((s) => s.trim()).filter(Boolean);
    return (
      <>
        <div className="cz-top">
          <button type="button" className="cz-top__back" aria-label="Back" onClick={() => { setStep('pick'); setErr(''); }}>‹</button>
          <div>
            <b>BDT {n.toLocaleString('en-IN')}</b>
            <small>{cfg.stepHeaderNote}</small>
          </div>
        </div>

        <div className="cz-pay">
          {cfg.stepWarning && <p className="cz-warn">{cfg.stepWarning}</p>}

          {cfg.feeEnabled && feePaisa > 0 && (
            <div className="cz-calc">
              <b>Deposit fee summary</b>
              <p><span>Deposit amount</span><b>{money(toPaisa(n))}</b></p>
              <p><span>Fee</span><b>{money(feePaisa)}</b></p>
              <p className="cz-calc__total"><span>Wallet credit</span><b>{money(netPaisa)}</b></p>
            </div>
          )}

          <div className="cz-gate" style={{ background: method.color }}>
            <MethodIcon method={method} size={40} />
            <b>{gatewayTitle}</b>
          </div>

          <div className="cz-label">{cfg.walletLabel}<span>*</span></div>
          {cfg.channelNote && <p className="cz-pink">{cfg.channelNote}</p>}
          {loadingAccount ? (
            <div className="paybox paybox--wait">নাম্বার আনা হচ্ছে…</div>
          ) : account ? (
            <div className="cz-wallet">
              <div className="cz-wallet__row">
                <b>{account.number}</b>
                <button type="button" className="cz-wallet__copy" onClick={copyNumber} aria-label="Copy">⧉</button>
              </div>
              <div className="cz-wallet__meta">
                <span className="paybox__kind">{KIND_LABEL[account.kind]}</span>
                <span>{account.holder}</span>
              </div>
              {account.note && <p className="paybox__note">{account.note}</p>}
            </div>
          ) : (
            <div className="paybox paybox--empty">
              এই মুহূর্তে {method.name} এর কোনো নাম্বার সেট করা নেই। সাপোর্টে যোগাযোগ করুন,
              অথবা অন্য একটি মেথড বেছে নিন।
            </div>
          )}

          {howOpen && (
            <div className="cz-how">
              {method.payType !== 'transfer' && (
                <>
                  <div className="cz-how__tiles">
                    {HOWTO_TILES.map((tile) => (
                      <span key={tile.key} className={`cz-how__tile${tile.key === payType ? ' on' : ''}`}>
                        <i aria-hidden>{tile.glyph}</i>
                        <small>{tile.label}</small>
                      </span>
                    ))}
                  </div>
                  <div className="cz-how__pick">{payLabel}</div>
                </>
              )}
              {method.payType === 'transfer' && cfg.howToTitle && <div className="cz-how__pick">{cfg.howToTitle}</div>}
              {steps.length > 0 && (
                <p className="cz-how__steps">
                  {steps.map((s, i) => (
                    <span key={i}>
                      {i > 0 && <em> → </em>}
                      {PICK_MENU_STEPS.includes(s) ? <b>{payLabel}</b> : s}
                    </span>
                  ))}
                </p>
              )}
            </div>
          )}

          <div className="cz-label">
            {cfg.trxLabel}
            {method.trxRequired && <span>(required)</span>}
          </div>
          {cfg.trxHelpText && (
            cfg.trxHelpUrl
              ? <a className="cz-help" href={cfg.trxHelpUrl} target="_blank" rel="noopener noreferrer">{cfg.trxHelpText}</a>
              : <button type="button" className="cz-help" onClick={() => setHowOpen((v) => !v)}>{cfg.trxHelpText}</button>
          )}
          <input
            className={`cz-trx${trxClean ? (trxOk ? ' ok' : ' bad') : ''}`}
            placeholder={cfg.trxPlaceholder}
            value={trx}
            onChange={(e) => { setTrx(e.target.value); setErr(''); }}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
          />
          {trxClean && (
            <p className={`cz-trx__state${trxOk ? ' ok' : ' bad'}`}>
              {trxOk
                ? '✓ TrxID format looks right'
                : method?.channelId === 'bkash' && trxShapeOk === false && trxClean.length !== 10
                  ? 'বিকাশের TrxID ১০ অক্ষরের হয়'
                  : 'That TrxID format is not right'}
            </p>
          )}
          {err && <p className="cz-err">{err}</p>}

          <div className="cz-next cz-next--inline">
            <button
              type="button"
              className="btn btn--gold btn--block"
              disabled={busy || loadingAccount || !account || (method.trxRequired && !trxOk)}
              onClick={askConfirm}
            >
              {busy ? 'পাঠানো হচ্ছে…' : 'নিশ্চিত'}
            </button>
          </div>

          {(cfg.cautionTitle || cfg.cautionText) && (
            <div className="cz-caution">
              {cfg.cautionTitle && <b>{cfg.cautionTitle}</b>}
              {cfg.cautionText && <p>{cfg.cautionText}</p>}
            </div>
          )}
        </div>

        {confirming && (
          <>
            <div className="scrim on" onClick={() => setConfirming(false)} />
            <div className="modal cz-modal" role="dialog" aria-modal="true">
              <h3>{cfg.confirmTitle}</h3>
              <p>
                {cfg.confirmText}
                {trxClean && <> <b className="cz-modal__trx">{trxClean}</b></>}
              </p>
              <div className="cz-modal__acts">
                <button type="button" className="btn btn--ghost" onClick={() => setConfirming(false)}>বাতিল</button>
                <button type="button" className="btn btn--gold" onClick={submit}>নিশ্চিত</button>
              </div>
            </div>
          </>
        )}
      </>
    );
  }

  /* ---------------- step 1: pick ---------------- */
  return (
    <>
      <CashierHeader title={t.deposit} historyHref="/deposit-history" direction="in" />

      <div className="cz">
        {cfg.noticeTitle && (
          <div className="cz-notice">
            <span className="cz-notice__ico" aria-hidden>⚠</span>
            <div className="cz-notice__body">
              <b>{fillTokens(cfg.noticeTitle, limits)}</b>
              {cfg.noticeText && <p>{fillTokens(cfg.noticeText, limits)}</p>}
            </div>
          </div>
        )}

        <section className="cz-sec">
          <h2 className="cz-sec__h"><i className="cz-dot cz-dot--gold" />{cfg.methodTitle}</h2>
          <div className="cz-methods">
            {methods.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`cz-method${m.payType === 'cashout' || m.payType === 'payment' ? ' cz-method--em' : ''}${m.id === method.id ? ' on' : ''}`}
                onClick={() => pickMethod(m)}
                aria-pressed={m.id === method.id}
              >
                <MethodIcon method={m} size={38} />
                <span className="cz-method__name">{m.name}</span>
                {bonusBadge(m.bonusPercent) && (
                  <span className="cz-method__bonus">{bonusBadge(m.bonusPercent)}</span>
                )}
              </button>
            ))}
          </div>
          {method.note && <p className="cz-note">{method.note}</p>}
        </section>

        <section className="cz-sec">
          {/* the picked method, spelled out in red above the heading — the
              line the reference prints so the channel below is read as
              belonging to the tile that was just tapped */}
          <p className="cz-chtitle">
            {method.channelLabel || method.name}
            {method.tag && <><em>|</em><i>{method.tag}</i></>}
          </p>
          <h2 className="cz-sec__h"><i className="cz-dot cz-dot--mint" />{cfg.channelTitle}</h2>
          <div className="cz-channels">
            <div className="cz-channel on">
              <span>
                {method.channelLabel || method.name}
                {method.tag && <><em>|</em><i>{method.tag}</i></>}
              </span>
            </div>
          </div>
          {cfg.channelNote && <p className="cz-pink">{cfg.channelNote}</p>}
        </section>

        <section className="cz-sec">
          <h2 className="cz-sec__h"><i className="cz-dot cz-dot--gold" />{cfg.amountTitle}</h2>
          <div className="cz-amounts">
            {cfg.amounts.map((a) => (
              <button
                key={a.amount}
                type="button"
                className={`cz-amt${Number(amount) === a.amount ? ' on' : ''}`}
                onClick={() => { setAmount(String(a.amount)); setErr(''); }}
              >
                {a.bonusLabel && <span className="cz-amt__badge">🎁 {a.bonusLabel}</span>}
                <b>{a.amount.toLocaleString('en-IN')}</b>
              </button>
            ))}
          </div>
          <label className="cz-amtin">
            <span>৳</span>
            <input
              type="number" inputMode="numeric" placeholder={String(method.min)}
              value={amount} min={method.min} max={method.max}
              onChange={(e) => { setAmount(e.target.value); setErr(''); }}
            />
          </label>
          <p className="cz-limit">Limit: {money(method.min)} — {money(method.max)}</p>
          {err && <p className="cz-err">{err}</p>}
        </section>

        {cfg.promoTitle && (
          <section className="cz-sec">
            <button type="button" className="cz-sec__h cz-sec__h--btn" onClick={() => setPromoOpen((v) => !v)} aria-expanded={promoOpen}>
              <i className="cz-dot cz-dot--purple" />{cfg.promoTitle}
              <span className={`cz-chev${promoOpen ? ' up' : ''}`} aria-hidden>⌃</span>
            </button>
            {promoOpen && (
              <div className="cz-promos">
                {cfg.promoText && <p>{cfg.promoText}</p>}
                {PROMOTIONS.slice(0, 4).map((p) => (
                  <Link key={p.id} href="/promotions" className="cz-promo">
                    <span aria-hidden>{p.glyph}</span>{p.title}
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <div className="cz-next">
        <button type="button" className="btn btn--gold btn--block" disabled={!amountOk} onClick={next}>
          Next
        </button>
      </div>
    </>
  );
}

function MethodIcon({ method, size }: { method: DepositMethod; size: number }) {
  if (isImageIcon(method.icon)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="cz-icon" src={method.icon} alt="" width={size} height={size} style={{ width: size, height: size }} />;
  }
  return (
    <span className="cz-icon cz-icon--glyph" style={{ width: size, height: size, fontSize: size * 0.55, color: method.color }} aria-hidden>
      {method.icon}
    </span>
  );
}
