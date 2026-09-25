'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import CashierHeader from '@/components/CashierHeader';
import LockNotice, { useWithdrawLock } from '@/components/LockNotice';
import EmptyWalletArt from '@/components/EmptyWalletArt';
import { useCashierConfig } from '@/components/useCashierConfig';
import { useUI } from '@/components/UIProvider';
import { useBackLayer } from '@/components/useBackLayer';
import { toPaisa, toTaka } from '@/lib/auth';
import { money } from '@/lib/brand';
import { readAccessToken, readSession, readStoredUser } from '@/lib/supabase';
import {
  chargeBase,
  fillTokens,
  isImageIcon,
  withdrawCharge,
  type DepositMethod,
  type WithdrawMethod,
} from '@/lib/cashier-config';
import type { PublicDepositAccount } from '@/lib/payment-accounts';
import { DEPOSIT_CHANNELS } from '@/lib/payments';
import { t } from '@/lib/strings';

type Wallet = { id: number; channel_id: string; account_no: string; holder: string };

/** The raised request, snapshotted the moment it leaves the form, so the
    summary and the charge read the figures the player agreed to. */
type Raised = {
  id: number | null;
  amount: number;
  account: string;
  balance: number;
  charge: number;
};

type Step = 'form' | 'summary' | 'pay' | 'done';

/** Four screens. Pick a method, a saved wallet and an amount → read the
    summary of what the withdrawal will cost → cash the agent charge out to
    the number shown and hand back its TrxID → done. Every label, rule and
    the charge rate itself come from the admin's cashier design. */
export default function WithdrawPage() {
  /* The withdraw flow is the one white screen on a dark site, and its `cz-`
     classes are shared with deposit — so the skin is a body class held for
     as long as this page is mounted, the same way a game claims the chrome. */
  useEffect(() => {
    document.body.classList.add('cz-light');
    return () => document.body.classList.remove('cz-light');
  }, []);

  const { toast } = useUI();
  const { ready, backendReady, session, wallet, supabase, refresh } = useAuth();
  const { config, ready: configReady } = useCashierConfig();
  // locked (migration 013): the form gives way to the notice and its appeal
  const lock = useWithdrawLock();
  const cfg = config.withdraw;

  const methods = useMemo(() => cfg.methods.filter((m) => m.active), [cfg.methods]);
  const [methodId, setMethodId] = useState('');
  const method: WithdrawMethod | undefined = methods.find((m) => m.id === methodId) ?? methods[0];

  // The charge is cashed out to us, so it is paid the same way a deposit is:
  // through a method the admin marked as a cash-out in the deposit design.
  const chargeMethods = useMemo(() => {
    const active = config.deposit.methods.filter((m) => m.active);
    const cashout = active.filter((m) => m.payType === 'cashout');
    return cashout.length ? cashout : active.filter((m) => m.payType !== 'transfer');
  }, [config.deposit.methods]);
  const [chargeMethodId, setChargeMethodId] = useState('');
  const chargeMethod: DepositMethod | undefined =
    chargeMethods.find((m) => m.id === chargeMethodId) ?? chargeMethods[0];

  const [wallets, setWallets] = useState<Wallet[] | null>(null);
  // false once the payout_accounts table turns out to be missing (migration
  // 005 not applied yet) — the screen then takes the number inline
  const [walletsSupported, setWalletsSupported] = useState(true);
  const [walletId, setWalletId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [newNo, setNewNo] = useState('');
  const [newHolder, setNewHolder] = useState('');
  const [inlineNo, setInlineNo] = useState('');
  const [todayCount, setTodayCount] = useState(0);
  /** taka in requests still waiting — the wallet keeps it until an admin
      approves (migration 014), so it is not available to ask for again */
  const [waiting, setWaiting] = useState(0);
  const [amount, setAmount] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  // Whether the player has set a fund password in the Security Center
  // (migration 010). Until they do, this box keeps asking for the login
  // password exactly as it always has, so nobody is locked out by the change.
  const [hasTxnPassword, setHasTxnPassword] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const [step, setStep] = useState<Step>('form');
  // the phone's Back from the summary returns to the form, as its arrow does;
  // after the request is raised there is nothing to go back into
  useBackLayer(step === 'summary', () => { setStep('form'); setErr({}); });
  const [raised, setRaised] = useState<Raised | null>(null);
  const [agent, setAgent] = useState<PublicDepositAccount | null>(null);
  const [loadingAgent, setLoadingAgent] = useState(false);
  const [chargeTrx, setChargeTrx] = useState('');

  const persistedUser = readStoredUser() as { id?: string } | null;
  const persistedUserId = session?.user.id ?? persistedUser?.id ?? null;
  const balance = toTaka(wallet?.balance ?? 0);
  const signedIn = Boolean(session) || Boolean(readSession()) || Boolean(readAccessToken()) || Boolean(persistedUserId);
  const forMethod = (wallets ?? []).filter((w) => method && w.channel_id === method.channelId);
  const picked = forMethod.find((w) => w.id === walletId) ?? forMethod[0];
  const available = Math.max(0, balance - waiting);
  const remaining = cfg.dailyLimit > 0 ? Math.max(0, cfg.dailyLimit - todayCount) : null;

  // What the player will owe on top of the request. It never leaves the
  // wallet — the admin collects it against the TrxID — so every screen only
  // has to state it plainly and keep it in step with the amount box.
  const typed = Number(amount);
  const typedOk = Number.isFinite(typed) && typed > 0;
  const previewBase = chargeBase(cfg.chargeBasis, typedOk ? typed : 0, balance);
  const previewCharge = withdrawCharge(previewBase, cfg.chargePerThousand);
  const chargeOn = cfg.chargePerThousand > 0;

  const loadWallets = useCallback(async () => {
    const userId = session?.user.id ?? persistedUserId;
    if (!supabase || !userId) return;
    const { data, error } = await supabase
      .from('payout_accounts')
      .select('id, channel_id, account_no, holder')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (error) {
      setWalletsSupported(false);
      setWallets([]);
      return;
    }
    setWallets((data as Wallet[]) ?? []);
  }, [supabase, session]);

  const loadToday = useCallback(async () => {
    const userId = session?.user.id ?? persistedUserId;
    if (!supabase || !userId) return;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from('withdrawals')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      // counted the way the server counts: a rejected request is not one used
      .in('state', ['pending', 'approved'])
      .gte('created_at', start.toISOString());
    setTodayCount(count ?? 0);

    // before 014 there is no `debited` column: the error leaves this at 0,
    // which is right, since every request then took its money at once
    const { data: open, error } = await supabase
      .from('withdrawals')
      .select('amount')
      .eq('user_id', userId)
      .eq('state', 'pending')
      .eq('debited', false);
    setWaiting(error ? 0 : toTaka(((open as { amount: number }[] | null) ?? []).reduce((sum, r) => sum + Number(r.amount), 0)));
  }, [supabase, session]);

  useEffect(() => {
    void loadWallets();
    void loadToday();
  }, [loadWallets, loadToday]);

  useEffect(() => {
    if (!supabase || !persistedUserId) return;
    let live = true;
    void supabase.rpc('has_transaction_password')
      .then(({ data }) => { if (live) setHasTxnPassword(data === true); });
    return () => { live = false; };
  }, [supabase, persistedUserId]);

  // One agent number per visit to the charge screen, from the numbers the
  // admin marked "Withdraw" for that channel.
  useEffect(() => {
    if (step !== 'pay' || !chargeMethod) return;
    let live = true;
    setLoadingAgent(true);
    setAgent(null);
    /* side=withdraw so the charge lands on the number the admin designated
       for it at /admin/payments, not on whichever deposit till came up. */
    const url = `/api/deposit/account?side=withdraw&channel=${encodeURIComponent(chargeMethod.channelId)}`;
    const pick = async () => {
      for (const query of [`${url}&kinds=agent`, url]) {
        const res = await fetch(query, { cache: 'no-store' }).catch(() => null);
        if (res?.ok) {
          const data = (await res.json()) as { ok: true; account: PublicDepositAccount };
          if (data?.ok) return data.account;
        }
      }
      return null;
    };
    void pick()
      .then((found) => { if (live) setAgent(found); })
      .finally(() => { if (live) setLoadingAgent(false); });
    return () => { live = false; };
  }, [step, chargeMethod]);

  const addWallet = async () => {
    const userId = session?.user.id ?? persistedUserId;
    if (!method || !supabase || !userId) return;
    const no = newNo.replace(/[\s-]+/g, '');
    if (no.length < 4) { setErr({ add: 'Enter a valid number' }); return; }
    if (forMethod.length >= cfg.maxWallets) { setErr({ add: `You can keep up to ${cfg.maxWallets} wallets` }); return; }
    if (forMethod.some((wallet) => wallet.account_no === no)) {
      setErr({ add: 'That number is already saved' }); return;
    }
    setBusy(true);
    let error: { message: string } | null = null;
    try {
      ({ error } = await supabase.from('payout_accounts').insert({
        user_id: userId,
        channel_id: method.channelId,
        account_no: no,
        holder: newHolder.trim().slice(0, 60),
      }));
    } catch (caught) {
      error = { message: caught instanceof Error ? caught.message : 'Could not add it' };
    }
    setBusy(false);
    if (error) {
      setErr({ add: /duplicate|unique/i.test(error.message) ? 'That number is already saved' : 'Could not add it — try again' });
      return;
    }
    setErr({});
    setNewNo('');
    setNewHolder('');
    setAdding(false);
    await loadWallets();
    toast('E-wallet added');
  };

  const removeWallet = async (id: number) => {
    if (!supabase) return;
    const userId = session?.user.id ?? persistedUserId ?? '';
    const { error } = await supabase.from('payout_accounts').delete()
      .eq('id', id).eq('user_id', userId);
    if (error) { toast('Could not remove it'); return; }
    if (walletId === id) setWalletId(null);
    await loadWallets();
  };

  /* ---------------- step 1 → 2: check everything, then show the summary --- */
  const review = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!method) return;

    const accountNo = walletsSupported ? picked?.account_no ?? '' : inlineNo.replace(/[\s-]+/g, '');
    const next: Record<string, string> = {};
    if (!accountNo) next.account = walletsSupported ? 'Add an e-wallet first' : 'Enter an account number';
    const n = Number(amount);
    if (!Number.isFinite(n) || n < method.min) next.amount = `Minimum ${money(method.min)}`;
    else if (n > method.max) next.amount = `Up to ${money(method.max)} in a single request`;
    if (session && n > available) {
      next.amount = waiting > 0
        ? `Available ${money(available)} — ${money(waiting)} is in a request still waiting`
        : `Your balance is ${money(balance)}`;
    }
    if (remaining !== null && remaining <= 0) next.amount = 'Today’s withdrawal limit is used up — try again tomorrow';
    // bonus money is bet before it can leave (the database refuses otherwise)
    const owed = (wallet?.turnover_need ?? 0) - (wallet?.turnover_done ?? 0);
    if (owed > 0) next.amount = `Bonus turnover first: bet ${money(toTaka(owed))} more, then you can withdraw`;
    if (!password) next.password = cfg.passwordHint || 'Enter your password';
    setErr(next);
    if (Object.keys(next).length) return;

    if (!backendReady) {
      toast('Withdrawals start working once the processing backend is connected');
      return;
    }
    if (!session || !supabase) {
      setErr({ amount: 'Log in first to withdraw' });
      return;
    }

    // Re-checked here so a borrowed phone cannot empty the wallet. If the
    // player has set a transaction password in the Security Center it is that
    // one; otherwise it falls back to the login password, which is what this
    // box asked for before migration 010.
    setBusy(true);
    const ok = hasTxnPassword
      ? (await supabase.rpc('verify_transaction_password', { p_password: password })).data === true
      : !(await supabase.auth.signInWithPassword({ email: session.user.email ?? '', password })).error;
    setBusy(false);
    if (!ok) {
      setErr({ password: 'Wrong password' });
      return;
    }

    setRaised({
      id: null,
      amount: n,
      account: accountNo,
      balance,
      charge: withdrawCharge(chargeBase(cfg.chargeBasis, n, balance), cfg.chargePerThousand),
    });
    setStep('summary');
    window.scrollTo({ top: 0 });
  };

  /* ---------------- step 2 → 3: raise the request ------------------------ */
  const apply = async () => {
    if (!method || !raised || !supabase) return;
    setBusy(true);

    /* request_withdrawal debits the wallet inside the same statement that
       raises the request, so the amount cannot be gambled away while it waits
       in the queue. A rejection puts it back. */
    // Raised through our own route: it holds the method's min/max and the
    // daily count from the cashier config, which the database cannot see.
    // The database then checks the password again, the hold/ban, bonus
    // turnover and the balance — so none of it rests on this screen.
    let reply: { ok?: boolean; id?: number | null; message?: string; reason?: string } = {};
    try {
      const res = await fetch('/api/withdraw/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          methodId: method.id,
          amount: raised.amount,
          accountNo: raised.account,
          password,
        }),
      });
      reply = await res.json();
    } catch {
      reply = { ok: false, message: 'Could not reach the server — try again' };
    }
    setBusy(false);

    if (!reply.ok) {
      setErr({ apply: reply.message ?? 'Could not send the request — try again' });
      // locked since the page opened: swap the form for the notice
      if (reply.reason === 'account-locked') void lock.reload();
      return;
    }

    const id = typeof reply.id === 'number' ? reply.id : null;
    setRaised({ ...raised, id });
    setErr({});
    setPassword('');
    await refresh();
    void loadToday();

    // Nothing more to pay: skip the charge screen entirely.
    if (!chargeOn || raised.charge <= 0) {
      setStep('done');
      window.scrollTo({ top: 0 });
      return;
    }
    /* The charge is quoted by the server from the cashier config — the
       browser only says which withdrawal and which channel. */
    if (id !== null) {
      await quoteCharge(id, { channelId: chargeMethod?.channelId });
    }
    setStep('pay');
    window.scrollTo({ top: 0 });
  };

  /* The charge and the proof both go through our own route rather than
     straight at the database: the figure is worked out server-side from the
     cashier config, so the browser never gets to say what it owes. */
  const quoteCharge = async (
    id: number,
    extra: { channelId?: string; trxId?: string },
  ): Promise<{ ok: boolean; message?: string }> => {
    try {
      const res = await fetch('/api/withdraw/charge', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, ...extra }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string };
      return { ok: Boolean(data?.ok), message: data?.message };
    } catch {
      return { ok: false };
    }
  };

  /* ---------------- step 3 → 4: hand back the charge TrxID --------------- */
  const confirmCharge = async () => {
    if (!raised) return;
    const trx = chargeTrx.trim();
    if (!trx) { setErr({ trx: 'The TrxID is required!' }); return; }

    setBusy(true);
    // no id, nowhere to attach the TrxID — say so rather than show "done"
    const saved = raised.id === null
      ? { ok: false }
      : await quoteCharge(raised.id, {
        channelId: chargeMethod?.channelId,
        trxId: trx,
      });
    setBusy(false);

    if (!saved.ok) {
      setErr({ trx: saved.message ?? 'Could not submit the TrxID — try again' });
      return;
    }
    // the TrxID is when the amount leaves the wallet (migration 016)
    await refresh();
    setErr({});
    setStep('done');
    window.scrollTo({ top: 0 });
  };

  const restart = () => {
    setAmount('');
    setPassword('');
    setChargeTrx('');
    setRaised(null);
    setAgent(null);
    setErr({});
    setStep('form');
    window.scrollTo({ top: 0 });
  };

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast(`${label} copied`);
    } catch {
      toast('Could not copy — write it down');
    }
  };

  if (lock.status?.locked) {
    return (
      <>
        <CashierHeader title={t.withdraw} historyHref="/withdraw-history" direction="out" />
        <LockNotice status={lock.status} onChange={lock.setStatus} />
        <p className="note" style={{ margin: 12 }}>
          আপনার অ্যাকাউন্ট পর্যালোচনা শেষ না হওয়া পর্যন্ত উইথড্র করা যাবে না। আপিল গৃহীত হলে এই পেজে আবার উইথড্র করতে পারবেন।
        </p>
      </>
    );
  }

  if (!method) {
    return (
      <>
        <CashierHeader title={t.withdraw} historyHref="/withdraw-history" direction="out" />
        <div className="note" style={{ margin: 12 }}>
          {configReady ? 'No withdraw method is active right now. Please contact support.' : 'Loading…'}
        </div>
      </>
    );
  }

  const tokens = {
    rate: money(cfg.chargePerThousand),
    min: money(method.min),
    max: money(method.max),
    time: cfg.processingTime,
    charge: money(raised?.charge ?? previewCharge),
    balance: money(raised?.balance ?? balance),
    amount: money(raised?.amount ?? (typedOk ? typed : 0)),
  };

  /* ---------------- step 4: done ---------------- */
  if (step === 'done' && raised) {
    return (
      <>
        <CashierHeader title={t.withdraw} historyHref="/withdraw-history" direction="out" />
        <div className="cz-done">
          <span className="cz-done__tick" aria-hidden>✓</span>
          <h2>Request submitted!</h2>
          <p>
            Your request to send {money(raised.amount)} to {method.name} ({raised.account}) has been submitted.
            {raised.charge > 0 && chargeTrx.trim()
              ? ` Once the charge TrxID (${chargeTrx.trim()}) is verified the money arrives within ${cfg.processingTime}.`
              : ` Once an admin approves it, the money arrives within ${cfg.processingTime}.`}
          </p>
          <button type="button" className="btn btn--gold" onClick={restart}>Another withdrawal</button>
          <div className="cz-done__links">
            <Link href="/withdraw-history">View history</Link>
            <Link href="/">Back to home</Link>
          </div>
        </div>
      </>
    );
  }

  /* ---------------- step 3: pay the agent charge ---------------- */
  if (step === 'pay' && raised) {
    const guide = cfg.guideLines.split('\n').map((l) => l.trim()).filter(Boolean);
    return (
      <>
        <div className="cz-top cz-top--pay">
          <div>
            <b>BDT {raised.charge.toLocaleString('en-IN')}</b>
            <small>{cfg.payTitle}</small>
          </div>
          <span className="cz-top__tag">PAY</span>
        </div>

        <div className="cz-pay">
          {cfg.payWarning && <p className="cz-warn">{cfg.payWarning}</p>}

          {chargeMethods.length > 1 && (
            <div className="cz-tabs scroll-x" role="tablist">
              {chargeMethods.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={m.id === chargeMethod?.id}
                  className={`cz-tab${m.id === chargeMethod?.id ? ' on' : ''}`}
                  onClick={() => { setChargeMethodId(m.id); setErr({}); }}
                >
                  <MethodIcon method={m} size={30} />
                  <span>{m.name}</span>
                </button>
              ))}
            </div>
          )}

          {chargeMethod && (
            <div className="cz-gate" style={{ background: chargeMethod.color }}>
              <MethodIcon method={chargeMethod} size={40} />
              <b>{channelName(chargeMethod.channelId)} এজেন্ট চার্জ</b>
            </div>
          )}

          <div className="cz-label">এজেন্ট নাম্বার<span>*</span></div>
          {cfg.agentNote && <p className="cz-sub">{cfg.agentNote}</p>}
          {loadingAgent ? (
            <div className="paybox paybox--wait">নাম্বার আনা হচ্ছে…</div>
          ) : agent ? (
            <div className="cz-wallet">
              <div className="cz-wallet__row">
                <b>{agent.number}</b>
                <button type="button" className="cz-wallet__copy" onClick={() => void copy(agent.number, 'Number')} aria-label="Copy">⧉</button>
              </div>
              {agent.holder && <div className="cz-wallet__meta"><span>{agent.holder}</span></div>}
            </div>
          ) : (
            <div className="paybox paybox--empty">
              এই মুহূর্তে কোনো এজেন্ট নাম্বার সেট করা নেই। সাপোর্টে যোগাযোগ করুন — আপনার
              রিকোয়েস্টটি জমা আছে, বাতিল হয়নি।
            </div>
          )}

          <div className="cz-label">চার্জের পরিমাণ<span>*</span></div>
          {cfg.chargeExactNote && <p className="cz-sub">{cfg.chargeExactNote}</p>}
          <div className="cz-wallet cz-wallet--gold">
            <div className="cz-wallet__row">
              <b>{money(raised.charge)}</b>
              <button type="button" className="cz-wallet__copy" onClick={() => void copy(String(raised.charge), 'Charge')} aria-label="Copy">⧉</button>
            </div>
          </div>

          {(cfg.guideTitle || guide.length > 0) && (
            <div className="cz-guide">
              {cfg.guideTitle && <b>ⓘ {cfg.guideTitle}</b>}
              <ul>
                {guide.map((line, i) => <li key={i}>{fillTokens(line, tokens)}</li>)}
              </ul>
            </div>
          )}

          <p className="cz-meta">
            উত্তোলন: <b>{money(raised.amount)}</b> · আগের ব্যালেন্স: <b>{money(raised.balance)}</b>
          </p>

          <div className="cz-label">
            {cfg.chargeTrxLabel}
            <span>(required)</span>
          </div>
          <input
            className={`cz-trx${chargeTrx.trim() ? ' ok' : ''}`}
            placeholder={cfg.chargeTrxPlaceholder}
            value={chargeTrx}
            onChange={(e) => { setChargeTrx(e.target.value); setErr({}); }}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
          />
          {err.trx && <p className="cz-err">{err.trx}</p>}

          <div className="cz-next cz-next--inline">
            <button type="button" className="btn btn--gold btn--block" disabled={busy} onClick={() => void confirmCharge()}>
              {busy ? 'পাঠানো হচ্ছে…' : 'নিশ্চিত'}
            </button>
          </div>

          {cfg.chargeCaution && (
            <div className="cz-caution">
              <b>সতর্কতাঃ</b>
              <p>{cfg.chargeCaution}</p>
            </div>
          )}
        </div>
      </>
    );
  }

  /* ---------------- step 2: the summary ---------------- */
  if (step === 'summary' && raised) {
    const rules = cfg.rules.split('\n').map((l) => l.trim()).filter(Boolean);
    const base = chargeBase(cfg.chargeBasis, raised.amount, raised.balance);
    return (
      <>
        <div className="cz-top cz-top--pay">
          <button type="button" className="cz-top__back" aria-label="Back" onClick={() => { setStep('form'); setErr({}); }}>‹</button>
          <div>
            <b>BDT {raised.amount.toLocaleString('en-IN')}</b>
            <small>{cfg.summaryTitle}</small>
          </div>
          <span className="cz-top__tag">PAY</span>
        </div>

        <div className="cz-pay">
          {cfg.summaryWarning && <p className="cz-warn">{cfg.summaryWarning}</p>}

          <div className="cz-gate" style={{ background: method.color }}>
            <MethodIcon method={method} size={40} />
            <b>{method.name}</b>
          </div>

          <div className="cz-label">অ্যাকাউন্ট নাম্বার<span>*</span></div>
          <p className="cz-sub">এই নাম্বারেই আপনার উত্তোলনের টাকা পাঠানো হবে</p>
          <div className="cz-ro">{raised.account}</div>

          <div className="cz-label">উত্তোলনের পরিমাণ</div>
          <div className="cz-ro cz-ro--gold">{money(raised.amount)}</div>

          {chargeOn && raised.charge > 0 && (
            <>
              <div className="cz-label cz-label--warn">⚠ {cfg.chargeLabel}<span>*</span></div>
              <p className="cz-sub">
                {money(base)} × ({money(cfg.chargePerThousand)}/৳1,000) = {money(raised.charge)}
              </p>
              <div className="cz-ro cz-ro--red">{money(raised.charge)}</div>
            </>
          )}

          {rules.length > 0 && (
            <div className="cz-rules">
              {cfg.rulesTitle && <b>📋 {cfg.rulesTitle}</b>}
              <ol>
                {rules.map((line, i) => {
                  const red = line.startsWith('!');
                  return (
                    <li key={i} className={red ? 'red' : undefined}>
                      {fillTokens(red ? line.slice(1) : line, tokens)}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {chargeOn && raised.charge > 0 && (
            <div className="cz-calc">
              <b>🧮 চার্জের হিসাব</b>
              <p><span>{cfg.chargeBasis === 'balance' ? 'আপনার ব্যালেন্স' : 'উত্তোলনের পরিমাণ'}</span><b>{money(base)}</b></p>
              <p><span>চার্জের হার</span><b>প্রতি ৳1,000-এ {money(cfg.chargePerThousand)}</b></p>
              <p className="cz-calc__total"><span>মোট চার্জ</span><b>{money(raised.charge)}</b></p>
            </div>
          )}

          {err.apply && <p className="cz-err">{err.apply}</p>}

          <div className="cz-next cz-next--inline">
            <button type="button" className="btn btn--gold btn--block" disabled={busy} onClick={() => void apply()}>
              {busy ? 'পাঠানো হচ্ছে…' : cfg.applyLabel}
            </button>
          </div>

          {cfg.chargeWarning && (
            <div className="cz-caution">
              <b>Caution:</b>
              <p>{cfg.chargeWarning}</p>
            </div>
          )}
        </div>
      </>
    );
  }

  /* ---------------- step 1: the form ---------------- */
  return (
    <>
      <CashierHeader title={t.withdraw} historyHref="/withdraw-history" direction="out" />

      <div className="cz-tabs scroll-x" role="tablist">
        {methods.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={m.id === method.id}
            className={`cz-tab${m.id === method.id ? ' on' : ''}`}
            onClick={() => { setMethodId(m.id); setWalletId(null); setErr({}); }}
          >
            <MethodIcon method={m} size={30} />
            <span>{m.name}</span>
          </button>
        ))}
      </div>

      <form className="cz" onSubmit={review} noValidate>
        {walletsSupported ? (
          <section className="cz-sec cz-wallets">
            <h2 className="cz-sec__h">
              {cfg.walletsTitle} ({forMethod.length}/{cfg.maxWallets})
            </h2>
            {!signedIn ? (
              <div className="ck-empty">
                <EmptyWalletArt />
                <p className="ck-empty__text">Log in and your wallets show up here</p>
              </div>
            ) : forMethod.length === 0 ? (
              <div className="ck-empty">
                <EmptyWalletArt />
                <p className="ck-empty__text">{cfg.emptyWalletsText}</p>
              </div>
            ) : (
              <div className="cz-wallets__list">
                {forMethod.map((w) => (
                  <label key={w.id} className={`cz-wallet-row${picked?.id === w.id ? ' on' : ''}`}>
                    <input type="radio" name="wallet" checked={picked?.id === w.id} onChange={() => setWalletId(w.id)} />
                    <MethodIcon method={method} size={22} />
                    <span className="cz-wallet-row__no">
                      <b>{w.account_no}</b>
                      {w.holder && <small>{w.holder}</small>}
                    </span>
                    <button type="button" className="cz-wallet-row__x" aria-label="Remove" onClick={() => void removeWallet(w.id)}>×</button>
                  </label>
                ))}
              </div>
            )}
            {/* the button is always there, the way the reference has it — a
                player who is not signed in is sent to sign in rather than
                left looking for the way to add a wallet */}
            {forMethod.length < cfg.maxWallets && (
              <button
                type="button"
                className="cz-add"
                aria-label="Add wallet"
                onClick={() => {
                  if (!signedIn) { toast('Log in first to add a wallet'); return; }
                  setAdding(true);
                  setErr({});
                }}
              >+</button>
            )}
            {err.account && <p className="cz-err">{err.account}</p>}
          </section>
        ) : (
          <section className="cz-sec">
            <h2 className="cz-sec__h">Your {method.name} number</h2>
            <input
              className="cz-input" type="tel" inputMode="numeric" placeholder={method.accountHint}
              value={inlineNo} onChange={(e) => setInlineNo(e.target.value)}
            />
            {err.account && <p className="cz-err">{err.account}</p>}
          </section>
        )}

        <section className="cz-sec cz-info">
          <p><span>Withdrawal time:</span> <b>{cfg.processingTime}</b></p>
          {cfg.reminder && <p className="cz-info__rem"><i aria-hidden>✅</i> <span>Friendly reminder:</span> {cfg.reminder}</p>}
          {remaining !== null && (
            <p className="cz-info__daily">Daily withdrawals {cfg.dailyLimit}, remaining {remaining}</p>
          )}
          <p><span>Main wallet:</span> <b>{money(balance, 2)}</b></p>
          <p><span>Available amount:</span> <b>{money(available, 2)}</b></p>
          {waiting > 0 && <p><span>Waiting for approval:</span> <b>{money(waiting, 2)}</b></p>}
          <button type="button" className="cz-refresh" onClick={() => { void refresh(); void loadToday(); toast('Balance refreshed'); }}>
            <i aria-hidden>⟳</i> Refresh your balance
          </button>
        </section>

        <section className="cz-sec">
          <h2 className="cz-sec__h">{cfg.amountLabel}:</h2>
          <label className="cz-field">
            <span>Amount</span>
            <input
              type="number" inputMode="numeric" placeholder={`${method.min} — ${method.max}`}
              value={amount} onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          {err.amount && <p className="cz-err">{err.amount}</p>}
          <label className="cz-field">
            <span>{cfg.passwordLabel}</span>
            <input
              type={showPass ? 'text' : 'password'} autoComplete="current-password" placeholder={cfg.passwordLabel}
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" className="cz-field__eye" aria-label="Show" onClick={() => setShowPass((v) => !v)}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden>
                <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="currentColor" strokeWidth="1.6" />
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
                {!showPass && <path d="M4 20 20 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />}
              </svg>
            </button>
          </label>
          {err.password && <p className="cz-err">{err.password}</p>}
          {/* the admin's hint names the login password; once a fund password
              exists it is the one being asked for, so say so instead */}
          {!err.password && (hasTxnPassword
            ? <p className="cz-limit">Enter your transaction password</p>
            : cfg.passwordHint ? <p className="cz-limit">{cfg.passwordHint}</p> : null)}
        </section>

        {/* The charge is not shown here. On this screen the player is still
            deciding how much to take out, and a ৳6,208 figure against a
            balance they have not committed reads as a fee on nothing. It is
            worked out and shown on the summary, once there is a real
            withdrawal for it to apply to. */}

        <div className="cz-next cz-next--inline">
          <button type="submit" className="btn btn--gold btn--block" disabled={busy || !typedOk || !password.trim()}>
            {busy ? 'Verifying…' : `${t.withdraw} request`}
          </button>
          {cfg.note && <p className="cz-limit">{cfg.note}</p>}
        </div>
      </form>

      {adding && (
        <>
          <div className="scrim on" onClick={() => setAdding(false)} />
          <div className="modal cz-modal" role="dialog" aria-modal="true">
            <h3>Add a {method.name} wallet</h3>
            <p>The number you want the money sent to. Use an account in your own name.</p>
            <label className="cz-field">
              <span>Number</span>
              <input type="tel" inputMode="numeric" placeholder={method.accountHint} value={newNo} onChange={(e) => setNewNo(e.target.value)} autoFocus />
            </label>
            <label className="cz-field">
              <span>Account name (optional)</span>
              <input value={newHolder} onChange={(e) => setNewHolder(e.target.value)} />
            </label>
            {err.add && <p className="cz-err">{err.add}</p>}
            <div className="cz-modal__acts">
              <button type="button" className="btn btn--ghost" onClick={() => setAdding(false)}>Cancel</button>
              <button type="button" className="btn btn--gold" disabled={busy} onClick={() => void addWallet()}>Add</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

/** "bkash" → "bKash": the wallet's own name, not the admin's tile label. */
function channelName(channelId: string) {
  return DEPOSIT_CHANNELS.find((c) => c.id === channelId)?.name ?? channelId;
}

function MethodIcon({ method, size }: { method: { icon: string; color: string }; size: number }) {
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
