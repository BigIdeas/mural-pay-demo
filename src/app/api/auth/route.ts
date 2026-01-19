import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const MERCHANT_USER = process.env.MERCHANT_USER || 'admin';
const MERCHANT_PASS = process.env.MERCHANT_PASS || 'mural123';
const AUTH_COOKIE = 'merchant_auth';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (username === MERCHANT_USER && password === MERCHANT_PASS) {
      const cookieStore = await cookies();
      cookieStore.set(AUTH_COOKIE, 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24, // 24 hours
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE);
  return NextResponse.json({ success: true });
}

export async function GET() {
  const cookieStore = await cookies();
  const isAuthenticated = cookieStore.get(AUTH_COOKIE)?.value === 'authenticated';
  return NextResponse.json({ authenticated: isAuthenticated });
}
