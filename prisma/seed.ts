import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default settings
  const settings = [
    { key: 'bot_prefix', value: '!', category: 'bot', description: 'Command prefix' },
    { key: 'bot_name', value: 'CALTEX MD', category: 'bot', description: 'Bot display name' },
    { key: 'bot_owner', value: '', category: 'bot', description: 'Owner WhatsApp number' },
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
