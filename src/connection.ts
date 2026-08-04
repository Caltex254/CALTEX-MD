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
  isJidGroup,
  isJidBroadcast,
  isJidNewsletter,
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
      // v1.6.1 FIX: Baileys calls shouldIgnoreJid from handleReceipt with an
      // undefined jid for some receipt events. Without the null guard, this
      // throws "TypeError: Cannot read properties of undefined (reading 'endsWith')"
      // which breaks receipt handling and spamms the logs. Return false (don't
      // ignore) when jid is missing so Baileys continues processing normally.
      shouldIgnoreJid: (jid: string | undefined | null) => {
        if (!jid || typeof jid !== 'string') return false;
        const isGroup = isJidGroup(jid);
        const isBroadcast = isJidBroadcast(jid) || jid === 'status@broadcast';
        const isNewsletter = isJidNewsletter(jid);
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
  // This method:
  //   1. Acquires the single-instance lock for the sessionId
  //   2. Cleans any stale auth folder
  //   3. Creates a fresh Baileys socket with Browsers.ubuntu('Chrome')
  //   4. Immediately calls sock.requestPairingCode(phone) — does NOT wait
  //      for the QR event (Baileys queues the IQ internally)
  //   5. Waits up to 5 seconds for an error response. If the connection
  //      closes in that window, WhatsApp rejected the pairing — we don't
  //      display the code. If the connection stays open, WhatsApp accepted
  //      the pairing request and will push a notification to the user's
  //      phone — we display the code.
  //   6. Sets up the same connection.update / creds.update handlers as
  //      createConnection() so the bot works correctly after pairing.
  //   7. Auto-reconnects on close (unless loggedOut).
  async createConnectionWithPairingCode(
    config: ConnectionConfig,
    phoneNumber: string
  ): Promise<{
    sock: WASocket;
    pairingCode: string;
    pairingFailed: boolean;
    failureReason: string;
    isRateLimited: boolean;
  }> {
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
      if (existing) return { sock: existing, pairingCode: '', pairingFailed: false, failureReason: '', isRateLimited: false };
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
      // If creds.json exists from a previous failed pairing attempt, the
      // stale noiseKey/identityKey would cause the new pairing to silently
      // fail. Always start with a clean folder for the pairing flow.
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
        // See comment in finishConnection() above for the full explanation.
        browser: Browsers.ubuntu('Chrome'),
        syncFullHistory,
        markOnlineOnConnect,
        // 5 minutes — gives the user time to open WhatsApp and enter the code.
        connectTimeoutMs: 300_000,
        logger: this.globalLogger.child({ sessionId }),
        generateHighQualityLinkPreview: true,
        // v1.6.1 FIX: Same null-safe shouldIgnoreJid as in finishConnection().
        shouldIgnoreJid: (jid: string | undefined | null) => {
          if (!jid || typeof jid !== 'string') return false;
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

      // ── Set up connection.update + creds.update handlers BEFORE calling
      //    requestPairingCode() so we don't miss any events. ──
      let pairingAcknowledged = false;
      let pairingRejected = false;
      let rejectionReason = '';
      // v1.7.0: Track specifically when WhatsApp sends 401 loggedOut / device_removed
      // during the pairing attempt. This means the server has rate-limited or
      // blacklisted this device — retrying immediately makes the rate-limit WORSE.
      let pairingRateLimited = false;
      let disconnectStatusCode = 0;

      sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr, isNewLogin } = update;
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
          lastDisconnectErrorCode: statusCode || null,
          lastDisconnectReasonName: reasonName,
          lastDisconnectErrorMessage: lastDisconnect?.error?.message ?? null,
          isNewLogin: !!isNewLogin,
        }, '[PAIRING] connection.update event');

        if (connection === 'close') {
          const reason = lastDisconnect?.error?.message ?? 'Unknown reason';
          this.globalLogger.error({
            sessionId,
            statusCode,
            reasonName,
            reason,
          }, '[PAIRING] Connection closed');

          pairingRejected = true;
          rejectionReason = `${reasonName || 'unknown'}: ${reason}`;
          disconnectStatusCode = statusCode;

          // v1.7.0: Detect 401 loggedOut specifically — this means WhatsApp
          // rate-limited or removed this device. DON'T auto-reconnect (makes
          // the rate-limit worse). The caller (index.ts) will exit cleanly.
          if (statusCode === DisconnectReason.loggedOut) {
            pairingRateLimited = true;
            this.globalLogger.error({
              sessionId,
              statusCode,
              reasonName,
              reason,
            }, '[PAIRING] WhatsApp rejected pairing (401 loggedOut / device_removed) — NOT retrying. Caller must exit cleanly.');
          }

          this.sockets.delete(sessionId);
          this.connectionStates.set(sessionId, update as ConnectionState);
          this.emit('connection.close', statusCode, reason, sessionId);
          this.emit('connection.update', update, sessionId);

          // v1.7.0: NEVER auto-reconnect during pairing. If the connection
          // closed during the pairing window, retrying immediately makes
          // rate-limiting worse. The caller (index.ts connectWithPairingCode)
          // owns the retry decision and uses long delays (60s+) between attempts.
          // We intentionally do NOT set up a reconnect timer here.

          if (statusCode === DisconnectReason.loggedOut) {
            this.globalLogger.info({ sessionId }, '[PAIRING] Logged out — clearing session');
            this.cleanAuthFolder(sessionId);
            this.sessionManager.deleteSession(sessionId).catch(() => {});
          }
        } else if (connection === 'open') {
          this.reconnectAttempts.set(sessionId, 0);
          pairingAcknowledged = true;
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
          // Send "BOT CONNECTED SUCCESSFULLY" WhatsApp message
          this.sendConnectionSuccessMessage(sessionId).catch((err: any) => {
            this.globalLogger.error({ sessionId, err: err?.message ?? String(err) }, '[PAIRING] Success message send failed (non-blocking)');
          });
        }
      });

      // ── Save credentials on every update ──
      sock.ev.on('creds.update', async (creds) => {
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

      // ── Request the pairing code ──
      // Per Baileys source: requestPairingCode() generates the code locally,
      // emits creds.update, sends the link_code_companion_reg IQ, and returns
      // the code immediately. It does NOT wait for WhatsApp's acknowledgement.
      //
      // We call it immediately after makeWASocket() — Baileys internally
      // queues the IQ and sends it as soon as the WebSocket handshake
      // completes. We do NOT need to wait for the QR event.
      //
      // After calling it, we wait up to 5 seconds. If the connection closes
      // in that window, WhatsApp rejected the pairing (invalid phone number,
      // rate limited, etc.) — we don't display the code. If the connection
      // stays open, WhatsApp accepted the request and will push a
      // notification to the user's phone — we display the code.
      this.globalLogger.info({ sessionId, phoneNumber }, '[PAIRING] Calling requestPairingCode() — IQ will be sent once WebSocket handshake completes');
      let pairingCode = '';
      try {
        pairingCode = await sock.requestPairingCode(phoneNumber);
        this.globalLogger.info({ sessionId, phoneNumber, pairingCode }, '[PAIRING] requestPairingCode() returned — IQ sent to WhatsApp servers');
        this.emit('pairing.code', pairingCode, sessionId, phoneNumber);
      } catch (err: any) {
        this.globalLogger.error({ sessionId, phoneNumber, err: err.message }, '[PAIRING] requestPairingCode() threw an error');
        // v1.7.0: requestPairingCode throws "Connection Closed" when the WebSocket
        // was closed before/during the IQ send. Check if the close was due to
        // 401 loggedOut (rate-limited) or another reason.
        // We wait briefly for the connection.update 'close' event to fire and
        // populate disconnectStatusCode / pairingRateLimited.
        await new Promise(resolve => setTimeout(resolve, 1500));
        return {
          sock,
          pairingCode: '',
          pairingFailed: true,
          failureReason: err.message || 'requestPairingCode threw',
          isRateLimited: pairingRateLimited || disconnectStatusCode === DisconnectReason.loggedOut,
        };
      }

      // ── Wait for WhatsApp to acknowledge or reject the pairing ──
      // 5 seconds is enough time for WhatsApp to respond if the phone number
      // is invalid or the pairing is rate-limited. If no rejection arrives
      // in 5s, we assume WhatsApp accepted the request and will push the
      // notification to the user's phone.
      const acknowledgementTimeout = new Promise<'acknowledged' | 'rejected'>((resolve) =>
        setTimeout(() => resolve('acknowledged'), 5000)
      );
      const rejectionPromise = new Promise<'acknowledged' | 'rejected'>((resolve) => {
        // Poll for pairingRejected flag every 100ms
        const interval = setInterval(() => {
          if (pairingRejected) {
            clearInterval(interval);
            resolve('rejected');
          } else if (pairingAcknowledged) {
            // connection.open already fired — pairing succeeded
            clearInterval(interval);
            resolve('acknowledged');
          }
        }, 100);
        // Clean up interval after 30s regardless
        setTimeout(() => clearInterval(interval), 30_000);
      });

      const result = await Promise.race<'acknowledged' | 'rejected'>([acknowledgementTimeout, rejectionPromise]);

      if (result === 'rejected') {
        this.globalLogger.error({ sessionId, phoneNumber, rejectionReason }, '[PAIRING] WhatsApp REJECTED the pairing request — not displaying code to user');
        return {
          sock,
          pairingCode: '',
          pairingFailed: true,
          failureReason: rejectionReason,
          isRateLimited: pairingRateLimited || disconnectStatusCode === DisconnectReason.loggedOut,
        };
      }

      // ── Pairing request acknowledged — display the code to the user ──
      if (pairingCode) {
        this.globalLogger.info({ sessionId, phoneNumber, pairingCode }, '[PAIRING] WhatsApp acknowledged pairing request — displaying code to user');
        // eslint-disable-next-line no-console
        console.log('');
        // eslint-disable-next-line no-console
        console.log('  ┌─────────────────────────────────────────────────────────┐');
        // eslint-disable-next-line no-console
        console.log(`  │  Pairing code acknowledged by WhatsApp for: ${phoneNumber}`);
        // eslint-disable-next-line no-console
        console.log(`  │  Code: ${pairingCode}`);
        // eslint-disable-next-line no-console
        console.log('  │  Open WhatsApp → Settings → Linked Devices → Link a Device');
        // eslint-disable-next-line no-console
        console.log('  │  → "Link with phone number instead" → type the code above');
        // eslint-disable-next-line no-console
        console.log('  └─────────────────────────────────────────────────────────┘');
        // eslint-disable-next-line no-console
        console.log('');
      }

      // Don't wait for connection.open here — return immediately so the
      // caller can finish its setup. The connection.update handler above
      // will fire connection.open when the user enters the code on their
      // phone, and the success message will be sent at that point.
      return { sock, pairingCode, pairingFailed: false, failureReason: '', isRateLimited: false };
    } finally {
      this.connectingLocks.delete(sessionId);
    }
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
