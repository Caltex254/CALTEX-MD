import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    const where = category ? { category } : {};

    const settings = await db.setting.findMany({
      where,
      orderBy: { key: 'asc' },
    });

    // Group settings by category
    const grouped = settings.reduce((acc: any, setting) => {
      const cat = setting.category || 'general';
      if (!acc[cat]) acc[cat] = {};
      try {
        acc[cat][setting.key] = JSON.parse(setting.value);
      } catch {
        acc[cat][setting.key] = setting.value;
      }
      return acc;
    }, {});

    return NextResponse.json({ success: true, data: { settings, grouped } });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get settings' },
      { status: 500 }
    );
  }
});

export const PUT = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { settings } = body;

    if (!settings || !Array.isArray(settings)) {
      return NextResponse.json(
        { success: false, error: 'settings array is required with { key, value } objects' },
        { status: 400 }
      );
    }

    const results = await Promise.all(
      settings.map(({ key, value, category, description }: any) =>
        db.setting.upsert({
          where: { key },
          update: {
            value: typeof value === 'string' ? value : JSON.stringify(value),
            ...(category && { category }),
            ...(description !== undefined && { description }),
          },
          create: {
            key,
            value: typeof value === 'string' ? value : JSON.stringify(value),
            category: category || 'general',
            description,
          },
        })
      )
    );

    return NextResponse.json({ success: true, data: { updated: results.length, settings: results } });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update settings' },
      { status: 500 }
    );
  }
});
