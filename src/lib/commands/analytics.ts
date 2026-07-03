// ============================================================================
// CALTEX MD WhatsApp Bot - Analytics Plugin
// Bot statistics, performance metrics, and group/user analytics
// ============================================================================

import type { Plugin, CommandContext } from '../plugin-loader';
import { db } from '@/lib/db';
import os from 'os';

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

const analyticsPlugin: Plugin = {
  name: 'analytics',
  version: '1.0.0',
  description: 'Bot analytics, performance stats, and group/user metrics',
  author: 'CALTEX MD',
  enabled: true,
  commands: [
    {
      name: 'stats',
      description: 'General bot statistics overview',
      category: 'general',
      aliases: ['botinfo', 'infobot'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        await ctx.react('📊');
        try {
          const totalUsers = await db.user.count();
          const totalGroups = await db.group.count();
          const premiumUsers = await db.premiumUser.count({ where: { isActive: true } });
          const bannedUsers = await db.user.count({ where: { isBanned: true } });
          const totalCommands = await db.command.count();
          const totalPlugins = await db.plugin.count();
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const todayStats = await db.stat.findUnique({ where: { date: today } });
          const { CommandRegistry } = await import('../plugin-loader');
          const registry = CommandRegistry.getInstance();
          const regStats = registry.getStats();

          const text =
            `📊 *CALTEX MD Statistics*\n` + '━'.repeat(24) + '\n\n' +
            `👥 Users: *${totalUsers}*\n` +
            `🏠 Groups: *${totalGroups}*\n` +
            `👑 Premium: *${premiumUsers}*\n` +
            `🚫 Banned: *${bannedUsers}*\n` +
            `📝 Commands: *${regStats.totalCommands}* (${totalCommands} DB)\n` +
            `🔌 Plugins: *${regStats.totalPlugins}* (${regStats.enabledPlugins} active)\n\n` +
            `📅 *Today's Activity*\n` +
            `📨 Messages: *${todayStats?.messagesReceived ?? 0}*\n` +
            `⚡ Commands Run: *${todayStats?.commandsExecuted ?? 0}*\n` +
            `🔗 API Calls: *${todayStats?.apiCalls ?? 0}*\n` +
            `❌ Errors: *${todayStats?.errors ?? 0}*`;
          await ctx.reply(text);
        } catch (error) {
          console.error('[Stats] Error:', error);
          await ctx.reply('❌ Failed to load statistics.');
        }
      },
    },
    {
      name: 'botstats',
      description: 'Detailed bot performance stats (uptime, memory, CPU)',
      category: 'owner',
      aliases: ['performance', 'perf'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isOwner) {
          await ctx.reply('⛔ Owner only command.');
          return;
        }
        await ctx.react('📈');
        try {
          const mem = process.memoryUsage();
          const totalMem = os.totalmem();
          const freeMem = os.freemem();
          const usedMem = totalMem - freeMem;
          const cpus = os.cpus();
          const cpuModel = cpus[0]?.model ?? 'Unknown';
          const cpuCores = cpus.length;
          const loadAvg = os.loadavg();
          const sessions = await db.botSession.count();
          const apiKeys = await db.aPIKey.count({ where: { isEnabled: true } });

          const text =
            `📈 *Bot Performance Stats*\n` + '━'.repeat(24) + '\n\n' +
            `🕐 *Uptime:* ${formatUptime(process.uptime())}\n` +
            `💾 *Heap:* ${Math.round(mem.heapUsed / 1024 / 1024)}MB / ${Math.round(mem.heapTotal / 1024 / 1024)}MB\n` +
            `📦 *RSS:* ${Math.round(mem.rss / 1024 / 1024)}MB\n\n` +
            `🖥️ *System Memory:* ${Math.round(usedMem / 1024 / 1024 / 1024)}GB / ${Math.round(totalMem / 1024 / 1024 / 1024)}GB\n` +
            `🧠 *CPU:* ${cpuModel.substring(0, 30)} (${cpuCores} cores)\n` +
            `📊 *Load:* ${loadAvg.map(l => l.toFixed(2)).join(', ')}\n\n` +
            `🔌 *Sessions:* ${sessions}\n` +
            `🔑 *API Keys:* ${apiKeys}\n` +
            `⚡ *Node:* ${process.version}\n` +
            `🐧 *OS:* ${os.platform()} ${os.release()}`;
          await ctx.reply(text);
        } catch (error) {
          console.error('[BotStats] Error:', error);
          await ctx.reply('❌ Failed to load performance stats.');
        }
      },
    },
    {
      name: 'groupstats',
      description: 'Current group analytics (if in a group)',
      category: 'group',
      aliases: ['gstats', 'groupinfo'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isGroup) {
          await ctx.reply('⚠️ This command only works in groups.');
          return;
        }
        await ctx.react('📊');
        try {
          const group = await db.group.findUnique({ where: { jid: ctx.jid } });
          const members = await db.groupMember.findMany({ where: { groupJid: ctx.jid } });
          const adminCount = members.filter(m => m.role === 'admin' || m.role === 'owner').length;
          const analytics = await db.groupAnalytics.findMany({
            where: { groupJid: ctx.jid },
            orderBy: { date: 'desc' },
            take: 7,
          });
          const totalMessages = analytics.reduce((sum, a) => sum + a.messagesCount, 0);
          const totalCommands = analytics.reduce((sum, a) => sum + a.commandsCount, 0);
          const topContrib = analytics[0]?.topContributor ?? 'N/A';

          const text =
            `📊 *Group Analytics*\n` + '━'.repeat(22) + '\n\n' +
            `🏠 Group: *${group?.name || 'Unknown'}*\n` +
            `👥 Members: *${members.length}*\n` +
            `🛡️ Admins: *${adminCount}*\n\n` +
            `📅 *Last 7 Days*\n` +
            `📨 Messages: *${totalMessages}*\n` +
            `⚡ Commands: *${totalCommands}*\n` +
            `🌟 Top Contributor: *@${topContrib.split('@')[0]}*\n\n` +
            `🛡️ Anti-Link: ${group?.antiLink ? '✅' : '❌'} | Anti-Spam: ${group?.antiSpam ? '✅' : '❌'}`;
          await ctx.reply(text);
        } catch (error) {
          console.error('[GroupStats] Error:', error);
          await ctx.reply('❌ Failed to load group analytics.');
        }
      },
    },
    {
      name: 'userstats',
      description: 'User statistics for a specific user',
      category: 'general',
      aliases: ['ustats', 'userinfo'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        await ctx.react('👤');
        try {
          const targetArg = ctx.args[0]?.replace('@', '');
          const targetJid = targetArg ? targetArg + '@s.whatsapp.net' : ctx.sender;
          const user = await db.user.findUnique({ where: { jid: targetJid } });
          if (!user) {
            await ctx.reply('❌ User not found in database.');
            return;
          }
          const groupMemberships = await db.groupMember.count({ where: { userJid: targetJid } });
          const warnings = await db.warning.count({ where: { userJid: targetJid } });
          const reminders = await db.reminder.count({ where: { userJid: targetJid, isSent: false } });
          const notes = await db.note.count({ where: { userJid: targetJid } });
          const premium = await db.premiumUser.findUnique({ where: { userJid: targetJid } });

          const text =
            `👤 *User Statistics*\n` + '━'.repeat(22) + '\n\n' +
            `📱 JID: ${targetJid.split('@')[0]}\n` +
            `📛 Name: ${user.pushName || 'Unknown'}\n` +
            `👑 Premium: ${premium?.isActive ? `✅ (${premium.plan})` : '❌'}\n` +
            `🚫 Banned: ${user.isBanned ? '🔴 Yes' : '🟢 No'}\n` +
            `⚠️ Warnings: *${warnings}*\n` +
            `🏠 Groups: *${groupMemberships}*\n` +
            `⏰ Reminders: *${reminders}*\n` +
            `📝 Notes: *${notes}*\n` +
            `📅 Joined: ${user.createdAt.toLocaleDateString()}`;
          await ctx.reply(text);
        } catch (error) {
          console.error('[UserStats] Error:', error);
          await ctx.reply('❌ Failed to load user statistics.');
        }
      },
    },
  ],
};

export default analyticsPlugin;
