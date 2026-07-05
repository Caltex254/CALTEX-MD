// ============================================================================
// CALTEX Session API - Configuration
// ============================================================================

export const config = {
  port: parseInt(process.env.PORT || '3031', 10),
  nodeEnv: process.env.NODE_ENV || 'production',

  // CORS — only allow Vercel domain
  corsOrigins: (process.env.CORS_ORIGINS || 'https://caltex-md.vercel.app').split(','),

  // Session storage
  sessionsDir: process.env.SESSIONS_DIR || './sessions',

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 min
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '30', 10),
  },

  // Session expiry — auto-cleanup sessions older than this (ms)
  sessionExpiryMs: parseInt(process.env.SESSION_EXPIRY_MS || '1800000', 10), // 30 min

  // Cleanup interval (ms)
  cleanupIntervalMs: parseInt(process.env.CLEANUP_INTERVAL_MS || '300000', 10), // 5 min

  // WhatsApp connection
  browserName: process.env.BROWSER_NAME || 'CALTEX MD',

  // API key for securing endpoints (optional, set to enable)
  apiKey: process.env.API_KEY || '',

  // Render health check path
  healthCheckPath: '/health',

  // Keep-alive interval (ms) — must be < 5 min to prevent Render sleep
  keepAliveIntervalMs: parseInt(process.env.KEEP_ALIVE_INTERVAL_MS || '270000', 10), // 4.5 min

  // Warmup timeout (ms) — how long to wait for WhatsApp ready on /warmup
  warmupTimeoutMs: parseInt(process.env.WARMUP_TIMEOUT_MS || '20000', 10), // 20s

  // Pairing code wait timeout (ms) — max time to wait for pairing code generation
  pairingCodeTimeoutMs: parseInt(process.env.PAIRING_CODE_TIMEOUT_MS || '30000', 10), // 30s

  // Auto-warmup on pairing code request (wait up to this many ms for ready)
  autoWarmupTimeoutMs: parseInt(process.env.AUTO_WARMUP_TIMEOUT_MS || '15000', 10), // 15s
};
