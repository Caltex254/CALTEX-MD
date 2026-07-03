// ============================================================================
// CALTEX MD WhatsApp Bot - Plugin Manager Plugin
// Owner-only plugin lifecycle management: install, remove, enable, reload
// ============================================================================

import type { Plugin, CommandContext } from '../plugin-loader';
import { db } from '@/lib/db';

const pluginManagerPlugin: Plugin = {
  name: 'plugin-manager',
  version: '1.0.0',
  description: 'Plugin lifecycle management: install, remove, enable, disable, reload',
  author: 'CALTEX MD',
  enabled: true,
  commands: [
    {
      name: 'plugins',
      description: 'List all plugins with their status',
      category: 'owner',
      aliases: ['listplugins', 'pluginlist'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isOwner) {
          await ctx.reply('⛔ Owner only command.');
          return;
        }
        try {
          const { CommandRegistry } = await import('../plugin-loader');
          const registry = CommandRegistry.getInstance();
          const plugins = registry.getAllPlugins();
          const dbPlugins = await db.plugin.findMany();
          if (plugins.length === 0) {
            await ctx.reply('🔌 No plugins loaded.');
            return;
          }
          let text = `🔌 *Plugins (${plugins.length})*\n` + '━'.repeat(24) + '\n\n';
          for (const p of plugins) {
            const status = p.enabled ? '🟢' : '🔴';
            const cmdCount = p.commands.length;
            const dbPlugin = dbPlugins.find(dp => dp.name === p.name);
            const dbStatus = dbPlugin ? (dbPlugin.isEnabled ? '' : ' ⚠️DB:OFF') : '';
            text += `${status} *${p.name}* v${p.version}${dbStatus}\n`;
            text += `   📝 ${p.description?.substring(0, 40) || 'No description'}\n`;
            text += `   📝 ${cmdCount} cmd(s) | 👤 ${p.author}\n\n`;
          }
          text += '💡 .plugininfo <name> for details';
          await ctx.reply(text);
        } catch (error) {
          console.error('[Plugins] Error:', error);
          await ctx.reply('❌ Failed to list plugins.');
        }
      },
    },
    {
      name: 'plugininfo',
      description: 'Show detailed information about a plugin',
      category: 'owner',
      aliases: ['plugindetail', 'pinfo'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isOwner) {
          await ctx.reply('⛔ Owner only command.');
          return;
        }
        const name = ctx.args[0];
        if (!name) {
          await ctx.reply('❌ Usage: .plugininfo <name>');
          return;
        }
        try {
          const { CommandRegistry } = await import('../plugin-loader');
          const registry = CommandRegistry.getInstance();
          const plugin = registry.getPlugin(name);
          if (!plugin) {
            await ctx.reply(`❌ Plugin "${name}" not found.`);
            return;
          }
          let text =
            `🔌 *Plugin Info*\n` + '━'.repeat(22) + '\n\n' +
            `🏷️ Name: *${plugin.name}*\n` +
            `📦 Version: v${plugin.version}\n` +
            `👤 Author: ${plugin.author}\n` +
            `📝 Description: ${plugin.description}\n` +
            `📊 Status: ${plugin.enabled ? '🟢 Enabled' : '🔴 Disabled'}\n` +
            `📂 Path: ${plugin.filePath || 'N/A'}\n\n`;
          if (plugin.commands.length > 0) {
            text += `📝 *Commands (${plugin.commands.length}):*\n`;
            for (const cmd of plugin.commands) {
              const premium = cmd.isPremiumOnly ? ' 👑' : '';
              text += `  .${cmd.name}${premium} - ${cmd.description}\n`;
            }
          }
          await ctx.reply(text);
        } catch (error) {
          console.error('[PluginInfo] Error:', error);
          await ctx.reply('❌ Failed to get plugin info.');
        }
      },
    },
    {
      name: 'enableplugin',
      description: 'Enable a plugin by name',
      category: 'owner',
      aliases: ['pluginenable'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isOwner) {
          await ctx.reply('⛔ Owner only command.');
          return;
        }
        const name = ctx.args[0];
        if (!name) {
          await ctx.reply('❌ Usage: .enableplugin <name>');
          return;
        }
        try {
          const { enablePlugin } = await import('../plugin-loader');
          const success = enablePlugin(name);
          if (success) {
            await db.plugin.upsert({
              where: { name },
              update: { isEnabled: true },
              create: { name, isEnabled: true },
            });
            await ctx.reply(`🟢 Plugin *"${name}"* enabled!`);
          } else {
            await ctx.reply(`❌ Plugin "${name}" not found.`);
          }
        } catch (error) {
          console.error('[EnablePlugin] Error:', error);
          await ctx.reply('❌ Failed to enable plugin.');
        }
      },
    },
    {
      name: 'disableplugin',
      description: 'Disable a plugin by name',
      category: 'owner',
      aliases: ['plugindisable'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isOwner) {
          await ctx.reply('⛔ Owner only command.');
          return;
        }
        const name = ctx.args[0];
        if (!name) {
          await ctx.reply('❌ Usage: .disableplugin <name>');
          return;
        }
        if (name === 'plugin-manager') {
          await ctx.reply('⚠️ Cannot disable the plugin manager!');
          return;
        }
        try {
          const { disablePlugin } = await import('../plugin-loader');
          const success = disablePlugin(name);
          if (success) {
            await db.plugin.upsert({
              where: { name },
              update: { isEnabled: false },
              create: { name, isEnabled: false },
            });
            await ctx.reply(`🔴 Plugin *"${name}"* disabled!`);
          } else {
            await ctx.reply(`❌ Plugin "${name}" not found.`);
          }
        } catch (error) {
          console.error('[DisablePlugin] Error:', error);
          await ctx.reply('❌ Failed to disable plugin.');
        }
      },
    },
    {
      name: 'reloadplugin',
      description: 'Hot reload a plugin by name',
      category: 'owner',
      aliases: ['pluginreload'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isOwner) {
          await ctx.reply('⛔ Owner only command.');
          return;
        }
        const name = ctx.args[0];
        if (!name) {
          await ctx.reply('❌ Usage: .reloadplugin <name>');
          return;
        }
        await ctx.react('🔄');
        try {
          const { reloadPlugin } = await import('../plugin-loader');
          const success = await reloadPlugin(name);
          if (success) {
            await ctx.reply(`🔄 Plugin *"${name}"* reloaded!`);
          } else {
            await ctx.reply(`❌ Failed to reload plugin "${name}". It may not exist or has no file path.`);
          }
        } catch (error) {
          console.error('[ReloadPlugin] Error:', error);
          await ctx.reply('❌ Failed to reload plugin.');
        }
      },
    },
    {
      name: 'reloadall',
      description: 'Reload all plugins',
      category: 'owner',
      aliases: ['reloadplugins'],
      cooldown: 30,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isOwner) {
          await ctx.reply('⛔ Owner only command.');
          return;
        }
        await ctx.react('🔄');
        try {
          const { CommandRegistry, loadPlugins } = await import('../plugin-loader');
          const registry = CommandRegistry.getInstance();
          registry.reset();
          await loadPlugins();
          const stats = registry.getStats();
          await ctx.reply(
            `🔄 *All Plugins Reloaded!*\n\n` +
            `🔌 Plugins: ${stats.totalPlugins}\n` +
            `✅ Enabled: ${stats.enabledPlugins}\n` +
            `📝 Commands: ${stats.totalCommands}\n` +
            `📂 Categories: ${stats.categories}`
          );
        } catch (error) {
          console.error('[ReloadAll] Error:', error);
          await ctx.reply('❌ Failed to reload all plugins.');
        }
      },
    },
    {
      name: 'installplugin',
      description: 'Install a plugin from a file path',
      category: 'owner',
      aliases: ['plugininstall', 'addplugin'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isOwner) {
          await ctx.reply('⛔ Owner only command.');
          return;
        }
        const pluginPath = ctx.args[0];
        if (!pluginPath) {
          await ctx.reply('❌ Usage: .installplugin <path>\nExample: .installplugin ./custom-plugins/my-plugin.ts');
          return;
        }
        await ctx.react('📥');
        try {
          const loadedModule = await import(pluginPath);
          const plugin: Plugin = loadedModule.default || loadedModule.plugin;
          if (!plugin || !plugin.name || !Array.isArray(plugin.commands)) {
            await ctx.reply('❌ Invalid plugin format. Must export a Plugin object.');
            return;
          }
          const { CommandRegistry } = await import('../plugin-loader');
          const registry = CommandRegistry.getInstance();
          plugin.filePath = pluginPath;
          registry.registerPlugin(plugin);
          await db.plugin.upsert({
            where: { name: plugin.name },
            update: { version: plugin.version, description: plugin.description, author: plugin.author, filePath: pluginPath, isEnabled: true },
            create: { name: plugin.name, version: plugin.version, description: plugin.description, author: plugin.author, filePath: pluginPath, isEnabled: true },
          });
          await ctx.reply(
            `✅ *Plugin Installed!*\n\n` +
            `🏷️ Name: ${plugin.name}\n` +
            `📦 Version: v${plugin.version}\n` +
            `📝 Commands: ${plugin.commands.length}`
          );
        } catch (error) {
          console.error('[InstallPlugin] Error:', error);
          await ctx.reply('❌ Failed to install plugin. Check the path and format.');
        }
      },
    },
    {
      name: 'removeplugin',
      description: 'Remove a plugin from the registry',
      category: 'owner',
      aliases: ['pluginremove', 'deleteplugin'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        if (!ctx.isOwner) {
          await ctx.reply('⛔ Owner only command.');
          return;
        }
        const name = ctx.args[0];
        if (!name) {
          await ctx.reply('❌ Usage: .removeplugin <name>');
          return;
        }
        if (name === 'plugin-manager') {
          await ctx.reply('⚠️ Cannot remove the plugin manager!');
          return;
        }
        try {
          const { unloadPlugin } = await import('../plugin-loader');
          const success = unloadPlugin(name);
          if (success) {
            await db.plugin.updateMany({ where: { name }, data: { isEnabled: false } });
            await ctx.reply(`🗑️ Plugin *"${name}"* removed!`);
          } else {
            await ctx.reply(`❌ Plugin "${name}" not found.`);
          }
        } catch (error) {
          console.error('[RemovePlugin] Error:', error);
          await ctx.reply('❌ Failed to remove plugin.');
        }
      },
    },
  ],
};

export default pluginManagerPlugin;
