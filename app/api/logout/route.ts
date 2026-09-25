import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    (await cookies()).delete('rr888bd_session');
    (await cookies()).set('rr888bd_session', '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      expires: new Date(0),
      maxAge: 0,
    });
    return NextResponse.json({ success: true, message: 'Logged out successfully', data: null });
  } catch {
    return NextResponse.json({ success: false, message: 'Logout failed', data: null }, { status: 500 });
  }
}
