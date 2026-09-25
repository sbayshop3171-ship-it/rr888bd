'use client';

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import type { Session, SupabaseClient } from '@/lib/supabase';
import { browserClient, clearAuthStorage, isBackendReady, readAccessToken, readSession, readStoredUser } from '@/lib/supabase';
import { normalizeAgentCode } from '@/lib/agent-links';
import { emailToPhone, normalizePhone, phoneToEmail } from '@/lib/auth';

export interface Profile {
  id: string;
  phone: string;
  display_name: string | null;
  role: 'player' | 'agent' | 'admin';
  vip_level: number;
  referral_code: string;
  /* the contact fields My Account collects (migration 011). They are
     optional so a deployment without that migration still loads a profile —
     the select below drops them and every screen reads them as null. */
  real_name?: string | null;
  /** the player ID support asks for (migration 012) */
  player_no?: number | null;
  is_blocked?: boolean;
  /** on hold: can look, cannot move money (migration 012) */
  is_held?: boolean;
  facebook_id?: string | null;
  google_id?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  contact_phone?: string | null;
}

export interface Wallet {
  balance: number;        // paisa
  bonus_balance: number;  // paisa
  turnover_need: number;
  turnover_done: number;
}

interface AuthValue {
  ready: boolean;
  backendReady: boolean;
  session: Session | null;
  profile: Profile | null;
  wallet: Wallet | null;
  supabase: SupabaseClient | null;
  signUp: (
    phone: string,
    password: string,
    referral?: string,
    agentCode?: string,
  ) => Promise<string | null>;
  signIn: (phone: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>');
  return v;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // one client for the life of the tab; recreating it drops the session listener
  const clientRef = useRef<SupabaseClient | null>(null);
  if (clientRef.current === null) clientRef.current = browserClient();
  const supabase = clientRef.current;

  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);

  const load = useCallback(async (uid: string | undefined) => {
    if (!supabase || !uid) { setProfile(null); setWallet(null); return; }
    const BASE = 'id, phone, display_name, role, vip_level, referral_code, is_blocked';
    const CONTACT = 'real_name, facebook_id, google_id, whatsapp, email, contact_phone';
    // widest first; a database missing a migration answers the next one down
    // (012 adds the ID and the hold switch, 011 the contact fields)
    const TIERS = [`${BASE}, ${CONTACT}, player_no, is_held`, `${BASE}, ${CONTACT}`, BASE];

    const walletRead = supabase.from('wallets')
      .select('balance, bonus_balance, turnover_need, turnover_done')
      .eq('user_id', uid).maybeSingle();
    let row: Profile | null = null;
    for (const cols of TIERS) {
      try {
        const p = await supabase.from('profiles').select(cols).eq('id', uid).maybeSingle();
        if (!p.error) { row = (p.data as Profile | null) ?? null; break; }
      } catch {
        // Try the next compatibility tier when an older database lacks columns.
      }
    }

    if (!row) {
      row = {
        id: uid,
        phone: '',
        display_name: null,
        role: 'player',
        vip_level: 0,
        referral_code: '',
      };
    }

    // A banned account is signed out here as well as at the auth server: an
    // access token issued before the ban is good for up to an hour, and the
    // screens should not keep offering a wallet that no longer works.
    if (row.is_blocked) {
      await supabase.auth.signOut();
      setProfile(null);
      setWallet(null);
      return;
    }
    setProfile(row);
    const walletData = ((await walletRead).data as unknown) as Partial<Wallet> | null;
    setWallet(walletData ? {
      balance: Number(walletData.balance ?? 0),
      bonus_balance: Number(walletData.bonus_balance ?? 0),
      turnover_need: Number(walletData.turnover_need ?? 0),
      turnover_done: Number(walletData.turnover_done ?? 0),
    } : null);
  }, [supabase]);

  const hydrateFromStorage = useCallback(async () => {
    const storedSession = readSession();
    const storedUser = readStoredUser();
    const token = readAccessToken();

    if (!storedSession && !token && !storedUser) {
      setSession(null);
      setProfile(null);
      setWallet(null);
      setReady(true);
      return;
    }

    const fallbackUserId = String((storedUser as any)?.id ?? '');
    const authSession = storedSession ?? (fallbackUserId || token
      ? {
          user: {
            id: fallbackUserId || String((storedUser as any)?.user?.id ?? ''),
            email: (storedUser as any)?.email ?? (storedUser as any)?.user?.email ?? null,
            created_at: (storedUser as any)?.created_at ?? (storedUser as any)?.user?.created_at ?? new Date().toISOString(),
          },
        }
      : null);
    if (authSession) {
      setSession(authSession);
      await load(authSession.user.id);
    }
    setReady(true);
  }, [load]);

  useEffect(() => {
    void hydrateFromStorage();

    if (!supabase) return;
    let alive = true;

    const syncServerSession = async (next: Session | null) => {
      if (!next?.user.id) return;
      await fetch('/api/session/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: next.user.id }),
      }).catch(() => undefined);
    };

    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session ?? readSession());
      await syncServerSession(data.session ?? readSession());
      await load((data.session ?? readSession())?.user.id);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s ?? readSession());
      syncServerSession(s ?? readSession());
      void load((s ?? readSession())?.user.id);
    });

    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [supabase, load, hydrateFromStorage]);

  /** Returns an error message, or null on success. */
  const signUp = useCallback<AuthValue['signUp']>(async (phone, password, referral, agentCode) => {
    if (!supabase) return 'The database is not connected';
    // agent_code is read by the signup trigger (migration 008) and written
    // to profiles once. It is metadata rather than a follow-up update so a
    // client that dies right after signUp still leaves the agent credited.
    const { data, error } = await supabase.auth.signUp({
      email: phoneToEmail(phone),
      password,
      options: {
        data: {
          phone: normalizePhone(phone),
          // codes are lowercase hex; a phone keyboard capitalises what is typed
          referral_code: referral?.trim().toLowerCase() || null,
          agent_code: normalizeAgentCode(agentCode) ?? null,
        },
      },
    });
    if (error) return translate(error.message);
    // The signup trigger reads the phone from the metadata above (migration
    // 008). It is no longer rewritten from here: since 012 a player cannot
    // update their own phone column, which is what stops them rewriting it.
    if (data.user) await load(data.user.id);
    return null;
  }, [supabase, load]);

  const signIn = useCallback<AuthValue['signIn']>(async (phone, password) => {
    if (!supabase) return 'The database is not connected';
    const { error } = await supabase.auth.signInWithPassword({
      email: phoneToEmail(phone), password,
    });
    return error ? translate(error.message) : null;
  }, [supabase]);

  const signOut = useCallback(async () => {
    clearAuthStorage();
    setSession(null);
    setProfile(null);
    setWallet(null);
    setReady(true);
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' }).catch(() => undefined);
    } finally {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  }, [supabase]);

  const refresh = useCallback(async () => {
    await load(session?.user.id);
  }, [load, session]);

  const value = useMemo<AuthValue>(() => ({
    ready, backendReady: isBackendReady(), session, profile, wallet, supabase,
    signUp, signIn, signOut, refresh,
  }), [ready, session, profile, wallet, supabase, signUp, signIn, signOut, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Supabase speaks English; players do not. */
function translate(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Wrong number or password';
  if (m.includes('already registered')) return 'An account already exists for this number';
  if (m.includes('banned')) return 'This account has been banned. Contact support.';
  if (m.includes('weak') || m.includes('pwned') || m.includes('leaked')) {
    return 'That password is too easy to guess — choose another';
  }
  if (m.includes('password')) return 'The password must be at least 6 characters';
  if (m.includes('email') && m.includes('confirm')) {
    return 'Email confirmation is on — turn it off in the Supabase dashboard';
  }
  if (m.includes('rate limit')) return 'Too many attempts, try again shortly';
  return msg;
}

/** Convenience for the header and member screens. */
export const phoneOf = (session: Session | null) => emailToPhone(session?.user.email);
