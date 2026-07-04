// ============================================================================
// CALTEX Session API - WhatsApp Connection Manager
// Handles Baileys connections for QR and Pairing Code flows
//
// AUDIT FIXES (2026-07-05):
// 1. Wait for socket handshake to complete before calling requestPairingCode()
// 2. Track connection state properly (connecting → connected → ready)
// 3. Handle QR event in pairing mode (it fires during handshake, signals ready)
// 4. Don't mark session as failed on temporary disconnects during pairing
// 5. Add exhaustive logging for every auth state change
// 6. Keep socket alive while waiting for user to enter pairing code
// 7. Properly handle the pairing flow: connecting → qr(handshake done) →
//    requestPairingCode → waiting_pairing → connection.open
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
import { sessionStore } from './session-store';
import { config } from './config';
import QRCode from 'qrcode';

const log = createLogger('whatsapp-connection');

// Active connections (sessionId → WASocket)
const activeSockets: Map<string, WASocket> = new Map();

// Connection state tracking (sessionId → internal state)
interface ConnectionStateTracker {
  socketReady: boolean;       // WebSocket handshake completed (QR event received)
  pairingCodeSent: boolean;   // requestPairingCode() was called
  connectionOpened: boolean;  // connection.update with 'open' received
  retryCount: number;         // Number of reconnect attempts
}
const connectionStates: Map<string, ConnectionStateTracker> = new Map();

/**
 * Handle connection updates (shared logic for both QR and pairing flows)
 *
 * CRITICAL: Every state change is logged for debugging. The pairing code
 * flow has specific handling to avoid marking sessions as failed on
 * temporary disconnects.
 */
function handleConnectionUpdate(
  sessionId: string,
  update: Partial<ConnectionState>,
  mode: 'qr' | 'pairing'
) {
  const { connection, lastDisconnect, qr, receivedPendingNotifications, isNewLogin } = update;
  const tracker = connectionStates.get(sessionId);

  // ========== EXHAUSTIVE LOGGING ==========
  log.info({
    sessionId,
    mode,
    connection: connection || 'undefined',
    hasQR: !!qr,
    hasLastDisconnect: !!lastDisconnect,
    receivedPendingNotifications: receivedPendingNotifications || false,
    isNewLogin: isNewLogin || false,
    trackerState: tracker ? {
      socketReady: tracker.socketReady,
      pairingCodeSent: tracker.pairingCodeSent,
      connectionOpened: tracker.connectionOpened,
    } : 'no_tracker',
  }, '🔄 connection.update event received');

  // ========== QR CODE HANDLING ==========
  // In QR mode: generate QR image and update session
  // In pairing mode: the QR event signals the WebSocket handshake is complete.
  //   This is the critical moment — the socket is now ready for requestPairingCode()
  if (qr) {
    log.info({ sessionId, mode, qrLength: qr.length }, '📱 QR code event received');

    if (tracker) {
      tracker.socketReady = true;
    }

    if (mode === 'qr') {
      QRCode.toDataURL(qr, {
        width: 512,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      }).then((qrDataUrl) => {
        sessionStore.update(sessionId, {
          status: 'waiting_qr',
          qrCode: qrDataUrl,
        });
        log.info({ sessionId }, '✅ QR code image generated and stored');
      }).catch((err) => {
        log.error({ err, sessionId }, '❌ Failed to generate QR image');
      });
    } else {
      // Pairing mode: QR event means handshake is done — socket is ready
      log.info({ sessionId }, '✅ Socket handshake complete (QR event in pairing mode) — socket is ready for pairing code request');
    }
  }

  // ========== CONNECTION ESTABLISHING ==========
  if (connection === 'connecting') {
    log.info({ sessionId, mode }, '🔌 Socket connecting to WhatsApp servers...');
  }

  // ========== CONNECTION CLOSED ==========
  if (connection === 'close') {
    const error: any = lastDisconnect?.error;
    const statusCode = error?.output?.statusCode ??
      error?.output?.payload?.statusCode ?? 0;
    const errorDescription = getDisconnectReasonDescription(statusCode);

    log.warn({
      sessionId,
      mode,
      statusCode,
      errorDescription,
      errorMessage: error?.message || 'unknown',
      trackerState: tracker ? {
        socketReady: tracker.socketReady,
        pairingCodeSent: tracker.pairingCodeSent,
        connectionOpened: tracker.connectionOpened,
      } : 'no_tracker',
    }, '🔌 Connection closed');

    if (statusCode === DisconnectReason.loggedOut) {
      log.info({ sessionId }, '🚫 Logged out — session invalid');
      sessionStore.update(sessionId, { status: 'failed', qrCode: undefined });
      cleanupSocket(sessionId);
    } else if (statusCode === DisconnectReason.restartRequired) {
      log.info({ sessionId, statusCode }, '🔄 Restart required — will reconnect');
      // Don't mark as failed — Baileys may auto-reconnect
      if (tracker) {
        tracker.retryCount++;
      }
    } else if (statusCode === DisconnectReason.connectionClosed) {
      // Connection closed — common during pairing, don't immediately fail
      log.info({ sessionId, mode }, '🔌 Connection closed (temporary) — may reconnect');
      if (tracker && tracker.pairingCodeSent && !tracker.connectionOpened) {
        // We sent a pairing code but haven't connected yet — this might be
        // a temporary disconnect during the pairing handshake.
        // Don't mark as failed — give it time to reconnect.
        log.info({ sessionId }, '⏳ Pairing code was sent, waiting for reconnect...');
        // Set a timeout to mark as failed if we don't reconnect
        setTimeout(() => {
          const current = sessionStore.get(sessionId);
          if (current && current.status === 'waiting_pairing') {
            const currentTracker = connectionStates.get(sessionId);
            if (currentTracker && !currentTracker.connectionOpened) {
              log.warn({ sessionId }, '❌ Session did not reconnect after pairing code — marking as failed');
              sessionStore.update(sessionId, { status: 'failed', qrCode: undefined });
              cleanupSocket(sessionId);
            }
          }
        }, 30000); // 30 second grace period
      } else if (!tracker || !tracker.pairingCodeSent) {
        // No pairing code was sent, safe to mark as failed
        const record = sessionStore.get(sessionId);
        if (record && record.status !== 'connected') {
          sessionStore.update(sessionId, { status: 'failed', qrCode: undefined });
          cleanupSocket(sessionId);
        }
      }
    } else if (statusCode === DisconnectReason.timedOut) {
      log.warn({ sessionId, mode }, '⏰ Connection timed out');
      if (tracker && tracker.pairingCodeSent && !tracker.connectionOpened) {
        // Pairing code was sent but connection timed out — give grace period
        log.info({ sessionId }, '⏳ Pairing code was sent, connection timed out — grace period');
        setTimeout(() => {
          const current = sessionStore.get(sessionId);
          if (current && current.status === 'waiting_pairing') {
            const currentTracker = connectionStates.get(sessionId);
            if (currentTracker && !currentTracker.connectionOpened) {
              sessionStore.update(sessionId, { status: 'failed', qrCode: undefined });
              cleanupSocket(sessionId);
            }
          }
        }, 30000);
      } else {
        const record = sessionStore.get(sessionId);
        if (record && record.status !== 'connected') {
          sessionStore.update(sessionId, { status: 'failed', qrCode: undefined });
          cleanupSocket(sessionId);
        }
      }
    } else {
      // Other disconnect reasons
      log.warn({ sessionId, statusCode, mode, errorDescription }, '🔌 Connection closed (other reason)');
      const record = sessionStore.get(sessionId);
      if (record && record.status !== 'connected') {
        sessionStore.update(sessionId, { status: 'failed', qrCode: undefined });
        cleanupSocket(sessionId);
      }
    }
  }

  // ========== CONNECTION OPEN ==========
  else if (connection === 'open') {
    log.info({ sessionId, mode }, '🎉 WhatsApp connection OPENED!');

    if (tracker) {
      tracker.connectionOpened = true;
    }

    // Give a moment for credentials to be saved
    setTimeout(() => {
      // Export session data
      const sessionDataStr = sessionStore.exportSession(sessionId);
      const sessionData = sessionDataStr ? JSON.parse(sessionDataStr) : null;

      sessionStore.update(sessionId, {
        status: 'connected',
        connectedAt: Date.now(),
        qrCode: undefined,
        pairingCode: undefined,
        sessionData,
      });

      log.info({ sessionId, hasData: !!sessionData, mode }, '✅ Session data captured and stored');

      // Disconnect after successful capture — we only needed credentials
      setTimeout(() => {
        cleanupSocket(sessionId);
        log.info({ sessionId }, '🔌 Session captured and socket closed gracefully');
      }, 3000);
    }, 1500); // Increased from 1s to 1.5s to ensure all credentials are saved
  }
}

/**
 * Get human-readable description for disconnect reason codes
 */
function getDisconnectReasonDescription(code: number): string {
  const reasons: Record<number, string> = {
    [DisconnectReason.badSession]: 'Bad session — session may be corrupted',
    [DisconnectReason.connectionClosed]: 'Connection closed — normal, may reconnect',
    [DisconnectReason.connectionLost]: 'Connection lost — network issue',
    [DisconnectReason.connectionReplaced]: 'Connection replaced — another client connected',
    [DisconnectReason.loggedOut]: 'Logged out — device was unlinked',
    [DisconnectReason.restartRequired]: 'Restart required — server requested restart',
    [DisconnectReason.timedOut]: 'Timed out — no response from server',
    // 515 is a custom code meaning "reconnect required"
    515: 'Reconnect required (515)',
    // 428 is "connection forcibly closed"
    428: 'Connection forcibly closed (428)',
    // 440 is "connection standoff"
    440: 'Connection standoff (440)',
  };
  return reasons[code] || `Unknown reason (${code})`;
}

/**
 * Create a WhatsApp connection for QR code flow
 */
export async function createQRSession(sessionId: string): Promise<void> {
  const authDir = sessionStore.getAuthDir(sessionId);
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  log.info({ sessionId, version: version.join('.') }, '🚀 Creating QR code connection');

  // Initialize connection state tracker
  connectionStates.set(sessionId, {
    socketReady: false,
    pairingCodeSent: false,
    connectionOpened: false,
    retryCount: 0,
  });

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, log),
    },
    printQRInTerminal: false,
    browser: Browsers.ubuntu(config.browserName),
    syncFullHistory: false,
    markOnlineOnConnect: false,
    logger: log.child({ sessionId }),
    generateHighQualityLinkPreview: false,
    shouldIgnoreJid: () => true,
    getMessage: async () => undefined,
  } as UserFacingSocketConfig);

  activeSockets.set(sessionId, sock);

  // Register event handlers IMMEDIATELY after socket creation
  sock.ev.on('connection.update', (update) => {
    handleConnectionUpdate(sessionId, update, 'qr');
  });

  sock.ev.on('creds.update', () => {
    log.info({ sessionId }, '💾 Credentials updated — saving to disk');
    saveCreds();
  });
}

/**
 * Create a WhatsApp connection with pairing code
 *
 * CRITICAL FLOW:
 * 1. Create socket → emits { connection: 'connecting' }
 * 2. WebSocket handshake completes → emits { qr: '...' }
 * 3. NOW we call requestPairingCode() — socket is ready
 * 4. User enters code on their phone
 * 5. Server sends pair-success → emits { isNewLogin: true }
 * 6. Server sends success → emits { connection: 'open' }
 *
 * The key fix: We MUST wait for the QR event before calling requestPairingCode().
 * The QR event signals that the WebSocket handshake is complete and the socket
 * is ready to send the companion_hello IQ stanza.
 */
export async function createPairingSession(
  sessionId: string,
  phoneNumber: string
): Promise<string> {
  const authDir = sessionStore.getAuthDir(sessionId);
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  log.info({ sessionId, version: version.join('.'), phoneNumber }, '🚀 Creating pairing code connection');

  // Initialize connection state tracker
  connectionStates.set(sessionId, {
    socketReady: false,
    pairingCodeSent: false,
    connectionOpened: false,
    retryCount: 0,
  });

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, log),
    },
    printQRInTerminal: false,
    // Use a fixed browser config for consistent behavior
    // Browsers.ubuntu('Chrome') → ['Ubuntu', 'Chrome', '22.04.4']
    // browser[1] = 'Chrome' → maps to DeviceProps.PlatformType.CHROME
    browser: Browsers.ubuntu(config.browserName),
    syncFullHistory: false,
    markOnlineOnConnect: false,
    logger: log.child({ sessionId }),
    generateHighQualityLinkPreview: false,
    shouldIgnoreJid: () => true,
    getMessage: async () => undefined,
    // DO NOT set mobile: true — it throws "Mobile API is not supported anymore"
  } as UserFacingSocketConfig);

  activeSockets.set(sessionId, sock);

  // ==========================================================================
  // STEP 1: Register ALL event handlers IMMEDIATELY after socket creation
  // This ensures we don't miss any events during the connection lifecycle
  // ==========================================================================

  // Connection update handler
  sock.ev.on('connection.update', (update) => {
    handleConnectionUpdate(sessionId, update, 'pairing');
  });

  // Save credentials on update — CRITICAL: must be registered before
  // requestPairingCode() because it sets creds.me and creds.pairingCode
  // and the server response handler needs pairingEphemeralKeyPair to persist
  sock.ev.on('creds.update', () => {
    log.info({ sessionId }, '💾 Credentials updated — saving to disk (critical for pairing)');
    saveCreds();
  });

  // ==========================================================================
  // STEP 2: Wait for the socket to be ready before calling requestPairingCode
  //
  // The socket must complete its initial WebSocket handshake before we can
  // send the companion_hello IQ stanza. The QR event signals this is done.
  // We poll the connectionState tracker which is set by handleConnectionUpdate.
  // ==========================================================================

  log.info({ sessionId, phoneNumber }, '⏳ Waiting for socket handshake to complete...');

  const socketReady = await waitForSocketReady(sessionId, 20000); // 20 second timeout

  if (!socketReady) {
    log.error({ sessionId }, '❌ Socket did not become ready within timeout — cannot request pairing code');
    sessionStore.update(sessionId, { status: 'failed' });
    cleanupSocket(sessionId);
    throw new Error('WhatsApp connection failed — socket did not become ready. Please try again.');
  }

  log.info({ sessionId, phoneNumber }, '✅ Socket is ready — requesting pairing code now');

  // ==========================================================================
  // STEP 3: Request the pairing code
  //
  // requestPairingCode(phoneNumber):
  // - Sets creds.me = { id: phoneNumber@s.whatsapp.net, name: '~' }
  // - Sets creds.pairingCode = randomly generated 8-char code
  // - Sends companion_hello IQ with should_show_push_notification: 'true'
  // - Returns the 8-char pairing code
  //
  // IMPORTANT: The phone number must be digits only, no + prefix.
  // The function creates a JID: {phoneNumber}@s.whatsapp.net
  // ==========================================================================

  let pairingCode = '';
  try {
    pairingCode = await sock.requestPairingCode(phoneNumber);

    const tracker = connectionStates.get(sessionId);
    if (tracker) {
      tracker.pairingCodeSent = true;
    }

    log.info({
      sessionId,
      pairingCode,
      phoneNumber,
      phoneJID: `${phoneNumber}@s.whatsapp.net`,
    }, '✅ Pairing code generated successfully — WhatsApp should send push notification to phone');
  } catch (err: any) {
    log.error({
      err: err.message,
      errStack: err.stack,
      sessionId,
      phoneNumber,
    }, '❌ Failed to request pairing code — socket may not be connected');
    sessionStore.update(sessionId, { status: 'failed' });
    cleanupSocket(sessionId);
    throw new Error(`Failed to request pairing code: ${err.message}`);
  }

  sessionStore.update(sessionId, {
    status: 'waiting_pairing',
    pairingCode,
  });

  log.info({
    sessionId,
    pairingCode,
    phoneNumber,
  }, '📱 Pairing session active — waiting for user to enter code on WhatsApp');

  // The socket stays alive — handleConnectionUpdate will detect when
  // the user enters the code and the connection opens.

  return pairingCode;
}

/**
 * Wait for the socket to be ready (handshake complete)
 *
 * Polls the connection state tracker, which is set by handleConnectionUpdate
 * when the QR event fires. The QR event signals that the WebSocket handshake
 * is complete and the socket is ready to send IQ stanzas.
 */
async function waitForSocketReady(sessionId: string, timeoutMs: number): Promise<boolean> {
  const startTime = Date.now();
  const pollInterval = 500; // Check every 500ms

  while (Date.now() - startTime < timeoutMs) {
    const tracker = connectionStates.get(sessionId);
    if (tracker && tracker.socketReady) {
      log.info({
        sessionId,
        waitTimeMs: Date.now() - startTime,
      }, '✅ Socket ready confirmed after waiting');
      return true;
    }

    // Also check if the session was marked as failed
    const record = sessionStore.get(sessionId);
    if (record && record.status === 'failed') {
      log.warn({ sessionId }, '❌ Session marked as failed while waiting for socket ready');
      return false;
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  log.warn({ sessionId, timeoutMs }, '⏰ Timeout waiting for socket to become ready');
  return false;
}

/**
 * Get QR code for an existing session (refresh)
 */
export async function refreshQR(sessionId: string): Promise<string | null> {
  const record = sessionStore.get(sessionId);
  if (!record) return null;

  // If already has QR, return it
  if (record.qrCode) return record.qrCode;

  // If socket is active and waiting, QR may still come
  const sock = activeSockets.get(sessionId);
  if (sock) return null; // Waiting for QR

  // Create new connection for QR
  await createQRSession(sessionId);

  // Wait a bit for QR to be generated (up to 15 seconds)
  let attempts = 0;
  while (attempts < 30) {
    await new Promise(resolve => setTimeout(resolve, 500));
    const updated = sessionStore.get(sessionId);
    if (updated?.qrCode) {
      return updated.qrCode;
    }
    attempts++;
  }

  return null;
}

/**
 * Get active socket for a session
 */
export function getActiveSocket(sessionId: string): WASocket | undefined {
  return activeSockets.get(sessionId);
}

/**
 * Clean up a socket connection
 */
function cleanupSocket(sessionId: string) {
  const sock = activeSockets.get(sessionId);
  if (sock) {
    try {
      sock.end(undefined);
    } catch {}
    activeSockets.delete(sessionId);
  }
  connectionStates.delete(sessionId);
}

/**
 * Clean up all sockets (for graceful shutdown)
 */
export function cleanupAllSockets() {
  for (const [sessionId] of activeSockets) {
    cleanupSocket(sessionId);
  }
}
