import { NextResponse } from 'next/server';

// Session API URL — deployed on Render
const SESSION_API_URL = process.env.SESSION_API_URL || 'https://caltex-session-api.onrender.com';

// Public endpoint — NO AUTH REQUIRED
// Proxies warmup request to the CALTEX Session API on Render
// Call this BEFORE /pairing-code to ensure WhatsApp is ready
export async function GET() {
  try {
    // Allow up to 30s for warmup (covers Render cold start + WhatsApp init)
    const res = await fetch(`${SESSION_API_URL}/warmup`, {
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json();

    return NextResponse.json(data);
  } catch (error: any) {
    if (error.name === 'TimeoutError') {
      return NextResponse.json({
        success: false,
        data: {
          status: 'WARMING_UP',
          message: 'Session API is waking up — please try again in a few seconds',
        },
      }, { status: 202 });
    }
    return NextResponse.json({
      success: false,
      data: {
        status: 'OFFLINE',
        message: 'Session API is offline',
      },
    }, { status: 502 });
  }
}
