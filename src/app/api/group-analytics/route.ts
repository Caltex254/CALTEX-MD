import { NextRequest, NextResponse } from 'next/server';
import { withAuth, TokenPayload } from '@/lib/auth';
import { db } from '@/lib/db';

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const groupJid = searchParams.get('groupJid');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: any = {};
    if (groupJid) where.groupJid = groupJid;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const [analytics, total] = await Promise.all([
      db.groupAnalytics.findMany({
        where,
        orderBy: { date: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      db.groupAnalytics.count({ where }),
    ]);

    const summary = analytics.length > 0 ? {
      totalMessages: analytics.reduce((sum, a) => sum + a.messagesCount, 0),
      totalCommands: analytics.reduce((sum, a) => sum + a.commandsCount, 0),
      avgActiveMembers: Math.round(analytics.reduce((sum, a) => sum + a.activeMembers, 0) / analytics.length),
    } : null;

    return NextResponse.json({
      success: true,
      data: { analytics, total, page, limit, totalPages: Math.ceil(total / limit), summary },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get group analytics' },
      { status: 500 }
    );
  }
});
