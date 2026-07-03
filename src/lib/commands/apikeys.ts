// ============================================================================
// CALTEX MD WhatsApp Bot - API Key Manager Plugin
// Owner-only management of API provider keys with masking
// ============================================================================

import type { Plugin, CommandContext } from '../plugin-loader';
import { db } from '@/lib/db';

function maskKey(key: string): string {
  if (key.length <= 8) return '••••••••';
  return key.substring(0, 4) + '••••' + key.substring(key.length - 4);
}

const apikeysPlugin: Plugin = {
  name: 'apikeys',
  version: '1.0.0',
  description: 'API key manager with secure display and provider tracking',
  author: 'CALTEX MD',
  enabled: true,
  commands: [
    {
      name: 'apikeys',
      description: 'List all configured API keys (masked)',
      category: 'owner',
      aliases: ['listkeys', 'keys'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isOwner) {
          await ctx.reply('⛔ Owner only command.');
          return;
        }
        try {
          const keys = await db.aPIKey.findMany({ orderBy: { name: 'asc' } });
          if (keys.length === 0) {
            await ctx.reply('🔑 No API keys configured.\n\n💡 Use .apikeyadd <name> <key> [provider]');
            return;
          }
          let text = `🔑 *API Keys (${keys.length})*\n` + '━'.repeat(22) + '\n\n';
          for (const k of keys) {
            const status = k.isEnabled ? '🟢' : '🔴';
            const lastUsed = k.lastUsedAt ? k.lastUsedAt.toLocaleDateString() : 'Never';
            text += `${status} *${k.name}*\n`;
            text += `   🔐 ${maskKey(k.key)}\n`;
            text += `   🏷️ ${k.provider || 'N/A'} | Last: ${lastUsed}\n\n`;
          }
          text += '💡 .apikeyadd | .apikeydel | .apikeytoggle';
          await ctx.reply(text);
        } catch (error) {
          console.error('[APIKeys] Error:', error);
          await ctx.reply('❌ Failed to list API keys.');
        }
      },
    },
    {
      name: 'apikeyadd',
      description: 'Add an API key (owner only)',
      category: 'owner',
      aliases: ['addkey', 'addapikey'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isOwner) {
          await ctx.reply('⛔ Owner only command.');
          return;
        }
        const name = ctx.args[0]?.toLowerCase();
        const key = ctx.args[1];
        const provider = ctx.args[2]?.toLowerCase();
        if (!name || !key) {
          await ctx.reply(
            '❌ Usage: .apikeyadd <name> <key> [provider]\n\n' +
            '📝 *Examples:*\n' +
            '.apikeyadd openai sk-abc123 openai\n' +
            '.apikeyadd gemini AIzaSy... google\n' +
            '.apikeyadd custom mykey123'
          );
          return;
        }
        try {
          const existing = await db.aPIKey.findUnique({ where: { name } });
          if (existing) {
            await db.aPIKey.update({
              where: { name },
              data: { key, provider: provider || existing.provider },
            });
            await ctx.reply(`✏️ API key *"${name}"* updated!\n🔐 ${maskKey(key)}`);
            return;
          }
          await db.aPIKey.create({
            data: { name, key, provider: provider || name },
          });
          await ctx.reply(
            `✅ API key *"${name}"* added!\n\n` +
            `🏷️ Provider: ${provider || name}\n` +
            `🔐 Key: ${maskKey(key)}\n` +
            `🟢 Status: Enabled`
          );
        } catch (error) {
          console.error('[APIKeyAdd] Error:', error);
          await ctx.reply('❌ Failed to add API key.');
        }
      },
    },
    {
      name: 'apikeydel',
      description: 'Delete an API key (owner only)',
      category: 'owner',
      aliases: ['delkey', 'deletekey'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isOwner) {
          await ctx.reply('⛔ Owner only command.');
          return;
        }
        const name = ctx.args[0]?.toLowerCase();
        if (!name) {
          await ctx.reply('❌ Usage: .apikeydel <name>\nExample: .apikeydel openai');
          return;
        }
        try {
          const key = await db.aPIKey.findUnique({ where: { name } });
          if (!key) {
            await ctx.reply(`❌ API key "${name}" not found.`);
            return;
          }
          await db.aPIKey.delete({ where: { name } });
          await ctx.reply(`🗑️ API key *"${name}"* deleted!`);
        } catch (error) {
          console.error('[APIKeyDel] Error:', error);
          await ctx.reply('❌ Failed to delete API key.');
        }
      },
    },
    {
      name: 'apikeytoggle',
      description: 'Enable/disable an API key (owner only)',
      category: 'owner',
      aliases: ['togglekey', 'keytoggle'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isOwner) {
          await ctx.reply('⛔ Owner only command.');
          return;
        }
        const name = ctx.args[0]?.toLowerCase();
        if (!name) {
          await ctx.reply('❌ Usage: .apikeytoggle <name>\nExample: .apikeytoggle openai');
          return;
        }
        try {
          const key = await db.aPIKey.findUnique({ where: { name } });
          if (!key) {
            await ctx.reply(`❌ API key "${name}" not found.`);
            return;
          }
          const newState = !key.isEnabled;
          await db.aPIKey.update({
            where: { name },
            data: { isEnabled: newState },
          });
          await ctx.reply(
            `${newState ? '🟢' : '🔴'} API key *"${name}"* ${newState ? 'enabled' : 'disabled'}!\n` +
            `🔐 ${maskKey(key.key)}`
          );
        } catch (error) {
          console.error('[APIKeyToggle] Error:', error);
          await ctx.reply('❌ Failed to toggle API key.');
        }
      },
    },
  ],
};

export default apikeysPlugin;
