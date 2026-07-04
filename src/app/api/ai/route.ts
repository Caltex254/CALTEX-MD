import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const aiSettings = await db.aISettings.findFirst();

    if (!aiSettings) {
      return NextResponse.json({
        success: true,
        data: {
          provider: 'openai',
          apiKey: null,
          model: null,
          systemPrompt: null,
          temperature: 0.7,
          maxTokens: 4096,
          isEnabled: false,
        },
      });
    }

    // Mask the API key for security
    const maskedSettings = {
      ...aiSettings,
      apiKey: aiSettings.apiKey
        ? aiSettings.apiKey.slice(0, 8) + '...' + aiSettings.apiKey.slice(-4)
        : null,
    };

    return NextResponse.json({ success: true, data: maskedSettings });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get AI configuration' },
      { status: 500 }
    );
  }
});

export const PUT = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { provider, apiKey, model, systemPrompt, temperature, maxTokens, isEnabled } = body;

    const existing = await db.aISettings.findFirst();

    const data: any = {};
    if (provider) data.provider = provider;
    if (apiKey !== undefined) data.apiKey = apiKey;
    if (model !== undefined) data.model = model;
    if (systemPrompt !== undefined) data.systemPrompt = systemPrompt;
    if (temperature !== undefined) data.temperature = temperature;
    if (maxTokens !== undefined) data.maxTokens = maxTokens;
    if (isEnabled !== undefined) data.isEnabled = isEnabled;

    let aiSettings;
    if (existing) {
      aiSettings = await db.aISettings.update({ where: { id: existing.id }, data });
    } else {
      aiSettings = await db.aISettings.create({ data });
    }

    // Mask API key in response
    const masked = {
      ...aiSettings,
      apiKey: aiSettings.apiKey
        ? aiSettings.apiKey.slice(0, 8) + '...' + aiSettings.apiKey.slice(-4)
        : null,
    };

    return NextResponse.json({ success: true, data: masked });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update AI configuration' },
      { status: 500 }
    );
  }
});
