// ============================================================================
// CALTEX MD WhatsApp Bot - Shared Type Definitions
// ============================================================================

import { WASocket, proto, GroupMetadata, WACallEvent, ConnectionState } from '@whiskeysockets/baileys';

// ---------------------------------------------------------------------------
// AI Types
// ---------------------------------------------------------------------------
export type AIProvider = 'openai' | 'gemini' | 'claude' | 'ollama' | 'custom';

export interface AIProviderConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  maxTokens: number;
  temperature: number;
  headers?: Record<string, string>;
}

export interface AIConfig {
  defaultProvider: AIProvider;
  openai: AIProviderConfig;
  gemini: AIProviderConfig;
  claude: AIProviderConfig;
  ollama: AIProviderConfig;
  custom: AIProviderConfig;
  systemPrompt: string;
  maxConversationLength: number;
  conversationTTL: number;
}

export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Anti-Feature Types
// ---------------------------------------------------------------------------
export interface AntiLinkConfig {
  enabled: boolean;
  allowedDomains: string[];
  warnFirst: boolean;
  action: 'delete' | 'warn' | 'kick';
}

export interface AntiBadwordConfig {
  enabled: boolean;
  words: string[];
  action: 'delete' | 'warn' | 'kick';
}

export interface AntiSpamConfig {
  enabled: boolean;
  maxMessages: number;
  intervalMs: number;
  action: 'delete' | 'warn' | 'kick' | 'mute';
  muteDurationMs: number;
}

export interface AntiDeleteConfig {
  enabled: boolean;
  forwardTo: string | null;
}

export interface AntiViewOnceConfig {
  enabled: boolean;
  forwardTo: string | null;
}

export interface AntiTagConfig {
  enabled: boolean;
  maxMentions: number;
  action: 'delete' | 'warn' | 'kick';
}

export interface AntiCallConfig {
  enabled: boolean;
  rejectCall: boolean;
  sendMessage: boolean;
  message: string;
}

export interface AntiFeatureConfig {
  antiLink: AntiLinkConfig;
  antiBadword: AntiBadwordConfig;
  antiSpam: AntiSpamConfig;
  antiDelete: AntiDeleteConfig;
  antiViewOnce: AntiViewOnceConfig;
  antiTag: AntiTagConfig;
  antiCall: AntiCallConfig;
}

export interface AntiCheckResult {
  violation: boolean;
  reason: string;
}

// ---------------------------------------------------------------------------
// Bot Config Types
// ---------------------------------------------------------------------------
export interface AutoReplyEntry {
  trigger: string | RegExp;
  response: string;
  exact?: boolean;
}

export interface BotConfig {
  prefix: string;
  ownerJids: string[];
  autoReply: {
    enabled: boolean;
    replies: AutoReplyEntry[];
  };
  welcome: {
    enabled: boolean;
    message: string;
  };
  goodbye: {
    enabled: boolean;
    message: string;
  };
  autoReact: {
    enabled: boolean;
    emojis: string[];
  };
  autoRead: boolean;
  autoTyping: boolean;
  autoRecording: boolean;
  autoStatusView: boolean;
  blockedJids: string[];
}

// ---------------------------------------------------------------------------
// Command Types
// ---------------------------------------------------------------------------
export interface CommandContext {
  sock: WASocket;
  message: proto.IWebMessageInfo;
  jid: string;
  sender: string;
  text: string;
  args: string[];
  command: string;
  isGroup: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isBotAdmin: boolean;
  groupMetadata?: GroupMetadata;
  quoted?: proto.IWebMessageInfo;
  mediaHandler: any;
  antiFeatures: any;
  groupManager: any;
  aiHandler: any;
  sessionId: string;
}

export interface CommandDefinition {
  name: string;
  aliases: string[];
  description: string;
  category: string;
  usage: string;
  ownerOnly: boolean;
  groupOnly: boolean;
  adminOnly: boolean;
  handler: (ctx: CommandContext) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Connection Types
// ---------------------------------------------------------------------------
export interface ConnectionConfig {
  sessionId: string;
  printQR?: boolean;
  browser?: string;
  syncFullHistory?: boolean;
  markOnlineOnConnect?: boolean;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectBaseDelay?: number;
}

export interface BotEvents {
  'connection.update': (state: ConnectionState, sessionId: string) => void;
  'qr.code': (qr: string, sessionId: string) => void;
  'connection.open': (sessionId: string) => void;
  'connection.close': (statusCode: number, reason: string, sessionId: string) => void;
  'creds.update': (creds: any, sessionId: string) => void;
  'messages.upsert': (data: any, sessionId: string) => void;
  'messages.delete': (data: any, sessionId: string) => void;
  'messages.update': (data: any, sessionId: string) => void;
  'messages.reaction': (data: any, sessionId: string) => void;
  'chats.upsert': (data: any, sessionId: string) => void;
  'chats.update': (data: any, sessionId: string) => void;
  'chats.delete': (data: any, sessionId: string) => void;
  'contacts.upsert': (data: any, sessionId: string) => void;
  'contacts.update': (data: any, sessionId: string) => void;
  'group.participants.update': (data: any, sessionId: string) => void;
  'group.update': (data: any, sessionId: string) => void;
  'call': (data: WACallEvent, sessionId: string) => void;
  'presence.update': (data: any, sessionId: string) => void;
  'blocklist.set': (data: any, sessionId: string) => void;
  'blocklist.update': (data: any, sessionId: string) => void;
}

// ---------------------------------------------------------------------------
// Session Types
// ---------------------------------------------------------------------------
export interface SessionInfo {
  sessionId: string;
  createdAt: number;
  lastActive: number;
  status: 'active' | 'disconnected' | 'banned' | 'unknown';
  phoneNumber?: string;
  name?: string;
}

export interface SessionBackup {
  sessionId: string;
  timestamp: number;
  data: Record<string, any>;
}

// ---------------------------------------------------------------------------
// Media Types
// ---------------------------------------------------------------------------
export interface ImageOptions {
  caption?: string;
  hd?: boolean;
  jpegQuality?: number;
  width?: number;
  height?: number;
  mentions?: string[];
  quoted?: proto.IWebMessageInfo;
}

export interface VideoOptions {
  caption?: string;
  hd?: boolean;
  gifPlayback?: boolean;
  mentions?: string[];
  quoted?: proto.IWebMessageInfo;
}

export interface AudioOptions {
  ptt?: boolean;
  mimetype?: string;
  quoted?: proto.IWebMessageInfo;
}

export interface DocumentOptions {
  fileName: string;
  mimetype?: string;
  caption?: string;
  quoted?: proto.IWebMessageInfo;
}

export interface StickerOptions {
  pack?: string;
  author?: string;
  animated?: boolean;
  quoted?: proto.IWebMessageInfo;
}

export interface LocationOptions {
  degreesLatitude: number;
  degreesLongitude: number;
  name?: string;
  address?: string;
  quoted?: proto.IWebMessageInfo;
}

export interface PollOptions {
  name: string;
  values: string[];
  selectableCount?: number;
  quoted?: proto.IWebMessageInfo;
}

// ---------------------------------------------------------------------------
// Group Types
// ---------------------------------------------------------------------------
export interface GroupInfo {
  id: string;
  subject: string;
  desc?: string;
  owner?: string;
  creation?: number;
  participants: { id: string; admin?: string }[];
  restrict?: boolean;
  announce?: boolean;
  size: number;
}

// ---------------------------------------------------------------------------
// Scheduler Types
// ---------------------------------------------------------------------------
export interface ScheduledMessage {
  id: string;
  sessionId: string;
  jid: string;
  content: any;
  sendAt: number;
  recurring?: {
    intervalMs: number;
    maxOccurrences?: number;
    occurrences?: number;
  };
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  createdAt: number;
  sentAt?: number;
  error?: string;
  type: 'single' | 'broadcast' | 'recurring';
  broadcastJids?: string[];
}

// ---------------------------------------------------------------------------
// API Client Types
// ---------------------------------------------------------------------------
export interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  source: string;
  message: string;
  data?: any;
  timestamp: number;
}

export interface BotStats {
  totalMessages: number;
  totalCommands: number;
  totalGroups: number;
  totalUsers: number;
  activeConnections: number;
  uptime: number;
  antiFeatureActions: number;
  aiRequests: number;
  scheduledMessages: number;
}

export interface BotSettings {
  prefix: string;
  ownerJids: string[];
  autoRead: boolean;
  autoReact: boolean;
  autoTyping: boolean;
  autoRecording: boolean;
  autoStatusView: boolean;
  welcomeEnabled: boolean;
  goodbyeEnabled: boolean;
  [key: string]: any;
}

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  enabled: boolean;
  config: Record<string, any>;
}

export interface BotUser {
  jid: string;
  name?: string;
  isOwner: boolean;
  isBlocked: boolean;
  lastSeen?: number;
  commandCount: number;
}

export interface BotGroup {
  jid: string;
  name: string;
  memberCount: number;
  adminCount: number;
  isBotAdmin: boolean;
  antiFeatures: Record<string, boolean>;
}
