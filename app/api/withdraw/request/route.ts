import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { calculateFeePaisa } from '@/lib/cashier-config';
import { getCashierConfig } from '@/lib/cashier-config-store';
import { accountBlock } from '@/lib/player-status';
import { adminClient, serverClient } from '@/lib/supabase';
import { lockStatus } from '@/lib/withdraw-lock';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const lastWithdrawalByUser = new Map<string, number>();

/**
 * Raising a withdrawal.
 *
 * The browser used to call `request_withdrawal` itself, and the method's
 * minimum and maximum and the daily request count were checked only on the
 * screen — a player calling the function directly could ask for ৳10 or
 * ৳10 lakh, as often as they liked. Those limits live in the cashier config,
 * which the database cannot see, so they are checked here. The database then
 * checks what it can: the password, the hold/ban, bonus turnover, and the
 * balance (migration 012). Since 012 the function is callable only with the
 * service role, so this route is the one way in.
 *
 * { methodId, amount (taka), accountNo, password } → { ok, id } or a reason.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, reason: 'invalid-json', message: 'Bad request' }, 400);
  }
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};

  const store = await cookieAdapter();
  const asUser = serverClient(store);
  const asService = adminClient();
  if (!asUser || !asService) return fail('no-backend', 'Withdrawals are not connected yet', 503);

  const { data: auth } = await asUser.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return fail('unauthorized', 'Log in first to withdraw', 401);
  const previous = lastWithdrawalByUser.get(uid) ?? 0;
  if (Date.now() - previous < 60_000) {
    return fail('rate-limited', 'Please wait one minute before sending another withdrawal request', 429);
  }

  const blocked = await accountBlock(asService, uid);
  if (blocked === 'banned') return fail('account-banned', 'This account has been banned. Contact support.', 403);
  if (blocked === 'held') return fail('account-held', 'This account is on hold. Contact support.', 403);

  // locked (013): everything else still works, this does not
  const lock = await lockStatus(asService, uid);
  if (lock.locked) return fail('account-locked', `উইথড্র বন্ধ: ${lock.reason}`, 403);

  const cfg = (await getCashierConfig()).withdraw;
  const method = cfg.methods.find((m) => m.id === String(record.methodId ?? '') && m.active);
  if (!method) return fail('unknown-method', 'That withdrawal method is not available', 400);

  const taka = Number(record.amount);
  if (!Number.isFinite(taka) || taka <= 0) return fail('invalid-amount', 'Enter an amount', 400);
  if (taka < method.min) return fail('below-minimum', `Minimum ${fmt(method.min)}`, 400);
  if (taka > method.max) return fail('above-maximum', `Up to ${fmt(method.max)} in a single request`, 400);

  const accountNo = String(record.accountNo ?? '').replace(/[\s-]+/g, '').slice(0, 64);
  if (!accountNo) return fail('invalid-account', 'Enter an account number', 400);

  // Requests per player per Bangladesh day. Rejected and cancelled ones do
  // not use up the allowance — the player did not get that money.
  if (cfg.dailyLimit > 0) {
    const { count, error } = await asService
      .from('withdrawals')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', uid)
      .in('state', ['pending', 'approved'])
      .gte('created_at', bdDayStart());
    if (error) return fail('db-error', 'Could not send the request — try again', 500);
    if ((count ?? 0) >= cfg.dailyLimit) {
      return fail('daily-limit', 'Today’s withdrawal limit is used up — try again tomorrow', 429);
    }
  }

  /* Password guesses are counted (migration 018): five wrong in a row shut
     this for 15 minutes, so a stolen session cannot grind the fund
     password. Before 018 the function is missing and this is skipped. */
  const pwLock = await asService.rpc('password_lock_left', { p_user: uid });
  if (!pwLock.error && Number(pwLock.data) > 0) {
    return fail('password-locked', `Too many wrong passwords — try again in ${Math.ceil(Number(pwLock.data) / 60)} min`, 429);
  }

  const amount = Math.round(taka * 100);
  const feeAmount = calculateFeePaisa(amount, cfg);
  const payoutAmount = amount - feeAmount;
  if (payoutAmount <= 0) {
    return fail('invalid-fee', 'The withdrawal amount must be greater than the configured fee', 400);
  }
  const { data: wallet } = await asService.from('wallets').select('balance').eq('user_id', uid).maybeSingle();
  if ((Number(wallet?.balance ?? 0) - amount) < 0) {
    return fail('insufficient-balance', 'Not enough balance', 400);
  }

  // The pre-012 browser-side fallback is gone: it took no password and
  // checked no turnover, and 012+ are applied.
  const { data, error } = await asService.rpc('request_withdrawal', {
    p_user: uid,
    p_channel: method.channelId,
    p_amount: amount,
    p_fee_amount: feeAmount,
    p_payout_amount: payoutAmount,
    p_account_no: accountNo,
    p_password: String(record.password ?? ''),
  });

  if (error) {
    const m = error.message;
    const left = /turnover left (\d+)/i.exec(m);
    if (left) {
      return fail('turnover', `Bonus turnover first: bet ${fmt(Number(left[1]) / 100)} more, then you can withdraw`, 400);
    }
    if (/account banned/i.test(m)) return fail('account-banned', 'This account has been banned. Contact support.', 403);
    if (/account held/i.test(m)) return fail('account-held', 'This account is on hold. Contact support.', 403);
    if (/account locked/i.test(m)) return fail('account-locked', 'উইথড্র বন্ধ — অ্যাকাউন্টটি পর্যালোচনাধীন', 403);
    if (/wrong password/i.test(m)) {
      await asService.rpc('password_attempt', { p_user: uid, p_ok: false });
      return fail('wrong-password', 'Wrong password — go back and enter it again', 400);
    }
    if (/balance|check/i.test(m)) return fail('insufficient-balance', 'Not enough balance', 400);
    return fail('db-error', 'Could not send the request — try again', 500);
  }

  lastWithdrawalByUser.set(uid, Date.now());

  const id = typeof data === 'number' ? data : Number(data) || null;
  await asService.rpc('password_attempt', { p_user: uid, p_ok: true });

  // Withdrawal requests are complete once they enter the pending queue. The
  // database RPC has already deducted the requested amount atomically and
  // recorded the hold ledger entry; there is no agent-charge gate or second
  // TrxID step in this flow.
  return json({ ok: true, id, feeAmount, payoutAmount });
}

/** Start of today in Bangladesh (UTC+6), as an ISO instant. */
function bdDayStart() {
  const BD_OFFSET_MS = 6 * 60 * 60 * 1000;
  const bd = new Date(Date.now() + BD_OFFSET_MS);
  return new Date(Date.UTC(bd.getUTCFullYear(), bd.getUTCMonth(), bd.getUTCDate()) - BD_OFFSET_MS).toISOString();
}

const fmt = (taka: number) => `৳${taka.toLocaleString('en-IN')}`;

function fail(reason: string, message: string, status: number) {
  return json({ ok: false, reason, message }, status);
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

/** The reader/writer shape `serverClient` wants — Next's own cookie store
    is read-only in places, so writes that cannot land are dropped. */
async function cookieAdapter() {
  const store = await cookies();
  return {
    getAll: () => store.getAll().map((c) => ({ name: c.name, value: c.value })),
    setAll: (list: { name: string; value: string; options?: object }[]) => {
      try {
        for (const c of list) store.set({ name: c.name, value: c.value, ...(c.options ?? {}) });
      } catch {
        /* read-only here */
      }
    },
  };
}
