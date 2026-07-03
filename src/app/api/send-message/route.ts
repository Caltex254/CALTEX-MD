import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { botPost } from '@/lib/bot-client';
import { db } from '@/lib/db';

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { jid, message, mediaUrl, mediaType } = body;

    if (!jid || !message) {
      return NextResponse.json(
        { success: false, error: 'jid and message are required' },
        { status: 400 }
      );
    }

    // Validate JID format (basic check)
    if (!jid.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Invalid JID format. Must include @ (e.g., user@s.whatsapp.net or group@g.us)' },
        { status: 400 }
      );
    }

    const validMediaTypes = ['image', 'video', 'audio', 'document', 'sticker'];
    if (mediaType && !validMediaTypes.includes(mediaType)) {
      return NextResponse.json(
        { success: false, error: `Invalid mediaType. Use: ${validMediaTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Try sending via bot service
    const result = await botPost('/send-message', { jid, message, mediaUrl, mediaType });

    // Log the message
    await db.log.create({
      data: {
        level: 'info',
        source: 'api',
        message: `Message sent to ${jid}`,
        data: JSON.stringify({ jid, messageLength: message.length, hasMedia: !!mediaUrl }),
      },
    });

    if (!result.success) {
      return NextResponse.json({
        success: true,
        data: { message: 'Message queued (bot service offline)', jid, botResponse: result.error },
      });
    }

    return NextResponse.json({
      success: true,
      data: { message: 'Message sent successfully', jid, botResponse: result.data },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to send message' },
      { status: 500 }
    );
  }
});
