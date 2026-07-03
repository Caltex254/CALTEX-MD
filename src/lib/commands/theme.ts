// ============================================================================
// CALTEX MD WhatsApp Bot - Theme System Plugin
// Manage bot menu display themes with configurable styles
// ============================================================================

import type { Plugin, CommandContext } from '../plugin-loader';
import { db } from '@/lib/db';

const DEFAULT_THEMES = [
  { name: 'default', description: 'Clean and minimal default theme', style: JSON.stringify({ header: '━', separator: '─', bullet: '↳', emoji_style: 'colorful' }) },
  { name: 'neon', description: 'Neon glow dark theme with vibrant colors', style: JSON.stringify({ header: '✦', separator: '•', bullet: '▸', emoji_style: 'glow' }) },
  { name: 'minimal', description: 'Ultra-minimal with no decorative elements', style: JSON.stringify({ header: '', separator: '-', bullet: '-', emoji_style: 'none' }) },
  { name: 'retro', description: 'Retro terminal style with ASCII art', style: JSON.stringify({ header: '═══', separator: '───', bullet: '>>', emoji_style: 'ascii' }) },
  { name: 'elegant', description: 'Elegant and professional display', style: JSON.stringify({ header: '❖', separator: '◇', bullet: '◆', emoji_style: 'subtle' }) },
];

async function ensureDefaultThemes(): Promise<void> {
  for (const theme of DEFAULT_THEMES) {
    const exists = await db.themeConfig.findUnique({ where: { name: theme.name } });
    if (!exists) {
      await db.themeConfig.create({
        data: {
          name: theme.name,
          description: theme.description,
          style: theme.style,
          isDefault: theme.name === 'default',
        },
      });
    }
  }
}

const themePlugin: Plugin = {
  name: 'theme',
  version: '1.0.0',
  description: 'Theme system for bot menu display styling',
  author: 'CALTEX MD',
  enabled: true,
  commands: [
    {
      name: 'theme',
      description: 'Set or view the current bot theme',
      category: 'general',
      aliases: ['settheme', 'bottheme'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        try {
          await ensureDefaultThemes();
          const themeName = ctx.args[0]?.toLowerCase();
          if (!themeName) {
            const currentSetting = await db.setting.findUnique({ where: { key: 'active_theme' } });
            const currentTheme = currentSetting?.value || 'default';
            const themeConfig = await db.themeConfig.findUnique({ where: { name: currentTheme } });
            await ctx.reply(
              `🎨 *Current Theme*\n\n` +
              `🏷️ Name: *${currentTheme}*\n` +
              `📝 ${themeConfig?.description || 'Default theme'}\n\n` +
              `💡 Use .theme <name> to change\nUse .themes to see all options`
            );
            return;
          }
          const theme = await db.themeConfig.findUnique({ where: { name: themeName } });
          if (!theme) {
            await ctx.reply(`❌ Theme "${themeName}" not found. Use .themes to see available themes.`);
            return;
          }
          await db.setting.upsert({
            where: { key: 'active_theme' },
            update: { value: themeName, category: 'theme' },
            create: { key: 'active_theme', value: themeName, category: 'theme' },
          });
          await ctx.reply(
            `✅ *Theme Changed!*\n\n` +
            `🎨 Name: *${theme.name}*\n` +
            `📝 ${theme.description}\n\n` +
            `_Menu will now use this theme style._`
          );
        } catch (error) {
          console.error('[Theme] Error:', error);
          await ctx.reply('❌ Failed to change theme.');
        }
      },
    },
    {
      name: 'themes',
      description: 'List all available themes',
      category: 'general',
      aliases: ['listthemes', 'themelist'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        try {
          await ensureDefaultThemes();
          const themes = await db.themeConfig.findMany({ orderBy: { name: 'asc' } });
          const currentSetting = await db.setting.findUnique({ where: { key: 'active_theme' } });
          const currentTheme = currentSetting?.value || 'default';
          let text = `🎨 *Available Themes*\n` + '━'.repeat(22) + '\n\n';
          for (const t of themes) {
            const active = t.name === currentTheme ? ' ✅' : '';
            const def = t.isDefault ? ' (default)' : '';
            text += `🏷️ *${t.name}*${active}${def}\n`;
            text += `   📝 ${t.description}\n\n`;
          }
          text += '💡 Use .theme <name> to apply a theme';
          await ctx.reply(text);
        } catch (error) {
          console.error('[Themes] Error:', error);
          await ctx.reply('❌ Failed to list themes.');
        }
      },
    },
  ],
};

export default themePlugin;
