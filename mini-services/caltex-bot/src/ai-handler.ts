// ============================================================================
// CALTEX MD WhatsApp Bot - AI Handler
// Multi-provider AI integration: OpenAI, Gemini, Claude, Ollama, Custom
// Includes conversation memory, chat, image generation, translation,
// summarization, rewriting, explanation, and code generation
// ============================================================================

import pino from 'pino';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import type { AIProvider, AIConfig, ConversationMessage } from './types';

const logger = pino({
  level: 'info',
  transport: {
    target: 'pino/file',
    options: { destination: join(process.cwd(), 'bot.log') },
  },
}).child({ module: 'ai-handler' });

const DEFAULT_CONFIG: AIConfig = {
  defaultProvider: 'openai',
  openai: {
    apiKey: '',
    model: 'gpt-4',
    baseUrl: 'https://api.openai.com/v1',
    maxTokens: 2048,
    temperature: 0.7,
  },
  gemini: {
    apiKey: '',
    model: 'gemini-pro',
    baseUrl: 'https://generativelanguage.googleapis.com/v1',
    maxTokens: 2048,
    temperature: 0.7,
  },
  claude: {
    apiKey: '',
    model: 'claude-3-sonnet-20240229',
    baseUrl: 'https://api.anthropic.com/v1',
    maxTokens: 2048,
    temperature: 0.7,
  },
  ollama: {
    apiKey: '',
    model: 'llama3',
    baseUrl: 'http://localhost:11434',
    maxTokens: 2048,
    temperature: 0.7,
  },
  custom: {
    apiKey: '',
    model: '',
    baseUrl: '',
    maxTokens: 2048,
    temperature: 0.7,
    headers: {},
  },
  systemPrompt:
    'You are CALTEX MD Bot, a helpful and friendly WhatsApp assistant. You provide concise, accurate, and helpful responses. Keep your answers brief and to the point since this is a WhatsApp conversation. Use emojis where appropriate to make responses more engaging.',
  maxConversationLength: 20,
  conversationTTL: 3600000,
};

export class AIHandler {
  private config: AIConfig;
  private conversations: Map<string, ConversationMessage[]> = new Map();
  private conversationTimestamps: Map<string, number> = new Map();
  private configPath: string;
  private cleanupTimer: NodeJS.Timeout;

  constructor(configPath?: string) {
    this.configPath = configPath ?? join(process.cwd(), 'ai-config.json');
    this.config = this.loadConfig();
    this.cleanupTimer = setInterval(() => this.cleanupOldConversations(), 300000);
  }

  private loadConfig(): AIConfig {
    if (existsSync(this.configPath)) {
      try {
        const data = JSON.parse(readFileSync(this.configPath, 'utf-8'));
        return { ...DEFAULT_CONFIG, ...data };
      } catch (err) {
        logger.error({ err }, 'Failed to load AI config');
      }
    }
    return { ...DEFAULT_CONFIG };
  }

  saveConfig(): void {
    try {
      writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (err) {
      logger.error({ err }, 'Failed to save AI config');
    }
  }

  getConfig(): AIConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<AIConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
  }

  // ---------------------------------------------------------------------------
  // Conversation Memory
  // ---------------------------------------------------------------------------
  private cleanupOldConversations(): void {
    const now = Date.now();
    for (const [key, timestamp] of this.conversationTimestamps) {
      if (now - timestamp > this.config.conversationTTL) {
        this.conversations.delete(key);
        this.conversationTimestamps.delete(key);
      }
    }
  }

  getConversationMemory(chatJid: string): ConversationMessage[] {
    const conversation = this.conversations.get(chatJid);
    if (!conversation) return [];
    return [...conversation];
  }

  clearConversationMemory(chatJid: string): void {
    this.conversations.delete(chatJid);
    this.conversationTimestamps.delete(chatJid);
    logger.info({ chatJid }, 'Conversation memory cleared');
  }

  private getConversation(chatJid: string): ConversationMessage[] {
    const now = Date.now();
    this.conversationTimestamps.set(chatJid, now);

    let conversation = this.conversations.get(chatJid);
    if (!conversation) {
      conversation = [
        { role: 'system', content: this.config.systemPrompt, timestamp: now },
      ];
      this.conversations.set(chatJid, conversation);
    }

    return conversation;
  }

  private addToConversation(chatJid: string, role: 'user' | 'assistant', content: string): void {
    const conversation = this.getConversation(chatJid);
    conversation.push({ role, content, timestamp: Date.now() });

    if (conversation.length > this.config.maxConversationLength + 1) {
      const systemMsg = conversation[0];
      const trimmed = conversation.slice(-(this.config.maxConversationLength - 1));
      trimmed.unshift(systemMsg);
      this.conversations.set(chatJid, trimmed);
    }
  }

  // ---------------------------------------------------------------------------
  // Core Chat Function
  // ---------------------------------------------------------------------------
  async chat(provider: AIProvider, messages: ConversationMessage[], config?: Partial<AIConfig>): Promise<string> {
    const effectiveConfig = config ? { ...this.config, ...config } : this.config;

    try {
      let response: string;

      switch (provider) {
        case 'openai':
          response = await this.callOpenAI(messages, effectiveConfig);
          break;
        case 'gemini':
          response = await this.callGemini(messages, effectiveConfig);
          break;
        case 'claude':
          response = await this.callClaude(messages, effectiveConfig);
          break;
        case 'ollama':
          response = await this.callOllama(messages, effectiveConfig);
          break;
        case 'custom':
          response = await this.callCustom(messages, effectiveConfig);
          break;
        default:
          response = await this.callOpenAI(messages, effectiveConfig);
      }

      return response;
    } catch (err) {
      logger.error({ err, provider }, 'AI chat failed');
      throw new Error('AI chat request failed');
    }
  }

  // ---------------------------------------------------------------------------
  // Convenience Chat (with memory)
  // ---------------------------------------------------------------------------
  async chatWithMemory(chatJid: string, message: string, provider?: AIProvider): Promise<string> {
    const selectedProvider = provider ?? this.config.defaultProvider;
    const conversation = this.getConversation(chatJid);
    this.addToConversation(chatJid, 'user', message);

    try {
      const response = await this.chat(selectedProvider, conversation);
      this.addToConversation(chatJid, 'assistant', response);
      return response;
    } catch (err) {
      logger.error({ err, provider: selectedProvider }, 'AI chat with memory failed');
      throw new Error('AI chat request failed');
    }
  }

  // ---------------------------------------------------------------------------
  // Provider Implementations
  // ---------------------------------------------------------------------------
  private async callOpenAI(messages: ConversationMessage[], config: AIConfig): Promise<string> {
    const { apiKey, model, baseUrl, maxTokens, temperature } = config.openai;

    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const formattedMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: formattedMessages,
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? 'No response generated';
  }

  private async callGemini(messages: ConversationMessage[], config: AIConfig): Promise<string> {
    const { apiKey, model, baseUrl, maxTokens, temperature } = config.gemini;

    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const systemInstruction = messages.find((m) => m.role === 'system');

    const requestBody: any = {
      contents,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature,
      },
    };

    if (systemInstruction) {
      requestBody.systemInstruction = {
        parts: [{ text: systemInstruction.content }],
      };
    }

    const response = await fetch(
      `${baseUrl}/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No response generated';
  }

  private async callClaude(messages: ConversationMessage[], config: AIConfig): Promise<string> {
    const { apiKey, model, baseUrl, maxTokens, temperature } = config.claude;

    if (!apiKey) {
      throw new Error('Claude API key not configured');
    }

    const systemMsg = messages.find((m) => m.role === 'system');
    const chatMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    const response = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemMsg?.content ?? '',
        messages: chatMessages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text ?? 'No response generated';
  }

  private async callOllama(messages: ConversationMessage[], config: AIConfig): Promise<string> {
    const { model, baseUrl, maxTokens, temperature } = config.ollama;

    const formattedMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: formattedMessages,
        stream: false,
        options: {
          num_predict: maxTokens,
          temperature,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.message?.content ?? 'No response generated';
  }

  private async callCustom(messages: ConversationMessage[], config: AIConfig): Promise<string> {
    const { apiKey, baseUrl, model, maxTokens, temperature, headers } = config.custom;

    if (!baseUrl) {
      throw new Error('Custom API base URL not configured');
    }

    const formattedMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...(headers ?? {}),
    };

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify({
        model,
        messages: formattedMessages,
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Custom API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? data.response ?? 'No response generated';
  }

  // ---------------------------------------------------------------------------
  // Specialized AI Functions
  // ---------------------------------------------------------------------------
  async generateImage(provider: AIProvider, prompt: string, config?: Partial<AIConfig>): Promise<string | null> {
    const effectiveConfig = config ? { ...this.config, ...config } : this.config;
    const { apiKey, baseUrl } = effectiveConfig.openai;

    if (!apiKey) {
      throw new Error('OpenAI API key not configured for image generation');
    }

    try {
      const response = await fetch(`${baseUrl}/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt,
          n: 1,
          size: '1024x1024',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Image generation error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      return data.data?.[0]?.url ?? null;
    } catch (err) {
      logger.error({ err, prompt }, 'Image generation failed');
      return null;
    }
  }

  async generateCode(provider: AIProvider, prompt: string, config?: Partial<AIConfig>): Promise<string> {
    const codePrompt = `Generate code for the following: ${prompt}\n\nOnly provide the code, with brief comments. Do not wrap in markdown code blocks.`;
    const messages: ConversationMessage[] = [
      { role: 'system', content: this.config.systemPrompt, timestamp: Date.now() },
      { role: 'user', content: codePrompt, timestamp: Date.now() },
    ];
    return this.chat(provider, messages, config);
  }

  async translate(provider: AIProvider, text: string, targetLang: string, config?: Partial<AIConfig>): Promise<string> {
    const translatePrompt = `Translate the following text to ${targetLang}. Only provide the translation, nothing else.\n\nText: ${text}`;
    const messages: ConversationMessage[] = [
      { role: 'system', content: this.config.systemPrompt, timestamp: Date.now() },
      { role: 'user', content: translatePrompt, timestamp: Date.now() },
    ];
    return this.chat(provider, messages, config);
  }

  async summarize(provider: AIProvider, text: string, config?: Partial<AIConfig>): Promise<string> {
    const summarizePrompt = `Summarize the following text concisely:\n\n${text}`;
    const messages: ConversationMessage[] = [
      { role: 'system', content: this.config.systemPrompt, timestamp: Date.now() },
      { role: 'user', content: summarizePrompt, timestamp: Date.now() },
    ];
    return this.chat(provider, messages, config);
  }

  async rewrite(provider: AIProvider, text: string, style: string, config?: Partial<AIConfig>): Promise<string> {
    const rewritePrompt = `Rewrite the following text in a ${style} style while maintaining the original meaning:\n\n${text}`;
    const messages: ConversationMessage[] = [
      { role: 'system', content: this.config.systemPrompt, timestamp: Date.now() },
      { role: 'user', content: rewritePrompt, timestamp: Date.now() },
    ];
    return this.chat(provider, messages, config);
  }

  async explain(provider: AIProvider, text: string, config?: Partial<AIConfig>): Promise<string> {
    const explainPrompt = `Explain the following in simple, easy-to-understand terms:\n\n${text}`;
    const messages: ConversationMessage[] = [
      { role: 'system', content: this.config.systemPrompt, timestamp: Date.now() },
      { role: 'user', content: explainPrompt, timestamp: Date.now() },
    ];
    return this.chat(provider, messages, config);
  }

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------
  listActiveConversations(): string[] {
    return Array.from(this.conversations.keys());
  }

  getConversationLength(chatJid: string): number {
    return this.conversations.get(chatJid)?.length ?? 0;
  }

  setSystemPrompt(prompt: string): void {
    this.config.systemPrompt = prompt;
    this.saveConfig();
    for (const [, conversation] of this.conversations) {
      if (conversation.length > 0 && conversation[0].role === 'system') {
        conversation[0].content = prompt;
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupTimer);
  }
}
