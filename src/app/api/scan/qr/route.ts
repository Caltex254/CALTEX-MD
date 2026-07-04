import { NextResponse } from 'next/server';
import { botGet, botPost } from '@/lib/bot-client';
import { db } from '@/lib/db';

// Public endpoint — NO AUTH REQUIRED
// GET: Fetch current QR code
export async function GET() {
  try {
    const result = await botGet('/qr');

    if (result.success && result.data?.qr) {
      return NextResponse.json({
        success: true,
        data: { qr: result.data.qr, status: 'qr' },
      });
    }

    // Fallback: check DB
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
}

// POST: Request a fresh QR code
export async function POST() {
  try {
    const result = await botPost('/qr');

    if (result.success) {
      return NextResponse.json({
        success: true,
        data: { qr: result.data?.qr, status: 'qr' },
      });
    }

    return NextResponse.json(
      { success: false, error: result.error || 'Failed to generate QR code' },
      { status: 502 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate QR code' },
      { status: 500 }
    );
  }
}
