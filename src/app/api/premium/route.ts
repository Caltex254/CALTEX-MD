import { NextRequest, NextResponse } from 'next/server';
import { withAuth, TokenPayload } from '@/lib/auth';
import { db } from '@/lib/db';

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const [users, total] = await Promise.all([
      db.premiumUser.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      db.premiumUser.count({ where: { isActive: true } }),
    ]);

    return NextResponse.json({
      success: true,
      data: { users, total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list premium users' },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (request: NextRequest, user: TokenPayload) => {
  try {
    const body = await request.json();
    const { userJid, plan = 'basic', durationDays = 30, grantedBy } = body;

    if (!userJid) {
      return NextResponse.json(
        { success: false, error: 'User JID is required' },
        { status: 400 }
      );
    }

    const startDate = new Date();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + durationDays);

    const premium = await db.premiumUser.upsert({
      where: { userJid },
      update: { plan, startDate, expiryDate, isActive: true, grantedBy: grantedBy || user.username, autoRenew: false },
      create: { userJid, plan, startDate, expiryDate, isActive: true, grantedBy: grantedBy || user.username },
    });

    await db.user.upsert({
      where: { jid: userJid },
      update: { isPremium: true, premiumExpiry: expiryDate },
      create: { jid: userJid, isPremium: true, premiumExpiry: expiryDate },
    });

    return NextResponse.json({ success: true, data: premium }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to add premium user' },
      { status: 500 }
    );
  }
});
