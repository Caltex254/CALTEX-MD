import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { username: user.username, role: user.role, valid: true },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Token verification failed' },
      { status: 500 }
    );
  }
}
