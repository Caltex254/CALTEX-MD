import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search');
    const banned = searchParams.get('banned');

    const where: any = {};
    if (search) where.name = { contains: search };
    if (banned !== null) where.isBanned = banned === 'true';

    const [groups, total] = await Promise.all([
      db.group.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
        include: { _count: { select: { members: true, warnings: true } } },
      }),
      db.group.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: { groups, total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list groups' },
      { status: 500 }
    );
  }
});
