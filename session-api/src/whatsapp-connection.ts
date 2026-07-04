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
  proto,
  UserFacingSocketConfig,
} from '@whiskeysockets/baileys';
import { createLogger } from './logger';
import { sessionStore } from './session-store';
import { config } from './config';
import QRCode from 'qrcode';

const log = createLogger('whatsapp-connection');

// Active connections (sessionId → WASocket)
const activeSockets: Map<string, WASocket> = new Map();

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
    shouldIgnoreJid: () => true, // Ignore all JIDs — we don't process messages
    getMessage: async () => undefined,
  } as UserFacingSocketConfig);

  activeSockets.set(sessionId, sock);

  // QR code handler
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        // Generate QR as base64 data URL
        const qrDataUrl = await QRCode.toDataURL(qr, {
          width: 512,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' },
        });

        sessionStore.update(sessionId, {
          status: 'waiting_qr',
          qrCode: qrDataUrl,
        });

        log.info({ sessionId }, 'QR code generated');
      } catch (err) {
        log.error({ err, sessionId }, 'Failed to generate QR image');
      }
    }

    if (connection === 'close') {
      const error: any = lastDisconnect?.error;
      const statusCode = error?.output?.statusCode ??
        error?.output?.payload?.statusCode ?? 0;

      if (statusCode === DisconnectReason.loggedOut) {
        log.info({ sessionId }, 'Logged out — session invalid');
        sessionStore.update(sessionId, { status: 'failed', qrCode: undefined });
        cleanupSocket(sessionId);
      } else {
        log.warn({ sessionId, statusCode }, 'Connection closed — will not reconnect (session API)');
        const record = sessionStore.get(sessionId);
        if (record && record.status === 'waiting_qr') {
          sessionStore.update(sessionId, { status: 'failed', qrCode: undefined });
        }
        cleanupSocket(sessionId);
      }
    } else if (connection === 'open') {
      log.info({ sessionId }, 'WhatsApp connected');

      // Export session data
      const sessionDataStr = sessionStore.exportSession(sessionId);
      const sessionData = sessionDataStr ? JSON.parse(sessionDataStr) : null;

      sessionStore.update(sessionId, {
        status: 'connected',
        connectedAt: Date.now(),
        qrCode: undefined,
        sessionData,
      });

      // Disconnect after successful connection — we only needed to capture credentials
      setTimeout(() => {
        cleanupSocket(sessionId);
        log.info({ sessionId }, 'Session captured and socket closed');
      }, 2000);
    }
  });

  // Save credentials on update
  sock.ev.on('creds.update', () => {
    saveCreds();
  });
}

/**
 * Create a WhatsApp connection with pairing code
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
  } as UserFacingSocketConfig);

  activeSockets.set(sessionId, sock);

  // Request pairing code
  let pairingCode = '';
  try {
    pairingCode = await sock.requestPairingCode(phoneNumber);
    log.info({ sessionId, pairingCode }, 'Pairing code generated');
  } catch (err: any) {
    log.error({ err: err.message, sessionId }, 'Failed to request pairing code');
    cleanupSocket(sessionId);
    throw new Error(`Failed to request pairing code: ${err.message}`);
  }

  sessionStore.update(sessionId, {
    status: 'waiting_pairing',
    pairingCode,
  });

  // Connection handler
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      const error: any = lastDisconnect?.error;
      const statusCode = error?.output?.statusCode ??
        error?.output?.payload?.statusCode ?? 0;

      if (statusCode === DisconnectReason.loggedOut) {
        log.info({ sessionId }, 'Logged out — session invalid');
        sessionStore.update(sessionId, { status: 'failed' });
        cleanupSocket(sessionId);
      } else {
        log.warn({ sessionId, statusCode }, 'Connection closed');
        const record = sessionStore.get(sessionId);
        if (record && record.status !== 'connected') {
          sessionStore.update(sessionId, { status: 'failed' });
        }
        cleanupSocket(sessionId);
      }
    } else if (connection === 'open') {
      log.info({ sessionId }, 'WhatsApp connected via pairing code');

      // Export session data
      const sessionDataStr = sessionStore.exportSession(sessionId);
      const sessionData = sessionDataStr ? JSON.parse(sessionDataStr) : null;

      sessionStore.update(sessionId, {
        status: 'connected',
        connectedAt: Date.now(),
        pairingCode: undefined,
        sessionData,
      });

      // Disconnect after capturing credentials
      setTimeout(() => {
        cleanupSocket(sessionId);
        log.info({ sessionId }, 'Session captured and socket closed');
      }, 2000);
    }
  });

  // Save credentials
  sock.ev.on('creds.update', () => {
    saveCreds();
  });

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
  await new Promise(resolve => setTimeout(resolve, 3000));
  const updated = sessionStore.get(sessionId);
  return updated?.qrCode || null;
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
