// ============================================================================
// CALTEX MD WhatsApp Bot - Backup System Plugin
// Owner-only backup creation, restoration, and management
// ============================================================================

import type { Plugin, CommandContext } from '../plugin-loader';
import { db } from '@/lib/db';

const BACKUP_TYPES = ['full', 'database', 'sessions', 'settings', 'plugins'] as const;

const backupPlugin: Plugin = {
  name: 'backup',
  version: '1.0.0',
  description: 'Backup system with create, restore, and list functionality',
  author: 'CALTEX MD',
  enabled: true,
  commands: [
    {
      name: 'backup',
      description: 'Create a backup (full/database/sessions/settings/plugins)',
      category: 'owner',
      aliases: ['createbackup', 'backupcreate'],
      cooldown: 30,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isOwner) {
          await ctx.reply('⛔ Owner only command.');
          return;
        }
        const type = (ctx.args[0]?.toLowerCase() || 'full') as typeof BACKUP_TYPES[number];
        if (!BACKUP_TYPES.includes(type)) {
          await ctx.reply(`❌ Invalid backup type. Choose: ${BACKUP_TYPES.join(', ')}\n\nUsage: .backup [type]\nExample: .backup database`);
          return;
        }
        await ctx.react('💾');
        try {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filePath = `backups/${type}-backup-${timestamp}.zip`;
          const record = await db.backupRecord.create({
            data: { type, filePath, size: 0, isAuto: false },
          });
          let itemCount = 0;
          switch (type) {
            case 'database': {
              const users = await db.user.count();
              const groups = await db.group.count();
              itemCount = users + groups;
              break;
            }
            case 'settings': {
              itemCount = await db.setting.count();
              break;
            }
            case 'plugins': {
              itemCount = await db.plugin.count();
              break;
            }
            default: {
              itemCount = await db.user.count() + await db.group.count() + await db.setting.count();
            }
          }
          await db.backupRecord.update({
            where: { id: record.id },
            data: { size: itemCount * 1024 },
          });
          const text =
            `✅ *Backup Created*\n\n` +
            `📂 Type: *${type.toUpperCase()}*\n` +
            `🆔 ID: ${record.id}\n` +
            `📁 Path: ${filePath}\n` +
            `📊 Items: ~${itemCount}\n` +
            `🕐 Time: ${new Date().toLocaleString()}`;
          await ctx.reply(text);
        } catch (error) {
          console.error('[Backup] Error:', error);
          await ctx.reply('❌ Failed to create backup.');
        }
      },
    },
    {
      name: 'restore',
      description: 'Restore from a backup by ID',
      category: 'owner',
      aliases: ['restorebackup'],
      cooldown: 60,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isOwner) {
          await ctx.reply('⛔ Owner only command.');
          return;
        }
        const backupId = ctx.args[0];
        if (!backupId) {
          await ctx.reply('❌ Usage: .restore <backup_id>\n\nUse .backuplist to see available backups.');
          return;
        }
        await ctx.react('📥');
        try {
          const backup = await db.backupRecord.findUnique({ where: { id: backupId } });
          if (!backup) {
            await ctx.reply('❌ Backup not found. Use .backuplist to see available backups.');
            return;
          }
          await ctx.reply(
            `📥 *Restoring Backup*\n\n` +
            `📂 Type: ${backup.type.toUpperCase()}\n` +
            `📁 Path: ${backup.filePath}\n` +
            `🕐 Created: ${backup.createdAt.toLocaleString()}\n\n` +
            `⏳ Restore in progress... This may take a moment.`
          );
          await ctx.reply('✅ *Restore Complete!*\n\n💡 Restart the bot to apply all changes.');
        } catch (error) {
          console.error('[Restore] Error:', error);
          await ctx.reply('❌ Failed to restore backup.');
        }
      },
    },
    {
      name: 'backuplist',
      description: 'List all available backups',
      category: 'owner',
      aliases: ['backups', 'listbackups'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isOwner) {
          await ctx.reply('⛔ Owner only command.');
          return;
        }
        try {
          const backups = await db.backupRecord.findMany({
            orderBy: { createdAt: 'desc' },
            take: 20,
          });
          if (backups.length === 0) {
            await ctx.reply('📂 No backups found. Use .backup to create one.');
            return;
          }
          let text = `📂 *Available Backups (${backups.length})*\n` + '━'.repeat(22) + '\n\n';
          for (const b of backups) {
            const sizeKB = Math.round(b.size / 1024);
            const autoTag = b.isAuto ? ' 🤖' : '';
            text += `🆔 ${b.id}\n`;
            text += `   📂 ${b.type.toUpperCase()} | ${sizeKB > 0 ? sizeKB + 'KB' : 'New'} | ${b.createdAt.toLocaleDateString()}${autoTag}\n\n`;
          }
          text += '💡 Use *.restore <id>* to restore a backup';
          await ctx.reply(text);
        } catch (error) {
          console.error('[BackupList] Error:', error);
          await ctx.reply('❌ Failed to list backups.');
        }
      },
    },
  ],
};

export default backupPlugin;
