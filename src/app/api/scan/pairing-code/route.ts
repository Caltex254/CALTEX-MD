import { NextRequest, NextResponse } from 'next/server';
import { botPost, isBotOnline } from '@/lib/bot-client';

// Public endpoint — NO AUTH REQUIRED
// Used by the /scan page for pairing code generation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumber, sessionId } = body;

    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Validate phone format
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone number — must be at least 10 digits' },
        { status: 400 }
      );
    }

    // Check if bot service is reachable
    const online = await isBotOnline();

    if (!online) {
      return NextResponse.json({
        success: false,
        error: 'Bot service is offline. Deploy the bot service first to generate pairing codes.',
        hint: 'The WhatsApp bot service needs to be running. Deploy it on Render, Railway, or a VPS, then set BOT_API_URL environment variable.',
      });
    }

    // Bot is online — request real pairing code
    const result = await botPost('/pairing-code', { phoneNumber: cleanPhone, sessionId });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to request pairing code' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { pairingCode: result.data?.pairingCode, phoneNumber: cleanPhone },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to request pairing code' },
      { status: 500 }
    );
  }
}
