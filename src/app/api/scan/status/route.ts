import { NextRequest, NextResponse } from 'next/server';

// Session API URL — deployed on Render
const SESSION_API_URL = process.env.SESSION_API_URL || 'https://caltex-session-api.onrender.com';

// Public endpoint — NO AUTH REQUIRED
// Proxies to the CALTEX Session API on Render
export async function GET() {
  try {
    const res = await fetch(`${SESSION_API_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();

    if (data.success) {
      return NextResponse.json({
        success: true,
        data: {
          status: data.data?.sessions?.connected > 0 ? 'connected' : 'disconnected',
          sessionApiOnline: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: { status: 'disconnected', sessionApiOnline: true },
    });
  } catch {
    return NextResponse.json({
      success: true,
      data: {
        status: 'offline',
        sessionApiOnline: false,
        message: 'Session API is offline. Please try again in a moment.',
      },
    });
  }
}
