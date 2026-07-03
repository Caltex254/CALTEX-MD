import { NextRequest, NextResponse } from 'next/server';
import { withAuth, TokenPayload } from '@/lib/auth';
import { db } from '@/lib/db';
import { botGet, botPost } from '@/lib/bot-client';

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const result = await botGet('/updates/check');
    if (result.success) {
      return NextResponse.json({ success: true, data: result.data });
    }

    const latestUpdate = await db.updateRecord.findFirst({ orderBy: { performedAt: 'desc' } });
    return NextResponse.json({
      success: true,
      data: { currentVersion: latestUpdate?.toVersion || '1.0.0', updateAvailable: false },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to check for updates' },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (request: NextRequest, user: TokenPayload) => {
  try {
    const body = await request.json();
    const { fromVersion, toVersion, backupPath, releaseNotes } = body;

    const update = await db.updateRecord.create({
      data: { fromVersion: fromVersion || '1.0.0', toVersion: toVersion || '1.0.1', backupPath, releaseNotes },
    });

    return NextResponse.json({ success: true, data: update }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to start update process' },
      { status: 500 }
    );
  }
});

export const PUT = withAuth(async (request: NextRequest, user: TokenPayload) => {
  try {
    const body = await request.json();
    const { updateId } = body;

    if (!updateId) {
      return NextResponse.json({ success: false, error: 'Update ID is required' }, { status: 400 });
    }

    const update = await db.updateRecord.findUnique({ where: { id: updateId } });
    if (!update) {
      return NextResponse.json({ success: false, error: 'Update record not found' }, { status: 404 });
    }

    const rolledBack = await db.updateRecord.update({
      where: { id: updateId },
      data: { status: 'rolled_back' },
    });

    return NextResponse.json({ success: true, data: rolledBack });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to rollback update' },
      { status: 500 }
    );
  }
});
