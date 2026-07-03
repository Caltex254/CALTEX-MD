import { NextRequest, NextResponse } from 'next/server';
import { generateToken, comparePassword, hashPassword } from '@/lib/auth';

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS_HASH = process.env.ADMIN_PASS || 'admin123';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Username and password are required' },
        { status: 400 }
      );
    }

    if (username !== ADMIN_USER) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const storedHash = await hashPassword(ADMIN_PASS_HASH);
    const isValid = await comparePassword(password, storedHash);

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const token = await generateToken({ username, role: 'admin' });

    return NextResponse.json({
      success: true,
      data: { token, username, role: 'admin' },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Login failed' },
      { status: 500 }
    );
  }
}
