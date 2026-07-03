import { NextRequest, NextResponse } from 'next/server';
import { withAuth, TokenPayload } from '@/lib/auth';
import { db } from '@/lib/db';

export const GET = withAuth(async (
  request: NextRequest,
  user: TokenPayload,
  context: { params: Promise<{ jid: string }> }
) => {
  try {
    const { jid } = await context.params;
    const premium = await db.premiumUser.findUnique({ where: { userJid: jid } });

    if (!premium) {
      return NextResponse.json(
        { success: false, error: 'Premium status not found' },
        { status: 404 }
      );
    }

    const isExpired = premium.expiryDate < new Date();
    return NextResponse.json({
      success: true,
      data: { ...premium, isExpired, daysRemaining: isExpired ? 0 : Math.ceil((premium.expiryDate.getTime() - Date.now()) / 86400000) },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get premium status' },
      { status: 500 }
    );
  }
});

export const DELETE = withAuth(async (
  request: NextRequest,
  user: TokenPayload,
  context: { params: Promise<{ jid: string }> }
) => {
  try {
    const { jid } = await context.params;
    const premium = await db.premiumUser.findUnique({ where: { userJid: jid } });

    if (!premium) {
      return NextResponse.json(
        { success: false, error: 'Premium status not found' },
        { status: 404 }
      );
    }

    await db.premiumUser.update({ where: { userJid: jid }, data: { isActive: false } });
    await db.user.update({ where: { jid }, data: { isPremium: false, premiumExpiry: null } }).catch(() => {});

    return NextResponse.json({ success: true, data: { removed: true } });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to remove premium' },
      { status: 500 }
    );
  }
});
