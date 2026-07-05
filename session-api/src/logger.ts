// ============================================================================
// CALTEX Session API - Logger
// Structured JSON logging with pino
// ============================================================================

import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino/file', options: { destination: 1 } }
    : { target: 'pino/file', options: { destination: 1 } },
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export const createLogger = (module: string) => logger.child({ module });
