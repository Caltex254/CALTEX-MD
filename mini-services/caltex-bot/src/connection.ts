// ============================================================================
// CALTEX MD WhatsApp Bot - Connection Manager
// Uses Baileys for WhatsApp Multi-Device connection
// ============================================================================

import {
  makeWASocket,
  useMultiFileAuthState as initAuthState,
  DisconnectReason,
  WASocket,
  Browsers,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  ConnectionState,
  WACallEvent,
  proto,
  UserFacingSocketConfig,
} from '@whiskeysockets/baileys';
import { EventEmitter } from 'events';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { SessionManager } from './session-manager';
import type { ConnectionConfig, BotEvents } from './types';

const logger = pino({
  level: 'info',
  transport: {
    target: 'pino/file',
    options: { destination: join(process.cwd(), 'bot.log') },
  },
});

export class ConnectionManager extends EventEmitter {
  private sockets: Map<string, WASocket> = new Map();
  private connectionStates: Map<string, ConnectionState> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private sessionManager: SessionManager;
  private configs: Map<string, ConnectionConfig> = new Map();
  private authFolders: Map<string, string> = new Map();
  private isShuttingDown = false;
  private globalLogger: pino.Logger;

  constructor(sessionManager: SessionManager) {
    super();
    this.sessionManager = sessionManager;
    this.globalLogger = logger.child({ module: 'connection-manager' });
  }

  private getAuthFolder(sessionId: string): string {
    const baseDir = join(process.cwd(), 'auth_info_baileys');
    if (!existsSync(baseDir)) {
      mkdirSync(baseDir, { recursive: true });
    }
    const folder = join(baseDir, sessionId);
    if (!existsSync(folder)) {
      mkdirSync(folder, { recursive: true });
    }
    this.authFolders.set(sessionId, folder);
    return folder;
  }

  async createConnection(config: ConnectionConfig): Promise<WASocket> {
    const {
      sessionId,
      printQR = true,
      browser = 'CALTEX MD',
      syncFullHistory = false,
      markOnlineOnConnect = true,
      autoReconnect = true,
      maxReconnectAttempts = 10,
      reconnectBaseDelay = 2000,
    } = config;

    this.configs.set(sessionId, config);
    this.reconnectAttempts.set(sessionId, 0);

    const authFolder = this.getAuthFolder(sessionId);
    const { state, saveCreds } = await initAuthState(authFolder);
    const { version } = await fetchLatestBaileysVersion();

    this.globalLogger.info({ sessionId, version }, 'Creating WhatsApp connection');

    const socketConfig: UserFacingSocketConfig = {
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, this.globalLogger),
      },
      printQRInTerminal: printQR,
      browser: Browsers.appropriate(browser),
      syncFullHistory,
      markOnlineOnConnect,
      logger: this.globalLogger.child({ sessionId }),
      generateHighQualityLinkPreview: true,
      shouldIgnoreJid: (jid: string) => {
        const isGroup = jid.endsWith('@g.us');
        const isBroadcast = jid === 'status@broadcast';
        const isNewsletter = jid.includes('@newsletter');
        const isUser = jid.endsWith('@s.whatsapp.net');
        return !isGroup && !isBroadcast && !isUser && !isNewsletter;
      },
      getMessage: async (key: proto.IMessageKey) => {
        if (!key.remoteJid) return undefined;
        this.globalLogger.debug({ key }, 'getMessage requested');
        return undefined;
      },
    };

    const sock = makeWASocket(socketConfig);
    this.sockets.set(sessionId, sock);

    // --- Connection Update Handler ---
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.globalLogger.info({ sessionId }, 'QR code received');
        if (printQR) {
          qrcode.generate(qr, { small: true });
        }
        this.emit('qr.code', qr, sessionId);
      }

      if (connection === 'close') {
        const statusCode =
          lastDisconnect?.error?.output?.statusCode ??
          lastDisconnect?.error?.output?.payload?.statusCode ??
          0;
        const reason = lastDisconnect?.error?.message ?? 'Unknown reason';
        const shouldReconnect =
          statusCode !== DisconnectReason.loggedOut &&
          autoReconnect &&
          !this.isShuttingDown;

        this.globalLogger.warn({ sessionId, statusCode, reason, shouldReconnect }, 'Connection closed');

        this.connectionStates.set(sessionId, update);
        this.emit('connection.close', statusCode, reason, sessionId);
        this.emit('connection.update', update, sessionId);

        if (shouldReconnect) {
          const attempts = (this.reconnectAttempts.get(sessionId) ?? 0) + 1;
          this.reconnectAttempts.set(sessionId, attempts);

          if (attempts <= maxReconnectAttempts) {
            const delay = reconnectBaseDelay * Math.pow(2, attempts - 1) + Math.random() * 1000;
            this.globalLogger.info({ sessionId, attempts, delay: Math.round(delay) }, 'Reconnecting with exponential backoff');
            const timer = setTimeout(() => {
              this.reconnectTimers.delete(sessionId);
              this.createConnection(config);
            }, delay);
            this.reconnectTimers.set(sessionId, timer);
          } else {
            this.globalLogger.error({ sessionId, attempts }, 'Max reconnect attempts reached');
          }
        } else if (statusCode === DisconnectReason.loggedOut) {
          this.globalLogger.info({ sessionId }, 'Logged out, clearing session');
          await this.sessionManager.deleteSession(sessionId);
        }
      } else if (connection === 'open') {
        this.reconnectAttempts.set(sessionId, 0);
        this.globalLogger.info({ sessionId }, 'Connection opened');
        this.connectionStates.set(sessionId, update);
        this.emit('connection.open', sessionId);
        this.emit('connection.update', update, sessionId);
      } else {
        this.connectionStates.set(sessionId, update);
        this.emit('connection.update', update, sessionId);
      }
    });

    // --- Credentials Update ---
    sock.ev.on('creds.update', (creds) => {
      saveCreds();
      this.emit('creds.update', creds, sessionId);
    });

    // --- Forward all Baileys events through EventEmitter ---
    const eventMap: Record<string, string> = {
      'messages.upsert': 'messages.upsert',
      'messages.delete': 'messages.delete',
      'messages.update': 'messages.update',
      'messages.reaction': 'messages.reaction',
      'chats.upsert': 'chats.upsert',
      'chats.update': 'chats.update',
      'chats.delete': 'chats.delete',
      'contacts.upsert': 'contacts.upsert',
      'contacts.update': 'contacts.update',
      'group-participants.update': 'group.participants.update',
      'groups.update': 'group.update',
      'call': 'call',
      'presence.update': 'presence.update',
      'blocklist.set': 'blocklist.set',
      'blocklist.update': 'blocklist.update',
    };

    for (const [baileysEvent, botEvent] of Object.entries(eventMap)) {
      sock.ev.on(baileysEvent as any, (data: any) => {
        this.emit(botEvent, data, sessionId);
      });
    }

    return sock;
  }

  // ---------------------------------------------------------------------------
  // Pairing Code Support
  // ---------------------------------------------------------------------------
  async requestPairingCode(sessionId: string, phoneNumber: string): Promise<string> {
    const sock = this.sockets.get(sessionId);
    if (!sock) {
      throw new Error(`No active connection for session: ${sessionId}`);
    }
    try {
      // Request pairing code from WhatsApp
      // The phone number should be in format: country code + number (e.g., "254712345678")
      const code = await sock.requestPairingCode(phoneNumber);
      this.globalLogger.info({ sessionId, phoneNumber }, 'Pairing code requested');
      this.emit('pairing.code', code, sessionId, phoneNumber);
      return code;
    } catch (error: any) {
      this.globalLogger.error({ sessionId, phoneNumber, error: error.message }, 'Failed to request pairing code');
      throw new Error(`Failed to request pairing code: ${error.message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Connection with Pairing Code (alternative to QR)
  // ---------------------------------------------------------------------------
  async createConnectionWithPairingCode(
    config: ConnectionConfig,
    phoneNumber: string
  ): Promise<{ sock: WASocket; pairingCode: string }> {
    const {
      sessionId,
      browser = 'CALTEX MD',
      syncFullHistory = false,
      markOnlineOnConnect = true,
      autoReconnect = true,
      maxReconnectAttempts = 10,
      reconnectBaseDelay = 2000,
    } = config;

    this.configs.set(sessionId, config);
    this.reconnectAttempts.set(sessionId, 0);

    const authFolder = this.getAuthFolder(sessionId);
    const { state, saveCreds } = await initAuthState(authFolder);
    const { version } = await fetchLatestBaileysVersion();

    this.globalLogger.info({ sessionId, version, phoneNumber }, 'Creating WhatsApp connection with pairing code');

    const socketConfig: UserFacingSocketConfig = {
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, this.globalLogger),
      },
      printQRInTerminal: false,
      browser: Browsers.appropriate(browser),
      syncFullHistory,
      markOnlineOnConnect,
      logger: this.globalLogger.child({ sessionId }),
      generateHighQualityLinkPreview: true,
      shouldIgnoreJid: (jid: string) => {
        const isGroup = jid.endsWith('@g.us');
        const isBroadcast = jid === 'status@broadcast';
        const isNewsletter = jid.includes('@newsletter');
        const isUser = jid.endsWith('@s.whatsapp.net');
        return !isGroup && !isBroadcast && !isUser && !isNewsletter;
      },
      getMessage: async (key: proto.IMessageKey) => {
        if (!key.remoteJid) return undefined;
        return undefined;
      },
    };

    const sock = makeWASocket(socketConfig);
    this.sockets.set(sessionId, sock);

    // Request pairing code after socket is created
    let pairingCode = '';
    try {
      pairingCode = await sock.requestPairingCode(phoneNumber);
      this.globalLogger.info({ sessionId, pairingCode }, 'Pairing code generated');
      this.emit('pairing.code', pairingCode, sessionId, phoneNumber);
    } catch (error: any) {
      this.globalLogger.error({ sessionId, error: error.message }, 'Failed to generate pairing code');
    }

    // --- Connection Update Handler (same as createConnection) ---
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.emit('qr.code', qr, sessionId);
      }

      if (connection === 'close') {
        const statusCode =
          lastDisconnect?.error?.output?.statusCode ??
          lastDisconnect?.error?.output?.payload?.statusCode ??
          0;
        const reason = lastDisconnect?.error?.message ?? 'Unknown reason';
        const shouldReconnect =
          statusCode !== DisconnectReason.loggedOut &&
          autoReconnect &&
          !this.isShuttingDown;

        this.globalLogger.warn({ sessionId, statusCode, reason, shouldReconnect }, 'Connection closed');
        this.connectionStates.set(sessionId, update);
        this.emit('connection.close', statusCode, reason, sessionId);
        this.emit('connection.update', update, sessionId);

        if (shouldReconnect) {
          const attempts = (this.reconnectAttempts.get(sessionId) ?? 0) + 1;
          this.reconnectAttempts.set(sessionId, attempts);

          if (attempts <= maxReconnectAttempts) {
            const delay = reconnectBaseDelay * Math.pow(2, attempts - 1) + Math.random() * 1000;
            this.globalLogger.info({ sessionId, attempts, delay: Math.round(delay) }, 'Reconnecting');
            const timer = setTimeout(() => {
              this.reconnectTimers.delete(sessionId);
              this.createConnection(config);
            }, delay);
            this.reconnectTimers.set(sessionId, timer);
          }
        } else if (statusCode === DisconnectReason.loggedOut) {
          this.globalLogger.info({ sessionId }, 'Logged out, clearing session');
          await this.sessionManager.deleteSession(sessionId);
        }
      } else if (connection === 'open') {
        this.reconnectAttempts.set(sessionId, 0);
        this.globalLogger.info({ sessionId }, 'Pairing code connection opened');
        this.connectionStates.set(sessionId, update);
        this.emit('connection.open', sessionId);
        this.emit('connection.update', update, sessionId);
      } else {
        this.connectionStates.set(sessionId, update);
        this.emit('connection.update', update, sessionId);
      }
    });

    // --- Credentials Update ---
    sock.ev.on('creds.update', () => {
      saveCreds();
    });

    // --- Forward events ---
    const eventMap: Record<string, string> = {
      'messages.upsert': 'messages.upsert',
      'messages.delete': 'messages.delete',
      'messages.update': 'messages.update',
      'messages.reaction': 'messages.reaction',
      'chats.upsert': 'chats.upsert',
      'chats.update': 'chats.update',
      'chats.delete': 'chats.delete',
      'contacts.upsert': 'contacts.upsert',
      'contacts.update': 'contacts.update',
      'group-participants.update': 'group.participants.update',
      'groups.update': 'group.update',
      'call': 'call',
      'presence.update': 'presence.update',
      'blocklist.set': 'blocklist.set',
      'blocklist.update': 'blocklist.update',
    };

    for (const [baileysEvent, botEvent] of Object.entries(eventMap)) {
      sock.ev.on(baileysEvent as any, (data: any) => {
        this.emit(botEvent, data, sessionId);
      });
    }

    return { sock, pairingCode };
  }

  // ---------------------------------------------------------------------------
  // Accessors
  // ---------------------------------------------------------------------------
  getSocket(sessionId: string): WASocket | undefined {
    return this.sockets.get(sessionId);
  }

  getConnectionState(sessionId: string): ConnectionState | undefined {
    return this.connectionStates.get(sessionId);
  }

  isConnected(sessionId: string): boolean {
    const state = this.connectionStates.get(sessionId);
    return state?.connection === 'open';
  }

  getReconnectAttempts(sessionId: string): number {
    return this.reconnectAttempts.get(sessionId) ?? 0;
  }

  listConnections(): string[] {
    return Array.from(this.sockets.keys());
  }

  // ---------------------------------------------------------------------------
  // Disconnect helpers
  // ---------------------------------------------------------------------------
  async disconnect(sessionId: string): Promise<void> {
    const timer = this.reconnectTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(sessionId);
    }
    const sock = this.sockets.get(sessionId);
    if (sock) {
      sock.end(undefined);
      this.sockets.delete(sessionId);
      this.globalLogger.info({ sessionId }, 'Disconnected');
    }
    this.connectionStates.delete(sessionId);
    this.reconnectAttempts.delete(sessionId);
  }

  async disconnectAll(): Promise<void> {
    this.isShuttingDown = true;
    for (const [sessionId, timer] of this.reconnectTimers) {
      clearTimeout(timer);
      this.reconnectTimers.delete(sessionId);
    }
    for (const [sessionId, sock] of this.sockets) {
      try {
        sock.end(undefined);
        this.globalLogger.info({ sessionId }, 'Disconnected during shutdown');
      } catch (err) {
        this.globalLogger.error({ sessionId, err }, 'Error disconnecting during shutdown');
      }
    }
    this.sockets.clear();
    this.connectionStates.clear();
    this.reconnectAttempts.clear();
  }

  // ---------------------------------------------------------------------------
  // Message helpers
  // ---------------------------------------------------------------------------
  async sendMessage(sessionId: string, jid: string, content: any, options?: any): Promise<any> {
    const sock = this.sockets.get(sessionId);
    if (!sock) {
      throw new Error(`No active connection for session: ${sessionId}`);
    }
    if (!this.isConnected(sessionId)) {
      throw new Error(`Session ${sessionId} is not connected`);
    }
    const result = await sock.sendMessage(jid, content, options);
    this.globalLogger.info({ sessionId, jid, messageType: Object.keys(content)[0] }, 'Message sent');
    return result;
  }

  async readMessages(sessionId: string, keys: any[]): Promise<void> {
    const sock = this.sockets.get(sessionId);
    if (!sock) throw new Error(`No active connection for session: ${sessionId}`);
    await sock.readMessages(keys);
  }

  async updatePresence(sessionId: string, jid: string, presence: any): Promise<void> {
    const sock = this.sockets.get(sessionId);
    if (!sock) throw new Error(`No active connection for session: ${sessionId}`);
    await sock.sendPresenceUpdate(presence, jid);
  }

  async getProfilePictureUrl(sessionId: string, jid: string): Promise<string | undefined> {
    const sock = this.sockets.get(sessionId);
    if (!sock) throw new Error(`No active connection for session: ${sessionId}`);
    try {
      return await sock.profilePictureUrl(jid, 'image');
    } catch {
      return undefined;
    }
  }
}

export { logger };
