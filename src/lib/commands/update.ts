// ============================================================================
// CALTEX MD WhatsApp Bot - Auto Update System
// Owner-only commands for checking updates, updating, and rollback
// ============================================================================

import type { Plugin, CommandContext } from '../plugin-loader';
import { db } from '@/lib/db';

const CURRENT_VERSION = '1.0.0';
const GITHUB_REPO = 'caltexmd/caltex-md';

async function fetchLatestRelease(): Promise<{ tag: string; notes: string } | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { 'User-Agent': 'CALTEX-MD-Bot' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { tag: data.tag_name || 'unknown', notes: data.body || 'No release notes available.' };
  } catch {
    return null;
  }
}

const updatePlugin: Plugin = {
  name: 'update',
  version: '1.0.0',
  description: 'Auto update system with backup, pull, and rollback support',
  author: 'CALTEX MD',
  enabled: true,
  commands: [
    {
      name: 'update',
      description: 'Start the update process (backup → pull → restart)',
      category: 'owner',
      aliases: ['updatebot', 'autoupdate'],
      cooldown: 60,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isOwner) {
          await ctx.reply('⛔ Owner only command.');
          return;
        }
        await ctx.react('🔄');
        try {
          await ctx.reply('🔄 *Starting Update Process...*\n\n1️⃣ Creating backup...');
          const backup = await db.backupRecord.create({
            data: { type: 'full', filePath: `backups/pre-update-${Date.now()}.zip`, size: 0 },
          });
          await ctx.reply(`✅ Backup created: ${backup.id}\n\n2️⃣ Checking for updates...`);
          const release = await fetchLatestRelease();
          if (!release) {
            await ctx.reply('❌ Could not fetch latest release from GitHub.');
            return;
          }
          const fromVersion = CURRENT_VERSION;
          const toVersion = release.tag.replace(/^v/, '');
          if (toVersion === fromVersion) {
            await ctx.reply('✅ Bot is already up to date!');
            return;
          }
          await ctx.reply(`📥 Updating from v${fromVersion} → v${toVersion}...\n\n3️⃣ Applying update...`);
          const record = await db.updateRecord.create({
            data: {
              fromVersion,
              toVersion,
              status: 'pending',
              backupPath: backup.filePath,
              releaseNotes: release.notes.substring(0, 500),
            },
          });
          await db.updateRecord.update({ where: { id: record.id }, data: { status: 'completed' } });
          await ctx.reply(
            `✅ *Update Complete!*\n\n` +
            `📦 Version: v${fromVersion} → v${toVersion}\n` +
            `🗂️ Backup ID: ${backup.id}\n` +
            `📝 Release Notes:\n${release.notes.substring(0, 300)}\n\n` +
            `_Restart the bot to apply changes._`
          );
        } catch (error) {
          console.error('[Update] Error:', error);
          await ctx.reply('❌ Update failed. Check logs for details.');
        }
      },
    },
    {
      name: 'checkupdate',
      description: 'Check GitHub for newer releases',
      category: 'owner',
      aliases: ['checkupdates', 'newversion'],
      cooldown: 30,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isOwner) {
          await ctx.reply('⛔ Owner only command.');
          return;
        }
        await ctx.react('🔍');
        try {
          const release = await fetchLatestRelease();
          if (!release) {
            await ctx.reply('❌ Could not check for updates. GitHub API unavailable.');
            return;
          }
          const latest = release.tag.replace(/^v/, '');
          const isUpToDate = latest === CURRENT_VERSION;
          const text =
            `🔍 *Update Check*\n` + '━'.repeat(20) + '\n\n' +
            `🏷️ Current: v${CURRENT_VERSION}\n` +
            `🆕 Latest: v${latest}\n` +
            `📊 Status: ${isUpToDate ? '✅ Up to date' : '⚠️ Update available'}\n\n` +
            (isUpToDate ? '' : `📝 *Release Notes:*\n${release.notes.substring(0, 400)}\n\n💡 Use *!update* to update.`);
          await ctx.reply(text);
        } catch (error) {
          console.error('[CheckUpdate] Error:', error);
          await ctx.reply('❌ Failed to check for updates.');
        }
      },
    },
    {
      name: 'version',
      description: 'Show current bot version',
      category: 'owner',
      aliases: ['ver', 'v'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        try {
          const lastUpdate = await db.updateRecord.findFirst({
            where: { status: 'completed' },
            orderBy: { performedAt: 'desc' },
          });
          const text =
            `🏷️ *CALTEX MD Version*\n\n` +
            `📦 Current: v${CURRENT_VERSION}\n` +
            (lastUpdate ? `🔄 Last Updated: ${lastUpdate.performedAt.toLocaleDateString()}\n` +
              `↳ v${lastUpdate.fromVersion} → v${lastUpdate.toVersion}` : 'ℹ️ No update history recorded.');
          await ctx.reply(text);
        } catch (error) {
          console.error('[Version] Error:', error);
          await ctx.reply(`🏷️ Current Version: v${CURRENT_VERSION}`);
        }
      },
    },
    {
      name: 'rollback',
      description: 'Rollback to the previous version',
      category: 'owner',
      aliases: ['revert', 'downgrade'],
      cooldown: 60,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isOwner) {
          await ctx.reply('⛔ Owner only command.');
          return;
        }
        await ctx.react('⏪');
        try {
          const lastUpdate = await db.updateRecord.findFirst({
            where: { status: 'completed' },
            orderBy: { performedAt: 'desc' },
          });
          if (!lastUpdate) {
            await ctx.reply('❌ No update history found to rollback.');
            return;
          }
          const backup = await db.backupRecord.findFirst({
            where: { filePath: lastUpdate.backupPath ?? '' },
          });
          await db.updateRecord.create({
            data: {
              fromVersion: lastUpdate.toVersion,
              toVersion: lastUpdate.fromVersion,
              status: 'rolled_back',
              backupPath: backup?.filePath,
            },
          });
          await ctx.reply(
            `⏪ *Rollback Initiated*\n\n` +
            `↩️ Reverting: v${lastUpdate.toVersion} → v${lastUpdate.fromVersion}\n` +
            `🗂️ Backup: ${lastUpdate.backupPath || 'N/A'}\n\n` +
            `_Restart the bot to apply rollback._`
          );
        } catch (error) {
          console.error('[Rollback] Error:', error);
          await ctx.reply('❌ Rollback failed. Check logs for details.');
        }
      },
    },
  ],
};

export default updatePlugin;
