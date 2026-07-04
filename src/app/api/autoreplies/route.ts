import { NextRequest, NextResponse } from 'next/server';
import { withAuth, TokenPayload } from '@/lib/auth';
import { db } from '@/lib/db';

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const groupJid = searchParams.get('groupJid');

    const where: any = {};
    if (groupJid) where.groupJid = groupJid;

    const [autoreplies, total] = await Promise.all([
      db.autoReply.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      db.autoReply.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: { autoreplies, total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list auto-replies' },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (request: NextRequest, user: TokenPayload) => {
  try {
    const body = await request.json();
    const { trigger, response, isRegex, isGlobal, groupJid, isEnabled, createdBy } = body;

    if (!trigger || !response) {
      return NextResponse.json(
        { success: false, error: 'Trigger and response are required' },
        { status: 400 }
      );
    }

    const autoreply = await db.autoReply.create({
      data: { trigger, response, isRegex: isRegex ?? false, isGlobal: isGlobal ?? true, groupJid: groupJid ?? null, isEnabled: isEnabled ?? true, createdBy: createdBy || user.username },
    });

    return NextResponse.json({ success: true, data: autoreply }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create auto-reply' },
      { status: 500 }
    );
  }
});
