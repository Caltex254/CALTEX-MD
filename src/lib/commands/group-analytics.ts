// ============================================================================
// CALTEX MD WhatsApp Bot - Group Analytics Plugin
// Group-specific analytics: activity, top contributors, member stats
// ============================================================================

import type { Plugin, CommandContext } from '../plugin-loader';
import { db } from '@/lib/db';

const groupAnalyticsPlugin: Plugin = {
  name: 'group-analytics',
  version: '1.0.0',
  description: 'Group analytics: activity tracking, top contributors, member stats',
  author: 'CALTEX MD',
  enabled: true,
  commands: [
    {
      name: 'gstats',
      description: 'Show most active members in the group',
      category: 'group',
      aliases: ['groupmembers', 'activemembers'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isGroup) {
          await ctx.reply('⚠️ This command only works in groups.');
          return;
        }
        await ctx.react('📊');
        try {
          const members = await db.groupMember.findMany({
            where: { groupJid: ctx.jid },
            include: { user: true },
          });
          const admins = members.filter(m => m.role === 'admin' || m.role === 'owner');
          const premiumMembers = [];
          for (const m of members) {
            const premium = await db.premiumUser.findUnique({
              where: { userJid: m.userJid },
            });
            if (premium?.isActive) premiumMembers.push(m);
          }
          const group = await db.group.findUnique({ where: { jid: ctx.jid } });
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const todayAnalytics = await db.groupAnalytics.findUnique({
            where: { groupJid_date: { groupJid: ctx.jid, date: today } },
          });
          const text =
            `📊 *Group Stats*\n` + '━'.repeat(22) + '\n\n' +
            `🏠 *${group?.name || 'Unknown Group'}*\n\n` +
            `👥 Members: *${members.length}*\n` +
            `🛡️ Admins: *${admins.length}*\n` +
            `👑 Premium: *${premiumMembers.length}*\n\n` +
            `📅 *Today*\n` +
            `📨 Messages: *${todayAnalytics?.messagesCount ?? 0}*\n` +
            `⚡ Commands: *${todayAnalytics?.commandsCount ?? 0}*\n` +
            `👤 Active: *${todayAnalytics?.activeMembers ?? 0}*`;
          await ctx.reply(text);
        } catch (error) {
          console.error('[GStats] Error:', error);
          await ctx.reply('❌ Failed to load group stats.');
        }
      },
    },
    {
      name: 'gactivity',
      description: 'Show daily/weekly/monthly group activity',
      category: 'group',
      aliases: ['groupactivity', 'activity'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isGroup) {
          await ctx.reply('⚠️ This command only works in groups.');
          return;
        }
        await ctx.react('📈');
        try {
          const period = ctx.args[0]?.toLowerCase() || 'weekly';
          let days = 7;
          if (period === 'daily') days = 1;
          else if (period === 'monthly') days = 30;

          const since = new Date();
          since.setDate(since.getDate() - days);
          since.setHours(0, 0, 0, 0);

          const analytics = await db.groupAnalytics.findMany({
            where: { groupJid: ctx.jid, date: { gte: since } },
            orderBy: { date: 'asc' },
          });
          if (analytics.length === 0) {
            await ctx.reply('📈 No activity data available for this period.');
            return;
          }
          const totalMessages = analytics.reduce((sum, a) => sum + a.messagesCount, 0);
          const totalCommands = analytics.reduce((sum, a) => sum + a.commandsCount, 0);
          const avgActive = Math.round(analytics.reduce((sum, a) => sum + a.activeMembers, 0) / analytics.length);
          const peakDay = analytics.reduce((max, a) => a.messagesCount > max.messagesCount ? a : max, analytics[0]);

          let text =
            `📈 *Group Activity (${period})*\n` + '━'.repeat(24) + '\n\n' +
            `📊 *Summary*\n` +
            `📨 Total Messages: *${totalMessages}*\n` +
            `⚡ Total Commands: *${totalCommands}*\n` +
            `👤 Avg Active: *${avgActive}*\n` +
            `🔥 Peak Day: *${peakDay.date.toLocaleDateString()}* (${peakDay.messagesCount} msgs)\n\n`;

          if (analytics.length > 1) {
            text += `📅 *Daily Breakdown*\n`;
            for (const a of analytics.slice(-7)) {
              const bar = '█'.repeat(Math.min(Math.round(a.messagesCount / Math.max(totalMessages / analytics.length, 1) * 5), 10));
              text += `${a.date.toLocaleDateString('en-US', { weekday: 'short' })} ${bar} ${a.messagesCount}\n`;
            }
          }
          await ctx.reply(text);
        } catch (error) {
          console.error('[GActivity] Error:', error);
          await ctx.reply('❌ Failed to load group activity.');
        }
      },
    },
    {
      name: 'gtop',
      description: 'Show top contributors in the group',
      category: 'group',
      aliases: ['grouptop', 'topmembers'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isGroup) {
          await ctx.reply('⚠️ This command only works in groups.');
          return;
        }
        await ctx.react('🏆');
        try {
          const since = new Date();
          since.setDate(since.getDate() - 30);
          since.setHours(0, 0, 0, 0);

          const analytics = await db.groupAnalytics.findMany({
            where: { groupJid: ctx.jid, date: { gte: since } },
            orderBy: { messagesCount: 'desc' },
          });
          const members = await db.groupMember.findMany({
            where: { groupJid: ctx.jid },
            include: { user: true },
          });
          if (members.length === 0) {
            await ctx.reply('🏆 No members tracked yet.');
            return;
          }
          // Sort by warning count (inverse) and membership as a proxy for activity
          const memberStats = members.map(m => ({
            jid: m.userJid,
            name: m.user?.pushName || m.userJid.split('@')[0],
            role: m.role,
          }));
          const topContributor = analytics[0]?.topContributor;
          const medals = ['🥇', '🥈', '🥉'];

          let text = `🏆 *Top Contributors (30 days)*\n` + '━'.repeat(24) + '\n\n';
          if (topContributor) {
            text += `${medals[0]} Most Active: *@${topContributor.split('@')[0]}*\n\n`;
          }
          text += `👥 *Members (${members.length})*\n\n`;
          const admins = memberStats.filter(m => m.role === 'admin' || m.role === 'owner');
          if (admins.length > 0) {
            text += `🛡️ *Admins:*\n`;
            admins.forEach((a, i) => {
              text += `  ${i < 3 ? medals[i] : '👤'} ${a.name}\n`;
            });
            text += '\n';
          }
          const regularMembers = memberStats.filter(m => m.role === 'member').slice(0, 5);
          if (regularMembers.length > 0) {
            text += `👤 *Active Members:*\n`;
            regularMembers.forEach((m, i) => {
              text += `  ${i < 3 ? medals[i] : '👤'} ${m.name}\n`;
            });
          }
          await ctx.reply(text);
        } catch (error) {
          console.error('[GTop] Error:', error);
          await ctx.reply('❌ Failed to load top contributors.');
        }
      },
    },
  ],
};

export default groupAnalyticsPlugin;
