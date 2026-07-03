import { NextRequest, NextResponse } from 'next/server';
import { withAuth, TokenPayload } from '@/lib/auth';
import { db } from '@/lib/db';

export const GET = withAuth(async (request: NextRequest) => {
  try {
    let config = await db.repoConfig.findFirst();

    if (!config) {
      config = await db.repoConfig.create({
        data: {
          repoName: 'CALTEX MD',
          developerName: 'CALTEX MD Team',
          license: 'MIT',
        },
      });
    }

    return NextResponse.json({ success: true, data: config });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get repo config' },
      { status: 500 }
    );
  }
});

export const PUT = withAuth(async (request: NextRequest, user: TokenPayload) => {
  try {
    const body = await request.json();
    const existing = await db.repoConfig.findFirst();

    if (!existing) {
      const config = await db.repoConfig.create({ data: body });
      return NextResponse.json({ success: true, data: config });
    }

    const allowedFields = ['repoName', 'repoUrl', 'developerName', 'description', 'docsUrl', 'license', 'latestRelease'];
    const data: any = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) data[field] = body[field];
    }

    const updated = await db.repoConfig.update({ where: { id: existing.id }, data });
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update repo config' },
      { status: 500 }
    );
  }
});
