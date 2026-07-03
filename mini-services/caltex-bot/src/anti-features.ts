// ============================================================================
// CALTEX MD WhatsApp Bot - Anti-Features Module
// Implements anti-link, anti-badword, anti-spam, anti-delete, anti-view-once,
// anti-tag, and anti-call features
// ============================================================================

import { WASocket, proto, WACallEvent, GroupMetadata } from '@whiskeysockets/baileys';
import pino from 'pino';
import { join } from 'path';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import type { AntiFeatureConfig, AntiCheckResult } from './types';

const logger = pino({
  level: 'info',
  transport: {
    target: 'pino/file',
    options: { destination: join(process.cwd(), 'bot.log') },
  },
}).child({ module: 'anti-features' });

const DEFAULT_CONFIG: AntiFeatureConfig = {
  antiLink: {
    enabled: false,
    allowedDomains: ['whatsapp.com', 'wa.me'],
    warnFirst: true,
    action: 'delete',
  },
  antiBadword: {
    enabled: false,
    words: ['fuck', 'shit', 'asshole', 'bitch', 'damn', 'crap', 'bastard', 'dick'],
    action: 'delete',
  },
  antiSpam: {
    enabled: false,
    maxMessages: 5,
    intervalMs: 10000,
    action: 'warn',
    muteDurationMs: 60000,
  },
  antiDelete: {
    enabled: false,
    forwardTo: null,
  },
  antiViewOnce: {
    enabled: false,
    forwardTo: null,
  },
  antiTag: {
    enabled: false,
    maxMentions: 10,
    action: 'warn',
  },
  antiCall: {
    enabled: false,
    rejectCall: true,
    sendMessage: true,
    message: '🚫 Calls are not allowed. Please send a text message instead.',
  },
};

const URL_REGEX = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*)/gi;

interface SpamTracker {
  messages: number[];
  warned: boolean;
  muted: boolean;
  muteTimer?: NodeJS.Timeout;
}

export class AntiFeatures {
  private config: AntiFeatureConfig;
  private spamTrackers: Map<string, SpamTracker> = new Map();
  private deletedMessages: Map<string, { message: proto.IWebMessageInfo; chat: string }> = new Map();
  private viewOnceMessages: Map<string, { message: proto.IWebMessageInfo; chat: string }> = new Map();
  private configPath: string;
  private perGroupConfig: Map<string, Partial<AntiFeatureConfig>> = new Map();

  constructor(configPath?: string) {
    this.configPath = configPath ?? join(process.cwd(), 'anti-config.json');
    this.config = this.loadConfig();
  }

  private loadConfig(): AntiFeatureConfig {
    if (existsSync(this.configPath)) {
      try {
        const data = JSON.parse(readFileSync(this.configPath, 'utf-8'));
        return { ...DEFAULT_CONFIG, ...data };
      } catch (err) {
        logger.error({ err }, 'Failed to load anti-config, using defaults');
      }
    }
    return { ...DEFAULT_CONFIG };
  }

  saveConfig(): void {
    try {
      const dir = join(this.configPath, '..');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (err) {
      logger.error({ err }, 'Failed to save anti-config');
    }
  }

  getConfig(): AntiFeatureConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<AntiFeatureConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
  }

  setGroupConfig(groupId: string, config: Partial<AntiFeatureConfig>): void {
    this.perGroupConfig.set(groupId, config);
  }

  getGroupConfig(groupId: string): AntiFeatureConfig {
    const groupConfig = this.perGroupConfig.get(groupId);
    if (!groupConfig) return this.config;
    return { ...this.config, ...groupConfig } as AntiFeatureConfig;
  }

  // ---------------------------------------------------------------------------
  // Anti-Link
  // ---------------------------------------------------------------------------
  checkAntiLink(
    message: proto.IWebMessageInfo,
    isGroup: boolean,
    isAdmin: boolean
  ): AntiCheckResult {
    if (!isGroup || isAdmin) return { violation: false, reason: '' };

    const chat = message.key.remoteJid!;
    const config = this.getGroupConfig(chat);
    if (!config.antiLink.enabled) return { violation: false, reason: '' };

    const text = this.extractText(message);
    if (!text) return { violation: false, reason: '' };

    URL_REGEX.lastIndex = 0;
    const hasLink = URL_REGEX.test(text);
    if (!hasLink) return { violation: false, reason: '' };

    const allowedDomains = config.antiLink.allowedDomains;
    const urls = text.match(URL_REGEX) || [];
    const hasDisallowedLink = urls.some((url) => {
      const urlLower = url.toLowerCase();
      return !allowedDomains.some((domain) => urlLower.includes(domain.toLowerCase()));
    });

    if (!hasDisallowedLink) return { violation: false, reason: '' };

    return { violation: true, reason: 'Disallowed link detected' };
  }

  async enforceAntiLink(
    sock: WASocket,
    message: proto.IWebMessageInfo,
    groupMetadata?: GroupMetadata
  ): Promise<boolean> {
    const chat = message.key.remoteJid!;
    const sender = message.key.participant || message.key.remoteJid!;
    const isAdmin = groupMetadata?.participants?.some(
      (p) => p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin')
    );

    const check = this.checkAntiLink(message, chat.endsWith('@g.us'), isAdmin);
    if (!check.violation) return false;

    const config = this.getGroupConfig(chat);

    try {
      if (config.antiLink.action === 'delete' || config.antiLink.action === 'kick') {
        await sock.sendMessage(chat, { delete: message.key });
      }
      if (config.antiLink.warnFirst) {
        await sock.sendMessage(chat, {
          text: `⚠️ @${sender.split('@')[0]}, links are not allowed in this group!`,
          mentions: [sender],
        });
      }
      if (config.antiLink.action === 'kick' && groupMetadata) {
        await sock.groupParticipantsUpdate(chat, [sender], 'remove');
      }
      return true;
    } catch (err) {
      logger.error({ err, chat, sender }, 'Anti-link: failed to take action');
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Anti-Badword
  // ---------------------------------------------------------------------------
  checkAntiBadword(message: proto.IWebMessageInfo, badwords: string[]): AntiCheckResult {
    const text = this.extractText(message);
    if (!text) return { violation: false, reason: '' };

    const textLower = text.toLowerCase();
    const hasBadword = badwords.some((word) => textLower.includes(word.toLowerCase()));

    if (!hasBadword) return { violation: false, reason: '' };
    return { violation: true, reason: 'Inappropriate language detected' };
  }

  async enforceAntiBadword(
    sock: WASocket,
    message: proto.IWebMessageInfo,
    groupMetadata?: GroupMetadata
  ): Promise<boolean> {
    const chat = message.key.remoteJid!;
    if (!chat.endsWith('@g.us')) return false;

    const config = this.getGroupConfig(chat);
    if (!config.antiBadword.enabled) return false;

    const sender = message.key.participant || message.key.remoteJid!;
    const isAdmin = groupMetadata?.participants?.some(
      (p) => p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin')
    );
    if (isAdmin) return false;

    const check = this.checkAntiBadword(message, config.antiBadword.words);
    if (!check.violation) return false;

    try {
      if (config.antiBadword.action === 'delete' || config.antiBadword.action === 'kick') {
        await sock.sendMessage(chat, { delete: message.key });
      }
      await sock.sendMessage(chat, {
        text: `🚫 @${sender.split('@')[0]}, inappropriate language is not allowed!`,
        mentions: [sender],
      });
      if (config.antiBadword.action === 'kick' && groupMetadata) {
        await sock.groupParticipantsUpdate(chat, [sender], 'remove');
      }
      return true;
    } catch (err) {
      logger.error({ err, chat, sender }, 'Anti-badword: failed to take action');
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Anti-Spam
  // ---------------------------------------------------------------------------
  checkAntiSpam(
    senderJid: string,
    limit: number,
    windowMs: number
  ): AntiCheckResult {
    const key = senderJid;
    let tracker = this.spamTrackers.get(key);
    if (!tracker) {
      tracker = { messages: [], warned: false, muted: false };
      this.spamTrackers.set(key, tracker);
    }

    const now = Date.now();
    tracker.messages = tracker.messages.filter((ts) => now - ts < windowMs);
    tracker.messages.push(now);

    if (tracker.messages.length <= limit) return { violation: false, reason: '' };
    return { violation: true, reason: `Spam detected: ${tracker.messages.length} messages in ${windowMs}ms` };
  }

  async enforceAntiSpam(
    sock: WASocket,
    message: proto.IWebMessageInfo,
    groupMetadata?: GroupMetadata
  ): Promise<boolean> {
    const chat = message.key.remoteJid!;
    if (!chat.endsWith('@g.us')) return false;

    const config = this.getGroupConfig(chat);
    if (!config.antiSpam.enabled) return false;

    const sender = message.key.participant || message.key.remoteJid!;
    const isAdmin = groupMetadata?.participants?.some(
      (p) => p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin')
    );
    if (isAdmin) return false;

    const key = `${chat}:${sender}`;
    const check = this.checkAntiSpam(key, config.antiSpam.maxMessages, config.antiSpam.intervalMs);
    if (!check.violation) return false;

    const tracker = this.spamTrackers.get(key)!;

    try {
      if (config.antiSpam.action === 'delete') {
        await sock.sendMessage(chat, { delete: message.key });
      }
      if (!tracker.warned || config.antiSpam.action === 'warn') {
        await sock.sendMessage(chat, {
          text: `⚠️ @${sender.split('@')[0]}, you are sending messages too fast. Please slow down!`,
          mentions: [sender],
        });
        tracker.warned = true;
      }
      if (config.antiSpam.action === 'kick' && groupMetadata) {
        await sock.groupParticipantsUpdate(chat, [sender], 'remove');
      }
      if (config.antiSpam.action === 'mute' && !tracker.muted) {
        tracker.muted = true;
        if (tracker.muteTimer) clearTimeout(tracker.muteTimer);
        tracker.muteTimer = setTimeout(() => {
          tracker!.muted = false;
          this.spamTrackers.delete(key);
        }, config.antiSpam.muteDurationMs);
      }
      return true;
    } catch (err) {
      logger.error({ err, chat, sender }, 'Anti-spam: failed to take action');
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Anti-Delete
  // ---------------------------------------------------------------------------
  storeDeletedMessage(message: proto.IWebMessageInfo, chat: string): void {
    if (!this.config.antiDelete.enabled) return;
    const messageId = message.key.id;
    if (!messageId) return;

    this.deletedMessages.set(messageId, { message, chat });
    logger.info({ messageId, chat }, 'Anti-delete: stored message for recovery');

    setTimeout(() => {
      this.deletedMessages.delete(messageId);
    }, 3600000);
  }

  async handleAntiDelete(sock: WASocket, messageId: string, chat: string): Promise<boolean> {
    if (!this.config.antiDelete.enabled) return false;

    const stored = this.deletedMessages.get(messageId);
    if (!stored) return false;

    const text = this.extractText(stored.message);
    const sender = stored.message.key.participant || stored.message.key.remoteJid!;
    const senderName = stored.message.pushName || sender.split('@')[0];
    const forwardChat = this.config.antiDelete.forwardTo || chat;

    logger.info({ messageId, chat, sender }, 'Anti-delete: recovering deleted message');

    try {
      await sock.sendMessage(forwardChat, {
        text:
          `🗑️ *Anti-Delete*\n\n` +
          `*Sender:* ${senderName}\n` +
          `*Original Message:*\n${text || '[Media/Non-text message]'}`,
        mentions: [sender],
      });
      this.deletedMessages.delete(messageId);
      return true;
    } catch (err) {
      logger.error({ err, messageId, chat }, 'Anti-delete: failed to restore');
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Anti-View-Once
  // ---------------------------------------------------------------------------
  storeViewOnceMessage(message: proto.IWebMessageInfo, chat: string): void {
    if (!this.config.antiViewOnce.enabled) return;

    const msg = message.message;
    if (!msg) return;

    const hasViewOnce = msg.viewOnceMessage || msg.viewOnceMessageV2;
    if (!hasViewOnce) return;

    const messageId = message.key.id;
    if (!messageId) return;

    this.viewOnceMessages.set(messageId, { message, chat });
    logger.info({ messageId, chat }, 'Anti-view-once: captured view-once message');
  }

  async handleAntiViewOnce(sock: WASocket, message: proto.IWebMessageInfo): Promise<boolean> {
    if (!this.config.antiViewOnce.enabled) return false;

    const chat = message.key.remoteJid!;
    const msg = message.message;
    if (!msg) return false;

    const viewOnce = msg.viewOnceMessage || msg.viewOnceMessageV2;
    if (!viewOnce) return false;

    const imageMsg = (viewOnce as any)?.message?.imageMessage;
    const videoMsg = (viewOnce as any)?.message?.videoMessage;
    if (!imageMsg && !videoMsg) return false;

    const sender = message.key.participant || message.key.remoteJid!;
    const forwardChat = this.config.antiViewOnce.forwardTo || chat;
    const caption = `👁️ *Anti-View-Once*\n\n*Sender:* ${message.pushName || sender.split('@')[0]}`;

    logger.info({ chat, sender }, 'Anti-view-once: forwarding view-once media');

    try {
      const buffer = await this.downloadMedia(sock, message);
      if (imageMsg && buffer) {
        await sock.sendMessage(forwardChat, {
          image: buffer,
          caption: `${caption}\n${imageMsg.caption || ''}`,
          mentions: [sender],
        });
      } else if (videoMsg && buffer) {
        await sock.sendMessage(forwardChat, {
          video: buffer,
          caption: `${caption}\n${videoMsg.caption || ''}`,
          mentions: [sender],
        });
      } else {
        await sock.sendMessage(forwardChat, {
          text: `${caption}\n[Media could not be downloaded]`,
          mentions: [sender],
        });
      }
      return true;
    } catch (err) {
      logger.error({ err, chat }, 'Anti-view-once: failed to forward');
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Anti-Tag
  // ---------------------------------------------------------------------------
  checkAntiTag(
    message: proto.IWebMessageInfo,
    isGroup: boolean,
    isAdmin: boolean
  ): AntiCheckResult {
    if (!isGroup || isAdmin) return { violation: false, reason: '' };

    const chat = message.key.remoteJid!;
    const config = this.getGroupConfig(chat);
    if (!config.antiTag.enabled) return { violation: false, reason: '' };

    const msg = message.message;
    if (!msg) return { violation: false, reason: '' };

    const extendedText = msg.extendedTextMessage;
    const mentionedJids = extendedText?.contextInfo?.mentionedJid;

    if (!mentionedJids || mentionedJids.length === 0) return { violation: false, reason: '' };
    if (mentionedJids.length <= config.antiTag.maxMentions) return { violation: false, reason: '' };

    return { violation: true, reason: `Mass tag detected: ${mentionedJids.length} mentions` };
  }

  async enforceAntiTag(
    sock: WASocket,
    message: proto.IWebMessageInfo,
    groupMetadata?: GroupMetadata
  ): Promise<boolean> {
    const chat = message.key.remoteJid!;
    const sender = message.key.participant || message.key.remoteJid!;
    const isAdmin = groupMetadata?.participants?.some(
      (p) => p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin')
    );

    const check = this.checkAntiTag(message, chat.endsWith('@g.us'), isAdmin);
    if (!check.violation) return false;

    const config = this.getGroupConfig(chat);

    try {
      if (config.antiTag.action === 'delete' || config.antiTag.action === 'kick') {
        await sock.sendMessage(chat, { delete: message.key });
      }
      await sock.sendMessage(chat, {
        text: `⚠️ @${sender.split('@')[0]}, mass tagging is not allowed!`,
        mentions: [sender],
      });
      if (config.antiTag.action === 'kick' && groupMetadata) {
        await sock.groupParticipantsUpdate(chat, [sender], 'remove');
      }
      return true;
    } catch (err) {
      logger.error({ err, chat, sender }, 'Anti-tag: failed to take action');
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Anti-Call
  // ---------------------------------------------------------------------------
  async handleAntiCall(sock: WASocket, call: WACallEvent): Promise<boolean> {
    if (!this.config.antiCall.enabled) return false;

    const from = call.from;
    if (!from) return false;

    logger.info({ from, id: call.id }, 'Anti-call: incoming call detected');

    try {
      if (this.config.antiCall.rejectCall) {
        await sock.rejectCall(call.id, from);
      }
      if (this.config.antiCall.sendMessage) {
        await sock.sendMessage(from, { text: this.config.antiCall.message });
      }
      return true;
    } catch (err) {
      logger.error({ err, from }, 'Anti-call: failed to handle call');
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------
  extractText(message: proto.IWebMessageInfo): string {
    const msg = message.message;
    if (!msg) return '';

    if (msg.conversation) return msg.conversation;
    if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
    if (msg.imageMessage?.caption) return msg.imageMessage.caption;
    if (msg.videoMessage?.caption) return msg.videoMessage.caption;
    if (msg.buttonsResponseMessage?.selectedDisplayText)
      return msg.buttonsResponseMessage.selectedDisplayText;
    if (msg.listResponseMessage?.title) return msg.listResponseMessage.title;
    if (msg.templateButtonReplyMessage?.selectedDisplayText)
      return msg.templateButtonReplyMessage.selectedDisplayText;

    return '';
  }

  private async downloadMedia(sock: WASocket, message: proto.IWebMessageInfo): Promise<Buffer | null> {
    try {
      const msg = message.message;
      if (!msg) return null;

      let mediaMsg: any = null;
      let mediaType: string | null = null;

      if (msg.imageMessage) { mediaMsg = msg.imageMessage; mediaType = 'image'; }
      else if (msg.videoMessage) { mediaMsg = msg.videoMessage; mediaType = 'video'; }
      else if (msg.audioMessage) { mediaMsg = msg.audioMessage; mediaType = 'audio'; }
      else if (msg.documentMessage) { mediaMsg = msg.documentMessage; mediaType = 'document'; }
      else if (msg.stickerMessage) { mediaMsg = msg.stickerMessage; mediaType = 'sticker'; }
      else if (msg.viewOnceMessage) {
        const inner = (msg.viewOnceMessage as any)?.message;
        if (inner?.imageMessage) { mediaMsg = inner.imageMessage; mediaType = 'image'; }
        else if (inner?.videoMessage) { mediaMsg = inner.videoMessage; mediaType = 'video'; }
      } else if (msg.viewOnceMessageV2) {
        const inner = (msg.viewOnceMessageV2 as any)?.message;
        if (inner?.imageMessage) { mediaMsg = inner.imageMessage; mediaType = 'image'; }
        else if (inner?.videoMessage) { mediaMsg = inner.videoMessage; mediaType = 'video'; }
      }

      if (!mediaMsg || !mediaType) return null;

      const stream = await sock.downloadMediaFromMessage(mediaMsg, mediaType as any);
      if (!stream) return null;

      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    } catch (err) {
      logger.error({ err }, 'Failed to download media');
      return null;
    }
  }

  clearSpamTrackers(): void {
    for (const [, tracker] of this.spamTrackers) {
      if (tracker.muteTimer) clearTimeout(tracker.muteTimer);
    }
    this.spamTrackers.clear();
  }

  getDeletedMessageCount(): number {
    return this.deletedMessages.size;
  }

  getViewOnceMessageCount(): number {
    return this.viewOnceMessages.size;
  }
}
