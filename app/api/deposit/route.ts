import { randomInt } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ensureMysqlSchema, getMysqlPool, parseMysqlUserId } from '@/lib/mysql-server';
import { isKnownChannel } from '@/lib/payment-accounts-store';
import { parseSessionUserId } from '@/lib/session-cookie';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const userId = parseMysqlUserId(body.user_id);
    const gateway = String(body.gateway ?? '').trim();
    const trxid = String(body.trxid ?? '').trim().toUpperCase();
    const senderNumber = body.sender_number == null ? null : String(body.sender_number).trim();
    const amount = Number(body.amount);

    const sessionUserId = await currentSessionUserId();
    if (userId === null || sessionUserId === null || userId !== sessionUserId) {
      return fail('Unauthorized', 401);
    }
    if (!isKnownChannel(gateway)) return fail('Invalid deposit account or gateway', 400);
    if (!Number.isSafeInteger(amount) || amount <= 0) return fail('Invalid deposit amount', 400);
    if (!/^[A-Z0-9]{6,20}$/.test(trxid)) return fail('Invalid TrxID format', 400);
    if (senderNumber && senderNumber.length > 30) return fail('Invalid sender number', 400);

    await ensureMysqlSchema();
    const pool = await getMysqlPool();
    const [users] = await pool.execute('SELECT id FROM users WHERE id = ? LIMIT 1', [userId]);
    if (!(users as Record<string, unknown>[]).length) return fail('User not found', 404);
    const id = `${Date.now()}${randomInt(10, 100)}`;
    const [existing] = await pool.query(
      'SELECT id FROM deposits WHERE txn_id = ? LIMIT 1',
      [trxid],
    );
    if (Array.isArray(existing) && existing.length > 0) return fail('TrxID already used', 409);

    await pool.execute(
      `INSERT INTO deposits
        (id, user_id, channel_id, amount, state, status, sender_no, txn_id, method, method_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', 'pending', ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [id, userId, gateway, amount, senderNumber || null, trxid, String(body.method_id ?? gateway), String(body.method_id ?? gateway)],
    );

    return NextResponse.json({ ok: true, id, state: 'pending' }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Could not create deposit request', 500);
  }
}

async function currentSessionUserId(): Promise<number | null> {
  try {
    const raw = (await cookies()).get('rr888bd_session')?.value;
    if (!raw) return null;
    return parseMysqlUserId(parseSessionUserId(raw));
  } catch {
    return null;
  }
}

function fail(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status, headers: { 'cache-control': 'no-store' } });
}
