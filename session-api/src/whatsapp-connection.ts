// ============================================================================
// CALTEX Session API - WhatsApp Connection Manager
//
// Rewritten based on proven working implementations:
// - Official Baileys Wiki: https://baileys.wiki/docs/socket/connecting
// - Guru322/Express-pairing-code (GitHub)
// - Kingjux/giftedmdV2-session-generator (GitHub)
//
// KEY FIX: requestPairingCode() is called INSIDE the connection.update
// event handler when the "connecting" or "qr" event fires, as documented
// in the official Baileys wiki. This ensures the socket handshake is
// complete before the pairing code is requested.
//
// The pairing code is returned to the caller via a Promise that resolves
// when the code is generated inside the event handler.
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
 * Create a WhatsApp connection for QR code flow
 */
export async function createQRSession(sessionId: string): Promise<void> {
  const authDir = sessionStore.getAuthDir(sessionId);
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  log.info({ sessionId, version: version.join('.') }, 'Creating QR code connection');

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, log),
    },
    printQRInTerminal: false,
    browser: Browsers.ubuntu('Chrome'),
    syncFullHistory: false,
    markOnlineOnConnect: false,
    logger: log.child({ sessionId }),
    generateHighQualityLinkPreview: false,
    shouldIgnoreJid: () => true,
    getMessage: async () => undefined,
  } as UserFacingSocketConfig);

  activeSockets.set(sessionId, sock);

  // Register event handlers immediately after socket creation
  sock.ev.on('connection.update', (update) => {
    handleConnectionUpdate(sessionId, update, 'qr', sock, saveCreds);
  });

  sock.ev.on('creds.update', () => {
    saveCreds();
  });
}

/**
 * Create a WhatsApp connection with pairing code
 *
 * This follows the OFFICIAL Baileys documentation pattern:
 * https://baileys.wiki/docs/socket/connecting
 *
 * "When you want to request a pairing code, you should wait at least until
 * the connecting/QR event like above. You shouldn't worry about the QR events,
 * they just exist there."
 *
 * The pairing code is requested INSIDE the connection.update handler,
 * when the socket handshake is complete. A Promise is used to return
 * the code to the caller.
 */
export async function createPairingSession(
  sessionId: string,
  phoneNumber: string
): Promise<string> {
  const authDir = sessionStore.getAuthDir(sessionId);
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  log.info({ sessionId, version: version.join('.'), phoneNumber }, 'Creating pairing code connection');

  // Create a Promise that will be resolved when the pairing code is generated
  // inside the connection.update event handler
  let pairingCodeResolve: (code: string) => void;
  let pairingCodeReject: (error: Error) => void;
  const pairingCodePromise = new Promise<string>((resolve, reject) => {
    pairingCodeResolve = resolve;
    pairingCodeReject = reject;
  });

  // Set a timeout to reject if pairing code isn't generated within 45 seconds
  // (QR event can take 5-20 seconds to arrive, plus time for requestPairingCode)
  const timeoutId = setTimeout(() => {
    pairingCodeReject!(new Error('Timeout: Pairing code was not generated within 45 seconds. WhatsApp servers may be slow or unreachable.'));
  }, 45000);

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, log),
    },
    printQRInTerminal: false,
    browser: Browsers.ubuntu('Chrome'),
    syncFullHistory: false,
    markOnlineOnConnect: false,
    logger: log.child({ sessionId }),
    generateHighQualityLinkPreview: false,
    shouldIgnoreJid: () => true,
    getMessage: async () => undefined,
  } as UserFacingSocketConfig);

  activeSockets.set(sessionId, sock);

  // Save credentials on update — must be registered BEFORE connection.update
  // because requestPairingCode sets creds.me and creds.pairingCode
  sock.ev.on('creds.update', () => {
    log.info({ sessionId }, 'Credentials updated — saving to disk');
    saveCreds();
  });

  // Connection update handler — THIS IS WHERE THE PAIRING CODE IS REQUESTED
  // Following the official Baileys documentation pattern
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    log.info({
      sessionId,
      connection: connection || 'undefined',
      hasQR: !!qr,
    }, 'Connection update event');

    // ==============================================================
    // PAIRING CODE REQUEST — per official Baileys documentation:
    //
    // "When you want to request a pairing code, you should wait at
    // least until the connecting/QR event"
    //
    // IMPORTANT: The "connecting" event fires immediately on socket
    // creation, BEFORE the WebSocket is actually open. Only the QR
    // event is a reliable signal that the handshake is complete and
    // the socket can send IQ stanzas (like requestPairingCode).
    //
    // Working implementations use either:
    // - The QR event (most reliable)
    // - A fixed delay of 2-3 seconds (Guru322, Kingjux)
    //
    // We use the QR event for reliability.
    // ==============================================================
    if (qr && !sock.authState.creds.registered) {
      log.info({ sessionId, phoneNumber }, 'QR event received — socket ready, requesting pairing code');

      try {
        const code = await sock.requestPairingCode(phoneNumber);
        log.info({ sessionId, pairingCode: code, phoneNumber }, 'Pairing code generated successfully');

        // Update session store
        sessionStore.update(sessionId, {
          status: 'waiting_pairing',
          pairingCode: code,
        });

        // Clear the timeout and resolve the promise
        clearTimeout(timeoutId);
        pairingCodeResolve!(code);
      } catch (err: any) {
        log.error({ err: err.message, sessionId, phoneNumber }, 'Failed to request pairing code');
        clearTimeout(timeoutId);
        pairingCodeReject!(new Error(`Failed to request pairing code: ${err.message}`));
      }
    }

    // QR code in pairing mode — this is normal, just log it
    if (qr) {
      log.info({ sessionId, mode: 'pairing' }, 'QR event received in pairing mode (normal — handshake signal)');
    }

    // Connection opened — device linked successfully!
    if (connection === 'open') {
      log.info({ sessionId, mode: 'pairing' }, 'WhatsApp connected! Device linked successfully.');

      // Give a moment for credentials to be fully saved
      setTimeout(() => {
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

        // Disconnect after successful capture
        setTimeout(() => {
          cleanupSocket(sessionId);
          log.info({ sessionId }, 'Session captured and socket closed');
        }, 3000);
      }, 2000);
    }

    // Connection closed
    if (connection === 'close') {
      const error: any = lastDisconnect?.error;
      const statusCode = error?.output?.statusCode ??
        error?.output?.payload?.statusCode ?? 0;

      log.warn({ sessionId, statusCode, errorMessage: error?.message }, 'Connection closed');

      if (statusCode === DisconnectReason.loggedOut) {
        log.info({ sessionId }, 'Logged out — session invalid');
        sessionStore.update(sessionId, { status: 'failed', qrCode: undefined });
        cleanupSocket(sessionId);
      } else if (statusCode === DisconnectReason.restartRequired) {
        log.info({ sessionId }, 'Restart required — reconnecting');
        // Don't mark as failed — Baileys handles reconnection
      } else if (statusCode === DisconnectReason.connectionClosed) {
        // This is NORMAL during the pairing flow — WhatsApp forcibly disconnects
        // and reconnects after the user scans/enters the code.
        log.info({ sessionId }, 'Connection closed (normal during pairing) — will reconnect');
      } else if (statusCode === DisconnectReason.connectionReplaced) {
        log.info({ sessionId }, 'Connection replaced — another device connected');
        sessionStore.update(sessionId, { status: 'failed', qrCode: undefined });
        cleanupSocket(sessionId);
      } else {
        log.warn({ sessionId, statusCode }, 'Connection closed with unexpected status');
        const record = sessionStore.get(sessionId);
        if (record && record.status !== 'connected') {
          sessionStore.update(sessionId, { status: 'failed', qrCode: undefined });
          cleanupSocket(sessionId);
        }
      }
    }
  });

  // Wait for the pairing code to be generated (resolved by the event handler)
  try {
    const pairingCode = await pairingCodePromise;
    log.info({ sessionId, pairingCode, phoneNumber }, 'Returning pairing code to caller');
    return pairingCode;
  } catch (err: any) {
    log.error({ err: err.message, sessionId }, 'Pairing code generation failed');
    sessionStore.update(sessionId, { status: 'failed' });
    cleanupSocket(sessionId);
    throw err;
  }
}

/**
 * Handle connection updates for QR code flow
 */
function handleConnectionUpdate(
  sessionId: string,
  update: Partial<ConnectionState>,
  mode: 'qr',
  sock: WASocket,
  saveCreds: () => void
): void;

/**
 * Handle connection updates for pairing code flow (unused — handled inline)
 */
function handleConnectionUpdate(
  sessionId: string,
  update: Partial<ConnectionState>,
  mode: 'pairing',
  sock: WASocket,
  saveCreds: () => void
): void;

function handleConnectionUpdate(
  sessionId: string,
  update: Partial<ConnectionState>,
  mode: 'qr' | 'pairing',
  sock: WASocket,
  saveCreds: () => void
): void {
  const { connection, lastDisconnect, qr } = update;

  log.info({
    sessionId,
    mode,
    connection: connection || 'undefined',
    hasQR: !!qr,
  }, 'Connection update event');

  // QR code received
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
      log.info({ sessionId }, 'QR code image generated');
    }).catch((err) => {
      log.error({ err, sessionId }, 'Failed to generate QR image');
    });
  }

  // Connection opened
  if (connection === 'open') {
    log.info({ sessionId, mode }, 'WhatsApp connected!');

    setTimeout(() => {
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

      setTimeout(() => {
        cleanupSocket(sessionId);
        log.info({ sessionId }, 'Session captured and socket closed');
      }, 3000);
    }, 2000);
  }

  // Connection closed
  if (connection === 'close') {
    const error: any = lastDisconnect?.error;
    const statusCode = error?.output?.statusCode ??
      error?.output?.payload?.statusCode ?? 0;

    log.warn({ sessionId, statusCode, mode }, 'Connection closed');

    if (statusCode === DisconnectReason.loggedOut) {
      sessionStore.update(sessionId, { status: 'failed', qrCode: undefined });
      cleanupSocket(sessionId);
    } else if (statusCode === DisconnectReason.restartRequired) {
      log.info({ sessionId }, 'Restart required — may reconnect');
    } else if (statusCode === DisconnectReason.connectionClosed) {
      log.info({ sessionId }, 'Connection closed (normal during pairing)');
    } else {
      const record = sessionStore.get(sessionId);
      if (record && record.status !== 'connected') {
        sessionStore.update(sessionId, { status: 'failed', qrCode: undefined });
        cleanupSocket(sessionId);
      }
    }
  }
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
