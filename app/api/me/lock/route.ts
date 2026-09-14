import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { adminClient, serverClient } from '@/lib/supabase';
import { lockStatus, sendAppeal } from '@/lib/withdraw-lock';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The signed-in player's withdraw lock (migration 013), and their appeal.
 *
 * GET  → { ok, status: LockStatus }
 * POST { message } → { ok, status } or { ok: false, reason, message }
 *
 * The appeal is written with the service role once the session says who is
 * asking — players have no insert on account_appeals, so they cannot write
 * one for somebody else or mark their own approved.
 */
export async function GET() {
  const who = await player();
  if (!who.ok) return who.response;
  return json({ ok: true, status: await lockStatus(who.db, who.uid) });
}

export async function POST(req: Request) {
  const who = await player();
  if (!who.ok) return who.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, reason: 'invalid-json', message: 'Bad request' }, 400);
  }
  const message = String((body as Record<string, unknown> | null)?.message ?? '');

  const result = await sendAppeal(who.db, who.uid, message);
  return result.ok ? json(result) : json(result, result.reason === 'db-error' ? 500 : 400);
}

async function player() {
  const cookieStore = await cookies();
  const rawSession = cookieStore.get('rr888bd_session')?.value;
  let cookieUserId = '';
  try {
    cookieUserId = String((JSON.parse(rawSession ?? '{}') as { user?: { id?: string } }).user?.id ?? '');
  } catch {
    cookieUserId = '';
  }
  const auth = serverClient(await cookieAdapter());
  const db = adminClient();
  if (!auth || !db) return { ok: false as const, response: json({ ok: false, reason: 'no-backend' }, 503) };

  const { data } = await auth.auth.getUser();
  const uid = data.user?.id ?? cookieUserId;
  if (!uid) return { ok: false as const, response: json({ ok: false, reason: 'unauthorized' }, 401) };
  return { ok: true as const, db, uid };
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

async function cookieAdapter() {
  const store = await cookies();
  return {
    getAll: () => store.getAll().map((c) => ({ name: c.name, value: c.value })),
    setAll: (list: { name: string; value: string; options?: object }[]) => {
      try {
        for (const c of list) store.set(c.name, c.value, c.options);
      } catch {
        /* read-only here */
      }
    },
  };
}
