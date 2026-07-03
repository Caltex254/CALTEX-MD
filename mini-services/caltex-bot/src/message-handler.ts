// ============================================================================
// CALTEX MD WhatsApp Bot - Message Handler
// Processes incoming messages: command parsing, anti-feature checks,
// auto-reply, welcome/goodbye, auto-read/typing/recording/react
// ============================================================================

import { WASocket, proto, GroupMetadata } from '@whiskeysockets/baileys';
import { EventEmitter } from 'events';
import pino from 'pino';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { AntiFeatures } from './anti-features';
import { MediaHandler } from './media-handler';
import { AIHandler } from './ai-handler';
import { GroupManager } from './group-manager';
import type { BotConfig, CommandContext, CommandDefinition } from './types';

const logger = pino({
  level: 'info',
  transport: {
    target: 'pino/file',
    options: { destination: join(process.cwd(), 'bot.log') },
  },
}).child({ module: 'message-handler' });

const DEFAULT_CONFIG: BotConfig = {
  prefix: '!',
  ownerJids: [],
  autoReply: {
    enabled: false,
    replies: [],
  },
  welcome: {
    enabled: true,
    message: 'Welcome to the group, @user! 🎉',
  },
  goodbye: {
    enabled: true,
    message: 'Goodbye @user! 👋',
  },
  autoReact: {
    enabled: false,
    emojis: ['👍', '❤️', '😂', '😮', '😢', '🙏'],
  },
  autoRead: false,
  autoTyping: false,
  autoRecording: false,
  autoStatusView: false,
  blockedJids: [],
};

export class MessageHandler extends EventEmitter {
  private config: BotConfig;
  private antiFeatures: AntiFeatures;
  private mediaHandler: MediaHandler;
  private aiHandler: AIHandler;
  private groupManager: GroupManager;
  private commands: Map<string, CommandDefinition> = new Map();
  private configPath: string;

  constructor(
    antiFeatures: AntiFeatures,
    mediaHandler: MediaHandler,
    aiHandler: AIHandler,
    groupManager: GroupManager,
    configPath?: string
  ) {
    super();
    this.antiFeatures = antiFeatures;
    this.mediaHandler = mediaHandler;
    this.aiHandler = aiHandler;
    this.groupManager = groupManager;
    this.configPath = configPath ?? join(process.cwd(), 'bot-config.json');
    this.config = this.loadConfig();
    this.registerBuiltinCommands();
  }

  private loadConfig(): BotConfig {
    if (existsSync(this.configPath)) {
      try {
        const data = JSON.parse(readFileSync(this.configPath, 'utf-8'));
        return { ...DEFAULT_CONFIG, ...data };
      } catch (err) {
        logger.error({ err }, 'Failed to load bot config');
      }
    }
    return { ...DEFAULT_CONFIG };
  }

  saveConfig(): void {
    try {
      writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (err) {
      logger.error({ err }, 'Failed to save bot config');
    }
  }

  getConfig(): BotConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<BotConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
  }

  // ---------------------------------------------------------------------------
  // Built-in Commands
  // ---------------------------------------------------------------------------
  private registerBuiltinCommands(): void {
    const builtinCommands: CommandDefinition[] = [
      {
        name: 'ping',
        aliases: ['p'],
        description: 'Check if the bot is alive',
        category: 'general',
        usage: '!ping',
        ownerOnly: false,
        groupOnly: false,
        adminOnly: false,
        handler: async (ctx) => {
          const start = Date.now();
          await ctx.sock.sendMessage(ctx.jid, { text: '🏓 Pong!' }, { quoted: ctx.message });
          const latency = Date.now() - start;
          logger.info({ latency }, 'Ping command executed');
        },
      },
      {
        name: 'help',
        aliases: ['h', 'menu'],
        description: 'Show available commands',
        category: 'general',
        usage: '!help [category]',
        ownerOnly: false,
        groupOnly: false,
        adminOnly: false,
        handler: async (ctx) => {
          const categories = new Map<string, CommandDefinition[]>();
          for (const cmd of this.commands.values()) {
            const list = categories.get(cmd.category) ?? [];
            list.push(cmd);
            categories.set(cmd.category, list);
          }

          let text = '🤖 *CALTEX MD Bot Commands*\n\n';
          for (const [category, cmds] of categories) {
            text += `*${category.toUpperCase()}*\n`;
            for (const cmd of cmds) {
              text += `  ${this.config.prefix}${cmd.name} - ${cmd.description}\n`;
            }
            text += '\n';
          }

          await ctx.sock.sendMessage(ctx.jid, { text }, { quoted: ctx.message });
        },
      },
      {
        name: 'info',
        aliases: ['about'],
        description: 'Show bot information',
        category: 'general',
        usage: '!info',
        ownerOnly: false,
        groupOnly: false,
        adminOnly: false,
        handler: async (ctx) => {
          const text =
            '🤖 *CALTEX MD Bot*\n\n' +
            'Version: 1.0.0\n' +
            'Framework: Baileys MD\n' +
            'Runtime: Bun\n' +
            'TypeScript: ✅\n\n' +
            'A powerful WhatsApp multi-device bot.';
          await ctx.sock.sendMessage(ctx.jid, { text }, { quoted: ctx.message });
        },
      },
      {
        name: 'ai',
        aliases: ['chat', 'ask'],
        description: 'Chat with AI',
        category: 'ai',
        usage: '!ai <question>',
        ownerOnly: false,
        groupOnly: false,
        adminOnly: false,
        handler: async (ctx) => {
          if (!ctx.args.length) {
            await ctx.sock.sendMessage(ctx.jid, { text: '❌ Please provide a question. Usage: !ai <question>' }, { quoted: ctx.message });
            return;
          }
          try {
            await ctx.sock.sendPresenceUpdate('composing', ctx.jid);
            const response = await ctx.aiHandler.chatWithMemory(ctx.jid, ctx.args.join(' '));
            await ctx.sock.sendMessage(ctx.jid, { text: response }, { quoted: ctx.message });
          } catch (err) {
            await ctx.sock.sendMessage(ctx.jid, { text: '❌ AI request failed. Please try again later.' }, { quoted: ctx.message });
          }
        },
      },
      {
        name: 'translate',
        aliases: ['tr'],
        description: 'Translate text to a target language',
        category: 'ai',
        usage: '!translate <lang> <text>',
        ownerOnly: false,
        groupOnly: false,
        adminOnly: false,
        handler: async (ctx) => {
          if (ctx.args.length < 2) {
            await ctx.sock.sendMessage(ctx.jid, { text: '❌ Usage: !translate <language> <text>' }, { quoted: ctx.message });
            return;
          }
          try {
            const targetLang = ctx.args[0];
            const text = ctx.args.slice(1).join(' ');
            const result = await ctx.aiHandler.translate('openai', text, targetLang);
            await ctx.sock.sendMessage(ctx.jid, { text: `🌍 *Translation (${targetLang}):*\n\n${result}` }, { quoted: ctx.message });
          } catch (err) {
            await ctx.sock.sendMessage(ctx.jid, { text: '❌ Translation failed.' }, { quoted: ctx.message });
          }
        },
      },
      {
        name: 'summarize',
        aliases: ['sum'],
        description: 'Summarize text',
        category: 'ai',
        usage: '!summarize <text>',
        ownerOnly: false,
        groupOnly: false,
        adminOnly: false,
        handler: async (ctx) => {
          if (!ctx.args.length) {
            await ctx.sock.sendMessage(ctx.jid, { text: '❌ Please provide text to summarize.' }, { quoted: ctx.message });
            return;
          }
          try {
            const result = await ctx.aiHandler.summarize('openai', ctx.args.join(' '));
            await ctx.sock.sendMessage(ctx.jid, { text: `📝 *Summary:*\n\n${result}` }, { quoted: ctx.message });
          } catch (err) {
            await ctx.sock.sendMessage(ctx.jid, { text: '❌ Summarization failed.' }, { quoted: ctx.message });
          }
        },
      },
      {
        name: 'sticker',
        aliases: ['s', 'stiker'],
        description: 'Convert image to sticker',
        category: 'media',
        usage: '!sticker (reply to image)',
        ownerOnly: false,
        groupOnly: false,
        adminOnly: false,
        handler: async (ctx) => {
          const msg = ctx.quoted?.message ?? ctx.message.message;
          if (!msg?.imageMessage) {
            await ctx.sock.sendMessage(ctx.jid, { text: '❌ Please reply to an image to create a sticker.' }, { quoted: ctx.message });
            return;
          }
          try {
            const quotedMsg = ctx.quoted ?? ctx.message;
            const downloaded = await ctx.mediaHandler.downloadMedia(ctx.sock, quotedMsg);
            if (!downloaded) {
              await ctx.sock.sendMessage(ctx.jid, { text: '❌ Failed to download image.' }, { quoted: ctx.message });
              return;
            }
            await ctx.mediaHandler.sendSticker(ctx.sock, ctx.jid, downloaded.buffer, { quoted: ctx.message });
          } catch (err) {
            await ctx.sock.sendMessage(ctx.jid, { text: '❌ Failed to create sticker.' }, { quoted: ctx.message });
          }
        },
      },
      {
        name: 'groupinfo',
        aliases: ['gi'],
        description: 'Show group information',
        category: 'group',
        usage: '!groupinfo',
        ownerOnly: false,
        groupOnly: true,
        adminOnly: false,
        handler: async (ctx) => {
          if (!ctx.groupMetadata) return;
          const info = await ctx.groupManager.getGroupInfo(ctx.sock, ctx.jid);
          if (!info) return;

          const text =
            `📋 *Group Info*\n\n` +
            `*Name:* ${info.subject}\n` +
            `*Members:* ${info.size}\n` +
            `*Description:* ${info.desc || 'No description'}\n` +
            `*Created:* ${info.creation ? new Date(info.creation * 1000).toLocaleDateString() : 'Unknown'}\n` +
            `*Locked:* ${info.restrict ? 'Yes' : 'No'}`;

          await ctx.sock.sendMessage(ctx.jid, { text }, { quoted: ctx.message });
        },
      },
      {
        name: 'promote',
        aliases: ['pm'],
        description: 'Promote user to admin',
        category: 'admin',
        usage: '!promote @user',
        ownerOnly: false,
        groupOnly: true,
        adminOnly: true,
        handler: async (ctx) => {
          const mentioned = ctx.message.message?.extendedTextMessage?.contextInfo?.mentionedJid;
          if (!mentioned?.length) {
            await ctx.sock.sendMessage(ctx.jid, { text: '❌ Please mention a user to promote.' }, { quoted: ctx.message });
            return;
          }
          try {
            await ctx.groupManager.promoteAdmin(ctx.sock, ctx.jid, mentioned[0]);
            await ctx.sock.sendMessage(ctx.jid, { text: `✅ Promoted @${mentioned[0].split('@')[0]} to admin`, mentions: mentioned }, { quoted: ctx.message });
          } catch (err) {
            await ctx.sock.sendMessage(ctx.jid, { text: '❌ Failed to promote user.' }, { quoted: ctx.message });
          }
        },
      },
      {
        name: 'demote',
        aliases: ['dm'],
        description: 'Demote admin to member',
        category: 'admin',
        usage: '!demote @user',
        ownerOnly: false,
        groupOnly: true,
        adminOnly: true,
        handler: async (ctx) => {
          const mentioned = ctx.message.message?.extendedTextMessage?.contextInfo?.mentionedJid;
          if (!mentioned?.length) {
            await ctx.sock.sendMessage(ctx.jid, { text: '❌ Please mention a user to demote.' }, { quoted: ctx.message });
            return;
          }
          try {
            await ctx.groupManager.demoteAdmin(ctx.sock, ctx.jid, mentioned[0]);
            await ctx.sock.sendMessage(ctx.jid, { text: `✅ Demoted @${mentioned[0].split('@')[0]} from admin`, mentions: mentioned }, { quoted: ctx.message });
          } catch (err) {
            await ctx.sock.sendMessage(ctx.jid, { text: '❌ Failed to demote user.' }, { quoted: ctx.message });
          }
        },
      },
      {
        name: 'mute',
        aliases: [],
        description: 'Mute group (only admins can send)',
        category: 'admin',
        usage: '!mute [duration_minutes]',
        ownerOnly: false,
        groupOnly: true,
        adminOnly: true,
        handler: async (ctx) => {
          try {
            const duration = ctx.args[0] ? parseInt(ctx.args[0]) * 60000 : undefined;
            await ctx.groupManager.muteGroup(ctx.sock, ctx.jid, duration);
            await ctx.sock.sendMessage(ctx.jid, { text: `🔇 Group muted${duration ? ` for ${ctx.args[0]} minutes` : ''}.` }, { quoted: ctx.message });
          } catch (err) {
            await ctx.sock.sendMessage(ctx.jid, { text: '❌ Failed to mute group.' }, { quoted: ctx.message });
          }
        },
      },
      {
        name: 'unmute',
        aliases: [],
        description: 'Unmute group',
        category: 'admin',
        usage: '!unmute',
        ownerOnly: false,
        groupOnly: true,
        adminOnly: true,
        handler: async (ctx) => {
          try {
            await ctx.groupManager.unmuteGroup(ctx.sock, ctx.jid);
            await ctx.sock.sendMessage(ctx.jid, { text: '🔊 Group unmuted.' }, { quoted: ctx.message });
          } catch (err) {
            await ctx.sock.sendMessage(ctx.jid, { text: '❌ Failed to unmute group.' }, { quoted: ctx.message });
          }
        },
      },
      {
        name: 'clearai',
        aliases: ['resetai'],
        description: 'Clear AI conversation memory',
        category: 'ai',
        usage: '!clearai',
        ownerOnly: false,
        groupOnly: false,
        adminOnly: false,
        handler: async (ctx) => {
          ctx.aiHandler.clearConversationMemory(ctx.jid);
          await ctx.sock.sendMessage(ctx.jid, { text: '🧠 AI conversation memory cleared.' }, { quoted: ctx.message });
        },
      },
    ];

    for (const cmd of builtinCommands) {
      this.registerCommand(cmd);
    }
  }

  registerCommand(cmd: CommandDefinition): void {
    this.commands.set(cmd.name, cmd);
    for (const alias of cmd.aliases) {
      this.commands.set(alias, cmd);
    }
  }

  listCommands(): { name: string; description: string; category: string; usage: string }[] {
    const seen = new Set<string>();
    const result: { name: string; description: string; category: string; usage: string }[] = [];

    for (const cmd of this.commands.values()) {
      if (!seen.has(cmd.name)) {
        seen.add(cmd.name);
        result.push({
          name: cmd.name,
          description: cmd.description,
          category: cmd.category,
          usage: cmd.usage,
        });
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Main Message Handler
  // ---------------------------------------------------------------------------
  async handleMessage(sock: WASocket, data: any, sessionId: string): Promise<void> {
    const { messages, type } = data;

    if (type !== 'notify' && type !== 'append') return;

    for (const message of messages) {
      try {
        await this.processMessage(sock, message, sessionId);
      } catch (err) {
        logger.error({ err, key: message.key }, 'Error processing message');
      }
    }
  }

  private async processMessage(sock: WASocket, message: proto.IWebMessageInfo, sessionId: string): Promise<void> {
    if (!message.message) return;
    if (message.key.fromMe) return;

    const jid = message.key.remoteJid!;
    const sender = message.key.participant || message.key.remoteJid!;
    const isGroup = jid.endsWith('@g.us');
    const text = this.antiFeatures.extractText(message);

    // Check blocked JIDs
    if (this.config.blockedJids.includes(sender)) {
      logger.debug({ sender }, 'Message from blocked JID, ignoring');
      return;
    }

    // Get group metadata if needed
    let groupMetadata: GroupMetadata | undefined;
    if (isGroup) {
      groupMetadata = await this.groupManager.getGroupMetadata(sock, jid) ?? undefined;
    }

    const isOwner = this.config.ownerJids.includes(sender);
    const isAdmin = isOwner || (groupMetadata?.participants?.some(
      (p) => p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin')
    ) ?? false);
    const isBotAdmin = isGroup ? await this.groupManager.isBotAdmin(sock, jid) : false;

    // Store message for anti-delete
    this.antiFeatures.storeDeletedMessage(message, jid);

    // Handle view-once messages
    this.antiFeatures.storeViewOnceMessage(message, jid);
    if (message.message.viewOnceMessage || message.message.viewOnceMessageV2) {
      await this.antiFeatures.handleAntiViewOnce(sock, message);
    }

    // Anti-feature checks (only in groups)
    if (isGroup && isBotAdmin) {
      await this.antiFeatures.enforceAntiLink(sock, message, groupMetadata);
      await this.antiFeatures.enforceAntiBadword(sock, message, groupMetadata);
      await this.antiFeatures.enforceAntiSpam(sock, message, groupMetadata);
      await this.antiFeatures.enforceAntiTag(sock, message, groupMetadata);
    }

    // Auto-read
    if (this.config.autoRead) {
      try {
        await sock.readMessages([message.key]);
      } catch (err) {
        logger.debug({ err }, 'Failed to mark message as read');
      }
    }

    // Auto-typing
    if (this.config.autoTyping) {
      try {
        await sock.sendPresenceUpdate('composing', jid);
      } catch (err) {
        logger.debug({ err }, 'Failed to send typing presence');
      }
    }

    // Auto-recording
    if (this.config.autoRecording) {
      try {
        await sock.sendPresenceUpdate('recording', jid);
      } catch (err) {
        logger.debug({ err }, 'Failed to send recording presence');
      }
    }

    // Auto-react
    if (this.config.autoReact.enabled && text) {
      const emoji = this.config.autoReact.emojis[Math.floor(Math.random() * this.config.autoReact.emojis.length)];
      try {
        if (message.key.id) {
          await this.mediaHandler.sendReaction(sock, jid, message.key.id, emoji);
        }
      } catch (err) {
        logger.debug({ err }, 'Failed to send auto-reaction');
      }
    }

    // Auto-reply matching
    if (this.config.autoReply.enabled && text) {
      for (const reply of this.config.autoReply.replies) {
        const trigger = reply.trigger;
        const matches = reply.exact
          ? text.toLowerCase() === (typeof trigger === 'string' ? trigger.toLowerCase() : '')
          : typeof trigger === 'string'
            ? text.toLowerCase().includes(trigger.toLowerCase())
            : trigger.test(text);

        if (matches) {
          try {
            await sock.sendMessage(jid, { text: reply.response }, { quoted: message });
          } catch (err) {
            logger.error({ err }, 'Failed to send auto-reply');
          }
          break;
        }
      }
    }

    // Process commands
    if (text && text.startsWith(this.config.prefix)) {
      await this.processCommand(sock, message, text, jid, sender, isGroup, isOwner, isAdmin, isBotAdmin, groupMetadata, sessionId);
    }

    // Emit event for dashboard
    this.emit('message:processed', {
      jid,
      sender,
      text,
      isGroup,
      isCommand: text?.startsWith(this.config.prefix),
      timestamp: Date.now(),
    });
  }

  private async processCommand(
    sock: WASocket,
    message: proto.IWebMessageInfo,
    text: string,
    jid: string,
    sender: string,
    isGroup: boolean,
    isOwner: boolean,
    isAdmin: boolean,
    isBotAdmin: boolean,
    groupMetadata: GroupMetadata | undefined,
    sessionId: string
  ): Promise<void> {
    const args = text.slice(this.config.prefix.length).trim().split(/\s+/);
    const commandName = args.shift()?.toLowerCase();

    if (!commandName) return;

    const command = this.commands.get(commandName);
    if (!command) return;

    // Check restrictions
    if (command.ownerOnly && !isOwner) {
      await sock.sendMessage(jid, { text: '❌ This command is owner-only.' }, { quoted: message });
      return;
    }
    if (command.groupOnly && !isGroup) {
      await sock.sendMessage(jid, { text: '❌ This command can only be used in groups.' }, { quoted: message });
      return;
    }
    if (command.adminOnly && !isAdmin) {
      await sock.sendMessage(jid, { text: '❌ This command is admin-only.' }, { quoted: message });
      return;
    }

    // Get quoted message
    const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage
      ? (() => {
          const quoted: any = {
            key: {
              remoteJid: jid,
              fromMe: false,
              id: message.message.extendedTextMessage.contextInfo.stanzaId,
              participant: message.message.extendedTextMessage.contextInfo.participant,
            },
            message: message.message.extendedTextMessage.contextInfo.quotedMessage,
          };
          return quoted as proto.IWebMessageInfo;
        })()
      : undefined;

    const ctx: CommandContext = {
      sock,
      message,
      jid,
      sender,
      text,
      args,
      command: commandName,
      isGroup,
      isOwner,
      isAdmin,
      isBotAdmin,
      groupMetadata,
      quoted: quotedMsg,
      mediaHandler: this.mediaHandler,
      antiFeatures: this.antiFeatures,
      groupManager: this.groupManager,
      aiHandler: this.aiHandler,
      sessionId,
    };

    try {
      await command.handler(ctx);
      this.emit('command:executed', { command: commandName, sender, jid, success: true });
    } catch (err) {
      logger.error({ err, command: commandName, sender, jid }, 'Command execution failed');
      try {
        await sock.sendMessage(jid, { text: '❌ Command execution failed.' }, { quoted: message });
      } catch {}
      this.emit('command:executed', { command: commandName, sender, jid, success: false, error: String(err) });
    }
  }

  // ---------------------------------------------------------------------------
  // Group Participant Events
  // ---------------------------------------------------------------------------
  async handleGroupParticipantsUpdate(sock: WASocket, data: any, sessionId: string): Promise<void> {
    const { id: groupJid, participants, action } = data;

    if (action === 'add' && this.config.welcome.enabled) {
      for (const participant of participants) {
        try {
          const welcomeMsg = this.config.welcome.message.replace('@user', `@${participant.split('@')[0]}`);
          await sock.sendMessage(groupJid, {
            text: welcomeMsg,
            mentions: [participant],
          });
        } catch (err) {
          logger.error({ err, groupJid, participant }, 'Failed to send welcome message');
        }
      }
    }

    if ((action === 'remove' || action === 'leave') && this.config.goodbye.enabled) {
      for (const participant of participants) {
        try {
          const goodbyeMsg = this.config.goodbye.message.replace('@user', `@${participant.split('@')[0]}`);
          await sock.sendMessage(groupJid, {
            text: goodbyeMsg,
            mentions: [participant],
          });
        } catch (err) {
          logger.error({ err, groupJid, participant }, 'Failed to send goodbye message');
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Call Event Handler
  // ---------------------------------------------------------------------------
  async handleCall(sock: WASocket, data: any, sessionId: string): Promise<void> {
    for (const call of data) {
      try {
        await this.antiFeatures.handleAntiCall(sock, call);
      } catch (err) {
        logger.error({ err }, 'Failed to handle call event');
      }
    }
  }
}
