import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth-next';
import { can } from '@/lib/admin-roles';
import { adjustBalance, listPlayers, setBlocked, setHeld } from '@/lib/cashier';
import { inScope, playerScope } from '@/lib/player-scope';
import { adminClient } from '@/lib/supabase';
import { rejectAppeal, setWithdrawLock } from '@/lib/withdraw-lock';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** ৳100,000 a click is already far beyond any real correction. */
const MAX_ADJUST_PAISA = 100_000_00;

export async function GET(req: Request) {
  const gate = await requireAdmin('players.read');
  if (!gate.ok) return gate.response;

  const params = new URL(req.url).searchParams;
  const search = params.get('search') ?? '';
  // an agent's search runs over their own players only
  let result;
  try {
    result = await listPlayers(search, 100, await playerScope(gate.session), params.get('filter') === 'locked');
  } catch (error) {
    return json({ ok: false, reason: 'db-error', message: error instanceof Error ? error.message : 'The player list could not be read' }, 500);
  }
  return result.ok
    ? json({ ok: true, players: result.data })
    : json(result, result.reason === 'no-backend' ? 503 : 500);
}

/** What an agent may do to one of their own players: stop and restart
    withdrawals, and answer the appeal. Everything else is players.write. */
const LOCK_ACTIONS = new Set(['lock', 'unlock', 'reject-appeal']);

export async function POST(req: Request) {
  const gate = await requireAdmin('players.lock');
  if (!gate.ok) return gate.response;
  const { session } = gate;
  let scope;
  try {
    scope = await playerScope(session);
  } catch (error) {
    return json({ ok: false, reason: 'db-error', message: error instanceof Error ? error.message : 'Could not determine player scope' }, 500);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, reason: 'invalid-json' }, 400);
  }

  if (!body || typeof body !== 'object') return json({ ok: false, reason: 'invalid-action' }, 400);
  const record = body as Record<string, unknown>;
  const userId = String(record.userId ?? '');
  if (!userId) return json({ ok: false, reason: 'invalid-user' }, 400);

  const action = String(record.action ?? '');
  if (LOCK_ACTIONS.has(action)) {
    // an agent's own players only — asked again here, the id came from the body
    if (!(await inScope(scope, userId))) return json({ ok: false, reason: 'forbidden' }, 403);
  } else if (!can(session, 'players.write')) {
    return json({ ok: false, reason: 'forbidden' }, 403);
  }

  if (LOCK_ACTIONS.has(action)) {
    const db = adminClient();
    if (!db) return json({ ok: false, reason: 'no-backend' }, 503);
    const note = String(record.reason ?? '').trim().slice(0, 200);
    const result = action === 'reject-appeal'
      ? await rejectAppeal(db, userId, Number(record.appealId), note, session.username)
      : await setWithdrawLock(db, userId, action === 'lock', note, session.username);
    if (!result.ok) return json({ ok: false, reason: 'db-error', message: result.message }, 400);
  } else if (record.action === 'adjust') {
    const amount = Math.round(Number(record.amount));
    if (!Number.isFinite(amount) || amount === 0) {
      return json({ ok: false, reason: 'invalid-amount' }, 400);
    }
    if (Math.abs(amount) > MAX_ADJUST_PAISA) {
      return json({ ok: false, reason: 'amount-too-large' }, 400);
    }

    const typed = String(record.note ?? '').trim().slice(0, 200);
    const result = await adjustBalance(userId, amount, `${session.username}: ${typed || 'adjust'}`);
    if (!result.ok) return json(result, result.reason === 'no-backend' ? 503 : 400);
  } else if (record.action === 'block' || record.action === 'hold') {
    // why, and who — kept on the profile so the next person to open the
    // account sees it rather than having to ask around
    const reason = String(record.reason ?? '').trim().slice(0, 200);
    const result = record.action === 'block'
      ? await setBlocked(userId, Boolean(record.blocked), reason, session.username)
      : await setHeld(userId, Boolean(record.held), reason, session.username);
    if (!result.ok) return json(result, result.reason === 'no-backend' ? 503 : 400);
  } else {
    return json({ ok: false, reason: 'invalid-action' }, 400);
  }

  let players;
  try {
    players = await listPlayers(String(record.search ?? ''), 100, scope, record.filter === 'locked');
  } catch (error) {
    return json({ ok: false, reason: 'db-error', message: 'Saved — but the list could not be reloaded. Refresh the page.' }, 500);
  }
  // saved either way; an empty list would look like the player vanished
  return players.ok
    ? json({ ok: true, players: players.data })
    : json({ ok: false, reason: 'db-error', message: 'Saved — but the list could not be reloaded. Refresh the page.' });
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'cache-control': 'no-store' } });
}
