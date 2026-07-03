// ============================================================================
// CALTEX MD WhatsApp Bot - Scheduler Plugin
// Schedule messages for future delivery with management commands
// ============================================================================

import type { Plugin, CommandContext } from '../plugin-loader';
import { db } from '@/lib/db';

function parseScheduleTime(timeStr: string): Date | null {
  const now = new Date();
  const minuteMatch = timeStr.match(/^(\d+)m$/i);
  if (minuteMatch) return new Date(now.getTime() + parseInt(minuteMatch[1]) * 60000);
  const hourMatch = timeStr.match(/^(\d+)h$/i);
  if (hourMatch) return new Date(now.getTime() + parseInt(hourMatch[1]) * 3600000);
  const dayMatch = timeStr.match(/^(\d+)d$/i);
  if (dayMatch) return new Date(now.getTime() + parseInt(dayMatch[1]) * 86400000);
  const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (timeMatch) {
    const d = new Date(now);
    d.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2]), 0, 0);
    if (d <= now) d.setDate(d.getDate() + 1);
    return d;
  }
  return null;
}

const schedulerPlugin: Plugin = {
  name: 'scheduler',
  version: '1.0.0',
  description: 'Schedule messages for future delivery with flexible time formats',
  author: 'CALTEX MD',
  enabled: true,
  commands: [
    {
      name: 'schedule',
      description: 'Schedule a message (e.g., .schedule 30m target Hello!)',
      category: 'owner',
      aliases: ['sched', 'schedulemsg'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isOwner) {
          await ctx.reply('⛔ Owner only command.');
          return;
        }
        if (ctx.args.length < 3) {
          await ctx.reply(
            '❌ Usage: .schedule <time> <target> <message>\n\n' +
            '⏱️ *Time Formats:* Xm, Xh, Xd, HH:MM\n\n' +
            '📝 *Examples:*\n' +
            '.schedule 30m 123@g.us Meeting in 30 min!\n' +
            '.schedule 2h 123@s.whatsapp.net Don\'t forget!\n' +
            '.schedule 14:00 123@g.us Afternoon update'
          );
          return;
        }
        const timeStr = ctx.args[0];
        const target = ctx.args[1];
        const message = ctx.args.slice(2).join(' ');
        const scheduledAt = parseScheduleTime(timeStr);
        if (!scheduledAt) {
          await ctx.reply('❌ Invalid time format. Use: Xm, Xh, Xd, or HH:MM');
          return;
        }
        try {
          const scheduled = await db.scheduledMessage.create({
            data: { targetJid: target, message, scheduledAt },
          });
          const timeFormatted = scheduledAt.toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
          });
          await ctx.reply(
            `⏰ *Message Scheduled!*\n\n` +
            `💬 ${message.substring(0, 50)}\n` +
            `🎯 Target: ${target}\n` +
            `🕐 Send at: *${timeFormatted}*\n` +
            `🆔 ID: ${scheduled.id}`
          );
        } catch (error) {
          console.error('[Schedule] Error:', error);
          await ctx.reply('❌ Failed to schedule message.');
        }
      },
    },
    {
      name: 'listschedule',
      description: 'List all scheduled messages',
      category: 'owner',
      aliases: ['scheduled', 'schedlist'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isOwner) {
          await ctx.reply('⛔ Owner only command.');
          return;
        }
        try {
          const messages = await db.scheduledMessage.findMany({
            where: { isSent: false },
            orderBy: { scheduledAt: 'asc' },
            take: 15,
          });
          if (messages.length === 0) {
            await ctx.reply('📋 No scheduled messages.');
            return;
          }
          let text = `⏰ *Scheduled Messages (${messages.length})*\n` + '━'.repeat(24) + '\n\n';
          for (const m of messages) {
            const timeFormatted = m.scheduledAt.toLocaleString('en-US', {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            });
            text += `🆔 ${m.id}\n`;
            text += `   💬 ${m.message.substring(0, 30)}\n`;
            text += `   🎯 ${m.targetJid.substring(0, 20)}\n`;
            text += `   🕐 ${timeFormatted}\n\n`;
          }
          text += '💡 .delschedule <id> to cancel';
          await ctx.reply(text);
        } catch (error) {
          console.error('[ListSchedule] Error:', error);
          await ctx.reply('❌ Failed to list scheduled messages.');
        }
      },
    },
    {
      name: 'delschedule',
      description: 'Delete a scheduled message by ID',
      category: 'owner',
      aliases: ['cancelschedule', 'removeschedule'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isOwner) {
          await ctx.reply('⛔ Owner only command.');
          return;
        }
        const id = ctx.args[0];
        if (!id) {
          await ctx.reply('❌ Usage: .delschedule <id>\nUse .listschedule to see IDs.');
          return;
        }
        try {
          const msg = await db.scheduledMessage.findUnique({ where: { id } });
          if (!msg) {
            await ctx.reply('❌ Scheduled message not found.');
            return;
          }
          if (msg.isSent) {
            await ctx.reply('⚠️ This message has already been sent.');
            return;
          }
          await db.scheduledMessage.delete({ where: { id } });
          await ctx.reply(`🗑️ Scheduled message *${id}* cancelled!`);
        } catch (error) {
          console.error('[DelSchedule] Error:', error);
          await ctx.reply('❌ Failed to delete scheduled message.');
        }
      },
    },
  ],
};

export default schedulerPlugin;
