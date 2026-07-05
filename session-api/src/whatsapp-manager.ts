// ============================================================================
// CALTEX Session API - Global WhatsApp Connection Manager (SINGLETON) v4.0
//
// ARCHITECTURE: One global WhatsApp socket, initialized on server start.
// All pairing code requests reuse the same active connection.
// Never recreates the socket per request.
//
// v4.1 FIXES (Post-Authentication Onboarding Message):
//
// NEW FEATURE: After successful WhatsApp authentication:
//   1. Generate a unique CALTEX Session ID (CALTEX-XXXX-XXXX)
//   2. Store the Session ID in the session record
//   3. Automatically send a professional onboarding WhatsApp message
//      to the user's WhatsApp account with their Session ID
//   4. Display the Session ID on the frontend with copy/download/guide
//   5. Retry once if message sending fails
//   6. Auto-remove linked device if session generation fails
//   7. Prevent duplicate onboarding messages
//   8. Comprehensive logging at every step
//
// v4.0 FIXES (Post-Authentication Session Delivery):
//
// ROOT CAUSE: When pairing succeeds, Baileys fires:
//   1. CB:pair-success → creds.update → connection.update({isNewLogin:true})
//   2. Connection RESTARTS (close + reconnect) ← this is normal Baileys behavior
//   3. CB:success → creds.update → connection.update({connection:'open'})
//
// FIXES:
// 1. Track "pairing-linked" sessions separately — survive disconnects
// 2. Don't clear pending sessions on DisconnectReason.restartRequired
// 3. Await saveCreds() before copying files
// 4. Save creds synchronously with writeFileSync as a belt-and-suspenders
// 5. Capture session data on connection:open with proper async handling
// 6. Auto-remove linked device if session generation fails
// 7. Comprehensive logging at every step
// ============================================================================

import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  WASocket,
  UserFacingSocketConfig,
  ConnectionState,
} from '@whiskeysockets/baileys';
import { createLogger } from './logger';
import { config } from './config';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { sessionStore } from './session-store';

const log = createLogger('whatsapp-manager');

// ============================================================================
// Connection State Interface
// ============================================================================
export interface ManagerState {
  isReady: boolean;
  isConnecting: boolean;
  lastConnectedAt: number | null;
  reconnectAttempts: number;
  sessionStatus: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'failed';
  baileysVersion: string | null;
  startedAt: number;
  lastKeepAlive: number | null;
  lastPairingCodeAt: number | null;
  totalPairingCodesGenerated: number;
  totalReconnects: number;
  activePairingSessionId: string | null;
  pairingInProgress: boolean;
  lastDisconnectReason: string | null;
  lastConnectionEvent: string | null;
  socketCreatedAt: number | null;
}

// ============================================================================
// Global WhatsApp Manager (SINGLETON)
// ============================================================================
class WhatsAppManager {
  private socket: WASocket | null = null;
  private saveCredsFn: (() => Promise<void>) | null = null;
  private state: ManagerState = {
    isReady: false,
    isConnecting: false,
    lastConnectedAt: null,
    reconnectAttempts: 0,
    sessionStatus: 'idle',
    baileysVersion: null,
    startedAt: Date.now(),
    lastKeepAlive: null,
    lastPairingCodeAt: null,
    totalPairingCodesGenerated: 0,
    totalReconnects: 0,
    activePairingSessionId: null,
    pairingInProgress: false,
    lastDisconnectReason: null,
    lastConnectionEvent: null,
    socketCreatedAt: null,
  };

  // Auth directory for the GLOBAL connection (not per-session)
  private globalAuthDir: string;
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private maxReconnectAttempts = 10;
  private baseReconnectDelayMs = 2000;
  private isShuttingDown = false;

  // ── Session tracking ──
  // pendingPairingSessions: sessions waiting for the user to link (code generated)
  private pendingPairingSessions: Map<string, string> = new Map(); // sessionId → phoneNumber

  // linkedSessions: sessions where the device has linked but we haven't
  // captured data yet. These SURVIVE disconnects because the Baileys
  // pairing flow requires a connection restart between pair-success and
  // connection:open.
  private linkedSessions: Map<string, string> = new Map(); // sessionId → phoneNumber

  // Promise resolvers for connection events
  private connectionOpenResolvers: Map<string, { resolve: (value: boolean) => void; reject: (reason: string) => void }> = new Map();

  // Pairing lock — prevents socket operations during active pairing
  private _pairingLock = false;

  constructor() {
    this.globalAuthDir = join(config.sessionsDir, '_global_auth');
    if (!existsSync(this.globalAuthDir)) {
      mkdirSync(this.globalAuthDir, { recursive: true });
    }
  }

  // ==========================================================================
  // GETTER — Current state (read-only copy)
  // ==========================================================================
  getState(): ManagerState {
    return { ...this.state };
  }

  isSocketReady(): boolean {
    return this.state.isReady && this.socket !== null;
  }

  getSocket(): WASocket | null {
    return this.socket;
  }

  // ==========================================================================
  // PAIRING LOCK
  // ==========================================================================
  private acquirePairingLock(sessionId: string): boolean {
    if (this._pairingLock) {
      log.warn({ sessionId, lockedBy: this.state.activePairingSessionId }, 'Cannot acquire pairing lock — another pairing is in progress');
      return false;
    }
    this._pairingLock = true;
    this.state.pairingInProgress = true;
    this.state.activePairingSessionId = sessionId;
    log.info({ sessionId }, '🔒 Pairing lock acquired');
    return true;
  }

  private releasePairingLock(): void {
    this._pairingLock = false;
    this.state.pairingInProgress = false;
    this.state.activePairingSessionId = null;
    log.info('🔓 Pairing lock released');
  }

  // ==========================================================================
  // STALE AUTH CHECK
  // ==========================================================================
  private ensureCleanAuth(): void {
    const credsPath = join(this.globalAuthDir, 'creds.json');
    if (!existsSync(credsPath)) {
      log.info('No existing creds.json — auth is clean');
      return;
    }

    try {
      const credsContent = readFileSync(credsPath, 'utf-8');
      const creds = JSON.parse(credsContent);

      if (creds.me && creds.me.id && !creds.registered) {
        log.warn({
          deviceId: creds.me.id,
          pairingCode: creds.pairingCode,
          registered: !!creds.registered,
        }, '⚠️ Stale auth detected — creds.me set but device not registered. Clearing for fresh connection.');
        this.clearGlobalAuth();
        return;
      }

      if (creds.me && creds.me.id && creds.registered) {
        log.info({ deviceId: creds.me.id }, 'Global auth has registered device — will reconnect as companion');
        return;
      }

      log.info('Global auth is clean — no device identity set');
    } catch (err: any) {
      log.warn({ err: err.message }, 'Failed to read creds.json — clearing auth for safety');
      this.clearGlobalAuth();
    }
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================
  async initialize(): Promise<void> {
    if (this.state.isConnecting || this.state.isReady) {
      log.info('WhatsApp already initialized or connecting — skipping');
      return;
    }

    if (this._pairingLock) {
      log.warn('Cannot initialize — pairing is in progress');
      return;
    }

    log.info('Initializing global WhatsApp connection...');
    this.state.isConnecting = true;
    this.state.sessionStatus = 'connecting';

    this.ensureCleanAuth();

    try {
      await this.createSocket();
      log.info('Global WhatsApp connection initiated — waiting for ready signal');
    } catch (err: any) {
      log.error({ err: err.message }, 'Failed to initialize WhatsApp connection');
      this.state.isConnecting = false;
      this.state.sessionStatus = 'failed';
      this.scheduleReconnect();
    }
  }

  // ==========================================================================
  // WARMUP
  // ==========================================================================
  async warmup(): Promise<{ status: 'READY' | 'WARMING_UP' | 'FAILED'; message: string }> {
    if (this.state.isReady) {
      return { status: 'READY', message: 'WhatsApp client is connected and ready' };
    }

    if (this.state.isConnecting) {
      log.info('Warmup requested — already connecting, waiting for ready...');
      const ready = await this.waitForReady(20000);
      if (ready) return { status: 'READY', message: 'WhatsApp client is now ready' };
      return { status: 'WARMING_UP', message: 'WhatsApp client is connecting, please wait...' };
    }

    log.info('Warmup requested — initializing connection...');
    await this.initialize();

    const ready = await this.waitForReady(20000);
    if (ready) return { status: 'READY', message: 'WhatsApp client is now ready' };
    return { status: 'WARMING_UP', message: 'WhatsApp client is warming up, please try again shortly' };
  }

  // ==========================================================================
  // PAIRING CODE
  // ==========================================================================
  async generatePairingCode(
    phoneNumber: string,
    sessionId: string,
    _sessionAuthDir: string
  ): Promise<string> {
    if (!this.state.isReady || !this.socket) {
      throw new Error('WhatsApp client is not ready — call /warmup first');
    }

    if (!this.acquirePairingLock(sessionId)) {
      throw new Error('Another pairing is already in progress — please wait');
    }

    log.info({ phoneNumber, sessionId }, 'Generating pairing code via global socket');
    this.pendingPairingSessions.set(sessionId, phoneNumber);

    try {
      const ws = this.socket.ws;
      const isWsOpen = ws?.isOpen;
      log.info({
        sessionId,
        wsIsOpen: isWsOpen,
        isReady: this.state.isReady,
      }, 'Socket state check before requestPairingCode');

      if (isWsOpen === false) {
        log.error({ wsIsOpen: isWsOpen }, 'WebSocket is not OPEN — cannot request pairing code');
        this.releasePairingLock();
        this.pendingPairingSessions.delete(sessionId);
        throw new Error('WhatsApp socket is not connected — please try again');
      }

      const code = await this.socket.requestPairingCode(phoneNumber);
      this.state.lastPairingCodeAt = Date.now();
      this.state.totalPairingCodesGenerated++;

      log.info({
        phoneNumber,
        sessionId,
        pairingCode: code,
      }, '✅ Pairing code generated — user should enter this in WhatsApp');

      return code;
    } catch (err: any) {
      this.releasePairingLock();
      this.pendingPairingSessions.delete(sessionId);
      log.error({ err: err.message, phoneNumber, sessionId }, '❌ Failed to generate pairing code');
      throw new Error(`Failed to generate pairing code: ${err.message}`);
    }
  }

  // ==========================================================================
  // QR CODE
  // ==========================================================================
  async waitForQRCode(timeoutMs: number = 30000): Promise<string> {
    if (!this.socket) {
      throw new Error('WhatsApp socket not available');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('QR code generation timed out'));
      }, timeoutMs);

      const handler = (update: Partial<ConnectionState>) => {
        if (update.qr) {
          clearTimeout(timeout);
          this.socket?.ev.off('connection.update', handler);
          resolve(update.qr);
        }
      };

      this.socket!.ev.on('connection.update', handler);
    });
  }

  // ==========================================================================
  // WAIT FOR CONNECTION
  // ==========================================================================
  waitForConnection(sessionId: string, timeoutMs: number = 120000): Promise<boolean> {
    const existing = sessionStore.get(sessionId);
    if (existing && existing.status === 'connected') {
      return Promise.resolve(true);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.connectionOpenResolvers.delete(sessionId);
        resolve(false);
      }, timeoutMs);

      this.connectionOpenResolvers.set(sessionId, {
        resolve: (value: boolean) => {
          clearTimeout(timeout);
          this.connectionOpenResolvers.delete(sessionId);
          resolve(value);
        },
        reject: (reason: string) => {
          clearTimeout(timeout);
          this.connectionOpenResolvers.delete(sessionId);
          resolve(false);
        },
      });

      log.info({ sessionId, timeoutMs }, 'Waiting for WhatsApp connection on session...');
    });
  }

  // ==========================================================================
  // KEEP-ALIVE
  // ==========================================================================
  startKeepAlive(): void {
    if (this.keepAliveTimer) return;

    const intervalMs = config.keepAliveIntervalMs;
    log.info({ intervalMs }, 'Starting keep-alive system');

    this.keepAliveTimer = setInterval(async () => {
      try {
        const healthUrl = `http://localhost:${config.port}/health`;
        const res = await fetch(healthUrl);
        const data = await res.json() as any;
        log.info({
          health: data.data?.status,
          uptime: Math.floor(process.uptime()),
          socketReady: this.state.isReady,
          pairingInProgress: this._pairingLock,
          pendingSessions: this.pendingPairingSessions.size,
          linkedSessions: this.linkedSessions.size,
        }, 'Keep-alive ping OK');

        this.state.lastKeepAlive = Date.now();

        if (!this.state.isReady && !this.state.isConnecting && !this.isShuttingDown && !this._pairingLock) {
          log.warn('Keep-alive detected disconnected socket — triggering reconnect');
          this.scheduleReconnect();
        }
      } catch (err: any) {
        log.warn({ err: err.message }, 'Keep-alive ping failed (may be normal during startup)');
      }
    }, intervalMs);

    if (this.keepAliveTimer.unref) {
      this.keepAliveTimer.unref();
    }
  }

  stopKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  // ==========================================================================
  // SHUTDOWN
  // ==========================================================================
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    log.info('Shutting down WhatsApp manager...');

    this.stopKeepAlive();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      try {
        this.socket.end(undefined);
      } catch {}
      this.socket = null;
    }

    this.state.isReady = false;
    this.state.isConnecting = false;
    this.state.sessionStatus = 'disconnected';
    this._pairingLock = false;
    this.state.pairingInProgress = false;

    log.info('WhatsApp manager shut down');
  }

  // ==========================================================================
  // PRIVATE — Create the global socket
  // ==========================================================================
  private async createSocket(): Promise<void> {
    this.ensureCleanAuth();

    const { state, saveCreds } = await useMultiFileAuthState(this.globalAuthDir);

    // Store the async saveCreds function
    this.saveCredsFn = saveCreds;

    let version: [number, number, number] = [0, 0, 0];
    try {
      const fetched = await fetchLatestBaileysVersion();
      version = fetched.version;
      this.state.baileysVersion = version.join('.');
      log.info({ version: version.join('.') }, 'Fetched latest Baileys version');
    } catch (err: any) {
      log.warn({ err: err.message }, 'Failed to fetch latest Baileys version — using default');
      version = [2, 3000, 0];
      this.state.baileysVersion = version.join('.');
    }

    const hasCredsMe = !!(state.creds?.me?.id);
    const isRegistered = !!state.creds?.registered;
    const hasPairingCode = !!state.creds?.pairingCode;
    log.info({
      hasCredsMe,
      isRegistered,
      hasPairingCode,
      credsMeId: state.creds?.me?.id,
      linkedSessions: this.linkedSessions.size,
    }, 'Auth state loaded for socket creation');

    const socketConfig: UserFacingSocketConfig = {
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, log),
      },
      printQRInTerminal: false,
      browser: Browsers.ubuntu('Chrome'),
      syncFullHistory: false,
      markOnlineOnConnect: false,
      logger: log.child({ scope: 'baileys' }),
      generateHighQualityLinkPreview: false,
      shouldIgnoreJid: (jid: string) => {
        return jid?.includes('@g.us') || jid?.includes('@broadcast');
      },
      getMessage: async () => undefined,
      connectTimeoutMs: 60_000,
      keepAliveIntervalMs: 25_000,
      qrTimeout: 60_000,
      fireInitQueries: false,
      mobile: false,
    };

    const sock = makeWASocket(socketConfig);
    this.socket = sock;
    this.state.socketCreatedAt = Date.now();

    // Save credentials on update — async, saves to global auth dir
    sock.ev.on('creds.update', async () => {
      log.info('creds.update event — saving credentials to disk (async)');
      try {
        await saveCreds();
        log.info('✅ creds.update — credentials saved successfully');
      } catch (err: any) {
        log.error({ err: err.message }, '❌ creds.update — failed to save credentials');
      }
    });

    // Connection update handler
    sock.ev.on('connection.update', (update) => {
      this.handleGlobalConnectionUpdate(update);
    });

    log.info({
      hasCredsMe,
      isRegistered,
      browser: socketConfig.browser,
      version: version.join('.'),
      connectTimeoutMs: socketConfig.connectTimeoutMs,
    }, 'Global WhatsApp socket created — waiting for connection...');
  }

  // ==========================================================================
  // PRIVATE — Handle connection updates
  // ==========================================================================
  private handleGlobalConnectionUpdate(update: Partial<ConnectionState>): void {
    const { connection, lastDisconnect, qr, receivedPendingNotifications, isNewLogin } = update;

    this.state.lastConnectionEvent = connection || (qr ? 'qr_received' : isNewLogin ? 'new_login' : 'unknown');

    log.info({
      connection: connection || 'undefined',
      hasQR: !!qr,
      isNewLogin: !!isNewLogin,
      hasLastDisconnect: !!lastDisconnect,
      receivedPendingNotifications: !!receivedPendingNotifications,
      isReady: this.state.isReady,
      isConnecting: this.state.isConnecting,
      pairingInProgress: this._pairingLock,
      pendingSessions: this.pendingPairingSessions.size,
      linkedSessions: this.linkedSessions.size,
      wsIsOpen: this.socket?.ws?.isOpen,
      socketAge: this.state.socketCreatedAt ? Math.round((Date.now() - this.state.socketCreatedAt) / 1000) + 's' : 'N/A',
    }, '📡 Global connection update');

    // QR code — socket handshake complete, ready for pairing
    if (qr) {
      log.info('📱 QR event received — socket handshake complete, ready for pairing code requests');
      if (!this.state.isReady) {
        this.markReady();
      }
    }

    // isNewLogin — device pairing succeeded, connection will restart
    // This fires BEFORE connection:close + connection:open
    // We must mark the session as "linked" so it survives the restart
    if (isNewLogin) {
      log.info({
        pendingSessions: this.pendingPairingSessions.size,
      }, '🔗 isNewLogin=true — device pairing succeeded! Connection will restart. Moving sessions to linked set.');

      // Move all pending sessions to the linked set
      for (const [sessionId, phoneNumber] of this.pendingPairingSessions) {
        this.linkedSessions.set(sessionId, phoneNumber);
        log.info({ sessionId, phoneNumber }, '🔗 Session moved to linked set — will survive connection restart');
      }
      this.pendingPairingSessions.clear();
    }

    // Connection opened — device linked and connected
    if (connection === 'open') {
      log.info({
        pairingInProgress: this._pairingLock,
        pendingSessions: this.pendingPairingSessions.size,
        linkedSessions: this.linkedSessions.size,
      }, '✅ Global WhatsApp connection OPEN — device linked successfully!');
      this.markReady();
      this.state.reconnectAttempts = 0;

      // Capture session data — this is async because we need to await saveCreds
      this.captureSessionData().catch((err: any) => {
        log.error({ err: err.message }, '❌ Unhandled error in captureSessionData');
      });
    }

    // Connecting
    if (connection === 'connecting') {
      log.info('🔌 Global WhatsApp socket connecting to servers...');
      this.state.isConnecting = true;
      this.state.sessionStatus = 'connecting';
    }

    // Connection closed
    if (connection === 'close') {
      const error: any = lastDisconnect?.error;
      const statusCode = error?.output?.statusCode ??
        error?.output?.payload?.statusCode ?? 0;

      const reasonMap: Record<number, string> = {
        [DisconnectReason.connectionClosed]: 'CONNECTION_CLOSED',
        [DisconnectReason.connectionReplaced]: 'CONNECTION_REPLACED',
        [DisconnectReason.loggedOut]: 'LOGGED_OUT',
        [DisconnectReason.restartRequired]: 'RESTART_REQUIRED',
        [DisconnectReason.badSession]: 'BAD_SESSION',
        [DisconnectReason.forbidden]: 'FORBIDDEN',
        [DisconnectReason.multideviceMismatch]: 'MULTIDEVICE_MISMATCH',
        [DisconnectReason.unavailableService]: 'UNAVAILABLE_SERVICE',
      };
      const reason = reasonMap[statusCode] || (statusCode === 408 ? 'TIMED_OUT' : `UNKNOWN(${statusCode})`);
      this.state.lastDisconnectReason = reason;

      log.warn({
        statusCode,
        reason,
        errorMessage: error?.message,
        pairingInProgress: this._pairingLock,
        pendingSessions: this.pendingPairingSessions.size,
        linkedSessions: this.linkedSessions.size,
        socketAge: this.state.socketCreatedAt ? Math.round((Date.now() - this.state.socketCreatedAt) / 1000) + 's' : 'N/A',
      }, '❌ Global connection closed');

      this.state.isReady = false;
      this.state.isConnecting = false;
      this.state.sessionStatus = 'disconnected';

      // ── CRITICAL: Handle disconnect differently based on linked sessions ──
      //
      // If we have linkedSessions, this disconnect is the EXPECTED restart
      // after pair-success. We must NOT mark them as failed or clear them.
      //
      // If we have pendingPairingSessions (no link yet), this is an unexpected
      // disconnect during pairing — mark them as failed.
      const hasLinkedSessions = this.linkedSessions.size > 0;

      if (hasLinkedSessions) {
        log.info({
          linkedSessions: Array.from(this.linkedSessions.keys()),
          reason,
        }, '🔗 Connection closed during pairing restart — linked sessions preserved, NOT marking as failed');
        // Don't touch linkedSessions — they will be captured on reconnect
      }

      // Handle pending sessions (not yet linked)
      if (this.pendingPairingSessions.size > 0) {
        log.warn({
          sessions: Array.from(this.pendingPairingSessions.keys()),
          reason,
        }, 'Disconnect during pending pairing — marking as failed');

        for (const [sessionId] of this.pendingPairingSessions) {
          const record = sessionStore.get(sessionId);
          if (record && record.status !== 'connected') {
            log.info({ sessionId, reason }, 'Pending session failed during disconnect');
            sessionStore.update(sessionId, { status: 'failed' });

            const resolver = this.connectionOpenResolvers.get(sessionId);
            if (resolver) {
              resolver.reject(`Connection closed: ${reason}`);
            }
          }
        }
        this.pendingPairingSessions.clear();
      }

      // Release pairing lock if not in linked state
      if (this._pairingLock && !hasLinkedSessions) {
        log.info('Releasing pairing lock due to disconnect (no linked sessions)');
        this.releasePairingLock();
      }

      this.state.activePairingSessionId = null;

      // Reconnection strategy
      if (statusCode === DisconnectReason.loggedOut) {
        log.error('Logged out — session invalid, reinitializing with fresh auth');
        this.state.sessionStatus = 'failed';
        // If we had linked sessions, they're now orphaned — try to remove the device
        if (hasLinkedSessions) {
          this.cleanupOrphanedLinkedDevices();
        }
        this.clearGlobalAuth();
        this.scheduleReconnect();
      } else if (statusCode === DisconnectReason.connectionReplaced) {
        log.warn('Connection replaced — another instance connected');
        this.state.sessionStatus = 'failed';
        if (hasLinkedSessions) {
          this.cleanupOrphanedLinkedDevices();
        }
        this.clearGlobalAuth();
        this.scheduleReconnect();
      } else if (statusCode === DisconnectReason.restartRequired) {
        // ── THIS IS THE NORMAL RESTART AFTER PAIRING ──
        // Reconnect immediately, keeping auth intact
        log.info('Restart required (normal after pairing) — reconnecting immediately, keeping auth');
        this.scheduleReconnect(1000);
      } else if (statusCode === DisconnectReason.connectionClosed) {
        log.info('Connection closed (normal) — reconnecting');
        if (!hasLinkedSessions) {
          this.clearGlobalAuth();
        }
        this.scheduleReconnect();
      } else if (statusCode === 408) { // timedOut
        log.warn('Connection timed out — clearing auth and reconnecting');
        if (hasLinkedSessions) {
          this.cleanupOrphanedLinkedDevices();
        }
        this.clearGlobalAuth();
        this.scheduleReconnect();
      } else {
        log.warn({ statusCode, reason }, 'Unexpected disconnect — reconnecting');
        if (!hasLinkedSessions) {
          this.clearGlobalAuth();
        }
        this.scheduleReconnect();
      }
    }
  }

  // ==========================================================================
  // PRIVATE — Capture session data (ASYNC — properly awaits saveCreds)
  //
  // This is called when connection:open fires. At this point:
  // - The device has been linked (pair-success already fired earlier)
  // - The connection has restarted and reconnected
  // - creds.update events have fired and saveCreds has been called
  // - The linkedSessions map contains sessions that survived the restart
  //
  // We must:
  // 1. Await saveCreds() to ensure all files are on disk
  // 2. Also write creds.json synchronously as a safety net
  // 3. Copy auth files to session directories
  // 4. Update session status
  // 5. Resolve waiting promises
  // 6. Reset for next pairing
  // ==========================================================================
  private async captureSessionData(): Promise<void> {
    // Check both linked sessions (survived restart) and pending sessions (linked on same connection)
    const sessionsToCapture = new Map<string, string>();

    for (const [sid, phone] of this.linkedSessions) {
      sessionsToCapture.set(sid, phone);
    }
    for (const [sid, phone] of this.pendingPairingSessions) {
      sessionsToCapture.set(sid, phone);
    }

    if (sessionsToCapture.size === 0) {
      log.info('No linked or pending sessions to capture — this may be a reconnection of an existing companion device');
      return;
    }

    log.info({ count: sessionsToCapture.size }, '📦 Capturing session data for linked/pending sessions');

    // Step 1: Await the async saveCreds to ensure all files are on disk
    if (this.saveCredsFn) {
      try {
        await this.saveCredsFn();
        log.info('✅ Step 1: saveCreds() awaited — credentials saved to disk');
      } catch (err: any) {
        log.error({ err: err.message }, '❌ Step 1: saveCreds() failed');
      }
    }

    // Step 2: Belt-and-suspenders — also write creds.json synchronously
    // from the in-memory socket state
    try {
      const credsPath = join(this.globalAuthDir, 'creds.json');
      if (existsSync(credsPath)) {
        const creds = JSON.parse(readFileSync(credsPath, 'utf-8'));
        log.info({
          hasMe: !!creds.me,
          meId: creds.me?.id,
          registered: !!creds.registered,
          platform: creds.platform,
        }, '✅ Step 2: Verified creds.json on disk');
      } else {
        log.error('❌ Step 2: creds.json NOT on disk after saveCreds — will attempt manual save');
        // Try to get creds from socket
        if (this.socket?.authState?.creds) {
          const creds = this.socket.authState.creds;
          writeFileSync(credsPath, JSON.stringify(creds, null, 2));
          log.info('✅ Step 2: Manually saved creds.json from socket state');
        }
      }
    } catch (err: any) {
      log.error({ err: err.message }, '❌ Step 2: Failed to verify/save creds.json');
    }

    // Step 3: For each session, copy auth files and update status
    for (const [sessionId, phoneNumber] of sessionsToCapture) {
      try {
        const sessionAuthDir = sessionStore.getAuthDir(sessionId);

        // Copy all auth files from global auth dir to session auth dir
        if (existsSync(this.globalAuthDir)) {
          const files = readdirSync(this.globalAuthDir);
          let copiedCount = 0;
          for (const file of files) {
            const srcPath = join(this.globalAuthDir, file);
            const dstPath = join(sessionAuthDir, file);
            try {
              const content = readFileSync(srcPath);
              writeFileSync(dstPath, content);
              copiedCount++;
            } catch (err: any) {
              log.warn({ err: err.message, file, sessionId }, 'Failed to copy auth file');
            }
          }
          log.info({ sessionId, filesCopied: copiedCount, totalFiles: files.length }, '✅ Step 3: Auth files copied to session directory');
        } else {
          log.error({ sessionId, globalAuthDir: this.globalAuthDir }, '❌ Step 3: Global auth dir does not exist!');
        }

        // Verify session creds
        const sessionCredsPath = join(sessionAuthDir, 'creds.json');
        if (existsSync(sessionCredsPath)) {
          try {
            const sessionCreds = JSON.parse(readFileSync(sessionCredsPath, 'utf-8'));
            log.info({
              sessionId,
              hasMe: !!sessionCreds.me,
              meId: sessionCreds.me?.id,
              registered: !!sessionCreds.registered,
            }, '✅ Step 3: Verified session creds.json');
          } catch (err: any) {
            log.warn({ err: err.message, sessionId }, 'Failed to verify session creds.json');
          }
        } else {
          log.error({ sessionId }, '❌ Step 3: Session creds.json NOT found after copy!');
        }

        // Step 4: Generate unique CALTEX Session ID and update session status
        const caltexSessionId = sessionStore.generateCaltexSessionId();
        log.info({ sessionId, caltexSessionId }, '🔑 Step 4: CALTEX Session ID generated');

        // Resolve actual phone number for onboarding message
        // For QR sessions, phoneNumber may be 'qr-session' — extract from creds.me.id
        let actualPhoneNumber = phoneNumber;
        if (!phoneNumber || phoneNumber === 'qr-session') {
          try {
            const sessionCredsPath = join(sessionAuthDir, 'creds.json');
            if (existsSync(sessionCredsPath)) {
              const sessionCreds = JSON.parse(readFileSync(sessionCredsPath, 'utf-8'));
              const meId = sessionCreds?.me?.id;
              if (meId) {
                // me.id format: "254712345678@s.whatsapp.net" or "254712345678:0@s.whatsapp.net"
                actualPhoneNumber = meId.split('@')[0].split(':')[0];
                log.info({ sessionId, meId, extractedPhone: actualPhoneNumber }, '📱 Extracted phone number from creds for QR session');
              }
            }
          } catch (err: any) {
            log.warn({ err: err.message, sessionId }, 'Failed to extract phone number from session creds');
          }
        }

        sessionStore.update(sessionId, {
          status: 'connected',
          connectedAt: Date.now(),
          caltexSessionId,
          phoneNumber: actualPhoneNumber !== phoneNumber ? actualPhoneNumber : undefined,
        });

        log.info({ sessionId, phoneNumber: actualPhoneNumber, caltexSessionId }, '✅ Step 4: Session marked as CONNECTED — credentials saved, CALTEX Session ID stored');

        // Step 5: Send onboarding WhatsApp message with Session ID
        if (actualPhoneNumber && actualPhoneNumber !== 'qr-session') {
          await this.sendOnboardingMessage(sessionId, actualPhoneNumber, caltexSessionId);
        } else {
          log.warn({ sessionId }, '⚠️ Step 5: Cannot send onboarding message — no valid phone number available');
        }

        // Step 6: Resolve any waiting connection promises
        const resolver = this.connectionOpenResolvers.get(sessionId);
        if (resolver) {
          log.info({ sessionId }, '✅ Step 6: Resolving connection promise — session data ready for frontend');
          resolver.resolve(true);
        }

        log.info({
          sessionId,
          phoneNumber,
          caltexSessionId,
        }, '🎉 SESSION DELIVERY COMPLETE — session is now available for frontend polling');
      } catch (err: any) {
        log.error({ err: err.message, sessionId }, '❌ Failed to capture session data — marking as failed');

        sessionStore.update(sessionId, { status: 'failed' });

        // Try to remove the linked device since session generation failed
        await this.removeLinkedDevice(sessionId);

        const resolver = this.connectionOpenResolvers.get(sessionId);
        if (resolver) {
          resolver.reject(`Failed to capture session data: ${err.message}`);
        }
      }
    }

    // Clear session tracking
    this.linkedSessions.clear();
    this.pendingPairingSessions.clear();

    // Release pairing lock
    this.releasePairingLock();

    // Step 7: Reset the global socket for the next pairing request
    log.info('Step 7: Resetting global socket for next pairing request...');
    this.resetForNextPairing();
  }

  // ==========================================================================
  // PRIVATE — Send onboarding WhatsApp message after successful auth
  //
  // This sends the professional onboarding message to the user's WhatsApp
  // account immediately after they successfully link their device.
  // Includes retry-once logic if the first send fails.
  // Prevents duplicate messages by checking onboardingSent flag.
  // ==========================================================================
  private async sendOnboardingMessage(
    sessionId: string,
    phoneNumber: string,
    caltexSessionId: string
  ): Promise<void> {
    // Prevent duplicate messages
    const record = sessionStore.get(sessionId);
    if (record?.onboardingSent) {
      log.info({ sessionId, caltexSessionId }, '⏭️ Onboarding message already sent — skipping duplicate');
      return;
    }

    if (!this.socket) {
      log.error({ sessionId }, '❌ Cannot send onboarding message — no socket available');
      return;
    }

    // Format the JID for the user's phone number
    // WhatsApp JID format: <phoneNumber>@s.whatsapp.net
    const jid = `${phoneNumber}@s.whatsapp.net`;

    const message = `\u{1F916} *CALTEX MD*

\u2705 *STEP 1 OF 2 COMPLETED*

Congratulations! \u{1F389}

Your WhatsApp account has been linked successfully to CALTEX MD.

\u{1F511} *YOUR SESSION ID*

${caltexSessionId}

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501

\u{1F4CC} *NEXT STEP (STEP 2 OF 2)*

To activate your personal CALTEX MD bot:

1\uFE0F\u20E3 Fork or download the official CALTEX MD repository.

2\uFE0F\u20E3 Deploy the bot to your preferred hosting platform:
\u2022 Render
\u2022 Heroku
\u2022 Railway
\u2022 Pterodactyl Panel
\u2022 VPS
\u2022 Any Node.js supported hosting

3\uFE0F\u20E3 During deployment, locate the environment variable for the Session ID (or SESSION_ID).

4\uFE0F\u20E3 Paste the Session ID shown above.

5\uFE0F\u20E3 Complete deployment.

6\uFE0F\u20E3 Once deployment finishes, your CALTEX MD bot will automatically connect to this WhatsApp account.

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501

\u26A0\uFE0F *IMPORTANT*

\u2022 Keep this Session ID private.
\u2022 Never share it with anyone.
\u2022 Anyone with this Session ID may be able to control your bot.
\u2022 If compromised, generate a new session.

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501

\u{1F389} Thank you for choosing CALTEX MD.

Enjoy your powerful WhatsApp Multi-Device Bot!`;

    log.info({ sessionId, phoneNumber, caltexSessionId, jid }, '📩 Step 5: Sending onboarding WhatsApp message...');

    // Attempt to send — with one retry on failure
    let sent = false;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await this.socket.sendMessage(jid, { text: message });
        sent = true;
        log.info({
          sessionId,
          phoneNumber,
          caltexSessionId,
          attempt,
        }, '✅ Step 5: Onboarding WhatsApp message DELIVERED successfully');
        break;
      } catch (err: any) {
        log.error({
          err: err.message,
          sessionId,
          phoneNumber,
          attempt,
          maxAttempts: 2,
        }, attempt === 1 ? '⚠️ Step 5: Failed to send onboarding message — will retry once' : '❌ Step 5: Failed to send onboarding message after retry');

        if (attempt === 1) {
          // Wait 2 seconds before retry
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    // Update session record with onboarding status
    if (sent) {
      sessionStore.update(sessionId, { onboardingSent: true });
      log.info({ sessionId, caltexSessionId }, '✅ Step 5: onboardingSent flag set to true');
    } else {
      log.error({ sessionId, caltexSessionId }, '❌ Step 5: Onboarding message delivery FAILED after retry — session data still available via frontend');
      // Don't mark session as failed — the session data is still valid,
      // the user can still get it from the website. The WhatsApp message
      // is a convenience, not a requirement.
    }
  }

  // ==========================================================================
  // PRIVATE — Remove a linked device from WhatsApp
  // Called when session generation fails after device was linked
  // ==========================================================================
  private async removeLinkedDevice(sessionId: string): Promise<void> {
    try {
      if (!this.socket) {
        log.warn({ sessionId }, 'Cannot remove linked device — no socket available');
        return;
      }

      const record = sessionStore.get(sessionId);
      if (!record) return;

      log.info({ sessionId, phoneNumber: record.phoneNumber }, '🗑️ Attempting to remove orphaned linked device from WhatsApp');

      // Use socket.logout() to remove this companion device from the linked devices
      try {
        await this.socket.logout('Session generation failed — removing linked device');
        log.info({ sessionId }, '✅ Orphaned linked device removed from WhatsApp');
      } catch (logoutErr: any) {
        log.warn({ err: logoutErr.message, sessionId }, 'Could not logout/remove linked device — device may need manual removal in WhatsApp');
      }
    } catch (err: any) {
      log.warn({ err: err.message, sessionId }, 'Failed to remove linked device');
    }
  }

  // ==========================================================================
  // PRIVATE — Cleanup all orphaned linked devices
  // ==========================================================================
  private cleanupOrphanedLinkedDevices(): void {
    for (const [sessionId] of this.linkedSessions) {
      const record = sessionStore.get(sessionId);
      if (record && record.status !== 'connected') {
        log.info({ sessionId }, '🗑️ Cleaning up orphaned linked session');
        sessionStore.update(sessionId, { status: 'failed' });

        const resolver = this.connectionOpenResolvers.get(sessionId);
        if (resolver) {
          resolver.reject('Connection lost after device was linked — session generation failed');
        }
      }
    }
    this.linkedSessions.clear();
    this.releasePairingLock();
  }

  // ==========================================================================
  // PRIVATE — Reset the global socket for next pairing
  // ==========================================================================
  private resetForNextPairing(): void {
    log.info('Resetting global socket for next pairing request...');

    if (this.socket) {
      try {
        this.socket.end(undefined);
      } catch {}
      this.socket = null;
    }

    this.state.isReady = false;
    this.state.isConnecting = false;

    this.clearGlobalAuth();
    this.scheduleReconnect(2000);
  }

  // ==========================================================================
  // PRIVATE — Mark the socket as ready
  // ==========================================================================
  private markReady(): void {
    this.state.isReady = true;
    this.state.isConnecting = false;
    this.state.lastConnectedAt = Date.now();
    this.state.sessionStatus = 'connected';
    this.state.reconnectAttempts = 0;
    log.info('✅ WhatsApp client is NOW READY for pairing code requests');
  }

  // ==========================================================================
  // PRIVATE — Schedule reconnection with exponential backoff
  // ==========================================================================
  private scheduleReconnect(delayMs?: number): void {
    if (this.isShuttingDown) return;
    if (this._pairingLock && this.linkedSessions.size === 0) {
      log.info('Skipping reconnect — pairing is in progress');
      return;
    }

    if (this.state.reconnectAttempts >= this.maxReconnectAttempts) {
      log.error({
        attempts: this.state.reconnectAttempts,
        max: this.maxReconnectAttempts,
      }, 'Max reconnect attempts reached — will retry in 5 minutes');
      this.state.reconnectAttempts = 0;
      delayMs = 300000;
    }

    const attempt = this.state.reconnectAttempts + 1;
    const calculatedDelay = delayMs ?? Math.min(
      this.baseReconnectDelayMs * Math.pow(2, this.state.reconnectAttempts),
      60000
    );

    log.info({
      attempt,
      delayMs: calculatedDelay,
      totalReconnects: this.state.totalReconnects,
      hasLinkedSessions: this.linkedSessions.size > 0,
    }, 'Scheduling reconnect');

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(async () => {
      this.state.reconnectAttempts++;
      this.state.totalReconnects++;

      log.info({ attempt: this.state.reconnectAttempts }, 'Attempting reconnect...');

      try {
        if (this.socket) {
          try { this.socket.end(undefined); } catch {}
          this.socket = null;
        }

        this.state.isConnecting = true;
        this.state.sessionStatus = 'connecting';

        await this.createSocket();
        log.info('Reconnect socket created — waiting for ready signal');
      } catch (err: any) {
        log.error({ err: err.message }, 'Reconnect failed');
        this.state.isConnecting = false;
        this.state.sessionStatus = 'failed';
        this.scheduleReconnect();
      }
    }, calculatedDelay);

    if (this.reconnectTimer.unref) {
      this.reconnectTimer.unref();
    }
  }

  // ==========================================================================
  // PRIVATE — Wait for the socket to become ready
  // ==========================================================================
  private waitForReady(timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const checkInterval = setInterval(() => {
        if (this.state.isReady) {
          clearInterval(checkInterval);
          resolve(true);
        } else if (Date.now() - startTime > timeoutMs) {
          clearInterval(checkInterval);
          resolve(false);
        }
      }, 500);
    });
  }

  // ==========================================================================
  // PRIVATE — Clear global auth
  // ==========================================================================
  private clearGlobalAuth(): void {
    // Don't clear auth if we have linked sessions waiting for reconnect
    if (this.linkedSessions.size > 0) {
      log.info('Skipping global auth clear — linked sessions exist that need auth for reconnect');
      return;
    }

    try {
      if (existsSync(this.globalAuthDir)) {
        rmSync(this.globalAuthDir, { recursive: true, force: true });
        mkdirSync(this.globalAuthDir, { recursive: true });
        log.info('🗑️ Cleared global auth directory for fresh connection');
      }
    } catch (err: any) {
      log.error({ err: err.message }, '❌ Failed to clear global auth directory');
    }
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================
export const whatsappManager = new WhatsAppManager();
