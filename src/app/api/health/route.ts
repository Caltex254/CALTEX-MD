import { NextResponse } from 'next/server';
import { isBotOnline, getBotApiUrl } from '@/lib/bot-client';

export async function GET() {
  const online = await isBotOnline();

  return NextResponse.json({
    success: true,
    data: {
      dashboard: 'healthy',
      botService: online ? 'online' : 'offline',
      botApiUrl: getBotApiUrl(),
      timestamp: new Date().toISOString(),
    },
  });
}
