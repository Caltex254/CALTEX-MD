// ============================================================================
// CALTEX MD WhatsApp Bot - Main Entry Point
// Starts the HTTP server on port 3031 and initializes the WhatsApp connection
// ============================================================================

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { SessionManager } from './src/session-manager';
import { ConnectionManager, logger } from './src/connection';
import { AntiFeatures } from './src/anti-features';
import { MediaHandler } from './src/media-handler';
import { AIHandler } from './src/ai-handler';
import { GroupManager } from './src/group-manager';
import { MessageHandler } from './src/message-handler';
import { Scheduler } from './src/scheduler';
import { APIClient } from './src/api-client';

const PORT = 3031;
// Use BOT_SESSION_ID env var if set (e.g. CALTEX-ECPY-C3DK), else fall back to 'caltex-md'
const DEFAULT_SESSION_ID = process.env.BOT_SESSION_ID || 'caltex-md';

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
    this.apiClient = new APIClient();

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
    // ── STARTUP VALIDATION: fail fast with clear errors ──
    logger.info('='.repeat(50));
    logger.info('  CALTEX MD WhatsApp Bot - Starting...');
    logger.info('='.repeat(50));

    logger.info({ value: process.env.BOT_SESSION_ID || '(not set)' }, '[STARTUP] Reading BOT_SESSION_ID env var...');
    const sessionId = process.env.BOT_SESSION_ID;
    if (!sessionId) {
      logger.error('[STARTUP] FATAL: BOT_SESSION_ID env var is not set. The bot cannot restore credentials without it.');
      logger.error('[STARTUP] Set BOT_SESSION_ID to your CALTEX-XXXX-XXXX session id (from the /scan page) and redeploy.');
      logger.error('[STARTUP] Exiting with code 1.');
      process.exit(1);
    }
    if (!/^CALTEX-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(sessionId)) {
      logger.error({ value: sessionId }, '[STARTUP] FATAL: BOT_SESSION_ID does not match expected format CALTEX-XXXX-XXXX.');
      logger.error('[STARTUP] Exiting with code 1.');
      process.exit(1);
    }
    logger.info({ sessionId }, '[STARTUP] BOT_SESSION_ID is valid');

    logger.info({
      token: process.env.GITHUB_TOKEN ? '***set***' : '(not set)',
      owner: process.env.GITHUB_REPO_OWNER || '(not set)',
      repo: process.env.GITHUB_REPO_NAME || '(not set)',
    }, '[STARTUP] Checking GitHub credential storage env vars...');
    if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPO_OWNER || !process.env.GITHUB_REPO_NAME) {
      logger.error('[STARTUP] FATAL: GitHub env vars missing. Cannot restore WhatsApp credentials.');
      logger.error('[STARTUP] Required: GITHUB_TOKEN, GITHUB_REPO_OWNER, GITHUB_REPO_NAME');
      logger.error('[STARTUP] Exiting with code 1.');
      process.exit(1);
    }
    logger.info('[STARTUP] GitHub credential storage is configured');

    logger.info({ url: process.env.API_URL || '(not set)' }, '[STARTUP] Session API URL (for reporting status)...');
    logger.info({ nodeVersion: process.version }, '[STARTUP] Runtime: Node.js');

    // Start HTTP server
    await new Promise<void>((resolve) => {
      this.httpServer.listen(PORT, () => {
        logger.info(`HTTP server listening on port ${PORT}`);
        logger.info(`Health check: http://localhost:${PORT}/health`);
        resolve();
      });
    });

    logger.info('CALTEX MD Bot HTTP server started!');
    logger.info(`API available at http://localhost:${PORT}`);
    logger.info(`Commands: http://localhost:${PORT}/api/commands`);
    logger.info(`Connect WhatsApp: POST http://localhost:${PORT}/api/connect`);

    // Report status
    this.apiClient.reportStatus('starting');

    // Auto-connect default session
    const safeConnect = async () => {
      try {
        await this.connect(DEFAULT_SESSION_ID);
        logger.info('CALTEX MD Bot WhatsApp connection initiated!');
        logger.info('Scan the QR code above with WhatsApp to connect');
        logger.info('   WhatsApp > Settings > Linked Devices > Link a device');
        this.apiClient.reportStatus('running');
      } catch (err: any) {
        logger.error({ err: err?.message ?? String(err) }, 'WhatsApp connection failed - HTTP API still available');
        logger.info('You can retry connecting via: POST http://localhost:3031/api/connect');
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
