/** Cashier and player queries for the admin panel.

    Everything here runs through adminClient() — the service-role key, which
    bypasses RLS. That is deliberate: the admin panel authenticates against its
    own store (lib/admin-auth.ts), not Supabase Auth, so `auth.uid()` is null
    here and the is_admin() policies would never pass. Callers must check the
    admin session before reaching any of this.

    Money moves only through the SQL functions in supabase/004_cashier_actions
    so an approval and its ledger entry land together. */

import { adminClient } from './supabase';
import { latestAppeals, type Appeal } from './withdraw-lock';

export type RequestState = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type CashierRow = {
  id: number;
  userId: string;
  phone: string;
  displayName: string | null;
  /** the player's ID (migration 012); null if the embed could not carry it */
  playerNo: number | null;
  channelId: string;
  /** paisa */
  amount: number;
  state: RequestState;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  /** deposits: what the player says they sent from */
  senderNo?: string | null;
  txnId?: string | null;
  /** withdrawals: where the money should go */
  accountNo?: string | null;
  /** withdrawals: the agent cash-out charge, in paisa, and its proof */
  chargeAmount?: number;
  chargeChannelId?: string | null;
  chargeAccountNo?: string | null;
  chargeTrxId?: string | null;
  chargePaidAt?: string | null;
};

export type PlayerRow = {
  id: string;
  phone: string;
  displayName: string | null;
  role: string;
  vipLevel: number;
  referralCode: string;
  /** the agent whose invite link this player signed up through, if any */
  agentCode: string | null;
  /** the number players and support quote (migration 012); null before it */
  playerNo: number | null;
  /** banned: signed out, cannot log in or move money */
  isBlocked: boolean;
  /** on hold: can log in and look, cannot bet, claim or withdraw */
  isHeld: boolean;
  blockReason: string | null;
  holdReason: string | null;
  /** withdraw locked (migration 013): plays on, cannot withdraw */
  withdrawLocked: boolean;
  lockReason: string | null;
  lockedAt: string | null;
  lockedBy: string | null;
  /** their latest appeal against the current lock */
  appeal: Appeal | null;
  createdAt: string;
  /** paisa */
  balance: number;
  bonusBalance: number;
  turnoverNeed: number;
  turnoverDone: number;
};

export type CashierStats = {
  pendingDeposits: number;
  pendingWithdrawals: number;
  todayDeposited: number;
  todayWithdrawn: number;
  totalPlayers: number;
};

export type CashierResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: 'no-backend' | 'db-error'; message?: string };

const NO_BACKEND = { ok: false, reason: 'no-backend' } as const;

/** Rows joined to the player's profile, newest first. `search` narrows the
    list: a player's ID (all digits, up to 9), part of their phone, or part of
    a TxnID — the deposit's, or the withdrawal charge's. */
export async function listCashier(
  table: 'deposits' | 'withdrawals',
  state: RequestState | 'all' = 'pending',
  limit = 100,
  search = '',
): Promise<CashierResult<CashierRow[]>> {
  const db = adminClient();
  if (!db) return NO_BACKEND;

  // Letters and digits only, so nothing typed can reach the filter as
  // PostgREST syntax. A TxnID matches on the request itself; an all-digit
  // term may also be a player's ID or phone, which name user ids.
  const term = search.replace(/[^A-Za-z0-9]/g, '').slice(0, 40);
  const txnCol = table === 'deposits' ? 'txn_id' : 'charge_trx_id';
  let filter: string | null = null;
  if (term) {
    const match = [`${txnCol}.ilike.%${term}%`];
    if (/^\d+$/.test(term)) {
      const who = [`phone.ilike.%${term}%`];
      if (term.length <= 9) who.unshift(`player_no.eq.${Number(term)}`);
      const found = await db.from('profiles').select('id').or(who.join(',')).limit(50);
      if (found.error) return { ok: false, reason: 'db-error', message: found.error.message };
      const ids = (found.data ?? []).map((r: Record<string, unknown>) => String((r as { id: string }).id));
      if (ids.length) match.push(`user_id.in.(${ids.join(',')})`);
    }
    filter = match.join(',');
  }

  // The columns differ by table, so the select string cannot be a literal —
  // .returns<>() gives the rows a shape the mapper can read. The charge
  // columns arrive with migration 006, so a server that has not run it yet
  // falls back to the older, narrower select rather than losing the queue.
  const base = table === 'deposits'
    ? 'sender_no, txn_id'
    : 'account_no, user_phone, user_display_name, debited';
  const withCharge = table === 'withdrawals'
    ? `${base}, charge_amount, charge_channel_id, charge_account_no, charge_trx_id, charge_paid_at`
    : base;

  const run = async (extra: string) => {
    let query = db
      .from(table)
      .select(
        `id, user_id, channel_id, amount, state, admin_note, created_at, reviewed_at, ${extra}, `
        + 'profiles!user_id (phone, display_name, player_no)',
      )
      .order('created_at', { ascending: false })
      .limit(limit);
    if (state !== 'all') query = query.eq('state', state);
    if (filter) query = query.or(filter);
    return query.returns<Record<string, unknown>[]>();
  };

  let { data, error } = await run(withCharge);
  if (error && withCharge !== base && /column|schema cache/i.test(error.message)) {
    ({ data, error } = await run(base));
  }
  if (error) return { ok: false, reason: 'db-error', message: error.message };

  return { ok: true, data: (data ?? []).map(toCashierRow) };
}

/** Players, newest first. `agentCode` narrows the list to one agent's
    signups — that is the agent screen's whole query. `onlyLocked` keeps the
    withdraw-locked ones, most recently locked first, so an appeal is never
    lost below the first hundred signups. */
export async function listPlayers(
  search = '',
  limit = 100,
  agentCode?: string,
  onlyLocked = false,
): Promise<CashierResult<PlayerRow[]>> {
  try {
    const db = adminClient();
    if (!db) return NO_BACKEND;

  // Newer columns arrive with migrations: player_no and the hold switch with
  // 012, agent_code with 008. A database that has not run one yet drops back
  // to the next narrower select rather than losing the player list.
  const TIERS = [
    ', agent_code, player_no, is_held, hold_reason, block_reason, withdraw_locked, lock_reason, locked_at, locked_by',
    ', agent_code, player_no, is_held, hold_reason, block_reason',
    ', agent_code',
    '',
  ];

  // The term goes inside a PostgREST `or=(…)` filter, where a comma or a
  // bracket would end one condition and start another — "x%,phone.neq.0"
  // used to widen a search to every player. Keep what a phone, a name or an
  // ID can actually contain.
  const term = search.trim().replace(/[^\p{L}\p{N} ._@+-]/gu, '').slice(0, 40);
  const asId = /^\d{1,9}$/.test(term) ? Number(term) : null;

  const run = (extra: string) => {
    let query = db
      .from('profiles')
      .select(
        `id, phone, display_name, role, vip_level, referral_code, is_blocked, created_at${extra},
         wallets (balance, bonus_balance, turnover_need, turnover_done)`,
      )
      .order(onlyLocked ? 'locked_at' : 'created_at', { ascending: false })
      .limit(limit);

    if (term) {
      const match = [`phone.ilike.%${term}%`, `display_name.ilike.%${term}%`];
      if (asId !== null && extra.includes('player_no')) match.unshift(`player_no.eq.${asId}`);
      query = query.or(match.join(','));
    }
    if (agentCode) query = query.eq('agent_code', agentCode);
    if (onlyLocked) query = query.eq('withdraw_locked', true);

    return query.returns<Record<string, unknown>[]>();
  };

    for (const extra of TIERS) {
    // asked to filter by a column this database does not have: an empty list
    // is the honest answer, not every player on the site
    if (agentCode && !extra.includes('agent_code')) return { ok: true, data: [] };
    if (onlyLocked && !extra.includes('withdraw_locked')) return { ok: true, data: [] };

    const { data, error } = await run(extra);
    if (error && isMissingColumn(error.message)) continue;
    if (error) return { ok: false, reason: 'db-error', message: error.message };

    const rows = (data ?? []).map(toPlayerRow);
    const locked = rows.filter((p) => p.withdrawLocked);
    if (locked.length) {
      const appeals = await latestAppeals(db, locked.map((p) => p.id));
      for (const p of locked) {
        const appeal = appeals.get(p.id);
        // one sent against an earlier lock that was already lifted is history
        if (appeal && (!p.lockedAt || appeal.createdAt >= p.lockedAt)) p.appeal = appeal;
      }
    }
    return { ok: true, data: rows };
    }
    return { ok: false, reason: 'db-error', message: 'The player list could not be read' };
  } catch (error) {
    return {
      ok: false,
      reason: 'db-error',
      message: error instanceof Error ? error.message : 'The player list could not be read',
    };
  }
}

/** Postgres has no column by that name, or PostgREST has not reloaded its
    schema cache since the migration ran. */
export function isMissingColumn(message: string) {
  return /column|schema cache/i.test(message);
}

/** Headline figures for the dashboard. */
export async function cashierStats(): Promise<CashierResult<CashierStats>> {
  const db = adminClient();
  if (!db) return NO_BACKEND;

  try {
    // "Today" is the Bangladesh day (UTC+6), the one the operator is counting —
    // the server's own clock is UTC and would roll over at 6am local.
    const BD_OFFSET_MS = 6 * 60 * 60 * 1000;
    const bd = new Date(Date.now() + BD_OFFSET_MS);
    const since = new Date(
      Date.UTC(bd.getUTCFullYear(), bd.getUTCMonth(), bd.getUTCDate()) - BD_OFFSET_MS,
    ).toISOString();

    const [pendD, pendW, todayD, todayW, players] = await Promise.all([
      db.from('deposits').select('id', { count: 'exact', head: true }).eq('state', 'pending'),
      db.from('withdrawals').select('id', { count: 'exact', head: true }).eq('state', 'pending'),
      db.from('deposits').select('amount').eq('state', 'approved').gte('reviewed_at', since),
      db.from('withdrawals').select('amount').eq('state', 'approved').gte('reviewed_at', since),
      db.from('profiles').select('id', { count: 'exact', head: true }),
    ]);

    const failed = [pendD, pendW, todayD, todayW, players].find((r) => r.error);
    if (failed?.error) return { ok: false, reason: 'db-error', message: failed.error.message };

    const sum = (rows: { amount: number }[] | null) =>
      (rows ?? []).reduce((total: number, r: { amount: number }) => total + Number(r.amount ?? 0), 0);

    return {
      ok: true,
      data: {
        pendingDeposits: Number(pendD.count ?? 0),
        pendingWithdrawals: Number(pendW.count ?? 0),
        todayDeposited: sum(todayD.data as { amount: number }[] | null),
        todayWithdrawn: sum(todayW.data as { amount: number }[] | null),
        totalPlayers: Number(players.count ?? 0),
      },
    };
  } catch (error) {
    return {
      ok: false,
      reason: 'db-error',
      message: error instanceof Error ? error.message : 'Database error while fetching dashboard stats',
    };
  }
}

/**
 * Approve or reject one request. The SQL function refuses anything that is no
 * longer pending, so a double-clicked Approve pays out once.
 */
export async function reviewRequest(
  table: 'deposits' | 'withdrawals',
  id: number,
  action: 'approve' | 'reject',
  note: string,
): Promise<CashierResult<null>> {
  const db = adminClient();
  if (!db) return NO_BACKEND;

  const fn = `${action}_${table === 'deposits' ? 'deposit' : 'withdrawal'}`;
  const { error } = await db.rpc(fn, { p_id: id, p_note: note || null });
  if (error) {
    // since 014 an approval is when the money leaves the wallet, so the
    // player may have played it away while the request waited
    if (fn === 'approve_withdrawal' && /check constraint|balance/i.test(error.message)) {
      return {
        ok: false,
        reason: 'db-error',
        message: `Request #${id}: the player's balance no longer covers it — they have played the money since asking. Reject it.`,
      };
    }
    const left = fn === 'approve_withdrawal' ? /turnover left (\d+)/i.exec(error.message) : null;
    if (left) {
      return { ok: false, reason: 'db-error', message: `Request #${id}: bonus turnover is not finished — ৳${(Number(left[1]) / 100).toLocaleString('en-IN')} still to bet. Reject it, or wait.` };
    }
    if (fn === 'approve_withdrawal' && /account locked/i.test(error.message)) {
      return { ok: false, reason: 'db-error', message: `Request #${id}: the player's withdrawals are locked — unlock them first, or reject it.` };
    }
    if (fn === 'approve_withdrawal' && /account (held|banned)/i.test(error.message)) {
      return { ok: false, reason: 'db-error', message: `Request #${id}: the account is on hold or banned — lift that first, or reject it.` };
    }
    return { ok: false, reason: 'db-error', message: error.message };
  }

  if (table === 'deposits' && action === 'approve') {
    const bonus = await payDepositBonus(db, id);
    if (!bonus.ok) {
      return {
        ok: false,
        reason: 'db-error',
        message: `The deposit was approved, but its bonus was not paid: ${bonus.message}`,
      };
    }
  }

  return { ok: true, data: null };
}

/** The method bonus on an approved deposit ("+5% on bKash").

    The deposit screen has always promised it, and nothing ever paid it: the
    browser wrote a figure into the row and approve_deposit credited the
    deposit alone. The percent is read here, at approval, from the cashier
    config — the operator's number, not one the browser sent. The ledger ref
    names the deposit, and migration 012 makes that ref unique, so approving
    twice cannot pay twice. */
async function payDepositBonus(
  db: NonNullable<ReturnType<typeof adminClient>>,
  id: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: row, error } = await db
    .from('deposits')
    .select('user_id, amount, method_id, channel_id')
    .eq('id', id)
    .maybeSingle<Record<string, unknown>>();
  if (error) return isMissingColumn(error.message) ? { ok: true } : { ok: false, message: error.message };

  const deposit = row as { user_id: string; amount: number; method_id: string | null; channel_id: string } | null;
  if (!deposit?.method_id) return { ok: true };

  // loaded here rather than at the top: this module's types are imported by
  // client components, and the store reads the disk
  const { getCashierConfig } = await import('./cashier-config-store');
  const method = (await getCashierConfig()).deposit.methods.find((m) => m.id === deposit.method_id);
  /* The player writes method_id themselves. A Nagad deposit filed under the
     bKash method used to be paid bKash's bonus once the admin had checked
     the Nagad money — so the method has to be the channel the money came
     by, still on offer, and the amount inside its limits. */
  const taka = Number(deposit.amount) / 100;
  if (!method || method.channelId !== deposit.channel_id || !method.active
      || taka < method.min || taka > method.max) {
    return { ok: true };
  }
  const percent = Math.min(Math.max(Number(method?.bonusPercent ?? 0), 0), 100);
  const bonus = Math.floor((Number(deposit.amount) * percent) / 100);
  if (bonus <= 0) return { ok: true };

  const { creditBonus } = await import('./bonus-credit');
  const credit = await creditBonus(db, {
    user: deposit.user_id,
    kind: 'bonus',
    amount: bonus,
    ref: `deposit-bonus:${id}`,
  });
  if (credit.error) {
    if (credit.error.code === '23505') return { ok: true }; // paid already
    return { ok: false, message: credit.error.message };
  }

  await db.from('deposits').update({ bonus_amount: bonus }).eq('id', id);
  return { ok: true };
}

/** Hand-adjust a balance. `amount` is paisa and may be negative. */
export async function adjustBalance(
  userId: string,
  amount: number,
  note: string,
): Promise<CashierResult<number>> {
  const db = adminClient();
  if (!db) return NO_BACKEND;

  const { data, error } = await db.rpc('adjust_balance', {
    p_user: userId,
    p_amount: amount,
    p_note: note || 'admin adjust',
  });
  if (error) return { ok: false, reason: 'db-error', message: error.message };

  return { ok: true, data: Number(data ?? 0) };
}

/** Ban or unban. `is_blocked` has been on profiles since the first schema
    but nothing ever read it — a blocked player went on playing. Now the game,
    bonus and withdraw paths refuse a banned account (lib/player-status.ts and
    migration 012), and the auth user is banned as well, so their session
    cannot be refreshed and a fresh login is refused. */
export async function setBlocked(
  userId: string,
  blocked: boolean,
  reason = '',
  by = '',
): Promise<CashierResult<null>> {
  const db = adminClient();
  if (!db) return NO_BACKEND;

  const full = {
    is_blocked: blocked,
    block_reason: blocked ? reason || null : null,
    status_changed_at: new Date().toISOString(),
    status_changed_by: by || null,
  };
  let { error } = await db.from('profiles').update(full).eq('id', userId);
  // before migration 012 there is only the flag itself to write
  if (error && isMissingColumn(error.message)) {
    ({ error } = await db.from('profiles').update({ is_blocked: blocked }).eq('id', userId));
  }
  if (error) return { ok: false, reason: 'db-error', message: error.message };

  const { error: authError } = await db.auth.admin.updateUserById(userId, {
    ban_duration: blocked ? '876000h' : 'none',
  });
  if (authError) {
    return {
      ok: false,
      reason: 'db-error',
      message: `Saved, but the login ban could not be set: ${authError.message}`,
    };
  }

  return { ok: true, data: null };
}

/** Put an account on hold, or release it. On hold the player can still sign
    in and see their balance; nothing moves until it is released. */
export async function setHeld(
  userId: string,
  held: boolean,
  reason = '',
  by = '',
): Promise<CashierResult<null>> {
  const db = adminClient();
  if (!db) return NO_BACKEND;

  const { error } = await db
    .from('profiles')
    .update({
      is_held: held,
      hold_reason: held ? reason || null : null,
      status_changed_at: new Date().toISOString(),
      status_changed_by: by || null,
    })
    .eq('id', userId);

  if (error) {
    return {
      ok: false,
      reason: 'db-error',
      message: isMissingColumn(error.message)
        ? 'Hold needs migration 012 — run supabase/012_player_ids_hold_ban.sql in Supabase first.'
        : error.message,
    };
  }
  return { ok: true, data: null };
}

type RawProfile = { phone: string; display_name: string | null; player_no?: number | null };
type RawWallet = {
  balance: number; bonus_balance: number; turnover_need: number; turnover_done: number;
};

/** PostgREST returns an embedded row as an object, or an array on some shapes. */
const one = <T>(value: T | T[] | null): T | null =>
  (Array.isArray(value) ? value[0] : value) ?? null;

function toCashierRow(row: Record<string, unknown>): CashierRow {
  const profile = one(row.profiles as RawProfile | RawProfile[] | null);
  return {
    id: Number(row.id),
    userId: String(row.user_id),
    phone: profile?.phone ?? String(row.user_phone ?? '—'),
    displayName: profile?.display_name ?? (row.user_display_name as string | null) ?? null,
    playerNo: profile?.player_no == null ? null : Number(profile.player_no),
    channelId: String(row.channel_id),
    amount: Number(row.amount ?? 0),
    state: row.state as RequestState,
    adminNote: (row.admin_note as string) ?? null,
    createdAt: String(row.created_at),
    reviewedAt: (row.reviewed_at as string) ?? null,
    senderNo: (row.sender_no as string) ?? null,
    txnId: (row.txn_id as string) ?? null,
    accountNo: (row.account_no as string) ?? null,
    chargeAmount: Number(row.charge_amount ?? 0),
    chargeChannelId: (row.charge_channel_id as string) ?? null,
    chargeAccountNo: (row.charge_account_no as string) ?? null,
    chargeTrxId: (row.charge_trx_id as string) ?? null,
    chargePaidAt: (row.charge_paid_at as string) ?? null,
  };
}

function toPlayerRow(row: Record<string, unknown>): PlayerRow {
  const wallet = one(row.wallets as RawWallet | RawWallet[] | null);
  return {
    id: String(row.id),
    phone: String(row.phone),
    displayName: (row.display_name as string) ?? null,
    role: String(row.role ?? 'player'),
    vipLevel: Number(row.vip_level ?? 0),
    referralCode: String(row.referral_code ?? ''),
    agentCode: (row.agent_code as string) || null,
    playerNo: row.player_no == null ? null : Number(row.player_no),
    isBlocked: Boolean(row.is_blocked),
    isHeld: Boolean(row.is_held),
    blockReason: (row.block_reason as string) || null,
    holdReason: (row.hold_reason as string) || null,
    withdrawLocked: Boolean(row.withdraw_locked),
    lockReason: (row.lock_reason as string) || null,
    lockedAt: (row.locked_at as string) || null,
    lockedBy: (row.locked_by as string) || null,
    appeal: null,
    createdAt: String(row.created_at),
    balance: Number(wallet?.balance ?? 0),
    bonusBalance: Number(wallet?.bonus_balance ?? 0),
    turnoverNeed: Number(wallet?.turnover_need ?? 0),
    turnoverDone: Number(wallet?.turnover_done ?? 0),
  };
}
