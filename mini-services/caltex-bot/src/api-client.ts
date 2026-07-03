// ============================================================================
// CALTEX MD WhatsApp Bot - API Client
// HTTP client to communicate with the main Next.js app
// Handles logging, stats, settings, and status reporting
// ============================================================================

import pino from 'pino';
import { join } from 'path';
import type { LogEntry, BotStats, BotSettings, Plugin, BotUser, BotGroup } from './types';

const logger = pino({
  level: 'info',
  transport: {
    target: 'pino/file',
    options: { destination: join(process.cwd(), 'bot.log') },
  },
}).child({ module: 'api-client' });

export class APIClient {
  private baseUrl: string;
  private apiKey: string;
  private logBuffer: LogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private statsBuffer: Partial<BotStats> = {};
  private statsFlushInterval: NodeJS.Timeout | null = null;
  private requestCount = 0;
  private errorCount = 0;

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = baseUrl ?? 'http://localhost:3000';
    this.apiKey = apiKey ?? '';

    this.flushInterval = setInterval(() => {
      this.flushLogs();
    }, 5000);

    this.statsFlushInterval = setInterval(() => {
      this.flushStats();
    }, 30000);
  }

  // ---------------------------------------------------------------------------
  // Internal HTTP Helper
  // ---------------------------------------------------------------------------
  private async makeRequest(
    method: string,
    path: string,
    body?: any
  ): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    try {
      this.requestCount++;
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        this.errorCount++;
        logger.debug({ method, path, status: response.status }, 'API request failed');
        return null;
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await response.json();
      }
      return await response.text();
    } catch (err) {
      this.errorCount++;
      logger.debug({ err, method, path }, 'API request error');
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Logging
  // ---------------------------------------------------------------------------
  async sendLog(level: LogEntry['level'], source: string, message: string, data?: any): Promise<void> {
    const entry: LogEntry = {
      level,
      source,
      message,
      data,
      timestamp: Date.now(),
    };

    this.logBuffer.push(entry);

    if (this.logBuffer.length >= 50) {
      await this.flushLogs();
    }

    switch (level) {
      case 'error':
        logger.error({ source, data }, message);
        break;
      case 'warn':
        logger.warn({ source, data }, message);
        break;
      case 'debug':
        logger.debug({ source, data }, message);
        break;
      default:
        logger.info({ source, data }, message);
    }
  }

  private async flushLogs(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    const logs = [...this.logBuffer];
    this.logBuffer = [];

    try {
      await this.makeRequest('POST', '/api/bot/logs', { logs });
    } catch (err) {
      logger.debug({ err }, 'Failed to flush logs, will retry next cycle');
      this.logBuffer.unshift(...logs.slice(-20));
    }
  }

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------
  async updateStats(data: Partial<BotStats>): Promise<void> {
    this.statsBuffer = { ...this.statsBuffer, ...data };

    if (Object.keys(this.statsBuffer).length >= 10) {
      await this.flushStats();
    }
  }

  private async flushStats(): Promise<void> {
    if (Object.keys(this.statsBuffer).length === 0) return;

    const stats = { ...this.statsBuffer, timestamp: Date.now() };
    this.statsBuffer = {};

    try {
      await this.makeRequest('POST', '/api/bot/stats', stats);
    } catch (err) {
      logger.debug({ err }, 'Failed to flush stats');
    }
  }

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------
  async getSettings(): Promise<BotSettings | null> {
    try {
      const result = await this.makeRequest('GET', '/api/bot/settings');
      return result as BotSettings | null;
    } catch (err) {
      logger.debug({ err }, 'Failed to get settings');
      return null;
    }
  }

  async updateSettings(settings: Partial<BotSettings>): Promise<boolean> {
    try {
      const result = await this.makeRequest('PUT', '/api/bot/settings', settings);
      return result !== null;
    } catch (err) {
      logger.debug({ err }, 'Failed to update settings');
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Status Reporting
  // ---------------------------------------------------------------------------
  async reportStatus(status: 'starting' | 'running' | 'stopping' | 'error', data?: any): Promise<void> {
    try {
      await this.makeRequest('POST', '/api/bot/status', { status, data, timestamp: Date.now() });
    } catch (err) {
      logger.debug({ err }, 'Failed to report status');
    }
  }

  async reportConnectionStatus(
    sessionId: string,
    status: 'connected' | 'disconnected' | 'connecting',
    data?: any
  ): Promise<void> {
    try {
      await this.makeRequest('POST', '/api/bot/connection', {
        sessionId,
        status,
        data,
        timestamp: Date.now(),
      });
    } catch (err) {
      logger.debug({ err }, 'Failed to report connection status');
    }
  }

  async reportQRCode(sessionId: string, qr: string): Promise<void> {
    try {
      await this.makeRequest('POST', '/api/bot/qr', {
        sessionId,
        qr,
        timestamp: Date.now(),
      });
    } catch (err) {
      logger.debug({ err }, 'Failed to report QR code');
    }
  }

  async reportCommand(command: string, sender: string, jid: string, success: boolean): Promise<void> {
    try {
      await this.makeRequest('POST', '/api/bot/command', {
        command,
        sender,
        jid,
        success,
        timestamp: Date.now(),
      });
    } catch (err) {
      logger.debug({ err }, 'Failed to report command');
    }
  }

  async reportAntiFeatureAction(feature: string, action: string, jid: string, sender: string): Promise<void> {
    try {
      await this.makeRequest('POST', '/api/bot/anti-action', {
        feature,
        action,
        jid,
        sender,
        timestamp: Date.now(),
      });
    } catch (err) {
      logger.debug({ err }, 'Failed to report anti-feature action');
    }
  }

  // ---------------------------------------------------------------------------
  // Plugins
  // ---------------------------------------------------------------------------
  async getPlugins(): Promise<Plugin[]> {
    try {
      const result = await this.makeRequest('GET', '/api/bot/plugins');
      return (result as Plugin[]) ?? [];
    } catch (err) {
      logger.debug({ err }, 'Failed to get plugins');
      return [];
    }
  }

  async enablePlugin(pluginId: string): Promise<boolean> {
    try {
      const result = await this.makeRequest('POST', `/api/bot/plugins/${pluginId}/enable`);
      return result !== null;
    } catch (err) {
      logger.debug({ err }, 'Failed to enable plugin');
      return false;
    }
  }

  async disablePlugin(pluginId: string): Promise<boolean> {
    try {
      const result = await this.makeRequest('POST', `/api/bot/plugins/${pluginId}/disable`);
      return result !== null;
    } catch (err) {
      logger.debug({ err }, 'Failed to disable plugin');
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Users
  // ---------------------------------------------------------------------------
  async getUsers(): Promise<BotUser[]> {
    try {
      const result = await this.makeRequest('GET', '/api/bot/users');
      return (result as BotUser[]) ?? [];
    } catch (err) {
      logger.debug({ err }, 'Failed to get users');
      return [];
    }
  }

  async getUser(jid: string): Promise<BotUser | null> {
    try {
      const result = await this.makeRequest('GET', `/api/bot/users/${encodeURIComponent(jid)}`);
      return result as BotUser | null;
    } catch (err) {
      logger.debug({ err }, 'Failed to get user');
      return null;
    }
  }

  async blockUser(jid: string): Promise<boolean> {
    try {
      const result = await this.makeRequest('POST', `/api/bot/users/${encodeURIComponent(jid)}/block`);
      return result !== null;
    } catch (err) {
      logger.debug({ err }, 'Failed to block user');
      return false;
    }
  }

  async unblockUser(jid: string): Promise<boolean> {
    try {
      const result = await this.makeRequest('POST', `/api/bot/users/${encodeURIComponent(jid)}/unblock`);
      return result !== null;
    } catch (err) {
      logger.debug({ err }, 'Failed to unblock user');
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Groups
  // ---------------------------------------------------------------------------
  async getGroups(): Promise<BotGroup[]> {
    try {
      const result = await this.makeRequest('GET', '/api/bot/groups');
      return (result as BotGroup[]) ?? [];
    } catch (err) {
      logger.debug({ err }, 'Failed to get groups');
      return [];
    }
  }

  async getGroup(jid: string): Promise<BotGroup | null> {
    try {
      const result = await this.makeRequest('GET', `/api/bot/groups/${encodeURIComponent(jid)}`);
      return result as BotGroup | null;
    } catch (err) {
      logger.debug({ err }, 'Failed to get group');
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Health Check
  // ---------------------------------------------------------------------------
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.makeRequest('GET', '/api/bot/health');
      return result !== null;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Stats & Cleanup
  // ---------------------------------------------------------------------------
  getStats(): { requestCount: number; errorCount: number; pendingLogs: number } {
    return {
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      pendingLogs: this.logBuffer.length,
    };
  }

  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    if (this.statsFlushInterval) {
      clearInterval(this.statsFlushInterval);
      this.statsFlushInterval = null;
    }

    this.flushLogs();
    this.flushStats();

    logger.info('API client destroyed');
  }
}
