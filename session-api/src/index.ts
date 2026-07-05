// ============================================================================
// CALTEX Session API - Main Entry Point (v2.0 — Production-Grade)
//
// OPTIMIZATIONS:
// 1. WhatsApp singleton initialized on server startup (no lazy init)
// 2. Keep-alive system prevents Render cold starts
// 3. Auto-reconnect with exponential backoff
// 4. Warmup endpoint for pre-connection
// 5. Fast start — ready within seconds of deployment
// ============================================================================

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { router } from './routes';
import { createLogger } from './logger';
import { whatsappManager } from './whatsapp-manager';
import { sessionStore } from './session-store';

const log = createLogger('server');

const app = express();

// ---------------------------------------------------------------------------
// Security Middleware
// ---------------------------------------------------------------------------
app.use(helmet());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl)
    if (!origin) return callback(null, true);

    if (config.corsOrigins.includes(origin) || config.corsOrigins.includes('*')) {
      callback(null, true);
    } else {
      log.warn({ origin, allowed: config.corsOrigins }, 'CORS blocked');
      callback(null, false);
    }
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    error: 'Too many requests — please wait a moment and try again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
  },
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '1mb' }));

// Request logging
app.use((req, _res, next) => {
  log.info({ method: req.method, path: req.path, ip: req.ip }, 'Request');
  next();
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use('/', router);

// Root endpoint
app.get('/', (_req, res) => {
  const waState = whatsappManager.getState();
  res.json({
    success: true,
    data: {
      service: 'CALTEX Session API',
      version: '2.0.0',
      description: 'Production-grade WhatsApp session generation service for CALTEX MD',
      whatsapp: {
        ready: waState.isReady,
        status: waState.sessionStatus,
        version: waState.baileysVersion,
      },
      endpoints: {
        health: 'GET /health',
        warmup: 'GET /warmup',
        status: 'GET /status',
        pairingCode: 'POST /pairing-code',
        qrCode: 'POST /qr-code',
        sessionStatus: 'GET /session/:id',
        validateSession: 'POST /session/:id/validate',
        downloadSession: 'GET /session/:id/download',
        sessionData: 'GET /session/:id/data',
        deleteSession: 'DELETE /session/:id',
      },
      docs: 'https://github.com/Caltex254/CALTEX-MD',
    },
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  log.error({ err: err.message, stack: err.stack }, 'Unhandled error');
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ---------------------------------------------------------------------------
// Start Server + Initialize WhatsApp IMMEDIATELY
// ---------------------------------------------------------------------------
const server = app.listen(config.port, () => {
  log.info({
    port: config.port,
    env: config.nodeEnv,
    corsOrigins: config.corsOrigins,
    sessionExpiryMinutes: config.sessionExpiryMs / 60000,
  }, '🚀 CALTEX Session API v2.0 started');

  // ============================================================
  // CRITICAL: Initialize WhatsApp connection ON SERVER START
  // This ensures the socket is ready BEFORE any user request
  // ============================================================
  log.info('⚡ Initializing WhatsApp connection on startup...');
  whatsappManager.initialize().then(() => {
    log.info('WhatsApp initialization initiated — connection in progress');
  }).catch((err) => {
    log.error({ err }, 'WhatsApp initialization failed on startup — will auto-reconnect');
  });

  // ============================================================
  // Start keep-alive system to prevent Render from sleeping
  // ============================================================
  whatsappManager.startKeepAlive();
  log.info({ intervalMs: config.keepAliveIntervalMs }, 'Keep-alive system started');
});

// ---------------------------------------------------------------------------
// Graceful Shutdown
// ---------------------------------------------------------------------------
function shutdown(signal: string) {
  log.info({ signal }, 'Shutting down...');

  whatsappManager.shutdown().then(() => {
    sessionStore.stopCleanup();
    server.close(() => {
      log.info('Server closed');
      process.exit(0);
    });
  });

  // Force exit after 10s
  setTimeout(() => {
    log.warn('Forcing exit after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export { app, server };
