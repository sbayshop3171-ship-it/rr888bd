'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/components/AuthProvider';
import { useUI } from '@/components/UIProvider';
import { useBackLayer } from '@/components/useBackLayer';
import { useCashierConfig } from '@/components/useCashierConfig';
import { useLightSheet } from '@/components/useLightSheet';
import { isImageIcon } from '@/lib/cashier-config';
import {
  CardLineIcon, CloseThinIcon, EyeOffIcon, EyeOnIcon, IdCardIcon, LockMarkIcon, PlusThinIcon,
} from '@/components/Icons';

/* ============================================================
   Link E-wallet — the reference's phone screen.

   The wallets a withdrawal can be sent to. They live in
   `payout_accounts` (migration 005), which is the same list the
   withdraw screen picks from, so adding one here is the same act
   as adding one there.

   Two views on one route: the list, and the form a group picked out
   of the "Add New" sheet opens. The reference's list has no remove
   button — a linked wallet is changed through support — so neither
   does this one.

   The form follows the reference top to bottom: the picked group in a
   red-bordered tile, then a bordered box holding the group again as its
   one e-wallet type, the name on file (greyed and masked), and the
   account number, then the fund password and Submit.

   It is reached two ways, as on the reference: Security Center → Link
   E-wallet, and My Account → Bank Account. The second is the same
   list under the title "Bank Account", with the + docked at the foot
   of the screen (`docked`); the add form is "Link E-wallet" from
   either door.

   A player with no fund password yet sets one here, in the same
   submit — the reference asks for it on this form rather than
   sending them away to the Security Center first.
   ============================================================ */

type Wallet = {
  id: number;
  channel_id: string;
  account_no: string;
  holder: string;
  created_at: string;
};

/** *******2011 — the reference shows only the last four. */
const mask = (no: string) => '*'.repeat(Math.max(0, no.length - 4)) + no.slice(-4);
/** J***** — the name on file as the reference greys it out here: the first
    letter and five stars, whatever the length */
const maskName = (name: string) => `${name.slice(0, 1)}*****`;

/* The reference draws each group as its wordmark on white, not the square
   app icon the cashier uses; these are cut from its own screens. A group
   without one falls back to the cashier's icon. */
const WORDMARK: Record<string, string> = {
  bkash: '/wallets/bkash.png',
  nagad: '/wallets/nagad.png',
  rocket: '/wallets/rocket.png',
};
const art = (m: { channelId: string; icon: string }) => WORDMARK[m.channelId] ?? m.icon;

const stamp = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} `
    + `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

/** the fund password's rule, as /transaction-password enforces it */
const TXN_MIN = 6;
const TXN_MAX = 16;
const TXN_OK = /^[A-Za-z0-9]+$/;

export default function LinkEWallet({
  title = 'Link E-wallet',
  docked = false,
}: {
  title?: string;
  /** the + sits at the foot of the screen, as the reference's Bank Account has it */
  docked?: boolean;
}) {
  useLightSheet();
  const { toast } = useUI();
  const { ready, session, supabase, profile } = useAuth();
  const { config } = useCashierConfig();
  const cfg = config.withdraw;
  const methods = cfg.methods.filter((m) => m.active);

  const [wallets, setWallets] = useState<Wallet[] | null>(null);
  const [supported, setSupported] = useState(true);
  const [sheet, setSheet] = useState(false);
  const [group, setGroup] = useState<string | null>(null);
  const [no, setNo] = useState('');
  const [holder, setHolder] = useState('');
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  /** the login password — asked for once, when the fund password is first set */
  const [loginPass, setLoginPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [hasTxnPassword, setHasTxnPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const closeForm = () => { setGroup(null); setNo(''); setPass(''); setConfirm(''); setLoginPass(''); setErr(''); };
  // the phone's Back leaves the add-wallet form the way its header arrow does
  useBackLayer(group !== null, closeForm);

  const signedIn = ready && Boolean(session);
  const realName = profile?.real_name ?? '';

  const load = useCallback(async () => {
    if (!supabase || !session) { setWallets([]); return; }
    const { data, error } = await supabase
      .from('payout_accounts')
      .select('id, channel_id, account_no, holder, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    /* the table arrives with migration 005; without it the screen says so
       rather than looking empty */
    if (error) { setSupported(false); setWallets([]); return; }
    setWallets((data as Wallet[]) ?? []);
  }, [supabase, session]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!supabase || !session) return;
    let live = true;
    void supabase.rpc('has_transaction_password')
      .then(({ data }) => { if (live) setHasTxnPassword(data === true); });
    return () => { live = false; };
  }, [supabase, session]);

  useEffect(() => {
    setHolder(profile?.real_name ?? profile?.display_name ?? '');
  }, [profile?.real_name, profile?.display_name]);

  const picked = methods.find((m) => m.channelId === group);
  const clean = no.replace(/[\s-]+/g, '');

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!picked || !supabase || !session) return;
    if (clean.length < 4) { setErr('Enter a valid account number'); return; }
    if ((wallets ?? []).length >= cfg.maxWallets) {
      setErr(`Maximum ${cfg.maxWallets} allowed`); return;
    }
    if ((wallets ?? []).some((wallet) =>
      wallet.channel_id === picked.channelId && wallet.account_no === clean
    )) {
      setErr('That number is already linked'); return;
    }
    if (!realName && !holder.trim()) { setErr('Enter the account holder name'); return; }
    if (!hasTxnPassword) {
      if (pass.length < TXN_MIN || pass.length > TXN_MAX || !TXN_OK.test(pass)) {
        setErr(`Transaction password: ${TXN_MIN} - ${TXN_MAX} letters or numbers`); return;
      }
      if (confirm !== pass) { setErr('The two passwords do not match'); return; }
      if (!loginPass) { setErr('Enter your login password'); return; }
    }

    setBusy(true);
    /* the fund password gates adding a payout account, the same way it gates
       a withdrawal. A player without one sets it here first; if the wallet
       then fails to save, the password stays set and the form asks for it
       as an existing one on the retry. */
    if (hasTxnPassword) {
      const { data } = await supabase.rpc('verify_transaction_password', { p_password: pass });
      if (data !== true) { setBusy(false); setErr('Wrong transaction password'); return; }
    } else {
      // the first fund password is proven with the login password (018)
      const { data, error } = await supabase.rpc('set_transaction_password', { p_new: pass, p_old: loginPass });
      if (error) { setBusy(false); setErr('Could not set the transaction password — try again'); return; }
      if (data === 'wrong') { setBusy(false); setErr('Your login password is wrong'); return; }
      if (data === 'locked') { setBusy(false); setErr('Too many wrong passwords — try again in 15 minutes'); return; }
      setLoginPass('');
      setHasTxnPassword(true);
      setConfirm('');
    }
    let error: { message: string } | null = null;
    try {
      ({ error } = await supabase.from('payout_accounts').insert({
        user_id: session.user.id,
        channel_id: picked.channelId,
        account_no: clean,
        holder: (realName || holder).trim().slice(0, 60),
      }));
    } catch (caught) {
      error = { message: caught instanceof Error ? caught.message : 'Could not link it' };
    }
    setBusy(false);

    if (error) {
      setErr(/duplicate|unique/i.test(error.message)
        ? 'That number is already linked'
        : 'Could not link it — try again');
      return;
    }
    closeForm();
    await load();
    toast('E-wallet linked');
  };

  const logo = (icon: string, name: string, w: number, h: number) =>
    isImageIcon(icon)
      ? <Image src={icon} alt={name} width={w} height={h} />
      : <span style={{ fontSize: 20 }}>{icon}</span>;

  /* ---------------- the add form ---------------- */
  if (picked) {
    return (
      <>
        {/* the form is state on this route, so back returns to the list, as
            the reference's does — there is no Cancel to do it otherwise */}
        <PageHeader title="Link E-wallet" onBack={closeForm} />
        <div className="msheet">
          <form className="ms-pad ms-lwform" onSubmit={add} noValidate>
            <p className="ms-label">Select E-wallet group</p>
            <div className="ms-group">
              <span className="ms-group__art">{logo(art(picked), picked.name, 83, 35)}</span>
            </div>

            <div className="ms-box">
              <p>E-wallet type</p>
              <span className="ms-chip">{picked.name}</span>
              {/* the account holder is the name on file, greyed out: a
                  withdrawal is checked against it, not one typed here */}
              <label className={`ms-field${realName ? ' ms-field--locked' : ''}`}>
                <span className="ms-field__ico"><IdCardIcon /></span>
                <input
                  placeholder="＊ Account holder name"
                  value={realName ? maskName(realName) : holder}
                  disabled={Boolean(realName)}
                  onChange={(e) => { setHolder(e.target.value); setErr(''); }}
                />
              </label>
              {!realName && (
                <p className="ms-lwnote">
                  Please ensure the name you provide matches exactly with the name registered
                  with your financial provider to avoid failure. Once the name is submitted,
                  it cannot be changed.
                </p>
              )}
              <label className="ms-field ms-field--square">
                <span className="ms-field__ico"><CardLineIcon /></span>
                <input
                  type="tel" inputMode="numeric"
                  placeholder={`＊ Please fill in ${picked.name} account number`}
                  value={no} onChange={(e) => { setNo(e.target.value); setErr(''); }}
                />
              </label>
            </div>

            {!hasTxnPassword && (
              <p className="ms-lwnote ms-lwnote--txn">Please set up your transaction password.</p>
            )}

            <label className="ms-field">
              <span className="ms-field__ico"><LockMarkIcon /></span>
              <input
                type={showPass ? 'text' : 'password'}
                placeholder={hasTxnPassword ? '＊ Transaction Password' : '＊ Set transaction password'}
                autoComplete={hasTxnPassword ? 'off' : 'new-password'} maxLength={TXN_MAX}
                value={pass}
                onChange={(e) => { setPass(e.target.value); setErr(''); }}
              />
              <button
                type="button" className="ms-field__eye" aria-label={showPass ? 'Hide' : 'Show'}
                onClick={() => setShowPass((v) => !v)}
              >
                {showPass ? <EyeOnIcon /> : <EyeOffIcon />}
              </button>
            </label>

            {!hasTxnPassword && (
              <label className="ms-field">
                <span className="ms-field__ico"><LockMarkIcon /></span>
                <input
                  type={showPass ? 'text' : 'password'} placeholder="＊ Confirm password"
                  autoComplete="new-password" maxLength={TXN_MAX} value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setErr(''); }}
                />
              </label>
            )}

            {!hasTxnPassword && (
              <label className="ms-field">
                <span className="ms-field__ico"><LockMarkIcon /></span>
                <input
                  type={showPass ? 'text' : 'password'} placeholder="＊ Your login password"
                  autoComplete="current-password" value={loginPass}
                  onChange={(e) => { setLoginPass(e.target.value); setErr(''); }}
                />
              </label>
            )}

            {err && <p className="ms-err" style={{ marginTop: 10 }}>{err}</p>}

            <button
              type="submit" className="ms-submit"
              disabled={busy || clean.length < 4 || !pass || (!hasTxnPassword && (!confirm || !loginPass))}
            >
              {busy ? '…' : 'Submit'}
            </button>
          </form>
        </div>
      </>
    );
  }

  /* ---------------- the list ---------------- */
  const list = wallets ?? [];
  const full = list.length >= cfg.maxWallets;

  return (
    <>
      <PageHeader title={title} />
      <div className={`msheet${docked ? ' ms-lw--docked' : ''}`}>
        <p className="ms-lw__count"><i aria-hidden />E-wallet Linked: {list.length}</p>

        {!signedIn && ready && <p className="ms-empty">Log in to link an e-wallet.</p>}
        {!supported && <p className="ms-empty">E-wallets are not switched on yet.</p>}

        {signedIn && supported && wallets !== null && list.length === 0 && (
          <div className="ms-card ms-card--none">
            <span className="ms-card__none" aria-hidden>
              <svg viewBox="0 0 24 24">
                <rect x="4" y="6.5" width="16" height="11" rx="1.8" fill="currentColor" />
                <rect x="6.5" y="9.4" width="5" height="1.6" rx=".8" fill="#dcdcdc" />
                <rect x="6.5" y="12.4" width="8" height="1.6" rx=".8" fill="#dcdcdc" />
              </svg>
            </span>
            No E-Wallet linked yet
          </div>
        )}

        {list.map((w) => {
          const m = methods.find((x) => x.channelId === w.channel_id);
          return (
            <div key={w.id} className="ms-card">
              <div className="ms-card__top">
                <span className="ms-card__logo">{m ? logo(art(m), m.name, 86, 34) : null}</span>
                <span className="ms-card__who">
                  <b>{m?.name ?? w.channel_id}</b>
                  <span>{mask(w.account_no)}</span>
                </span>
              </div>
              <div className="ms-card__when">{stamp(w.created_at)}</div>
            </div>
          );
        })}

        {signedIn && supported && (
          <>
            {/* the docked screen names the cap only once it is reached */}
            {(!docked || full) && (
              <p className="ms-lw__max">Maximum {cfg.maxWallets} allowed</p>
            )}
            <button
              type="button" className="ms-fab" aria-label="Add an e-wallet"
              disabled={full} onClick={() => setSheet(true)}
            >
              <PlusThinIcon />
            </button>
          </>
        )}

        {!signedIn && ready && (
          <div className="wallet-bar" style={{ margin: '20px 13px 0' }}>
            <Link href="/login" className="btn btn--gold" style={{ padding: 12 }}>Log in</Link>
          </div>
        )}
      </div>

      {sheet && (
        <div className="ms-sheet">
          <button type="button" className="ms-sheet__mask" aria-label="Close"
                  onClick={() => setSheet(false)} />
          <div className="ms-sheet__box">
            <p className="ms-sheet__h">Add New</p>
            {methods.map((m) => (
              <button
                key={m.id} type="button" className="ms-sheet__opt"
                onClick={() => { setGroup(m.channelId); setSheet(false); setErr(''); }}
              >
                {logo(art(m), m.name, 40, 18)}
                <span>{m.name}</span>
              </button>
            ))}
          </div>
          <button type="button" className="ms-sheet__x" aria-label="Close"
                  onClick={() => setSheet(false)}>
            <CloseThinIcon />
          </button>
        </div>
      )}
    </>
  );
}
