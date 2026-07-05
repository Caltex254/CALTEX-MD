// ============================================================================
// CALTEX Session API - Global WhatsApp Connection Manager (SINGLETON) v3.0
//
// ARCHITECTURE: One global WhatsApp socket, initialized on server start.
// All pairing code requests reuse the same active connection.
// Never recreates the socket per request.
//
// v3.0 FIXES (Pairing Flow Audit):
// 1. Clear stale auth on RECONNECT (not just initialize) when creds represent
//    a failed pairing (creds.me set but not registered)
// 2. Remove shouldIgnoreJid: () => true — blocks pairing notifications
// 3. Add pairing lock to prevent socket operations during active pairing
// 4. Increase connectTimeoutMs from 30s to 60s for Render stability
// 5. Comprehensive logging for every connection event and credential update
// 6. Better error handling and graceful auth failure recovery
// 7. Ensure requestPairingCode only called when socket is truly ready
// 8. Prevent duplicate socket initialization
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
  private saveCreds: (() => void) | null = null;
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
  private baseReconnectDelayMs = 2000; // Start at 2s
  private isShuttingDown = false;
  private pendingPairingSessions: Map<string, string> = new Map(); // sessionId → phoneNumber

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
  // PAIRING LOCK — Prevents socket reset/reconnect during active pairing
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
  // STALE AUTH CHECK — Critical for reconnect path
  // If creds.me is set but the device is not registered, the auth represents
  // a FAILED pairing attempt. We MUST clear it before reconnecting, otherwise
  // WhatsApp will reject the connection.
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

      // No me.id — auth is clean (fresh state)
      log.info('Global auth is clean — no device identity set');
    } catch (err: any) {
      log.warn({ err: err.message }, 'Failed to read creds.json — clearing auth for safety');
      this.clearGlobalAuth();
    }
  }

  // ==========================================================================
  // INITIALIZATION — Called on server startup
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

    // CRITICAL: Ensure auth is clean before creating socket
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
  // WARMUP — Ensures the connection is ready
  // ==========================================================================
  async warmup(): Promise<{ status: 'READY' | 'WARMING_UP' | 'FAILED'; message: string }> {
    if (this.state.isReady) {
      return { status: 'READY', message: 'WhatsApp client is connected and ready' };
    }

    if (this.state.isConnecting) {
      log.info('Warmup requested — already connecting, waiting for ready...');
      const ready = await this.waitForReady(20000);
      if (ready) {
        return { status: 'READY', message: 'WhatsApp client is now ready' };
      }
      return { status: 'WARMING_UP', message: 'WhatsApp client is connecting, please wait...' };
    }

    log.info('Warmup requested — initializing connection...');
    await this.initialize();

    const ready = await this.waitForReady(20000);
    if (ready) {
      return { status: 'READY', message: 'WhatsApp client is now ready' };
    }
    return { status: 'WARMING_UP', message: 'WhatsApp client is warming up, please try again shortly' };
  }

  // ==========================================================================
  // PAIRING CODE — Generate using the global socket
  // ==========================================================================
  async generatePairingCode(
    phoneNumber: string,
    sessionId: string,
    _sessionAuthDir: string
  ): Promise<string> {
    if (!this.state.isReady || !this.socket) {
      throw new Error('WhatsApp client is not ready — call /warmup first');
    }

    // Acquire pairing lock
    if (!this.acquirePairingLock(sessionId)) {
      throw new Error('Another pairing is already in progress — please wait');
    }

    log.info({ phoneNumber, sessionId }, 'Generating pairing code via global socket');

    // Register this session as pending
    this.pendingPairingSessions.set(sessionId, phoneNumber);

    try {
      // Verify socket is truly ready by checking the connection state
      const ws = this.socket.ws;
      const isWsOpen = ws?.isOpen;
      log.info({
        sessionId,
        socketExists: !!this.socket,
        wsIsOpen: isWsOpen,
        wsIsClosed: ws?.isClosed,
        wsIsConnecting: ws?.isConnecting,
        isReady: this.state.isReady,
      }, 'Socket state check before requestPairingCode');

      // WebSocket must be OPEN for requestPairingCode
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
      }, '✅ Pairing code generated successfully — user should enter this code in WhatsApp');

      return code;
    } catch (err: any) {
      // Clean up on failure
      this.releasePairingLock();
      this.pendingPairingSessions.delete(sessionId);
      log.error({ err: err.message, phoneNumber, sessionId }, '❌ Failed to generate pairing code');
      throw new Error(`Failed to generate pairing code: ${err.message}`);
    }
  }

  // ==========================================================================
  // QR CODE — Generate using the global socket
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
  // WAIT FOR CONNECTION — Returns a promise that resolves when the device
  // links successfully for a given sessionId.
  // ==========================================================================
  waitForConnection(sessionId: string, timeoutMs: number = 120000): Promise<boolean> {
    // Check if already connected
    const existing = sessionStore.get(sessionId);
    if (existing && existing.status === 'connected') {
      return Promise.resolve(true);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.connectionOpenResolvers.delete(sessionId);
        resolve(false); // Resolve false instead of reject — allows polling to continue
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
  // KEEP-ALIVE — Ping internal health endpoint + keep socket alive
  // ==========================================================================
  startKeepAlive(): void {
    if (this.keepAliveTimer) return;

    const intervalMs = config.keepAliveIntervalMs; // 4.5 minutes by default
    log.info({ intervalMs }, 'Starting keep-alive system');

    this.keepAliveTimer = setInterval(async () => {
      try {
        // Internal health ping
        const healthUrl = `http://localhost:${config.port}/health`;
        const res = await fetch(healthUrl);
        const data = await res.json() as any;
        log.info({
          health: data.data?.status,
          uptime: Math.floor(process.uptime()),
          socketReady: this.state.isReady,
          pairingInProgress: this._pairingLock,
          pendingSessions: this.pendingPairingSessions.size,
        }, 'Keep-alive ping OK');

        this.state.lastKeepAlive = Date.now();

        // If socket is disconnected but should be connected, reconnect
        if (!this.state.isReady && !this.state.isConnecting && !this.isShuttingDown && !this._pairingLock) {
          log.warn('Keep-alive detected disconnected socket — triggering reconnect');
          this.scheduleReconnect();
        }
      } catch (err: any) {
        log.warn({ err: err.message }, 'Keep-alive ping failed (may be normal during startup)');
      }
    }, intervalMs);

    // Don't prevent process exit
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
    // Ensure auth is clean before creating socket
    // This is the CRITICAL fix: also check on reconnect, not just initialize
    this.ensureCleanAuth();

    const { state, saveCreds } = await useMultiFileAuthState(this.globalAuthDir);

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

    // Log the current auth state
    const hasCredsMe = !!(state.creds?.me?.id);
    const isRegistered = !!state.creds?.registered;
    const hasPairingCode = !!state.creds?.pairingCode;
    log.info({
      hasCredsMe,
      isRegistered,
      hasPairingCode,
      credsMeId: state.creds?.me?.id,
    }, 'Auth state loaded for socket creation');

    const socketConfig: UserFacingSocketConfig = {
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, log),
      },
      printQRInTerminal: false,
      // Use Browsers.ubuntu('Chrome') — this maps to PlatformType CHROME (1)
      // which is the most common and widely accepted WhatsApp Web platform
      browser: Browsers.ubuntu('Chrome'),
      syncFullHistory: false,
      markOnlineOnConnect: false,
      logger: log.child({ scope: 'baileys' }),
      generateHighQualityLinkPreview: false,
      // CRITICAL FIX: Remove shouldIgnoreJid: () => true
      // This was blocking ALL incoming JID processing, which could interfere
      // with pairing-related notifications from WhatsApp servers.
      // Instead, we only ignore group JIDs and broadcast lists since we're
      // a session generation service, not a message processing service.
      shouldIgnoreJid: (jid: string) => {
        // Don't ignore server JIDs (s.whatsapp.net) — needed for pairing
        // Ignore group JIDs and broadcast lists — not needed for session gen
        return jid?.includes('@g.us') || jid?.includes('@broadcast');
      },
      getMessage: async () => undefined,
      // FIX: Increased from 30s to 60s — Render cold starts + WhatsApp
      // handshake can take >30s, causing timeout mid-pairing
      connectTimeoutMs: 60_000,
      // Baileys internal keep-alive ping — sends every 25s
      keepAliveIntervalMs: 25_000,
      qrTimeout: 60_000,
      // Don't fire initial queries — reduces noise for session generation
      fireInitQueries: false,
      // Explicitly set mobile to false — we're using multi-device protocol
      mobile: false,
    };

    const sock = makeWASocket(socketConfig);
    this.socket = sock;
    this.saveCreds = saveCreds;
    this.state.socketCreatedAt = Date.now();

    // Save credentials on update — this saves to the GLOBAL auth dir
    sock.ev.on('creds.update', () => {
      log.info('creds.update event — saving credentials to disk');
      saveCreds();
    });

    // Connection update handler — WITH COMPREHENSIVE LOGGING
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
  // PRIVATE — Handle connection updates for the GLOBAL socket
  // ==========================================================================
  private handleGlobalConnectionUpdate(update: Partial<ConnectionState>): void {
    const { connection, lastDisconnect, qr, receivedPendingNotifications } = update;

    // Track last connection event for diagnostics
    this.state.lastConnectionEvent = connection || (qr ? 'qr_received' : 'unknown');

    log.info({
      connection: connection || 'undefined',
      hasQR: !!qr,
      hasLastDisconnect: !!lastDisconnect,
      receivedPendingNotifications: !!receivedPendingNotifications,
      isReady: this.state.isReady,
      isConnecting: this.state.isConnecting,
      pairingInProgress: this._pairingLock,
      pendingSessions: this.pendingPairingSessions.size,
      wsIsOpen: this.socket?.ws?.isOpen,
      socketAge: this.state.socketCreatedAt ? Math.round((Date.now() - this.state.socketCreatedAt) / 1000) + 's' : 'N/A',
    }, '📡 Global connection update');

    // QR code — signals that socket handshake is complete and ready for pairing
    if (qr) {
      log.info('📱 QR event received — socket handshake complete, ready for pairing code requests');
      if (!this.state.isReady) {
        this.markReady();
      }
    }

    // Connection opened — device linked (for the global auth session)
    if (connection === 'open') {
      log.info({
        pairingInProgress: this._pairingLock,
        pendingSessions: this.pendingPairingSessions.size,
      }, '✅ Global WhatsApp connection OPEN — device linked successfully!');
      this.markReady();
      this.state.reconnectAttempts = 0;

      // CRITICAL: Capture session data SYNCHRONOUSLY before any reset
      // The saveCreds() has already been called by creds.update event,
      // so the files are on disk. We must copy them BEFORE resetting.
      this.captureSessionDataForPendingSessionsSync();
    }

    // "connecting" — initial handshake in progress
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

      // Map status code to human-readable reason
      const reasonMap: Record<number, string> = {
        [DisconnectReason.connectionClosed]: 'CONNECTION_CLOSED',
        [DisconnectReason.connectionReplaced]: 'CONNECTION_REPLACED',
        [DisconnectReason.loggedOut]: 'LOGGED_OUT',
        [DisconnectReason.restartRequired]: 'RESTART_REQUIRED',
        // connectionLost and timedOut both map to 408
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
        errorOutput: error?.output,
        pairingInProgress: this._pairingLock,
        pendingSessions: this.pendingPairingSessions.size,
        socketAge: this.state.socketCreatedAt ? Math.round((Date.now() - this.state.socketCreatedAt) / 1000) + 's' : 'N/A',
      }, '❌ Global connection closed');

      this.state.isReady = false;
      this.state.isConnecting = false;
      this.state.sessionStatus = 'disconnected';

      // Mark any pending sessions as failed on disconnect
      if (this.pendingPairingSessions.size > 0) {
        log.warn({
          sessions: Array.from(this.pendingPairingSessions.keys()),
          reason,
        }, 'Disconnect during active pairing — marking sessions as failed');

        for (const [sessionId] of this.pendingPairingSessions) {
          const record = sessionStore.get(sessionId);
          if (record && record.status !== 'connected') {
            log.info({ sessionId, reason }, 'Session was pending during disconnect — marking as failed');
            sessionStore.update(sessionId, {
              status: 'failed',
              // Store the disconnect reason for frontend display
            });

            // Reject any waiting connection promises
            const resolver = this.connectionOpenResolvers.get(sessionId);
            if (resolver) {
              resolver.reject(`Connection closed: ${reason}`);
            }
          }
        }
        this.pendingPairingSessions.clear();
      }

      // Release pairing lock
      if (this._pairingLock) {
        log.info('Releasing pairing lock due to disconnect');
        this.releasePairingLock();
      }

      this.state.activePairingSessionId = null;

      // Determine reconnection strategy based on disconnect reason
      if (statusCode === DisconnectReason.loggedOut) {
        log.error('Global connection logged out — session invalid, will reinitialize with fresh auth');
        this.state.sessionStatus = 'failed';
        this.clearGlobalAuth();
        this.scheduleReconnect();
      } else if (statusCode === DisconnectReason.connectionReplaced) {
        log.warn('Global connection replaced — another instance connected');
        this.state.sessionStatus = 'failed';
        // Clear auth because another instance took over
        this.clearGlobalAuth();
        this.scheduleReconnect();
      } else if (statusCode === DisconnectReason.restartRequired) {
        log.info('Restart required — reconnecting immediately');
        this.scheduleReconnect(1000);
      } else if (statusCode === DisconnectReason.connectionClosed) {
        log.info('Connection closed (normal) — reconnecting');
        this.scheduleReconnect();
      } else if (statusCode === DisconnectReason.timedOut) {
        log.warn('Connection timed out — clearing auth and reconnecting');
        // Timeout likely means stale auth — clear it before reconnecting
        this.clearGlobalAuth();
        this.scheduleReconnect();
      } else {
        log.warn({ statusCode, reason }, 'Unexpected disconnect — clearing stale auth and reconnecting');
        // For any unknown disconnect reason, clear auth to be safe
        this.clearGlobalAuth();
        this.scheduleReconnect();
      }
    }
  }

  // ==========================================================================
  // PRIVATE — Capture session data SYNCHRONOUSLY
  //
  // When connection goes "open", a device was linked. We MUST:
  // 1. Force-save credentials to disk immediately
  // 2. Copy all auth files from global auth dir to each session's auth dir
  // 3. Update session status to "connected"
  // 4. Resolve any waiting connection promises
  // 5. THEN reset the global socket for the next pairing
  //
  // This MUST be synchronous to avoid race conditions with resetForNextPairing.
  // ==========================================================================
  private captureSessionDataForPendingSessionsSync(): void {
    if (this.pendingPairingSessions.size === 0) {
      log.info('No pending pairing sessions to capture data for — this may be a reconnection of an already-linked device');

      // If no pending sessions but connection is open, this is a reconnection
      // of a previously linked device. We should NOT reset the socket.
      // Just keep it connected.
      return;
    }

    log.info({ count: this.pendingPairingSessions.size }, '📦 Capturing session data for pending sessions');

    // Step 1: Force-save credentials to ensure files are on disk
    if (this.saveCreds) {
      try {
        this.saveCreds();
        log.info('✅ Credentials force-saved to disk');
      } catch (err: any) {
        log.error({ err: err.message }, '❌ Failed to force-save credentials');
      }
    }

    // Step 2: Verify creds.json was saved correctly
    const credsPath = join(this.globalAuthDir, 'creds.json');
    if (existsSync(credsPath)) {
      try {
        const creds = JSON.parse(readFileSync(credsPath, 'utf-8'));
        log.info({
          hasMe: !!creds.me,
          meId: creds.me?.id,
          registered: !!creds.registered,
        }, '✅ Verified creds.json on disk after force-save');
      } catch (err: any) {
        log.error({ err: err.message }, '❌ Failed to verify creds.json');
      }
    } else {
      log.error('❌ creds.json does NOT exist after force-save — critical error!');
    }

    // Step 3: For each pending session, copy auth files and update status
    for (const [sessionId, phoneNumber] of this.pendingPairingSessions) {
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
          log.info({ sessionId, filesCopied: copiedCount, totalFiles: files.length }, '✅ Session auth data captured and saved to session directory');
        } else {
          log.error({ sessionId, globalAuthDir: this.globalAuthDir }, '❌ Global auth dir does not exist!');
        }

        // Verify the session creds
        const sessionCredsPath = join(sessionAuthDir, 'creds.json');
        if (existsSync(sessionCredsPath)) {
          try {
            const sessionCreds = JSON.parse(readFileSync(sessionCredsPath, 'utf-8'));
            log.info({
              sessionId,
              hasMe: !!sessionCreds.me,
              meId: sessionCreds.me?.id,
              registered: !!sessionCreds.registered,
            }, '✅ Verified session creds.json in session directory');
          } catch (err: any) {
            log.warn({ err: err.message, sessionId }, 'Failed to verify session creds.json');
          }
        }

        // Update session status to "connected"
        sessionStore.update(sessionId, {
          status: 'connected',
          connectedAt: Date.now(),
        });

        log.info({ sessionId, phoneNumber }, '✅ Session marked as CONNECTED — credentials saved, session data available for frontend');

        // Step 4: Resolve any waiting connection promises
        const resolver = this.connectionOpenResolvers.get(sessionId);
        if (resolver) {
          log.info({ sessionId }, '✅ Resolving connection promise — session data ready for frontend');
          resolver.resolve(true);
        }
      } catch (err: any) {
        log.error({ err: err.message, sessionId }, '❌ Failed to capture session data');
        sessionStore.update(sessionId, { status: 'failed' });

        // Reject any waiting connection promises
        const resolver = this.connectionOpenResolvers.get(sessionId);
        if (resolver) {
          resolver.reject(`Failed to capture session data: ${err.message}`);
        }
      }
    }

    // Clear pending sessions
    this.pendingPairingSessions.clear();

    // Release pairing lock
    this.releasePairingLock();

    // Step 5: Reset the global socket for the next pairing request
    // This is safe now because all auth data has been copied to session dirs
    this.resetForNextPairing();
  }

  // ==========================================================================
  // PRIVATE — Reset the global socket for the next pairing request
  // ==========================================================================
  private resetForNextPairing(): void {
    log.info('Resetting global socket for next pairing request...');

    // End the current socket
    if (this.socket) {
      try {
        this.socket.end(undefined);
      } catch {}
      this.socket = null;
    }

    this.state.isReady = false;
    this.state.isConnecting = false;

    // Clear the global auth for fresh connection
    this.clearGlobalAuth();

    // Reconnect with fresh auth after a short delay
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

    // Don't reconnect if pairing is in progress
    if (this._pairingLock) {
      log.info('Skipping reconnect — pairing is in progress');
      return;
    }

    if (this.state.reconnectAttempts >= this.maxReconnectAttempts) {
      log.error({
        attempts: this.state.reconnectAttempts,
        max: this.maxReconnectAttempts,
      }, 'Max reconnect attempts reached — will retry in 5 minutes');

      this.state.reconnectAttempts = 0;
      delayMs = 300000; // 5 minutes
    }

    const attempt = this.state.reconnectAttempts + 1;
    const calculatedDelay = delayMs ?? Math.min(
      this.baseReconnectDelayMs * Math.pow(2, this.state.reconnectAttempts),
      60000 // Max 60s delay
    );

    log.info({
      attempt,
      delayMs: calculatedDelay,
      totalReconnects: this.state.totalReconnects,
    }, 'Scheduling reconnect');

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(async () => {
      this.state.reconnectAttempts++;
      this.state.totalReconnects++;

      log.info({ attempt: this.state.reconnectAttempts }, 'Attempting reconnect...');

      try {
        // Clean up old socket
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

    // Don't prevent process exit
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
  // PRIVATE — Clear global auth to force fresh connection
  // ==========================================================================
  private clearGlobalAuth(): void {
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
