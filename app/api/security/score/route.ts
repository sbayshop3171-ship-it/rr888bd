import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ensureMysqlSchema, getMysqlPool } from '@/lib/mysql-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const raw = (await cookies()).get('rr888bd_session')?.value;
    const session = raw ? JSON.parse(decodeURIComponent(raw)) as { user?: { id?: string } } : null;
    const userId = String(session?.user?.id ?? '');
    if (!/^\d+$/.test(userId)) return json({ ok: false, reason: 'unauthorized' }, 401);

    await ensureMysqlSchema();
    const pool = await getMysqlPool();
    const [[user]] = await pool.query(
      'SELECT display_name, real_name, transaction_password_hash FROM users WHERE id = ? LIMIT 1',
      [userId],
    ) as [Record<string, unknown>[], unknown];
    const [wallets] = await pool.query(
      'SELECT id FROM payout_accounts WHERE user_id = ? LIMIT 1',
      [userId],
    ) as [Record<string, unknown>[], unknown];
    if (!user) return json({ ok: false, reason: 'unauthorized' }, 401);

    const personal = Boolean(user.real_name && user.display_name);
    const wallet = wallets.length > 0;
    const transactionPassword = Boolean(user.transaction_password_hash);
    const score = Math.round((personal ? 50 : 0) + (wallet ? 50 / 3 : 0) + 50 / 3 + (transactionPassword ? 50 / 3 : 0));
    return json({ ok: true, score, personal, wallet, transactionPassword });
  } catch (error) {
    return json({ ok: false, reason: 'db-error', message: error instanceof Error ? error.message : 'Database error' }, 500);
  }
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'cache-control': 'no-store' } });
}