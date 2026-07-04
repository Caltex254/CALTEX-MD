import { NextRequest, NextResponse } from 'next/server';

// Session API URL — deployed on Render
const SESSION_API_URL = process.env.SESSION_API_URL || 'https://caltex-session-api.onrender.com';

// Public endpoint — NO AUTH REQUIRED
// Proxies pairing code request to the CALTEX Session API on Render
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumber } = body;

    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Validate phone format
    const cleanPhone = String(phoneNumber).replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone number — must be at least 10 digits' },
        { status: 400 }
      );
    }

    // Call the Session API
    // Render free tier may be sleeping — allow up to 60s for wake-up + pairing code generation
    const res = await fetch(`${SESSION_API_URL}/pairing-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: cleanPhone }),
      signal: AbortSignal.timeout(60000),
    });

    const data = await res.json();

    if (data.success) {
      return NextResponse.json({
        success: true,
        data: {
          sessionId: data.data.sessionId,
          pairingCode: data.data.pairingCode,
          phoneNumber: cleanPhone,
          expiresIn: data.data.expiresIn,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: data.error || 'Failed to generate pairing code' },
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
