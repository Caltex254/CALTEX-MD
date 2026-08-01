// ============================================================================
// CALTEX MD WhatsApp Bot - Connection Manager
// Uses Baileys for WhatsApp Multi-Device connection
// ============================================================================
//
// This is the canonical implementation of the WhatsApp pairing-code flow.
// It follows the official Baileys example pattern:
//   1. Create socket with makeWASocket()
//   2. If not registered, immediately call requestPairingCode(phone)
//   3. Wait for connection.update -> connection: 'open'
//   4. Save credentials on every creds.update event
//   5. Auto-reconnect on close unless DisconnectReason.loggedOut
//
// Key correctness requirements (DO NOT CHANGE without reading the comments):
//   - Browser MUST be Browsers.ubuntu('Chrome'). Using a custom name like
//     'CALTEX MD' makes Baileys send companion_platform_id=9 (OTHER_WEB_CLIENT)
//     which WhatsApp silently rejects — no popup appears on the user's phone.
//   - requestPairingCode() MUST be called immediately after makeWASocket(),
//     NOT after waiting for the QR event. Baileys queues the IQ internally
//     and sends it as soon as the WebSocket handshake completes.
//   - Only one socket per sessionId at any time (single-instance lock).
//   - Stale auth folders (creds.json exists but creds.registered=false)
//     MUST be deleted before starting a fresh pairing attempt.
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
import { Boom } from '@hapi/boom';
import { EventEmitter } from 'events';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { SessionManager } from './session-manager';
import { downloadSessionFromGithub, isGithubStorageConfigured } from './github-storage';
import type { ConnectionConfig, BotEvents } from './types';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
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

// Map DisconnectReason numeric codes to human-readable names for logging.
// Uses literal numeric keys because some DisconnectReason values collide
// (e.g. connectionLost and timedOut both === 408).
const DISCONNECT_REASON_NAMES: Record<number, string> = {
  500: 'badSession',
  428: 'connectionClosed',
  408: 'timedOut/connectionLost',
  440: 'connectionReplaced',
  401: 'loggedOut',
  515: 'restartRequired',
  411: 'multideviceMismatch',
  403: 'forbidden',
  503: 'unavailableService',
};

export class ConnectionManager extends EventEmitter {
  private sockets: Map<string, WASocket> = new Map();
  private connectionStates: Map<string, ConnectionState> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private sessionManager: SessionManager;
  private configs: Map<string, ConnectionConfig> = new Map();
  private authFolders: Map<string, string> = new Map();
  // Single-instance lock: prevents multiple simultaneous sockets for the same sessionId.
  // Without this, a reconnect during pairing could create two sockets that race
  // for the same auth folder and corrupt the credentials.
  private connectingLocks: Set<string> = new Set();
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

  // Delete the auth folder for a session. Used when stale credentials are
  // detected (creds.json exists but creds.registered is false) so the next
  // pairing attempt starts completely fresh.
  private cleanAuthFolder(sessionId: string): void {
    const folder = this.authFolders.get(sessionId) || join(process.cwd(), 'auth_info_baileys', sessionId);
    if (existsSync(folder)) {
      this.globalLogger.warn({ sessionId, folder }, '[AUTH] Cleaning stale auth folder');
      try {
        rmSync(folder, { recursive: true, force: true });
      } catch (err: any) {
        this.globalLogger.error({ sessionId, err: err.message }, '[AUTH] Failed to clean auth folder');
      }
    }
    mkdirSync(folder, { recursive: true });
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

    // Single-instance lock — if a connection is already being established for
    // this sessionId, return the existing socket (if any) instead of creating
    // a duplicate.
    if (this.connectingLocks.has(sessionId)) {
      this.globalLogger.warn({ sessionId }, '[LOCK] Connection already in progress — skipping duplicate createConnection()');
      const existing = this.sockets.get(sessionId);
      if (existing) return existing;
    }
    if (this.sockets.has(sessionId)) {
      this.globalLogger.warn({ sessionId }, '[LOCK] Socket already exists — returning existing instance');
      return this.sockets.get(sessionId)!;
    }
    this.connectingLocks.add(sessionId);

    try {
      this.configs.set(sessionId, config);
      this.reconnectAttempts.set(sessionId, 0);

      const authFolder = this.getAuthFolder(sessionId);

      // ── Restore credentials from GitHub if needed ──
      const caltexSessionId = process.env.BOT_SESSION_ID;
      const credsFile = join(authFolder, 'creds.json');
      this.globalLogger.info({
        sessionId,
        caltexSessionId: caltexSessionId || '(not set)',
        authFolder,
        credsFileExists: existsSync(credsFile),
      }, '[LIFECYCLE] Loading credentials...');

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

      this.globalLogger.info({ authFolder }, '[LIFECYCLE] Initializing Baileys auth state from folder...');
      const { state, saveCreds } = await initAuthState(authFolder);
      this.globalLogger.info({
        hasCreds: !!state?.creds,
        registered: !!state?.creds?.registered,
        hasMe: !!state?.creds?.me,
        meId: state?.creds?.me?.id,
      }, '[LIFECYCLE] Baileys auth state loaded');

      // ── Stale auth detection ──
      // If creds.json exists but creds.registered is false, the previous
      // pairing attempt failed. The stale noiseKey/identityKey would cause
      // the next pairing attempt to silently fail. Delete the folder and
      // re-init the auth state.
      if (existsSync(credsFile) && !state?.creds?.registered) {
        this.globalLogger.warn({ sessionId, credsFile }, '[LIFECYCLE] Stale credentials detected (creds.json exists but registered=false) — cleaning folder for fresh pairing');
        this.cleanAuthFolder(sessionId);
        // Re-init auth state from the now-empty folder
        const fresh = await initAuthState(authFolder);
        return await this.finishConnection(
          config, sessionId, fresh.state, fresh.saveCreds,
          { printQR, browser, syncFullHistory, markOnlineOnConnect, autoReconnect, maxReconnectAttempts, reconnectBaseDelay }
        );
      }

      return await this.finishConnection(
        config, sessionId, state, saveCreds,
        { printQR, browser, syncFullHistory, markOnlineOnConnect, autoReconnect, maxReconnectAttempts, reconnectBaseDelay }
      );
    } finally {
      this.connectingLocks.delete(sessionId);
    }
  }

  // Shared socket-creation logic used by both fresh and restored auth states.
  private async finishConnection(
    config: ConnectionConfig,
    sessionId: string,
    state: any,
    saveCreds: () => Promise<void>,
    opts: {
      printQR: boolean;
      browser: string;
      syncFullHistory: boolean;
      markOnlineOnConnect: boolean;
      autoReconnect: boolean;
      maxReconnectAttempts: number;
      reconnectBaseDelay: number;
    },
  ): Promise<WASocket> {
    // fetchLatestBaileysVersion with 10s timeout (was hanging on slow networks)
    let version: [number, number, number] = [2, 3000, 1015];
    try {
      const versionPromise = fetchLatestBaileysVersion();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('fetchLatestBaileysVersion timeout after 10s')), 10000)
      );
      const result = await Promise.race([versionPromise, timeoutPromise]);
      version = result.version;
      this.globalLogger.info({ version: version.join('.'), isLatest: (result as any).isLatest }, '[LIFECYCLE] Fetched latest Baileys WhatsApp version');
    } catch (versionErr: any) {
      this.globalLogger.warn({ err: versionErr?.message ?? String(versionErr), fallback: version.join('.') }, '[LIFECYCLE] Using fallback Baileys version (fetch failed or timed out)');
    }

    this.globalLogger.info({ sessionId, version: version.join('.'), printQR: opts.printQR, browser: opts.browser }, '[LIFECYCLE] Creating Baileys WebSocket socket...');

    const socketConfig: UserFacingSocketConfig = {
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, this.globalLogger),
      },
      // CRITICAL: browser MUST be ['Ubuntu', 'Chrome', '22.04.4'].
      // The second element ('Chrome') is what Baileys sends as companion_platform_display
      // and is used by getCompanionWebClientType() to determine the platform ID.
      // 'Chrome' -> platform ID 1 (CHROME) — WhatsApp accepts this.
      // Any custom name like 'CALTEX MD' -> platform ID 9 (OTHER_WEB_CLIENT) —
      // WhatsApp SILENTLY REJECTS the pairing (no popup on the user's phone).
      browser: Browsers.ubuntu('Chrome'),
      syncFullHistory: opts.syncFullHistory,
      markOnlineOnConnect: opts.markOnlineOnConnect,
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

    // ── Connection Update Handler ──
    // Logs EVERY field of connection.update so we can debug pairing failures.
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr, receivedPendingNotifications, isNewLogin } = update;

      // Compute human-readable disconnect reason name if available
      const errAny = lastDisconnect?.error as any;
      const statusCode =
        errAny?.output?.statusCode ??
        errAny?.output?.payload?.statusCode ??
        0;
      const reasonName = DISCONNECT_REASON_NAMES[statusCode] || (statusCode ? `unknown(${statusCode})` : null);

      this.globalLogger.info({
        sessionId,
        connection: connection || null,
        hasQr: !!qr,
        hasLastDisconnect: !!lastDisconnect,
        lastDisconnectErrorCode: errAny?.output?.statusCode ?? null,
        lastDisconnectErrorMessage: lastDisconnect?.error?.message ?? null,
        lastDisconnectReasonName: reasonName,
        isNewLogin: !!isNewLogin,
        receivedPendingNotifications: !!receivedPendingNotifications,
      }, '[LIFECYCLE] connection.update event');

      if (qr) {
        this.globalLogger.info({ sessionId, qrLength: qr.length }, '[LIFECYCLE] QR code received - scan with WhatsApp to pair');
        if (opts.printQR) {
          qrcode.generate(qr, { small: true });
        }
        this.emit('qr.code', qr, sessionId);
      }

      if (connection === 'close') {
        const reason = lastDisconnect?.error?.message ?? 'Unknown reason';
        this.globalLogger.warn({
          sessionId,
          statusCode,
          reasonName,
          reason,
          errorOutput: errAny?.output,
        }, '[LIFECYCLE] connection.close - WhatsApp disconnected');

        // Clean up the socket from our map immediately
        this.sockets.delete(sessionId);
        this.connectionStates.set(sessionId, update as ConnectionState);
        this.emit('connection.close', statusCode, reason, sessionId);
        this.emit('connection.update', update, sessionId);

        // Decide whether to reconnect
        const shouldReconnect =
          statusCode !== DisconnectReason.loggedOut &&
          opts.autoReconnect &&
          !this.isShuttingDown;

        if (shouldReconnect) {
          const attempts = (this.reconnectAttempts.get(sessionId) ?? 0) + 1;
          this.reconnectAttempts.set(sessionId, attempts);

          if (attempts <= opts.maxReconnectAttempts) {
            const delay = opts.reconnectBaseDelay * Math.pow(2, Math.min(attempts - 1, 5)) + Math.random() * 1000;
            this.globalLogger.info({ sessionId, attempts, delay: Math.round(delay), reasonName }, '[LIFECYCLE] Reconnecting with exponential backoff');
            const timer = setTimeout(() => {
              this.reconnectTimers.delete(sessionId);
              this.createConnection(config).catch((err: any) => {
                this.globalLogger.error({ sessionId, err: err.message }, '[LIFECYCLE] Reconnect attempt failed');
              });
            }, delay);
            this.reconnectTimers.set(sessionId, timer);
          } else {
            this.globalLogger.error({ sessionId, attempts }, '[LIFECYCLE] Max reconnect attempts reached');
          }
        } else if (statusCode === DisconnectReason.loggedOut) {
          this.globalLogger.info({ sessionId }, '[LIFECYCLE] Logged out by user — clearing session and auth folder');
          // Delete the auth folder so the next start is a fresh pairing
          this.cleanAuthFolder(sessionId);
          await this.sessionManager.deleteSession(sessionId);
        } else {
          this.globalLogger.warn({ sessionId, reasonName, statusCode }, '[LIFECYCLE] Not reconnecting (autoReconnect disabled or shutting down)');
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
        this.connectionStates.set(sessionId, update as ConnectionState);
        this.emit('connection.open', sessionId);
        this.emit('connection.update', update, sessionId);

        // Send "BOT CONNECTED SUCCESSFULLY" WhatsApp message
        this.sendConnectionSuccessMessage(sessionId).catch((err: any) => {
          this.globalLogger.error({ sessionId, err: err?.message ?? String(err) }, 'Success message send failed (non-blocking)');
        });
      } else {
        this.connectionStates.set(sessionId, update as ConnectionState);
        this.emit('connection.update', update, sessionId);
      }
    });

    // ── Credentials Update ──
    // Save creds IMMEDIATELY on every update event. This is critical —
    // Baileys emits creds.update many times during pairing (noise key,
    // identity key, signal keys, etc.) and each must be persisted or
    // the next reconnect will fail.
    sock.ev.on('creds.update', async (creds) => {
      this.globalLogger.debug({
        sessionId,
        hasMe: !!creds?.me,
        registered: !!creds?.registered,
        hasPairingCode: !!creds?.pairingCode,
      }, '[LIFECYCLE] creds.update — saving credentials');
      try {
        await saveCreds();
      } catch (err: any) {
        this.globalLogger.error({ sessionId, err: err.message }, '[LIFECYCLE] Failed to save credentials');
      }
      this.emit('creds.update', creds, sessionId);
    });

    // ── Forward all Baileys events through EventEmitter ──
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
  // Pairing Code Support (legacy single-shot method, kept for API compatibility)
  // ---------------------------------------------------------------------------
  async requestPairingCode(sessionId: string, phoneNumber: string): Promise<string> {
    const sock = this.sockets.get(sessionId);
    if (!sock) {
      throw new Error(`No active connection for session: ${sessionId}`);
    }
    try {
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
  // Connection with Pairing Code — the canonical Pterodactyl first-start flow
  // ---------------------------------------------------------------------------
  // CRITICAL FIX (v1.5.0): Previously, requestPairingCode() was called
  // IMMEDIATELY after makeWASocket() — but the WebSocket was not yet open.
  // Baileys' sendNode() checks ws.isOpen and throws "Connection Closed"
  // synchronously when the WS is not open, which caused:
  //   1. requestPairingCode() to throw "Connection Closed"
  //   2. BUT authState.creds.me was already set (Baileys sets it BEFORE sendNode)
  //   3. creds.update fired and saved creds with me.id set but registered=false
  //   4. WS then opened, Baileys tried to log in with these half-baked creds
  //   5. WhatsApp rejected with CB:failure reason=401 ("Connection Failure")
  //   6. Code misinterpreted 401 as loggedOut and just cleared the session
  //
  // The fix:
  //   1. Wait for the `qr` event BEFORE calling requestPairingCode().
  //      The `qr` event fires AFTER: WS open → noise handshake → WhatsApp
  //      responds with QR ref. This guarantees the WS is ready.
  //   2. If requestPairingCode() throws or the connection closes before
  //      pairing succeeds, do NOT treat 401 as loggedOut. Instead, clean
  //      up and signal the caller to retry with a fresh phone number.
  //   3. Track pairing success via creds.registered flag, not via the
  //      connection.close statusCode (which can be 401 during failed pairing).
  //
  // This method:
  //   1. Acquires single-instance lock
  //   2. Cleans any stale auth folder
  //   3. Creates a fresh Baileys socket with Browsers.ubuntu('Chrome')
  //   4. Waits for the `qr` event (60s timeout) — this is the WhatsApp ack
  //   5. Calls sock.requestPairingCode(phone) — code is returned locally
  //   6. Returns the code to the caller IMMEDIATELY (no ack wait — the
  //      `qr` event was already the ack)
  //   7. Tracks pairing success via creds.registered + connection.open
  //   8. On close:
  //      - If pairing succeeded (registered=true) and 401 → loggedOut
  //      - If pairing failed (registered=false) and 401 → pairing failure
  //        (clean up, signal caller to re-prompt for phone number)
  //      - Other statusCodes → auto-reconnect with backoff
  async createConnectionWithPairingCode(
    config: ConnectionConfig,
    phoneNumber: string
  ): Promise<{ sock: WASocket; pairingCode: string; pairingFailed: boolean }> {
    const {
      sessionId,
      browser = 'CALTEX MD',
      syncFullHistory = false,
      markOnlineOnConnect = true,
      autoReconnect = true,
      maxReconnectAttempts = 10,
      reconnectBaseDelay = 2000,
    } = config;

    // ── Single-instance lock ──
    if (this.connectingLocks.has(sessionId)) {
      this.globalLogger.warn({ sessionId }, '[PAIRING] Connection already in progress — aborting duplicate requestPairingCode()');
      const existing = this.sockets.get(sessionId);
      if (existing) return { sock: existing, pairingCode: '', pairingFailed: false };
    }
    if (this.sockets.has(sessionId)) {
      this.globalLogger.warn({ sessionId }, '[PAIRING] Socket already exists — closing it before starting fresh pairing');
      try {
        this.sockets.get(sessionId)!.end(undefined);
      } catch {}
      this.sockets.delete(sessionId);
    }
    this.connectingLocks.add(sessionId);

    try {
      this.configs.set(sessionId, config);
      this.reconnectAttempts.set(sessionId, 0);

      const authFolder = this.getAuthFolder(sessionId);

      // ── Clean any stale auth folder ──
      // ALWAYS start with a clean folder for the pairing flow.
      // Stale noiseKey/identityKey from a previous failed attempt would
      // cause WhatsApp to reject the new pairing with 401.
      const credsFile = join(authFolder, 'creds.json');
      if (existsSync(credsFile)) {
        this.globalLogger.warn({ sessionId, credsFile }, '[PAIRING] Existing creds.json found — cleaning folder for fresh pairing');
        this.cleanAuthFolder(sessionId);
      }

      this.globalLogger.info({ sessionId, phoneNumber, authFolder }, '[PAIRING] Initializing fresh Baileys auth state...');
      const { state, saveCreds } = await initAuthState(authFolder);
      this.globalLogger.info({
        hasCreds: !!state?.creds,
        registered: !!state?.creds?.registered,
      }, '[PAIRING] Auth state initialized');

      // ── Fetch latest Baileys version ──
      let version: [number, number, number] = [2, 3000, 1015];
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

      this.globalLogger.info({ sessionId, version: version.join('.'), phoneNumber }, '[PAIRING] Creating WhatsApp socket for pairing code flow');

      const socketConfig: UserFacingSocketConfig = {
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, this.globalLogger),
        },
        // CRITICAL: Browsers.ubuntu('Chrome') — NOT Browsers.ubuntu('CALTEX MD').
        // The browser name's second element ('Chrome') is what Baileys sends
        // as companion_platform_display. 'Chrome' → platform ID 1 (CHROME).
        // Any custom name like 'CALTEX MD' → platform ID 9 (OTHER_WEB_CLIENT)
        // which WhatsApp SILENTLY REJECTS (no popup on user's phone).
        browser: Browsers.ubuntu('Chrome'),
        syncFullHistory,
        markOnlineOnConnect,
        // 5 minutes — gives the user time to open WhatsApp and enter the code.
        connectTimeoutMs: 300_000,
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

      // ── State tracking ──
      // pairingSucceeded: set to true ONLY when connection.open fires OR
      //                   creds.registered becomes true. Used to distinguish
      //                   a real loggedOut (post-success 401) from a pairing
      //                   failure (pre-success 401).
      // qrReceived: resolves the waitForQR promise. The `qr` event is the
      //             WhatsApp server's acknowledgement that the connection
      //             is established and ready for the pairing IQ.
      // connectionClosedPreQR: set if connection closes before QR arrives.
      let pairingSucceeded = false;
      let connectionClosedPreQR = false;
      let connectionClosedPreSuccess = false;
      let closeStatusCode = 0;
      let closeReason = '';
      let qrResolve: (() => void) | null = null;
      let qrReject: ((err: Error) => void) | null = null;

      // Promise that resolves when the first `qr` event fires OR rejects
      // when the connection closes before QR arrives. The actual event
      // listener is registered in the connection.update handler below
      // (single handler, no duplicate listeners).
      const waitForQR = new Promise<void>((resolve, reject) => {
        qrResolve = resolve;
        qrReject = reject;
      });

      // ── Connection Update Handler ──
      // Single handler that:
      //   - Resolves waitForQR when qr event fires
      //   - Rejects waitForQR if connection closes before QR
      //   - Tracks pairingSucceeded for proper 401 handling
      //   - Auto-reconnects on transient failures
      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr, isNewLogin, receivedPendingNotifications } = update;
        const errAny = lastDisconnect?.error as any;
        const statusCode =
          errAny?.output?.statusCode ??
          errAny?.output?.payload?.statusCode ??
          0;
        const reasonName = DISCONNECT_REASON_NAMES[statusCode] || (statusCode ? `unknown(${statusCode})` : null);

        // Log EVERY connection.update event with all fields for debugging
        this.globalLogger.info({
          sessionId,
          connection: connection || null,
          hasQr: !!qr,
          hasLastDisconnect: !!lastDisconnect,
          lastDisconnectErrorCode: statusCode || null,
          lastDisconnectReasonName: reasonName,
          lastDisconnectErrorMessage: lastDisconnect?.error?.message ?? null,
          isNewLogin: !!isNewLogin,
          receivedPendingNotifications: !!receivedPendingNotifications,
          pairingSucceeded,
        }, '[PAIRING] connection.update event');

        if (qr) {
          // The QR event fires after WS open + noise handshake + WhatsApp response.
          // This is the canonical "ready to pair" signal. We don't display the QR
          // (we're using pairing code instead), but we use this event to know
          // that requestPairingCode() can now be called safely.
          this.globalLogger.info({ sessionId, qrLength: qr.length }, '[PAIRING] QR event received — connection is ready for pairing code request');
          if (qrResolve) {
            qrResolve();
            qrResolve = null;
            qrReject = null;
          }
        }

        if (connection === 'close') {
          const reason = lastDisconnect?.error?.message ?? 'Unknown reason';
          this.globalLogger.warn({
            sessionId,
            statusCode,
            reasonName,
            reason,
            pairingSucceeded,
            errorOutput: errAny?.output,
          }, '[PAIRING] Connection closed');

          if (!pairingSucceeded) {
            connectionClosedPreSuccess = true;
            closeStatusCode = statusCode;
            closeReason = reason;
            // If QR hasn't fired yet, reject the waitForQR promise so the
            // caller doesn't hang waiting for an event that will never come.
            if (qrReject) {
              connectionClosedPreQR = true;
              qrReject(new Error(`Connection closed before QR event: ${statusCode} ${reason}`));
              qrResolve = null;
              qrReject = null;
            }
          }

          this.sockets.delete(sessionId);
          this.connectionStates.set(sessionId, update as ConnectionState);
          this.emit('connection.close', statusCode, reason, sessionId);
          this.emit('connection.update', update, sessionId);

          // Decide whether to reconnect.
          // IMPORTANT: A 401 BEFORE pairing succeeded is NOT a loggedOut event.
          // It means WhatsApp rejected the pairing request (rate limit, bad
          // creds, race condition, etc.). We clean up the auth folder so the
          // next pairing attempt starts fresh, but we do NOT call
          // sessionManager.deleteSession (the user may want to retry).
          const isPairingFailure401 = (statusCode === DisconnectReason.loggedOut) && !pairingSucceeded;

          if (isPairingFailure401) {
            this.globalLogger.warn({ sessionId, statusCode, reason }, '[PAIRING] 401 during pairing (before success) — treating as pairing failure, NOT loggedOut. Cleaning auth folder for retry.');
            this.cleanAuthFolder(sessionId);
            // Do NOT auto-reconnect here. The caller (index.ts) will handle
            // re-prompting the user for a phone number and retrying.
          } else if (statusCode === DisconnectReason.loggedOut) {
            // Real loggedOut — pairing had succeeded earlier, then user unlinked
            this.globalLogger.info({ sessionId }, '[PAIRING] Logged out by user (post-success) — clearing session and auth folder');
            this.cleanAuthFolder(sessionId);
            await this.sessionManager.deleteSession(sessionId);
          } else if (autoReconnect && !this.isShuttingDown) {
            // Other close reasons (408, 428, 515, etc.) — auto-reconnect
            const attempts = (this.reconnectAttempts.get(sessionId) ?? 0) + 1;
            this.reconnectAttempts.set(sessionId, attempts);
            if (attempts <= maxReconnectAttempts) {
              const delay = reconnectBaseDelay * Math.pow(2, Math.min(attempts - 1, 5)) + Math.random() * 1000;
              this.globalLogger.info({ sessionId, attempts, delay: Math.round(delay), reasonName }, '[PAIRING] Reconnecting with exponential backoff');
              const timer = setTimeout(() => {
                this.reconnectTimers.delete(sessionId);
                // After a pairing failure, fall back to regular createConnection
                // which will detect stale creds and clean them.
                this.createConnection(config).catch((err: any) => {
                  this.globalLogger.error({ sessionId, err: err.message }, '[PAIRING] Reconnect failed');
                });
              }, delay);
              this.reconnectTimers.set(sessionId, timer);
            } else {
              this.globalLogger.error({ sessionId, attempts }, '[PAIRING] Max reconnect attempts reached');
            }
          }
        } else if (connection === 'open') {
          this.reconnectAttempts.set(sessionId, 0);
          pairingSucceeded = true;
          const openCreds = sock.authState?.creds;
          this.globalLogger.info({
            sessionId,
            registered: !!openCreds?.registered,
            meId: openCreds?.me?.id,
            platform: openCreds?.platform,
          }, '[PAIRING] connection.open — WhatsApp paired successfully, bot is now an active linked device');
          this.connectionStates.set(sessionId, update as ConnectionState);
          this.emit('connection.open', sessionId);
          this.emit('connection.update', update, sessionId);
          // Send "BOT CONNECTED SUCCESSFULLY" WhatsApp message + Session ID
          this.sendConnectionSuccessMessage(sessionId).catch((err: any) => {
            this.globalLogger.error({ sessionId, err: err?.message ?? String(err) }, '[PAIRING] Success message send failed (non-blocking)');
          });
        } else {
          this.connectionStates.set(sessionId, update as ConnectionState);
          this.emit('connection.update', update, sessionId);
        }
      });

      // ── Save credentials on every update ──
      sock.ev.on('creds.update', async (creds) => {
        // Track pairing success: if creds.registered becomes true, the
        // pairing was successful (even if connection.open hasn't fired yet).
        if (creds?.registered && !pairingSucceeded) {
          pairingSucceeded = true;
          this.globalLogger.info({ sessionId }, '[PAIRING] creds.update marked registered=true — pairing succeeded');
        }
        this.globalLogger.debug({
          sessionId,
          hasMe: !!creds?.me,
          registered: !!creds?.registered,
          hasPairingCode: !!creds?.pairingCode,
        }, '[PAIRING] creds.update — saving credentials');
        try {
          await saveCreds();
        } catch (err: any) {
          this.globalLogger.error({ sessionId, err: err.message }, '[PAIRING] Failed to save credentials');
        }
        this.emit('creds.update', creds, sessionId);
      });

      // ── Forward all Baileys events ──
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

      // ── Wait for the QR event before calling requestPairingCode() ──
      // The QR event is the WhatsApp server's acknowledgement that:
      //   1. WebSocket is open
      //   2. Noise handshake is complete
      //   3. WhatsApp has accepted the connection
      //   4. The connection is ready to receive the pairing IQ
      //
      // Calling requestPairingCode() BEFORE this event causes a race condition
      // where sendNode() throws "Connection Closed" because ws.isOpen is false.
      this.globalLogger.info({ sessionId, phoneNumber }, '[PAIRING] Waiting for QR event (WhatsApp ack) before calling requestPairingCode()...');
      try {
        await Promise.race([
          waitForQR,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timed out waiting for QR event after 60s')), 60_000)
          ),
        ]);
      } catch (qrWaitErr: any) {
        this.globalLogger.error({ sessionId, phoneNumber, err: qrWaitErr.message }, '[PAIRING] Failed to receive QR event — connection may have closed before WhatsApp ack');
        // If the connection closed before QR, clean up and signal failure
        if (connectionClosedPreQR || connectionClosedPreSuccess) {
          this.cleanAuthFolder(sessionId);
        }
        return { sock, pairingCode: '', pairingFailed: true };
      }

      // ── Connection is ready — request the pairing code ──
      // Per Baileys source (socket.js line 351-400):
      //   1. requestPairingCode() generates the code locally (randomBytes)
      //   2. Sets authState.creds.me = { id: phoneNumber@s.whatsapp.net, name: '~' }
      //   3. Emits creds.update (saves the half-baked creds)
      //   4. Calls sendNode() to send the link_code_companion_reg IQ
      //   5. Returns the code
      //
      // The `qr` event has fired, so ws.isOpen is true and sendNode() will
      // succeed. The IQ is sent to WhatsApp, which stores the pairing request
      // and waits for the user to enter the code on their phone.
      this.globalLogger.info({ sessionId, phoneNumber }, '[PAIRING] Calling requestPairingCode() — WebSocket is open, IQ will be sent immediately');
      let pairingCode = '';
      try {
        pairingCode = await sock.requestPairingCode(phoneNumber);
        this.globalLogger.info({ sessionId, phoneNumber, pairingCode }, '[PAIRING] requestPairingCode() returned successfully — IQ sent to WhatsApp servers');
        this.emit('pairing.code', pairingCode, sessionId, phoneNumber);
      } catch (err: any) {
        this.globalLogger.error({ sessionId, phoneNumber, err: err.message }, '[PAIRING] requestPairingCode() threw an error — cleaning auth folder for retry');
        // Clean up the half-baked creds that requestPairingCode() saved
        this.cleanAuthFolder(sessionId);
        // Close the socket so it doesn't try to log in with bad creds
        try { sock.end(undefined); } catch {}
        this.sockets.delete(sessionId);
        return { sock, pairingCode: '', pairingFailed: true };
      }

      // ── Return the code immediately ──
      // We do NOT need to wait for an additional ack — the `qr` event was
      // already the ack that the connection is ready. The IQ was sent
      // synchronously inside requestPairingCode(), and WhatsApp has stored
      // the pairing request. The user can now enter the code on their phone,
      // and the connection.update handler will fire `connection: 'open'`
      // when pairing completes.
      this.globalLogger.info({ sessionId, phoneNumber, pairingCode }, '[PAIRING] Pairing code generated successfully — display to user and wait for confirmation on phone');

      return { sock, pairingCode, pairingFailed: false };
    } finally {
      this.connectingLocks.delete(sessionId);
    }
  }

  // ---------------------------------------------------------------------------
  // Check if a session is currently in the middle of pairing (registered=false
  // but me.id is set). Used by index.ts to decide whether to retry pairing.
  // ---------------------------------------------------------------------------
  isPairingInProgress(sessionId: string): boolean {
    const sock = this.sockets.get(sessionId);
    if (!sock) return false;
    const creds = sock.authState?.creds;
    return !!creds?.me && !creds?.registered;
  }

  // ---------------------------------------------------------------------------
  // Check if a session has successfully paired (registered=true).
  // ---------------------------------------------------------------------------
  isPaired(sessionId: string): boolean {
    const sock = this.sockets.get(sessionId);
    if (!sock) return false;
    const creds = sock.authState?.creds;
    return !!creds?.registered;
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
  // Also sends the Session ID so the user can identify this bot instance.
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
Type .menu to see available commands.

Thank you for using CALTEX MD ❤️

━━━━━━━━━━━━━━━━━━`;

      // Small delay to ensure socket is fully ready for sending
      await new Promise(resolve => setTimeout(resolve, 2000));

      await sock.sendMessage(jid, { text: message });
      this.globalLogger.info({ sessionId, phoneNumber, jid, caltexSessionId }, 'WhatsApp success message + Session ID sent to linked account');
    } catch (err: any) {
      this.globalLogger.error({ sessionId, err: err?.message ?? String(err) }, 'Failed to send WhatsApp success message (non-blocking)');
    }
  }
}

export { logger };
