// ============================================================================
// CALTEX MD WhatsApp Bot - Tools Commands
// Translation, weather, calculator, URL shortener, QR codes, TTS,
// screenshots, dictionary, BIN lookup, WHOIS, IP geolocation
// ============================================================================

import type { Plugin, CommandContext } from '../plugin-loader';

// ---------------------------------------------------------------------------
// Helper: Safe math evaluation (no eval for security)
// ---------------------------------------------------------------------------

function safeCalc(expression: string): { result?: number; error?: string } {
  // Only allow digits, operators, parentheses, dots, and spaces
  const sanitized = expression.replace(/\s/g, '');
  if (!/^[0-9+\-*/().%^]+$/.test(sanitized)) {
    return { error: 'Invalid expression. Only numbers and + - * / ( ) ^ % are allowed.' };
  }

  try {
    // Convert ^ to ** for exponentiation
    const expr = sanitized.replace(/\^/g, '**');
    // Use Function constructor with strict sandboxing
    const fn = new Function(`"use strict"; return (${expr})`);
    const result = fn();
    if (typeof result !== 'number' || !isFinite(result)) {
      return { error: 'Calculation resulted in an invalid number.' };
    }
    return { result };
  } catch {
    return { error: 'Could not evaluate the expression. Check your syntax.' };
  }
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

const toolsPlugin: Plugin = {
  name: 'tools',
  version: '1.0.0',
  description: 'Utility tools: translation, weather, calculator, QR, TTS, and more',
  author: 'CALTEX MD',
  enabled: true,
  commands: [
    {
      name: 'translate',
      description: 'Translate text to a target language',
      category: 'tools',
      aliases: ['tr'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const targetLang = ctx.args[0];
        const text = ctx.args.slice(1).join(' ');
        if (!targetLang || !text) {
          await ctx.reply(
            '❌ Usage: .translate <language> <text>\n\nExamples:\n.translate spanish Hello world\n.translate ja Good morning\n\n_In production, uses Google Translate or AI translation API._'
          );
          return;
        }
        await ctx.react('🌍');
        await ctx.reply(
          `🌍 *Translation → ${targetLang}*\n\nOriginal: "${text}"\n\n⏳ Translating...\n\n_In production, this calls the translation API and returns the result._`
        );
      },
    },
    {
      name: 'weather',
      description: 'Get current weather for a city',
      category: 'tools',
      aliases: ['cuaca', 'forecast'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const city = ctx.args.join(' ');
        if (!city) {
          await ctx.reply('❌ Usage: .weather <city>\nExample: .weather Jakarta');
          return;
        }
        await ctx.react('🌤️');
        await ctx.reply(
          `🌤️ *Weather: ${city}*\n\n⏳ Fetching weather data...\n\n_In production, this calls OpenWeatherMap or similar API and returns temperature, humidity, conditions, and forecast._`
        );
      },
    },
    {
      name: 'calc',
      description: 'Calculate a mathematical expression',
      category: 'tools',
      aliases: ['calculate', 'math'],
      cooldown: 3,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const expression = ctx.args.join(' ');
        if (!expression) {
          await ctx.reply('❌ Usage: .calc <expression>\nExample: .calc (2 + 3) * 4');
          return;
        }
        const { result, error } = safeCalc(expression);
        if (error) {
          await ctx.reply(`❌ ${error}`);
          return;
        }
        await ctx.react('🧮');
        await ctx.reply(`🧮 *Calculator*\n\n${expression} = *${result}*`);
      },
    },
    {
      name: 'url',
      description: 'Shorten a URL',
      category: 'tools',
      aliases: ['shorten', 'shorturl', 'tinyurl'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const url = ctx.args[0];
        if (!url) {
          await ctx.reply('❌ Usage: .url <long url>\nExample: .url https://example.com/very/long/path');
          return;
        }
        try {
          new URL(url);
        } catch {
          await ctx.reply('❌ Please provide a valid URL.');
          return;
        }
        await ctx.react('🔗');
        await ctx.reply(
          `🔗 *URL Shortener*\n\nOriginal: ${url}\n\n⏳ Shortening...\n\n_In production, this calls a URL shortening service (is.gd, cleanuri, etc.) and returns the shortened link._`
        );
      },
    },
    {
      name: 'qr',
      description: 'Generate a QR code from text',
      category: 'tools',
      aliases: ['qrcode', 'makeqr'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const text = ctx.args.join(' ');
        if (!text) {
          await ctx.reply('❌ Usage: .qr <text or url>\nExample: .qr https://example.com');
          return;
        }
        await ctx.react('📱');
        await ctx.reply(
          `📱 *QR Code Generator*\n\nContent: "${text}"\n\n⏳ Generating QR code...\n\n_In production, this uses a QR code library (qrcode) to generate and send a QR image._`
        );
      },
    },
    {
      name: 'readqr',
      description: 'Read/decode a QR code from an image',
      category: 'tools',
      aliases: ['decodeqr', 'scanqr'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const quoted = ctx.message?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const hasImage = ctx.message?.message?.imageMessage || quoted?.imageMessage;
        if (!hasImage) {
          await ctx.reply('❌ Please reply to an image containing a QR code.\n\nUsage: Reply to QR image with .readqr');
          return;
        }
        await ctx.react('🔍');
        await ctx.reply(
          '🔍 *QR Code Reader*\n\n⏳ Decoding QR code from image...\n\n_In production, this uses jsQR or similar library to decode the QR code from the image and return the content._'
        );
      },
    },
    {
      name: 'tts',
      description: 'Convert text to speech (voice note)',
      category: 'tools',
      aliases: ['speak', 'voice', 'say'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const text = ctx.args.join(' ');
        if (!text) {
          await ctx.reply('❌ Usage: .tts <text>\nExample: .tts Hello, this is a test');
          return;
        }
        if (text.length > 200) {
          await ctx.reply('❌ Text too long. Maximum 200 characters for TTS.');
          return;
        }
        await ctx.react('🔊');
        await ctx.reply(
          `🔊 *Text to Speech*\n\n"${text}"\n\n⏳ Generating voice note...\n\n_In production, this uses Google TTS or similar API to generate an OGG/Opus voice note and sends it as a PTT message._`
        );
      },
    },
    {
      name: 'ss',
      description: 'Take a screenshot of a URL',
      category: 'tools',
      aliases: ['screenshot', 'capture'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const url = ctx.args[0];
        if (!url) {
          await ctx.reply('❌ Usage: .ss <url>\nExample: .ss https://example.com');
          return;
        }
        try {
          new URL(url);
        } catch {
          await ctx.reply('❌ Please provide a valid URL.');
          return;
        }
        await ctx.react('📸');
        await ctx.reply(
          `📸 *Screenshot*\n\nURL: ${url}\n\n⏳ Capturing screenshot...\n\n_In production, this uses Puppeteer/Playwright to take a screenshot and send the image._`
        );
      },
    },
    {
      name: 'define',
      description: 'Look up a word definition',
      category: 'tools',
      aliases: ['dict', 'dictionary', 'meaning'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const word = ctx.args[0];
        if (!word) {
          await ctx.reply('❌ Usage: .define <word>\nExample: .define serendipity');
          return;
        }
        await ctx.react('📖');
        await ctx.reply(
          `📖 *Definition: ${word}*\n\n⏳ Looking up...\n\n_In production, this calls the Free Dictionary API (dictionaryapi.dev) and returns the definition, phonetics, and part of speech._`
        );
      },
    },
    {
      name: 'bin',
      description: 'Look up credit card BIN information',
      category: 'tools',
      aliases: ['binlookup', 'cardinfo'],
      cooldown: 5,
      isPremiumOnly: true,
      handler: async (ctx: CommandContext) => {
        const bin = ctx.args[0];
        if (!bin || !/^\d{6,8}$/.test(bin)) {
          await ctx.reply('❌ Usage: .bin <6-8 digit number>\nExample: .bin 453201');
          return;
        }
        await ctx.react('💳');
        await ctx.reply(
          `💳 *BIN Lookup: ${bin}*\n\n⏳ Fetching BIN info...\n\n_In production, this calls a BIN lookup API and returns the card type, bank, country, and level information._`
        );
      },
    },
    {
      name: 'whois',
      description: 'Perform a WHOIS lookup on a domain',
      category: 'tools',
      aliases: ['domain', 'whoislookup'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const domain = ctx.args[0];
        if (!domain) {
          await ctx.reply('❌ Usage: .whois <domain>\nExample: .whois example.com');
          return;
        }
        await ctx.react('🌐');
        await ctx.reply(
          `🌐 *WHOIS: ${domain}*\n\n⏳ Looking up domain info...\n\n_In production, this calls a WHOIS API and returns registrar, creation date, expiry, and name server information._`
        );
      },
    },
    {
      name: 'ip',
      description: 'Get geolocation info for an IP address',
      category: 'tools',
      aliases: ['ipinfo', 'geolocate', 'iplookup'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const ip = ctx.args[0];
        if (!ip) {
          await ctx.reply('❌ Usage: .ip <ip address>\nExample: .ip 8.8.8.8');
          return;
        }
        // Basic IP format validation
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (!ipv4Regex.test(ip)) {
          await ctx.reply('❌ Please provide a valid IPv4 address.');
          return;
        }
        await ctx.react('📍');
        await ctx.reply(
          `📍 *IP Geolocation: ${ip}*\n\n⏳ Fetching location data...\n\n_In production, this calls ip-api.com or similar and returns country, region, city, ISP, and coordinates._`
        );
      },
    },
  ],
};

export default toolsPlugin;
