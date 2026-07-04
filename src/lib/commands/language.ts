// ============================================================================
// CALTEX MD WhatsApp Bot - Multi-Language Plugin
// Set language preferences per user/group with translation support
// ============================================================================

import type { Plugin, CommandContext } from '../plugin-loader';
import { db } from '@/lib/db';

const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'sw', name: 'Kiswahili', flag: '🇰🇪' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
];

const DEFAULT_TRANSLATIONS: Record<string, string> = {
  'greeting': 'Hello! 👋',
  'farewell': 'Goodbye! 👋',
  'error': 'An error occurred. ❌',
  'no_permission': 'You don\'t have permission. ⛔',
  'success': 'Done! ✅',
  'afk_set': 'AFK mode activated 💤',
  'afk_back': 'Welcome back! 👋',
  'premium_active': 'You are a premium member! 👑',
  'premium_inactive': 'You are not a premium member.',
  'command_cooldown': 'Please wait before using this command again. ⏳',
};

async function getLanguagePreference(jid: string, isGroup: boolean): Promise<string> {
  const key = isGroup ? `lang_group_${jid}` : `lang_user_${jid}`;
  const setting = await db.setting.findUnique({ where: { key } });
  return setting?.value || 'en';
}

async function setLanguagePreference(jid: string, isGroup: boolean, code: string): Promise<void> {
  const key = isGroup ? `lang_group_${jid}` : `lang_user_${jid}`;
  await db.setting.upsert({
    where: { key },
    update: { value: code, category: 'language' },
    create: { key, value: code, category: 'language' },
  });
}

const languagePlugin: Plugin = {
  name: 'language',
  version: '1.0.0',
  description: 'Multi-language support with per-user and per-group preferences',
  author: 'CALTEX MD',
  enabled: true,
  commands: [
    {
      name: 'language',
      description: 'Set or view your language preference',
      category: 'general',
      aliases: ['lang', 'setlang'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const langCode = ctx.args[0]?.toLowerCase();
        try {
          if (!langCode) {
            const current = await getLanguagePreference(ctx.sender, ctx.isGroup);
            const langInfo = SUPPORTED_LANGUAGES.find(l => l.code === current);
            await ctx.reply(
              `🌐 *Language Settings*\n\n` +
              `Current: ${langInfo?.flag || '🌐'} *${langInfo?.name || current}*\n\n` +
              `💡 Use .language <code> to change\nExample: .language sw`
            );
            return;
          }
          const found = SUPPORTED_LANGUAGES.find(l => l.code === langCode);
          if (!found) {
            await ctx.reply(
              `❌ Language "${langCode}" not supported.\n\n` +
              `💡 Use .languages to see available options.`
            );
            return;
          }
          await setLanguagePreference(ctx.sender, ctx.isGroup, langCode);
          await ctx.reply(
            `✅ *Language Changed!*\n\n` +
            `${found.flag} ${found.name} (${found.code})\n\n` +
            `_Bot responses will now use this language._`
          );
        } catch (error) {
          console.error('[Language] Error:', error);
          await ctx.reply('❌ Failed to change language.');
        }
      },
    },
    {
      name: 'languages',
      description: 'List all available languages',
      category: 'general',
      aliases: ['langs', 'listlang'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        let text = `🌐 *Available Languages*\n` + '━'.repeat(22) + '\n\n';
        for (const lang of SUPPORTED_LANGUAGES) {
          text += `${lang.flag} *${lang.name}* → ${lang.code}\n`;
        }
        text += '\n💡 Use .language <code> to set your preference';
        await ctx.reply(text);
      },
    },
  ],
};

export default languagePlugin;
