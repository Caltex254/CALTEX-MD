import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { botPost } from '@/lib/bot-client';
import { db } from '@/lib/db';

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const stopResult = await botPost('/stop');
    const startResult = await botPost('/start');

    // Update local DB status
    await db.botSession.updateMany({
      where: { status: { in: ['connected', 'disconnected'] } },
      data: { status: 'qr', lastActiveAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      data: {
        message: 'Bot restart initiated',
        stopResponse: stopResult.data,
        startResponse: startResult.data,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to restart bot' },
      { status: 500 }
    );
  }
});
