import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { botPost } from '@/lib/bot-client';
import { db } from '@/lib/db';

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const result = await botPost('/start');

    if (!result.success) {
      // Fallback: update local DB status even if bot service is offline
      await db.botSession.upsert({
        where: { sessionId: 'default' },
        update: { status: 'qr', lastActiveAt: new Date() },
        create: { sessionId: 'default', sessionData: '{}', status: 'qr' },
      });
    }

    return NextResponse.json({
      success: true,
      data: { message: 'Bot start initiated', botResponse: result.data },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to start bot' },
      { status: 500 }
    );
  }
});
