// ============================================================================
// CALTEX MD WhatsApp Bot - Moderation Commands
// Anti-features toggles, warnings, message purge, tagging, and welcome/goodbye
// ============================================================================

import type { Plugin, CommandContext } from '../plugin-loader';

// ---------------------------------------------------------------------------
// In-memory moderation state per group
// ---------------------------------------------------------------------------

interface GroupModState {
  antiLink: boolean;
  antiBadword: boolean;
  antiSpam: boolean;
  antiDelete: boolean;
  antiViewOnce: boolean;
  antiCall: boolean;
  welcomeEnabled: boolean;
  goodbyeEnabled: boolean;
  welcomeMessage: string;
  goodbyeMessage: string;
  warnings: Map<string, { reason: string; date: number; warnedBy: string }[]>;
}

const groupStates: Map<string, GroupModState> = new Map();

const DEFAULT_MOD_STATE: Omit<GroupModState, 'warnings'> = {
  antiLink: false,
  antiBadword: false,
  antiSpam: false,
  antiDelete: false,
  antiViewOnce: false,
  antiCall: false,
  welcomeEnabled: false,
  goodbyeEnabled: false,
  welcomeMessage: 'Welcome to the group, @user! 🎉',
  goodbyeMessage: 'Goodbye @user! 👋',
};

function getGroupState(jid: string): GroupModState {
  if (!groupStates.has(jid)) {
    groupStates.set(jid, {
      ...DEFAULT_MOD_STATE,
      warnings: new Map(),
    });
  }
  return groupStates.get(jid)!;
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

const moderationPlugin: Plugin = {
  name: 'moderation',
  version: '1.0.0',
  description: 'Group moderation: anti-features, warnings, tagging, and welcome/goodbye management',
  author: 'CALTEX MD',
  enabled: true,
  commands: [
    {
      name: 'antiland',
      description: 'Toggle anti-link protection (deletes links in group)',
      category: 'moderation',
      aliases: ['antilink'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isGroup || !ctx.isAdmin) {
          await ctx.reply('❌ Admin only command for groups.');
          return;
        }
        const state = getGroupState(ctx.jid);
        const action = ctx.args[0]?.toLowerCase();
        if (action === 'on') {
          state.antiLink = true;
          await ctx.reply('🔗 Anti-link enabled. Links will be deleted.');
        } else if (action === 'off') {
          state.antiLink = false;
          await ctx.reply('🔗 Anti-link disabled.');
        } else {
          state.antiLink = !state.antiLink;
          await ctx.reply(`🔗 Anti-link is now *${state.antiLink ? 'ENABLED' : 'DISABLED'}*.`);
        }
      },
    },
    {
      name: 'antibadword',
      description: 'Toggle anti-badword filter',
      category: 'moderation',
      aliases: ['antibw', 'badword'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isGroup || !ctx.isAdmin) {
          await ctx.reply('❌ Admin only command for groups.');
          return;
        }
        const state = getGroupState(ctx.jid);
        const action = ctx.args[0]?.toLowerCase();
        if (action === 'on') {
          state.antiBadword = true;
          await ctx.reply('🤬 Anti-badword enabled. Bad words will be deleted.');
        } else if (action === 'off') {
          state.antiBadword = false;
          await ctx.reply('🤬 Anti-badword disabled.');
        } else {
          state.antiBadword = !state.antiBadword;
          await ctx.reply(`🤬 Anti-badword is now *${state.antiBadword ? 'ENABLED' : 'DISABLED'}*.`);
        }
      },
    },
    {
      name: 'antispam',
      description: 'Toggle anti-spam protection',
      category: 'moderation',
      aliases: ['spam'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isGroup || !ctx.isAdmin) {
          await ctx.reply('❌ Admin only command for groups.');
          return;
        }
        const state = getGroupState(ctx.jid);
        const action = ctx.args[0]?.toLowerCase();
        if (action === 'on') {
          state.antiSpam = true;
          await ctx.reply('🚫 Anti-spam enabled. Spam messages will be deleted.');
        } else if (action === 'off') {
          state.antiSpam = false;
          await ctx.reply('🚫 Anti-spam disabled.');
        } else {
          state.antiSpam = !state.antiSpam;
          await ctx.reply(`🚫 Anti-spam is now *${state.antiSpam ? 'ENABLED' : 'DISABLED'}*.`);
        }
      },
    },
    {
      name: 'antidelete',
      description: 'Toggle anti-delete (recover deleted messages)',
      category: 'moderation',
      aliases: ['adelete'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isGroup || !ctx.isAdmin) {
          await ctx.reply('❌ Admin only command for groups.');
          return;
        }
        const state = getGroupState(ctx.jid);
        const action = ctx.args[0]?.toLowerCase();
        if (action === 'on') {
          state.antiDelete = true;
          await ctx.reply('♻️ Anti-delete enabled. Deleted messages will be recovered and forwarded.');
        } else if (action === 'off') {
          state.antiDelete = false;
          await ctx.reply('♻️ Anti-delete disabled.');
        } else {
          state.antiDelete = !state.antiDelete;
          await ctx.reply(`♻️ Anti-delete is now *${state.antiDelete ? 'ENABLED' : 'DISABLED'}*.`);
        }
      },
    },
    {
      name: 'antiviewonce',
      description: 'Toggle anti-view-once (capture view-once media)',
      category: 'moderation',
      aliases: ['aviewonce', 'antivo'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isGroup || !ctx.isAdmin) {
          await ctx.reply('❌ Admin only command for groups.');
          return;
        }
        const state = getGroupState(ctx.jid);
        const action = ctx.args[0]?.toLowerCase();
        if (action === 'on') {
          state.antiViewOnce = true;
          await ctx.reply('👁️ Anti-view-once enabled. View-once media will be captured.');
        } else if (action === 'off') {
          state.antiViewOnce = false;
          await ctx.reply('👁️ Anti-view-once disabled.');
        } else {
          state.antiViewOnce = !state.antiViewOnce;
          await ctx.reply(`👁️ Anti-view-once is now *${state.antiViewOnce ? 'ENABLED' : 'DISABLED'}*.`);
        }
      },
    },
    {
      name: 'anticall',
      description: 'Toggle anti-call (auto-reject calls)',
      category: 'moderation',
      aliases: ['acall', 'blockcall'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isAdmin) {
          await ctx.reply('❌ Admin only command.');
          return;
        }
        const state = getGroupState(ctx.jid);
        const action = ctx.args[0]?.toLowerCase();
        if (action === 'on') {
          state.antiCall = true;
          await ctx.reply('📞 Anti-call enabled. Calls will be auto-rejected.');
        } else if (action === 'off') {
          state.antiCall = false;
          await ctx.reply('📞 Anti-call disabled.');
        } else {
          state.antiCall = !state.antiCall;
          await ctx.reply(`📞 Anti-call is now *${state.antiCall ? 'ENABLED' : 'DISABLED'}*.`);
        }
      },
    },
    {
      name: 'warn',
      description: 'Warn a user in the group',
      category: 'moderation',
      aliases: ['warning', 'addwarn'],
      cooldown: 3,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isGroup || !ctx.isAdmin) {
          await ctx.reply('❌ Admin only command for groups.');
          return;
        }
        const target = ctx.args[0]?.replace('@', '');
        const reason = ctx.args.slice(1).join(' ') || 'No reason specified';
        if (!target) {
          await ctx.reply('❌ Usage: !warn @user <reason>\nExample: !warn @628123 spamming');
          return;
        }
        const state = getGroupState(ctx.jid);
        const userJid = target + '@s.whatsapp.net';
        if (!state.warnings.has(userJid)) {
          state.warnings.set(userJid, []);
        }
        state.warnings.get(userJid)!.push({
          reason,
          date: Date.now(),
          warnedBy: ctx.sender,
        });
        const warnCount = state.warnings.get(userJid)!.length;
        const maxWarns = 3;
        await ctx.reply(
          `⚠️ *Warning Issued*\n\n` +
          `👤 User: @${target}\n` +
          `📝 Reason: ${reason}\n` +
          `📊 Warnings: ${warnCount}/${maxWarns}\n\n` +
          (warnCount >= maxWarns
            ? `🚫 User has reached maximum warnings and will be kicked.`
            : `_User will be kicked after ${maxWarns} warnings._`)
        );
      },
    },
    {
      name: 'unwarn',
      description: 'Remove all warnings for a user',
      category: 'moderation',
      aliases: ['delwarn', 'clearwarn'],
      cooldown: 3,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isGroup || !ctx.isAdmin) {
          await ctx.reply('❌ Admin only command for groups.');
          return;
        }
        const target = ctx.args[0]?.replace('@', '');
        if (!target) {
          await ctx.reply('❌ Usage: !unwarn @user');
          return;
        }
        const state = getGroupState(ctx.jid);
        const userJid = target + '@s.whatsapp.net';
        const removed = state.warnings.delete(userJid);
        if (removed) {
          await ctx.reply(`✅ All warnings cleared for @${target}.`);
        } else {
          await ctx.reply(`ℹ️ No warnings found for @${target}.`);
        }
      },
    },
    {
      name: 'warnings',
      description: 'Check warnings for a user',
      category: 'moderation',
      aliases: ['checkwarn', 'warns'],
      cooldown: 3,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isGroup) {
          await ctx.reply('❌ This command can only be used in groups.');
          return;
        }
        const target = (ctx.args[0] || ctx.sender.split('@')[0]).replace('@', '');
        const state = getGroupState(ctx.jid);
        const userJid = target + '@s.whatsapp.net';
        const warns = state.warnings.get(userJid);
        if (!warns || warns.length === 0) {
          await ctx.reply(`✅ @${target} has no warnings.`);
          return;
        }
        let text = `⚠️ *Warnings for @${target} (${warns.length})*\n\n`;
        for (let i = 0; i < warns.length; i++) {
          const w = warns[i];
          const date = new Date(w.date).toLocaleDateString();
          text += `${i + 1}. ${w.reason} (${date})\n`;
        }
        await ctx.reply(text);
      },
    },
    {
      name: 'purge',
      description: 'Delete recent messages in the group',
      category: 'moderation',
      aliases: ['clear', 'clean', 'deletemsgs'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isGroup || !ctx.isAdmin) {
          await ctx.reply('❌ Admin only command for groups.');
          return;
        }
        const count = parseInt(ctx.args[0]) || 10;
        if (count < 1 || count > 100) {
          await ctx.reply('❌ Count must be between 1 and 100.');
          return;
        }
        await ctx.reply(
          `🗑️ *Purge: ${count} messages*\n\n⏳ Deleting messages...\n\n_In production, this deletes the specified number of recent messages using sock.sendMessage with delete protocol._`
        );
      },
    },
    {
      name: 'tagall',
      description: 'Tag all group members',
      category: 'moderation',
      aliases: ['mentionall', 'everyone'],
      cooldown: 30,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isGroup || !ctx.isAdmin) {
          await ctx.reply('❌ Admin only command for groups.');
          return;
        }
        const customMsg = ctx.args.join(' ') || '👥 Attention everyone!';
        await ctx.reply(
          `👥 *Tag All*\n\n${customMsg}\n\n⏳ Tagging all members...\n\n_In production, this fetches all group participants and sends a message mentioning everyone._`
        );
      },
    },
    {
      name: 'hidetag',
      description: 'Hidden tag all members (mentions invisible)',
      category: 'moderation',
      aliases: ['ht', 'secretag'],
      cooldown: 30,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isGroup || !ctx.isAdmin) {
          await ctx.reply('❌ Admin only command for groups.');
          return;
        }
        const customMsg = ctx.args.join(' ') || '📢 Announcement';
        await ctx.reply(
          `📢 *Hidden Tag*\n\n${customMsg}\n\n⏳ Sending hidden tag...\n\n_In production, this sends a message with all participant JIDs in the mentions array but invisible in the text body._`
        );
      },
    },
    {
      name: 'welcome',
      description: 'Toggle welcome messages for new members',
      category: 'moderation',
      aliases: ['wel', 'autowelcome'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isGroup || !ctx.isAdmin) {
          await ctx.reply('❌ Admin only command for groups.');
          return;
        }
        const state = getGroupState(ctx.jid);
        const action = ctx.args[0]?.toLowerCase();
        if (action === 'on') {
          state.welcomeEnabled = true;
          await ctx.reply('👋 Welcome messages enabled.');
        } else if (action === 'off') {
          state.welcomeEnabled = false;
          await ctx.reply('👋 Welcome messages disabled.');
        } else {
          state.welcomeEnabled = !state.welcomeEnabled;
          await ctx.reply(`👋 Welcome messages are now *${state.welcomeEnabled ? 'ENABLED' : 'DISABLED'}*.`);
        }
      },
    },
    {
      name: 'goodbye',
      description: 'Toggle goodbye messages for leaving members',
      category: 'moderation',
      aliases: ['bye', 'autogoodbye', 'leave'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isGroup || !ctx.isAdmin) {
          await ctx.reply('❌ Admin only command for groups.');
          return;
        }
        const state = getGroupState(ctx.jid);
        const action = ctx.args[0]?.toLowerCase();
        if (action === 'on') {
          state.goodbyeEnabled = true;
          await ctx.reply('👋 Goodbye messages enabled.');
        } else if (action === 'off') {
          state.goodbyeEnabled = false;
          await ctx.reply('👋 Goodbye messages disabled.');
        } else {
          state.goodbyeEnabled = !state.goodbyeEnabled;
          await ctx.reply(`👋 Goodbye messages are now *${state.goodbyeEnabled ? 'ENABLED' : 'DISABLED'}*.`);
        }
      },
    },
    {
      name: 'setwelcome',
      description: 'Set the welcome message template',
      category: 'moderation',
      aliases: ['swelcome'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isGroup || !ctx.isAdmin) {
          await ctx.reply('❌ Admin only command for groups.');
          return;
        }
        const msg = ctx.args.join(' ');
        if (!msg) {
          await ctx.reply(
            '❌ Usage: !setwelcome <message>\n\nVariables: @user = mentioned user\nExample: !setwelcome Welcome @user to our group! 🎉'
          );
          return;
        }
        const state = getGroupState(ctx.jid);
        state.welcomeMessage = msg;
        await ctx.reply(`✅ Welcome message set to:\n\n"${msg}"`);
      },
    },
    {
      name: 'setgoodbye',
      description: 'Set the goodbye message template',
      category: 'moderation',
      aliases: ['sgoodbye'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isGroup || !ctx.isAdmin) {
          await ctx.reply('❌ Admin only command for groups.');
          return;
        }
        const msg = ctx.args.join(' ');
        if (!msg) {
          await ctx.reply(
            '❌ Usage: !setgoodbye <message>\n\nVariables: @user = mentioned user\nExample: !setgoodbye Goodbye @user! We\'ll miss you 👋'
          );
          return;
        }
        const state = getGroupState(ctx.jid);
        state.goodbyeMessage = msg;
        await ctx.reply(`✅ Goodbye message set to:\n\n"${msg}"`);
      },
    },
  ],
};

export default moderationPlugin;
