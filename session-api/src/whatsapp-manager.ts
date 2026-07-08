// ============================================================================
// CALTEX Session API - Global WhatsApp Connection Manager (SINGLETON) v7.0
//
// ARCHITECTURE: One global WhatsApp socket, initialized on server start.
// All pairing code requests reuse the same active connection.
// Never recreates the socket per request.
//
// v7.0 FIXES (Complete Pairing Flow Audit):
//
// ROOT CAUSES OF "Logging in..." HANG (all 6 fixed):
//
// 1. ensureCleanAuth() was wiping valid pairing credentials during reconnect.
//    After requestPairingCode, creds.me is set but registered is false — this
//    is NORMAL during pairing. The old code treated this as "stale" and cleared
//    auth, guaranteeing failure. FIX: Skip ensureCleanAuth if there are active
//    pending or linked sessions.
//
// 2. resetForNextPairing() was called too early after captureSessionData().
//    It destroyed the socket and cleared auth while the onboarding message was
//    still being sent, and before the frontend could retrieve full session data.
//    FIX: Delay reset by 10 seconds to allow message delivery and frontend polling.
//
// 3. Race condition: isNewLogin moves sessions to linkedSessions, then
//    connection:close(restartRequired) fires, then createSocket() calls
//    ensureCleanAuth() which may wipe auth even with linked sessions.
//    FIX: ensureCleanAuth() now respects active pairing sessions.
//
// 4. connectTimeoutMs (60s) could fire during post-pairing restart on Render.
//    FIX: Increase to 120s and pause during active pairing.
//
// 5. Vercel proxy timeout (15s) too short for session polling during pairing.
//    FIX: Increase to 30s.
//
// 6. Frontend didn't handle intermediate states during reconnection.
//    FIX: Backend now returns more granular status.
//
// v6.0 ENHANCEMENTS preserved:
// - Socket health verification, keep-alive, lifecycle logging
// - WebSocket state tracking, connection timeout, rate limiting
// - Proper cleanup on session expiry, enhanced health check
//
// v5.0 FIXES preserved:
// - Don't clear auth on recoverable disconnects during pairing
// - Don't mark pending sessions as failed on recoverable disconnects
// - Pairing code expiry timeout (3 min)
// - Detailed Boom statusCode logging on every disconnect
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
  sessionStatus: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'pairing';
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
  private pairingExpiryTimer: ReturnType<typeof setTimeout> | null = null;
  private resetTimer: ReturnType<typeof setTimeout> | null = null;
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
  // Helper — Check if there are any active pairing sessions
  // ==========================================================================
  private hasActivePairingSessions(): boolean {
    return this.pendingPairingSessions.size > 0 || this.linkedSessions.size > 0;
  }

  // ==========================================================================
  // SOCKET HEALTH VERIFICATION
  // ==========================================================================
  /**
   * Comprehensive socket health check before critical operations.
   * Returns true if socket is healthy and ready for operations.
   */
  verifySocketHealth(): { healthy: boolean; reason: string; details: Record<string, any> } {
    const details: Record<string, any> = {
      hasSocket: this.socket !== null,
      isReady: this.state.isReady,
      isConnecting: this.state.isConnecting,
      socketAge: this.state.socketCreatedAt ? Math.round((Date.now() - this.state.socketCreatedAt) / 1000) + 's' : 'N/A',
      wsState: 'unknown',
    };

    // Check 1: Socket exists
    if (!this.socket) {
      return { healthy: false, reason: 'No socket instance', details };
    }

    // Check 2: WebSocket state
    const ws = this.socket.ws;
    if (ws) {
      details.wsIsOpen = ws.isOpen;
      details.wsIsClosed = ws.isClosed;
      details.wsIsConnecting = ws.isConnecting;
      details.wsState = ws.isOpen ? 'OPEN' : ws.isClosed ? 'CLOSED' : ws.isConnecting ? 'CONNECTING' : 'UNKNOWN';
    }

    // Check 3: State is ready
    if (!this.state.isReady) {
      return { healthy: false, reason: `Socket not ready (status: ${this.state.sessionStatus})`, details };
    }

    // Check 4: WebSocket is open
    if (ws && !ws.isOpen) {
      return { healthy: false, reason: `WebSocket not open (state: ${details.wsState})`, details };
    }

    // Check 5: No pairing lock held by another session
    if (this._pairingLock) {
      return { healthy: false, reason: `Pairing lock held by session: ${this.state.activePairingSessionId}`, details };
    }

    // All checks passed
    return { healthy: true, reason: 'Socket healthy', details };
  }

  /**
   * Log current socket state for diagnostics
   */
  logSocketState(): void {
    const health = this.verifySocketHealth();
    log.info({
      healthy: health.healthy,
      reason: health.reason,
      ...health.details,
      pendingSessions: this.pendingPairingSessions.size,
      linkedSessions: this.linkedSessions.size,
      pairingInProgress: this._pairingLock,
      activeSessionId: this.state.activePairingSessionId,
      lastConnectionEvent: this.state.lastConnectionEvent,
      lastDisconnectReason: this.state.lastDisconnectReason,
    }, '📊 Socket health check');
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
    this.state.sessionStatus = 'pairing';
    log.info({ sessionId }, '🔒 Pairing lock acquired');
    return true;
  }

  private releasePairingLock(): void {
    this._pairingLock = false;
    this.state.pairingInProgress = false;
    this.state.activePairingSessionId = null;
    if (this.state.sessionStatus === 'pairing') {
      this.state.sessionStatus = 'connected';
    }
    log.info('🔓 Pairing lock released');
  }

  // ==========================================================================
  // STALE AUTH CHECK — v7.0 FIX: Skip if active pairing sessions exist
  // ==========================================================================
  /**
   * Check if global auth has stale credentials and clear them.
   * 
   * CRITICAL v7.0 FIX: This now checks for active pairing/linked sessions
   * before clearing auth. During the pairing flow, creds.me is set but
   * registered is false — this is NORMAL and must NOT be cleared.
   */
  private ensureCleanAuth(): void {
    // v7.0 FIX: Never clear auth if there are active pairing sessions
    if (this.hasActivePairingSessions()) {
      log.info({
        pendingSessions: this.pendingPairingSessions.size,
        linkedSessions: this.linkedSessions.size,
      }, '⏭️ Skipping ensureCleanAuth — active pairing/linked sessions exist (auth is valid for pairing)');
      return;
    }

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

    if (this.state.isConnecting || this._pairingLock) {
      log.info('Warmup requested — already connecting or pairing, waiting for ready...');
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
    // Use comprehensive socket health verification
    const health = this.verifySocketHealth();
    this.logSocketState();

    if (!health.healthy) {
      log.error({ health }, 'Socket health check failed before pairing code generation');
      throw new Error(`WhatsApp client is not ready: ${health.reason}`);
    }

    if (!this.acquirePairingLock(sessionId)) {
      throw new Error('Another pairing is already in progress — please wait');
    }

    log.info({ phoneNumber, sessionId, socketHealth: health }, 'Generating pairing code via global socket');
    this.pendingPairingSessions.set(sessionId, phoneNumber);

    try {
      // Double-check WebSocket state right before the operation
      const ws = this.socket?.ws;
      const isWsOpen = ws?.isOpen;
      
      log.info({
        sessionId,
        wsIsOpen: isWsOpen,
        wsState: health.details.wsState,
        socketAge: health.details.socketAge,
        isReady: this.state.isReady,
      }, '📡 Final WebSocket state check before requestPairingCode');

      if (isWsOpen === false) {
        log.error({ wsIsOpen: isWsOpen, wsState: health.details.wsState }, 'WebSocket is not OPEN — cannot request pairing code');
        this.releasePairingLock();
        this.pendingPairingSessions.delete(sessionId);
        throw new Error('WhatsApp socket is not connected — please try again');
      }

      // Generate the pairing code
      const code = await this.socket!.requestPairingCode(phoneNumber);
      this.state.lastPairingCodeAt = Date.now();
      this.state.totalPairingCodesGenerated++;

      log.info({
        phoneNumber,
        sessionId,
        pairingCode: code,
        totalCodesGenerated: this.state.totalPairingCodesGenerated,
      }, '✅ Pairing code generated successfully — user should enter this in WhatsApp');

      // Start a 3-minute expiry timer — pairing codes expire after ~2 minutes,
      // and we want to auto-cleanup if the user never enters the code
      this.startPairingExpiryTimer(sessionId);

      return code;
    } catch (err: any) {
      this.releasePairingLock();
      this.pendingPairingSessions.delete(sessionId);
      log.error({ err: err.message, errStack: err.stack?.split('\n')?.slice(0, 3), phoneNumber, sessionId }, '❌ Failed to generate pairing code');
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
        log.warn({ sessionId, timeoutMs }, '⏰ waitForConnection timed out');
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
  // PAIRING CODE EXPIRY TIMER
  // Auto-fails pending sessions if no connection after 3 minutes
  // ==========================================================================
  private startPairingExpiryTimer(sessionId: string): void {
    this.clearPairingExpiryTimer();

    const EXPIRY_MS = 180_000; // 3 minutes (pairing codes expire in ~2 min)

    log.info({ sessionId, expiryMs: EXPIRY_MS }, '⏱️ Starting pairing code expiry timer');

    this.pairingExpiryTimer = setTimeout(() => {
      log.warn({ sessionId }, '⏱️ Pairing code expired — auto-failing pending session');

      const record = sessionStore.get(sessionId);
      if (record && record.status !== 'connected') {
        sessionStore.update(sessionId, { status: 'failed' });
        log.info({ sessionId }, '❌ Session marked as failed due to pairing code expiry');
      }

      // Clear from pending map
      this.pendingPairingSessions.delete(sessionId);

      // If no more pending or linked sessions, release lock and reset
      if (this.pendingPairingSessions.size === 0 && this.linkedSessions.size === 0) {
        this.releasePairingLock();
        // Reset socket for next pairing attempt
        log.info('No more pending/linked sessions — resetting for next pairing');
        this.scheduleResetForNextPairing(2000);
      }
    }, EXPIRY_MS);

    if (this.pairingExpiryTimer.unref) {
      this.pairingExpiryTimer.unref();
    }
  }

  private clearPairingExpiryTimer(): void {
    if (this.pairingExpiryTimer) {
      clearTimeout(this.pairingExpiryTimer);
      this.pairingExpiryTimer = null;
    }
  }

  // ==========================================================================
  // SHUTDOWN
  // ==========================================================================
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    log.info('Shutting down WhatsApp manager...');

    this.stopKeepAlive();
    this.clearPairingExpiryTimer();
    this.clearResetTimer();

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
    // v7.0 FIX: ensureCleanAuth now checks for active pairing sessions
    // before clearing auth — so it's safe to call during reconnect
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
      pendingSessions: this.pendingPairingSessions.size,
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
      // v7.0 FIX: Increase connectTimeoutMs to 120s — the post-pairing
      // restart needs time, especially on Render Free tier
      connectTimeoutMs: 120_000,
      keepAliveIntervalMs: 25_000,
      qrTimeout: 60_000,
      // NOTE: fireInitQueries defaults to true — needed for proper connection init
      // NOTE: mobile is deprecated in Baileys — do not set it
    };

    const sock = makeWASocket(socketConfig);
    this.socket = sock;
    this.state.socketCreatedAt = Date.now();

    // Save credentials on update — CRITICAL: must be synchronous-save
    // We use the saveCreds function from useMultiFileAuthState
    // and ALSO do a synchronous belt-and-suspenders write
    sock.ev.on('creds.update', async () => {
      const updateTimestamp = Date.now();
      log.info({
        hasCredsMe: !!sock.authState?.creds?.me?.id,
        meId: sock.authState?.creds?.me?.id,
        registered: !!sock.authState?.creds?.registered,
        pairingCode: sock.authState?.creds?.pairingCode,
        pendingSessions: this.pendingPairingSessions.size,
        linkedSessions: this.linkedSessions.size,
        timestamp: updateTimestamp,
      }, '🔐 creds.update event — saving credentials to disk');
      try {
        await saveCreds();
        log.info('✅ creds.update — credentials saved successfully via saveCreds()');
      } catch (err: any) {
        log.error({ err: err.message }, '❌ creds.update — saveCreds() FAILED — attempting manual sync save');
        // v7.0 FIX: Belt-and-suspenders — manually save creds if saveCreds() fails
        try {
          if (sock.authState?.creds) {
            const credsPath = join(this.globalAuthDir, 'creds.json');
            writeFileSync(credsPath, JSON.stringify(sock.authState.creds, null, 2));
            log.info('✅ creds.update — manual sync save succeeded');
          }
        } catch (syncErr: any) {
          log.error({ err: syncErr.message }, '❌ creds.update — manual sync save ALSO FAILED');
        }
      }
    });

    // Connection update handler
    sock.ev.on('connection.update', (update) => {
      this.handleGlobalConnectionUpdate(update);
    });

    // Stream error handler — v7.0: Add explicit stream error logging
    sock.ev.on('stream-error', (err: any) => {
      log.error({
        error: err,
        errorMessage: err?.error?.message || err?.message,
        pendingSessions: this.pendingPairingSessions.size,
        linkedSessions: this.linkedSessions.size,
        wsIsOpen: sock.ws?.isOpen,
      }, '🚨 STREAM ERROR — WebSocket stream encountered an error');
    });

    log.info({
      hasCredsMe,
      isRegistered,
      browser: socketConfig.browser,
      version: version.join('.'),
      connectTimeoutMs: socketConfig.connectTimeoutMs,
      pendingSessions: this.pendingPairingSessions.size,
      linkedSessions: this.linkedSessions.size,
    }, 'Global WhatsApp socket created — waiting for connection...');
  }

  // ==========================================================================
  // PRIVATE — Handle connection updates
  // v7.0: Enhanced logging for every state transition
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
        linkedSessions: this.linkedSessions.size,
      }, '🔗 isNewLogin=true — DEVICE PAIRING SUCCEEDED! Connection will restart. Moving sessions to linked set.');

      // Move all pending sessions to the linked set
      for (const [sessionId, phoneNumber] of this.pendingPairingSessions) {
        this.linkedSessions.set(sessionId, phoneNumber);
        log.info({ sessionId, phoneNumber }, '🔗 Session moved to linked set — will survive connection restart');
      }
      this.pendingPairingSessions.clear();

      // v7.0: Clear the pairing expiry timer — pairing succeeded
      this.clearPairingExpiryTimer();

      // v7.0: Immediately save credentials to ensure they're on disk
      // before the restart happens
      if (this.saveCredsFn) {
        this.saveCredsFn().then(() => {
          log.info('✅ Post-newLogin saveCreds() completed — credentials saved before restart');
        }).catch((err: any) => {
          log.error({ err: err.message }, '❌ Post-newLogin saveCreds() failed — attempting manual save');
          try {
            if (this.socket?.authState?.creds) {
              const credsPath = join(this.globalAuthDir, 'creds.json');
              writeFileSync(credsPath, JSON.stringify(this.socket.authState.creds, null, 2));
              log.info('✅ Post-newLogin manual save succeeded');
            }
          } catch (syncErr: any) {
            log.error({ err: syncErr.message }, '❌ Post-newLogin manual save ALSO failed');
          }
        });
      }
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

      // ── DETAILED DISCONNECT LOGGING ──
      log.warn({
        statusCode,
        reason,
        errorMessage: error?.message,
        errorStack: error?.stack?.split('\n')?.slice(0, 3),
        errorOutputPayload: error?.output?.payload,
        pairingInProgress: this._pairingLock,
        pendingSessions: this.pendingPairingSessions.size,
        linkedSessions: this.linkedSessions.size,
        socketAge: this.state.socketCreatedAt ? Math.round((Date.now() - this.state.socketCreatedAt) / 1000) + 's' : 'N/A',
        reconnectAttempts: this.state.reconnectAttempts,
      }, '❌ Global connection closed');

      this.state.isReady = false;
      this.state.isConnecting = false;
      this.state.sessionStatus = 'disconnected';

      // ── CRITICAL: Classify disconnect as FATAL or RECOVERABLE ──
      const FATAL_DISCONNECT_REASONS = new Set([
        DisconnectReason.loggedOut,          // 401
        DisconnectReason.connectionReplaced, // 403
        DisconnectReason.badSession,         // 428
        DisconnectReason.forbidden,          // 403
        DisconnectReason.multideviceMismatch,// 405
      ]);

      const isFatal = FATAL_DISCONNECT_REASONS.has(statusCode);
      const hasLinkedSessions = this.linkedSessions.size > 0;
      const hasPendingSessions = this.pendingPairingSessions.size > 0;

      // ── Handle pending sessions based on disconnect type ──
      if (hasPendingSessions) {
        if (isFatal) {
          log.warn({
            sessions: Array.from(this.pendingPairingSessions.keys()),
            reason,
            statusCode,
          }, '❌ Fatal disconnect during pairing — marking pending sessions as FAILED');

          for (const [sessionId] of this.pendingPairingSessions) {
            const record = sessionStore.get(sessionId);
            if (record && record.status !== 'connected') {
              log.info({ sessionId, reason, statusCode }, 'Pending session failed due to fatal disconnect');
              sessionStore.update(sessionId, { status: 'failed' });

              const resolver = this.connectionOpenResolvers.get(sessionId);
              if (resolver) {
                resolver.reject(`Connection closed (fatal): ${reason}`);
              }
            }
          }
          this.pendingPairingSessions.clear();
        } else {
          // Recoverable disconnect — pairing might still succeed on reconnect
          log.info({
            sessions: Array.from(this.pendingPairingSessions.keys()),
            reason,
            statusCode,
          }, '🔄 Recoverable disconnect during pairing — preserving pending sessions for reconnect');
          // Do NOT clear pendingPairingSessions — they survive the reconnect
          // Do NOT mark sessions as failed — the pairing code is still valid
        }
      }

      // ── Handle linked sessions ──
      if (hasLinkedSessions) {
        log.info({
          linkedSessions: Array.from(this.linkedSessions.keys()),
          reason,
        }, '🔗 Connection closed with linked sessions — preserving for reconnect (MUST NOT clear auth)');
        // Don't touch linkedSessions — they will be captured on reconnect
      }

      // ── Release pairing lock on fatal disconnect only ──
      if (this._pairingLock && isFatal && !hasLinkedSessions) {
        log.info('Releasing pairing lock due to fatal disconnect (no linked sessions)');
        this.releasePairingLock();
      }

      this.state.activePairingSessionId = null;

      // ── Reconnection strategy ──
      if (statusCode === DisconnectReason.loggedOut) {
        log.error('Logged out — session invalid, reinitializing with fresh auth');
        this.state.sessionStatus = 'failed';
        if (hasLinkedSessions) {
          this.cleanupOrphanedLinkedDevices();
        }
        if (hasPendingSessions) {
          for (const [sessionId] of this.pendingPairingSessions) {
            const record = sessionStore.get(sessionId);
            if (record && record.status !== 'connected') {
              sessionStore.update(sessionId, { status: 'failed' });
            }
          }
          this.pendingPairingSessions.clear();
        }
        this.clearGlobalAuth();
        this.releasePairingLock();
        this.scheduleReconnect();
      } else if (statusCode === DisconnectReason.connectionReplaced) {
        log.warn('Connection replaced — another instance connected');
        this.state.sessionStatus = 'failed';
        if (hasLinkedSessions) {
          this.cleanupOrphanedLinkedDevices();
        }
        this.clearGlobalAuth();
        this.releasePairingLock();
        this.scheduleReconnect();
      } else if (statusCode === DisconnectReason.restartRequired) {
        // ── THIS IS THE NORMAL RESTART AFTER PAIRING ──
        // v7.0: Reconnect immediately, keeping auth intact
        // ensureCleanAuth() will skip clearing because linkedSessions.size > 0
        log.info({
          hasLinkedSessions,
          hasPendingSessions,
        }, '🔄 Restart required (normal after pairing) — reconnecting immediately, keeping auth. ensureCleanAuth will skip due to linked sessions.');
        this.scheduleReconnect(1000);
      } else if (statusCode === DisconnectReason.connectionClosed) {
        // ── RECOVERABLE: Connection closed (transient network issue) ──
        log.info({
          hasPendingSessions,
          hasLinkedSessions,
        }, '🔄 Connection closed (recoverable) — reconnecting');
        // v7.0 FIX: Never clear auth if there are pending/linked sessions
        // ensureCleanAuth() will handle this check on reconnect
        if (!hasLinkedSessions && !hasPendingSessions) {
          this.clearGlobalAuth();
        } else {
          log.info('Preserving auth — active pairing session may recover on reconnect');
        }
        if (this._pairingLock && !hasPendingSessions && !hasLinkedSessions) {
          this.releasePairingLock();
        }
        this.scheduleReconnect();
      } else if (statusCode === 408) { // timedOut
        log.warn({
          hasPendingSessions,
          hasLinkedSessions,
        }, '⏰ Connection timed out (recoverable) — reconnecting');
        if (!hasLinkedSessions && !hasPendingSessions) {
          this.clearGlobalAuth();
        } else {
          log.info('Preserving auth — active pairing session may recover on reconnect');
        }
        if (this._pairingLock && !hasPendingSessions && !hasLinkedSessions) {
          this.releasePairingLock();
        }
        this.scheduleReconnect();
      } else {
        log.warn({
          statusCode,
          reason,
          hasPendingSessions,
          hasLinkedSessions,
        }, '⚠️ Unexpected disconnect — reconnecting');
        if (!hasLinkedSessions && !hasPendingSessions) {
          this.clearGlobalAuth();
        } else {
          log.info('Preserving auth — active pairing session may recover on reconnect');
        }
        if (this._pairingLock && !hasPendingSessions && !hasLinkedSessions) {
          this.releasePairingLock();
        }
        this.scheduleReconnect();
      }
    }
  }

  // ==========================================================================
  // PRIVATE — Capture session data (ASYNC — properly awaits saveCreds)
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
        let actualPhoneNumber = phoneNumber;
        if (!phoneNumber || phoneNumber === 'qr-session') {
          try {
            const sessionCredsPath2 = join(sessionAuthDir, 'creds.json');
            if (existsSync(sessionCredsPath2)) {
              const sessionCreds = JSON.parse(readFileSync(sessionCredsPath2, 'utf-8'));
              const meId = sessionCreds?.me?.id;
              if (meId) {
                actualPhoneNumber = meId.split('@')[0].split(':')[0];
                log.info({ sessionId, meId, extractedPhone: actualPhoneNumber }, '📱 Extracted phone number from creds for QR session');
              }
            }
          } catch (err: any) {
            log.warn({ err: err.message, sessionId }, 'Failed to extract phone number from session creds');
          }
        }

        // v7.0 FIX: Update session status to 'connected' IMMEDIATELY
        // so the frontend can see it on the next poll. The onboarding
        // message is sent AFTER this update.
        sessionStore.update(sessionId, {
          status: 'connected',
          connectedAt: Date.now(),
          caltexSessionId,
          phoneNumber: actualPhoneNumber !== phoneNumber ? actualPhoneNumber : undefined,
        });

        log.info({ sessionId, phoneNumber: actualPhoneNumber, caltexSessionId }, '✅ Step 4: Session marked as CONNECTED — frontend will see this on next poll');

        // Step 6: Resolve any waiting connection promises IMMEDIATELY
        // so the frontend gets the status as soon as possible
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

        // Step 5: Send onboarding WhatsApp message with Session ID
        // v7.0 FIX: This is now done AFTER resolving the promise and
        // updating status, so the frontend gets the data first
        if (actualPhoneNumber && actualPhoneNumber !== 'qr-session') {
          this.sendOnboardingMessage(sessionId, actualPhoneNumber, caltexSessionId).catch((err: any) => {
            log.error({ err: err.message, sessionId }, '❌ Onboarding message send failed (non-blocking) — session data still available');
          });
        } else {
          log.warn({ sessionId }, '⚠️ Step 5: Cannot send onboarding message — no valid phone number available');
        }
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

    // Clear pairing expiry timer — pairing succeeded
    this.clearPairingExpiryTimer();

    // Release pairing lock
    this.releasePairingLock();

    // Step 7: v7.0 FIX — DELAYED reset for next pairing
    // Instead of immediately destroying the socket and clearing auth,
    // we wait 10 seconds to allow:
    // 1. The onboarding message to be sent
    // 2. The frontend to poll and receive the session data
    // 3. Any in-flight requests to complete
    this.scheduleResetForNextPairing(10_000);
  }

  // ==========================================================================
  // PRIVATE — Schedule a delayed reset for next pairing
  // v7.0 FIX: Replaces immediate resetForNextPairing() in captureSessionData()
  // ==========================================================================
  private scheduleResetForNextPairing(delayMs: number): void {
    this.clearResetTimer();

    log.info({ delayMs }, '⏳ Scheduling delayed reset for next pairing...');

    this.resetTimer = setTimeout(() => {
      this.resetForNextPairing();
    }, delayMs);

    if (this.resetTimer.unref) {
      this.resetTimer.unref();
    }
  }

  private clearResetTimer(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }

  // ==========================================================================
  // PRIVATE — Send onboarding WhatsApp message after successful auth
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
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    if (sent) {
      sessionStore.update(sessionId, { onboardingSent: true });
      log.info({ sessionId, caltexSessionId }, '✅ Step 5: onboardingSent flag set to true');
    } else {
      log.error({ sessionId, caltexSessionId }, '❌ Step 5: Onboarding message delivery FAILED after retry — session data still available via frontend');
    }
  }

  // ==========================================================================
  // PRIVATE — Remove a linked device from WhatsApp
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
  // v7.0: This is now called via scheduleResetForNextPairing() with a delay
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

    // Clear auth only if no active sessions (should always be true at this point)
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
    // Only skip reconnect if pairing lock is held AND there are no sessions
    // (pending or linked) that need recovery. If there ARE pending/linked
    // sessions, we MUST reconnect to give them a chance to complete.
    if (this._pairingLock && this.linkedSessions.size === 0 && this.pendingPairingSessions.size === 0) {
      log.info('Skipping reconnect — pairing lock held with no sessions to recover');
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
      hasPendingSessions: this.pendingPairingSessions.size > 0,
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

        // v7.0 FIX: createSocket calls ensureCleanAuth which now
        // respects active pairing/linked sessions
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

    // v7.0 FIX: Also don't clear if there are pending sessions
    if (this.pendingPairingSessions.size > 0) {
      log.info('Skipping global auth clear — pending sessions exist that need auth for reconnect');
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
