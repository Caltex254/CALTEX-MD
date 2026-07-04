import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const type = searchParams.get('type');
    const severity = searchParams.get('severity');
    const isRead = searchParams.get('isRead');

    const where: any = {};
    if (type) where.type = type;
    if (severity) where.severity = severity;
    if (isRead !== null) where.isRead = isRead === 'true';

    const [notifications, total] = await Promise.all([
      db.ownerNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      db.ownerNotification.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: { notifications, total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list notifications' },
      { status: 500 }
    );
  }
});
