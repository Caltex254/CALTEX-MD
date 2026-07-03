// ============================================================================
// CALTEX MD WhatsApp Bot - Notes System Plugin
// Create, retrieve, delete, and list personal notes
// ============================================================================

import type { Plugin, CommandContext } from '../plugin-loader';
import { db } from '@/lib/db';

const notesPlugin: Plugin = {
  name: 'notes',
  version: '1.0.0',
  description: 'Personal notes system for storing and retrieving information',
  author: 'CALTEX MD',
  enabled: true,
  commands: [
    {
      name: 'note',
      description: 'Manage notes: add, get, delete (e.g., !note add title|content)',
      category: 'tools',
      aliases: ['notesmanage', 'mynote'],
      cooldown: 3,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const subcommand = ctx.args[0]?.toLowerCase();
        if (!subcommand || !['add', 'get', 'delete', 'del'].includes(subcommand)) {
          await ctx.reply(
            '❌ Usage:\n\n' +
            '📝 !note add <title>|<content>\n' +
            '📖 !note get <title>\n' +
            '🗑️ !note delete <title>\n\n' +
            '📋 Use !notes to list all your notes'
          );
          return;
        }
        try {
          if (subcommand === 'add') {
            const input = ctx.args.slice(1).join(' ');
            const separatorIndex = input.indexOf('|');
            if (separatorIndex === -1) {
              await ctx.reply('❌ Usage: !note add <title>|<content>\nExample: !note add Server Info|IP: 192.168.1.1');
              return;
            }
            const title = input.substring(0, separatorIndex).trim();
            const content = input.substring(separatorIndex + 1).trim();
            if (!title || !content) {
              await ctx.reply('❌ Both title and content are required.');
              return;
            }
            const existing = await db.note.findFirst({ where: { userJid: ctx.sender, title } });
            if (existing) {
              await db.note.update({ where: { id: existing.id }, data: { content } });
              await ctx.reply(`✏️ Note *"${title}"* updated!`);
              return;
            }
            await db.note.create({ data: { userJid: ctx.sender, title, content } });
            await ctx.reply(`✅ Note *"${title}"* saved!`);
          } else if (subcommand === 'get') {
            const title = ctx.args.slice(1).join(' ').trim();
            if (!title) {
              await ctx.reply('❌ Usage: !note get <title>');
              return;
            }
            const note = await db.note.findFirst({ where: { userJid: ctx.sender, title } });
            if (!note) {
              await ctx.reply(`❌ Note *"${title}"* not found.`);
              return;
            }
            await ctx.reply(
              `📖 *${note.title}*\n` + '━'.repeat(20) + '\n\n' +
              `${note.content}\n\n` +
              `📅 Created: ${note.createdAt.toLocaleDateString()}\n` +
              `🔄 Updated: ${note.updatedAt.toLocaleDateString()}`
            );
          } else if (subcommand === 'delete' || subcommand === 'del') {
            const title = ctx.args.slice(1).join(' ').trim();
            if (!title) {
              await ctx.reply('❌ Usage: !note delete <title>');
              return;
            }
            const note = await db.note.findFirst({ where: { userJid: ctx.sender, title } });
            if (!note) {
              await ctx.reply(`❌ Note *"${title}"* not found.`);
              return;
            }
            await db.note.delete({ where: { id: note.id } });
            await ctx.reply(`🗑️ Note *"${title}"* deleted!`);
          }
        } catch (error) {
          console.error('[Note] Error:', error);
          await ctx.reply('❌ Failed to manage note.');
        }
      },
    },
    {
      name: 'notes',
      description: 'List all your saved notes',
      category: 'tools',
      aliases: ['listnotes', 'mynotes'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        try {
          const notes = await db.note.findMany({
            where: { userJid: ctx.sender },
            orderBy: { updatedAt: 'desc' },
          });
          if (notes.length === 0) {
            await ctx.reply('📋 You have no saved notes.\n\n💡 Use !note add <title>|<content> to create one.');
            return;
          }
          let text = `📝 *Your Notes (${notes.length})*\n` + '━'.repeat(22) + '\n\n';
          for (const n of notes) {
            const preview = n.content.length > 35 ? n.content.substring(0, 35) + '...' : n.content;
            text += `📌 *${n.title}*\n`;
            text += `   ${preview}\n`;
            text += `   📅 ${n.updatedAt.toLocaleDateString()}\n\n`;
          }
          text += '💡 Use !note get <title> to read a note';
          await ctx.reply(text);
        } catch (error) {
          console.error('[Notes] Error:', error);
          await ctx.reply('❌ Failed to list notes.');
        }
      },
    },
  ],
};

export default notesPlugin;
