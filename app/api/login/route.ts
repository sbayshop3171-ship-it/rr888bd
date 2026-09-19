import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { loginUser } from '@/lib/mysql-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const phone = String(body.phone || '').trim();
    const password = String(body.password || '');
    const user = await loginUser({ phone, password });
    const session = encodeURIComponent(JSON.stringify({ user: { id: user.id } }));
    (await cookies()).set('rr888bd_session', session, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    return NextResponse.json({ ok: true, user });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : 'Login failed' }, { status: 401 });
  }
}
