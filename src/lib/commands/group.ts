// ============================================================================
// CALTEX MD WhatsApp Bot - Group Management Commands
// Group info, admin management, member management, and group settings
// ============================================================================

import type { Plugin, CommandContext } from '../plugin-loader';

const groupPlugin: Plugin = {
  name: 'group',
  version: '1.0.0',
  description: 'Group management commands for admins and members',
  author: 'CALTEX MD',
  enabled: true,
  commands: [
    {
      name: 'groupinfo',
      description: 'Show detailed group information',
      category: 'group',
      aliases: ['gi', 'ginfo'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isGroup) {
          await ctx.reply('❌ This command can only be used in groups.');
          return;
        }
        await ctx.react('📋');
        // In production, fetch from sock.groupMetadata
        const text =
          '📋 *GROUP INFO*\n\n' +
          '📌 Name: _Loading..._\n' +
          '📝 Description: _Loading..._\n' +
          '👤 Owner: _Loading..._\n' +
          '👥 Members: _Loading..._\n' +
          '🛡️ Admins: _Loading..._\n' +
          '🔒 Locked: _Loading..._\n' +
          '📅 Created: _Loading..._\n\n' +
          '_In production, this fetches live data from WhatsApp via sock.groupMetadata()._';
        await ctx.reply(text);
      },
    },
    {
      name: 'promote',
      description: 'Promote a member to admin',
      category: 'group',
      aliases: ['pm', 'makeadmin'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isGroup) {
          await ctx.reply('❌ This command can only be used in groups.');
          return;
        }
        if (!ctx.isAdmin) {
          await ctx.reply('❌ Only admins can promote members.');
          return;
        }
        const target = ctx.args[0];
        if (!target) {
          await ctx.reply('❌ Usage: !promote @user\nExample: !promote @6281234567890');
          return;
        }
        await ctx.react('⬆️');
        await ctx.reply(`✅ Promoted @${target.replace('@', '')} to admin.\n\n_In production, this calls sock.groupParticipantsUpdate()._`);
      },
    },
    {
      name: 'demote',
      description: 'Demote an admin to regular member',
      category: 'group',
      aliases: ['dm', 'removeadmin'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isGroup) {
          await ctx.reply('❌ This command can only be used in groups.');
          return;
        }
        if (!ctx.isAdmin) {
          await ctx.reply('❌ Only admins can demote members.');
          return;
        }
        const target = ctx.args[0];
        if (!target) {
          await ctx.reply('❌ Usage: !demote @user\nExample: !demote @6281234567890');
          return;
        }
        await ctx.react('⬇️');
        await ctx.reply(`✅ Demoted @${target.replace('@', '')} from admin.\n\n_In production, this calls sock.groupParticipantsUpdate()._`);
      },
    },
    {
      name: 'add',
      description: 'Add a user to the group',
      category: 'group',
      aliases: ['invite'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isGroup) {
          await ctx.reply('❌ This command can only be used in groups.');
          return;
        }
        if (!ctx.isAdmin) {
          await ctx.reply('❌ Only admins can add members.');
          return;
        }
        const target = ctx.args[0];
        if (!target) {
          await ctx.reply('❌ Usage: !add @number\nExample: !add 6281234567890');
          return;
        }
        await ctx.react('➕');
        await ctx.reply(`✅ Added @${target.replace('@', '')} to the group.\n\n_In production, this calls sock.groupParticipantsUpdate('add')._`);
      },
    },
    {
      name: 'kick',
      description: 'Remove a user from the group',
      category: 'group',
      aliases: ['remove', 'banish'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isGroup) {
          await ctx.reply('❌ This command can only be used in groups.');
          return;
        }
        if (!ctx.isAdmin) {
          await ctx.reply('❌ Only admins can kick members.');
          return;
        }
        const target = ctx.args[0];
        if (!target) {
          await ctx.reply('❌ Usage: !kick @user\nExample: !kick @6281234567890');
          return;
        }
        await ctx.react('❌');
        await ctx.reply(`✅ Removed @${target.replace('@', '')} from the group.\n\n_In production, this calls sock.groupParticipantsUpdate('remove')._`);
      },
    },
    {
      name: 'mute',
      description: 'Mute the group (only admins can send messages)',
      category: 'group',
      aliases: ['lock', 'silence'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isGroup) {
          await ctx.reply('❌ This command can only be used in groups.');
          return;
        }
        if (!ctx.isAdmin) {
          await ctx.reply('❌ Only admins can mute the group.');
          return;
        }
        const duration = ctx.args[0]; // in minutes
        await ctx.react('🔇');
        const durText = duration ? ` for ${duration} minute(s)` : ' indefinitely';
        await ctx.reply(`🔇 Group muted${durText}.\nOnly admins can send messages now.\n\n_In production, this calls sock.groupSettingUpdate('announcement')._`);
      },
    },
    {
      name: 'unmute',
      description: 'Unmute the group (everyone can send messages)',
      category: 'group',
      aliases: ['unlock', 'unsilence'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isGroup) {
          await ctx.reply('❌ This command can only be used in groups.');
          return;
        }
        if (!ctx.isAdmin) {
          await ctx.reply('❌ Only admins can unmute the group.');
          return;
        }
        await ctx.react('🔊');
        await ctx.reply('🔊 Group unmuted. Everyone can send messages now.\n\n_In production, this calls sock.groupSettingUpdate("not_announcement")._');
      },
    },
    {
      name: 'setname',
      description: 'Change the group name',
      category: 'group',
      aliases: ['groupname', 'changename'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isGroup) {
          await ctx.reply('❌ This command can only be used in groups.');
          return;
        }
        if (!ctx.isAdmin) {
          await ctx.reply('❌ Only admins can change the group name.');
          return;
        }
        const name = ctx.args.join(' ');
        if (!name) {
          await ctx.reply('❌ Usage: !setname <new name>\nExample: !setname My Awesome Group');
          return;
        }
        await ctx.react('✏️');
        await ctx.reply(`✅ Group name changed to: *${name}*\n\n_In production, this calls sock.groupUpdateSubject()._`);
      },
    },
    {
      name: 'setdesc',
      description: 'Change the group description',
      category: 'group',
      aliases: ['groupdesc', 'changedesc'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isGroup) {
          await ctx.reply('❌ This command can only be used in groups.');
          return;
        }
        if (!ctx.isAdmin) {
          await ctx.reply('❌ Only admins can change the group description.');
          return;
        }
        const desc = ctx.args.join(' ');
        if (!desc) {
          await ctx.reply('❌ Usage: !setdesc <new description>\nExample: !setdesc Welcome to our community!');
          return;
        }
        await ctx.react('📝');
        await ctx.reply(`✅ Group description updated.\n\n_In production, this calls sock.groupUpdateDescription()._`);
      },
    },
    {
      name: 'locksettings',
      description: 'Lock group settings (only admins can edit)',
      category: 'group',
      aliases: ['lockgroup', 'lockset'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isGroup || !ctx.isAdmin) {
          await ctx.reply('❌ Admin only command for groups.');
          return;
        }
        await ctx.react('🔒');
        await ctx.reply('🔒 Group settings locked. Only admins can edit group info now.\n\n_In production, this calls sock.groupSettingUpdate("locked")._');
      },
    },
    {
      name: 'unlocksettings',
      description: 'Unlock group settings (everyone can edit)',
      category: 'group',
      aliases: ['unlockgroup', 'unlockset'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isGroup || !ctx.isAdmin) {
          await ctx.reply('❌ Admin only command for groups.');
          return;
        }
        await ctx.react('🔓');
        await ctx.reply('🔓 Group settings unlocked. All members can edit group info now.\n\n_In production, this calls sock.groupSettingUpdate("unlocked")._');
      },
    },
  ],
};

export default groupPlugin;
