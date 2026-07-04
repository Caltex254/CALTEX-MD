import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const enabled = searchParams.get('enabled');

    const where: any = {};
    if (category) where.category = category;
    if (enabled !== null) where.isEnabled = enabled === 'true';

    const [commands, customCommands] = await Promise.all([
      db.command.findMany({ where, orderBy: { name: 'asc' } }),
      db.customCommand.findMany({ orderBy: { name: 'asc' } }),
    ]);

    return NextResponse.json({
      success: true,
      data: { commands, customCommands, total: commands.length + customCommands.length },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list commands' },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { name, trigger, response, category, isPremiumOnly } = body;

    if (!name || !trigger || !response) {
      return NextResponse.json(
        { success: false, error: 'name, trigger, and response are required' },
        { status: 400 }
      );
    }

    const existing = await db.customCommand.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Command with this name already exists' },
        { status: 409 }
      );
    }

    const command = await db.customCommand.create({
      data: { name, trigger, response, category, isPremiumOnly: isPremiumOnly || false },
    });

    return NextResponse.json({ success: true, data: command }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create command' },
      { status: 500 }
    );
  }
});
