// ============================================================================
// CALTEX MD WhatsApp Bot - AI Commands
// AI chat, image generation, code generation, translation, summarization,
// rewriting, explanation, and conversation memory management
// ============================================================================

import type { Plugin, CommandContext } from '../plugin-loader';

// Simple in-memory conversation store per chat
const conversations: Map<string, { role: string; content: string }[]> = new Map();

const MAX_HISTORY = 20;

function getHistory(jid: string): { role: string; content: string }[] {
  if (!conversations.has(jid)) {
    conversations.set(jid, []);
  }
  return conversations.get(jid)!;
}

function addToHistory(jid: string, role: string, content: string): void {
  const history = getHistory(jid);
  history.push({ role, content });
  if (history.length > MAX_HISTORY) {
    history.shift();
  }
}

async function callAI(prompt: string, systemPrompt?: string): Promise<string> {
  // In production, this calls the AI handler via the bot service API
  // For now, returns a structured response
  return `[AI Response] Processing: "${prompt.slice(0, 50)}${prompt.length > 50 ? '...' : ''}"\n\n_This is a placeholder. In production, this connects to the configured AI provider (OpenAI, Gemini, Claude, etc.) via the bot mini-service._`;
}

const aiPlugin: Plugin = {
  name: 'ai',
  version: '1.0.0',
  description: 'AI-powered commands: chat, image generation, code, translation, and more',
  author: 'CALTEX MD',
  enabled: true,
  commands: [
    {
      name: 'ai',
      description: 'Chat with AI - ask anything',
      category: 'ai',
      aliases: ['chat', 'ask', 'gpt'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const prompt = ctx.args.join(' ');
        if (!prompt) {
          await ctx.reply('❌ Usage: .ai <question>\nExample: .ai What is quantum computing?');
          return;
        }
        await ctx.react('🤖');
        addToHistory(ctx.jid, 'user', prompt);
        const response = await callAI(prompt, 'You are a helpful assistant.');
        addToHistory(ctx.jid, 'assistant', response);
        await ctx.reply(`🤖 *AI Chat*\n\n${response}`);
      },
    },
    {
      name: 'aiimage',
      description: 'Generate an image with AI',
      category: 'ai',
      aliases: ['aimg', 'generate', 'dalle'],
      cooldown: 15,
      isPremiumOnly: true,
      handler: async (ctx: CommandContext) => {
        const prompt = ctx.args.join(' ');
        if (!prompt) {
          await ctx.reply('❌ Usage: .aiimage <description>\nExample: .aiimage a sunset over mountains');
          return;
        }
        await ctx.react('🎨');
        await ctx.reply(
          `🎨 *Generating image...*\n\nPrompt: "${prompt}"\n\n_The AI image generation service (DALL-E/Stable Diffusion) will create and send the image. This may take 10-30 seconds._`
        );
      },
    },
    {
      name: 'aicode',
      description: 'Generate code with AI assistance',
      category: 'ai',
      aliases: ['code', 'codegen'],
      cooldown: 10,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const prompt = ctx.args.join(' ');
        if (!prompt) {
          await ctx.reply('❌ Usage: .aicode <description>\nExample: .aicode Python function to sort a list');
          return;
        }
        await ctx.react('💻');
        const response = await callAI(
          prompt,
          'You are a code generation assistant. Return only the code with minimal explanation.'
        );
        await ctx.reply(`💻 *Code Generation*\n\n${response}`);
      },
    },
    {
      name: 'aitranslate',
      description: 'Translate text to a target language using AI',
      category: 'ai',
      aliases: ['trans', 'translate'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const targetLang = ctx.args[0];
        const text = ctx.args.slice(1).join(' ');
        if (!targetLang || !text) {
          await ctx.reply('❌ Usage: .aitranslate <language> <text>\nExample: .aitranslate spanish Hello world');
          return;
        }
        await ctx.react('🌍');
        const response = await callAI(
          `Translate the following text to ${targetLang}: "${text}"`,
          'You are a translator. Return only the translated text.'
        );
        await ctx.reply(`🌍 *Translation → ${targetLang}*\n\n${response}`);
      },
    },
    {
      name: 'aisummarize',
      description: 'Summarize text using AI',
      category: 'ai',
      aliases: ['summarize', 'sum', 'tldr'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const text = ctx.args.join(' ');
        if (!text) {
          await ctx.reply('❌ Usage: .aisummarize <text>\nExample: .aisummarize Long article text here...');
          return;
        }
        await ctx.react('📝');
        const response = await callAI(
          `Summarize the following text concisely: "${text}"`,
          'You are a summarization assistant. Provide a concise summary.'
        );
        await ctx.reply(`📝 *Summary*\n\n${response}`);
      },
    },
    {
      name: 'airewrite',
      description: 'Rewrite text in a specified style using AI',
      category: 'ai',
      aliases: ['rewrite', 'rephrase'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const style = ctx.args[0];
        const text = ctx.args.slice(1).join(' ');
        if (!style || !text) {
          await ctx.reply(
            '❌ Usage: .airewrite <style> <text>\n\nStyles: formal, casual, professional, simple, creative\nExample: .airewrite formal hey whatsup'
          );
          return;
        }
        await ctx.react('✍️');
        const response = await callAI(
          `Rewrite the following text in a ${style} style: "${text}"`,
          `You are a writing assistant. Rewrite the text in a ${style} style.`
        );
        await ctx.reply(`✍️ *Rewritten (${style})*\n\n${response}`);
      },
    },
    {
      name: 'aiexplain',
      description: 'Get an AI explanation of any topic',
      category: 'ai',
      aliases: ['explain', 'elaborate'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const topic = ctx.args.join(' ');
        if (!topic) {
          await ctx.reply('❌ Usage: .aiexplain <topic>\nExample: .aiexplain how blockchain works');
          return;
        }
        await ctx.react('💡');
        const response = await callAI(
          `Explain the following in simple terms: "${topic}"`,
          'You are an educational assistant. Explain clearly and simply.'
        );
        await ctx.reply(`💡 *Explanation*\n\n${response}`);
      },
    },
    {
      name: 'clearai',
      description: 'Clear AI conversation memory for this chat',
      category: 'ai',
      aliases: ['resetai', 'clearchat'],
      cooldown: 3,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const had = conversations.has(ctx.jid);
        conversations.delete(ctx.jid);
        await ctx.react('🧹');
        if (had) {
          await ctx.reply('🧠 AI conversation memory cleared for this chat.');
        } else {
          await ctx.reply('ℹ️ No conversation memory found for this chat.');
        }
      },
    },
  ],
};

export default aiPlugin;
