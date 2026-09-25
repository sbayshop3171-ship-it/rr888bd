import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { registerUser } from '@/lib/mysql-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const phone = String(body.phone || '').trim();
    const password = String(body.password || '');
    if (!phone || password.length < 6) {
      return NextResponse.json({ message: 'Invalid phone or password' }, { status: 400 });
    }

    const user = await registerUser({
      phone,
      password,
      referralCode: body.referralCode || null,
      agentCode: body.agentCode || null,
    });

    const session = { user: { id: String(user.id), email: user.phone ? `${user.phone}@local-user` : null, created_at: new Date().toISOString() } };
    const token = `local.${Buffer.from(JSON.stringify({ userId: user.id, phone: user.phone })).toString('base64')}`;
    (await cookies()).set('rr888bd_session', JSON.stringify(session), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    return NextResponse.json({ success: true, message: 'Registration successful', data: { user, session, access_token: token } });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : 'Registration failed' }, { status: 400 });
  }
}
