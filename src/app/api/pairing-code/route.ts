import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { botPost } from '@/lib/bot-client';

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { phoneNumber, sessionId } = body;

    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, error: 'Phone number is required' },
        { status: 400 }
      );
    }

    const result = await botPost('/pairing-code', { phoneNumber, sessionId });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to request pairing code' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { pairingCode: result.data?.pairingCode, phoneNumber },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to request pairing code' },
      { status: 500 }
    );
  }
});
