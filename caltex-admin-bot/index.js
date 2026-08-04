// ============================================================================
//  CALTEX Admin Bot — Telegram ↔ WhatsApp bridge
// ============================================================================
//  WHAT THIS BOT DOES:
//
//  1. You message it on Telegram (the bot token below).
//  2. /link <your-phone-number>  →  it requests a WhatsApp pairing code.
//  3. The code is sent back to you in Telegram.
//  4. You open WhatsApp → Settings → Linked Devices → Link with phone number
//     and enter the code. A popup appears in WhatsApp confirming the link.
//  5. From now on, anyone who messages your WhatsApp number gets auto-replies:
//       .menu / .help  →  list of WhatsApp commands
//       .ping          →  "Pong! 🏓"
//       .info          →  bot info
//       .alive         →  alive check
//       .time          →  current time
//       .owner         →  owner info
//  6. /status  →  check WhatsApp connection state.
//  7. /unlink  →  log out WhatsApp (unlinks the device).
//
//  The WhatsApp session is persisted in ./auth_info_baileys/ so a container
//  restart does NOT require re-pairing.
// ============================================================================

const {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
} = require('@whiskeysockets/baileys');
const TelegramBot = require('node-telegram-bot-api');
const { Boom } = require('@hapi/boom');
const P = require('pino');
const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
//  CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────
const BOT_TOKEN = process.env.BOT_TOKEN || '8874519687:AAHQ-eg3XvaI4qTMMrziqYYzOcaBoMmX_ck';

// Optional: restrict Telegram access to a specific chat ID (set via env var).
// If not set, anyone who knows the bot token can use it.
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID ? parseInt(process.env.ADMIN_CHAT_ID, 10) : null;

const BOT_NAME = 'CALTEX Admin Bot';
const VERSION = '1.0.0';
const AUTH_DIR = path.join(__dirname, 'auth_info_baileys');

// Make sure auth dir exists
if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

// ─────────────────────────────────────────────────────────────────────────────
//  TELEGRAM BOT
// ─────────────────────────────────────────────────────────────────────────────
const tg = new TelegramBot(BOT_TOKEN, { polling: true });
console.log(`[${BOT_NAME} v${VERSION}] Telegram bot started`);

// ─────────────────────────────────────────────────────────────────────────────
//  WHATSAPP STATE
// ─────────────────────────────────────────────────────────────────────────────
let sock = null;
let waConnectionState = 'disconnected'; // disconnected, connecting, connected, logged_out
let lastPairingCodeAt = 0;
let pendingPairingPhone = null;

// No store — we use a simple in-memory placeholder for getMessage
// (Baileys will still work; store is only needed for message caching/history)

// ─────────────────────────────────────────────────────────────────────────────
//  WHATSAPP CONNECTION
// ─────────────────────────────────────────────────────────────────────────────
async function startWhatsApp() {
  if (sock && waConnectionState === 'connecting') return sock;
  waConnectionState = 'connecting';

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`[WA] using Baileys v${version.join('.')}, latest=${isLatest}`);

  sock = makeWASocket({
    version,
    browser: Browsers.appropriate('Chrome'),
    connectTimeoutMs: 15000,
    keepAliveIntervalMs: 25000,
    logger: P({ level: 'warn' }),
    defaultQueryTimeoutMs: 45000,
    retryRequestDelayMs: 200,
    maxMsgRetryCount: 3,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    getMessage: async (key) => {
      // We don't keep a message store — return a placeholder.
      // This is only used for retry receipts / quote lookups.
      return { conversation: 'msg not found' };
    },
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      // We don't print QR — this bot uses pairing codes only.
      console.log('[WA] QR received (pairing-code mode should not produce one, but ignoring if it does)');
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error instanceof Boom)
        ? lastDisconnect.error.output.statusCode
        : null;
      console.log(`[WA] connection closed, statusCode=${statusCode}`);

      if (statusCode === DisconnectReason.loggedOut) {
        waConnectionState = 'logged_out';
        console.log('[WA] device was logged out — clearing auth state');
        // Wipe auth so a fresh pairing can happen
        try {
          fs.rmSync(AUTH_DIR, { recursive: true, force: true });
          fs.mkdirSync(AUTH_DIR, { recursive: true });
        } catch (e) { /* ignore */ }
        notifyAdmin('⚠️ WhatsApp was logged out. Send /link <phone> to pair again.');
      } else if (statusCode === 410 || statusCode === 401) {
        // WhatsApp rate-limited or removed the device
        waConnectionState = 'disconnected';
        notifyAdmin('⚠️ WhatsApp rejected the connection (rate-limited or device removed). Wait 1–12 hours, then /link <phone> again.');
      } else {
        // Generic close — try reconnecting after a short delay
        waConnectionState = 'disconnected';
        console.log('[WA] reconnecting in 5s...');
        setTimeout(() => startWhatsApp().catch(console.error), 5000);
      }
    } else if (connection === 'open') {
      waConnectionState = 'connected';
      const me = sock.user;
      const phone = me?.id?.split(':')[0] || 'unknown';
      console.log(`[WA] connected as ${phone}`);
      notifyAdmin(`✅ WhatsApp connected!\nPhone: +${phone}\n\nThe bot will now auto-respond to WhatsApp commands like .menu .ping .info`);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const m of messages) {
      try {
        await handleIncomingWhatsAppMessage(m);
      } catch (e) {
        console.error('[WA] msg handler error:', e?.message || e);
      }
    }
  });

  return sock;
}

// ─────────────────────────────────────────────────────────────────────────────
//  WHATSAPP COMMAND HANDLERS
// ─────────────────────────────────────────────────────────────────────────────
async function handleIncomingWhatsAppMessage(m) {
  if (!m.message || m.key.fromMe) return;

  const jid = m.key.remoteJid;
  const sender = m.key.participant || m.key.remoteJid;
  const text = extractMessageText(m.message);
  if (!text) return;

  // Prefix-based commands (default: .)
  const PREFIX = '.';
  if (!text.startsWith(PREFIX)) return;

  const args = text.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = (args.shift() || '').toLowerCase();
  const rest = args.join(' ');

  console.log(`[WA→cmd] jid=${jid} sender=${sender} cmd=${cmd} args=${JSON.stringify(args)}`);

  switch (cmd) {
    case 'menu':
    case 'help':
      await sock.sendMessage(jid, { text: buildMenuText() }, { quoted: m });
      break;
    case 'ping':
      await sock.sendMessage(jid, { text: 'Pong! 🏓' }, { quoted: m });
      break;
    case 'info':
      await sock.sendMessage(jid, {
        text:
          `*${BOT_NAME}*\n` +
          `Version: ${VERSION}\n` +
          `Platform: Pterodactyl\n` +
          `Runtime: Node.js ${process.version}\n` +
          `WA JID: ${sock.user?.id || 'unknown'}\n` +
          `Uptime: ${formatUptime(process.uptime())}`,
      }, { quoted: m });
      break;
    case 'alive':
      await sock.sendMessage(jid, { text: '✅ Bot is alive and running.' }, { quoted: m });
      break;
    case 'time':
      await sock.sendMessage(jid, { text: `🕐 ${new Date().toString()}` }, { quoted: m });
      break;
    case 'owner':
      await sock.sendMessage(jid, { text: '👑 Owner: CALTEX' }, { quoted: m });
      break;
    case 'jid':
      await sock.sendMessage(jid, { text: `Your JID: ${sender}` }, { quoted: m });
      break;
    case 'sticker':
      // Basic placeholder — needs an image to actually work
      await sock.sendMessage(jid, { text: 'Send an image with caption .sticker to make a sticker.' }, { quoted: m });
      break;
    default:
      // Unknown command — ignore (no spam)
      break;
  }
}

function extractMessageText(message) {
  if (!message) return '';
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    ''
  );
}

function buildMenuText() {
  return (
    `╭───「 *${BOT_NAME}* 」───\n` +
    `│\n` +
    `│ ✦ .menu / .help — show this menu\n` +
    `│ ✦ .ping — ping the bot\n` +
    `│ ✦ .info — bot info\n` +
    `│ ✦ .alive — alive check\n` +
    `│ ✦ .time — current time\n` +
    `│ ✦ .owner — owner info\n` +
    `│ ✦ .jid — your WhatsApp JID\n` +
    `│\n` +
    `│ Version: ${VERSION}\n` +
    `╰─────────────────`
  );
}

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  PAIRING CODE FLOW (called from /link)
// ─────────────────────────────────────────────────────────────────────────────
async function requestPairingCode(phoneNumber, chatId) {
  // Validate phone number (digits only, at least 7 chars)
  const cleaned = phoneNumber.replace(/[^\d]/g, '');
  if (cleaned.length < 7) {
    tg.sendMessage(chatId, '❌ Invalid phone number. Use international format, e.g. /link 254712345678');
    return;
  }

  // Rate-limit pairing attempts (min 60s between attempts)
  const now = Date.now();
  if (now - lastPairingCodeAt < 60000) {
    const wait = Math.ceil((60000 - (now - lastPairingCodeAt)) / 1000);
    tg.sendMessage(chatId, `⏳ Please wait ${wait}s before requesting another pairing code.`);
    return;
  }
  lastPairingCodeAt = now;
  pendingPairingPhone = cleaned;

  tg.sendMessage(chatId,
    `🔄 Requesting pairing code for +${cleaned}...\n\n` +
    `I'll send the code as soon as WhatsApp generates it. This usually takes 3–10 seconds.`
  );

  // Make sure WA socket exists; if it's already connected, log out first
  if (waConnectionState === 'connected' && sock) {
    tg.sendMessage(chatId, '⚠️ WhatsApp is already linked. /unlink first if you want to pair a different number.');
    return;
  }

  try {
    if (!sock || waConnectionState !== 'connecting') {
      await startWhatsApp();
    }

    // Wait for the socket to be ready to request a pairing code
    // (need registrationId etc to be loaded)
    let tries = 0;
    while ((!sock || !sock.authState?.creds?.registered) && tries < 30) {
      await new Promise(r => setTimeout(r, 500));
      tries++;
    }

    if (!sock) {
      tg.sendMessage(chatId, '❌ WhatsApp socket failed to start. Try again.');
      return;
    }

    // Register a one-time handler for the pairing code event
    const code = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('pairing code timeout')), 30_000);

      // Baileys emits 'connection.update' with a `pairingCode` field when ready
      const onPairingCode = (update) => {
        if (update.pairingCode) {
          clearTimeout(timeout);
          sock.ev.off('connection.update', onPairingCode);
          resolve(update.pairingCode);
        }
      };
      sock.ev.on('connection.update', onPairingCode);

      // Trigger the request
      sock.requestPairingCode(cleaned).catch(e => {
        clearTimeout(timeout);
        reject(e);
      });
    });

    console.log(`[WA] pairing code for ${cleaned}: ${code}`);
    tg.sendMessage(chatId,
      `📱 *Your WhatsApp Pairing Code:*\n\n` +
      `    *${code}*\n\n` +
      `Steps:\n` +
      `1. Open WhatsApp on your phone\n` +
      `2. Settings → Linked Devices → Link with phone number\n` +
      `3. Enter the code above\n\n` +
      `⏱️ The code expires in ~60 seconds.\n` +
      `✅ Once linked, I'll confirm here and the bot will start responding to commands.`,
      { parse_mode: 'Markdown' }
    );
  } catch (e) {
    console.error('[WA] pairing error:', e);
    tg.sendMessage(chatId, `❌ Pairing failed: ${e.message || e}\n\nTry again in a minute.`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  TELEGRAM ADMIN COMMANDS
// ─────────────────────────────────────────────────────────────────────────────
function authCheck(msg) {
  if (ADMIN_CHAT_ID && msg.chat.id !== ADMIN_CHAT_ID) {
    tg.sendMessage(msg.chat.id, '⛔ Unauthorized. This bot is private.');
    return false;
  }
  return true;
}

function notifyAdmin(text) {
  if (ADMIN_CHAT_ID) {
    tg.sendMessage(ADMIN_CHAT_ID, text).catch(() => {});
  }
}

tg.onText(/\/start/, (msg) => {
  if (!authCheck(msg)) return;
  tg.sendMessage(msg.chat.id,
    `🔥 *${BOT_NAME}* v${VERSION}\n\n` +
    `This bot links WhatsApp and auto-responds to commands.\n\n` +
    `*Commands:*\n` +
    `/link <phone> — Link a WhatsApp number (e.g. /link 254712345678)\n` +
    `/status — Check WhatsApp connection status\n` +
    `/unlink — Disconnect WhatsApp\n` +
    `/menu — Show WhatsApp commands (the ones users send to your WA)\n` +
    `/help — Show this help\n\n` +
    `*How it works:*\n` +
    `1. Send /link with your phone number\n` +
    `2. I'll send you a pairing code\n` +
    `3. Enter it in WhatsApp → Linked Devices\n` +
    `4. The bot starts responding to WhatsApp commands (.menu .ping .info ...)`,
    { parse_mode: 'Markdown' }
  );
});

tg.onText(/\/help/, (msg) => {
  if (!authCheck(msg)) return;
  tg.sendMessage(msg.chat.id,
    `*Admin commands:*\n` +
    `/link <phone> — Link WhatsApp\n` +
    `/status — WA connection status\n` +
    `/unlink — Disconnect WhatsApp\n` +
    `/menu — Show WhatsApp-side commands\n\n` +
    `*WhatsApp commands (anyone can use):*\n` +
    `.menu .ping .info .alive .time .owner .jid`,
    { parse_mode: 'Markdown' }
  );
});

tg.onText(/\/link\s+(\S+)/, async (msg, match) => {
  if (!authCheck(msg)) return;
  const phone = match[1];
  await requestPairingCode(phone, msg.chat.id);
});

// Catch /link with no number
tg.onText(/^\/link$/, (msg) => {
  if (!authCheck(msg)) return;
  tg.sendMessage(msg.chat.id,
    'Usage: `/link <phone>`\nExample: `/link 254712345678`\n\nUse your full international phone number (no +, no spaces).',
    { parse_mode: 'Markdown' }
  );
});

tg.onText(/\/status/, (msg) => {
  if (!authCheck(msg)) return;
  const states = {
    disconnected: '🔴 Disconnected',
    connecting: '🟡 Connecting...',
    connected: '🟢 Connected',
    logged_out: '⚫ Logged out',
  };
  let text = `*WhatsApp status:* ${states[waConnectionState] || 'unknown'}\n`;
  if (waConnectionState === 'connected' && sock?.user) {
    const phone = sock.user.id.split(':')[0];
    text += `*Linked number:* +${phone}\n`;
    text += `*Uptime:* ${formatUptime(process.uptime())}\n`;
  }
  tg.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
});

tg.onText(/\/unlink/, async (msg) => {
  if (!authCheck(msg)) return;
  if (!sock) {
    tg.sendMessage(msg.chat.id, 'WhatsApp is not connected.');
    return;
  }
  try {
    await sock.logout();
    tg.sendMessage(msg.chat.id, '✅ WhatsApp unlinked. The device has been removed from your WhatsApp Linked Devices.');
  } catch (e) {
    // Force-wipe the auth state if logout fails
    try {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    } catch (_) {}
    tg.sendMessage(msg.chat.id, '⚠️ Forced unlink. Auth state wiped.');
  }
  sock = null;
  waConnectionState = 'disconnected';
});

tg.onText(/\/menu/, (msg) => {
  if (!authCheck(msg)) return;
  tg.sendMessage(msg.chat.id, `*WhatsApp-side commands:*\n\n${buildMenuText()}`, { parse_mode: 'Markdown' });
});

// Catch-all for unknown commands
tg.onText(/^\/(\w+)/, (msg, match) => {
  if (!authCheck(msg)) return;
  const cmd = match[1];
  const known = ['start', 'help', 'link', 'status', 'unlink', 'menu'];
  if (!known.includes(cmd)) {
    tg.sendMessage(msg.chat.id, `Unknown command: /${cmd}\nType /help to see available commands.`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GRACEFUL SHUTDOWN
// ─────────────────────────────────────────────────────────────────────────────
async function shutdown(signal) {
  console.log(`\n[${signal}] shutting down...`);
  try {
    if (sock) await sock.end(new Error('shutdown'));
  } catch (_) {}
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (e) => console.error('[uncaught]', e));
process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));

// ─────────────────────────────────────────────────────────────────────────────
//  AUTO-RECONNECT ON STARTUP (if already paired)
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  try {
    const credsFile = path.join(AUTH_DIR, 'creds.json');
    if (fs.existsSync(credsFile)) {
      console.log('[WA] existing session found — reconnecting automatically');
      await startWhatsApp();
    } else {
      console.log('[WA] no existing session — waiting for /link command');
    }
  } catch (e) {
    console.error('[WA] startup reconnect failed:', e.message);
  }
})();

console.log('[tg] polling started — bot is ready');
