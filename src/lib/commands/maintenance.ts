// ============================================================================
// CALTEX MD WhatsApp Bot - Maintenance Mode Plugin
// Owner-only command to toggle maintenance mode on/off
// ============================================================================

import type { Plugin, CommandContext } from '../plugin-loader';
import { db } from '@/lib/db';

const MAINTENANCE_KEY = 'maintenance_mode';

async function isMaintenanceMode(): Promise<boolean> {
  const setting = await db.setting.findUnique({ where: { key: MAINTENANCE_KEY } });
  return setting?.value === 'true';
}

const maintenancePlugin: Plugin = {
  name: 'maintenance',
  version: '1.0.0',
  description: 'Maintenance mode toggle - when enabled only owner commands work',
  author: 'CALTEX MD',
  enabled: true,
  commands: [
    {
      name: 'maintenance',
      description: 'Toggle maintenance mode on/off (owner only)',
      category: 'owner',
      aliases: ['maint', 'mm'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isOwner) {
          await ctx.reply('⛔ Owner only command.');
          return;
        }
        const action = ctx.args[0]?.toLowerCase();
        if (!action || !['on', 'off', 'status'].includes(action)) {
          const current = await isMaintenanceMode();
          await ctx.reply(
            `❌ Usage: !maintenance <on|off|status>\n\n` +
            `📊 Current Status: ${current ? '🔴 ON' : '🟢 OFF'}\n\n` +
            `When enabled, only owner commands will execute.`
          );
          return;
        }
        try {
          if (action === 'status') {
            const isOn = await isMaintenanceMode();
            await ctx.reply(
              `🔧 *Maintenance Mode*\n\n` +
              `Status: ${isOn ? '🔴 ENABLED' : '🟢 DISABLED'}\n\n` +
              isOn
                ? '_Only owner commands are active._'
                : '_All commands are available._'
            );
            return;
          }
          const enable = action === 'on';
          await db.setting.upsert({
            where: { key: MAINTENANCE_KEY },
            update: { value: enable ? 'true' : 'false', category: 'system', description: 'Maintenance mode toggle' },
            create: { key: MAINTENANCE_KEY, value: enable ? 'true' : 'false', category: 'system', description: 'Maintenance mode toggle' },
          });
          if (enable) {
            await ctx.reply(
              `🔴 *Maintenance Mode ENABLED*\n\n` +
              `⚠️ All non-owner commands are now disabled.\n` +
              `🛠️ Use !maintenance off to disable.`
            );
          } else {
            await ctx.reply(
              `🟢 *Maintenance Mode DISABLED*\n\n` +
              `✅ All commands are now available again.`
            );
          }
        } catch (error) {
          console.error('[Maintenance] Error:', error);
          await ctx.reply('❌ Failed to toggle maintenance mode.');
        }
      },
    },
  ],
  config: {
    isMaintenanceCheck: true,
  },
};

export default maintenancePlugin;
