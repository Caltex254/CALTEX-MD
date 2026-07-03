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
    const existing = await db.aPIKey.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'API key not found' }, { status: 404 });
    }

    const data: any = {};
    if (body.isEnabled !== undefined) data.isEnabled = body.isEnabled;
    if (body.name !== undefined) data.name = body.name;
    if (body.provider !== undefined) data.provider = body.provider;
    if (body.key !== undefined) data.key = body.key;

    const updated = await db.aPIKey.update({ where: { id }, data });
    const maskedKey = updated.key.length <= 8 ? '****' : updated.key.slice(0, 4) + '****' + updated.key.slice(-4);

    return NextResponse.json({ success: true, data: { ...updated, key: maskedKey } });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to toggle API key' },
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
    const existing = await db.aPIKey.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'API key not found' }, { status: 404 });
    }

    await db.aPIKey.delete({ where: { id } });
    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete API key' },
      { status: 500 }
    );
  }
});
