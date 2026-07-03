import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const dateFilter: any = {};
    if (startDate || endDate) {
      dateFilter.date = {};
      if (startDate) dateFilter.date.gte = new Date(startDate);
      if (endDate) dateFilter.date.lte = new Date(endDate);
    }

    const [stats, totalMessages, totalCommands, userCount, groupCount] = await Promise.all([
      db.stat.findMany({
        where: dateFilter,
        orderBy: { date: 'desc' },
        take: 90,
      }),
      db.stat.aggregate({ _sum: { messagesSent: true, messagesReceived: true }, where: dateFilter }),
      db.stat.aggregate({ _sum: { commandsExecuted: true }, where: dateFilter }),
      db.user.count(),
      db.group.count(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        stats,
        summary: {
          totalMessagesSent: totalMessages._sum.messagesSent || 0,
          totalMessagesReceived: totalMessages._sum.messagesReceived || 0,
          totalCommands: totalCommands._sum.commandsExecuted || 0,
          totalUsers: userCount,
          totalGroups: groupCount,
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get statistics' },
      { status: 500 }
    );
  }
});
