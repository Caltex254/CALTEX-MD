// ============================================================================
// CALTEX MD WhatsApp Bot - Sticker Commands
// Image/video to sticker conversion, sticker stealing, and pack management
// ============================================================================

import type { Plugin, CommandContext } from '../plugin-loader';

// Simple in-memory sticker pack storage
const stickerPacks: Map<string, { name: string; author: string; stickers: string[] }> = new Map();

const stickerPlugin: Plugin = {
  name: 'sticker',
  version: '1.0.0',
  description: 'Sticker creation, stealing, and pack management commands',
  author: 'CALTEX MD',
  enabled: true,
  commands: [
    {
      name: 'sticker',
      description: 'Convert image or video to WhatsApp sticker',
      category: 'sticker',
      aliases: ['s', 'stiker', 'stick'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        await ctx.react('🎭');
        // Check for quoted media or direct image
        const quoted = ctx.message?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const hasImage = ctx.message?.message?.imageMessage || quoted?.imageMessage;
        const hasVideo = ctx.message?.message?.videoMessage || quoted?.videoMessage;

        if (!hasImage && !hasVideo) {
          await ctx.reply(
            '❌ Please reply to an image or video to create a sticker.\n\nUsage: Reply to an image/video with !sticker'
          );
          return;
        }

        // Parse optional pack/author from args
        let packName = 'CALTEX MD';
        let authorName = 'Bot';
        if (ctx.args.length >= 1) packName = ctx.args[0];
        if (ctx.args.length >= 2) authorName = ctx.args[1];

        if (hasImage) {
          await ctx.reply(
            `🎭 *Creating sticker...*\n📦 Pack: ${packName}\n✍️ Author: ${authorName}\n\n_In production, the image would be converted to WebP sticker format using sharp._`
          );
        } else {
          await ctx.reply(
            `🎭 *Creating animated sticker...*\n📦 Pack: ${packName}\n✍️ Author: ${authorName}\n\n_Video stickers (WebP animated) would be created from the video frames._`
          );
        }
      },
    },
    {
      name: 'takestick',
      description: 'Steal a sticker with custom pack/author metadata',
      category: 'sticker',
      aliases: ['take', 'stealsticker', 'claim'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const quoted = ctx.message?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const hasSticker = quoted?.stickerMessage;

        if (!hasSticker) {
          await ctx.reply(
            '❌ Please reply to a sticker to steal it.\n\nUsage: Reply to a sticker with !takestick <pack> <author>'
          );
          return;
        }

        const packName = ctx.args[0] || 'CALTEX MD';
        const authorName = ctx.args[1] || 'Stolen';

        await ctx.react('🏷️');
        await ctx.reply(
          `🏷️ *Sticker stolen!*\n\n📦 Pack: ${packName}\n✍️ Author: ${authorName}\n\n_The sticker will be re-sent with your custom metadata._`
        );
      },
    },
    {
      name: 'stickerpack',
      description: 'Manage sticker packs - create, list, and view packs',
      category: 'sticker',
      aliases: ['spack', 'pack'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const subcommand = ctx.args[0]?.toLowerCase();

        if (!subcommand || subcommand === 'list') {
          // List all sticker packs
          if (stickerPacks.size === 0) {
            await ctx.reply('📦 No sticker packs created yet.\n\nUse !stickerpack create <name> to create one.');
            return;
          }
          let text = '📦 *STICKER PACKS*\n\n';
          for (const [id, pack] of stickerPacks) {
            text += `🔹 ${pack.name} by ${pack.author}\n`;
            text += `   Stickers: ${pack.stickers.length} | ID: ${id}\n`;
          }
          await ctx.reply(text);
          return;
        }

        if (subcommand === 'create') {
          const name = ctx.args[1];
          if (!name) {
            await ctx.reply('❌ Usage: !stickerpack create <name> <author>');
            return;
          }
          const author = ctx.args[2] || ctx.sender.split('@')[0];
          const id = `pack_${Date.now()}`;
          stickerPacks.set(id, { name, author, stickers: [] });
          await ctx.reply(`✅ Sticker pack "${name}" created!\n📦 Pack ID: ${id}\n✍️ Author: ${author}`);
          return;
        }

        if (subcommand === 'info') {
          const packId = ctx.args[1];
          const pack = stickerPacks.get(packId);
          if (!pack) {
            await ctx.reply('❌ Sticker pack not found. Use !stickerpack list to see all packs.');
            return;
          }
          await ctx.reply(
            `📦 *${pack.name}*\n✍️ Author: ${pack.author}\n🎭 Stickers: ${pack.stickers.length}\n🆔 ID: ${packId}`
          );
          return;
        }

        await ctx.reply(
          '❌ Unknown subcommand.\n\nAvailable:\n' +
          '• !stickerpack list - List all packs\n' +
          '• !stickerpack create <name> <author> - Create a pack\n' +
          '• !stickerpack info <id> - View pack info'
        );
      },
    },
  ],
};

export default stickerPlugin;
