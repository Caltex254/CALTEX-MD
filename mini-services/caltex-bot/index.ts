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

// Normalize a phone number to digits-only international format (e.g. "254712345678").
// Rules:
//   - Strip everything except digits.
//   - If it starts with "00", drop the "00" (international prefix).
//   - If it starts with "+", the "+" was already stripped by the digit filter.
//   - If it starts with "0" (local format), assume the bot owner's country
//     is Kenya (254) — this matches the CALTEX MD deployment context. Users
//     in other countries should type the full international format.
//   - Validate: must be 7-15 digits after normalization (ITU-T E.164).
function normalizePhoneNumber(input: string): string | null {
  let phone = input.trim().replace(/[^0-9]/g, '');
  if (!phone) return null;
  if (phone.startsWith('00')) phone = phone.slice(2);
  if (phone.startsWith('0')) phone = '254' + phone.slice(1); // Kenya default
  // ITU-T E.164: valid phone numbers are 7-15 digits (after country code).
  if (phone.length < 7 || phone.length > 15) return null;
  return phone;
}

// Pretty-print the pairing code so the user can easily read it in the Pterodactyl console.
// v1.6.0: Minimal output per spec — just the code and where to enter it.
function printPairingCodeBanner(code: string, _phoneNumber: string): void {
  // Format the code with a dash in the middle if it's 8 chars (e.g. CKAMG484 -> CKAM-G484).
  // Baileys returns the code without a dash, but WhatsApp accepts both formats.
  let displayCode = code;
  if (code.length === 8 && !code.includes('-')) {
    displayCode = code.slice(0, 4) + '-' + code.slice(4);
  }
  // eslint-disable-next-line no-console
  console.log('');
  // eslint-disable-next-line no-console
  console.log('=== PAIRING CODE ===');
  // eslint-disable-next-line no-console
  console.log(`Code: ${displayCode}`);
  // eslint-disable-next-line no-console
  console.log('Go to WhatsApp > Settings > Linked Devices > Link with phone number');
  // eslint-disable-next-line no-console
  console.log('Enter the code above.');
  // eslint-disable-next-line no-console
  console.log('====================');
  // eslint-disable-next-line no-console
  console.log('');
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

    // v1.6.0: Silent constructor — no startup banner here. The banner is
    // printed in start() after the HTTP server is listening.

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
      // eslint-disable-next-line no-console
      console.log('Connected.');
      this.sessionManager.updateSessionStatus(sessionId, 'active');
      this.apiClient.reportConnectionStatus(sessionId, 'connected');
    });

    this.connectionManager.on('connection.close', (statusCode: number, reason: string, sessionId: string) => {
      // eslint-disable-next-line no-console
      console.log(`Disconnected. (code ${statusCode}: ${reason})`);
      this.sessionManager.updateSessionStatus(sessionId, 'disconnected');
      this.apiClient.reportConnectionStatus(sessionId, 'disconnected', { statusCode, reason });
    });

    this.connectionManager.on('qr.code', (qr: string, sessionId: string) => {
      this.lastQR.set(sessionId, { qr, ts: Date.now() });
      this.apiClient.reportQRCode(sessionId, qr);
    });

    this.connectionManager.on('pairing.code', (code: string, sessionId: string, phoneNumber: string) => {
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

    this.messageHandler.on('message:processed', (_data: any) => {
      // Intentionally a no-op — kept as an extension point for future features.
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
            if (result.pairingFailed || !result.pairingCode) {
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                success: false,
                error: 'WhatsApp rejected the pairing request before the code could be sent. Wait 60s and retry with a valid phone number that has an active WhatsApp account.',
                pairingFailed: true,
              }));
              return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true,
              data: { pairingCode: result.pairingCode, phoneNumber, sessionId },
              instructions: [
                '1. Open WhatsApp on your phone',
                '2. Go to Settings > Linked Devices',
                '3. Tap "Link a Device"',
                '4. Tap "Link with phone number instead"',
                '5. Enter the pairing code: ' + result.pairingCode,
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
    } catch (err) {
      logger.error({ err, sessionId }, 'Failed to create connection');
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Connect using phone number + pairing code (the canonical Pterodactyl flow)
  // ---------------------------------------------------------------------------
  // v1.6.0: Clean pairing flow per user spec.
  //   1. Call createConnectionWithPairingCode (which waits for QR event, then
  //      waits 3s, then calls requestPairingCode)
  //   2. If a pairing code is returned, print the clean banner and return.
  //      The connection.update handler will print "Connected." when WhatsApp
  //      confirms the link.
  //   3. If pairing fails (pairingFailed=true OR thrown error), print
  //      "Link failed. Retrying in 10s...", wait 10 seconds, retry.
  //   4. After MAX_PAIRING_RETRIES (3) failed attempts, print a clean error.
  //
  // The 10-second delay is per the user's explicit spec — it avoids spamming
  // WhatsApp's pairing endpoint with rapid requests (which causes the
  // "Couldn't link device. Something went wrong" error on the user's phone).
  private async connectWithPairingCode(sessionId: string, phoneNumber: string): Promise<void> {
    const MAX_PAIRING_RETRIES = 3;
    let currentPhone = phoneNumber;

    for (let attempt = 1; attempt <= MAX_PAIRING_RETRIES; attempt++) {
      try {
        await this.sessionManager.createSession(sessionId);

        const { sock, pairingCode, pairingFailed } = await this.connectionManager.createConnectionWithPairingCode(
          {
            sessionId,
            printQR: false,
            browser: 'CALTEX MD',
            autoReconnect: true,
            maxReconnectAttempts: 10,
            reconnectBaseDelay: 2000,
          },
          currentPhone
        );

        this.scheduler.registerSocket(sessionId, sock);

        if (pairingFailed) {
          // Pairing failed before the code was even generated.
          if (attempt < MAX_PAIRING_RETRIES) {
            // eslint-disable-next-line no-console
            console.log('Link failed. Retrying in 10s...');
            await new Promise(resolve => setTimeout(resolve, 10000));
            continue;
          } else {
            // eslint-disable-next-line no-console
            console.log('Link failed. All retries exhausted. Please restart the server.');
            return;
          }
        }

        if (pairingCode) {
          // Display the clean pairing code banner. The connection manager
          // has already verified the QR event fired (WhatsApp's ack) AND
          // waited 3 seconds before calling requestPairingCode, so it's
          // safe to display the banner here.
          printPairingCodeBanner(pairingCode, currentPhone);
          return;
        } else {
          // pairingFailed was false but no code was returned — unusual but handle it
          if (attempt < MAX_PAIRING_RETRIES) {
            // eslint-disable-next-line no-console
            console.log('Link failed. Retrying in 10s...');
            await new Promise(resolve => setTimeout(resolve, 10000));
            continue;
          }
          // eslint-disable-next-line no-console
          console.log('Link failed. All retries exhausted. Please restart the server.');
          return;
        }
      } catch (err: any) {
        // v1.6.0: Catch the error and show a clean message — do NOT dump stack trace.
        if (attempt < MAX_PAIRING_RETRIES) {
          // eslint-disable-next-line no-console
          console.log('Link failed. Retrying in 10s...');
          await new Promise(resolve => setTimeout(resolve, 10000));
          continue;
        }
        // eslint-disable-next-line no-console
        console.log('Link failed. All retries exhausted. Please restart the server.');
        return;
      }
    }
  }

  private setupShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
      try {
        await this.connectionManager.disconnectAll();
        this.scheduler.destroy();
        this.apiClient.destroy();
        this.aiHandler.destroy();

        this.httpServer.close(() => {
          process.exit(0);
        });

        setTimeout(() => {
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
    // v1.6.0: Silent startup validation — no logger.info banner.

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

    const canAutoConnect = hasLocalCreds || (isCaltexId && hasGithubEnv);

    // Start HTTP server FIRST (silent — no log line). Pterodactyl's startup
    // detection looks for the process to be listening, not for a specific log line.
    await new Promise<void>((resolve) => {
      this.httpServer.listen(PORT, () => {
        resolve();
      });
    });

    // Report status (silent)
    this.apiClient.reportStatus('starting');

    // ── Decide what to do next ──
    const safeConnect = async () => {
      try {
        if (canAutoConnect) {
          // Mode A or B: existing creds (local or from GitHub) — connect directly.
          // Silent — no "Auto-connecting with existing credentials" log.
          await this.connect(sessionId);
          this.apiClient.reportStatus('running');
        } else {
          // Mode C: Interactive pairing — get phone number and generate pairing code.
          // v1.6.0: Clean startup banner per user spec.
          // eslint-disable-next-line no-console
          console.log('=== WHATSAPP BOT STARTED ===');
          // eslint-disable-next-line no-console
          console.log('Waiting for WhatsApp number...');

          let phoneNumber: string | null = null;

          // If BOT_OWNER env var is set and parses, use it (silent — no log line).
          if (botOwnerEnv) {
            phoneNumber = normalizePhoneNumber(botOwnerEnv);
          }

          // Interactive prompt — single prompt, validate, then proceed silently.
          // The user spec requires exactly this prompt:
          //   Enter number with country code:
          if (!phoneNumber) {
            const MAX_ATTEMPTS = 5;
            for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
              const answer = await promptUser('Enter number with country code: ');
              phoneNumber = normalizePhoneNumber(answer);
              if (phoneNumber) break;
              // eslint-disable-next-line no-console
              console.log(`Invalid number "${answer}". Try again.`);
            }
            if (!phoneNumber) {
              // eslint-disable-next-line no-console
              console.log('Too many invalid attempts. Restart the server to try again.');
              process.exit(1);
            }
          }

          // Silent from here until the code is ready (per user spec:
          // "After user enters number, show nothing else until code is ready.")
          await this.connectWithPairingCode(sessionId, phoneNumber);
          this.apiClient.reportStatus('running');
        }
      } catch (err: any) {
        logger.error({ err: err?.message ?? String(err) }, '[STARTUP] WhatsApp connection failed — HTTP API still available');
        this.apiClient.reportStatus('running');
      }
    };

    // Start the connection flow immediately (no 3s setTimeout delay — the user
    // wants the prompt to appear as soon as the bot starts).
    safeConnect().catch((err) => {
      logger.error({ err }, 'safeConnect() threw unexpectedly');
    });
  }
}

// Start the bot
const bot = new CaltexBot();
bot.start().catch((err) => {
  logger.error({ err }, 'Failed to start CALTEX MD Bot');
  process.exit(1);
});

// Global error handlers — silent at warn level (these are pino.error so still shown)
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception');
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled rejection');
});

export default bot;
