// ============================================================================
// CALTEX MD WhatsApp Bot - AFK System Plugin
// Set AFK status, return from AFK, auto-notify on mentions
// ============================================================================

import type { Plugin, CommandContext } from '../plugin-loader';
import { db } from '@/lib/db';

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const afkPlugin: Plugin = {
  name: 'afk',
  version: '1.0.0',
  description: 'AFK status system with auto-notification on mentions',
  author: 'CALTEX MD',
  enabled: true,
  commands: [
    {
      name: 'afk',
      description: 'Set AFK status with an optional reason',
      category: 'general',
      aliases: ['away', 'brb'],
      cooldown: 3,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const reason = ctx.args.length > 0 ? ctx.args.join(' ') : 'No reason specified';
        try {
          await db.aFKStatus.upsert({
            where: { userJid: ctx.sender },
            update: { reason, isAFK: true, setAt: new Date() },
            create: { userJid: ctx.sender, reason, isAFK: true },
          });
          await ctx.react('💤');
          await ctx.reply(
            `💤 *AFK Mode On*\n\n` +
            `📝 Reason: ${reason}\n` +
            `🕐 Set at: ${new Date().toLocaleTimeString()}\n\n` +
            `_I'll notify anyone who mentions you._`
          );
        } catch (error) {
          console.error('[AFK] Error:', error);
          await ctx.reply('❌ Failed to set AFK status.');
        }
      },
    },
    {
      name: 'back',
      description: 'Return from AFK and see how long you were away',
      category: 'general',
      aliases: ['return', 'imback'],
      cooldown: 3,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        try {
          const afk = await db.aFKStatus.findUnique({ where: { userJid: ctx.sender } });
          if (!afk || !afk.isAFK) {
            await ctx.reply('✅ You are not currently AFK.');
            return;
          }
          const duration = Date.now() - afk.setAt.getTime();
          const durationStr = formatDuration(duration);
          await db.aFKStatus.update({
            where: { userJid: ctx.sender },
            data: { isAFK: false },
          });
          await ctx.react('👋');
          await ctx.reply(
            `👋 *Welcome Back!*\n\n` +
            `⏱️ You were AFK for: *${durationStr}*\n` +
            `📝 Reason was: ${afk.reason}\n` +
            `🕐 Left at: ${afk.setAt.toLocaleTimeString()}`
          );
        } catch (error) {
          console.error('[Back] Error:', error);
          await ctx.reply('❌ Failed to return from AFK.');
        }
      },
    },
  ],
};

export default afkPlugin;
