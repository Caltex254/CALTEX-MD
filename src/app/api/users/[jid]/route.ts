import { NextRequest, NextResponse } from 'next/server';
import { withAuth, TokenPayload } from '@/lib/auth';
import { db } from '@/lib/db';

export const GET = withAuth(async (
  request: NextRequest,
  user: TokenPayload,
  context: { params: Promise<{ jid: string }> }
) => {
  try {
    const { jid } = await context.params;
    const userRecord = await db.user.findUnique({
      where: { jid },
      include: {
        groupMembers: { include: { group: true } },
        warningsIssued: { take: 10, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!userRecord) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: userRecord });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get user details' },
      { status: 500 }
    );
  }
});

export const PUT = withAuth(async (
  request: NextRequest,
  user: TokenPayload,
  context: { params: Promise<{ jid: string }> }
) => {
  try {
    const { jid } = await context.params;
    const body = await request.json();

    const existing = await db.user.findUnique({ where: { jid } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const allowedFields = [
      'name', 'pushName', 'profilePicUrl', 'isPremium', 'premiumExpiry',
      'isBanned', 'banReason', 'warnings',
    ];

    const data: any = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) data[field] = body[field];
    }

    const updatedUser = await db.user.update({ where: { jid }, data });

    return NextResponse.json({ success: true, data: updatedUser });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update user' },
      { status: 500 }
    );
  }
});
