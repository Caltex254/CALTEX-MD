const BOT_SERVICE_PORT = 3031;
const BOT_BASE_URL = `http://localhost:${BOT_SERVICE_PORT}`;

interface BotResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export async function botGet(path: string): Promise<BotResponse> {
  try {
    const res = await fetch(`${BOT_BASE_URL}${path}`, { method: 'GET' });
    const data = await res.json();
    return { success: res.ok, data };
  } catch (error: any) {
    return { success: false, error: error.message || 'Bot service unavailable' };
  }
}

export async function botPost(path: string, body?: any): Promise<BotResponse> {
  try {
    const res = await fetch(`${BOT_BASE_URL}${path}`, {
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
    const res = await fetch(`${BOT_BASE_URL}${path}`, {
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
    const res = await fetch(`${BOT_BASE_URL}${path}`, { method: 'DELETE' });
    const data = await res.json();
    return { success: res.ok, data };
  } catch (error: any) {
    return { success: false, error: error.message || 'Bot service unavailable' };
  }
}

export function isBotOnline(): boolean {
  return true; // Will be updated by actual health check
}
