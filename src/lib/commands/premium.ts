// ============================================================================
// CALTEX MD WhatsApp Bot - Premium Management Plugin
// Premium user management with plans, durations, and auto-expiry
// ============================================================================

import type { Plugin, CommandContext } from '../plugin-loader';
import { db } from '@/lib/db';

function parseDuration(duration: string): Date | null {
  const match = duration.match(/^(\d+)(d|m|y)$/i);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const now = new Date();
  switch (unit) {
    case 'd': now.setDate(now.getDate() + num); break;
    case 'm': now.setMonth(now.getMonth() + num); break;
    case 'y': now.setFullYear(now.getFullYear() + num); break;
  }
  return now;
}

function formatExpiry(date: Date): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const premiumPlugin: Plugin = {
  name: 'premium',
  version: '1.0.0',
  description: 'Premium user management with plan tiers and duration support',
  author: 'CALTEX MD',
  enabled: true,
  commands: [
    {
      name: 'premium',
      description: 'Check your premium status',
      category: 'premium',
      aliases: ['mystatus', 'premiumstatus'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        try {
          const premium = await db.premiumUser.findUnique({ where: { userJid: ctx.sender } });
          if (!premium || !premium.isActive) {
            await ctx.reply(
              '👤 *Premium Status*\n\n' +
              '❌ You are not a premium member.\n\n' +
              '💡 Contact the bot owner to upgrade!'
            );
            return;
          }
          const now = new Date();
          const isExpired = premium.expiryDate < now;
          if (isExpired) {
            await db.premiumUser.update({ where: { userJid: ctx.sender }, data: { isActive: false } });
            await ctx.reply('⚠️ Your premium has expired. Contact the owner to renew.');
            return;
          }
          const daysLeft = Math.ceil((premium.expiryDate.getTime() - now.getTime()) / 86400000);
          const text =
            `👑 *Premium Status*\n` + '━'.repeat(20) + '\n\n' +
            `📋 Plan: *${premium.plan.toUpperCase()}*\n` +
            `📅 Started: ${formatExpiry(premium.startDate)}\n` +
            `⏰ Expires: ${formatExpiry(premium.expiryDate)}\n` +
            `⏳ Days Left: *${daysLeft}*\n` +
            `🔄 Auto-Renew: ${premium.autoRenew ? '✅' : '❌'}`;
          await ctx.reply(text);
        } catch (error) {
          console.error('[Premium] Error:', error);
          await ctx.reply('❌ Failed to check premium status.');
        }
      },
    },
    {
      name: 'addpremium',
      description: 'Grant premium to a user (owner only)',
      category: 'owner',
      aliases: ['grantpremium', 'setpremium'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isOwner) {
          await ctx.reply('⛔ Owner only command.');
          return;
        }
        const user = ctx.args[0]?.replace('@', '');
        const plan = ctx.args[1]?.toLowerCase();
        const duration = ctx.args[2]?.toLowerCase();
        if (!user || !plan || !duration) {
          await ctx.reply('❌ Usage: !addpremium @user <plan> <duration>\n\n📋 Plans: basic, pro, enterprise\n⏱️ Duration: 1d, 7d, 30d, 1y\n\nExample: !addpremium @6281234567890 pro 30d');
          return;
        }
        const validPlans = ['basic', 'pro', 'enterprise'];
        if (!validPlans.includes(plan)) {
          await ctx.reply(`❌ Invalid plan. Choose: ${validPlans.join(', ')}`);
          return;
        }
        const expiryDate = parseDuration(duration);
        if (!expiryDate) {
          await ctx.reply('❌ Invalid duration format. Use: 1d, 7d, 30d, 1y');
          return;
        }
        const targetJid = user + '@s.whatsapp.net';
        try {
          const existing = await db.premiumUser.findUnique({ where: { userJid: targetJid } });
          if (existing && existing.isActive) {
            const newExpiry = new Date(Math.max(existing.expiryDate.getTime(), Date.now()) + (expiryDate.getTime() - Date.now()));
            await db.premiumUser.update({
              where: { userJid: targetJid },
              data: { plan, expiryDate: newExpiry, isActive: true, grantedBy: ctx.sender },
            });
            await ctx.reply(`✅ Premium extended for @${user}\n📋 Plan: ${plan}\n⏰ New Expiry: ${formatExpiry(newExpiry)}`);
          } else {
            await db.premiumUser.upsert({
              where: { userJid: targetJid },
              update: { plan, expiryDate, isActive: true, grantedBy: ctx.sender, startDate: new Date() },
              create: { userJid: targetJid, plan, expiryDate, grantedBy: ctx.sender },
            });
            await ctx.reply(`👑 Premium granted to @${user}\n📋 Plan: ${plan}\n⏰ Expires: ${formatExpiry(expiryDate)}`);
          }
        } catch (error) {
          console.error('[AddPremium] Error:', error);
          await ctx.reply('❌ Failed to grant premium.');
        }
      },
    },
    {
      name: 'delpremium',
      description: 'Remove premium from a user (owner only)',
      category: 'owner',
      aliases: ['removepremium', 'revokepremium'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isOwner) {
          await ctx.reply('⛔ Owner only command.');
          return;
        }
        const user = ctx.args[0]?.replace('@', '');
        if (!user) {
          await ctx.reply('❌ Usage: !delpremium @user\nExample: !delpremium @6281234567890');
          return;
        }
        const targetJid = user + '@s.whatsapp.net';
        try {
          const premium = await db.premiumUser.findUnique({ where: { userJid: targetJid } });
          if (!premium || !premium.isActive) {
            await ctx.reply(`⚠️ User @${user} is not a premium member.`);
            return;
          }
          await db.premiumUser.update({ where: { userJid: targetJid }, data: { isActive: false } });
          await ctx.reply(`✅ Premium removed from @${user}`);
        } catch (error) {
          console.error('[DelPremium] Error:', error);
          await ctx.reply('❌ Failed to remove premium.');
        }
      },
    },
    {
      name: 'premiumlist',
      description: 'List all premium users (owner only)',
      category: 'owner',
      aliases: ['listpremium', 'premiumusers'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isOwner) {
          await ctx.reply('⛔ Owner only command.');
          return;
        }
        try {
          const users = await db.premiumUser.findMany({ where: { isActive: true }, orderBy: { expiryDate: 'asc' } });
          if (users.length === 0) {
            await ctx.reply('📋 No active premium users found.');
            return;
          }
          let text = `👑 *Premium Users (${users.length})*\n` + '━'.repeat(22) + '\n\n';
          for (const u of users) {
            const daysLeft = Math.ceil((u.expiryDate.getTime() - Date.now()) / 86400000);
            const status = daysLeft <= 0 ? '🔴 Expired' : daysLeft <= 7 ? '🟡 Expiring' : '🟢 Active';
            text += `👤 ${u.userJid.split('@')[0]}\n`;
            text += `   📋 ${u.plan.toUpperCase()} | ${status} | ${daysLeft > 0 ? daysLeft + 'd left' : 'expired'}\n\n`;
          }
          await ctx.reply(text);
        } catch (error) {
          console.error('[PremiumList] Error:', error);
          await ctx.reply('❌ Failed to list premium users.');
        }
      },
    },
  ],
};

export default premiumPlugin;
