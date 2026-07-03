// ============================================================================
// CALTEX MD WhatsApp Bot - Message Scheduler
// Schedule messages, broadcast messages, recurring messages with persistence
// ============================================================================

import { WASocket } from '@whiskeysockets/baileys';
import { EventEmitter } from 'events';
import pino from 'pino';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import type { ScheduledMessage } from './types';

const logger = pino({
  level: 'info',
  transport: {
    target: 'pino/file',
    options: { destination: join(process.cwd(), 'bot.log') },
  },
}).child({ module: 'scheduler' });

export class Scheduler extends EventEmitter {
  private messages: Map<string, ScheduledMessage> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private storagePath: string;
  private socks: Map<string, WASocket> = new Map();

  constructor(storagePath?: string) {
    super();
    this.storagePath = storagePath ?? join(process.cwd(), 'scheduled-messages.json');
    this.loadMessages();
    this.startChecker();
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------
  private loadMessages(): void {
    if (existsSync(this.storagePath)) {
      try {
        const data = JSON.parse(readFileSync(this.storagePath, 'utf-8'));
        const messages: ScheduledMessage[] = data.messages ?? [];

        for (const msg of messages) {
          if (msg.status === 'pending') {
            this.messages.set(msg.id, msg);
          }
        }

        logger.info({ loaded: this.messages.size }, 'Loaded scheduled messages');
      } catch (err) {
        logger.error({ err }, 'Failed to load scheduled messages');
      }
    }
  }

  private saveMessages(): void {
    try {
      const messages = Array.from(this.messages.values());
      writeFileSync(this.storagePath, JSON.stringify({ messages }, null, 2));
    } catch (err) {
      logger.error({ err }, 'Failed to save scheduled messages');
    }
  }

  // ---------------------------------------------------------------------------
  // Checker Loop
  // ---------------------------------------------------------------------------
  private startChecker(): void {
    this.checkInterval = setInterval(() => {
      this.checkScheduledMessages();
    }, 60000);

    this.checkScheduledMessages();
    logger.info('Scheduler checker started (every 60 seconds)');
  }

  registerSocket(sessionId: string, sock: WASocket): void {
    this.socks.set(sessionId, sock);
    logger.info({ sessionId }, 'Socket registered with scheduler');
  }

  unregisterSocket(sessionId: string): void {
    this.socks.delete(sessionId);
  }

  // ---------------------------------------------------------------------------
  // Schedule / Cancel
  // ---------------------------------------------------------------------------
  scheduleMessage(
    sessionId: string,
    jid: string,
    content: any,
    sendAt: Date | number,
    options?: {
      recurring?: { intervalMs: number; maxOccurrences?: number };
      type?: 'single' | 'broadcast';
      broadcastJids?: string[];
    }
  ): ScheduledMessage {
    const msg: ScheduledMessage = {
      id: this.generateId(),
      sessionId,
      jid,
      content,
      sendAt: typeof sendAt === 'number' ? sendAt : sendAt.getTime(),
      recurring: options?.recurring,
      status: 'pending',
      createdAt: Date.now(),
      type: options?.type ?? 'single',
      broadcastJids: options?.broadcastJids,
    };

    this.messages.set(msg.id, msg);
    this.saveMessages();

    logger.info({
      messageId: msg.id,
      jid,
      sendAt: new Date(msg.sendAt).toISOString(),
      type: msg.type,
      recurring: !!options?.recurring,
    }, 'Message scheduled');

    this.emit('message:scheduled', msg);
    return msg;
  }

  cancelScheduledMessage(id: string): boolean {
    const msg = this.messages.get(id);
    if (!msg || msg.status !== 'pending') return false;

    msg.status = 'cancelled';
    this.saveMessages();
    this.emit('message:cancelled', msg);

    logger.info({ messageId: id }, 'Scheduled message cancelled');
    return true;
  }

  broadcastMessage(
    sessionId: string,
    targets: string[],
    message: any,
    sendAt: Date | number
  ): ScheduledMessage {
    const firstJid = targets[0] ?? '';
    return this.scheduleMessage(sessionId, firstJid, message, sendAt, {
      type: 'broadcast',
      broadcastJids: targets,
    });
  }

  // ---------------------------------------------------------------------------
  // Check & Send
  // ---------------------------------------------------------------------------
  async checkScheduledMessages(): Promise<void> {
    const now = Date.now();
    const pendingMessages = Array.from(this.messages.values()).filter(
      (msg) => msg.status === 'pending' && msg.sendAt <= now
    );

    for (const msg of pendingMessages) {
      await this.sendScheduledMessage(msg);
    }
  }

  private async sendScheduledMessage(msg: ScheduledMessage): Promise<void> {
    const sock = this.socks.get(msg.sessionId);
    if (!sock) {
      logger.warn({ messageId: msg.id, sessionId: msg.sessionId }, 'No socket available for scheduled message');
      msg.status = 'failed';
      msg.error = 'No active connection';
      this.saveMessages();
      this.emit('message:failed', msg);
      return;
    }

    try {
      if (msg.type === 'broadcast' && msg.broadcastJids?.length) {
        let sentCount = 0;
        let failCount = 0;

        for (const jid of msg.broadcastJids) {
          try {
            await sock.sendMessage(jid, msg.content);
            sentCount++;
          } catch (err) {
            failCount++;
            logger.error({ err, jid }, 'Failed to send broadcast message to jid');
          }
        }

        msg.status = 'sent';
        msg.sentAt = Date.now();
        logger.info({ messageId: msg.id, sentCount, failCount }, 'Broadcast message sent');
        this.emit('message:sent', msg, { sentCount, failCount });
      } else {
        await sock.sendMessage(msg.jid, msg.content);
        msg.status = 'sent';
        msg.sentAt = Date.now();
        logger.info({ messageId: msg.id, jid: msg.jid }, 'Scheduled message sent');
        this.emit('message:sent', msg);
      }

      // Handle recurring messages
      if (msg.recurring && msg.status === 'sent') {
        const occurrences = (msg.recurring.occurrences ?? 0) + 1;
        const maxReached = msg.recurring.maxOccurrences
          ? occurrences >= msg.recurring.maxOccurrences
          : false;

        if (!maxReached) {
          const nextMsg: ScheduledMessage = {
            ...msg,
            id: this.generateId(),
            sendAt: msg.sendAt + msg.recurring.intervalMs,
            status: 'pending',
            sentAt: undefined,
            error: undefined,
            recurring: {
              ...msg.recurring,
              occurrences,
            },
          };
          this.messages.set(nextMsg.id, nextMsg);
          logger.info({ messageId: nextMsg.id, nextSendAt: new Date(nextMsg.sendAt).toISOString() }, 'Recurring message scheduled');
          this.emit('message:recurring', nextMsg);
        }
      }

      this.saveMessages();
    } catch (err) {
      logger.error({ err, messageId: msg.id }, 'Failed to send scheduled message');
      msg.status = 'failed';
      msg.error = String(err);
      this.saveMessages();
      this.emit('message:failed', msg);
    }
  }

  // ---------------------------------------------------------------------------
  // Listing & Stats
  // ---------------------------------------------------------------------------
  getScheduledMessages(sessionId?: string): ScheduledMessage[] {
    const messages = Array.from(this.messages.values())
      .filter((msg) => msg.status === 'pending');

    if (sessionId) {
      return messages.filter((msg) => msg.sessionId === sessionId);
    }
    return messages;
  }

  listPendingMessages(sessionId?: string): ScheduledMessage[] {
    return this.getScheduledMessages(sessionId);
  }

  listAllMessages(sessionId?: string): ScheduledMessage[] {
    const messages = Array.from(this.messages.values());
    if (sessionId) {
      return messages.filter((msg) => msg.sessionId === sessionId);
    }
    return messages;
  }

  listSentMessages(sessionId?: string): ScheduledMessage[] {
    const messages = Array.from(this.messages.values())
      .filter((msg) => msg.status === 'sent');
    if (sessionId) {
      return messages.filter((msg) => msg.sessionId === sessionId);
    }
    return messages;
  }

  listFailedMessages(sessionId?: string): ScheduledMessage[] {
    const messages = Array.from(this.messages.values())
      .filter((msg) => msg.status === 'failed');
    if (sessionId) {
      return messages.filter((msg) => msg.sessionId === sessionId);
    }
    return messages;
  }

  getStats(): {
    total: number;
    pending: number;
    sent: number;
    failed: number;
    cancelled: number;
    recurring: number;
  } {
    const all = Array.from(this.messages.values());
    return {
      total: all.length,
      pending: all.filter((m) => m.status === 'pending').length,
      sent: all.filter((m) => m.status === 'sent').length,
      failed: all.filter((m) => m.status === 'failed').length,
      cancelled: all.filter((m) => m.status === 'cancelled').length,
      recurring: all.filter((m) => m.recurring).length,
    };
  }

  retryFailed(messageId: string): boolean {
    const msg = this.messages.get(messageId);
    if (!msg || msg.status !== 'failed') return false;

    msg.status = 'pending';
    msg.sendAt = Date.now();
    msg.error = undefined;
    this.saveMessages();

    logger.info({ messageId }, 'Retrying failed message');
    this.emit('message:retry', msg);
    return true;
  }

  cleanupOldMessages(maxAge: number = 7 * 24 * 3600000): number {
    const cutoff = Date.now() - maxAge;
    let cleaned = 0;

    for (const [id, msg] of this.messages) {
      if (msg.status !== 'pending' && (msg.sentAt ?? msg.createdAt) < cutoff) {
        this.messages.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.saveMessages();
      logger.info({ cleaned }, 'Old scheduled messages cleaned up');
    }

    return cleaned;
  }

  private generateId(): string {
    return `sch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    logger.info('Scheduler destroyed');
  }
}
