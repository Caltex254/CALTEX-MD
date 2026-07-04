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
    const body = await request.json();
    const existing = await db.autoReply.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Auto-reply not found' }, { status: 404 });
    }

    const data: any = {};
    if (body.trigger !== undefined) data.trigger = body.trigger;
    if (body.response !== undefined) data.response = body.response;
    if (body.isRegex !== undefined) data.isRegex = body.isRegex;
    if (body.isGlobal !== undefined) data.isGlobal = body.isGlobal;
    if (body.groupJid !== undefined) data.groupJid = body.groupJid;
    if (body.isEnabled !== undefined) data.isEnabled = body.isEnabled;

    const updated = await db.autoReply.update({ where: { id }, data });
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update auto-reply' },
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
    const existing = await db.autoReply.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Auto-reply not found' }, { status: 404 });
    }

    await db.autoReply.delete({ where: { id } });
    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete auto-reply' },
      { status: 500 }
    );
  }
});
