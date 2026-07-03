// ============================================================================
// CALTEX MD WhatsApp Bot - Utility Commands Plugin
// Ping, runtime, system info, health check, menu, help, about, and more
// ============================================================================

import type { Plugin, CommandContext } from '../plugin-loader';
import { db } from '@/lib/db';
import os from 'os';

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d}d ${h}h ${m}m ${s}s`;
}

const utilityPlugin: Plugin = {
  name: 'utility',
  version: '1.0.0',
  description: 'Essential utility commands: ping, runtime, system, health, menu, help, about',
  author: 'CALTEX MD',
  enabled: true,
  commands: [
    {
      name: 'runtime',
      description: 'Show bot uptime and runtime information',
      category: 'general',
      aliases: ['uptime', 'alive'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const uptime = process.uptime();
        await ctx.reply(
          `⏱️ *Bot Runtime*\n\n` +
          `🕐 Uptime: *${formatUptime(uptime)}*\n` +
          `💾 Memory: *${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB*\n` +
          `⚡ Node: *${process.version}*\n` +
          `🟢 Status: *Running*`
        );
      },
    },
    {
      name: 'system',
      description: 'System information (OS, Node, memory, CPU)',
      category: 'general',
      aliases: ['sysinfo', 'sys'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const cpus = os.cpus();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        await ctx.reply(
          `🖥️ *System Information*\n` + '━'.repeat(22) + '\n\n' +
          `🐧 OS: ${os.type()} ${os.release()}\n` +
          `🏗️ Arch: ${os.arch()}\n` +
          `🧠 CPU: ${cpus[0]?.model?.substring(0, 35) ?? 'Unknown'}\n` +
          `🔢 Cores: ${cpus.length}\n` +
          `💾 RAM: ${Math.round((totalMem - freeMem) / 1024 / 1024 / 1024)}GB / ${Math.round(totalMem / 1024 / 1024 / 1024)}GB\n` +
          `⚡ Node: ${process.version}\n` +
          `🕐 Uptime: ${formatUptime(os.uptime())}\n` +
          `📊 Load: ${os.loadavg().map(l => l.toFixed(2)).join(', ')}`
        );
      },
    },
    {
      name: 'health',
      description: 'Health check (database, API, services)',
      category: 'general',
      aliases: ['healthcheck', 'checkhealth'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        await ctx.react('🩺');
        try {
          const dbStart = Date.now();
          await db.user.count();
          const dbLatency = Date.now() - dbStart;
          const mem = process.memoryUsage();
          const heapPercent = Math.round((mem.heapUsed / mem.heapTotal) * 100);
          const dbStatus = dbLatency < 500 ? '✅' : dbLatency < 2000 ? '⚠️' : '🔴';
          const memStatus = heapPercent < 80 ? '✅' : heapPercent < 95 ? '⚠️' : '🔴';
          await ctx.reply(
            `🩺 *Health Check*\n` + '━'.repeat(22) + '\n\n' +
            `${dbStatus} Database: *${dbLatency}ms*\n` +
            `${memStatus} Memory: *${Math.round(mem.heapUsed / 1024 / 1024)}MB (${heapPercent}%)*\n` +
            `✅ Uptime: *${formatUptime(process.uptime())}*\n` +
            `✅ Process: *Healthy*\n\n` +
            `_Checked at ${new Date().toLocaleTimeString()}_`
          );
        } catch (error) {
          await ctx.reply('🔴 *Health Check Failed*\n\n❌ Database connection error.');
        }
      },
    },
    {
      name: 'speed',
      description: 'Speed test with response time metrics',
      category: 'general',
      aliases: ['speedtest'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const times: number[] = [];
        for (let i = 0; i < 5; i++) {
          const start = Date.now();
          await ctx.react('⚡');
          times.push(Date.now() - start);
        }
        const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
        const min = Math.min(...times);
        const max = Math.max(...times);
        await ctx.reply(
          `⚡ *Speed Test Results*\n\n` +
          `📊 Average: *${avg}ms*\n` +
          `🟢 Best: *${min}ms*\n` +
          `🔴 Worst: *${max}ms*\n` +
          `📈 Samples: *${times.length}*\n\n` +
          `${avg < 100 ? '🟢 Excellent' : avg < 500 ? '🟡 Good' : '🔴 Slow'}`
        );
      },
    },
    {
      name: 'owner',
      description: 'Display owner information',
      category: 'general',
      aliases: ['ownerinfo', 'dev'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        try {
          const ownerSetting = await db.setting.findUnique({ where: { key: 'owner_jid' } });
          const ownerName = await db.setting.findUnique({ where: { key: 'owner_name' } });
          const ownerTitle = await db.setting.findUnique({ where: { key: 'owner_title' } });
          const ownerLocation = await db.setting.findUnique({ where: { key: 'owner_location' } });
          await ctx.reply(
            `╭━━━━━━━━━━━━━━━━━━━\n` +
            `┃ 👑 *BOT OWNER* 👑\n` +
            `┃━━━━━━━━━━━━━━━━━━━\n` +
            `┃ 👤 Name: *${ownerName?.value || 'Caltex wayne'}*\n` +
            `┃ ☠️ Title: *${ownerTitle?.value || 'TECH WIZARD ☠️'}*\n` +
            `┃ 📱 WhatsApp: *${ownerSetting?.value || '+254104906247'}*\n` +
            `┃ 📍 Location: *${ownerLocation?.value || 'Kuresoi, Nakuru County, Kenya'}*\n` +
            `┃━━━━━━━━━━━━━━━━━━━\n` +
            `┃ 💡 _Reach out for inquiries & support_\n` +
            `╰━━━━━━━━━━━━━━━━━━━`
          );
        } catch {
          await ctx.reply(
            `╭━━━━━━━━━━━━━━━━━━━\n` +
            `┃ 👑 *BOT OWNER* 👑\n` +
            `┃━━━━━━━━━━━━━━━━━━━\n` +
            `┃ 👤 Name: *Caltex wayne*\n` +
            `┃ ☠️ Title: *TECH WIZARD ☠️*\n` +
            `┃ 📱 WhatsApp: *+254104906247*\n` +
            `┃ 📍 Location: *Kuresoi, Nakuru County, Kenya*\n` +
            `┃━━━━━━━━━━━━━━━━━━━\n` +
            `┃ 💡 _Reach out for inquiries & support_\n` +
            `╰━━━━━━━━━━━━━━━━━━━`
          );
        }
      },
    },
    {
      name: 'donate',
      description: 'Show donation/support links',
      category: 'general',
      aliases: ['support', 'tip'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        try {
          const donateUrl = await db.setting.findUnique({ where: { key: 'donate_url' } });
          await ctx.reply(
            `💖 *Support CALTEX MD*\n\n` +
            `Help us keep this bot running!\n\n` +
            `🔗 Donate: ${donateUrl?.value || 'https://buymeacoffee.com/caltexmd'}\n\n` +
            `_Every contribution matters! 🙏_`
          );
        } catch {
          await ctx.reply('💖 *Support CALTEX MD*\n\n🔗 Donate: https://buymeacoffee.com/caltexmd\n\n_Every contribution matters! 🙏_');
        }
      },
    },
    {
      name: 'support',
      description: 'Show support channels',
      category: 'general',
      aliases: ['helpdesk', 'contact'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        try {
          const supportUrl = await db.setting.findUnique({ where: { key: 'support_url' } });
          await ctx.reply(
            `🆘 *Support Channels*\n\n` +
            `📧 Email: support@caltexmd.com\n` +
            `💬 WhatsApp: https://wa.me/1234567890\n` +
            `🔗 Community: ${supportUrl?.value || 'https://chat.whatsapp.com/caltexmd'}\n\n` +
            `_We're here to help! 💪_`
          );
        } catch {
          await ctx.reply('🆘 *Support*\n\n📧 support@caltexmd.com\n💬 WhatsApp Group available');
        }
      },
    },
    {
      name: 'menu',
      description: 'Styled bot menu',
      category: 'general',
      aliases: ['allcommands', 'list'],
      cooldown: 15,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const { CommandRegistry } = await import('../plugin-loader');
        const registry = CommandRegistry.getInstance();
        const categories = registry.getCategories();
        const emojis: Record<string, string> = {
          general: '🔧', ai: '🤖', media: '🖼️', group: '👥', admin: '🛡️',
          owner: '👑', fun: '🎮', tools: '🛠️', moderation: '⚔️', download: '📥',
          sticker: '🎭', premium: '💎', scheduler: '⏰', backup: '💾',
          bug: '☠️', language: '🌍', theme: '🎨', analytics: '📊',
        };
        let text = `📋 *CALTEX MD Menu*\n` + '━'.repeat(25) + '\n\n';
        for (const cat of categories) {
          const cmds = registry.getCommandsByCategory(cat);
          const emoji = emojis[cat] || '📦';
          text += `${emoji} *${cat.toUpperCase()}* (${cmds.length})\n`;
          text += cmds.map(c => `  ↳ !${c.name}${c.isPremiumOnly ? ' 👑' : ''}`).join('\n') + '\n\n';
        }
        text += '━'.repeat(25) + '\n👑 = Premium | !help <cmd> for details';
        await ctx.reply(text);
      },
    },
    {
      name: 'about',
      description: 'About the bot',
      category: 'general',
      aliases: ['botabout', 'info'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const { CommandRegistry } = await import('../plugin-loader');
        const reg = CommandRegistry.getInstance();
        const stats = reg.getStats();
        await ctx.reply(
          `🤖 *About CALTEX MD*\n` + '━'.repeat(25) + '\n\n' +
          `📝 An advanced WhatsApp Bot with a powerful plugin system.\n\n` +
          `🏷️ Version: 1.0.0\n` +
          `👨‍💻 Developer: Caltex wayne ☠️\n` +
          `📜 License: MIT\n` +
          `🔌 Plugins: ${stats.totalPlugins}\n` +
          `📝 Commands: ${stats.totalCommands}\n` +
          `📂 Categories: ${stats.categories}\n\n` +
          `💡 Use !menu to see all commands.`
        );
      },
    },
    {
      name: 'changelog',
      description: 'Recent changelog entries',
      category: 'general',
      aliases: ['changes', 'whatsnew'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        try {
          const updates = await db.updateRecord.findMany({
            where: { status: 'completed' },
            orderBy: { performedAt: 'desc' },
            take: 5,
          });
          if (updates.length === 0) {
            await ctx.reply('📋 No changelog entries found.');
            return;
          }
          let text = `📋 *Changelog*\n` + '━'.repeat(22) + '\n\n';
          for (const u of updates) {
            text += `🏷️ v${u.fromVersion} → v${u.toVersion}\n`;
            text += `   📅 ${u.performedAt.toLocaleDateString()}\n`;
            if (u.releaseNotes) text += `   📝 ${u.releaseNotes.substring(0, 80)}...\n`;
            text += '\n';
          }
          await ctx.reply(text);
        } catch {
          await ctx.reply('📋 *CALTEX MD v1.0.0*\n\n• Initial release\n• Plugin system\n• Multi-language support');
        }
      },
    },
  ],
};

export default utilityPlugin;
