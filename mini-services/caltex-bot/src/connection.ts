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
import { downloadSessionFromGithub, isGithubStorageConfigured } from './github-storage';
import type { ConnectionConfig, BotEvents } from './types';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  // Multistream: write pretty logs to stdout (so Pterodactyl panel shows them
  // and startup detection works) AND raw JSON to bot.log (for debugging).
  transport: {
    targets: [
      {
        target: 'pino-pretty',
        level: process.env.LOG_LEVEL || 'info',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
          translateTime: 'SYS:standard',
          singleLine: false,
        },
      },
      {
        target: 'pino/file',
        level: process.env.LOG_LEVEL || 'info',
        options: { destination: join(process.cwd(), 'bot.log'), mkdir: true },
      },
    ],
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

    // ── STARTUP LOG: credential loading ──
    const caltexSessionId = process.env.BOT_SESSION_ID;
    const credsFile = join(authFolder, 'creds.json');
    this.globalLogger.info({
      sessionId,
      caltexSessionId: caltexSessionId || '(not set)',
      authFolder,
      credsFileExists: existsSync(credsFile),
    }, '[LIFECYCLE] Loading credentials...');

    // ── Free-tier persistence: restore credentials from GitHub if needed ──
    if (caltexSessionId && !existsSync(credsFile) && isGithubStorageConfigured()) {
      this.globalLogger.info({ sessionId, caltexSessionId, authFolder }, '[LIFECYCLE] Local creds missing - downloading from GitHub...');
      try {
        const result = await downloadSessionFromGithub(caltexSessionId, authFolder);
        this.globalLogger.info({
          sessionId,
          caltexSessionId,
          fileCount: result.fileCount,
          phoneNumber: result.phoneNumber,
        }, '[LIFECYCLE] Credentials downloaded from GitHub - bot will connect as linked device');
      } catch (restoreErr: any) {
        this.globalLogger.error({
          sessionId,
          caltexSessionId,
          err: restoreErr.message,
        }, '[LIFECYCLE] FAILED to restore credentials from GitHub - bot will fall back to QR pairing');
      }
    } else if (caltexSessionId && existsSync(credsFile)) {
      this.globalLogger.info({ sessionId, caltexSessionId }, '[LIFECYCLE] Local credentials found - skipping GitHub restore');
    } else if (!caltexSessionId) {
      this.globalLogger.warn({ sessionId }, '[LIFECYCLE] BOT_SESSION_ID not set - cannot restore from GitHub, will use QR pairing');
    }

    // ── STARTUP LOG: initializing Baileys auth state ──
    this.globalLogger.info({ authFolder }, '[LIFECYCLE] Initializing Baileys auth state from folder...');
    const { state, saveCreds } = await initAuthState(authFolder);
    this.globalLogger.info({
      hasCreds: !!state?.creds,
      registered: !!state?.creds?.registered,
      hasMe: !!state?.creds?.me,
      meId: state?.creds?.me?.id,
    }, '[LIFECYCLE] Baileys auth state loaded');

    // ── STARTUP LOG: fetching Baileys version (with timeout) ──
    let version: [number, number, number] = [2, 3000, 0]; // fallback
    try {
      const versionPromise = fetchLatestBaileysVersion();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('fetchLatestBaileysVersion timeout after 10s')), 10000)
      );
      const result = await Promise.race([versionPromise, timeoutPromise]);
      version = result.version;
      this.globalLogger.info({ version: version.join('.') }, '[LIFECYCLE] Fetched latest Baileys WhatsApp version');
    } catch (versionErr: any) {
      this.globalLogger.warn({ err: versionErr?.message ?? String(versionErr), fallback: version.join('.') }, '[LIFECYCLE] Using fallback Baileys version (fetch failed or timed out)');
    }

    this.globalLogger.info({ sessionId, version: version.join('.'), printQR, browser }, '[LIFECYCLE] Creating Baileys WebSocket socket (Node.js ws implementation)...');

    const socketConfig: UserFacingSocketConfig = {
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, this.globalLogger),
      },
      // printQRInTerminal removed — deprecated in Baileys.
      // QR codes are handled via the connection.update event -> qr.code event
      // and exposed via the /api/qr-image HTTP endpoint.
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
      const { connection, lastDisconnect, qr, receivedPendingNotifications, isNewLogin } = update;

      this.globalLogger.info({
        sessionId,
        connection: connection || null,
        hasQr: !!qr,
        hasLastDisconnect: !!lastDisconnect,
        isNewLogin: !!isNewLogin,
        receivedPendingNotifications: !!receivedPendingNotifications,
      }, '[LIFECYCLE] connection.update event received');

      if (qr) {
        this.globalLogger.info({ sessionId, qrLength: qr.length }, '[LIFECYCLE] QR code received - scan with WhatsApp to pair');
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
        this.globalLogger.warn({
          sessionId,
          statusCode,
          reason,
          errorOutput: lastDisconnect?.error?.output,
        }, '[LIFECYCLE] connection.close - WhatsApp disconnected, see statusCode/reason for details');
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
        const openCreds = sock.authState?.creds;
        this.globalLogger.info({
          sessionId,
          registered: !!openCreds?.registered,
          meId: openCreds?.me?.id,
          platform: openCreds?.platform,
        }, '[LIFECYCLE] connection.open - WhatsApp connection established, device is now an active linked device');
        this.connectionStates.set(sessionId, update);
        this.emit('connection.open', sessionId);
        this.emit('connection.update', update, sessionId);

        // Send "BOT CONNECTED SUCCESSFULLY" WhatsApp message
        // Only fires after connection.open AND auth is confirmed inside the method.
        // Non-blocking - failure to send doesn't affect the connection.
        this.sendConnectionSuccessMessage(sessionId).catch((err: any) => {
          this.globalLogger.error({ sessionId, err: err?.message ?? String(err) }, 'Success message send failed (non-blocking)');
        });
      } else {
        this.connectionStates.set(sessionId, update);
        this.emit('connection.update', update, sessionId);
      }
    });

    // --- Credentials Update ---
    sock.ev.on('creds.update', (creds) => {
      this.globalLogger.debug({ sessionId, hasMe: !!creds?.me, registered: !!creds?.registered }, '[LIFECYCLE] creds.update - saving credentials');
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
  // This method is the canonical pairing-code flow for Pterodactyl first-start:
  // 1. 10s timeout on fetchLatestBaileysVersion (was hanging on slow networks).
  // 2. markOnlineOnConnect = false — critical for pairing. If true, Baileys
  //    sends a presence update before the device is registered, and WhatsApp
  //    silently rejects the pairing (no popup on the user's phone).
  // 3. connectTimeoutMs = 300s (5 min) — gives the user time to type the code.
  // 4. Browsers.ubuntu('CALTEX MD') — stable, well-known browser identity.
  //    Browsers.appropriate() can return undefined on Alpine/musl.
  // 5. Waits for the 'qr' event before calling requestPairingCode() — calling
  //    it too early fails silently in some Baileys versions.
  // 6. 1.5s delay between QR event and requestPairingCode() call — lets the
  //    noise keypair fully register before requesting the code.
  // 7. Two retries with 3s/4s delays if requestPairingCode() throws.
  // 8. Forwards all events (messages.upsert etc.) so the bot replies to
  //    commands automatically after pairing succeeds.
  // 9. Saves credentials locally via creds.update so subsequent restarts work.
  async createConnectionWithPairingCode(
    config: ConnectionConfig,
    phoneNumber: string
  ): Promise<{ sock: WASocket; pairingCode: string }> {
    const {
      sessionId,
      browser = 'CALTEX MD',
      syncFullHistory = false,
      // IMPORTANT: markOnlineOnConnect MUST be false during the pairing flow.
      // Setting it to true causes Baileys to send a presence update before the
      // device is fully linked, which WhatsApp silently rejects — the user
      // then enters the pairing code in WhatsApp but no confirmation popup
      // appears because the session was never actually registered.
      markOnlineOnConnect = false,
      autoReconnect = true,
      maxReconnectAttempts = 10,
      reconnectBaseDelay = 2000,
    } = config;

    this.configs.set(sessionId, config);
    this.reconnectAttempts.set(sessionId, 0);

    const authFolder = this.getAuthFolder(sessionId);
    const { state, saveCreds } = await initAuthState(authFolder);

    // fetchLatestBaileysVersion with 10s timeout (was hanging on Pterodactyl)
    let version: [number, number, number] = [2, 3000, 0];
    try {
      const versionPromise = fetchLatestBaileysVersion();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('fetchLatestBaileysVersion timeout after 10s')), 10000)
      );
      const result = await Promise.race([versionPromise, timeoutPromise]);
      version = result.version;
      this.globalLogger.info({ version: version.join('.') }, '[PAIRING] Fetched latest Baileys version');
    } catch (versionErr: any) {
      this.globalLogger.warn({ err: versionErr?.message ?? String(versionErr), fallback: version.join('.') }, '[PAIRING] Using fallback Baileys version');
    }

    this.globalLogger.info({ sessionId, version: version.join('.'), phoneNumber }, '[PAIRING] Creating WhatsApp connection for pairing code flow');

    const socketConfig: UserFacingSocketConfig = {
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, this.globalLogger),
      },
      // Use a stable, well-known browser identity. Browsers.appropriate() can
      // resolve to an undefined platform on Alpine/musl, which causes Baileys
      // to send an empty device payload — WhatsApp then refuses the pairing.
      browser: Browsers.ubuntu(browser),
      syncFullHistory,
      markOnlineOnConnect,
      // 5 minutes — gives the user enough time to open WhatsApp, navigate to
      // Linked Devices, and type the pairing code without the socket closing.
      connectTimeoutMs: 300_000,
      logger: this.globalLogger.child({ sessionId }),
      generateHighQualityLinkPreview: true,
      // Respect device deletion events so a logged-out session doesn't try
      // to keep using stale credentials.
      shouldSyncHistoryMessage: () => true,
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

    // ── Pairing code generation ──
    // We wait for the QR event (Baileys fires it once the WebSocket handshake
    // is complete and the socket is ready to accept a pairing-code request).
    // Requesting before the QR event silently fails in Baileys 6.x.
    let pairingCode = ''
    let pairingCodeRequested = false;
    const pairingCodePromise = new Promise<string>((resolve) => {
      const onQr = async (_qr: string) => {
        if (pairingCodeRequested) return;
        pairingCodeRequested = true;
        try {
          // 1.5s delay — gives Baileys time to finish registering the noise
          //    keypair before we send the pairing-code request. Without this,
          //    some Baileys versions return a code that WhatsApp silently
          //    rejects (no popup on the user's phone).
          await new Promise((r) => setTimeout(r, 1500));
          const code = await sock.requestPairingCode(phoneNumber);
          pairingCode = code;
          this.globalLogger.info({ sessionId, pairingCode: code, phoneNumber }, '[PAIRING] Pairing code generated successfully');
          this.emit('pairing.code', code, sessionId, phoneNumber);
          resolve(code);
        } catch (error: any) {
          this.globalLogger.error({ sessionId, error: error.message }, '[PAIRING] Failed to generate pairing code on QR event — retrying in 3s');
          // Two retries with increasing delay. The first attempt can fail if
          // the socket hasn't fully finished the noise handshake.
          const tryRequest = async (attempt: number): Promise<string> => {
            try {
              const code = await sock.requestPairingCode(phoneNumber);
              pairingCode = code;
              this.globalLogger.info({ sessionId, pairingCode: code, attempt }, '[PAIRING] Pairing code generated on retry');
              this.emit('pairing.code', code, sessionId, phoneNumber);
              return code;
            } catch (err: any) {
              this.globalLogger.error({ sessionId, err: err.message, attempt }, '[PAIRING] Retry failed');
              return '';
            }
          };
          setTimeout(async () => {
            const code = await tryRequest(1);
            if (code) { resolve(code); return; }
            setTimeout(async () => {
              const code2 = await tryRequest(2);
              resolve(code2);
            }, 4000);
          }, 3000);
        }
      };
      sock.ev.on('connection.update', (update) => {
        if (update.qr) onQr(update.qr);
        // If connection opens without QR (creds already exist), resolve early.
        if (update.connection === 'open' && !pairingCode) resolve('');
      });
    });

    // --- Connection Update Handler (full event forwarding, same as createConnection) ---
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr, isNewLogin } = update;

      this.globalLogger.info({
        sessionId,
        connection: connection || null,
        hasQr: !!qr,
        isNewLogin: !!isNewLogin,
      }, '[PAIRING] connection.update event received');

      if (qr) {
        // Suppress QR display — we're using pairing code instead.
        // Do NOT emit qr.code event so the dashboard doesn't show a QR.
        this.globalLogger.info({ sessionId }, '[PAIRING] QR event received — pairing code will be requested instead of QR display');
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

        this.globalLogger.warn({ sessionId, statusCode, reason, shouldReconnect }, '[PAIRING] Connection closed');
        this.connectionStates.set(sessionId, update);
        this.emit('connection.close', statusCode, reason, sessionId);
        this.emit('connection.update', update, sessionId);

        if (shouldReconnect) {
          const attempts = (this.reconnectAttempts.get(sessionId) ?? 0) + 1;
          this.reconnectAttempts.set(sessionId, attempts);
          if (attempts <= maxReconnectAttempts) {
            const delay = reconnectBaseDelay * Math.pow(2, attempts - 1) + Math.random() * 1000;
            this.globalLogger.info({ sessionId, attempts, delay: Math.round(delay) }, '[PAIRING] Reconnecting with exponential backoff');
            const timer = setTimeout(() => {
              this.reconnectTimers.delete(sessionId);
              // On reconnect, use regular createConnection (creds are now saved locally)
              this.createConnection(config);
            }, delay);
            this.reconnectTimers.set(sessionId, timer);
          } else {
            this.globalLogger.error({ sessionId, attempts }, '[PAIRING] Max reconnect attempts reached');
          }
        } else if (statusCode === DisconnectReason.loggedOut) {
          this.globalLogger.info({ sessionId }, '[PAIRING] Logged out, clearing session');
          await this.sessionManager.deleteSession(sessionId);
        }
      } else if (connection === 'open') {
        this.reconnectAttempts.set(sessionId, 0);
        const openCreds = sock.authState?.creds;
        this.globalLogger.info({
          sessionId,
          registered: !!openCreds?.registered,
          meId: openCreds?.me?.id,
          platform: openCreds?.platform,
        }, '[PAIRING] connection.open — WhatsApp paired successfully, bot is now an active linked device');
        this.connectionStates.set(sessionId, update);
        this.emit('connection.open', sessionId);
        this.emit('connection.update', update, sessionId);
        // Send "BOT CONNECTED SUCCESSFULLY" WhatsApp message
        this.sendConnectionSuccessMessage(sessionId).catch((err: any) => {
          this.globalLogger.error({ sessionId, err: err?.message ?? String(err) }, '[PAIRING] Success message send failed (non-blocking)');
        });
      } else {
        this.connectionStates.set(sessionId, update);
        this.emit('connection.update', update, sessionId);
      }
    });

    // --- Credentials Update ---
    sock.ev.on('creds.update', (creds) => {
      this.globalLogger.debug({ sessionId, hasMe: !!creds?.me, registered: !!creds?.registered }, '[PAIRING] creds.update — saving credentials locally');
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

    // Wait for the pairing code to be generated. Give Baileys up to 90s to
    // deliver the QR event (slow networks can take 30-60s on Pterodactyl).
    const timeoutPromise = new Promise<string>((resolve) =>
      setTimeout(() => {
        this.globalLogger.warn({ sessionId }, '[PAIRING] Timed out waiting for pairing code generation — socket may have connected without QR');
        resolve('');
      }, 90_000)
    );
    pairingCode = await Promise.race([pairingCodePromise, timeoutPromise]);

    // If we got a code, log a very visible marker so the user knows the bot
    // is now waiting for them to enter it on their phone.
    if (pairingCode) {
      // eslint-disable-next-line no-console
      console.log('');
      // eslint-disable-next-line no-console
      console.log('  ┌─────────────────────────────────────────────────────────┐');
      // eslint-disable-next-line no-console
      console.log(`  │  Pairing code sent to WhatsApp servers for: ${phoneNumber}`);
      // eslint-disable-next-line no-console
      console.log(`  │  Code: ${pairingCode}`);
      // eslint-disable-next-line no-console
      console.log('  │  Waiting for you to enter it on your phone...');
      // eslint-disable-next-line no-console
      console.log('  └─────────────────────────────────────────────────────────┘');
      // eslint-disable-next-line no-console
      console.log('');
      this.globalLogger.info({ sessionId, phoneNumber, pairingCode }, '[PAIRING] Code dispatched — awaiting user confirmation on phone');
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

  // ---------------------------------------------------------------------------
  // Send "BOT CONNECTED SUCCESSFULLY" message to the linked WhatsApp account.
  // Only called AFTER connection.open fires AND creds.registered is confirmed.
  // ---------------------------------------------------------------------------
  async sendConnectionSuccessMessage(sessionId: string): Promise<void> {
    try {
      const sock = this.sockets.get(sessionId);
      if (!sock) {
        this.globalLogger.warn({ sessionId }, 'Cannot send success message - socket not found');
        return;
      }

      // Verify authentication is confirmed
      const creds = sock.authState?.creds;
      if (!creds || !creds.registered || !creds.me) {
        this.globalLogger.warn({
          sessionId,
          registered: !!creds?.registered,
          hasMe: !!creds?.me,
        }, 'Cannot send success message - authentication not confirmed');
        return;
      }

      // Extract phone number from creds.me.id (format: 254104906247:17@s.whatsapp.net)
      const meId: string = creds.me.id || '';
      const phoneNumber = meId.split('@')[0].split(':')[0];
      if (!phoneNumber) {
        this.globalLogger.warn({ sessionId, meId }, 'Cannot send success message - could not extract phone number');
        return;
      }

      const jid = `${phoneNumber}@s.whatsapp.net`;
      const caltexSessionId = process.env.BOT_SESSION_ID || sessionId;

      const message = `🤖 *CALTEX MD*

━━━━━━━━━━━━━━━━━━

✅ *BOT CONNECTED SUCCESSFULLY*

Congratulations! 🎉

Your CALTEX MD bot has been deployed successfully and is now online.

📱 Connected Number:
${phoneNumber}

🆔 Session ID:
${caltexSessionId}

🟢 Status:
ONLINE

Your bot is now ready to receive commands.

Thank you for using CALTEX MD ❤️

━━━━━━━━━━━━━━━━━━`;

      // Small delay to ensure socket is fully ready for sending
      await new Promise(resolve => setTimeout(resolve, 2000));

      await sock.sendMessage(jid, { text: message });
      this.globalLogger.info({ sessionId, phoneNumber, jid }, 'WhatsApp success message sent to linked account');
    } catch (err: any) {
      this.globalLogger.error({ sessionId, err: err?.message ?? String(err) }, 'Failed to send WhatsApp success message (non-blocking)');
    }
  }
}

export { logger };
