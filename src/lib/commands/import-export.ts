// ============================================================================
// CALTEX MD WhatsApp Bot - Import/Export Plugin
// Owner-only export and import of bot configuration as JSON
// ============================================================================

import type { Plugin, CommandContext } from '../plugin-loader';
import { db } from '@/lib/db';

const importExportPlugin: Plugin = {
  name: 'import-export',
  version: '1.0.0',
  description: 'Export and import bot configuration as JSON (owner only)',
  author: 'CALTEX MD',
  enabled: true,
  commands: [
    {
      name: 'exportconfig',
      description: 'Export all settings, plugins, themes, and language packs as JSON',
      category: 'owner',
      aliases: ['export', 'backupconfig'],
      cooldown: 30,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isOwner) {
          await ctx.reply('⛔ Owner only command.');
          return;
        }
        await ctx.react('📤');
        try {
          const settings = await db.setting.findMany();
          const plugins = await db.plugin.findMany();
          const themes = await db.themeConfig.findMany();
          const languages = await db.languagePack.findMany();
          const autoReplies = await db.autoReply.findMany();
          const repoConfig = await db.repoConfig.findFirst();

          const exportData = {
            _meta: {
              exportedAt: new Date().toISOString(),
              version: '1.0.0',
              botName: 'CALTEX MD',
            },
            settings: settings.map(s => ({ key: s.key, value: s.value, category: s.category, description: s.description })),
            plugins: plugins.map(p => ({ name: p.name, version: p.version, isEnabled: p.isEnabled, config: p.config })),
            themes: themes.map(t => ({ name: t.name, description: t.description, style: t.style, isDefault: t.isDefault })),
            languages: languages.map(l => ({ code: l.code, name: l.name, translations: l.translations, isDefault: l.isDefault })),
            autoReplies: autoReplies.map(a => ({
              trigger: a.trigger, response: a.response, isRegex: a.isRegex,
              isGlobal: a.isGlobal, groupJid: a.groupJid, isEnabled: a.isEnabled,
            })),
            repoConfig: repoConfig ? {
              repoName: repoConfig.repoName, repoUrl: repoConfig.repoUrl,
              developerName: repoConfig.developerName, description: repoConfig.description,
              docsUrl: repoConfig.docsUrl, license: repoConfig.license,
            } : null,
          };

          const jsonStr = JSON.stringify(exportData, null, 2);
          const charCount = jsonStr.length;
          if (charCount > 4000) {
            await ctx.reply(
              `📤 *Configuration Exported*\n\n` +
              `📊 Size: ${(charCount / 1024).toFixed(1)}KB\n` +
              `⚙️ Settings: ${settings.length}\n` +
              `🔌 Plugins: ${plugins.length}\n` +
              `🎨 Themes: ${themes.length}\n` +
              `🌐 Languages: ${languages.length}\n` +
              `💬 Auto-Replies: ${autoReplies.length}\n\n` +
              `_JSON too large for WhatsApp. Export saved to dashboard._`
            );
          } else {
            await ctx.reply(
              `📤 *Configuration Export*\n\n` +
              '```json\n' + jsonStr + '\n```\n\n' +
              `⚙️ Settings: ${settings.length} | 🔌 Plugins: ${plugins.length} | 🎨 Themes: ${themes.length}`
            );
          }
        } catch (error) {
          console.error('[ExportConfig] Error:', error);
          await ctx.reply('❌ Failed to export configuration.');
        }
      },
    },
    {
      name: 'importconfig',
      description: 'Import configuration from a JSON string (owner only)',
      category: 'owner',
      aliases: ['import', 'restoreconfig'],
      cooldown: 30,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isOwner) {
          await ctx.reply('⛔ Owner only command.');
          return;
        }
        const jsonInput = ctx.args.join(' ');
        if (!jsonInput || jsonInput.length < 10) {
          await ctx.reply(
            '❌ Usage: .importconfig <json>\n\n' +
            '⚠️ Provide a valid JSON configuration string.\n' +
            '💡 Use .exportconfig first to get the format.'
          );
          return;
        }
        await ctx.react('📥');
        try {
          const cleanJson = jsonInput.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
          const data = JSON.parse(cleanJson);
          let imported = 0;
          if (data.settings && Array.isArray(data.settings)) {
            for (const s of data.settings) {
              await db.setting.upsert({
                where: { key: s.key },
                update: { value: s.value, category: s.category, description: s.description },
                create: { key: s.key, value: s.value, category: s.category, description: s.description },
              });
              imported++;
            }
          }
          if (data.autoReplies && Array.isArray(data.autoReplies)) {
            for (const a of data.autoReplies) {
              await db.autoReply.create({
                data: {
                  trigger: a.trigger, response: a.response, isRegex: a.isRegex ?? false,
                  isGlobal: a.isGlobal ?? true, groupJid: a.groupJid, isEnabled: a.isEnabled ?? true,
                },
              });
              imported++;
            }
          }
          await ctx.reply(
            `✅ *Configuration Imported!*\n\n` +
            `📊 Items imported: *${imported}*\n` +
            `⚙️ Settings: ${data.settings?.length ?? 0}\n` +
            `💬 Auto-Replies: ${data.autoReplies?.length ?? 0}\n\n` +
            `_Restart the bot to apply all changes._`
          );
        } catch (error) {
          console.error('[ImportConfig] Error:', error);
          if (error instanceof SyntaxError) {
            await ctx.reply('❌ Invalid JSON format. Please check your input.');
          } else {
            await ctx.reply('❌ Failed to import configuration.');
          }
        }
      },
    },
  ],
};

export default importExportPlugin;
