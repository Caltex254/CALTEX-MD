import { NextRequest, NextResponse } from 'next/server';
import { withAuth, TokenPayload } from '@/lib/auth';
import { db } from '@/lib/db';

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const themes = await db.themeConfig.findMany({ orderBy: { name: 'asc' } });
    return NextResponse.json({ success: true, data: { themes } });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list themes' },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (request: NextRequest, user: TokenPayload) => {
  try {
    const body = await request.json();
    const { name, description, style, isDefault } = body;

    if (!name || !style) {
      return NextResponse.json(
        { success: false, error: 'Name and style are required' },
        { status: 400 }
      );
    }

    const styleStr = typeof style === 'string' ? style : JSON.stringify(style);

    const theme = await db.themeConfig.create({
      data: { name, description: description ?? null, style: styleStr, isDefault: isDefault ?? false },
    });

    return NextResponse.json({ success: true, data: theme }, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'Theme name already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create theme' },
      { status: 500 }
    );
  }
});
