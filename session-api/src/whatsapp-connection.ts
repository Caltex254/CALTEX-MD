// ============================================================================
// CALTEX Session API - WhatsApp Connection Manager
// Handles Baileys connections for QR and Pairing Code flows
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

/**
 * Handle connection updates (shared logic for both QR and pairing flows)
 */
function handleConnectionUpdate(
  sessionId: string,
  update: Partial<ConnectionState>,
  mode: 'qr' | 'pairing'
) {
  const { connection, lastDisconnect, qr } = update;

  // QR code received (only in QR mode)
  if (qr && mode === 'qr') {
    QRCode.toDataURL(qr, {
      width: 512,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    }).then((qrDataUrl) => {
      sessionStore.update(sessionId, {
        status: 'waiting_qr',
        qrCode: qrDataUrl,
      });
      log.info({ sessionId }, 'QR code generated');
    }).catch((err) => {
      log.error({ err, sessionId }, 'Failed to generate QR image');
    });
  }

  if (connection === 'close') {
    const error: any = lastDisconnect?.error;
    const statusCode = error?.output?.statusCode ??
      error?.output?.payload?.statusCode ?? 0;

    if (statusCode === DisconnectReason.loggedOut) {
      log.info({ sessionId }, 'Logged out — session invalid');
      sessionStore.update(sessionId, { status: 'failed', qrCode: undefined });
      cleanupSocket(sessionId);
    } else if (statusCode === DisconnectReason.restartRequired) {
      log.info({ sessionId, statusCode }, 'Restart required — reconnecting');
      // Don't mark as failed — the socket may reconnect
    } else {
      log.warn({ sessionId, statusCode, mode }, 'Connection closed');
      const record = sessionStore.get(sessionId);
      if (record && record.status !== 'connected') {
        sessionStore.update(sessionId, { status: 'failed', qrCode: undefined });
      }
      cleanupSocket(sessionId);
    }
  } else if (connection === 'open') {
    log.info({ sessionId, mode }, 'WhatsApp connected!');

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

      log.info({ sessionId, hasData: !!sessionData }, 'Session data captured');

      // Disconnect after successful capture — we only needed credentials
      setTimeout(() => {
        cleanupSocket(sessionId);
        log.info({ sessionId }, 'Session captured and socket closed');
      }, 3000);
    }, 1000);
  }
}

/**
 * Create a WhatsApp connection for QR code flow
 */
export async function createQRSession(sessionId: string): Promise<void> {
  const authDir = sessionStore.getAuthDir(sessionId);
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  log.info({ sessionId, version: version.join('.') }, 'Creating QR connection');

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, log),
    },
    printQRInTerminal: false,
    browser: Browsers.appropriate(config.browserName),
    syncFullHistory: false,
    markOnlineOnConnect: false,
    logger: log.child({ sessionId }),
    generateHighQualityLinkPreview: false,
    shouldIgnoreJid: () => true,
    getMessage: async () => undefined,
  } as UserFacingSocketConfig);

  activeSockets.set(sessionId, sock);

  // IMPORTANT: Register event handlers IMMEDIATELY after socket creation
  // to avoid missing any connection events

  // Connection update handler
  sock.ev.on('connection.update', (update) => {
    handleConnectionUpdate(sessionId, update, 'qr');
  });

  // Save credentials on update
  sock.ev.on('creds.update', () => {
    saveCreds();
  });
}

/**
 * Create a WhatsApp connection with pairing code
 *
 * CRITICAL FIX: Event handlers must be registered BEFORE calling
 * requestPairingCode() to avoid race conditions. Previously, the
 * connection.update handler was registered AFTER the await on
 * requestPairingCode(), which meant connection events could fire
 * and be missed during that async call.
 */
export async function createPairingSession(
  sessionId: string,
  phoneNumber: string
): Promise<string> {
  const authDir = sessionStore.getAuthDir(sessionId);
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  log.info({ sessionId, version: version.join('.'), phoneNumber }, 'Creating pairing code connection');

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, log),
    },
    printQRInTerminal: false,
    browser: Browsers.appropriate(config.browserName),
    syncFullHistory: false,
    markOnlineOnConnect: false,
    logger: log.child({ sessionId }),
    generateHighQualityLinkPreview: false,
    shouldIgnoreJid: () => true,
    getMessage: async () => undefined,
    // IMPORTANT: mobile flag must NOT be set for pairing code to work
  } as UserFacingSocketConfig);

  activeSockets.set(sessionId, sock);

  // IMPORTANT: Register ALL event handlers BEFORE calling requestPairingCode()
  // This is the critical fix — the connection.update event can fire during
  // the requestPairingCode() call, and we must capture it.

  // Connection update handler — registered BEFORE requestPairingCode
  sock.ev.on('connection.update', (update) => {
    handleConnectionUpdate(sessionId, update, 'pairing');
  });

  // Save credentials on update — registered BEFORE requestPairingCode
  sock.ev.on('creds.update', () => {
    saveCreds();
  });

  // Now it's safe to request the pairing code
  // This initiates the WebSocket connection to WhatsApp and requests the code
  let pairingCode = '';
  try {
    // Wait a brief moment for the socket to initialize
    await new Promise(resolve => setTimeout(resolve, 500));

    pairingCode = await sock.requestPairingCode(phoneNumber);
    log.info({ sessionId, pairingCode, phoneNumber }, 'Pairing code generated successfully');
  } catch (err: any) {
    log.error({ err: err.message, sessionId, phoneNumber }, 'Failed to request pairing code');
    sessionStore.update(sessionId, { status: 'failed' });
    cleanupSocket(sessionId);
    throw new Error(`Failed to request pairing code: ${err.message}`);
  }

  sessionStore.update(sessionId, {
    status: 'waiting_pairing',
    pairingCode,
  });

  log.info({ sessionId, pairingCode, phoneNumber }, 'Pairing session active — waiting for user to enter code on WhatsApp');

  return pairingCode;
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

  // Wait a bit for QR to be generated
  await new Promise(resolve => setTimeout(resolve, 5000));
  const updated = sessionStore.get(sessionId);
  return updated?.qrCode || null;
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
}

/**
 * Clean up all sockets (for graceful shutdown)
 */
export function cleanupAllSockets() {
  for (const [sessionId] of activeSockets) {
    cleanupSocket(sessionId);
  }
}
