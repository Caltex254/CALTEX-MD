// ============================================================================
// CALTEX MD WhatsApp Bot - Ping Command
// Simple connectivity and latency check
// ============================================================================

import type { Plugin, CommandContext } from '../plugin-loader';

const pingCommand: Plugin = {
  name: 'ping',
  version: '1.0.0',
  description: 'Connectivity and latency check command',
  author: 'CALTEX MD',
  enabled: true,
  commands: [
    {
      name: 'ping',
      description: 'Check bot responsiveness and latency',
      category: 'general',
      aliases: ['p', 'pong', 'latency'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const start = Date.now();
        await ctx.react('🏓');
        const latency = Date.now() - start;

        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);

        const text =
          `🏓 *Pong!*\n\n` +
          `⚡ Latency: *${latency}ms*\n` +
          `🕐 Uptime: *${hours}h ${minutes}m ${seconds}s*\n` +
          `💾 Memory: *${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB*\n` +
          `🟢 Status: *Online*`;

        await ctx.reply(text);
      },
    },
  ],
};

export default pingCommand;
