import { NextRequest, NextResponse } from 'next/server';

// Session API URL — deployed on Render
const SESSION_API_URL = process.env.SESSION_API_URL || 'https://caltex-session-api.onrender.com';

// Public endpoint — NO AUTH REQUIRED
// Proxies session data download from the CALTEX Session API on Render
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

    // First check session status
    const statusRes = await fetch(`${SESSION_API_URL}/session/${sessionId}`, {
      signal: AbortSignal.timeout(5000),
    });
    const statusData = await statusRes.json();

    if (!statusData.success) {
      return NextResponse.json(
        { success: false, error: statusData.error || 'Session not found' },
        { status: 404 }
      );
    }

    if (statusData.data?.status !== 'connected') {
      return NextResponse.json({
        success: false,
        error: `Session is not connected yet (status: ${statusData.data?.status || 'unknown'}). Wait for WhatsApp to link.`,
        status: statusData.data?.status,
      });
    }

    // Fetch session data as JSON
    const dataRes = await fetch(`${SESSION_API_URL}/session/${sessionId}/data`, {
      signal: AbortSignal.timeout(10000),
    });
    const data = await dataRes.json();

    if (data.success && data.data?.sessionString) {
      return NextResponse.json({
        success: true,
        data: {
          sessionId,
          sessionString: data.data.sessionString,
          phoneNumber: data.data.phoneNumber,
          connectedAt: data.data.connectedAt,
          caltexSessionId: data.data.caltexSessionId,
          onboardingSent: data.data.onboardingSent,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: data.error || 'Failed to fetch session data' },
      { status: dataRes.status }
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
