---
Task ID: 1
Agent: Super Z (main)
Task: Production-grade CALTEX Session API optimization — Global WhatsApp singleton, warmup, keep-alive, auto-reconnect

Work Log:
- Read all existing session-api source files (6 files: index.ts, routes.ts, whatsapp-connection.ts, config.ts, session-store.ts, logger.ts)
- Read frontend scan page and Vercel API routes (pairing-code, qr, status, download)
- Created new `whatsapp-manager.ts` — Global WhatsApp singleton with full lifecycle management
  - Singleton pattern: one WASocket for the entire server
  - Auto-initialization on server startup (no lazy init)
  - Auto-reconnect with exponential backoff (2s→4s→8s→...→60s max)
  - Keep-alive system: internal HTTP ping every 4.5 minutes
  - Session data capture: when device links, copy global auth to session directory
  - Auto-reset: after successful link, clear auth and reconnect for next pairing
- Updated `config.ts` — Added keepAliveIntervalMs, warmupTimeoutMs, pairingCodeTimeoutMs, autoWarmupTimeoutMs
- Rewrote `routes.ts` — All endpoints now use whatsappManager singleton
  - GET /warmup — Initialize WhatsApp if not ready
  - GET /status — Detailed connection state
  - POST /pairing-code — Auto-warmup if not ready, then generate code
  - POST /qr-code — Auto-warmup if not ready
  - All existing endpoints preserved with backward compatibility
- Rewrote `index.ts` — WhatsApp initialized on server startup, keep-alive starts immediately
- Updated `package.json` — Version 2.0.0
- Created `src/app/api/scan/warmup/route.ts` — Vercel proxy for /warmup
- Updated `src/app/scan/page.tsx` — Auto-warmup on page load, warmup before pairing code
- Backed up old `whatsapp-connection.ts` → `.bak`
- Pushed to GitHub, triggered Render deployment
- Verified all endpoints work on live Render deployment

Stage Summary:
- Render deployment LIVE: https://caltex-session-api.onrender.com
- WhatsApp singleton initializes in ~2 seconds on server startup
- /warmup returns READY immediately
- /status shows full connection state
- Keep-alive runs every 4.5 minutes to prevent Render sleep
- Auto-reconnect with exponential backoff on disconnect
- All existing API endpoints preserved and working
- Frontend auto-warms WhatsApp on scan page load
