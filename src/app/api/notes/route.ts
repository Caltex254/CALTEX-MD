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

    const [notes, total] = await Promise.all([
      db.note.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      db.note.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: { notes, total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list notes' },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (request: NextRequest, user: TokenPayload) => {
  try {
    const body = await request.json();
    const { userJid, title, content, isPrivate } = body;

    if (!userJid || !title || !content) {
      return NextResponse.json(
        { success: false, error: 'userJid, title, and content are required' },
        { status: 400 }
      );
    }

    const note = await db.note.create({
      data: { userJid, title, content, isPrivate: isPrivate ?? true },
    });

    return NextResponse.json({ success: true, data: note }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create note' },
      { status: 500 }
    );
  }
});
