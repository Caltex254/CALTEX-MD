import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default settings
  const settings = [
    { key: 'bot_prefix', value: '!', category: 'bot', description: 'Command prefix' },
    { key: 'bot_name', value: 'CALTEX MD', category: 'bot', description: 'Bot display name' },
    { key: 'bot_owner', value: '+254104906247', category: 'bot', description: 'Owner WhatsApp number' },
    { key: 'auto_read', value: 'false', category: 'auto', description: 'Auto read messages' },
    { key: 'auto_typing', value: 'false', category: 'auto', description: 'Auto typing indicator' },
    { key: 'auto_recording', value: 'false', category: 'auto', description: 'Auto recording indicator' },
    { key: 'auto_react', value: 'false', category: 'auto', description: 'Auto react to messages' },
    { key: 'auto_status_viewer', value: 'false', category: 'auto', description: 'Auto view statuses' },
    { key: 'anti_link', value: 'false', category: 'anti', description: 'Block links in groups' },
    { key: 'anti_badword', value: 'false', category: 'anti', description: 'Block bad words' },
    { key: 'anti_spam', value: 'false', category: 'anti', description: 'Anti spam protection' },
    { key: 'anti_delete', value: 'false', category: 'anti', description: 'Recover deleted messages' },
    { key: 'anti_view_once', value: 'false', category: 'anti', description: 'Capture view-once media' },
    { key: 'anti_tag', value: 'false', category: 'anti', description: 'Block mass tags' },
    { key: 'anti_call', value: 'false', category: 'anti', description: 'Auto reject calls' },
    { key: 'welcome_enabled', value: 'false', category: 'messages', description: 'Welcome new members' },
    { key: 'goodbye_enabled', value: 'false', category: 'messages', description: 'Goodbye leaving members' },
    { key: 'welcome_message', value: 'Welcome {user} to {group}!', category: 'messages', description: 'Welcome message template' },
    { key: 'goodbye_message', value: 'Goodbye {user}!', category: 'messages', description: 'Goodbye message template' },
    { key: 'ai_provider', value: 'openai', category: 'ai', description: 'AI provider to use' },
    { key: 'ai_model', value: 'gpt-4o', category: 'ai', description: 'AI model name' },
    { key: 'ai_enabled', value: 'true', category: 'ai', description: 'Enable AI features' },
    { key: 'ai_temperature', value: '0.7', category: 'ai', description: 'AI temperature' },
    { key: 'ai_max_tokens', value: '2048', category: 'ai', description: 'AI max tokens' },
    { key: 'rate_limit_window', value: '15', category: 'security', description: 'Rate limit window (minutes)' },
    { key: 'rate_limit_max', value: '100', category: 'security', description: 'Max requests per window' },
    { key: 'auto_backup', value: 'true', category: 'backup', description: 'Auto backup enabled' },
    { key: 'backup_interval', value: '86400000', category: 'backup', description: 'Backup interval (ms)' },
    { key: 'maintenance_mode', value: 'false', category: 'bot', description: 'Maintenance mode - only owner commands work' },
    { key: 'default_language', value: 'en', category: 'language', description: 'Default language code' },
    { key: 'default_theme', value: 'default', category: 'theme', description: 'Default theme name' },
    { key: 'repo_name', value: 'CALTEX MD', category: 'repo', description: 'Repository name' },
    { key: 'repo_url', value: 'https://github.com/caltex-md/caltex-md', category: 'repo', description: 'Repository URL' },
    { key: 'repo_developer', value: 'Caltex wayne', category: 'repo', description: 'Developer name' },
    { key: 'repo_description', value: 'Powerful WhatsApp Multi-Device Bot with AI, Plugin System & Dashboard', category: 'repo', description: 'Project description' },
    { key: 'repo_license', value: 'MIT', category: 'repo', description: 'License type' },
    { key: 'owner_jid', value: '254104906247@s.whatsapp.net', category: 'bot', description: 'Owner JID' },
    { key: 'owner_name', value: 'Caltex wayne', category: 'bot', description: 'Owner display name' },
    { key: 'owner_title', value: 'TECH WIZARD ☠️', category: 'bot', description: 'Owner professional title' },
    { key: 'owner_location', value: 'Kuresoi, Nakuru County, Kenya', category: 'bot', description: 'Owner home address' },
    { key: 'owner_whatsapp', value: '+254104906247', category: 'bot', description: 'Owner WhatsApp number' },
    { key: 'owner_notifications', value: 'true', category: 'notifications', description: 'Owner notifications enabled' },
    { key: 'notify_disconnect', value: 'true', category: 'notifications', description: 'Notify on disconnect' },
    { key: 'notify_plugin_crash', value: 'true', category: 'notifications', description: 'Notify on plugin crash' },
    { key: 'notify_db_error', value: 'true', category: 'notifications', description: 'Notify on database error' },
    { key: 'notify_api_failure', value: 'true', category: 'notifications', description: 'Notify on API failure' },
    { key: 'notify_update', value: 'true', category: 'notifications', description: 'Notify on available updates' },
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: { value: setting.value, category: setting.category, description: setting.description },
      create: setting,
    });
  }

  console.log(`✅ Created ${settings.length} settings`);

  // Create default commands
  const commands = [
    { name: 'ping', description: 'Check bot response time', category: 'general', cooldown: 5, isPremiumOnly: false },
    { name: 'help', description: 'Show available commands', category: 'general', cooldown: 3, isPremiumOnly: false },
    { name: 'menu', description: 'Show bot menu', category: 'general', cooldown: 5, isPremiumOnly: false },
    { name: 'ai', description: 'Chat with AI', category: 'ai', cooldown: 3, isPremiumOnly: false },
    { name: 'aiimage', description: 'Generate AI image', category: 'ai', cooldown: 10, isPremiumOnly: true },
    { name: 'aicode', description: 'Generate code with AI', category: 'ai', cooldown: 5, isPremiumOnly: true },
    { name: 'aitranslate', description: 'Translate text with AI', category: 'ai', cooldown: 5, isPremiumOnly: false },
    { name: 'aisummarize', description: 'Summarize text with AI', category: 'ai', cooldown: 5, isPremiumOnly: false },
    { name: 'airewrite', description: 'Rewrite text with AI', category: 'ai', cooldown: 5, isPremiumOnly: false },
    { name: 'aiexplain', description: 'Explain with AI', category: 'ai', cooldown: 5, isPremiumOnly: false },
    { name: 'sticker', description: 'Create sticker from image/video', category: 'media', cooldown: 5, isPremiumOnly: false },
    { name: 'takestick', description: 'Steal a sticker', category: 'media', cooldown: 3, isPremiumOnly: false },
    { name: 'groupinfo', description: 'Show group information', category: 'group', cooldown: 5, isPremiumOnly: false },
    { name: 'promote', description: 'Promote user to admin', category: 'group', cooldown: 3, isPremiumOnly: false },
    { name: 'demote', description: 'Demote admin to member', category: 'group', cooldown: 3, isPremiumOnly: false },
    { name: 'mute', description: 'Mute the group', category: 'group', cooldown: 3, isPremiumOnly: false },
    { name: 'unmute', description: 'Unmute the group', category: 'group', cooldown: 3, isPremiumOnly: false },
    { name: 'setprefix', description: 'Change bot prefix', category: 'owner', cooldown: 0, isPremiumOnly: false },
    { name: 'broadcast', description: 'Send broadcast message', category: 'owner', cooldown: 0, isPremiumOnly: false },
    { name: 'ban', description: 'Ban a user', category: 'owner', cooldown: 0, isPremiumOnly: false },
    { name: 'unban', description: 'Unban a user', category: 'owner', cooldown: 0, isPremiumOnly: false },
    { name: 'premium', description: 'Set premium status', category: 'owner', cooldown: 0, isPremiumOnly: false },
    { name: 'restart', description: 'Restart the bot', category: 'owner', cooldown: 0, isPremiumOnly: false },
    { name: 'shutdown', description: 'Stop the bot', category: 'owner', cooldown: 0, isPremiumOnly: false },
    { name: 'antilink', description: 'Toggle anti-link', category: 'moderation', cooldown: 3, isPremiumOnly: false },
    { name: 'antibadword', description: 'Toggle anti-badword', category: 'moderation', cooldown: 3, isPremiumOnly: false },
    { name: 'antispam', description: 'Toggle anti-spam', category: 'moderation', cooldown: 3, isPremiumOnly: false },
    { name: 'antidelete', description: 'Toggle anti-delete', category: 'moderation', cooldown: 3, isPremiumOnly: false },
    { name: 'warn', description: 'Warn a user', category: 'moderation', cooldown: 3, isPremiumOnly: false },
    { name: 'tagall', description: 'Tag all group members', category: 'moderation', cooldown: 10, isPremiumOnly: false },
    { name: 'hidetag', description: 'Hidden tag all members', category: 'moderation', cooldown: 10, isPremiumOnly: false },
    { name: 'joke', description: 'Get a random joke', category: 'fun', cooldown: 5, isPremiumOnly: false },
    { name: 'quote', description: 'Get a random quote', category: 'fun', cooldown: 5, isPremiumOnly: false },
    { name: '8ball', description: 'Magic 8 ball', category: 'fun', cooldown: 3, isPremiumOnly: false },
    { name: 'roll', description: 'Roll a dice', category: 'fun', cooldown: 3, isPremiumOnly: false },
    { name: 'flip', description: 'Flip a coin', category: 'fun', cooldown: 3, isPremiumOnly: false },
    { name: 'rps', description: 'Rock paper scissors', category: 'fun', cooldown: 3, isPremiumOnly: false },
    { name: 'translate', description: 'Translate text', category: 'tools', cooldown: 5, isPremiumOnly: false },
    { name: 'calc', description: 'Calculate expression', category: 'tools', cooldown: 3, isPremiumOnly: false },
    { name: 'qr', description: 'Generate QR code', category: 'tools', cooldown: 5, isPremiumOnly: false },
    { name: 'tts', description: 'Text to speech', category: 'tools', cooldown: 5, isPremiumOnly: false },
    { name: 'define', description: 'Dictionary lookup', category: 'tools', cooldown: 5, isPremiumOnly: false },
    { name: 'yta', description: 'Download YouTube audio', category: 'download', cooldown: 10, isPremiumOnly: true },
    { name: 'ytv', description: 'Download YouTube video', category: 'download', cooldown: 10, isPremiumOnly: true },
    // New commands - v1.1.0
    { name: 'repo', description: 'Show repository information', category: 'general', cooldown: 5, isPremiumOnly: false },
    { name: 'update', description: 'Update the bot', category: 'owner', cooldown: 0, isPremiumOnly: false },
    { name: 'checkupdate', description: 'Check for updates', category: 'owner', cooldown: 10, isPremiumOnly: false },
    { name: 'version', description: 'Show bot version', category: 'general', cooldown: 5, isPremiumOnly: false },
    { name: 'rollback', description: 'Rollback to previous version', category: 'owner', cooldown: 0, isPremiumOnly: false },
    { name: 'premium', description: 'Check premium status', category: 'premium', cooldown: 3, isPremiumOnly: false },
    { name: 'addpremium', description: 'Grant premium to user', category: 'owner', cooldown: 0, isPremiumOnly: false },
    { name: 'delpremium', description: 'Remove premium from user', category: 'owner', cooldown: 0, isPremiumOnly: false },
    { name: 'premiumlist', description: 'List premium users', category: 'owner', cooldown: 5, isPremiumOnly: false },
    { name: 'backup', description: 'Create backup', category: 'owner', cooldown: 30, isPremiumOnly: false },
    { name: 'restore', description: 'Restore from backup', category: 'owner', cooldown: 30, isPremiumOnly: false },
    { name: 'backuplist', description: 'List backups', category: 'owner', cooldown: 5, isPremiumOnly: false },
    { name: 'stats', description: 'Bot statistics', category: 'analytics', cooldown: 5, isPremiumOnly: false },
    { name: 'botstats', description: 'Detailed bot stats', category: 'analytics', cooldown: 5, isPremiumOnly: false },
    { name: 'groupstats', description: 'Group analytics', category: 'analytics', cooldown: 5, isPremiumOnly: false },
    { name: 'userstats', description: 'User statistics', category: 'analytics', cooldown: 5, isPremiumOnly: false },
    { name: 'runtime', description: 'Bot uptime info', category: 'general', cooldown: 5, isPremiumOnly: false },
    { name: 'system', description: 'System information', category: 'general', cooldown: 5, isPremiumOnly: false },
    { name: 'health', description: 'Health check', category: 'general', cooldown: 5, isPremiumOnly: false },
    { name: 'speed', description: 'Speed test', category: 'general', cooldown: 5, isPremiumOnly: false },
    { name: 'about', description: 'About the bot', category: 'general', cooldown: 5, isPremiumOnly: false },
    { name: 'changelog', description: 'Recent changelog', category: 'general', cooldown: 10, isPremiumOnly: false },
    { name: 'remind', description: 'Set a reminder', category: 'tools', cooldown: 3, isPremiumOnly: false },
    { name: 'reminders', description: 'List reminders', category: 'tools', cooldown: 3, isPremiumOnly: false },
    { name: 'note', description: 'Manage notes', category: 'tools', cooldown: 3, isPremiumOnly: false },
    { name: 'notes', description: 'List notes', category: 'tools', cooldown: 3, isPremiumOnly: false },
    { name: 'autoreply', description: 'List auto-replies', category: 'admin', cooldown: 3, isPremiumOnly: false },
    { name: 'setreply', description: 'Create auto-reply', category: 'admin', cooldown: 3, isPremiumOnly: false },
    { name: 'delreply', description: 'Delete auto-reply', category: 'admin', cooldown: 3, isPremiumOnly: false },
    { name: 'afk', description: 'Set AFK status', category: 'general', cooldown: 3, isPremiumOnly: false },
    { name: 'back', description: 'Return from AFK', category: 'general', cooldown: 3, isPremiumOnly: false },
    { name: 'schedule', description: 'Schedule message', category: 'owner', cooldown: 5, isPremiumOnly: false },
    { name: 'listschedule', description: 'List scheduled messages', category: 'owner', cooldown: 5, isPremiumOnly: false },
    { name: 'delschedule', description: 'Delete scheduled message', category: 'owner', cooldown: 3, isPremiumOnly: false },
    { name: 'language', description: 'Set language', category: 'general', cooldown: 3, isPremiumOnly: false },
    { name: 'languages', description: 'List languages', category: 'general', cooldown: 3, isPremiumOnly: false },
    { name: 'theme', description: 'Set theme', category: 'general', cooldown: 3, isPremiumOnly: false },
    { name: 'themes', description: 'List themes', category: 'general', cooldown: 3, isPremiumOnly: false },
    { name: 'maintenance', description: 'Toggle maintenance mode', category: 'owner', cooldown: 0, isPremiumOnly: false },
    { name: 'exportconfig', description: 'Export configuration', category: 'owner', cooldown: 10, isPremiumOnly: false },
    { name: 'importconfig', description: 'Import configuration', category: 'owner', cooldown: 10, isPremiumOnly: false },
    { name: 'apikeys', description: 'List API keys', category: 'owner', cooldown: 5, isPremiumOnly: false },
    { name: 'apikeyadd', description: 'Add API key', category: 'owner', cooldown: 0, isPremiumOnly: false },
    { name: 'apikeydel', description: 'Delete API key', category: 'owner', cooldown: 0, isPremiumOnly: false },
    { name: 'apikeytoggle', description: 'Toggle API key', category: 'owner', cooldown: 0, isPremiumOnly: false },
    { name: 'plugins', description: 'List plugins', category: 'owner', cooldown: 5, isPremiumOnly: false },
    { name: 'plugininfo', description: 'Plugin details', category: 'owner', cooldown: 3, isPremiumOnly: false },
    { name: 'installplugin', description: 'Install plugin', category: 'owner', cooldown: 0, isPremiumOnly: false },
    { name: 'removeplugin', description: 'Remove plugin', category: 'owner', cooldown: 0, isPremiumOnly: false },
    { name: 'enableplugin', description: 'Enable plugin', category: 'owner', cooldown: 0, isPremiumOnly: false },
    { name: 'disableplugin', description: 'Disable plugin', category: 'owner', cooldown: 0, isPremiumOnly: false },
    { name: 'reloadplugin', description: 'Reload plugin', category: 'owner', cooldown: 0, isPremiumOnly: false },
    { name: 'reloadall', description: 'Reload all plugins', category: 'owner', cooldown: 0, isPremiumOnly: false },
    { name: 'gstats', description: 'Group statistics', category: 'group', cooldown: 5, isPremiumOnly: false },
    { name: 'gactivity', description: 'Group activity', category: 'group', cooldown: 5, isPremiumOnly: false },
    { name: 'gtop', description: 'Top contributors', category: 'group', cooldown: 5, isPremiumOnly: false },
    { name: 'donate', description: 'Support the project', category: 'general', cooldown: 10, isPremiumOnly: false },
    { name: 'support', description: 'Get support', category: 'general', cooldown: 10, isPremiumOnly: false },
    // Bug Menu Commands - v2.0.0
    { name: 'bugmenu', description: 'Show bug attack menu', category: 'bug', cooldown: 10, isPremiumOnly: false },
    { name: 'bug1', description: 'Crash loop attack', category: 'bug', cooldown: 15, isPremiumOnly: false },
    { name: 'bug2', description: 'VCard injection attack', category: 'bug', cooldown: 20, isPremiumOnly: false },
    { name: 'bug3', description: 'Document filename attack', category: 'bug', cooldown: 15, isPremiumOnly: false },
    { name: 'bug4', description: 'Sticker payload attack', category: 'bug', cooldown: 15, isPremiumOnly: false },
    { name: 'bug5', description: 'ViewOnce caption attack', category: 'bug', cooldown: 15, isPremiumOnly: false },
    { name: 'bug6', description: 'Audio corrupted attack', category: 'bug', cooldown: 15, isPremiumOnly: false },
    { name: 'bug7', description: 'Payment amount attack', category: 'bug', cooldown: 15, isPremiumOnly: false },
    { name: 'bug8', description: 'Group invite attack', category: 'bug', cooldown: 15, isPremiumOnly: false },
    { name: 'bug9', description: 'Reaction bomb attack', category: 'bug', cooldown: 30, isPremiumOnly: false },
    { name: 'bug10', description: 'Contact array attack', category: 'bug', cooldown: 30, isPremiumOnly: false },
    { name: 'bug11', description: 'Location coordinate attack', category: 'bug', cooldown: 15, isPremiumOnly: false },
    { name: 'bug12', description: 'Poll overflow attack', category: 'bug', cooldown: 15, isPremiumOnly: false },
    { name: 'bug13', description: 'List message attack', category: 'bug', cooldown: 15, isPremiumOnly: false },
    { name: 'bug14', description: 'Button overflow attack', category: 'bug', cooldown: 15, isPremiumOnly: false },
    { name: 'bug15', description: 'Newsletter metadata attack', category: 'bug', cooldown: 15, isPremiumOnly: false },
    { name: 'bug16', description: 'Mention bomb attack', category: 'bug', cooldown: 20, isPremiumOnly: false },
    { name: 'bug17', description: 'Forwarded chain attack', category: 'bug', cooldown: 15, isPremiumOnly: false },
    { name: 'bug18', description: 'Caption poison attack', category: 'bug', cooldown: 15, isPremiumOnly: false },
    { name: 'bug19', description: 'Status broadcast attack', category: 'bug', cooldown: 15, isPremiumOnly: false },
    { name: 'bug20', description: 'Force stop combo attack', category: 'bug', cooldown: 60, isPremiumOnly: false },
    // Prefix Commands - v2.0.0
    { name: 'changeprefix', description: 'Change bot command prefix', category: 'owner', cooldown: 5, isPremiumOnly: false },
    { name: 'getprefix', description: 'Show current bot prefix', category: 'general', cooldown: 5, isPremiumOnly: false },
  ];

  for (const cmd of commands) {
    await prisma.command.upsert({
      where: { name: cmd.name },
      update: { description: cmd.description, category: cmd.category, cooldown: cmd.cooldown, isPremiumOnly: cmd.isPremiumOnly },
      create: cmd,
    });
  }

  console.log(`✅ Created ${commands.length} commands`);

  // Create default plugins
  const plugins = [
    { name: 'ping', version: '1.0.0', description: 'Ping/Pong command', author: 'CALTEX MD', isEnabled: true, filePath: 'src/lib/commands/ping.ts' },
    { name: 'help', version: '1.0.0', description: 'Help command', author: 'CALTEX MD', isEnabled: true, filePath: 'src/lib/commands/help.ts' },
    { name: 'menu', version: '1.0.0', description: 'Bot menu command', author: 'CALTEX MD', isEnabled: true, filePath: 'src/lib/commands/menu.ts' },
    { name: 'owner', version: '1.0.0', description: 'Owner commands', author: 'CALTEX MD', isEnabled: true, filePath: 'src/lib/commands/owner.ts' },
    { name: 'sticker', version: '1.0.0', description: 'Sticker commands', author: 'CALTEX MD', isEnabled: true, filePath: 'src/lib/commands/sticker.ts' },
    { name: 'ai', version: '1.0.0', description: 'AI integration commands', author: 'CALTEX MD', isEnabled: true, filePath: 'src/lib/commands/ai.ts' },
    { name: 'group', version: '1.0.0', description: 'Group management commands', author: 'CALTEX MD', isEnabled: true, filePath: 'src/lib/commands/group.ts' },
    { name: 'download', version: '1.0.0', description: 'Media download commands', author: 'CALTEX MD', isEnabled: true, filePath: 'src/lib/commands/download.ts' },
    { name: 'fun', version: '1.0.0', description: 'Fun & games commands', author: 'CALTEX MD', isEnabled: true, filePath: 'src/lib/commands/fun.ts' },
    { name: 'tools', version: '1.0.0', description: 'Utility commands', author: 'CALTEX MD', isEnabled: true, filePath: 'src/lib/commands/tools.ts' },
    { name: 'moderation', version: '1.0.0', description: 'Moderation commands', author: 'CALTEX MD', isEnabled: true, filePath: 'src/lib/commands/moderation.ts' },
    // New plugins - v1.1.0
    { name: 'repo', version: '1.0.0', description: 'Repository info command', author: 'CALTEX MD', isEnabled: true, filePath: 'src/lib/commands/repo.ts' },
    { name: 'update', version: '1.0.0', description: 'Auto update system', author: 'CALTEX MD', isEnabled: true, filePath: 'src/lib/commands/update.ts' },
    { name: 'premium', version: '1.0.0', description: 'Premium management', author: 'CALTEX MD', isEnabled: true, filePath: 'src/lib/commands/premium.ts' },
    { name: 'backup', version: '1.0.0', description: 'Backup system', author: 'CALTEX MD', isEnabled: true, filePath: 'src/lib/commands/backup.ts' },
    { name: 'analytics', version: '1.0.0', description: 'Analytics commands', author: 'CALTEX MD', isEnabled: true, filePath: 'src/lib/commands/analytics.ts' },
    { name: 'utility', version: '1.0.0', description: 'Utility commands', author: 'CALTEX MD', isEnabled: true, filePath: 'src/lib/commands/utility.ts' },
    { name: 'reminder', version: '1.0.0', description: 'Reminder system', author: 'CALTEX MD', isEnabled: true, filePath: 'src/lib/commands/reminder.ts' },
    { name: 'notes', version: '1.0.0', description: 'Notes system', author: 'CALTEX MD', isEnabled: true, filePath: 'src/lib/commands/notes.ts' },
    { name: 'autoreply', version: '1.0.0', description: 'Auto reply system', author: 'CALTEX MD', isEnabled: true, filePath: 'src/lib/commands/autoreply.ts' },
    { name: 'afk', version: '1.0.0', description: 'AFK system', author: 'CALTEX MD', isEnabled: true, filePath: 'src/lib/commands/afk.ts' },
    { name: 'scheduler', version: '1.0.0', description: 'Message scheduler', author: 'CALTEX MD', isEnabled: true, filePath: 'src/lib/commands/scheduler.ts' },
    { name: 'language', version: '1.0.0', description: 'Multi-language support', author: 'CALTEX MD', isEnabled: true, filePath: 'src/lib/commands/language.ts' },
    { name: 'theme', version: '1.0.0', description: 'Theme system', author: 'CALTEX MD', isEnabled: true, filePath: 'src/lib/commands/theme.ts' },
    { name: 'maintenance', version: '1.0.0', description: 'Maintenance mode', author: 'CALTEX MD', isEnabled: true, filePath: 'src/lib/commands/maintenance.ts' },
    { name: 'import-export', version: '1.0.0', description: 'Import/Export config', author: 'CALTEX MD', isEnabled: true, filePath: 'src/lib/commands/import-export.ts' },
    { name: 'apikeys', version: '1.0.0', description: 'API key manager', author: 'CALTEX MD', isEnabled: true, filePath: 'src/lib/commands/apikeys.ts' },
    { name: 'plugin-manager', version: '1.0.0', description: 'Plugin manager', author: 'CALTEX MD', isEnabled: true, filePath: 'src/lib/commands/plugin-manager.ts' },
    { name: 'group-analytics', version: '1.0.0', description: 'Group analytics', author: 'CALTEX MD', isEnabled: true, filePath: 'src/lib/commands/group-analytics.ts' },
    // New plugins - v2.0.0
    { name: 'bug-menu', version: '1.0.0', description: 'Bug attack menu (20+ attacks)', author: 'CALTEX MD', isEnabled: true, filePath: 'src/lib/commands/bug-menu.ts' },
    { name: 'prefix', version: '1.0.0', description: 'Change prefix command', author: 'CALTEX MD', isEnabled: true, filePath: 'src/lib/commands/prefix.ts' },
  ];

  for (const plugin of plugins) {
    await prisma.plugin.upsert({
      where: { name: plugin.name },
      update: { version: plugin.version, description: plugin.description, isEnabled: plugin.isEnabled },
      create: plugin,
    });
  }

  console.log(`✅ Created ${plugins.length} plugins`);

  // Create default AI settings
  const aiProviders = ['openai', 'gemini', 'claude', 'ollama', 'custom'];
  for (const provider of aiProviders) {
    await prisma.aISettings.upsert({
      where: { id: provider },
      update: {},
      create: {
        id: provider,
        provider: provider as any,
        model: provider === 'openai' ? 'gpt-4o' : provider === 'gemini' ? 'gemini-pro' : provider === 'claude' ? 'claude-3-sonnet-20240229' : provider === 'ollama' ? 'llama3' : 'custom',
        systemPrompt: 'You are CALTEX MD, a powerful and helpful WhatsApp assistant. Be concise, friendly, and helpful.',
        temperature: 0.7,
        maxTokens: 2048,
        isEnabled: provider === 'openai',
      },
    });
  }

  console.log(`✅ Created ${aiProviders.length} AI provider configs`);

  // Create default language packs
  const languagePacks = [
    { code: 'en', name: 'English', translations: JSON.stringify({ hello: 'Hello', help: 'Help', menu: 'Menu', ping: 'Pong', error: 'An error occurred', noPermission: 'No permission', ownerOnly: 'Owner only', premiumOnly: 'Premium only', welcome: 'Welcome', goodbye: 'Goodbye' }), isDefault: true },
    { code: 'sw', name: 'Kiswahili', translations: JSON.stringify({ hello: 'Hujambo', help: 'Msaada', menu: 'Menyu', ping: 'Pong', error: 'Kulikuwa na hitilafu', noPermission: 'Huna ruhusa', ownerOnly: 'Mmiliki tu', premiumOnly: 'Premium tu', welcome: 'Karibu', goodbye: 'Kwaheri' }), isDefault: false },
    { code: 'fr', name: 'Français', translations: JSON.stringify({ hello: 'Bonjour', help: 'Aide', menu: 'Menu', ping: 'Pong', error: 'Une erreur est survenue', noPermission: 'Pas de permission', ownerOnly: 'Propriétaire uniquement', premiumOnly: 'Premium uniquement', welcome: 'Bienvenue', goodbye: 'Au revoir' }), isDefault: false },
    { code: 'ar', name: 'العربية', translations: JSON.stringify({ hello: 'مرحبا', help: 'مساعدة', menu: 'القائمة', ping: 'بونغ', error: 'حدث خطأ', noPermission: 'ليس لديك إذن', ownerOnly: 'المالك فقط', premiumOnly: 'بريميوم فقط', welcome: 'أهلا وسهلا', goodbye: 'وداعا' }), isDefault: false },
    { code: 'pt', name: 'Português', translations: JSON.stringify({ hello: 'Olá', help: 'Ajuda', menu: 'Menu', ping: 'Pong', error: 'Ocorreu um erro', noPermission: 'Sem permissão', ownerOnly: 'Apenas proprietário', premiumOnly: 'Apenas premium', welcome: 'Bem-vindo', goodbye: 'Adeus' }), isDefault: false },
    { code: 'id', name: 'Bahasa Indonesia', translations: JSON.stringify({ hello: 'Halo', help: 'Bantuan', menu: 'Menu', ping: 'Pong', error: 'Terjadi kesalahan', noPermission: 'Tidak ada izin', ownerOnly: 'Hanya pemilik', premiumOnly: 'Hanya premium', welcome: 'Selamat datang', goodbye: 'Selamat tinggal' }), isDefault: false },
    { code: 'hi', name: 'हिन्दी', translations: JSON.stringify({ hello: 'नमस्ते', help: 'मदद', menu: 'मेनू', ping: 'पोंग', error: 'त्रुटि हुई', noPermission: 'अनुमति नहीं', ownerOnly: 'केवल मालिक', premiumOnly: 'केवल प्रीमियम', welcome: 'स्वागत है', goodbye: 'अलविदा' }), isDefault: false },
    { code: 'es', name: 'Español', translations: JSON.stringify({ hello: 'Hola', help: 'Ayuda', menu: 'Menú', ping: 'Pong', error: 'Ocurrió un error', noPermission: 'Sin permiso', ownerOnly: 'Solo propietario', premiumOnly: 'Solo premium', welcome: 'Bienvenido', goodbye: 'Adiós' }), isDefault: false },
    { code: 'de', name: 'Deutsch', translations: JSON.stringify({ hello: 'Hallo', help: 'Hilfe', menu: 'Menü', ping: 'Pong', error: 'Ein Fehler ist aufgetreten', noPermission: 'Keine Berechtigung', ownerOnly: 'Nur Besitzer', premiumOnly: 'Nur Premium', welcome: 'Willkommen', goodbye: 'Auf Wiedersehen' }), isDefault: false },
    { code: 'zu', name: 'isiZulu', translations: JSON.stringify({ hello: 'Sawubona', help: 'Usizo', menu: 'Imenu', ping: 'Pong', error: 'Kwenzeke iphutha', noPermission: 'Awunayo imvume', ownerOnly: 'Umnikazi kuphela', premiumOnly: 'Premium kuphela', welcome: 'Wamukelekile', goodbye: 'Hamba kahle' }), isDefault: false },
  ];

  for (const pack of languagePacks) {
    await prisma.languagePack.upsert({
      where: { code: pack.code },
      update: { name: pack.name, translations: pack.translations, isDefault: pack.isDefault },
      create: pack,
    });
  }

  console.log(`✅ Created ${languagePacks.length} language packs`);

  // Create default themes
  const themes = [
    { name: 'default', description: 'CALTEX MD default theme - Red and orange gradient', style: JSON.stringify({ primary: '#dc2626', secondary: '#ea580c', accent: '#f97316', background: '#0f172a', text: '#f8fafc', headerBg: '#1e293b', cardBg: '#1e293b', sidebarBg: '#0f172a' }), isDefault: true },
    { name: 'ocean', description: 'Ocean blue theme - Cool and professional', style: JSON.stringify({ primary: '#0ea5e9', secondary: '#06b6d4', accent: '#14b8a6', background: '#0c4a6e', text: '#f0f9ff', headerBg: '#075985', cardBg: '#075985', sidebarBg: '#0c4a6e' }), isDefault: false },
    { name: 'forest', description: 'Forest green theme - Natural and calming', style: JSON.stringify({ primary: '#16a34a', secondary: '#15803d', accent: '#22c55e', background: '#052e16', text: '#f0fdf4', headerBg: '#14532d', cardBg: '#14532d', sidebarBg: '#052e16' }), isDefault: false },
    { name: 'purple', description: 'Royal purple theme - Elegant and bold', style: JSON.stringify({ primary: '#9333ea', secondary: '#7c3aed', accent: '#a855f7', background: '#2e1065', text: '#faf5ff', headerBg: '#3b0764', cardBg: '#3b0764', sidebarBg: '#2e1065' }), isDefault: false },
    { name: 'midnight', description: 'Midnight dark theme - Sleek and modern', style: JSON.stringify({ primary: '#6366f1', secondary: '#4f46e5', accent: '#818cf8', background: '#020617', text: '#e2e8f0', headerBg: '#0f172a', cardBg: '#0f172a', sidebarBg: '#020617' }), isDefault: false },
  ];

  for (const theme of themes) {
    await prisma.themeConfig.upsert({
      where: { name: theme.name },
      update: { description: theme.description, style: theme.style },
      create: theme,
    });
  }

  console.log(`✅ Created ${themes.length} themes`);

  // Create default repo config
  await prisma.repoConfig.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      repoName: 'CALTEX MD',
      repoUrl: 'https://github.com/caltex-md/caltex-md',
      developerName: 'CALTEX MD Team',
      description: 'Powerful WhatsApp Multi-Device Bot with AI, Plugin System, Web Dashboard & REST API',
      docsUrl: 'https://github.com/caltex-md/caltex-md/wiki',
      license: 'MIT',
      latestRelease: '1.1.0',
    },
  });

  console.log('✅ Created default repo config');

  // Create initial stats entry
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  await prisma.stat.upsert({
    where: { date: today },
    update: {},
    create: {
      date: today,
      messagesSent: 0,
      messagesReceived: 0,
      commandsExecuted: 0,
      groupsActive: 0,
      usersActive: 0,
      apiCalls: 0,
      errors: 0,
    },
  });

  console.log('✅ Created initial stats');
  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
