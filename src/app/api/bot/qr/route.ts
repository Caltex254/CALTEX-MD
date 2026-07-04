import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { botGet } from '@/lib/bot-client';
import { db } from '@/lib/db';

export const GET = withAuth(async (request: NextRequest) => {
  try {
    // Try fetching QR from bot service first
    const result = await botGet('/qr');

    if (result.success && result.data?.qr) {
      return NextResponse.json({
        success: true,
        data: { qr: result.data.qr, status: 'qr' },
      });
    }

    // Fallback: check DB for QR status session
    const qrSession = await db.botSession.findFirst({
      where: { status: 'qr' },
      orderBy: { lastActiveAt: 'desc' },
    });

    if (qrSession) {
      return NextResponse.json({
        success: true,
        data: { qr: null, status: 'qr', message: 'QR session exists but no QR data available' },
      });
    }

    return NextResponse.json({
      success: true,
      data: { qr: null, status: 'no_qr', message: 'No QR code available. Start the bot first.' },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get QR code' },
      { status: 500 }
    );
  }
});
