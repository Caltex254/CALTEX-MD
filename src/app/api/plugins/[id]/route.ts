import { NextRequest, NextResponse } from 'next/server';
import { withAuth, TokenPayload } from '@/lib/auth';
import { db } from '@/lib/db';

export const GET = withAuth(async (
  request: NextRequest,
  user: TokenPayload,
  context: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await context.params;
    const plugin = await db.plugin.findUnique({ where: { id } });

    if (!plugin) {
      return NextResponse.json(
        { success: false, error: 'Plugin not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: plugin });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get plugin' },
      { status: 500 }
    );
  }
});

export const PUT = withAuth(async (
  request: NextRequest,
  user: TokenPayload,
  context: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { isEnabled, name, description, config, version } = body;

    const existing = await db.plugin.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Plugin not found' }, { status: 404 });
    }

    const plugin = await db.plugin.update({
      where: { id },
      data: {
        ...(isEnabled !== undefined && { isEnabled }),
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(version && { version }),
        ...(config !== undefined && { config: typeof config === 'string' ? config : JSON.stringify(config) }),
      },
    });

    return NextResponse.json({ success: true, data: plugin });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update plugin' },
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

    const existing = await db.plugin.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Plugin not found' }, { status: 404 });
    }

    await db.plugin.delete({ where: { id } });

    return NextResponse.json({ success: true, data: { message: 'Plugin removed successfully' } });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to remove plugin' },
      { status: 500 }
    );
  }
});
