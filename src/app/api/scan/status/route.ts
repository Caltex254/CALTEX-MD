import { NextResponse } from 'next/server';
import { botGet, isBotOnline } from '@/lib/bot-client';

// Public endpoint — NO AUTH REQUIRED
// Used by the /scan page for session linking
export async function GET() {
  try {
    // Check if bot service is reachable
    const online = await isBotOnline();

    if (!online) {
      return NextResponse.json({
        success: true,
        data: {
          status: 'offline',
          phoneNumber: null,
          deviceName: null,
          qrCode: null,
          message: 'Bot service is offline. Deploy the bot service first, then connect.',
        },
      });
    }

    // Bot is online — get real status
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

    return NextResponse.json({
      success: true,
      data: {
        status: 'disconnected',
        phoneNumber: null,
        deviceName: null,
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
