import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const sessions = await db.botSession.findMany({
      orderBy: { lastActiveAt: 'desc' },
    });

    const activeSession = sessions.find(s => s.status === 'connected');
    const status = activeSession
      ? 'connected'
      : sessions.some(s => s.status === 'qr')
        ? 'qr'
        : 'disconnected';

    return NextResponse.json({
      success: true,
      data: {
        status,
        phoneNumber: activeSession?.phoneNumber || null,
        deviceName: activeSession?.deviceName || null,
        lastActiveAt: activeSession?.lastActiveAt || null,
        totalSessions: sessions.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get bot status' },
      { status: 500 }
    );
  }
});
