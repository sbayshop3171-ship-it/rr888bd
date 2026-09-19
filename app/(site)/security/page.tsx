'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import PageHeader from '@/components/PageHeader';
import { t } from '@/lib/strings';
import { useLightSheet } from '@/components/useLightSheet';
import {
  BadgeOkIcon, BadgeTodoIcon, BoltIcon, ChevronThinIcon, EditMarkIcon, EWalletLineIcon,
  MemberIconDefs, PadlockLineIcon, PersonLineIcon, PowerLineIcon, VaultLineIcon,
} from '@/components/Icons';

/* ============================================================
   Security Center — the reference's phone screen.

   A score, the level it earns, and the rows that move it. Four rows
   are scored; Logout is not, which is why it carries no badge and no
   pencil.

   The weights are the reference's, read off its own screen: with the
   three account rows done and Personal information still open it shows
   50% and "Low". So Personal information is half the score and the
   other three share the rest, and the levels sit where the reference
   puts them (>80 High, >60 Medium, else Low).

   Everything is read from the account rather than stored, so the ring
   cannot drift out of date with what the rows say.
   ============================================================ */

const RING = 43;                       // ring radius in the 92px viewBox
const CIRC = 2 * Math.PI * RING;

export default function SecurityPage() {
  useLightSheet();
  const { ready, session, supabase, profile, signOut } = useAuth();

  const signedIn = ready && Boolean(session);

  /* A payout account is a row in the database (migration 005) and the
     transaction password is one function call away (migration 010); a
     deployment without either answers "not set" rather than erroring. */
  const [hasWallet, setHasWallet] = useState(false);
  const [hasTxnPassword, setHasTxnPassword] = useState(false);

  useEffect(() => {
    if (!session) return;
    let live = true;
    void fetch('/api/security/score', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data: { ok?: boolean; wallet?: boolean; transactionPassword?: boolean }) => {
        if (!live || !data.ok) return;
        setHasWallet(Boolean(data.wallet));
        setHasTxnPassword(Boolean(data.transactionPassword));
      })
      .catch(() => undefined);
    return () => { live = false; };
  }, [session]);

  useEffect(() => {
    if (!supabase || !session) return;
    let live = true;
    void supabase.from('payout_accounts').select('id').limit(1)
      .then((result) => { if (live) setHasWallet((result.data as { length?: number } | null)?.length ? ((result.data as { length?: number }).length ?? 0) > 0 : false); });
    void supabase.rpc('has_transaction_password')
      .then((result) => { if (live) setHasTxnPassword(result.data === true); });
    return () => { live = false; };
  }, [supabase, session]);

  const rows: {
    href: string;
    icon: React.ReactNode;
    title: string;
    sub: string;
    done: boolean;
    weight: number;
  }[] = [
    {
      href: '/my-profile',
      icon: <PersonLineIcon />,
      title: 'Personal information',
      sub: 'Complete personal information.',
      /* the reference keeps this open until both names are in — its own
         account shows the real name set and the row still marked */
      done: Boolean(profile?.real_name && profile?.display_name),
      weight: 50,
    },
    {
      href: '/link-ewallet',
      icon: <EWalletLineIcon />,
      title: 'Link E-wallet',
      sub: 'Link E-wallet for withdrawal.',
      done: hasWallet,
      weight: 50 / 3,
    },
    {
      href: '/change-password',
      icon: <PadlockLineIcon />,
      title: 'Change login password',
      sub: 'Recommended letter and number combination',
      /* a login password always exists — this row counts having one */
      done: signedIn,
      weight: 50 / 3,
    },
    {
      href: '/transaction-password',
      icon: <VaultLineIcon />,
      title: 'Transaction Password',
      sub: 'Set a fund password to improve the security of fund operations',
      done: hasTxnPassword,
      weight: 50 / 3,
    },
  ];

  const score = Math.round(rows.reduce((s, r) => s + (r.done ? r.weight : 0), 0));
  const level = score > 80 ? 'High' : score > 60 ? 'Medium' : 'Low';
  /* 50% lights three of the five, as the reference does */
  const bolts = Math.ceil(score / 20);

  return (
    <>
      <PageHeader title="Security Center" />
      <MemberIconDefs />

      <div className="msheet">
        {!signedIn && ready && (
          <div className="wallet-bar" style={{ margin: '13px 13px 0' }}>
            <Link href="/login" className="btn btn--ghost" style={{ padding: 12 }}>{t.login}</Link>
            <Link href="/register" className="btn btn--gold" style={{ padding: 12 }}>{t.register}</Link>
          </div>
        )}

        <div className="ms-score">
          <span className="ms-ring">
            {/* the arc starts at twelve o'clock and runs clockwise, cyan into
                purple, so the colour itself reads as distance travelled */}
            <svg viewBox="0 0 92 92">
              <defs>
                <linearGradient id="ms-arc" x1="1" y1="0.5" x2="0" y2="0.5">
                  <stop offset="0%" stopColor="#4cc6f2" />
                  <stop offset="100%" stopColor="#b55ef0" />
                </linearGradient>
              </defs>
              <circle cx="46" cy="46" r={RING} fill="none" stroke="#f3f3f3" strokeWidth="4.4" />
              {score > 0 && (
                <circle
                  cx="46" cy="46" r={RING} fill="none" stroke="url(#ms-arc)" strokeWidth="4.4"
                  strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - score / 100)}
                />
              )}
            </svg>
            <b>{score}<i>%</i></b>
          </span>

          <span className="ms-score__lv">
            Security Level: {level}
            <span className="ms-bolts" aria-hidden>
              {[0, 1, 2, 3, 4].map((i) => (
                <BoltIcon key={i} className={i < bolts ? undefined : 'off'} />
              ))}
            </span>
          </span>
        </div>

        {level !== 'High' && (
          <p className="ms-warn">
            {/* the full-width comma carries its own gap; nothing after it */}
            Your account security level is {level}，Please improve your safety information
          </p>
        )}

        <div className="ms-rows">
          {rows.map((r) => (
            <Link key={r.title} href={r.href} className="ms-row">
              <span className="ms-row__ico">{r.icon}</span>
              <span className="ms-row__text">
                <span className="ms-row__title">
                  <span>{r.title}</span>
                  {r.done
                    ? <BadgeOkIcon className="ms-badge" />
                    : <BadgeTodoIcon className="ms-badge" />}
                  <EditMarkIcon className="ms-row__pen" />
                </span>
                <span className="ms-row__sub">{r.sub}</span>
              </span>
              <ChevronThinIcon className="ms-row__chev" />
            </Link>
          ))}

          <button type="button" className="ms-row" onClick={() => void signOut()}>
            <span className="ms-row__ico"><PowerLineIcon /></span>
            <span className="ms-row__text">
              <span className="ms-row__title"><span>Logout</span></span>
              <span className="ms-row__sub">Logout safely</span>
            </span>
          </button>
        </div>
      </div>
    </>
  );
}
