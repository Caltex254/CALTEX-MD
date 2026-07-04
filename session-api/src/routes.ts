// ============================================================================
// CALTEX Session API - Express Routes
// All REST API endpoints
// ============================================================================

import { Router, Request, Response } from 'express';
import { sessionStore } from './session-store';
import { createQRSession, createPairingSession, refreshQR } from './whatsapp-connection';
import { createLogger } from './logger';
import { config } from './config';

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

  res.json({
    success: true,
    data: {
      status: 'healthy',
      service: 'CALTEX Session API',
      version: '1.0.0',
      uptime: process.uptime(),
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
// POST /pairing-code — Generate Pairing Code
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

    log.info({ phoneNumber: cleanPhone }, 'Pairing code request');

    // Create session
    const session = sessionStore.create(cleanPhone);

    try {
      // createPairingSession now waits for the socket handshake before
      // calling requestPairingCode(), so this may take up to 25 seconds
      const pairingCode = await createPairingSession(session.id, cleanPhone);

      log.info({
        sessionId: session.id,
        pairingCode,
        phoneNumber: cleanPhone,
      }, '✅ Pairing code endpoint returning code to client');

      return res.json({
        success: true,
        data: {
          sessionId: session.id,
          pairingCode,
          phoneNumber: cleanPhone,
          status: 'waiting_pairing',
          expiresIn: 120, // seconds
        },
      });
    } catch (err: any) {
      sessionStore.delete(session.id);
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
// POST /qr-code — Generate QR Code
// ---------------------------------------------------------------------------
router.post('/qr-code', async (_req: Request, res: Response) => {
  try {
    log.info('QR code request');

    // Create session
    const session = sessionStore.create();

    try {
      await createQRSession(session.id);

      // Wait for QR to be generated (up to 10 seconds)
      let attempts = 0;
      while (attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const record = sessionStore.get(session.id);
        if (record?.qrCode) {
          return res.json({
            success: true,
            data: {
              sessionId: session.id,
              qrCode: record.qrCode,
              status: 'waiting_qr',
              expiresIn: 60, // seconds
            },
          });
        }
        attempts++;
      }

      // QR not generated in time
      return res.status(502).json({
        success: false,
        error: 'QR code generation timed out — WhatsApp servers may be slow. Try again.',
      });
    } catch (err: any) {
      sessionStore.delete(session.id);
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
// ---------------------------------------------------------------------------
router.get('/session/:id', (req: Request<{ id: string }>, res: Response) => {
  try {
    const id = req.params.id;
    const record = sessionStore.get(id);

    if (!record) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    return res.json({
      success: true,
      data: {
        sessionId: record.id,
        status: record.status,
        phoneNumber: record.phoneNumber,
        pairingCode: record.status === 'waiting_pairing' ? record.pairingCode : undefined,
        qrCode: record.status === 'waiting_qr' ? record.qrCode : undefined,
        createdAt: new Date(record.createdAt).toISOString(),
        connectedAt: record.connectedAt ? new Date(record.connectedAt).toISOString() : undefined,
      },
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
        sessionString: sessionData, // The full session JSON string
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
