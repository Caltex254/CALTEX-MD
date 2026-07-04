import { NextRequest, NextResponse } from 'next/server';
import { withAuth, TokenPayload } from '@/lib/auth';
import { db } from '@/lib/db';

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const userJid = searchParams.get('userJid');

    const where: any = {};
    if (userJid) where.userJid = userJid;

    const [reminders, total] = await Promise.all([
      db.reminder.findMany({
        where,
        orderBy: { remindAt: 'asc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      db.reminder.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: { reminders, total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list reminders' },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (request: NextRequest, user: TokenPayload) => {
  try {
    const body = await request.json();
    const { userJid, chatJid, message, remindAt, isRecurring, recurrence } = body;

    if (!userJid || !chatJid || !message || !remindAt) {
      return NextResponse.json(
        { success: false, error: 'userJid, chatJid, message, and remindAt are required' },
        { status: 400 }
      );
    }

    const reminder = await db.reminder.create({
      data: { userJid, chatJid, message, remindAt: new Date(remindAt), isRecurring: isRecurring ?? false, recurrence },
    });

    return NextResponse.json({ success: true, data: reminder }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create reminder' },
      { status: 500 }
    );
  }
});
