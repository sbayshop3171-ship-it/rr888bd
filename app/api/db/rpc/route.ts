import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import type { PoolConnection } from 'mysql2/promise';
import { ensureMysqlSchema, getMysqlPool, parseMysqlUserId } from '@/lib/mysql-server';
import { parseSessionUserId } from '@/lib/session-cookie';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PLAYER_RPCS = new Set([
  'has_transaction_password',
  'set_transaction_password',
  'verify_transaction_password',
]);

/** MySQL equivalents for the cashier RPCs used by the shared data layer. */
export async function POST(req: Request) {
  try {
    const internalKey = req.headers.get('x-internal-rpc-key');
    const internal = Boolean(process.env.ADMIN_PASSWORD && internalKey === process.env.ADMIN_PASSWORD);
    const { fn, args = {} } = await req.json() as { fn?: string; args?: Record<string, unknown> };
    if (!internal && (!fn || !PLAYER_RPCS.has(fn))) return json({ message: 'Forbidden' }, 403);
    await ensureMysqlSchema();
    const pool = await getMysqlPool();

    const userId = internal ? String(args.p_user ?? '') : await sessionUserId();
    if (!internal && !userId) return json({ message: 'Unauthorized' }, 401);

    if (fn === 'has_transaction_password') {
      return json({ data: await hasTransactionPassword(pool, userId) });
    }
    if (fn === 'set_transaction_password') {
      return json({ data: await setTransactionPassword(pool, userId, args) });
    }
    if (fn === 'verify_transaction_password') {
      return json({ data: await verifyTransactionPassword(pool, userId, String(args.p_password ?? '')) });
    }
    if (fn === 'password_lock_left') {
      return json({ data: await passwordLockLeft(pool, String(args.p_user ?? '')) });
    }
    if (fn === 'password_attempt') {
      return json({ data: await passwordAttempt(pool, String(args.p_user ?? ''), args.p_ok === true) });
    }

    if (fn === 'wallet_apply') {
      return json({ data: await applyWallet(pool, args) });
    }

    if (fn === 'request_withdrawal') {
      return json({ data: await requestWithdrawal(pool, args) });
    }
    if (fn === 'approve_withdrawal' || fn === 'reject_withdrawal') {
      return json({ data: await reviewWithdrawal(pool, Number(args.p_id), fn === 'approve_withdrawal', String(args.p_note ?? '')) });
    }
    if (fn === 'pay_withdrawal_charge') {
      return json({ data: await payWithdrawalCharge(pool, args) });
    }

    const id = Number(args.p_id);
    const note = args.p_note == null ? null : String(args.p_note);
    if (!Number.isInteger(id) || id <= 0) return json({ message: 'Invalid request id' }, 400);

    if (fn === 'approve_deposit' || fn === 'reject_deposit') {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [rows] = await connection.execute(
          'SELECT id, user_id, amount, state, created_at FROM deposits WHERE id = ? FOR UPDATE',
          [id],
        );
        const deposit = (rows as Record<string, unknown>[])[0];
        if (!deposit) throw new Error(`deposit ${id} not found`);
        if (deposit.state !== 'pending') throw new Error(`deposit ${id} already ${deposit.state}`);

        const approved = fn === 'approve_deposit';
        const depositUserId = parseMysqlUserId(deposit.user_id);
        if (approved && depositUserId === null) {
          throw new Error(`deposit ${id} has invalid user_id; reject this request`);
        }

        await connection.execute(
          'UPDATE deposits SET state = ?, status = ?, admin_note = ?, reviewed_at = NOW() WHERE id = ?',
          [approved ? 'approved' : 'rejected', approved ? 'approved' : 'rejected', note, id],
        );

        if (approved) {
          const [users] = await connection.execute(
            'SELECT id FROM users WHERE id = ? LIMIT 1',
            [depositUserId],
          );
          if (!(users as Record<string, unknown>[]).length) {
            throw new Error(`deposit ${id} user not found; reject this request`);
          }

          const amount = Number(deposit.amount ?? 0);
          if (!Number.isSafeInteger(amount) || amount <= 0) {
            throw new Error(`deposit ${id} has invalid amount`);
          }
          const reference = `deposit:${id}`;
          const [ledgerRows] = await connection.execute(
            'SELECT id FROM transactions WHERE user_id = ? AND (reference = ? OR ref = ?) LIMIT 1',
            [depositUserId, reference, reference],
          );
          if ((ledgerRows as Record<string, unknown>[]).length) {
            throw new Error(`deposit ${id} is already credited`);
          }

          const [walletRows] = await connection.execute(
            'SELECT balance FROM wallets WHERE user_id = ? FOR UPDATE',
            [depositUserId],
          );
          const wallet = (walletRows as Record<string, unknown>[])[0];
          const before = Number(wallet?.balance ?? 0);
          const after = before + amount;
          if (!Number.isSafeInteger(before) || !Number.isSafeInteger(after)) {
            throw new Error(`deposit ${id} would overflow wallet balance`);
          }

          if (wallet) {
            await connection.execute(
              'UPDATE wallets SET balance = ? WHERE user_id = ?',
              [after, depositUserId],
            );
          } else {
            await connection.execute(
              'INSERT INTO wallets (user_id, balance, bonus_balance, turnover_need, turnover_done) VALUES (?, ?, 0, 0, 0)',
              [depositUserId, amount],
            );
          }
          await connection.execute(
            `INSERT INTO transactions
             (user_id, type, kind, amount, balance_before, balance_after, reference, ref, status, notes)
             VALUES (?, 'deposit', 'deposit', ?, ?, ?, ?, ?, 'completed', ?)`,
            [depositUserId, amount, before, after, reference, reference, `Deposit #${id}`],
          );
          await unlockAfterVerification(connection, String(depositUserId));
        }

        await connection.commit();
        return json({ data: null });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }

    return json({ message: `Unsupported RPC: ${String(fn ?? '')}` }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database error';
    const expected = /wrong password|insufficient balance|already|not pending|wallet not found|invalid transaction|invalid user_id|user not found|invalid amount|overflow wallet|turnover|reject this request/i.test(message);
    return json({ message }, expected ? 400 : 500);
  }
}

async function sessionUserId() {
  return parseSessionUserId((await cookies()).get('rr888bd_session')?.value);
}

async function hasTransactionPassword(
  pool: Awaited<ReturnType<typeof getMysqlPool>>,
  userId: string,
) {
  const [rows] = await pool.execute(
    'SELECT transaction_password_hash FROM users WHERE id = ? LIMIT 1',
    [userId],
  );
  return Boolean((rows as Record<string, unknown>[])[0]?.transaction_password_hash);
}

async function setTransactionPassword(
  pool: Awaited<ReturnType<typeof getMysqlPool>>,
  userId: string,
  args: Record<string, unknown>,
) {
  const next = String(args.p_new ?? '');
  const old = String(args.p_old ?? '');
  if (next.length < 6 || next.length > 16) throw new Error('Invalid transaction password');

  const [rows] = await pool.execute(
    'SELECT password_hash, transaction_password_hash FROM users WHERE id = ? LIMIT 1',
    [userId],
  );
  const user = (rows as Record<string, unknown>[])[0];
  if (!user) throw new Error('User not found');
  const currentHash = String(user.transaction_password_hash ?? user.password_hash ?? '');
  if (!currentHash || !(await bcrypt.compare(old, currentHash))) return 'wrong';

  const hash = await bcrypt.hash(next, 10);
  await pool.execute(
    'UPDATE users SET transaction_password_hash = ?, transaction_password_failed = 0, transaction_password_locked_until = NULL WHERE id = ?',
    [hash, userId],
  );
  return 'ok';
}

async function verifyTransactionPassword(
  pool: Awaited<ReturnType<typeof getMysqlPool>>,
  userId: string,
  password: string,
) {
  const [rows] = await pool.execute(
    'SELECT password_hash, transaction_password_hash, transaction_password_locked_until FROM users WHERE id = ? LIMIT 1',
    [userId],
  );
  const user = (rows as Record<string, unknown>[])[0];
  if (!user) return false;
  const lockedUntil = user.transaction_password_locked_until
    ? new Date(String(user.transaction_password_locked_until)).getTime()
    : 0;
  if (lockedUntil > Date.now()) return false;
  const hash = String(user.transaction_password_hash ?? user.password_hash ?? '');
  const ok = Boolean(hash) && await bcrypt.compare(password, hash);
  if (ok) {
    await pool.execute(
      'UPDATE users SET transaction_password_failed = 0, transaction_password_locked_until = NULL WHERE id = ?',
      [userId],
    );
    return true;
  }
  const [failedRows] = await pool.execute(
    'SELECT transaction_password_failed FROM users WHERE id = ? LIMIT 1',
    [userId],
  );
  const failed = Number((failedRows as Record<string, unknown>[])[0]?.transaction_password_failed ?? 0) + 1;
  await pool.execute(
    'UPDATE users SET transaction_password_failed = ?, transaction_password_locked_until = ? WHERE id = ?',
    [failed, failed >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null, userId],
  );
  return false;
}

async function passwordLockLeft(
  pool: Awaited<ReturnType<typeof getMysqlPool>>,
  userId: string,
) {
  const [rows] = await pool.execute(
    'SELECT transaction_password_locked_until FROM users WHERE id = ? LIMIT 1',
    [userId],
  );
  const until = (rows as Record<string, unknown>[])[0]?.transaction_password_locked_until;
  return until ? Math.max(0, Math.ceil((new Date(String(until)).getTime() - Date.now()) / 1000)) : 0;
}

async function passwordAttempt(
  pool: Awaited<ReturnType<typeof getMysqlPool>>,
  userId: string,
  ok: boolean,
) {
  if (ok) {
    await pool.execute(
      'UPDATE users SET transaction_password_failed = 0, transaction_password_locked_until = NULL WHERE id = ?',
      [userId],
    );
  }
  return null;
}

async function requestWithdrawal(
  pool: Awaited<ReturnType<typeof getMysqlPool>>,
  args: Record<string, unknown>,
) {
  const userId = String(args.p_user ?? '');
  const channel = String(args.p_channel ?? '').slice(0, 64);
  const amount = Number(args.p_amount);
  const accountNo = String(args.p_account_no ?? '').replace(/[\s-]+/g, '').slice(0, 100);
  const password = String(args.p_password ?? '');
  if (!/^\d+$/.test(userId) || !channel || !accountNo || !Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error('Invalid withdrawal request');
  }

  const [userRows] = await pool.execute(
    'SELECT phone, display_name, password_hash, transaction_password_hash FROM users WHERE id = ? LIMIT 1',
    [userId],
  );
  const user = (userRows as Record<string, unknown>[])[0];
  if (!user) throw new Error('User not found');
  const passwordHash = String(user.transaction_password_hash ?? user.password_hash ?? '');
  if (!passwordHash || !(await bcrypt.compare(password, passwordHash))) throw new Error('Wrong password');

  const id = String(Date.now() * 1000 + Math.floor(Math.random() * 1000));
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [walletRows] = await connection.execute(
      'SELECT balance FROM wallets WHERE user_id = ? FOR UPDATE',
      [userId],
    );
    const wallet = (walletRows as Record<string, unknown>[])[0];
    if (!wallet || Number(wallet.balance ?? 0) < amount) throw new Error('Insufficient balance');
    const before = Number(wallet.balance);
    const after = before - amount;
    await connection.execute('UPDATE wallets SET balance = ? WHERE user_id = ?', [after, userId]);
    await connection.execute(
      `INSERT INTO withdrawals
       (id, user_id, channel_id, amount, state, account_no, user_phone, user_display_name, debited)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, 1)`,
      [id, userId, channel, amount, accountNo, String(user.phone ?? ''), user.display_name == null ? null : String(user.display_name)] as (string | number | null)[],
    );
    await connection.execute(
      `INSERT INTO transactions (user_id, type, kind, amount, balance_before, balance_after, reference, ref, status)
       VALUES (?, 'withdrawal', 'withdrawal_hold', ?, ?, ?, ?, ?, 'completed')`,
      [userId, -amount, before, after, `withdrawal:${id}`, `withdrawal:${id}`],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return Number(id);
}

async function reviewWithdrawal(
  pool: Awaited<ReturnType<typeof getMysqlPool>>,
  id: number,
  approve: boolean,
  note: string,
) {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid request id');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      'SELECT id, user_id, amount, state, debited FROM withdrawals WHERE id = ? FOR UPDATE',
      [String(id)],
    );
    const withdrawal = (rows as Record<string, unknown>[])[0];
    if (!withdrawal) throw new Error('Withdrawal request not found');
    if (withdrawal.state !== 'pending' && !(withdrawal.state === 'approved' && !approve)) {
      throw new Error('Withdrawal request already answered');
    }

    const userId = String(withdrawal.user_id);
    const amount = Number(withdrawal.amount ?? 0);
    const reference = `withdrawal:${id}`;
    const debited = Boolean(withdrawal.debited);
    if (approve && !debited) {
      const [walletRows] = await connection.execute(
        'SELECT balance FROM wallets WHERE user_id = ? FOR UPDATE',
        [userId],
      );
      const wallet = (walletRows as Record<string, unknown>[])[0];
      if (!wallet || Number(wallet.balance ?? 0) < amount) throw new Error('Insufficient balance');
      const before = Number(wallet.balance);
      const after = before - amount;
      await connection.execute('UPDATE wallets SET balance = ? WHERE user_id = ?', [after, userId]);
      await connection.execute(
        `INSERT INTO transactions (user_id, type, kind, amount, balance_before, balance_after, reference, ref, status)
         VALUES (?, 'withdrawal', 'withdrawal', ?, ?, ?, ?, ?, 'completed')`,
        [userId, -amount, before, after, reference, reference],
      );
    }
    if (!approve && debited) {
      const [walletRows] = await connection.execute(
        'SELECT balance FROM wallets WHERE user_id = ? FOR UPDATE',
        [userId],
      );
      const wallet = (walletRows as Record<string, unknown>[])[0];
      if (!wallet) throw new Error('Wallet not found');
      const before = Number(wallet.balance);
      const after = before + amount;
      await connection.execute('UPDATE wallets SET balance = ? WHERE user_id = ?', [after, userId]);
      await connection.execute(
        `INSERT INTO transactions (user_id, type, kind, amount, balance_before, balance_after, reference, ref, status)
         VALUES (?, 'adjustment', 'adjustment', ?, ?, ?, ?, ?, 'completed')`,
        [userId, amount, before, after, `${reference}:refund`, `${reference}:refund`],
      );
    }

    await connection.execute(
      'UPDATE withdrawals SET state = ?, status = ?, debited = ?, admin_note = ?, reviewed_at = NOW() WHERE id = ?',
      [approve ? 'approved' : 'rejected', approve ? 'approved' : 'rejected', approve ? 1 : 0, note || null, String(id)],
    );
    await connection.commit();
    return null;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function payWithdrawalCharge(
  pool: Awaited<ReturnType<typeof getMysqlPool>>,
  args: Record<string, unknown>,
) {
  const id = String(args.p_id ?? '');
  const userId = String(args.p_user ?? '');
  const charge = Number(args.p_charge);
  const channel = String(args.p_channel ?? '').slice(0, 64) || null;
  const trx = String(args.p_trx ?? '').trim().slice(0, 255) || null;
  if (!/^\d+$/.test(id) || !/^\d+$/.test(userId) || !Number.isSafeInteger(charge) || charge <= 0 || !trx) {
    throw new Error('Invalid charge payment');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      'SELECT id, user_id, state, charge_amount, charge_trx_id FROM withdrawals WHERE id = ? AND user_id = ? FOR UPDATE',
      [id, userId],
    );
    const row = (rows as Record<string, unknown>[])[0];
    if (!row) throw new Error('Withdrawal request not found');
    if (row.state !== 'pending') throw new Error('Withdrawal already settled');
    if (row.charge_trx_id && String(row.charge_trx_id) !== trx) throw new Error('txn locked');

    const [usedRows] = await connection.execute(
      'SELECT id FROM withdrawals WHERE charge_trx_id = ? AND id <> ? LIMIT 1',
      [trx, id],
    );
    if ((usedRows as Record<string, unknown>[]).length) throw new Error('txn used');

    await connection.execute(
      `UPDATE withdrawals
       SET charge_amount = ?, charge_channel_id = ?, charge_trx_id = ?, charge_paid_at = COALESCE(charge_paid_at, NOW())
       WHERE id = ? AND user_id = ?`,
      [Number(row.charge_amount ?? 0) > 0 ? Number(row.charge_amount) : charge, channel, trx, id, userId],
    );
    await connection.commit();
    return null;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function applyWallet(
  pool: Awaited<ReturnType<typeof getMysqlPool>>,
  args: Record<string, unknown>,
) {
  const userId = String(args.p_user ?? '');
  const amount = Number(args.p_amount);
  const kind = String(args.p_kind ?? '');
  const reference = String(args.p_ref ?? '').slice(0, 100);
  const type = kind === 'adjust' ? 'adjustment' : kind;
  if (!/^\d+$/.test(userId) || !Number.isSafeInteger(amount) || !reference) {
    throw new Error('Invalid wallet transaction');
  }
  if (!['deposit', 'withdraw', 'bonus', 'bet', 'win', 'adjustment'].includes(type)) {
    throw new Error('Invalid wallet transaction type');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existingRows] = await connection.execute(
      'SELECT balance_after FROM transactions WHERE user_id = ? AND reference = ? AND status = ? LIMIT 1',
      [userId, reference, 'completed'],
    );
    const existing = (existingRows as Record<string, unknown>[])[0];
    if (existing) {
      await connection.commit();
      return Number(existing.balance_after);
    }

    const [walletRows] = await connection.execute(
      'SELECT balance FROM wallets WHERE user_id = ? FOR UPDATE',
      [userId],
    );
    const wallet = (walletRows as Record<string, unknown>[])[0];
    if (!wallet) throw new Error('Wallet not found');
    const before = Number(wallet.balance ?? 0);
    const after = before + amount;
    if (after < 0) throw new Error('Insufficient balance');

    await connection.execute('UPDATE wallets SET balance = ? WHERE user_id = ?', [after, userId]);
    await connection.execute(
      `INSERT INTO transactions
       (user_id, type, kind, amount, balance_before, balance_after, reference, ref, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed')`,
      [userId, type, type, amount, before, after, reference, reference],
    );
    await connection.commit();
    return after;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function unlockAfterVerification(connection: PoolConnection, userId: string) {
  const [profiles] = await connection.execute(
    'SELECT withdraw_locked, verification_deposit_amount, locked_at FROM profiles WHERE id = ? FOR UPDATE',
    [userId],
  );
  const profile = (profiles as Record<string, unknown>[])[0];
  const target = Number(profile?.verification_deposit_amount ?? 0);
  if (!profile || !profile.withdraw_locked || target <= 0) return;

  const [deposits] = await connection.execute(
    'SELECT COALESCE(SUM(amount), 0) AS total FROM deposits WHERE user_id = ? AND state = ? AND created_at >= COALESCE(?, created_at)',
    [userId, 'approved', profile.locked_at == null ? null : String(profile.locked_at)] as (string | null)[],
  );
  const total = Number((deposits as Record<string, unknown>[])[0]?.total ?? 0);
  if (total < target) return;

  await connection.execute(
    'UPDATE profiles SET withdraw_locked = 0, lock_reason = NULL, locked_at = NULL, locked_by = NULL, verification_deposit_amount = 0 WHERE id = ? AND withdraw_locked = 1',
    [userId],
  );
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'cache-control': 'no-store' } });
}
