// ============================================================================
// CALTEX MD WhatsApp Bot - Download Commands
// Media downloading from YouTube, Instagram, TikTok, Facebook, Twitter, etc.
// ============================================================================

import type { Plugin, CommandContext } from '../plugin-loader';

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function getPlatform(url: string): string {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube';
  if (url.includes('instagram.com')) return 'Instagram';
  if (url.includes('tiktok.com')) return 'TikTok';
  if (url.includes('facebook.com') || url.includes('fb.watch')) return 'Facebook';
  if (url.includes('twitter.com') || url.includes('x.com')) return 'Twitter/X';
  return 'Unknown';
}

async function simulateDownload(url: string, type: 'audio' | 'video' | 'media'): Promise<string> {
  const platform = getPlatform(url);
  return `_In production, this would use ${platform}'s extraction API to download the ${type} and send it as a WhatsApp message. Supported backends: yt-dlp, cobalt.tools, etc._`;
}

const downloadPlugin: Plugin = {
  name: 'download',
  version: '1.0.0',
  description: 'Download media from YouTube, Instagram, TikTok, Facebook, Twitter, and more',
  author: 'CALTEX MD',
  enabled: true,
  commands: [
    {
      name: 'yta',
      description: 'Download YouTube audio (MP3)',
      category: 'download',
      aliases: ['ytaudio', 'ytmp3'],
      cooldown: 15,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const url = ctx.args[0];
        if (!url || !isValidUrl(url)) {
          await ctx.reply('❌ Usage: !yta <youtube url>\nExample: !yta https://youtube.com/watch?v=...');
          return;
        }
        if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
          await ctx.reply('❌ Please provide a valid YouTube URL.');
          return;
        }
        await ctx.react('🎵');
        const note = await simulateDownload(url, 'audio');
        await ctx.reply(`🎵 *YouTube Audio Download*\n\nURL: ${url}\n\n⏳ Downloading audio...\n\n${note}`);
      },
    },
    {
      name: 'ytv',
      description: 'Download YouTube video (MP4)',
      category: 'download',
      aliases: ['ytvideo', 'ytmp4'],
      cooldown: 15,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const url = ctx.args[0];
        if (!url || !isValidUrl(url)) {
          await ctx.reply('❌ Usage: !ytv <youtube url>\nExample: !ytv https://youtube.com/watch?v=...');
          return;
        }
        if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
          await ctx.reply('❌ Please provide a valid YouTube URL.');
          return;
        }
        await ctx.react('🎬');
        const note = await simulateDownload(url, 'video');
        await ctx.reply(`🎬 *YouTube Video Download*\n\nURL: ${url}\n\n⏳ Downloading video...\n\n${note}`);
      },
    },
    {
      name: 'ig',
      description: 'Download Instagram media (photo/video/reel)',
      category: 'download',
      aliases: ['instagram', 'insta'],
      cooldown: 15,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const url = ctx.args[0];
        if (!url || !isValidUrl(url)) {
          await ctx.reply('❌ Usage: !ig <instagram url>\nExample: !ig https://instagram.com/reel/...');
          return;
        }
        if (!url.includes('instagram.com')) {
          await ctx.reply('❌ Please provide a valid Instagram URL.');
          return;
        }
        await ctx.react('📸');
        const note = await simulateDownload(url, 'media');
        await ctx.reply(`📸 *Instagram Download*\n\nURL: ${url}\n\n⏳ Downloading media...\n\n${note}`);
      },
    },
    {
      name: 'tiktok',
      description: 'Download TikTok video (no watermark)',
      category: 'download',
      aliases: ['tt', 'tik'],
      cooldown: 15,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const url = ctx.args[0];
        if (!url || !isValidUrl(url)) {
          await ctx.reply('❌ Usage: !tiktok <tiktok url>\nExample: !tiktok https://tiktok.com/@user/video/...');
          return;
        }
        if (!url.includes('tiktok.com')) {
          await ctx.reply('❌ Please provide a valid TikTok URL.');
          return;
        }
        await ctx.react('🎵');
        const note = await simulateDownload(url, 'video');
        await ctx.reply(`🎵 *TikTok Download (No Watermark)*\n\nURL: ${url}\n\n⏳ Downloading...\n\n${note}`);
      },
    },
    {
      name: 'fb',
      description: 'Download Facebook video',
      category: 'download',
      aliases: ['facebook', 'fbvideo'],
      cooldown: 15,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const url = ctx.args[0];
        if (!url || !isValidUrl(url)) {
          await ctx.reply('❌ Usage: !fb <facebook url>\nExample: !fb https://facebook.com/watch/...');
          return;
        }
        if (!url.includes('facebook.com') && !url.includes('fb.watch')) {
          await ctx.reply('❌ Please provide a valid Facebook URL.');
          return;
        }
        await ctx.react('📘');
        const note = await simulateDownload(url, 'video');
        await ctx.reply(`📘 *Facebook Video Download*\n\nURL: ${url}\n\n⏳ Downloading...\n\n${note}`);
      },
    },
    {
      name: 'twitter',
      description: 'Download Twitter/X video',
      category: 'download',
      aliases: ['tw', 'twdl', 'xvideo'],
      cooldown: 15,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const url = ctx.args[0];
        if (!url || !isValidUrl(url)) {
          await ctx.reply('❌ Usage: !twitter <twitter url>\nExample: !twitter https://twitter.com/user/status/...');
          return;
        }
        if (!url.includes('twitter.com') && !url.includes('x.com')) {
          await ctx.reply('❌ Please provide a valid Twitter/X URL.');
          return;
        }
        await ctx.react('🐦');
        const note = await simulateDownload(url, 'video');
        await ctx.reply(`🐦 *Twitter/X Video Download*\n\nURL: ${url}\n\n⏳ Downloading...\n\n${note}`);
      },
    },
    {
      name: 'media',
      description: 'Generic media download from any supported URL',
      category: 'download',
      aliases: ['dl', 'download'],
      cooldown: 15,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const url = ctx.args[0];
        if (!url || !isValidUrl(url)) {
          await ctx.reply(
            '❌ Usage: !media <url>\n\nSupported platforms:\n' +
            '• YouTube • Instagram • TikTok\n• Facebook • Twitter/X\n\nExample: !media https://youtube.com/watch?v=...'
          );
          return;
        }
        const platform = getPlatform(url);
        await ctx.react('⬇️');
        const note = await simulateDownload(url, 'media');
        await ctx.reply(`⬇️ *Media Download*\n\nPlatform: ${platform}\nURL: ${url}\n\n⏳ Downloading...\n\n${note}`);
      },
    },
  ],
};

export default downloadPlugin;
