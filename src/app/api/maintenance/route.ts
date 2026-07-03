import { NextRequest, NextResponse } from 'next/server';
import { withAuth, TokenPayload } from '@/lib/auth';
import { db } from '@/lib/db';

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const setting = await db.setting.findUnique({ where: { key: 'maintenance_mode' } });
    const isActive = setting?.value === 'true';
    const message = await db.setting.findUnique({ where: { key: 'maintenance_message' } });

    return NextResponse.json({
      success: true,
      data: { isActive, message: message?.value || 'Bot is under maintenance. Please try again later.' },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get maintenance status' },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (request: NextRequest, user: TokenPayload) => {
  try {
    const body = await request.json();
    const { isActive, message } = body;

    if (isActive === undefined) {
      return NextResponse.json(
        { success: false, error: 'isActive is required' },
        { status: 400 }
      );
    }

    await db.setting.upsert({
      where: { key: 'maintenance_mode' },
      update: { value: String(isActive), category: 'system' },
      create: { key: 'maintenance_mode', value: String(isActive), category: 'system' },
    });

    if (message) {
      await db.setting.upsert({
        where: { key: 'maintenance_message' },
        update: { value: message, category: 'system' },
        create: { key: 'maintenance_message', value: message, category: 'system' },
      });
    }

    return NextResponse.json({ success: true, data: { isActive, message } });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to toggle maintenance mode' },
      { status: 500 }
    );
  }
});
