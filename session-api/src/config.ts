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
};
