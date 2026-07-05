// ============================================================================
// CALTEX Session API - Express Routes
// All REST API endpoints — optimized for global WhatsApp singleton
// ============================================================================

import { Router, Request, Response } from 'express';
import { sessionStore } from './session-store';
import { whatsappManager } from './whatsapp-manager';
import { createLogger } from './logger';
import { config } from './config';
import QRCode from 'qrcode';

const log = createLogger('routes');

export const router = Router();

// ---------------------------------------------------------------------------
// API Key middleware (if configured)
// ---------------------------------------------------------------------------
function apiKeyMiddleware(req: Request, res: Response, next: Function) {
  if (!config.apiKey) return next();
  const key = req.headers['x-api-key'] || req.query.apikey;
  if (key !== config.apiKey) {
    return res.status(401).json({ success: false, error: 'Invalid or missing API key' });
  }
  next();
}

// Apply API key middleware to all routes
router.use(apiKeyMiddleware);

// ---------------------------------------------------------------------------
// GET /health — Health Check
// ---------------------------------------------------------------------------
router.get('/health', (_req: Request, res: Response) => {
  const sessions = sessionStore.list();
  const active = sessions.filter(s => s.status === 'waiting_qr' || s.status === 'waiting_pairing' || s.status === 'waiting_connect');
  const connected = sessions.filter(s => s.status === 'connected');
  const waState = whatsappManager.getState();

  res.json({
    success: true,
    data: {
      status: 'healthy',
      service: 'CALTEX Session API',
      version: '2.0.0',
      uptime: Math.floor(process.uptime()),
      whatsapp: {
        ready: waState.isReady,
        status: waState.sessionStatus,
        baileysVersion: waState.baileysVersion,
        lastConnectedAt: waState.lastConnectedAt,
        reconnectAttempts: waState.reconnectAttempts,
      },
      sessions: {
        total: sessions.length,
        active: active.length,
        connected: connected.length,
      },
      timestamp: new Date().toISOString(),
    },
  });
});

// ---------------------------------------------------------------------------
// GET /warmup — Initialize WhatsApp if not ready
// ---------------------------------------------------------------------------
router.get('/warmup', async (_req: Request, res: Response) => {
  try {
    const result = await whatsappManager.warmup();
    const waState = whatsappManager.getState();

    const statusCode = result.status === 'READY' ? 200 :
                       result.status === 'WARMING_UP' ? 202 : 503;

    res.status(statusCode).json({
      success: result.status === 'READY',
      data: {
        status: result.status,
        message: result.message,
        whatsapp: {
          ready: waState.isReady,
          sessionStatus: waState.sessionStatus,
          baileysVersion: waState.baileysVersion,
          lastConnectedAt: waState.lastConnectedAt,
        },
      },
    });
  } catch (err: any) {
    log.error({ err: err.message }, 'Warmup endpoint error');
    res.status(500).json({ success: false, error: 'Warmup failed' });
  }
});

// ---------------------------------------------------------------------------
// GET /status — Detailed connection state
// ---------------------------------------------------------------------------
router.get('/status', (_req: Request, res: Response) => {
  const waState = whatsappManager.getState();
  const sessions = sessionStore.list();

  res.json({
    success: true,
    data: {
      sessionApiOnline: waState.isReady || waState.isConnecting,
      whatsapp: {
        isReady: waState.isReady,
        isConnecting: waState.isConnecting,
        lastConnectedAt: waState.lastConnectedAt,
        reconnectAttempts: waState.reconnectAttempts,
        sessionStatus: waState.sessionStatus,
        baileysVersion: waState.baileysVersion,
        startedAt: waState.startedAt,
        lastKeepAlive: waState.lastKeepAlive,
        lastPairingCodeAt: waState.lastPairingCodeAt,
        totalPairingCodesGenerated: waState.totalPairingCodesGenerated,
        totalReconnects: waState.totalReconnects,
        pairingInProgress: waState.pairingInProgress,
        activePairingSessionId: waState.activePairingSessionId,
        lastDisconnectReason: waState.lastDisconnectReason,
        lastConnectionEvent: waState.lastConnectionEvent,
      },
      sessions: {
        total: sessions.length,
        active: sessions.filter(s => s.status === 'waiting_pairing' || s.status === 'waiting_qr' || s.status === 'waiting_connect').length,
        connected: sessions.filter(s => s.status === 'connected').length,
        failed: sessions.filter(s => s.status === 'failed').length,
      },
      server: {
        uptime: Math.floor(process.uptime()),
        memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
        nodeVersion: process.version,
      },
    },
  });
});

// ---------------------------------------------------------------------------
// POST /pairing-code — Generate Pairing Code (using global socket)
// ---------------------------------------------------------------------------
router.post('/pairing-code', async (req: Request, res: Response) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }

    // Validate phone format
    const cleanPhone = String(phoneNumber).replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number — must be 10-15 digits (country code + number, no +)',
      });
    }

    log.info({ phoneNumber: cleanPhone, whatsappReady: whatsappManager.isSocketReady() }, 'Pairing code request received');

    // AUTO-WARMUP: If WhatsApp not ready, trigger warmup and wait
    if (!whatsappManager.isSocketReady()) {
      log.info('WhatsApp not ready — triggering auto-warmup');
      const warmupResult = await whatsappManager.warmup();

      if (warmupResult.status !== 'READY') {
        const startTime = Date.now();
        while (!whatsappManager.isSocketReady() && Date.now() - startTime < config.autoWarmupTimeoutMs) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (!whatsappManager.isSocketReady()) {
        return res.status(503).json({
          success: false,
          error: 'WhatsApp service is warming up — please try again in a few seconds',
          data: {
            status: 'WARMING_UP',
            whatsappStatus: whatsappManager.getState().sessionStatus,
          },
        });
      }
    }

    // Create session record
    const session = sessionStore.create(cleanPhone);
    const authDir = sessionStore.getAuthDir(session.id);

    log.info({ sessionId: session.id, phoneNumber: cleanPhone }, 'Session created for pairing');

    try {
      // Generate pairing code via the GLOBAL socket
      const pairingCode = await whatsappManager.generatePairingCode(
        cleanPhone,
        session.id,
        authDir
      );

      // Update session
      sessionStore.update(session.id, {
        status: 'waiting_pairing',
        pairingCode,
      });

      // Also update to waiting_connect after a short delay
      // This signals the frontend that we're now waiting for the user to link
      setTimeout(() => {
        const currentSession = sessionStore.get(session.id);
        if (currentSession && currentSession.status === 'waiting_pairing') {
          sessionStore.update(session.id, { status: 'waiting_connect' });
          log.info({ sessionId: session.id }, 'Session status updated to waiting_connect — waiting for user to link');
        }
      }, 3000);

      log.info({
        sessionId: session.id,
        pairingCode,
        phoneNumber: cleanPhone,
        whatsappReady: whatsappManager.isSocketReady(),
        whatsappStatus: whatsappManager.getState().sessionStatus,
      }, '✅ Pairing code returned to client');

      return res.json({
        success: true,
        data: {
          sessionId: session.id,
          pairingCode,
          phoneNumber: cleanPhone,
          status: 'waiting_pairing',
          expiresIn: 120,
        },
      });
    } catch (err: any) {
      sessionStore.delete(session.id);
      log.error({ err: err.message, phoneNumber: cleanPhone }, '❌ Failed to generate pairing code');
      return res.status(502).json({
        success: false,
        error: err.message || 'Failed to generate pairing code',
      });
    }
  } catch (err: any) {
    log.error({ err: err.message }, 'Pairing code endpoint error');
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /qr-code — Generate QR Code (using global socket)
// ---------------------------------------------------------------------------
router.post('/qr-code', async (_req: Request, res: Response) => {
  try {
    log.info('QR code request received');

    if (!whatsappManager.isSocketReady()) {
      log.info('WhatsApp not ready for QR — triggering auto-warmup');
      const warmupResult = await whatsappManager.warmup();

      if (warmupResult.status !== 'READY') {
        const startTime = Date.now();
        while (!whatsappManager.isSocketReady() && Date.now() - startTime < config.autoWarmupTimeoutMs) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (!whatsappManager.isSocketReady()) {
        return res.status(503).json({
          success: false,
          error: 'WhatsApp service is warming up — please try again in a few seconds',
        });
      }
    }

    // Create session
    const session = sessionStore.create();
    // Register as pending for connection capture
    whatsappManager.getSocket(); // just to verify socket exists

    log.info({ sessionId: session.id }, 'Session created for QR code');

    try {
      // Wait for the next QR code from the global socket
      const qrString = await whatsappManager.waitForQRCode(30000);

      // Generate QR image
      const qrDataUrl = await QRCode.toDataURL(qrString, {
        width: 512,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });

      sessionStore.update(session.id, {
        status: 'waiting_qr',
        qrCode: qrDataUrl,
      });

      // Also register this session as pending so connection capture works
      // We use an internal method by setting the pending map
      // For QR sessions, we need to add to pendingPairingSessions
      (whatsappManager as any).pendingPairingSessions.set(session.id, 'qr-session');

      log.info({ sessionId: session.id }, '✅ QR code returned to client');

      return res.json({
        success: true,
        data: {
          sessionId: session.id,
          qrCode: qrDataUrl,
          status: 'waiting_qr',
          expiresIn: 60,
        },
      });
    } catch (err: any) {
      sessionStore.delete(session.id);
      log.error({ err: err.message }, '❌ Failed to generate QR code');
      return res.status(502).json({
        success: false,
        error: err.message || 'Failed to generate QR code',
      });
    }
  } catch (err: any) {
    log.error({ err: err.message }, 'QR code endpoint error');
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /session/:id — Session Status
// This is the CRITICAL polling endpoint — the frontend checks this
// repeatedly to detect when authentication completes.
// ---------------------------------------------------------------------------
router.get('/session/:id', (req: Request<{ id: string }>, res: Response) => {
  try {
    const id = req.params.id;
    const record = sessionStore.get(id);

    if (!record) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    // Build the response — include session data if connected
    const responseData: any = {
      sessionId: record.id,
      status: record.status,
      phoneNumber: record.phoneNumber,
      pairingCode: record.status === 'waiting_pairing' ? record.pairingCode : undefined,
      qrCode: record.status === 'waiting_qr' ? record.qrCode : undefined,
      createdAt: new Date(record.createdAt).toISOString(),
      connectedAt: record.connectedAt ? new Date(record.connectedAt).toISOString() : undefined,
    };

    // If connected, also include the session string so the frontend
    // can get it immediately without a second request
    if (record.status === 'connected') {
      const sessionData = sessionStore.exportSession(id);
      if (sessionData) {
        responseData.sessionString = sessionData;
        log.info({ sessionId: id }, '✅ Session data included in status response — frontend can download immediately');
      } else {
        log.warn({ sessionId: id }, '⚠️ Session is connected but no session data found on disk — attempting to re-export');
        // Try to re-export from auth directory
        const authDir = sessionStore.getAuthDir(id);
        const fs = require('fs');
        const path = require('path');
        if (fs.existsSync(path.join(authDir, 'creds.json'))) {
          log.info({ sessionId: id, authDir }, 'Auth directory exists with creds.json — data should be exportable');
        } else {
          log.error({ sessionId: id, authDir }, 'Auth directory missing creds.json — session data lost!');
        }
      }
    }

    // Log polling status for diagnostics (only every 10th poll to reduce noise)
    const pollCount = (req.query._pollCount ? parseInt(req.query._pollCount as string) : 0);
    if (pollCount % 10 === 0) {
      log.info({
        sessionId: id,
        status: record.status,
        pollCount,
        whatsappReady: whatsappManager.isSocketReady(),
        whatsappStatus: whatsappManager.getState().sessionStatus,
      }, 'Session status poll');
    }

    return res.json({
      success: true,
      data: responseData,
    });
  } catch (err: any) {
    log.error({ err: err.message }, 'Session status endpoint error');
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /session/:id/validate — Validate Session
// ---------------------------------------------------------------------------
router.post('/session/:id/validate', (req: Request<{ id: string }>, res: Response) => {
  try {
    const id = req.params.id;
    const result = sessionStore.validate(id);

    return res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    log.error({ err: err.message }, 'Session validate endpoint error');
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /session/:id/download — Download Session
// ---------------------------------------------------------------------------
router.get('/session/:id/download', (req: Request<{ id: string }>, res: Response) => {
  try {
    const id = req.params.id;
    const record = sessionStore.get(id);

    if (!record) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    if (record.status !== 'connected') {
      return res.status(400).json({
        success: false,
        error: `Session is not connected (status: ${record.status}). Wait for WhatsApp connection to complete.`,
      });
    }

    const sessionData = sessionStore.exportSession(id);
    if (!sessionData) {
      return res.status(404).json({ success: false, error: 'Session data not found' });
    }

    // Return as downloadable JSON
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="caltex-session-${id}.json"`);
    return res.send(sessionData);
  } catch (err: any) {
    log.error({ err: err.message }, 'Session download endpoint error');
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /session/:id/data — Get session data as JSON (for copy/paste)
// ---------------------------------------------------------------------------
router.get('/session/:id/data', (req: Request<{ id: string }>, res: Response) => {
  try {
    const id = req.params.id;
    const record = sessionStore.get(id);

    if (!record) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    if (record.status !== 'connected') {
      return res.status(400).json({
        success: false,
        error: `Session is not connected (status: ${record.status})`,
      });
    }

    const sessionData = sessionStore.exportSession(id);
    if (!sessionData) {
      return res.status(404).json({ success: false, error: 'Session data not found' });
    }

    return res.json({
      success: true,
      data: {
        sessionId: record.id,
        sessionString: sessionData,
        phoneNumber: record.phoneNumber,
        connectedAt: record.connectedAt ? new Date(record.connectedAt).toISOString() : undefined,
      },
    });
  } catch (err: any) {
    log.error({ err: err.message }, 'Session data endpoint error');
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /session/:id — Delete Session
// ---------------------------------------------------------------------------
router.delete('/session/:id', (req: Request<{ id: string }>, res: Response) => {
  try {
    const id = req.params.id;
    const deleted = sessionStore.delete(id);

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    return res.json({ success: true, data: { message: 'Session deleted', sessionId: id } });
  } catch (err: any) {
    log.error({ err: err.message }, 'Session delete endpoint error');
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
