// ============================================================================
// CALTEX Session API - Global WhatsApp Connection Manager (SINGLETON)
//
// ARCHITECTURE: One global WhatsApp socket, initialized on server start.
// All pairing code requests reuse the same active connection.
// Never recreates the socket per request.
//
// KEY DESIGN DECISIONS:
// 1. Singleton pattern — one WASocket instance for the entire server
// 2. Auto-initialization on server startup
// 3. Auto-reconnect with exponential backoff
// 4. Keep-alive pings for Render cold-start prevention
// 5. Connection state tracking exposed via /status and /warmup
// 6. Session data capture — when device links, copy global auth to session dir
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
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, cpSync, rmSync } from 'fs';
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
  };

  // Auth directory for the GLOBAL connection (not per-session)
  private globalAuthDir: string;
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private maxReconnectAttempts = 10;
  private baseReconnectDelayMs = 2000; // Start at 2s
  private isShuttingDown = false;
  private pendingPairingSessions: Map<string, string> = new Map(); // sessionId → phoneNumber

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
  // INITIALIZATION — Called on server startup
  // ==========================================================================
  async initialize(): Promise<void> {
    if (this.state.isConnecting || this.state.isReady) {
      log.info('WhatsApp already initialized or connecting — skipping');
      return;
    }

    log.info('⚡ Initializing global WhatsApp connection...');
    this.state.isConnecting = true;
    this.state.sessionStatus = 'connecting';

    try {
      // Clear stale global auth to ensure clean connection
      // This is important: a stale auth from a previous pairing can cause issues
      // because the socket would try to resume an old session instead of being
      // fresh for a new pairing code request
      if (existsSync(join(this.globalAuthDir, 'creds.json'))) {
        const credsContent = readFileSync(join(this.globalAuthDir, 'creds.json'), 'utf-8');
        try {
          const creds = JSON.parse(credsContent);
          // If the global auth has a registered device, it means a previous
          // pairing was completed. In that case, we keep it so the socket
          // can reconnect as that device (for session data retrieval).
          // But if not registered, clear it for a fresh start.
          if (!creds.me || !creds.me.id || !creds.registered) {
            log.info('Clearing unregistered global auth for fresh connection');
            rmSync(this.globalAuthDir, { recursive: true, force: true });
            mkdirSync(this.globalAuthDir, { recursive: true });
          } else {
            log.info({ deviceId: creds.me.id }, 'Global auth has registered device — reconnecting');
          }
        } catch {
          rmSync(this.globalAuthDir, { recursive: true, force: true });
          mkdirSync(this.globalAuthDir, { recursive: true });
        }
      }

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
      // Wait for connection to complete (up to 20s)
      log.info('Warmup requested — already connecting, waiting for ready...');
      const ready = await this.waitForReady(20000);
      if (ready) {
        return { status: 'READY', message: 'WhatsApp client is now ready' };
      }
      return { status: 'WARMING_UP', message: 'WhatsApp client is connecting, please wait...' };
    }

    // Not connecting and not ready — trigger initialization
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
  //
  // CRITICAL: Before calling requestPairingCode, we must clear the global
  // auth to get a fresh connection. This is because requestPairingCode only
  // works on a fresh (unregistered) socket.
  // ==========================================================================
  async generatePairingCode(
    phoneNumber: string,
    sessionId: string,
    _sessionAuthDir: string
  ): Promise<string> {
    if (!this.state.isReady || !this.socket) {
      throw new Error('WhatsApp client is not ready — call /warmup first');
    }

    log.info({ phoneNumber, sessionId }, 'Generating pairing code via global socket');

    // Register this session as pending — when connection opens, we'll
    // capture the session data for it
    this.pendingPairingSessions.set(sessionId, phoneNumber);
    this.state.activePairingSessionId = sessionId;

    try {
      const code = await this.socket.requestPairingCode(phoneNumber);
      this.state.lastPairingCodeAt = Date.now();
      this.state.totalPairingCodesGenerated++;

      log.info({ phoneNumber, sessionId, pairingCode: code }, 'Pairing code generated successfully');
      return code;
    } catch (err: any) {
      // Clean up pending session on failure
      this.pendingPairingSessions.delete(sessionId);
      if (this.state.activePairingSessionId === sessionId) {
        this.state.activePairingSessionId = null;
      }
      log.error({ err: err.message, phoneNumber, sessionId }, 'Failed to generate pairing code');
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
        }, 'Keep-alive ping OK');

        this.state.lastKeepAlive = Date.now();

        // If socket is disconnected but should be connected, reconnect
        if (!this.state.isReady && !this.state.isConnecting && !this.isShuttingDown) {
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

    log.info('WhatsApp manager shut down');
  }

  // ==========================================================================
  // PRIVATE — Create the global socket
  // ==========================================================================
  private async createSocket(): Promise<void> {
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
      shouldIgnoreJid: () => true,
      getMessage: async () => undefined,
      connectTimeoutMs: 30_000,
      keepAliveIntervalMs: 25_000, // Baileys internal keep-alive ping
      qrTimeout: 60_000,
    };

    const sock = makeWASocket(socketConfig);
    this.socket = sock;
    this.saveCreds = saveCreds;

    // Save credentials on update
    sock.ev.on('creds.update', () => {
      saveCreds();
    });

    // Connection update handler
    sock.ev.on('connection.update', (update) => {
      this.handleGlobalConnectionUpdate(update);
    });

    log.info('Global WhatsApp socket created — waiting for connection...');
  }

  // ==========================================================================
  // PRIVATE — Handle connection updates for the GLOBAL socket
  // ==========================================================================
  private handleGlobalConnectionUpdate(update: Partial<ConnectionState>): void {
    const { connection, lastDisconnect, qr } = update;

    log.info({
      connection: connection || 'undefined',
      hasQR: !!qr,
      isReady: this.state.isReady,
      isConnecting: this.state.isConnecting,
      pendingSessions: this.pendingPairingSessions.size,
    }, 'Global connection update');

    // QR code — signals that socket handshake is complete and ready
    if (qr) {
      log.info('QR event received — socket handshake complete, ready for pairing code requests');
      if (!this.state.isReady) {
        this.markReady();
      }
    }

    // Connection opened — device linked (for the global auth session)
    if (connection === 'open') {
      log.info('Global WhatsApp connection OPEN — device linked successfully!');
      this.markReady();
      this.state.reconnectAttempts = 0;

      // Capture session data for all pending pairing sessions
      this.captureSessionDataForPendingSessions();
    }

    // "connecting" — initial handshake in progress
    if (connection === 'connecting') {
      log.info('Global WhatsApp socket connecting...');
      this.state.isConnecting = true;
      this.state.sessionStatus = 'connecting';
    }

    // Connection closed
    if (connection === 'close') {
      const error: any = lastDisconnect?.error;
      const statusCode = error?.output?.statusCode ??
        error?.output?.payload?.statusCode ?? 0;

      log.warn({ statusCode, errorMessage: error?.message }, 'Global connection closed');

      this.state.isReady = false;
      this.state.isConnecting = false;
      this.state.sessionStatus = 'disconnected';

      // Clear pending sessions on disconnect
      for (const [sessionId] of this.pendingPairingSessions) {
        const record = sessionStore.get(sessionId);
        if (record && record.status !== 'connected') {
          // Don't mark as failed immediately — give grace period
          log.info({ sessionId }, 'Session was pending during disconnect — marking as failed');
          sessionStore.update(sessionId, { status: 'failed' });
        }
      }
      this.pendingPairingSessions.clear();
      this.state.activePairingSessionId = null;

      if (statusCode === DisconnectReason.loggedOut) {
        log.error('Global connection logged out — session invalid, will reinitialize');
        this.state.sessionStatus = 'failed';
        // Clear the auth dir so we get fresh credentials
        this.clearGlobalAuth();
        this.scheduleReconnect();
      } else if (statusCode === DisconnectReason.connectionReplaced) {
        log.warn('Global connection replaced — another instance connected');
        this.state.sessionStatus = 'failed';
        this.scheduleReconnect();
      } else if (statusCode === DisconnectReason.restartRequired) {
        log.info('Restart required — reconnecting immediately');
        this.scheduleReconnect(1000);
      } else if (statusCode === DisconnectReason.connectionClosed) {
        log.info('Connection closed (normal) — reconnecting');
        this.scheduleReconnect();
      } else if (statusCode === DisconnectReason.timedOut) {
        log.warn('Connection timed out — reconnecting');
        this.scheduleReconnect();
      } else {
        log.warn({ statusCode }, 'Unexpected disconnect — reconnecting');
        this.scheduleReconnect();
      }
    }
  }

  // ==========================================================================
  // PRIVATE — Capture session data for pending pairing sessions
  //
  // When the global socket's connection goes "open", it means a device was
  // linked. We copy the global auth data to the session's auth directory.
  // ==========================================================================
  private captureSessionDataForPendingSessions(): void {
    if (this.pendingPairingSessions.size === 0) {
      log.info('No pending pairing sessions to capture data for');
      return;
    }

    log.info({ count: this.pendingPairingSessions.size }, 'Capturing session data for pending sessions');

    // Give credentials a moment to be saved to disk
    setTimeout(() => {
      for (const [sessionId, phoneNumber] of this.pendingPairingSessions) {
        try {
          const sessionAuthDir = sessionStore.getAuthDir(sessionId);

          // Copy all auth files from global auth dir to session auth dir
          if (existsSync(this.globalAuthDir)) {
            const files = readdirSync(this.globalAuthDir);
            for (const file of files) {
              const srcPath = join(this.globalAuthDir, file);
              const dstPath = join(sessionAuthDir, file);
              try {
                const content = readFileSync(srcPath);
                writeFileSync(dstPath, content);
              } catch (err: any) {
                log.warn({ err: err.message, file }, 'Failed to copy auth file');
              }
            }
            log.info({ sessionId, filesCopied: files.length }, 'Session auth data captured');
          }

          // Update session status
          sessionStore.update(sessionId, {
            status: 'connected',
            connectedAt: Date.now(),
            pairingCode: undefined,
            qrCode: undefined,
          });

          log.info({ sessionId, phoneNumber }, 'Session marked as connected');
        } catch (err: any) {
          log.error({ err: err.message, sessionId }, 'Failed to capture session data');
          sessionStore.update(sessionId, { status: 'failed' });
        }
      }

      // Clear pending sessions
      this.pendingPairingSessions.clear();
      this.state.activePairingSessionId = null;

      // IMPORTANT: After capturing, we need to reset the global socket
      // so it's fresh for the next pairing code request.
      // The global auth now has linked device credentials, which means
      // requestPairingCode won't work anymore until we clear and reconnect.
      this.resetForNextPairing();
    }, 3000);
  }

  // ==========================================================================
  // PRIVATE — Reset the global socket for the next pairing request
  //
  // After a successful link, the global auth has device credentials.
  // We need to clear them and reconnect fresh so the next pairing
  // code request works.
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

    // Reconnect with fresh auth
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

    log.info('WhatsApp client is NOW READY for pairing code requests');
  }

  // ==========================================================================
  // PRIVATE — Schedule reconnection with exponential backoff
  // ==========================================================================
  private scheduleReconnect(delayMs?: number): void {
    if (this.isShuttingDown) return;

    if (this.state.reconnectAttempts >= this.maxReconnectAttempts) {
      log.error({
        attempts: this.state.reconnectAttempts,
        max: this.maxReconnectAttempts,
      }, 'Max reconnect attempts reached — will retry in 5 minutes');

      // Reset attempts and try again after a long delay
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
        log.info('Cleared global auth directory for fresh connection');
      }
    } catch (err: any) {
      log.error({ err: err.message }, 'Failed to clear global auth directory');
    }
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================
export const whatsappManager = new WhatsAppManager();
