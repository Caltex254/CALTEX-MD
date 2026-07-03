import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const where = status ? { status } : {};

    const broadcasts = await db.broadcast.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: { broadcasts, total: broadcasts.length } });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list broadcasts' },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { message, targetType, scheduledAt } = body;

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      );
    }

    const validTargets = ['all', 'groups', 'users'];
    if (targetType && !validTargets.includes(targetType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid targetType. Use: all, groups, or users' },
        { status: 400 }
      );
    }

    const broadcast = await db.broadcast.create({
      data: {
        message,
        targetType: targetType || 'all',
        status: 'pending',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      },
    });

    return NextResponse.json({ success: true, data: broadcast }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create broadcast' },
      { status: 500 }
    );
  }
});
