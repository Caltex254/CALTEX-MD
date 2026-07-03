import { NextRequest, NextResponse } from 'next/server';
import { withAuth, TokenPayload } from '@/lib/auth';
import { db } from '@/lib/db';

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const languages = await db.languagePack.findMany({ orderBy: { code: 'asc' } });
    return NextResponse.json({ success: true, data: { languages } });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list language packs' },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (request: NextRequest, user: TokenPayload) => {
  try {
    const body = await request.json();
    const { code, name, translations, isDefault } = body;

    if (!code || !name || !translations) {
      return NextResponse.json(
        { success: false, error: 'Code, name, and translations are required' },
        { status: 400 }
      );
    }

    const translationsStr = typeof translations === 'string' ? translations : JSON.stringify(translations);

    const language = await db.languagePack.upsert({
      where: { code },
      update: { name, translations: translationsStr, isDefault: isDefault ?? false },
      create: { code, name, translations: translationsStr, isDefault: isDefault ?? false },
    });

    return NextResponse.json({ success: true, data: language }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create/update language pack' },
      { status: 500 }
    );
  }
});
