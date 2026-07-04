import { NextResponse } from 'next/server';
import { botGet } from '@/lib/bot-client';
import { db } from '@/lib/db';

// Public endpoint — NO AUTH REQUIRED
// Used by the /scan page for session linking
export async function GET() {
  try {
    // Try bot service first
    const result = await botGet('/status');
    if (result.success && result.data) {
      return NextResponse.json({
        success: true,
        data: {
          status: result.data.status || 'disconnected',
          phoneNumber: result.data.phoneNumber || null,
          deviceName: result.data.deviceName || null,
          qrCode: result.data.qr || null,
        },
      });
    }

    // Fallback: check DB
    const sessions = await db.botSession.findMany({
      orderBy: { lastActiveAt: 'desc' },
    });

    const activeSession = sessions.find((s) => s.status === 'connected');
    const status = activeSession
      ? 'connected'
      : sessions.some((s) => s.status === 'qr')
        ? 'qr'
        : 'disconnected';

    return NextResponse.json({
      success: true,
      data: {
        status,
        phoneNumber: activeSession?.phoneNumber || null,
        deviceName: activeSession?.deviceName || null,
        qrCode: null,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get bot status' },
      { status: 500 }
    );
  }
}
