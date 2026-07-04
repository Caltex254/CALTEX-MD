import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { botPost } from '@/lib/bot-client';
import { db } from '@/lib/db';

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const result = await botPost('/stop');

    // Update local DB status
    await db.botSession.updateMany({
      where: { status: 'connected' },
      data: { status: 'disconnected', lastActiveAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Bot stopped successfully', botResponse: result.data },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to stop bot' },
      { status: 500 }
    );
  }
});
