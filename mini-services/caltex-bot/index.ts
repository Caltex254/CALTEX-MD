// ============================================================================
// CALTEX MD WhatsApp Bot - Main Entry Point
// Starts the HTTP server on port 3031 and initializes the WhatsApp connection
// ============================================================================

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import * as readline from 'readline';
import { SessionManager } from './src/session-manager';
import { ConnectionManager, logger } from './src/connection';
import { AntiFeatures } from './src/anti-features';
import { MediaHandler } from './src/media-handler';
import { AIHandler } from './src/ai-handler';
import { GroupManager } from './src/group-manager';
import { MessageHandler } from './src/message-handler';
import { Scheduler } from './src/scheduler';
import { APIClient } from './src/api-client';

// Read port from env vars for platform compatibility:
// - Render: PORT is set automatically
// - Pterodactyl: SERVER_PORT is set by the panel
// - Local dev: defaults to 3031
const PORT = parseInt(process.env.PORT || process.env.SERVER_PORT || '3031', 10);
// Use BOT_SESSION_ID env var if set (e.g. CALTEX-ECPY-C3DK), else fall back to 'caltex-md'
const DEFAULT_SESSION_ID = process.env.BOT_SESSION_ID || 'caltex-md';

// ---------------------------------------------------------------------------
// Helpers for interactive pairing flow on Pterodactyl
// ---------------------------------------------------------------------------

// Check if local credentials already exist (so we can auto-connect without prompting)
function localCredsExist(sessionId: string): boolean {
  const authFolder = join(process.cwd(), 'auth_info_baileys', sessionId);
  const credsFile = join(authFolder, 'creds.json');
  return existsSync(credsFile);
}

// Prompt the user for input via stdin (used on Pterodactyl when BOT_OWNER env is not set)
function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Normalize a phone number to digits-only format (e.g. "254712345678")
function normalizePhoneNumber(input: string): string | null {
  let phone = input.trim().replace(/[^0-9]/g, '');
  if (!phone) return null;
  // Handle common cases: +254712345678 → 254712345678, 0712345678 → 254712345678 (if starts with 0)
  if (phone.startsWith('00')) phone = phone.slice(2);
  if (phone.startsWith('0')) phone = '254' + phone.slice(1); // Kenya default — adjust if needed
  if (phone.length < 10) return null;
  return phone;
}

// Pretty-print the pairing code so the user can easily read it in the Pterodactyl console
function printPairingCodeBanner(code: string, phoneNumber: string): void {
  // Box is 64 chars wide total: ║ + 62 inner + ║
  const INNER_WIDTH = 62;
  const padLine = (text: string) => {
    // text already includes leading spaces; pad the rest with spaces on the right
    if (text.length >= INNER_WIDTH) return text.slice(0, INNER_WIDTH);
    return text + ' '.repeat(INNER_WIDTH - text.length);
  };
  const banner = [
    '',
    '╔══════════════════════════════════════════════════════════════╗',
    '║                                                              ║',
    '║          CALTEX MD — WHATSAPP PAIRING CODE                   ║',
    '║                                                              ║',
    `║          Phone:  ${phoneNumber.padEnd(INNER_WIDTH - 10 - 8)}║`,
    '║                                                              ║',
    `║          Code:   ${code.padEnd(INNER_WIDTH - 10 - 8)}║`,
    '║                                                              ║',
    '║   1. Open WhatsApp on your phone                             ║',
    '║   2. Go to Settings → Linked Devices                         ║',
    '║   3. Tap "Link a Device"                                     ║',
    '║   4. Tap "Link with phone number instead"                    ║',
    `║   5. Enter the code above: ${code.padEnd(INNER_WIDTH - 28)}║`,
    '║                                                              ║',
    '║   ⏳  Waiting for you to enter the code on your phone...      ║',
    '║   The bot will start automatically once paired.              ║',
    '╚══════════════════════════════════════════════════════════════╝',
    '',
  ].join('\n');
  // eslint-disable-next-line no-console
  console.log(banner);
  logger.info({ code, phoneNumber }, '[PAIRING] Pairing code displayed to user');
}

class CaltexBot {
  private sessionManager: SessionManager;
  private connectionManager: ConnectionManager;
  private antiFeatures: AntiFeatures;
  private mediaHandler: MediaHandler;
  private aiHandler: AIHandler;
  private groupManager: GroupManager;
  private messageHandler: MessageHandler;
  private scheduler: Scheduler;
  private apiClient: APIClient;
  private httpServer: ReturnType<typeof createServer>;
  private lastQR: Map<string, { qr: string; ts: number }> = new Map();
  private startTime: number;
  private totalMessagesProcessed = 0;
  private totalCommandsExecuted = 0;

  constructor() {
    this.startTime = Date.now();

    logger.info('='.repeat(50));
    logger.info('  CALTEX MD WhatsApp Bot - Starting...');
    logger.info('='.repeat(50));

    // Initialize all components
    this.sessionManager = new SessionManager();
    this.connectionManager = new ConnectionManager(this.sessionManager);
    this.antiFeatures = new AntiFeatures();
    this.mediaHandler = new MediaHandler();
    this.aiHandler = new AIHandler();
    this.groupManager = new GroupManager();
    this.scheduler = new Scheduler();
    // Pass API_URL env var (if set) so dashboard reporting works on Pterodactyl.
    // Falls back to http://localhost:3000 (only useful when running alongside the dashboard).
    this.apiClient = new APIClient(process.env.API_URL);

    // Initialize message handler with all dependencies
    this.messageHandler = new MessageHandler(
      this.antiFeatures,
      this.mediaHandler,
      this.aiHandler,
      this.groupManager
    );

    // Setup event handlers
    this.setupEventHandlers();

    // Setup HTTP server for health checks and API
    this.httpServer = this.createHTTPServer();

    // Setup graceful shutdown
    this.setupShutdownHandlers();
  }

  private setupEventHandlers(): void {
    // Connection events
    this.connectionManager.on('connection.open', (sessionId: string) => {
      logger.info({ sessionId }, 'WhatsApp connection opened');
      this.sessionManager.updateSessionStatus(sessionId, 'active');
      this.apiClient.reportConnectionStatus(sessionId, 'connected');
      this.apiClient.sendLog('info', 'connection', 'WhatsApp connection opened', { sessionId });
    });

    this.connectionManager.on('connection.close', (statusCode: number, reason: string, sessionId: string) => {
      logger.warn({ sessionId, statusCode, reason }, 'WhatsApp connection closed');
      this.sessionManager.updateSessionStatus(sessionId, 'disconnected');
      this.apiClient.reportConnectionStatus(sessionId, 'disconnected', { statusCode, reason });
      this.apiClient.sendLog('warn', 'connection', 'WhatsApp connection closed', { sessionId, statusCode, reason });
      // Notify owner about disconnection
      this.apiClient.notifyOwner('disconnect', 'Bot Disconnected', `Session ${sessionId} disconnected: ${reason} (code: ${statusCode})`, 'error');
    });

    this.connectionManager.on('qr.code', (qr: string, sessionId: string) => {
      logger.info({ sessionId }, 'QR code generated - scan with WhatsApp');
      this.lastQR.set(sessionId, { qr, ts: Date.now() });
      this.apiClient.reportQRCode(sessionId, qr);
    });

    this.connectionManager.on('pairing.code', (code: string, sessionId: string, phoneNumber: string) => {
      logger.info({ sessionId, phoneNumber, code }, 'Pairing code generated');
      this.apiClient.sendLog('info', 'pairing', `Pairing code generated for ${phoneNumber}: ${code}`, { sessionId, phoneNumber });
    });

    // Message events
    this.connectionManager.on('messages.upsert', async (data: any, sessionId: string) => {
      try {
        await this.messageHandler.handleMessage(
          this.connectionManager.getSocket(sessionId)!,
          data,
          sessionId
        );
        this.totalMessagesProcessed++;

        if (this.totalMessagesProcessed % 100 === 0) {
          this.apiClient.updateStats({
            totalMessages: this.totalMessagesProcessed,
          });
        }
      } catch (err) {
        logger.error({ err, sessionId }, 'Error handling messages.upsert');
        this.apiClient.sendLog('error', 'message-handler', 'Error processing messages', { error: String(err) });
        this.apiClient.notifyOwner('plugin_crash', 'Message Handler Error', `Error in message processing: ${String(err)}`, 'error');
      }
    });

    this.connectionManager.on('messages.delete', async (data: any, sessionId: string) => {
      try {
        if (this.antiFeatures.getConfig().antiDelete.enabled) {
          const sock = this.connectionManager.getSocket(sessionId);
          if (sock && data.keys) {
            for (const key of data.keys) {
              await this.antiFeatures.handleAntiDelete(sock, key.id, key.remoteJid);
            }
          }
        }
      } catch (err) {
        logger.error({ err }, 'Error handling messages.delete');
      }
    });

    // Group participant events
    this.connectionManager.on('group.participants.update', async (data: any, sessionId: string) => {
      try {
        const sock = this.connectionManager.getSocket(sessionId);
        if (sock) {
          await this.messageHandler.handleGroupParticipantsUpdate(sock, data, sessionId);
        }
      } catch (err) {
        logger.error({ err }, 'Error handling group.participants.update');
      }
    });

    // Call events
    this.connectionManager.on('call', async (data: any, sessionId: string) => {
      try {
        const sock = this.connectionManager.getSocket(sessionId);
        if (sock) {
          await this.messageHandler.handleCall(sock, data, sessionId);
        }
      } catch (err) {
        logger.error({ err }, 'Error handling call event');
      }
    });

    // Connection update events
    this.connectionManager.on('connection.update', (update: any, sessionId: string) => {
      if (update.connection === 'connecting') {
        this.apiClient.reportConnectionStatus(sessionId, 'connecting');
      }
    });

    // Message handler events
    this.messageHandler.on('command:executed', (data: any) => {
      this.totalCommandsExecuted++;
      this.apiClient.reportCommand(data.command, data.sender, data.jid, data.success);
    });

    this.messageHandler.on('message:processed', (data: any) => {
      this.emit('stats:update', data);
    });

    // Scheduler events
    this.scheduler.on('message:sent', (msg: any) => {
      this.apiClient.sendLog('info', 'scheduler', 'Scheduled message sent', { messageId: msg.id, jid: msg.jid });
    });

    this.scheduler.on('message:failed', (msg: any) => {
      this.apiClient.sendLog('error', 'scheduler', 'Scheduled message failed', { messageId: msg.id, error: msg.error });
    });
  }

  private createHTTPServer(): ReturnType<typeof createServer> {
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const url = req.url ?? '/';
      const method = req.method ?? 'GET';

      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      try {
        // Parse request body for POST/PUT
        let body: any = null;
        if (method === 'POST' || method === 'PUT') {
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(Buffer.from(chunk));
          }
          const rawBody = Buffer.concat(chunks).toString();
          if (rawBody) {
            try {
              body = JSON.parse(rawBody);
            } catch {
              body = rawBody;
            }
          }
        }

        // --- Route Handling ---

        // Health check
        if (url === '/health' && method === 'GET') {
          const uptime = Date.now() - this.startTime;
          const connections = this.connectionManager.listConnections();
          const connectedSessions = connections.filter((id) => this.connectionManager.isConnected(id));
          const schedulerStats = this.scheduler.getStats();

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'ok',
            service: 'caltex-bot',
            version: '1.0.0',
            uptime,
            uptimeFormatted: this.formatUptime(uptime),
            connections: {
              total: connections.length,
              connected: connectedSessions.length,
              sessions: connections,
            },
            messages: {
              processed: this.totalMessagesProcessed,
              commandsExecuted: this.totalCommandsExecuted,
            },
            scheduler: schedulerStats,
            antiFeatures: {
              deletedMessages: this.antiFeatures.getDeletedMessageCount(),
              viewOnceMessages: this.antiFeatures.getViewOnceMessageCount(),
            },
            ai: {
              activeConversations: this.aiHandler.listActiveConversations().length,
            },
            timestamp: Date.now(),
          }));
          return;
        }

        // Status
        if (url === '/api/status' && method === 'GET') {
          const sessions = this.sessionManager.getAllSessionInfo();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ sessions, timestamp: Date.now() }));
          return;
        }

        // QR status
        if (url === '/api/qr' && method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            message: 'QR code is displayed in the console. Check bot logs.',
            hint: 'Scan with WhatsApp > Linked Devices > Link a device',
            endpoints: {
              qrImage: '/api/qr-image',
              qrData: '/api/qr-data',
            },
          }));
          return;
        }

        // Debug endpoint: shows env vars, auth folder contents, and GitHub fetch status
        if (url === '/api/debug-session' && method === 'GET') {
          const sessionId = process.env.BOT_SESSION_ID || 'caltex-md';
          const authFolder = join(process.cwd(), 'auth_info_baileys', sessionId);
          const debug: any = {
            timestamp: Date.now(),
            env: {
              BOT_SESSION_ID: process.env.BOT_SESSION_ID || '(not set)',
              GITHUB_TOKEN: process.env.GITHUB_TOKEN ? '***set***' : '(not set)',
              GITHUB_REPO_OWNER: process.env.GITHUB_REPO_OWNER || '(not set)',
              GITHUB_REPO_NAME: process.env.GITHUB_REPO_NAME || '(not set)',
              NODE_ENV: process.env.NODE_ENV,
            },
            session: {
              expectedSessionId: sessionId,
              authFolder,
              authFolderExists: existsSync(authFolder),
              filesInAuthFolder: [] as string[],
              hasCredsJson: false,
            },
            lastQR: {
              size: this.lastQR.size,
              sessions: Array.from(this.lastQR.keys()),
            },
          };
          try {
            if (existsSync(authFolder)) {
              debug.session.filesInAuthFolder = readdirSync(authFolder);
              debug.session.hasCredsJson = existsSync(join(authFolder, 'creds.json'));
            }
          } catch (e: any) {
            debug.session.error = e.message;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(debug, null, 2));
          return;
        }

        // Test endpoint: runs each connection step with explicit logging
        if (url === '/api/test-connect' && method === 'GET') {
          const sessionId = process.env.BOT_SESSION_ID || 'caltex-md';
          const steps: any[] = [];
          const log = (step: string, status: string, data?: any) => {
            const entry = { step, status, timestamp: Date.now(), ...(data ? { data } : {}) };
            steps.push(entry);
            logger.info(entry, '[TEST-CONNECT]');
          };

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Test started. Check logs for [TEST-CONNECT] entries.', sessionId }));

          // Run steps asynchronously
          (async () => {
            try {
              log('1-env-check', 'start');
              log('1-env-check', 'done', {
                BOT_SESSION_ID: process.env.BOT_SESSION_ID || '(not set)',
                GITHUB_TOKEN: process.env.GITHUB_TOKEN ? 'set' : 'not set',
                GITHUB_REPO_OWNER: process.env.GITHUB_REPO_OWNER,
                GITHUB_REPO_NAME: process.env.GITHUB_REPO_NAME,
              });

              log('2-session-manager-create', 'start');
              await this.sessionManager.createSession(sessionId);
              log('2-session-manager-create', 'done');

              log('3-connection-create', 'start');
              const sock = await this.connectionManager.createConnection({
                sessionId,
                printQR: false,
                browser: 'CALTEX MD',
                autoReconnect: true,
                maxReconnectAttempts: 3,
                reconnectBaseDelay: 2000,
              });
              log('3-connection-create', 'done', { hasSocket: !!sock });

              log('4-wait-connection-open', 'start', { note: 'waiting up to 30s for connection.open' });
              // The connection.update handler in connection.ts will log when connection opens
              // We just wait and let it happen
              await new Promise(resolve => setTimeout(resolve, 30000));
              const isConnected = this.connectionManager.isConnected(sessionId);
              log('4-wait-connection-open', 'done', { connected: isConnected });
            } catch (err: any) {
              log('error', 'failed', { message: err?.message ?? String(err), stack: err?.stack });
            }
          })();
          return;
        }

        // Return the latest WhatsApp QR code as a PNG image
        if (url === '/api/qr-image' && method === 'GET') {
          const sessionId = new URL(url, 'http://localhost').searchParams.get('sessionId') ?? DEFAULT_SESSION_ID;
          const entry = this.lastQR.get(sessionId);
          if (!entry) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: false,
              error: 'No QR code available yet. QR is generated ~5s after connect.',
              hint: 'POST /api/connect to trigger a new QR code, then retry this endpoint.',
              sessionId,
            }));
            return;
          }
          // entry.qr is the raw QR string from Baileys; render to PNG via qrcode-terminal? No —
          // we need the data URL. Use the 'qrcode' npm package instead (already a dep via qrcode-terminal).
          // Fallback: build a tiny HTML page that uses an inline QR library.
          const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>CALTEX MD - WhatsApp QR</title>
<script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
<style>
  body { margin:0; background:#0b0f17; color:#e6e6e6; font-family:-apple-system,system-ui,sans-serif; display:flex; flex-direction:column; align-items:center; padding:24px; }
  h1 { font-size:18px; margin:0 0 4px; }
  .meta { color:#8b95a7; font-size:12px; margin-bottom:16px; }
  #qr { background:#fff; padding:16px; border-radius:12px; }
  .hint { margin-top:16px; font-size:13px; line-height:1.6; max-width:480px; text-align:center; }
  code { background:#1a1f2e; padding:2px 6px; border-radius:4px; }
</style></head>
<body>
  <h1>CALTEX MD — WhatsApp QR</h1>
  <div class="meta">sessionId: ${sessionId} • generated: ${new Date(entry.ts).toISOString()}</div>
  <canvas id="qr"></canvas>
  <div class="hint">
    Open WhatsApp on your phone → <b>Settings → Linked Devices → Link a Device</b><br>
    Point your camera at the QR code on the left.<br><br>
    <button onclick="location.reload()" style="padding:8px 16px;background:#22c55e;color:#fff;border:0;border-radius:6px;cursor:pointer;font-weight:600;">Refresh QR</button>
  </div>
  <script>
    QRCode.toCanvas(document.getElementById('qr'), ${JSON.stringify(entry.qr)}, { width: 256, margin: 1 }, function (err) {
      if (err) document.body.innerHTML = '<pre style="color:#f87171">QR render error: ' + err.message + '</pre>';
    });
  </script>
</body></html>`;
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(html);
          return;
        }

        // Return the latest WhatsApp QR code as JSON (raw QR string)
        if (url === '/api/qr-data' && method === 'GET') {
          const sessionId = new URL(url, 'http://localhost').searchParams.get('sessionId') ?? DEFAULT_SESSION_ID;
          const entry = this.lastQR.get(sessionId);
          if (!entry) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: false,
              error: 'No QR code available yet. Try POST /api/connect first, wait 5s, retry.',
              sessionId,
            }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            data: { qr: entry.qr, sessionId, generatedAt: entry.ts, ageMs: Date.now() - entry.ts },
          }));
          return;
        }

        // Pairing code - request a pairing code for phone number linking
        if (url === '/api/pairing-code' && method === 'POST') {
          const phoneNumber = body?.phoneNumber;
          const sessionId = body?.sessionId ?? DEFAULT_SESSION_ID;
          if (!phoneNumber) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'phoneNumber is required' }));
            return;
          }
          try {
            const pairingCode = await this.connectionManager.requestPairingCode(sessionId, phoneNumber);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true,
              data: { pairingCode, phoneNumber, sessionId },
              instructions: [
                '1. Open WhatsApp on your phone',
                '2. Go to Settings > Linked Devices',
                '3. Tap "Link a Device"',
                '4. Enter the pairing code shown above',
              ],
            }));
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
          return;
        }

        // Connect with pairing code
        if (url === '/api/connect-pairing' && method === 'POST') {
          const phoneNumber = body?.phoneNumber;
          const sessionId = body?.sessionId ?? DEFAULT_SESSION_ID;
          if (!phoneNumber) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'phoneNumber is required' }));
            return;
          }
          try {
            const result = await this.connectionManager.createConnectionWithPairingCode(
              { sessionId, printQR: false },
              phoneNumber
            );
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true,
              data: { pairingCode: result.pairingCode, phoneNumber, sessionId },
              instructions: [
                '1. Open WhatsApp on your phone',
                '2. Go to Settings > Linked Devices',
                '3. Tap "Link a Device"',
                '4. Enter the pairing code: ' + result.pairingCode,
              ],
            }));
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
          return;
        }

        // Connect session
        if (url === '/api/connect' && method === 'POST') {
          const sessionId = body?.sessionId ?? DEFAULT_SESSION_ID;
          await this.connect(sessionId);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: `Connecting session: ${sessionId}` }));
          return;
        }

        // Disconnect session
        if (url === '/api/disconnect' && method === 'POST') {
          const sessionId = body?.sessionId ?? DEFAULT_SESSION_ID;
          await this.connectionManager.disconnect(sessionId);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: `Disconnected session: ${sessionId}` }));
          return;
        }

        // List sessions
        if (url === '/api/sessions' && method === 'GET') {
          const sessions = this.sessionManager.listSessions();
          const sessionDetails = sessions.map((id) => ({
            id,
            info: this.sessionManager.getSessionStatus(id),
            connected: this.connectionManager.isConnected(id),
            reconnectAttempts: this.connectionManager.getReconnectAttempts(id),
          }));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ sessions: sessionDetails }));
          return;
        }

        // Create session
        if (url === '/api/sessions/create' && method === 'POST') {
          const sessionId = body?.sessionId;
          if (!sessionId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'sessionId is required' }));
            return;
          }
          const info = await this.sessionManager.createSession(sessionId);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, session: info }));
          return;
        }

        // Delete session
        if (url === '/api/sessions/delete' && method === 'POST') {
          const sessionId = body?.sessionId;
          if (!sessionId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'sessionId is required' }));
            return;
          }
          await this.connectionManager.disconnect(sessionId);
          const deleted = await this.sessionManager.deleteSession(sessionId);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: deleted }));
          return;
        }

        // Export session
        if (url === '/api/sessions/export' && method === 'POST') {
          const sessionId = body?.sessionId;
          if (!sessionId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'sessionId is required' }));
            return;
          }
          const data = await this.sessionManager.exportSession(sessionId);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: !!data, data }));
          return;
        }

        // Import session
        if (url === '/api/sessions/import' && method === 'POST') {
          const { sessionId, data } = body ?? {};
          if (!sessionId || !data) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'sessionId and data are required' }));
            return;
          }
          const success = await this.sessionManager.importSession(sessionId, data);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success }));
          return;
        }

        // Backup all sessions
        if (url === '/api/backup' && method === 'POST') {
          const backups = await this.sessionManager.backupAllSessions();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, backups: backups.length }));
          return;
        }

        // List commands
        if (url === '/api/commands' && method === 'GET') {
          const commands = this.messageHandler.listCommands();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ commands }));
          return;
        }

        // Bot config
        if (url === '/api/config/bot' && method === 'GET') {
          const config = this.messageHandler.getConfig();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ config }));
          return;
        }

        if (url === '/api/config/bot' && method === 'PUT') {
          if (!body) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Request body is required' }));
            return;
          }
          this.messageHandler.updateConfig(body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
          return;
        }

        // Anti-feature config
        if (url === '/api/config/anti' && method === 'GET') {
          const config = this.antiFeatures.getConfig();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ config }));
          return;
        }

        if (url === '/api/config/anti' && method === 'PUT') {
          if (!body) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Request body is required' }));
            return;
          }
          this.antiFeatures.updateConfig(body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
          return;
        }

        // AI config
        if (url === '/api/config/ai' && method === 'GET') {
          const config = this.aiHandler.getConfig();
          const masked = { ...config } as any;
          if (masked.openai?.apiKey) masked.openai.apiKey = masked.openai.apiKey.slice(0, 8) + '...';
          if (masked.gemini?.apiKey) masked.gemini.apiKey = masked.gemini.apiKey.slice(0, 8) + '...';
          if (masked.claude?.apiKey) masked.claude.apiKey = masked.claude.apiKey.slice(0, 8) + '...';
          if (masked.custom?.apiKey) masked.custom.apiKey = masked.custom.apiKey.slice(0, 8) + '...';
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ config: masked }));
          return;
        }

        if (url === '/api/config/ai' && method === 'PUT') {
          if (!body) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Request body is required' }));
            return;
          }
          this.aiHandler.updateConfig(body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
          return;
        }

        // Scheduled messages
        if (url === '/api/scheduler/messages' && method === 'GET') {
          const sessionId = new URL(url, 'http://localhost').searchParams.get('sessionId');
          const messages = this.scheduler.listPendingMessages(sessionId ?? undefined);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ messages }));
          return;
        }

        if (url === '/api/scheduler/schedule' && method === 'POST') {
          const { sessionId, jid, content, sendAt, recurring, type, broadcastJids } = body ?? {};
          if (!sessionId || !jid || !content || !sendAt) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'sessionId, jid, content, and sendAt are required' }));
            return;
          }
          const msg = this.scheduler.scheduleMessage(sessionId, jid, content, sendAt, { recurring, type, broadcastJids });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: msg }));
          return;
        }

        if (url === '/api/scheduler/cancel' && method === 'POST') {
          const { messageId } = body ?? {};
          if (!messageId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'messageId is required' }));
            return;
          }
          const cancelled = this.scheduler.cancelScheduledMessage(messageId);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: cancelled }));
          return;
        }

        // Send message
        if (url === '/api/send' && method === 'POST') {
          const { sessionId, jid, content } = body ?? {};
          if (!sessionId || !jid || !content) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'sessionId, jid, and content are required' }));
            return;
          }
          try {
            // Baileys expects an object like { text: "..." }, not a raw string.
            // If content is a string, wrap it. If it's already an object, pass through.
            const messagePayload = typeof content === 'string' ? { text: content } : content;
            const result = await this.connectionManager.sendMessage(sessionId, jid, messagePayload);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, result }));
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: String(err) }));
          }
          return;
        }

        // 404
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found', path: url }));
      } catch (err) {
        logger.error({ err, url, method }, 'HTTP request handler error');
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    });

    return server;
  }

  private async connect(sessionId: string): Promise<void> {
    try {
      await this.sessionManager.createSession(sessionId);

      const sock = await this.connectionManager.createConnection({
        sessionId,
        printQR: true,
        browser: 'CALTEX MD',
        autoReconnect: true,
        maxReconnectAttempts: 10,
        reconnectBaseDelay: 2000,
      });

      this.scheduler.registerSocket(sessionId, sock);

      logger.info({ sessionId }, 'Bot session connecting...');
    } catch (err) {
      logger.error({ err, sessionId }, 'Failed to create connection');
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Connect using phone number + pairing code (the new interactive flow)
  // ---------------------------------------------------------------------------
  // This is the new primary connection path on Pterodactyl:
  //   1. User provides a phone number (either via BOT_OWNER env var or stdin prompt)
  //   2. Bot opens a Baileys socket and waits for the QR event
  //   3. Once QR fires, bot requests a pairing code from Baileys
  //   4. Bot prints the code prominently in the console
  //   5. User enters the code in WhatsApp → connection.open fires → bot replies to commands
  //   6. Credentials are saved locally so subsequent restarts auto-connect
  private async connectWithPairingCode(sessionId: string, phoneNumber: string): Promise<void> {
    try {
      await this.sessionManager.createSession(sessionId);

      logger.info({ sessionId, phoneNumber }, '[PAIRING] Starting interactive pairing code flow...');

      const { sock, pairingCode } = await this.connectionManager.createConnectionWithPairingCode(
        {
          sessionId,
          printQR: false, // suppress QR — we use pairing code instead
          browser: 'CALTEX MD',
          autoReconnect: true,
          maxReconnectAttempts: 10,
          reconnectBaseDelay: 2000,
        },
        phoneNumber
      );

      this.scheduler.registerSocket(sessionId, sock);

      if (pairingCode) {
        printPairingCodeBanner(pairingCode, phoneNumber);
      } else {
        logger.warn('[PAIRING] No pairing code was returned — check logs above for errors.');
        // eslint-disable-next-line no-console
        console.log('\n  ⚠️  Pairing code could not be generated. Check the bot logs above.\n');
      }
    } catch (err: any) {
      logger.error({ err: err?.message ?? String(err), sessionId, phoneNumber }, '[PAIRING] Failed to start pairing code flow');
      throw err;
    }
  }

  private setupShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Shutdown signal received, cleaning up...');

      try {
        await this.connectionManager.disconnectAll();
        this.scheduler.destroy();
        this.apiClient.destroy();
        this.aiHandler.destroy();

        this.httpServer.close(() => {
          logger.info('HTTP server closed');
          process.exit(0);
        });

        setTimeout(() => {
          logger.warn('Forced shutdown after timeout');
          process.exit(1);
        }, 10000);
      } catch (err) {
        logger.error({ err }, 'Error during shutdown');
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGQUIT', () => shutdown('SIGQUIT'));
  }

  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  async start(): Promise<void> {
    // ── STARTUP VALIDATION ──
    logger.info('='.repeat(50));
    logger.info('  CALTEX MD WhatsApp Bot - Starting...');
    logger.info('='.repeat(50));

    // ── Mode detection ──
    // The bot supports THREE modes now:
    //   A) AUTO-CONNECT MODE (default for repeat starts on Pterodactyl):
    //      Local creds already exist at auth_info_baileys/<sessionId>/creds.json.
    //      The bot just connects — no pairing code needed.
    //   B) GITHUB RESTORE MODE (legacy, still supported):
    //      BOT_SESSION_ID is set to a CALTEX-XXXX-XXXX value AND GitHub env vars are set.
    //      The bot downloads creds from GitHub, then connects.
    //   C) INTERACTIVE PAIRING MODE (new!):
    //      No local creds, no valid CALTEX session ID. The bot prompts the user for a
    //      phone number (or uses BOT_OWNER env var) and generates a pairing code
    //      directly on Pterodactyl — no Render or Vercel dashboard needed.

    const sessionId = process.env.BOT_SESSION_ID || 'caltex-md';
    const isCaltexId = /^CALTEX-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(sessionId);
    const hasLocalCreds = localCredsExist(sessionId);
    const hasGithubEnv = !!(process.env.GITHUB_TOKEN && process.env.GITHUB_REPO_OWNER && process.env.GITHUB_REPO_NAME);
    const botOwnerEnv = process.env.BOT_OWNER || '';

    logger.info({
      sessionId,
      isCaltexId,
      hasLocalCreds,
      hasGithubEnv,
      hasBotOwner: !!botOwnerEnv,
      api_url: process.env.API_URL || '(not set)',
      nodeVersion: process.version,
    }, '[STARTUP] Mode detection');

    // Mode A: Local credentials exist — auto-connect directly.
    // Mode B: Valid CALTEX ID + GitHub env — attempt restore from GitHub.
    // In both cases, just call this.connect(sessionId) which goes through createConnection().
    const canAutoConnect = hasLocalCreds || (isCaltexId && hasGithubEnv);

    // Start HTTP server FIRST (so Pterodactyl detects startup via "HTTP server listening on port")
    await new Promise<void>((resolve) => {
      this.httpServer.listen(PORT, () => {
        // Use both logger (→ bot.log) AND console.log (→ stdout) so Pterodactyl's
        // startup detection ("done": "HTTP server listening on port") fires correctly.
        // Pino's file transport doesn't write to stdout, so console.log is required.
        const msg = `HTTP server listening on port ${PORT}`;
        logger.info(msg);
        // eslint-disable-next-line no-console
        console.log(`[${new Date().toISOString()}] INFO (main): ${msg}`);
        // eslint-disable-next-line no-console
        console.log(`[Health check]: http://localhost:${PORT}/health`);
        resolve();
      });
    });

    logger.info('CALTEX MD Bot HTTP server started!');
    logger.info(`API available at http://localhost:${PORT}`);
    logger.info(`Commands: http://localhost:${PORT}/api/commands`);

    // Report status
    this.apiClient.reportStatus('starting');

    // ── Decide what to do next ──
    const safeConnect = async () => {
      try {
        if (canAutoConnect) {
          // Mode A or B: existing creds (local or from GitHub) — connect directly
          logger.info({ sessionId, mode: hasLocalCreds ? 'A (local creds)' : 'B (GitHub restore)' }, '[STARTUP] Auto-connecting with existing credentials...');
          await this.connect(sessionId);
          logger.info('CALTEX MD Bot WhatsApp connection initiated!');
          this.apiClient.reportStatus('running');
        } else {
          // Mode C: Interactive pairing — get phone number and generate pairing code
          logger.info('[STARTUP] No existing credentials found — entering interactive pairing mode.');
          // eslint-disable-next-line no-console
          console.log('\n  ╔══════════════════════════════════════════════════════════════╗');
          console.log('  ║              CALTEX MD — First-time Setup                    ║');
          console.log('  ╚══════════════════════════════════════════════════════════════╝');
          console.log('  No existing WhatsApp session found. We will generate a pairing');
          console.log('  code that you can enter on your phone to link it to this bot.\n');

          let phoneNumber: string | null = null;
          if (botOwnerEnv) {
            logger.info({ botOwnerEnv }, '[STARTUP] BOT_OWNER env var detected — using it as phone number for pairing');
            phoneNumber = normalizePhoneNumber(botOwnerEnv);
            if (phoneNumber) {
              // eslint-disable-next-line no-console
              console.log(`  Using phone number from BOT_OWNER env var: ${phoneNumber}\n`);
            } else {
              logger.warn({ botOwnerEnv }, '[STARTUP] BOT_OWNER env var is set but could not be normalized — prompting user');
            }
          }
          if (!phoneNumber) {
            // Prompt the user for a phone number via stdin
            // (Works on Pterodactyl — the panel pipes stdin from the web console)
            const answer = await promptUser('  Enter your WhatsApp phone number (international format, e.g. 254712345678): ');
            phoneNumber = normalizePhoneNumber(answer);
            if (!phoneNumber) {
              logger.error({ raw: answer }, '[STARTUP] Invalid phone number entered');
              // eslint-disable-next-line no-console
              console.log('\n  ❌ Invalid phone number. Please restart the bot and try again.\n');
              process.exit(1);
            }
          }

          await this.connectWithPairingCode(sessionId, phoneNumber);
          this.apiClient.reportStatus('running');
        }
      } catch (err: any) {
        logger.error({ err: err?.message ?? String(err) }, '[STARTUP] WhatsApp connection failed — HTTP API still available');
        logger.info('You can retry connecting via: POST http://localhost:' + PORT + '/api/connect');
        this.apiClient.reportStatus('running');
      }
    };

    setTimeout(safeConnect, 3000);
  }
}

// Start the bot
const bot = new CaltexBot();
bot.start().catch((err) => {
  logger.fatal({ err }, 'Failed to start CALTEX MD Bot');
  process.exit(1);
});

// Global error handlers
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception');
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled rejection');
});

export default bot;
