// ============================================================================
// CALTEX MD WhatsApp Bot - Help Command
// Shows all available commands grouped by category
// ============================================================================

import type { Plugin, CommandContext, Command } from '../plugin-loader';

function formatCategorySection(
  category: string,
  commands: Command[],
  prefix: string
): string {
  const emoji = getCategoryEmoji(category);
  let section = `\n${emoji} *${category.toUpperCase()}*\n`;
  section += '─'.repeat(20) + '\n';
  for (const cmd of commands) {
    const premium = cmd.isPremiumOnly ? ' 👑' : '';
    const aliases = cmd.aliases.length > 0 ? ` (${cmd.aliases.join(', ')})` : '';
    section += `  ${prefix}${cmd.name}${aliases}${premium}\n`;
    section += `  ↳ ${cmd.description}\n`;
  }
  return section;
}

function getCategoryEmoji(category: string): string {
  const emojis: Record<string, string> = {
    general: '🔧',
    ai: '🤖',
    media: '🖼️',
    group: '👥',
    admin: '🛡️',
    owner: '👑',
    fun: '🎮',
    tools: '🛠️',
    moderation: '⚔️',
    download: '📥',
    sticker: '🎭',
    bug: '☠️',
    premium: '💎',
    scheduler: '⏰',
    backup: '💾',
    language: '🌍',
    theme: '🎨',
    analytics: '📊',
  };
  return emojis[category] || '📦';
}

const helpPlugin: Plugin = {
  name: 'help',
  version: '1.0.0',
  description: 'Shows all available commands grouped by category',
  author: 'CALTEX MD',
  enabled: true,
  commands: [
    {
      name: 'help',
      description: 'Show all available commands grouped by category',
      category: 'general',
      aliases: ['h', 'commands', 'cmds'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        await ctx.react('📖');

        // Dynamically import to get registry
        const { CommandRegistry } = await import('../plugin-loader');
        const registry = CommandRegistry.getInstance();
        const categories = registry.getCategories();
        const prefix = '!';

        let text = '📖 *CALTEX MD - Command List*\n';
        text += '━'.repeat(25) + '\n';

        const categoryArg = ctx.args[0]?.toLowerCase();

        if (categoryArg) {
          // Show specific category
          const cmds = registry.getCommandsByCategory(categoryArg);
          if (cmds.length === 0) {
            await ctx.reply(`❌ No commands found in category "${categoryArg}".`);
            return;
          }
          text += formatCategorySection(categoryArg, cmds, prefix);
        } else {
          // Show all categories
          for (const cat of categories) {
            const cmds = registry.getCommandsByCategory(cat);
            if (cmds.length > 0) {
              text += formatCategorySection(cat, cmds, prefix);
            }
          }
        }

        text += '\n' + '━'.repeat(25) + '\n';
        text += '👑 = Premium only | Total: ' + registry.getAllCommands().length + ' commands';
        text += '\n\n💡 Use *!help <category>* for specific categories';

        await ctx.reply(text);
      },
    },
  ],
};

export default helpPlugin;
