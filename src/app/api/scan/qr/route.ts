import { NextRequest, NextResponse } from 'next/server';

// Session API URL — deployed on Render
const SESSION_API_URL = process.env.SESSION_API_URL || 'https://caltex-session-api.onrender.com';

// Public endpoint — NO AUTH REQUIRED
// GET: Check session status (polling for connection)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId query parameter is required' },
        { status: 400 }
      );
    }

    const res = await fetch(`${SESSION_API_URL}/session/${sessionId}`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Failed to check session status' },
      { status: 502 }
    );
  }
}

// POST: Generate QR code
export async function POST() {
  try {
    const res = await fetch(`${SESSION_API_URL}/qr-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(20000),
    });

    const data = await res.json();

    if (data.success) {
      return NextResponse.json({
        success: true,
        data: {
          sessionId: data.data.sessionId,
          qrCode: data.data.qrCode,
          status: data.data.status,
          expiresIn: data.data.expiresIn,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: data.error || 'Failed to generate QR code' },
      { status: res.status }
    );
  } catch (error: any) {
    if (error.name === 'TimeoutError') {
      return NextResponse.json(
        { success: false, error: 'Session API is responding slowly. Please try again.' },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Failed to connect to Session API' },
      { status: 502 }
    );
  }
}
