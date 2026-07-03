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
    const { trigger, response, category, isEnabled, isPremiumOnly } = body;

    const existing = await db.customCommand.findUnique({ where: { id } });
    if (!existing) {
      // Also check the Command model
      const builtIn = await db.command.findUnique({ where: { id } });
      if (builtIn) {
        const updated = await db.command.update({
          where: { id },
          data: {
            ...(isEnabled !== undefined && { isEnabled }),
            ...(category && { category }),
          },
        });
        return NextResponse.json({ success: true, data: updated });
      }
      return NextResponse.json({ success: false, error: 'Command not found' }, { status: 404 });
    }

    const command = await db.customCommand.update({
      where: { id },
      data: {
        ...(trigger && { trigger }),
        ...(response && { response }),
        ...(category !== undefined && { category }),
        ...(isEnabled !== undefined && { isEnabled }),
        ...(isPremiumOnly !== undefined && { isPremiumOnly }),
      },
    });

    return NextResponse.json({ success: true, data: command });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update command' },
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

    const existing = await db.customCommand.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Command not found' }, { status: 404 });
    }

    await db.customCommand.delete({ where: { id } });

    return NextResponse.json({ success: true, data: { message: 'Command deleted successfully' } });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete command' },
      { status: 500 }
    );
  }
});
