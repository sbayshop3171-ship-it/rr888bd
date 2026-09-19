import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth-next';
import type { AdminSession } from '@/lib/admin-auth';
import { can } from '@/lib/admin-roles';
import { listCashier, reviewRequest, type RequestState } from '@/lib/cashier';
import { inScope, playerScope } from '@/lib/player-scope';
import { adminClient } from '@/lib/supabase';
import { DEFAULT_LOCK_REASON, setWithdrawLock } from '@/lib/withdraw-lock';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TABLES = ['deposits', 'withdrawals'] as const;
const STATES = ['pending', 'approved', 'rejected', 'cancelled', 'all'];

/** Deposits and withdrawals are separate boxes on the staff screen, so the
    queue a request names decides which one it needs. */
const REVIEW = { deposits: 'deposits.review', withdrawals: 'withdrawals.review' } as const;

export async function GET(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const table = url.searchParams.get('table');
  const state = url.searchParams.get('state') ?? 'pending';

  if (!isTable(table)) return json({ ok: false, reason: 'invalid-table' }, 400);
  if (!can(gate.session, REVIEW[table])) return json({ ok: false, reason: 'forbidden' }, 403);
  if (!STATES.includes(state)) return json({ ok: false, reason: 'invalid-state' }, 400);

  const search = url.searchParams.get('search') ?? '';
  const result = await listCashier(table, state as RequestState | 'all', 100, search);
  return result.ok
    ? json({ ok: true, rows: result.data })
    : json(result, result.reason === 'no-backend' ? 503 : 500);
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;
  const { session } = gate;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, reason: 'invalid-json' }, 400);
  }

  if (!body || typeof body !== 'object') return json({ ok: false, reason: 'invalid-action' }, 400);
  const record = body as Record<string, unknown>;

  const table = record.table;
  const decision = record.decision;
  const id = Number(record.id);

  if (!isTable(table)) return json({ ok: false, reason: 'invalid-table' }, 400);
  if (!can(session, REVIEW[table])) return json({ ok: false, reason: 'forbidden' }, 403);
  if (decision !== 'approve' && decision !== 'reject' && decision !== 'lock') {
    return json({ ok: false, reason: 'invalid-decision' }, 400);
  }
  if (!Number.isInteger(id) || id <= 0) return json({ ok: false, reason: 'invalid-id' }, 400);

  if (decision === 'lock') {
    const locked = await lockFromRequest(session, table, id, String(record.reason ?? ''));
    if (!locked.ok) return json({ ok: false, reason: 'lock-failed', message: locked.message }, locked.status);
  } else {
    // The reviewing admin is not a Supabase user, so reviewed_by stays null —
    // record who acted in the note instead.
    const typed = String(record.note ?? '').trim().slice(0, 200);
    const trxId = String(record.trxId ?? '').trim().slice(0, 255);
    const note = typed ? `${session.username}: ${typed}` : session.username;

    const result = await reviewRequest(table, id, decision, note);
    if (!result.ok) return json(result, result.reason === 'no-backend' ? 503 : 400);
    if (table === 'withdrawals' && decision === 'approve' && trxId) {
      const db = adminClient();
      await db?.from('withdrawals').update({ charge_trx_id: trxId }).eq('id', id);
    }
  }

  // The screen sends back whichever filter it is showing. An unknown value
  // used to reach the database as an enum and come back as an empty queue.
  const listState = STATES.includes(String(record.state))
    ? (record.state as RequestState | 'all')
    : 'pending';
  const rows = await listCashier(table, listState, 100, String(record.search ?? ''));
  // The decision is saved either way; an empty list here would read as
  // "nothing waiting", so say plainly that only the reload failed.
  return rows.ok
    ? json({ ok: true, rows: rows.data })
    : json({ ok: false, reason: 'db-error', message: 'Saved — but the list could not be reloaded. Refresh the page.' });
}

/** Lock from the withdrawal queue: stop the player's withdrawals with the
    reason they will read on My Account, then turn this request down (a
    request raised before migration 014 gets its held money back). The lock goes first — if it
    cannot be set (no migration 013, an agent outside their own players) the
    request is left exactly as it was. */
async function lockFromRequest(
  session: AdminSession,
  table: (typeof TABLES)[number],
  id: number,
  typedReason: string,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  if (table !== 'withdrawals') return { ok: false, status: 400, message: 'Only a withdrawal can be locked.' };
  if (!can(session, 'players.lock')) return { ok: false, status: 403, message: 'You cannot lock players.' };

  const db = adminClient();
  if (!db) return { ok: false, status: 503, message: 'The database is not connected.' };

  const { data, error } = await db.from('withdrawals').select('user_id, state').eq('id', id).maybeSingle();
  if (error) return { ok: false, status: 500, message: error.message };
  const row = data as { user_id: string; state: string } | null;
  if (!row) return { ok: false, status: 404, message: 'That request no longer exists.' };
  if (row.state !== 'pending') return { ok: false, status: 409, message: 'That request has already been answered.' };

  if (!(await inScope(await playerScope(session), row.user_id))) {
    return { ok: false, status: 403, message: 'Agents can lock only players who joined through their own link.' };
  }

  const reason = typedReason.trim().slice(0, 200);
  const lock = await setWithdrawLock(db, row.user_id, true, reason, session.username);
  if (!lock.ok) return { ok: false, status: 400, message: lock.message };

  const note = `${session.username}: Locked — ${reason || DEFAULT_LOCK_REASON}`.slice(0, 240);
  const reject = await reviewRequest('withdrawals', id, 'reject', note);
  if (!reject.ok) {
    return {
      ok: false,
      status: 400,
      message: `The player is locked, but the request was not returned: ${reject.message ?? reject.reason}. Reject it by hand.`,
    };
  }
  return { ok: true };
}

function isTable(value: unknown): value is (typeof TABLES)[number] {
  return TABLES.includes(value as (typeof TABLES)[number]);
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'cache-control': 'no-store' } });
}
