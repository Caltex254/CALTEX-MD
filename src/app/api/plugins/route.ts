import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const enabled = searchParams.get('enabled');

    const where = enabled !== null ? { isEnabled: enabled === 'true' } : {};

    const plugins = await db.plugin.findMany({
      where,
      orderBy: { installedAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: { plugins, total: plugins.length } });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list plugins' },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { name, version, description, author, filePath, config } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Plugin name is required' },
        { status: 400 }
      );
    }

    const existing = await db.plugin.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Plugin with this name already exists' },
        { status: 409 }
      );
    }

    const plugin = await db.plugin.create({
      data: {
        name,
        version: version || '1.0.0',
        description,
        author,
        filePath,
        config: config ? (typeof config === 'string' ? config : JSON.stringify(config)) : null,
      },
    });

    return NextResponse.json({ success: true, data: plugin }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to register plugin' },
      { status: 500 }
    );
  }
});
