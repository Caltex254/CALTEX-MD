import { NextRequest, NextResponse } from 'next/server';
import { withAuth, TokenPayload } from '@/lib/auth';
import { db } from '@/lib/db';

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const [afkUsers, total] = await Promise.all([
      db.aFKStatus.findMany({
        where: { isAFK: true },
        orderBy: { setAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      db.aFKStatus.count({ where: { isAFK: true } }),
    ]);

    return NextResponse.json({
      success: true,
      data: { afkUsers, total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list AFK users' },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (request: NextRequest, user: TokenPayload) => {
  try {
    const body = await request.json();
    const { userJid, reason } = body;

    if (!userJid) {
      return NextResponse.json(
        { success: false, error: 'User JID is required' },
        { status: 400 }
      );
    }

    const afk = await db.aFKStatus.upsert({
      where: { userJid },
      update: { reason: reason || 'No reason specified', isAFK: true, setAt: new Date() },
      create: { userJid, reason: reason || 'No reason specified', isAFK: true },
    });

    return NextResponse.json({ success: true, data: afk }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to set AFK status' },
      { status: 500 }
    );
  }
});
