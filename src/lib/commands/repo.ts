// ============================================================================
// CALTEX MD WhatsApp Bot - Repository Info Command
// Displays professional repo info card from database configuration
// ============================================================================

import type { Plugin, CommandContext } from '../plugin-loader';
import { db } from '@/lib/db';

const repoPlugin: Plugin = {
  name: 'repo',
  version: '1.0.0',
  description: 'Shows professional repository information card',
  author: 'CALTEX MD',
  enabled: true,
  commands: [
    {
      name: 'repo',
      description: 'Show repository info card (name, link, version, developer)',
      category: 'general',
      aliases: ['repository', 'source', 'github'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        await ctx.react('📂');
        try {
          let repoConfig = await db.repoConfig.findFirst();
          if (!repoConfig) {
            repoConfig = await db.repoConfig.create({
              data: {
                repoName: 'CALTEX MD',
                developerName: 'CALTEX MD Team',
                description: 'Advanced WhatsApp Bot with plugin system',
                license: 'MIT',
              },
            });
          }

          const version = await db.updateRecord.findFirst({
            where: { status: 'completed' },
            orderBy: { performedAt: 'desc' },
          });

          const currentVersion = version?.toVersion ?? '1.0.0';

          const text =
            `📂 *${repoConfig.repoName}*\n` +
            '━'.repeat(25) + '\n\n' +
            `📝 *Description:* ${repoConfig.description || 'N/A'}\n` +
            `🔗 *GitHub:* ${repoConfig.repoUrl || 'Not configured'}\n` +
            `🏷️ *Version:* v${currentVersion}\n` +
            `👨‍💻 *Developer:* ${repoConfig.developerName}\n` +
            `📖 *Docs:* ${repoConfig.docsUrl || 'Not configured'}\n` +
            `📜 *License:* ${repoConfig.license}\n` +
            `🆕 *Latest Release:* ${repoConfig.latestRelease || currentVersion}\n\n` +
            '━'.repeat(25) + '\n' +
            '💡 _Configure via dashboard: Settings > Repo Config_';

          await ctx.reply(text);
        } catch (error) {
          console.error('[Repo] Error:', error);
          await ctx.reply('❌ Failed to load repository info. Please try again.');
        }
      },
    },
  ],
};

export default repoPlugin;
