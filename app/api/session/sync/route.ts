import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getUserById } from '@/lib/mysql-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json() as { userId?: unknown };
    const userId = String(body.userId || '');
    if (!/^\d+$/.test(userId)) return NextResponse.json({ ok: false }, { status: 400 });

    const user = await getUserById(userId);
    if (!user || user.is_blocked) return NextResponse.json({ ok: false }, { status: 401 });

    const session = encodeURIComponent(JSON.stringify({ user: { id: userId } }));
    (await cookies()).set('rr888bd_session', session, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
