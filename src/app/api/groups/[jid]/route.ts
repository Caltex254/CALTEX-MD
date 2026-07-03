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
    const group = await db.group.findUnique({
      where: { jid },
      include: {
        members: { include: { user: true }, orderBy: { role: 'desc' } },
        warnings: { take: 10, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!group) {
      return NextResponse.json(
        { success: false, error: 'Group not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: group });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get group details' },
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

    const existing = await db.group.findUnique({ where: { jid } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Group not found' }, { status: 404 });
    }

    const allowedFields = [
      'name', 'description', 'isBanned', 'welcomeEnabled', 'goodbyeEnabled',
      'welcomeMessage', 'goodbyeMessage', 'antiLink', 'antiBadword', 'antiSpam',
      'antiDelete', 'antiViewOnce', 'antiTag', 'antiCall',
    ];

    const data: any = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) data[field] = body[field];
    }

    const group = await db.group.update({ where: { jid }, data });

    return NextResponse.json({ success: true, data: group });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update group' },
      { status: 500 }
    );
  }
});
