// ============================================================================
// CALTEX MD WhatsApp Bot - Menu Command
// Styled WhatsApp menu with bot info, categories, and commands
// ============================================================================

import type { Plugin, CommandContext, Command } from '../plugin-loader';

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    general: '⚙️',
    ai: '🧠',
    media: '🎨',
    group: '👥',
    admin: '🛡️',
    owner: '👑',
    fun: '🎲',
    tools: '🔧',
    moderation: '⚔️',
    download: '⬇️',
    sticker: '🎭',
    bug: '☠️',
    premium: '💎',
    scheduler: '⏰',
    backup: '💾',
    language: '🌍',
    theme: '🎨',
  };
  return icons[category] || '📦';
}

function getCategoryCount(categories: string[], getCommandsByCategory: (c: string) => Command[]): string {
  return categories
    .map((cat) => {
      const cmds = getCommandsByCategory(cat);
      return `${getCategoryIcon(cat)} ${cat.charAt(0).toUpperCase() + cat.slice(1)}: ${cmds.length}`;
    })
    .join('\n');
}

const menuPlugin: Plugin = {
  name: 'menu',
  version: '1.0.0',
  description: 'Styled WhatsApp menu with bot info, categories, and commands',
  author: 'CALTEX MD',
  enabled: true,
  commands: [
    {
      name: 'menu',
      description: 'Show the main bot menu with info and categories',
      category: 'general',
      aliases: ['m', 'main'],
      cooldown: 15,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        await ctx.react('📋');

        const { CommandRegistry } = await import('../plugin-loader');
        const registry = CommandRegistry.getInstance();
        const stats = registry.getStats();
        const categories = registry.getCategories();
        const uptime = process.uptime();

        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);

        let text = '';
        text += '╭━━━━━━━━━━━━━━━━━━━\n';
        text += '┃ 🔥 *CALTEX MD BOT* 🔥\n';
        text += '┃━━━━━━━━━━━━━━━━━━━\n';
        text += `┃ 🤖 Version: *2.0.0*\n`;
        text += `┃ ⚡ Runtime: *Bun ${typeof Bun !== 'undefined' ? Bun.version : 'N/A'}*\n`;
        text += `┃ 🕐 Uptime: *${days}d ${hours}h ${minutes}m*\n`;
        text += `┃ 💾 Memory: *${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB*\n`;
        text += `┃ 📦 Plugins: *${stats.totalPlugins}*\n`;
        text += `┃ 📝 Commands: *${stats.totalCommands}*\n`;
        text += `┃ 📂 Categories: *${stats.categories}*\n`;
        text += '┃━━━━━━━━━━━━━━━━━━━\n';
        text += '┃ 👤 *Developer: Caltex wayne*\n';
        text += '┃ ☠️ *TECH WIZARD*\n';
        text += '┃━━━━━━━━━━━━━━━━━━━\n';
        text += '┃ 📋 *CATEGORIES*\n';
        text += '┃\n';

        for (const cat of categories) {
          const cmds = registry.getCommandsByCategory(cat);
          const icon = getCategoryIcon(cat);
          text += `┃ ${icon} *${cat.charAt(0).toUpperCase() + cat.slice(1)}* (${cmds.length})\n`;
        }

        text += '┃━━━━━━━━━━━━━━━━━━━\n';
        text += '┃ 💡 *Type .help <category> for commands*\n';
        text += '┃ 📌 Prefix: *.*\n';
        text += '┃ ☠️ Bug Menu: *.bugmenu*\n';
        text += '╰━━━━━━━━━━━━━━━━━━━\n';

        await ctx.reply(text);
      },
    },
  ],
};

export default menuPlugin;
