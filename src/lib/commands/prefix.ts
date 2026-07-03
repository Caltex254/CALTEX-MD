// ============================================================================
// CALTEX MD WhatsApp Bot - Prefix Command
// Change and view the bot's command prefix
// ============================================================================

import type { Plugin, CommandContext } from '../plugin-loader';
import { db } from '@/lib/db';

const prefixPlugin: Plugin = {
  name: 'prefix',
  version: '1.0.0',
  description: 'Change and view the bot command prefix',
  author: 'CALTEX MD',
  enabled: true,
  commands: [
    {
      name: 'changeprefix',
      description: 'Change the bot\'s command prefix (owner only)',
      category: 'owner',
      aliases: ['setprefix', 'prefix'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isOwner) {
          await ctx.reply('⛔ Owner only command.');
          return;
        }

        const newPrefix = ctx.args[0];

        // No argument — show current prefix and usage
        if (!newPrefix) {
          let currentPrefix = '!';
          try {
            const setting = await db.setting.findUnique({ where: { key: 'bot_prefix' } });
            if (setting) currentPrefix = setting.value;
          } catch {
            // fallback to default
          }

          await ctx.reply(
            `⚙️ *PREFIX SETTINGS*\n\n` +
            `📌 Current prefix: *${currentPrefix}*\n\n` +
            `📝 *Usage:*\n` +
            `${currentPrefix}changeprefix <new_prefix>\n\n` +
            `📋 *Rules:*\n` +
            `• Prefix must be 1–3 characters\n` +
            `• Allowed symbols: ! . # $ / & ? ; , + - ~ @ % ^ =\n\n` +
            `💡 *Examples:*\n` +
            `${currentPrefix}changeprefix #\n` +
            `${currentPrefix}changeprefix ..\n` +
            `${currentPrefix}changeprefix /`
          );
          return;
        }

        // Validate prefix: 1–3 characters, symbols only
        if (newPrefix.length < 1 || newPrefix.length > 3) {
          await ctx.reply('❌ Prefix must be between 1 and 3 characters long.');
          return;
        }

        const allowedPattern = /^[!./#?$&;,+\-~@%^=]+$/;
        if (!allowedPattern.test(newPrefix)) {
          await ctx.reply(
            '❌ Invalid prefix. Only the following symbols are allowed:\n\n' +
            '! . # $ / & ? ; , + - ~ @ % ^ ='
          );
          return;
        }

        // Fetch the old prefix
        let oldPrefix = '!';
        try {
          const existing = await db.setting.findUnique({ where: { key: 'bot_prefix' } });
          if (existing) oldPrefix = existing.value;
        } catch {
          // fallback to default
        }

        // Persist the new prefix to the database
        try {
          await db.setting.upsert({
            where: { key: 'bot_prefix' },
            update: { value: newPrefix },
            create: {
              key: 'bot_prefix',
              value: newPrefix,
              category: 'bot',
              description: 'Bot command prefix',
            },
          });
        } catch (error) {
          await ctx.reply(
            `❌ Failed to update prefix in the database.\n\n` +
            `_Error: ${error instanceof Error ? error.message : String(error)}_`
          );
          return;
        }

        // Notify the bot service of the config change
        try {
          await fetch('http://localhost:3031/config', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prefix: newPrefix }),
          });
        } catch (error) {
          // Non-fatal — the DB is the source of truth
          console.warn('[prefix] Failed to notify bot service of prefix change:', error);
        }

        await ctx.react('✅');
        await ctx.reply(
          `✅ *PREFIX UPDATED*\n\n` +
          `📌 Old prefix: *${oldPrefix}*\n` +
          `📌 New prefix: *${newPrefix}*\n\n` +
          `_Use ${newPrefix} as the command prefix from now on._`
        );
      },
    },
    {
      name: 'getprefix',
      description: 'Show the current bot prefix',
      category: 'general',
      aliases: ['prefixinfo', 'currentprefix'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        let currentPrefix = '!';

        try {
          const setting = await db.setting.findUnique({ where: { key: 'bot_prefix' } });
          if (setting) currentPrefix = setting.value;
        } catch {
          // fallback to default
        }

        await ctx.reply(
          `📌 *CURRENT PREFIX*\n\n` +
          `The bot command prefix is: *${currentPrefix}*\n\n` +
          `💡 Type *${currentPrefix}help* to see available commands.`
        );
      },
    },
  ],
};

export default prefixPlugin;
