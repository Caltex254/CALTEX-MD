import { NextRequest, NextResponse } from 'next/server';
import { withAuth, TokenPayload } from '@/lib/auth';
import { db } from '@/lib/db';

export const PUT = withAuth(async (
  request: NextRequest,
  user: TokenPayload,
  context: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await context.params;
    const notification = await db.ownerNotification.findUnique({ where: { id } });

    if (!notification) {
      return NextResponse.json(
        { success: false, error: 'Notification not found' },
        { status: 404 }
      );
    }

    const updated = await db.ownerNotification.update({
      where: { id },
      data: { isRead: true },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to mark notification as read' },
      { status: 500 }
    );
  }
});

export const DELETE = withAuth(async (
  request: NextRequest,
  user: TokenPayload,
  context: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await context.params;
    const notification = await db.ownerNotification.findUnique({ where: { id } });

    if (!notification) {
      return NextResponse.json(
        { success: false, error: 'Notification not found' },
        { status: 404 }
      );
    }

    await db.ownerNotification.delete({ where: { id } });
    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete notification' },
      { status: 500 }
    );
  }
});
