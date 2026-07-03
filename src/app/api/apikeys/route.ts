import { NextRequest, NextResponse } from 'next/server';
import { withAuth, TokenPayload } from '@/lib/auth';
import { db } from '@/lib/db';

function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '****' + key.slice(-4);
}

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const keys = await db.aPIKey.findMany({ orderBy: { createdAt: 'desc' } });
    const masked = keys.map((k) => ({
      ...k,
      key: maskKey(k.key),
    }));

    return NextResponse.json({ success: true, data: { keys: masked } });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list API keys' },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (request: NextRequest, user: TokenPayload) => {
  try {
    const body = await request.json();
    const { name, key, provider } = body;

    if (!name || !key) {
      return NextResponse.json(
        { success: false, error: 'Name and key are required' },
        { status: 400 }
      );
    }

    const apiKey = await db.aPIKey.create({
      data: { name, key, provider: provider ?? null },
    });

    return NextResponse.json({ success: true, data: { ...apiKey, key: maskKey(apiKey.key) } }, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ success: false, error: 'API key name already exists' }, { status: 409 });
    }
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to add API key' },
      { status: 500 }
    );
  }
});
