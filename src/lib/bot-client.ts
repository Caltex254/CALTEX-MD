// Bot client for dashboard communication with the bot service
// The Session API (Render) handles QR/pairing independently

const BOT_API_URL = process.env.BOT_API_URL || `http://localhost:3031`;

interface BotResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export function getBotApiUrl(): string {
  return BOT_API_URL;
}

export async function botGet(path: string): Promise<BotResponse> {
  try {
    const res = await fetch(`${BOT_API_URL}${path}`, { method: 'GET' });
    const data = await res.json();
    return { success: res.ok, data };
  } catch (error: any) {
    return { success: false, error: error.message || 'Bot service unavailable' };
  }
}

export async function botPost(path: string, body?: any): Promise<BotResponse> {
  try {
    const res = await fetch(`${BOT_API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    return { success: res.ok, data };
  } catch (error: any) {
    return { success: false, error: error.message || 'Bot service unavailable' };
  }
}

export async function botPut(path: string, body?: any): Promise<BotResponse> {
  try {
    const res = await fetch(`${BOT_API_URL}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    return { success: res.ok, data };
  } catch (error: any) {
    return { success: false, error: error.message || 'Bot service unavailable' };
  }
}

export async function botDelete(path: string): Promise<BotResponse> {
  try {
    const res = await fetch(`${BOT_API_URL}${path}`, { method: 'DELETE' });
    const data = await res.json();
    return { success: res.ok, data };
  } catch (error: any) {
    return { success: false, error: error.message || 'Bot service unavailable' };
  }
}

/** Check if the bot service is reachable */
export async function isBotOnline(): Promise<boolean> {
  try {
    const res = await fetch(`${BOT_API_URL}/health`, { method: 'GET', signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}
