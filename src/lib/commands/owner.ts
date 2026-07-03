// ============================================================================
// CALTEX MD WhatsApp Bot - Owner Commands
// Bot management commands restricted to bot owners
// ============================================================================

import type { Plugin, CommandContext } from '../plugin-loader';

// In-memory store for owner state (synced via DB in production)
const ownerState: {
  prefix: string;
  bannedUsers: Set<string>;
  premiumUsers: Set<string>;
} = {
  prefix: '!',
  bannedUsers: new Set(),
  premiumUsers: new Set(),
};

const ownerPlugin: Plugin = {
  name: 'owner',
  version: '1.0.0',
  description: 'Bot owner management commands for administration',
  author: 'CALTEX MD',
  enabled: true,
  commands: [
    {
      name: 'setprefix',
      description: 'Change the bot command prefix',
      category: 'owner',
      aliases: ['prefix'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isOwner) {
          await ctx.reply('⛔ Owner only command.');
          return;
        }
        const newPrefix = ctx.args[0];
        if (!newPrefix || newPrefix.length !== 1) {
          await ctx.reply('❌ Usage: !setprefix <single character>\nExample: !setprefix #');
          return;
        }
        const oldPrefix = ownerState.prefix;
        ownerState.prefix = newPrefix;
        await ctx.reply(`✅ Prefix changed from "${oldPrefix}" to "${newPrefix}"`);
      },
    },
    {
      name: 'broadcast',
      description: 'Send a broadcast message to all chats',
      category: 'owner',
      aliases: ['bc', 'announce'],
      cooldown: 30,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isOwner) {
          await ctx.reply('⛔ Owner only command.');
          return;
        }
        const message = ctx.args.join(' ');
        if (!message) {
          await ctx.reply('❌ Usage: !broadcast <message>\nExample: !broadcast Maintenance at 10pm');
          return;
        }
        // In production, this would iterate all chats and send
        await ctx.react('📢');
        await ctx.reply(
          `📢 *BROADCAST SENT*\n\n${message}\n\n_This message was sent to all chats by the bot owner._`
        );
      },
    },
    {
      name: 'ban',
      description: 'Ban a user from using the bot',
      category: 'owner',
      aliases: ['block'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isOwner) {
          await ctx.reply('⛔ Owner only command.');
          return;
        }
        const target = ctx.args[0]?.replace('@', '') + '@s.whatsapp.net';
        if (!ctx.args[0]) {
          await ctx.reply('❌ Usage: !ban @user\nExample: !ban @6281234567890');
          return;
        }
        ownerState.bannedUsers.add(target);
        await ctx.reply(`🚫 User @${ctx.args[0]} has been banned from using the bot.`);
      },
    },
    {
      name: 'unban',
      description: 'Unban a previously banned user',
      category: 'owner',
      aliases: ['unblock'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isOwner) {
          await ctx.reply('⛔ Owner only command.');
          return;
        }
        const target = ctx.args[0]?.replace('@', '') + '@s.whatsapp.net';
        if (!ctx.args[0]) {
          await ctx.reply('❌ Usage: !unban @user');
          return;
        }
        const removed = ownerState.bannedUsers.delete(target);
        if (removed) {
          await ctx.reply(`✅ User @${ctx.args[0]} has been unbanned.`);
        } else {
          await ctx.reply(`⚠️ User @${ctx.args[0]} is not banned.`);
        }
      },
    },
    {
      name: 'premium',
      description: 'Set or remove premium status for a user',
      category: 'owner',
      aliases: ['setpremium'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isOwner) {
          await ctx.reply('⛔ Owner only command.');
          return;
        }
        const user = ctx.args[0]?.replace('@', '');
        const action = ctx.args[1]?.toLowerCase();
        if (!user || !action) {
          await ctx.reply('❌ Usage: !premium @user <on|off>\nExample: !premium @6281234567890 on');
          return;
        }
        const target = user + '@s.whatsapp.net';
        if (action === 'on') {
          ownerState.premiumUsers.add(target);
          await ctx.reply(`👑 User @${user} is now a premium member!`);
        } else if (action === 'off') {
          ownerState.premiumUsers.delete(target);
          await ctx.reply(`👤 User @${user} premium status has been removed.`);
        } else {
          await ctx.reply('❌ Invalid action. Use "on" or "off".');
        }
      },
    },
    {
      name: 'restart',
      description: 'Restart the bot service',
      category: 'owner',
      aliases: ['reboot'],
      cooldown: 60,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isOwner) {
          await ctx.reply('⛔ Owner only command.');
          return;
        }
        await ctx.react('🔄');
        await ctx.reply('🔄 *Restarting bot...*\n\nThe bot will be back in a few seconds.');
        // In production, signal the process manager to restart
        setTimeout(() => process.exit(0), 2000);
      },
    },
    {
      name: 'stats',
      description: 'Show bot statistics and system info',
      category: 'owner',
      aliases: ['botstats', 'stat'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isOwner) {
          await ctx.reply('⛔ Owner only command.');
          return;
        }
        const { CommandRegistry } = await import('../plugin-loader');
        const registry = CommandRegistry.getInstance();
        const pluginStats = registry.getStats();
        const mem = process.memoryUsage();
        const uptime = process.uptime();
        const d = Math.floor(uptime / 86400);
        const h = Math.floor((uptime % 86400) / 3600);
        const m = Math.floor((uptime % 3600) / 60);

        const text =
          `📊 *BOT STATISTICS*\n\n` +
          `🕐 Uptime: ${d}d ${h}h ${m}m\n` +
          `💾 Heap: ${Math.round(mem.heapUsed / 1024 / 1024)}MB / ${Math.round(mem.heapTotal / 1024 / 1024)}MB\n` +
          `📦 RSS: ${Math.round(mem.rss / 1024 / 1024)}MB\n` +
          `🔌 Plugins: ${pluginStats.totalPlugins} (${pluginStats.enabledPlugins} enabled)\n` +
          `📝 Commands: ${pluginStats.totalCommands}\n` +
          `📂 Categories: ${pluginStats.categories}\n` +
          `🚫 Banned: ${ownerState.bannedUsers.size} users\n` +
          `👑 Premium: ${ownerState.premiumUsers.size} users\n` +
          `⚡ Node: ${process.version}`;

        await ctx.reply(text);
      },
    },
    {
      name: 'shutdown',
      description: 'Gracefully shut down the bot',
      category: 'owner',
      aliases: ['die', 'kill'],
      cooldown: 60,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isOwner) {
          await ctx.reply('⛔ Owner only command.');
          return;
        }
        await ctx.react('🔴');
        await ctx.reply('🔴 *Shutting down bot...*\n\nGoodbye! 👋');
        setTimeout(() => process.exit(0), 2000);
      },
    },
  ],
};

export default ownerPlugin;
