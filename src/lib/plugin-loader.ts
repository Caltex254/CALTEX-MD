// ============================================================================
// CALTEX MD WhatsApp Bot - Plugin Loader System
// Dynamic plugin loading, command registry, and lifecycle management
// ============================================================================

import { readdirSync, statSync, existsSync } from 'fs';
import { join, resolve } from 'path';

// ---------------------------------------------------------------------------
// Core Interfaces
// ---------------------------------------------------------------------------

export interface CommandContext {
  sock: any; // Baileys socket
  message: any; // Baileys message
  jid: string; // Chat JID
  sender: string; // Sender JID
  args: string[]; // Command arguments
  command: string; // Command name
  isGroup: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isPremium: boolean;
  reply: (text: string) => Promise<void>;
  replyMedia: (buffer: Buffer, type: string, caption?: string) => Promise<void>;
  react: (emoji: string) => Promise<void>;
}

export interface Command {
  name: string;
  description: string;
  category: string;
  aliases: string[];
  cooldown: number;
  isPremiumOnly: boolean;
  handler: (ctx: CommandContext) => Promise<void>;
}

export interface Plugin {
  name: string;
  version: string;
  description: string;
  author: string;
  commands: Command[];
  enabled: boolean;
  filePath?: string;
  config?: Record<string, any>;
}

// ---------------------------------------------------------------------------
// Cooldown Tracker
// ---------------------------------------------------------------------------

class CooldownManager {
  private cooldowns: Map<string, Map<string, number>> = new Map();

  isOnCooldown(userId: string, commandName: string, cooldownSeconds: number): boolean {
    const cmdMap = this.cooldowns.get(commandName);
    if (!cmdMap) return false;
    const lastUsed = cmdMap.get(userId);
    if (!lastUsed) return false;
    return Date.now() - lastUsed < cooldownSeconds * 1000;
  }

  getRemainingCooldown(userId: string, commandName: string, cooldownSeconds: number): number {
    const cmdMap = this.cooldowns.get(commandName);
    if (!cmdMap) return 0;
    const lastUsed = cmdMap.get(userId);
    if (!lastUsed) return 0;
    const remaining = cooldownSeconds * 1000 - (Date.now() - lastUsed);
    return Math.max(0, Math.ceil(remaining / 1000));
  }

  setCooldown(userId: string, commandName: string): void {
    if (!this.cooldowns.has(commandName)) {
      this.cooldowns.set(commandName, new Map());
    }
    this.cooldowns.get(commandName)!.set(userId, Date.now());
  }

  clearCooldowns(commandName?: string): void {
    if (commandName) {
      this.cooldowns.delete(commandName);
    } else {
      this.cooldowns.clear();
    }
  }
}

// ---------------------------------------------------------------------------
// Command Registry Singleton
// ---------------------------------------------------------------------------

class CommandRegistry {
  private static instance: CommandRegistry;
  private plugins: Map<string, Plugin> = new Map();
  private commandMap: Map<string, { command: Command; pluginName: string }> = new Map();
  private aliasMap: Map<string, string> = new Map();
  private cooldownManager: CooldownManager = new CooldownManager();

  private constructor() {}

  static getInstance(): CommandRegistry {
    if (!CommandRegistry.instance) {
      CommandRegistry.instance = new CommandRegistry();
    }
    return CommandRegistry.instance;
  }

  // -------------------------------------------------------------------------
  // Plugin Registration
  // -------------------------------------------------------------------------

  registerPlugin(plugin: Plugin): void {
    if (this.plugins.has(plugin.name)) {
      console.warn(`[PluginLoader] Plugin "${plugin.name}" is already registered. Reloading...`);
      this.unregisterPlugin(plugin.name);
    }

    this.plugins.set(plugin.name, plugin);

    for (const cmd of plugin.commands) {
      // Register main command
      if (this.commandMap.has(cmd.name)) {
        console.warn(
          `[PluginLoader] Command "!${cmd.name}" already registered by plugin "${this.commandMap.get(cmd.name)!.pluginName}". Overwriting.`
        );
      }
      this.commandMap.set(cmd.name, { command: cmd, pluginName: plugin.name });

      // Register aliases
      for (const alias of cmd.aliases) {
        if (this.aliasMap.has(alias)) {
          console.warn(
            `[PluginLoader] Alias "${alias}" already mapped to command "${this.aliasMap.get(alias)}". Overwriting.`
          );
        }
        this.aliasMap.set(alias, cmd.name);
      }
    }

    console.log(
      `[PluginLoader] Registered plugin "${plugin.name}" v${plugin.version} with ${plugin.commands.length} command(s)`
    );
  }

  unregisterPlugin(name: string): boolean {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;

    // Remove all commands and aliases belonging to this plugin
    for (const cmd of plugin.commands) {
      this.commandMap.delete(cmd.name);
      for (const alias of cmd.aliases) {
        this.aliasMap.delete(alias);
      }
      this.cooldownManager.clearCooldowns(cmd.name);
    }

    this.plugins.delete(name);
    console.log(`[PluginLoader] Unregistered plugin "${name}"`);
    return true;
  }

  // -------------------------------------------------------------------------
  // Plugin Lifecycle
  // -------------------------------------------------------------------------

  enablePlugin(name: string): boolean {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;
    plugin.enabled = true;
    console.log(`[PluginLoader] Enabled plugin "${name}"`);
    return true;
  }

  disablePlugin(name: string): boolean {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;
    plugin.enabled = false;
    console.log(`[PluginLoader] Disabled plugin "${name}"`);
    return true;
  }

  isPluginEnabled(name: string): boolean {
    const plugin = this.plugins.get(name);
    return plugin?.enabled ?? false;
  }

  // -------------------------------------------------------------------------
  // Command Lookup
  // -------------------------------------------------------------------------

  getCommand(name: string): { command: Command; pluginName: string } | undefined {
    // Direct lookup
    let result = this.commandMap.get(name);
    if (result) return result;

    // Alias lookup
    const aliasTarget = this.aliasMap.get(name);
    if (aliasTarget) {
      result = this.commandMap.get(aliasTarget);
      if (result) return result;
    }

    return undefined;
  }

  getAllCommands(): Command[] {
    const seen = new Set<string>();
    const commands: Command[] = [];
    for (const { command } of this.commandMap.values()) {
      if (!seen.has(command.name)) {
        seen.add(command.name);
        commands.push(command);
      }
    }
    return commands;
  }

  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  getPluginsByCategory(category: string): Plugin[] {
    return Array.from(this.plugins.values()).filter((p) =>
      p.commands.some((c) => c.category === category)
    );
  }

  getCommandsByCategory(category: string): Command[] {
    return this.getAllCommands().filter((c) => c.category === category);
  }

  getCategories(): string[] {
    const categories = new Set<string>();
    for (const { command } of this.commandMap.values()) {
      categories.add(command.category);
    }
    return Array.from(categories).sort();
  }

  // -------------------------------------------------------------------------
  // Cooldown Management
  // -------------------------------------------------------------------------

  checkCooldown(userId: string, commandName: string): { onCooldown: boolean; remaining: number } {
    const cmdEntry = this.getCommand(commandName);
    if (!cmdEntry) return { onCooldown: false, remaining: 0 };

    const cooldown = cmdEntry.command.cooldown;
    if (cooldown <= 0) return { onCooldown: false, remaining: 0 };

    const onCooldown = this.cooldownManager.isOnCooldown(userId, cmdEntry.command.name, cooldown);
    const remaining = this.cooldownManager.getRemainingCooldown(
      userId,
      cmdEntry.command.name,
      cooldown
    );

    return { onCooldown, remaining };
  }

  setCooldown(userId: string, commandName: string): void {
    const cmdEntry = this.getCommand(commandName);
    if (cmdEntry && cmdEntry.command.cooldown > 0) {
      this.cooldownManager.setCooldown(userId, cmdEntry.command.name);
    }
  }

  // -------------------------------------------------------------------------
  // Command Execution
  // -------------------------------------------------------------------------

  async executeCommand(commandName: string, ctx: CommandContext): Promise<boolean> {
    const entry = this.getCommand(commandName);
    if (!entry) return false;

    const plugin = this.plugins.get(entry.pluginName);
    if (!plugin || !plugin.enabled) return false;

    // Premium check
    if (entry.command.isPremiumOnly && !ctx.isPremium) {
      await ctx.reply('⛔ This command is available for premium users only.');
      return false;
    }

    // Cooldown check
    const { onCooldown, remaining } = this.checkCooldown(ctx.sender, commandName);
    if (onCooldown) {
      await ctx.reply(`⏳ Please wait ${remaining}s before using this command again.`);
      return false;
    }

    // Execute handler
    try {
      await entry.command.handler(ctx);
      this.setCooldown(ctx.sender, commandName);
      return true;
    } catch (error) {
      console.error(`[PluginLoader] Error executing command "${commandName}":`, error);
      await ctx.reply('❌ An error occurred while executing the command.').catch(() => {});
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Stats
  // -------------------------------------------------------------------------

  getStats(): {
    totalPlugins: number;
    enabledPlugins: number;
    totalCommands: number;
    categories: number;
  } {
    const totalPlugins = this.plugins.size;
    const enabledPlugins = Array.from(this.plugins.values()).filter((p) => p.enabled).length;
    const totalCommands = this.getAllCommands().length;
    const categories = this.getCategories().length;
    return { totalPlugins, enabledPlugins, totalCommands, categories };
  }

  // -------------------------------------------------------------------------
  // Reset
  // -------------------------------------------------------------------------

  reset(): void {
    this.plugins.clear();
    this.commandMap.clear();
    this.aliasMap.clear();
    this.cooldownManager.clearCooldowns();
    console.log('[PluginLoader] Registry reset');
  }
}

// ---------------------------------------------------------------------------
// Plugin Loading Functions
// ---------------------------------------------------------------------------

const COMMANDS_DIR = join(process.cwd(), 'src', 'lib', 'commands');

let loaded = false;

export async function loadPlugins(directory?: string): Promise<Plugin[]> {
  const registry = CommandRegistry.getInstance();
  const dir = directory ?? COMMANDS_DIR;
  const plugins: Plugin[] = [];

  if (!existsSync(dir)) {
    console.warn(`[PluginLoader] Commands directory not found: ${dir}`);
    return plugins;
  }

  const files = readdirSync(dir).filter(
    (f) => (f.endsWith('.ts') || f.endsWith('.js')) && !f.startsWith('_')
  );

  for (const file of files) {
    const filePath = resolve(dir, file);
    try {
      // Dynamic import of the plugin module
      const loadedModule = await import(filePath);
      const plugin: Plugin = loadedModule.default || loadedModule.plugin;

      if (!plugin || !plugin.name || !Array.isArray(plugin.commands)) {
        console.warn(`[PluginLoader] Invalid plugin format in "${file}". Skipping.`);
        continue;
      }

      plugin.filePath = filePath;
      registry.registerPlugin(plugin);
      plugins.push(plugin);
    } catch (error) {
      console.error(`[PluginLoader] Failed to load plugin from "${file}":`, error);
    }
  }

  loaded = true;
  console.log(
    `[PluginLoader] Loaded ${plugins.length} plugin(s) with ${registry.getAllCommands().length} command(s)`
  );
  return plugins;
}

export function unloadPlugin(name: string): boolean {
  const registry = CommandRegistry.getInstance();
  return registry.unregisterPlugin(name);
}

export async function reloadPlugin(name: string): Promise<boolean> {
  const registry = CommandRegistry.getInstance();
  const plugin = registry.getPlugin(name);
  if (!plugin || !plugin.filePath) return false;

  // Remove existing registration
  registry.unregisterPlugin(name);

  try {
    // Clear the require cache for hot-reloading
    const filePath = plugin.filePath;
    if (require.cache[filePath]) {
      delete require.cache[filePath];
    }

    // Re-import the module
    const loadedModule = await import(`${filePath}?t=${Date.now()}`);
    const reloaded: Plugin = loadedModule.default || loadedModule.plugin;

    if (!reloaded || !reloaded.name || !Array.isArray(reloaded.commands)) {
      console.error(`[PluginLoader] Invalid plugin format after reload: "${name}"`);
      return false;
    }

    reloaded.filePath = filePath;
    registry.registerPlugin(reloaded);
    console.log(`[PluginLoader] Reloaded plugin "${name}"`);
    return true;
  } catch (error) {
    console.error(`[PluginLoader] Failed to reload plugin "${name}":`, error);
    return false;
  }
}

export function enablePlugin(name: string): boolean {
  return CommandRegistry.getInstance().enablePlugin(name);
}

export function disablePlugin(name: string): boolean {
  return CommandRegistry.getInstance().disablePlugin(name);
}

export function getCommand(name: string): { command: Command; pluginName: string } | undefined {
  return CommandRegistry.getInstance().getCommand(name);
}

export function getAllCommands(): Command[] {
  return CommandRegistry.getInstance().getAllCommands();
}

export function getPluginsByCategory(category: string): Plugin[] {
  return CommandRegistry.getInstance().getPluginsByCategory(category);
}

export function getCommandsByCategory(category: string): Command[] {
  return CommandRegistry.getInstance().getCommandsByCategory(category);
}

export { CommandRegistry };
export default CommandRegistry;
