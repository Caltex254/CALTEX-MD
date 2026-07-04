// ============================================================================
// CALTEX MD WhatsApp Bot - Reminder System Plugin
// Set, list, and manage timed reminders with recurring support
// ============================================================================

import type { Plugin, CommandContext } from '../plugin-loader';
import { db } from '@/lib/db';

function parseReminderTime(timeStr: string): { date: Date; recurring: string | null } | null {
  const now = new Date();
  // Xm - minutes
  const minuteMatch = timeStr.match(/^(\d+)m$/i);
  if (minuteMatch) {
    const d = new Date(now.getTime() + parseInt(minuteMatch[1]) * 60000);
    return { date: d, recurring: null };
  }
  // Xh - hours
  const hourMatch = timeStr.match(/^(\d+)h$/i);
  if (hourMatch) {
    const d = new Date(now.getTime() + parseInt(hourMatch[1]) * 3600000);
    return { date: d, recurring: null };
  }
  // Xd - days
  const dayMatch = timeStr.match(/^(\d+)d$/i);
  if (dayMatch) {
    const d = new Date(now.getTime() + parseInt(dayMatch[1]) * 86400000);
    return { date: d, recurring: null };
  }
  // daily
  if (timeStr.toLowerCase() === 'daily') {
    const d = new Date(now.getTime() + 86400000);
    return { date: d, recurring: 'daily' };
  }
  // weekly
  if (timeStr.toLowerCase() === 'weekly') {
    const d = new Date(now.getTime() + 7 * 86400000);
    return { date: d, recurring: 'weekly' };
  }
  // X:XX or Xpm/am format
  const timeMatch = timeStr.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2] || '0');
    const ampm = timeMatch[3]?.toLowerCase();
    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
    const d = new Date(now);
    d.setHours(hours, minutes, 0, 0);
    if (d <= now) d.setDate(d.getDate() + 1);
    return { date: d, recurring: null };
  }
  return null;
}

const reminderPlugin: Plugin = {
  name: 'reminder',
  version: '1.0.0',
  description: 'Set and manage timed reminders with recurring support',
  author: 'CALTEX MD',
  enabled: true,
  commands: [
    {
      name: 'remind',
      description: 'Set a reminder (e.g., "30m Check server", "2h Meeting")',
      category: 'tools',
      aliases: ['remindme', 'setreminder'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (ctx.args.length < 2) {
          await ctx.reply(
            '❌ Usage: .remind <time> <message>\n\n' +
            '⏱️ *Time Formats:*\n' +
            '• Xm - minutes (e.g., 30m)\n' +
            '• Xh - hours (e.g., 2h)\n' +
            '• Xd - days (e.g., 1d)\n' +
            '• daily / weekly\n' +
            '• 6pm, 14:30\n\n' +
            '📝 *Examples:*\n' +
            '.remind 30m Check server\n' +
            '.remind 2h Team meeting\n' +
            '.remind daily Standup update'
          );
          return;
        }
        const timeStr = ctx.args[0];
        const message = ctx.args.slice(1).join(' ');
        const parsed = parseReminderTime(timeStr);
        if (!parsed) {
          await ctx.reply('❌ Invalid time format. Use: Xm, Xh, Xd, daily, weekly, or time (6pm, 14:30)');
          return;
        }
        try {
          const reminder = await db.reminder.create({
            data: {
              userJid: ctx.sender,
              chatJid: ctx.jid,
              message,
              remindAt: parsed.date,
              isRecurring: !!parsed.recurring,
              recurrence: parsed.recurring,
            },
          });
          const timeFormatted = parsed.date.toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
          });
          await ctx.reply(
            `⏰ *Reminder Set!*\n\n` +
            `📝 ${message}\n` +
            `🕐 Remind at: *${timeFormatted}*\n` +
            `🔄 Recurring: ${parsed.recurring || 'No'}\n` +
            `🆔 ID: ${reminder.id}`
          );
        } catch (error) {
          console.error('[Remind] Error:', error);
          await ctx.reply('❌ Failed to set reminder.');
        }
      },
    },
    {
      name: 'reminders',
      description: 'List your active reminders',
      category: 'tools',
      aliases: ['myreminders', 'listreminders'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        try {
          const reminders = await db.reminder.findMany({
            where: { userJid: ctx.sender, isSent: false },
            orderBy: { remindAt: 'asc' },
          });
          if (reminders.length === 0) {
            await ctx.reply('📋 You have no active reminders.');
            return;
          }
          let text = `⏰ *Your Reminders (${reminders.length})*\n` + '━'.repeat(22) + '\n\n';
          for (const r of reminders) {
            const timeFormatted = r.remindAt.toLocaleString('en-US', {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            });
            const isPast = r.remindAt < new Date();
            text += `🆔 ${r.id}\n`;
            text += `   📝 ${r.message.substring(0, 40)}\n`;
            text += `   🕐 ${timeFormatted} ${isPast ? '⚠️ overdue' : ''}\n`;
            text += `   🔄 ${r.isRecurring ? r.recurrence : 'Once'}\n\n`;
          }
          await ctx.reply(text);
        } catch (error) {
          console.error('[Reminders] Error:', error);
          await ctx.reply('❌ Failed to list reminders.');
        }
      },
    },
  ],
};

export default reminderPlugin;
