// ============================================================================
// CALTEX MD WhatsApp Bot - Auto Reply System Plugin
// Create, manage, and delete auto-reply rules with regex support
// ============================================================================

import type { Plugin, CommandContext } from '../plugin-loader';
import { db } from '@/lib/db';

const autoreplyPlugin: Plugin = {
  name: 'autoreply',
  version: '1.0.0',
  description: 'Auto reply system with regex patterns and group-specific rules',
  author: 'CALTEX MD',
  enabled: true,
  commands: [
    {
      name: 'autoreply',
      description: 'List all auto-reply rules',
      category: 'admin',
      aliases: ['replies', 'listreply'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isAdmin && !ctx.isOwner) {
          await ctx.reply('⛔ Admin/Owner only command.');
          return;
        }
        try {
          const replies = await db.autoReply.findMany({
            where: { isEnabled: true },
            orderBy: { createdAt: 'desc' },
            take: 20,
          });
          if (replies.length === 0) {
            await ctx.reply(
              '📋 No auto-reply rules configured.\n\n' +
              '💡 Use !setreply <trigger>|<response> to create one.'
            );
            return;
          }
          let text = `💬 *Auto-Reply Rules (${replies.length})*\n` + '━'.repeat(22) + '\n\n';
          for (const r of replies) {
            const scope = r.isGlobal ? '🌍 Global' : `📍 Group`;
            const type = r.isRegex ? '🔍 Regex' : '📝 Text';
            text += `🔑 *${r.trigger.substring(0, 25)}*\n`;
            text += `   💬 ${r.response.substring(0, 40)}\n`;
            text += `   ${scope} | ${type} | Used: ${r.matchCount}x\n\n`;
          }
          text += '💡 !setreply to add | !delreply to remove';
          await ctx.reply(text);
        } catch (error) {
          console.error('[AutoReply] Error:', error);
          await ctx.reply('❌ Failed to list auto-reply rules.');
        }
      },
    },
    {
      name: 'setreply',
      description: 'Create an auto-reply rule (trigger|response [-regex] [-group])',
      category: 'admin',
      aliases: ['addreply', 'createreply'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isAdmin && !ctx.isOwner) {
          await ctx.reply('⛔ Admin/Owner only command.');
          return;
        }
        const fullInput = ctx.args.join(' ');
        const separatorIndex = fullInput.indexOf('|');
        if (separatorIndex === -1) {
          await ctx.reply(
            '❌ Usage: !setreply <trigger>|<response> [-regex] [-group <jid>]\n\n' +
            '📝 *Examples:*\n' +
            '!setreply hello|Hi there! 👋\n' +
            '!setreply price|Check our prices at example.com\n' +
            '!setreply ^hello$|Hi there! -regex\n' +
            '!setreply hi|Hello! -group 123@g.us'
          );
          return;
        }
        const trigger = fullInput.substring(0, separatorIndex).trim();
        const rest = fullInput.substring(separatorIndex + 1).trim();
        // Parse flags
        let isRegex = false;
        let groupJid: string | null = null;
        let response = rest;
        const regexFlag = rest.match(/\s-regex\b/i);
        if (regexFlag) {
          isRegex = true;
          response = response.replace(/\s-regex\b/i, '');
        }
        const groupFlag = rest.match(/\s-group\s+(\S+)/i);
        if (groupFlag) {
          groupJid = groupFlag[1];
          response = response.replace(/\s-group\s+\S+/i, '');
          if (!ctx.isGroup && !ctx.isOwner) {
            await ctx.reply('⚠️ Group-specific rules require owner permission or group context.');
            return;
          }
        }
        response = response.trim();
        if (!trigger || !response) {
          await ctx.reply('❌ Both trigger and response are required.');
          return;
        }
        if (isRegex) {
          try { new RegExp(trigger); } catch {
            await ctx.reply('❌ Invalid regex pattern.');
            return;
          }
        }
        try {
          const isGlobal = !groupJid;
          await db.autoReply.create({
            data: {
              trigger,
              response,
              isRegex,
              isGlobal,
              groupJid,
              createdBy: ctx.sender,
            },
          });
          await ctx.reply(
            `✅ *Auto-Reply Created!*\n\n` +
            `🔑 Trigger: ${isRegex ? '🔍 ' : '📝 '}${trigger}\n` +
            `💬 Response: ${response}\n` +
            `📍 Scope: ${isGlobal ? 'Global' : 'Group-specific'}\n` +
            `🏷️ Type: ${isRegex ? 'Regex' : 'Text match'}`
          );
        } catch (error) {
          console.error('[SetReply] Error:', error);
          await ctx.reply('❌ Failed to create auto-reply rule.');
        }
      },
    },
    {
      name: 'delreply',
      description: 'Delete an auto-reply rule by trigger',
      category: 'admin',
      aliases: ['deletereply', 'removereplay'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isAdmin && !ctx.isOwner) {
          await ctx.reply('⛔ Admin/Owner only command.');
          return;
        }
        const trigger = ctx.args.join(' ').trim();
        if (!trigger) {
          await ctx.reply('❌ Usage: !delreply <trigger>\nExample: !delreply hello');
          return;
        }
        try {
          const rule = await db.autoReply.findFirst({ where: { trigger } });
          if (!rule) {
            await ctx.reply(`❌ No auto-reply rule found for "${trigger}".`);
            return;
          }
          await db.autoReply.delete({ where: { id: rule.id } });
          await ctx.reply(`🗑️ Auto-reply rule for *"${trigger}"* deleted!`);
        } catch (error) {
          console.error('[DelReply] Error:', error);
          await ctx.reply('❌ Failed to delete auto-reply rule.');
        }
      },
    },
  ],
};

export default autoreplyPlugin;
