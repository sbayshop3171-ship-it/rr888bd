'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { AGENT_PARAM, normalizeAgentCode } from '@/lib/agent-links';
import Field from '@/components/Field';
import PageHeader from '@/components/PageHeader';
import { useUI } from '@/components/UIProvider';
import { isValidPhone } from '@/lib/auth';
import { t } from '@/lib/strings';

/** Where the agent code waits if the visitor wanders off before signing up. */
const AGENT_KEY = 'rr888bd.agent';

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useUI();
  const { signUp, backendReady } = useAuth();

  const [f, setF] = useState({ phone: '', pass: '', confirm: '' });
  /** the agent whose link brought this visitor here — never typed, so it is
      not a form field */
  const [agent, setAgent] = useState('');
  /** the friend whose invite link (/register?ref=CODE) this is. The typed
      referral box was taken off the form on the operator's word
      (2026-09-11); a shared link still credits the friend, unseen. */
  const [ref, setRef] = useState('');

  // Read from location in an effect: useSearchParams would force a Suspense
  // boundary on this statically prerendered page for no gain.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromLink = params.get('ref')?.trim();
    if (fromLink) setRef(fromLink);

    // An agent's link is /register?agent=CODE. Somebody who arrives, looks
    // around the site and comes back to register is still that agent's
    // signup, so the code outlives the query string.
    const fromUrl = normalizeAgentCode(params.get(AGENT_PARAM));
    if (fromUrl) {
      setAgent(fromUrl);
      try { localStorage.setItem(AGENT_KEY, fromUrl); } catch { /* private mode */ }
      return;
    }
    try {
      const kept = normalizeAgentCode(localStorage.getItem(AGENT_KEY));
      if (kept) setAgent(kept);
    } catch { /* private mode */ }
  }, []);
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!isValidPhone(f.phone)) next.phone = 'Enter a valid 11-digit number';
    if (f.pass.length < 6) next.pass = 'The password must be at least 6 characters';
    if (f.confirm !== f.pass) next.confirm = 'The passwords do not match';
    setErr(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: f.phone.trim(),
          password: f.pass,
          referralCode: ref || undefined,
          agentCode: agent || undefined,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) {
        setErr({ form: json?.message || 'Registration failed. Please try again.' });
        return;
      }

      const userId = json?.user?.id ? String(json.user.id) : '';
      const session = {
        user: {
          id: userId,
          email: `${f.phone.trim()}@local-user`,
          created_at: new Date().toISOString(),
        },
      };

      try {
        localStorage.setItem('rr888bd_session', JSON.stringify(session));
        window.dispatchEvent(new Event('storage'));
        localStorage.removeItem(AGENT_KEY);
      } catch { /* private mode */ }

      toast('Account created');
      router.push('/member');
    } catch (error) {
      setErr({ form: error instanceof Error ? error.message : 'Network error. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title={t.register} />

      <div className="hero">
        <h1>৳18 Sign Up Bonus</h1>
        <p>Register and verify your number to get the bonus</p>
      </div>

      <form style={{ margin: 12 }} onSubmit={submit} noValidate>
        <Field label="Mobile number" error={err.phone}>
          <input type="tel" inputMode="numeric" placeholder="01XXXXXXXXX"
                 value={f.phone} onChange={set('phone')} disabled={busy} />
        </Field>
        <Field label="Password" error={err.pass}>
          <input type="password" autoComplete="new-password" placeholder="••••••••"
                 value={f.pass} onChange={set('pass')} disabled={busy} />
        </Field>
        <Field label="Confirm password" error={err.confirm}>
          <input type="password" autoComplete="new-password" placeholder="••••••••"
                 value={f.confirm} onChange={set('confirm')} disabled={busy} />
        </Field>
        {agent && (
          <div className="note" style={{ marginBottom: 10 }}>
            You arrived through agent code <b>{agent}</b> — this account goes on their list.
          </div>
        )}

        {err.form && <div className="field__err" style={{ marginBottom: 10 }}>{err.form}</div>}

        <button type="submit" className="btn btn--gold btn--block" disabled={busy}>
          {busy ? 'Please wait…' : t.registerNow}
        </button>

        <div className="form-alt">
          Already have an account? <Link href="/login"><b>{t.login}</b></Link>
        </div>

        <div className="note">
          By registering you confirm that you are over 18 years of age.
          {!backendReady && ' The database is not connected — registration will not work.'}
        </div>
      </form>
    </>
  );
}
