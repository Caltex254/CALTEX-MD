// ============================================================================
//  CALTEX PANEL Telegram Bot — Multi-Egg Edition v2
// ============================================================================
//  This bot lets Telegram users create and manage Pterodactyl servers.
//  It now supports ALL egg types on the panel — Minecraft AND any bot type.
//
//  Supported eggs (when user runs /createsrv):
//    • Minecraft Paper              (egg 1,  nest 1, java_25)
//    • CALTEX MD WhatsApp Bot       (egg 15, nest 5, nodejs_20)
//    • Universal Node.js Bot        (egg 16, nest 5, nodejs_20) — any Node bot
//    • Universal Python Bot         (egg 17, nest 5, python_3.11)
//    • WhatsApp Bot (Baileys)       (egg 18, nest 5, nodejs_20)
//    • WhatsApp Bot (whatsapp-web.js) (egg 19, nest 5, nodejs_20)
//
//  Owner: admin@caltexpanel.com
// ============================================================================

const TelegramBot = require('node-telegram-bot-api');

// ─────────────────────────────────────────────────────────────────────────────
//  CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────
const BOT_TOKEN    = process.env.BOT_TOKEN || '8716120128:AAGnJ9v2GbSm4rrwtr76lJBrSaHx_pDHvUc';
const PANEL_URL    = 'https://caltexpanel.kenya.qzz.io';
const API_KEY      = 'ptla_EXe5bpzcIdkTCxPKBFFDAMI7LxyDX50hIutfa34okPB';
const CLIENT_API_KEY = 'ptlc_82NiZTCyBwsW31xGvoPrXHKG0UX6jpsuyhnoS6c3DV3';

const ADMIN_ONLY_EMAIL = 'admin@caltexpanel.com';

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log('CALTEX PANEL Telegram Bot v2 started!');
console.log('Supported eggs: Minecraft, CALTEX MD, Universal Node.js, Universal Python, WhatsApp Baileys, WhatsApp web.js');

// ─────────────────────────────────────────────────────────────────────────────
//  EGG DEFINITIONS — what the panel can deploy
// ─────────────────────────────────────────────────────────────────────────────
//  Each egg has the info needed to call POST /api/application/servers
const EGGS = {
  minecraft: {
    label: 'Minecraft Paper',
    emoji: '🎮',
    nest_id: 1,
    egg_id: 1,
    docker_image: 'ghcr.io/pterodactyl/yolks:java_25',
    startup: 'java -Xms128M -XX:MaxRAMPercentage=95.0 -Dterminal.jline=false -Dterminal.ansi=true -jar server.jar',
    environment: { SERVER_JARFILE: 'server.jar', MINECRAFT_VERSION: 'latest', BUILD_NUMBER: 'latest' },
    description: 'Minecraft Java server with PaperMC. Players connect with the Minecraft Java client.',
    default_plan: { memory: 1024, disk: 5000, cpu: 50 },
  },
  caltex_md: {
    label: 'CALTEX MD WhatsApp Bot',
    emoji: '🤖',
    nest_id: 5,
    egg_id: 15,
    docker_image: 'ghcr.io/pterodactyl/yolks:nodejs_20',
    startup: '/usr/local/bin/node /home/container/mini-services/caltex-bot/index.js',
    environment: {
      STARTUP_FILE: 'mini-services/caltex-bot/index.js',
      BOT_OWNER: '',
      BOT_PREFIX: '.',
      NODE_ENV: 'production',
      MAX_RETRIES: '3',
      BASE_DELAY: '30',
    },
    description: 'The full CALTEX-MD WhatsApp bot. After creation, open the console and enter your WhatsApp phone number to get a pairing code.',
    default_plan: { memory: 1024, disk: 2048, cpu: 100 },
  },
  universal_node: {
    label: 'Universal Node.js Bot',
    emoji: '🟢',
    nest_id: 5,
    egg_id: 16,
    docker_image: 'ghcr.io/pterodactyl/yolks:nodejs_20',
    startup: '/bin/sh /home/container/universal-node-start.sh',
    environment: {
      STARTUP_FILE: 'index.js',
      NODE_ENV: 'production',
      MAX_RETRIES: '3',
      BASE_DELAY: '30',
      AUTO_INSTALL: 'true',
    },
    description: 'Runs ANY Node.js bot. Upload your package.json + entry file (index.js / index.ts / bot.js) via the Files tab, then start the server. npm install runs automatically.',
    default_plan: { memory: 1024, disk: 5000, cpu: 100 },
  },
  universal_python: {
    label: 'Universal Python Bot',
    emoji: '🐍',
    nest_id: 5,
    egg_id: 17,
    docker_image: 'ghcr.io/pterodactyl/yolks:python_3.11',
    startup: '/bin/sh /home/container/universal-python-start.sh',
    environment: {
      STARTUP_FILE: 'bot.py',
      PYTHON_ENV: 'production',
      MAX_RETRIES: '3',
      BASE_DELAY: '30',
      AUTO_INSTALL: 'true',
    },
    description: 'Runs ANY Python bot. Upload your bot.py + requirements.txt via the Files tab, then start the server. pip install -r requirements.txt runs automatically.',
    default_plan: { memory: 1024, disk: 5000, cpu: 100 },
  },
  whatsapp_baileys: {
    label: 'WhatsApp Bot (Baileys)',
    emoji: '💬',
    nest_id: 5,
    egg_id: 18,
    docker_image: 'ghcr.io/pterodactyl/yolks:nodejs_20',
    startup: '/bin/sh /home/container/whatsapp-baileys-start.sh',
    environment: {
      STARTUP_FILE: 'index.js',
      BOT_OWNER: '',
      BOT_PREFIX: '.',
      NODE_ENV: 'production',
      MAX_RETRIES: '3',
      BASE_DELAY: '30',
      AUTO_INSTALL: 'true',
    },
    description: 'Universal WhatsApp bot using @whiskeysockets/baileys. Upload your bot code (package.json with baileys dependency + index.js), then start the server and enter your phone number in the console.',
    default_plan: { memory: 1024, disk: 5000, cpu: 100 },
  },
  whatsapp_webjs: {
    label: 'WhatsApp Bot (whatsapp-web.js)',
    emoji: '🌐',
    nest_id: 5,
    egg_id: 19,
    docker_image: 'ghcr.io/pterodactyl/yolks:nodejs_20',
    startup: '/bin/sh /home/container/whatsapp-webjs-start.sh',
    environment: {
      STARTUP_FILE: 'index.js',
      NODE_ENV: 'production',
      MAX_RETRIES: '3',
      BASE_DELAY: '30',
      AUTO_INSTALL: 'true',
    },
    description: 'Universal WhatsApp bot using whatsapp-web.js + Puppeteer. A QR code appears in the console — scan it from WhatsApp → Linked Devices.',
    default_plan: { memory: 2048, disk: 5000, cpu: 200 }, // puppeteer needs more RAM
  },
};

const EGG_KEYS = Object.keys(EGGS);

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function generatePassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let pwd = '';
  for (let i = 0; i < length; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  return pwd;
}

function esc(text) {
  if (!text) return '';
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function panelApi(method, endpoint, body = null) {
  const opts = { method, headers: { 'Authorization': 'Bearer ' + API_KEY, 'Accept': 'application/json', 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(PANEL_URL + '/api/application' + endpoint, opts);
  const text = await res.text();
  if (!text || text.trim() === '') return { success: true, status: res.status };
  try { return JSON.parse(text); } catch (e) { return { success: true, status: res.status, raw: text }; }
}

async function clientApi(method, endpoint, body = null) {
  const opts = { method, headers: { 'Authorization': 'Bearer ' + CLIENT_API_KEY, 'Accept': 'application/json', 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(PANEL_URL + '/api/client' + endpoint, opts);
  const text = await res.text();
  if (!text || text.trim() === '') return { success: true, status: res.status };
  try { return JSON.parse(text); } catch (e) { return { success: true, status: res.status, raw: text }; }
}

async function getServerIdentifier(serverId) {
  const data = await panelApi('GET', '/servers/' + serverId);
  return data.attributes ? data.attributes.identifier : null;
}

async function getNextServerNumber() {
  const data = await panelApi('GET', '/servers');
  if (!data.data || data.data.length === 0) return 1;
  return data.data.length + 1;
}

// ─────────────────────────────────────────────────────────────────────────────
//  KEYBOARDS
// ─────────────────────────────────────────────────────────────────────────────
function mainMenu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🖥️ List Servers', callback_data: 'list_servers' }],
        [{ text: '➕ Create Server', callback_data: 'create_server' }, { text: '🗑️ Delete Server', callback_data: 'delete_server' }],
        [{ text: '▶️ Start Server', callback_data: 'start_server' }, { text: '⏹️ Stop Server', callback_data: 'stop_server' }],
        [{ text: '🔄 Restart Server', callback_data: 'restart_server' }, { text: '📊 Server Status', callback_data: 'server_status' }],
        [{ text: '👥 List Users', callback_data: 'list_users' }, { text: '📡 Node Info', callback_data: 'node_info' }],
      ]
    }
  };
}

function eggSelectKeyboard() {
  const rows = EGG_KEYS.map(k => [{
    text: EGGS[k].emoji + ' ' + EGGS[k].label,
    callback_data: 'pick_egg_' + k,
  }]);
  rows.push([{ text: '❌ Cancel', callback_data: 'cancel_action' }]);
  return { reply_markup: { inline_keyboard: rows } };
}

function planKeyboard(eggKey) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📅 7 Days',  callback_data: 'plan_' + eggKey + '_basic_7d' },
          { text: '📅 14 Days', callback_data: 'plan_' + eggKey + '_basic_14d' },
        ],
        [
          { text: '📅 1 Month',  callback_data: 'plan_' + eggKey + '_basic_1m' },
          { text: '📦 Custom Plan', callback_data: 'custom_plan_' + eggKey },
        ],
        [{ text: '🔙 Back', callback_data: 'create_server' }, { text: '❌ Cancel', callback_data: 'cancel_action' }],
      ]
    }
  };
}

function customPlanKeyboard(eggKey) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📦 Basic (1GB/5GB/50%) — 7d',  callback_data: 'plan_' + eggKey + '_basic_7d' },
          { text: '📦 Basic (1GB/5GB/50%) — 14d', callback_data: 'plan_' + eggKey + '_basic_14d' },
        ],
        [
          { text: '📦 Standard (2GB/10GB/100%) — 7d',  callback_data: 'plan_' + eggKey + '_standard_7d' },
          { text: '📦 Standard (2GB/10GB/100%) — 14d', callback_data: 'plan_' + eggKey + '_standard_14d' },
        ],
        [
          { text: '📦 Pro (4GB/20GB/200%) — 7d',  callback_data: 'plan_' + eggKey + '_pro_7d' },
          { text: '📦 Pro (4GB/20GB/200%) — 1m',  callback_data: 'plan_' + eggKey + '_pro_1m' },
        ],
        [
          { text: '📦 Ultimate (6GB/40GB/300%) — 7d',  callback_data: 'plan_' + eggKey + '_ultimate_7d' },
          { text: '📦 Ultimate (6GB/40GB/300%) — 1m',  callback_data: 'plan_' + eggKey + '_ultimate_1m' },
        ],
        [{ text: '🔙 Back', callback_data: 'pick_egg_' + eggKey }],
      ]
    }
  };
}

async function serverSelectKeyboard(action) {
  const data = await panelApi('GET', '/servers');
  if (!data.data || data.data.length === 0) return null;
  const buttons = data.data.map(s => [{
    text: s.attributes.name + ' (ID: ' + s.attributes.id + ')',
    callback_data: action + '_' + s.attributes.id,
  }]);
  buttons.push([{ text: '❌ Cancel', callback_data: 'cancel_action' }]);
  return { reply_markup: { inline_keyboard: buttons } };
}

// ─────────────────────────────────────────────────────────────────────────────
//  COMMANDS
// ─────────────────────────────────────────────────────────────────────────────
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id,
    '<b>🔥 CALTEX PANEL Bot v2 🔥</b>\n\n' +
    'Manage game servers AND bots directly from Telegram.\n\n' +
    '<b>Supported server types:</b>\n' +
    '🎮 Minecraft Paper\n' +
    '🤖 CALTEX MD WhatsApp Bot\n' +
    '🟢 Universal Node.js Bot (any Node bot)\n' +
    '🐍 Universal Python Bot (any Python bot)\n' +
    '💬 WhatsApp Bot (Baileys)\n' +
    '🌐 WhatsApp Bot (whatsapp-web.js)\n\n' +
    '<b>Commands:</b>\n' +
    '/createsrv - Create a server (pick egg + plan + duration)\n' +
    '/servers - List all servers\n' +
    '/startsrv /stopsrv /restartsrv /killsrv - Power actions\n' +
    '/deletesrv - Delete a server\n' +
    '/status - Server status\n' +
    '/resources - Resource usage\n' +
    '/users - List users\n' +
    '/node - Node info\n' +
    '/menu - Show main menu',
    { parse_mode: 'HTML', ...mainMenu() }
  );
});

bot.onText(/\/menu/, (msg) => {
  bot.sendMessage(msg.chat.id, '<b>🔧 CALTEX PANEL Control Center v2</b>', { parse_mode: 'HTML', ...mainMenu() });
});

bot.onText(/\/servers/, async (msg) => {
  const chatId = msg.chat.id;
  const data = await panelApi('GET', '/servers');
  if (data.data && data.data.length > 0) {
    let text = '<b>🖥️ All Servers:</b>\n\n';
    for (const srv of data.data) {
      const s = srv.attributes;
      let state = 'unknown';
      try {
        const res = await clientApi('GET', '/servers/' + s.identifier + '/resources');
        if (res.attributes) state = res.attributes.current_state;
      } catch (e) { /* ignore */ }
      const emoji = state === 'running' ? '🟢' : '🔴';
      text += emoji + ' <b>' + esc(s.name) + '</b> (ID: ' + s.id + ')\n';
      text += '  RAM: ' + s.limits.memory + 'MB | Disk: ' + s.limits.disk + 'MB | CPU: ' + s.limits.cpu + '%\n';
      text += '  State: ' + state + '\n\n';
    }
    bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
  } else {
    bot.sendMessage(chatId, 'No servers found.');
  }
});

// ─── /createsrv — pick egg first, then plan ───
bot.onText(/\/createsrv/, async (msg) => {
  const chatId = msg.chat.id;
  let text = '<b>🚀 Create a New Server</b>\n\n' +
    '<b>Step 1:</b> Choose what to deploy:\n\n';
  for (const k of EGG_KEYS) {
    const e = EGGS[k];
    text += e.emoji + ' <b>' + esc(e.label) + '</b>\n';
    text += '   ' + esc(e.description) + '\n\n';
  }
  bot.sendMessage(chatId, text, { parse_mode: 'HTML', ...eggSelectKeyboard() });
});

bot.onText(/\/startsrv/, async (msg) => {
  const kb = await serverSelectKeyboard('startsrv');
  if (!kb) { bot.sendMessage(msg.chat.id, '❌ No servers found.'); return; }
  bot.sendMessage(msg.chat.id, '<b>▶️ Select a server to start:</b>', { parse_mode: 'HTML', ...kb });
});
bot.onText(/\/stopsrv/, async (msg) => {
  const kb = await serverSelectKeyboard('stopsrv');
  if (!kb) { bot.sendMessage(msg.chat.id, '❌ No servers found.'); return; }
  bot.sendMessage(msg.chat.id, '<b>⏹️ Select a server to stop:</b>', { parse_mode: 'HTML', ...kb });
});
bot.onText(/\/restartsrv/, async (msg) => {
  const kb = await serverSelectKeyboard('restartsrv');
  if (!kb) { bot.sendMessage(msg.chat.id, '❌ No servers found.'); return; }
  bot.sendMessage(msg.chat.id, '<b>🔄 Select a server to restart:</b>', { parse_mode: 'HTML', ...kb });
});
bot.onText(/\/killsrv/, async (msg) => {
  const kb = await serverSelectKeyboard('killsrv');
  if (!kb) { bot.sendMessage(msg.chat.id, '❌ No servers found.'); return; }
  bot.sendMessage(msg.chat.id, '<b>💀 Select a server to kill:</b>', { parse_mode: 'HTML', ...kb });
});
bot.onText(/\/deletesrv/, async (msg) => {
  const kb = await serverSelectKeyboard('deletesrv');
  if (!kb) { bot.sendMessage(msg.chat.id, '❌ No servers found.'); return; }
  bot.sendMessage(msg.chat.id, '<b>🗑️ Select a server to delete:</b>', { parse_mode: 'HTML', ...kb });
});
bot.onText(/\/status/, async (msg) => {
  const kb = await serverSelectKeyboard('status');
  if (!kb) { bot.sendMessage(msg.chat.id, '❌ No servers found.'); return; }
  bot.sendMessage(msg.chat.id, '<b>📊 Select a server to check:</b>', { parse_mode: 'HTML', ...kb });
});
bot.onText(/\/resources/, async (msg) => {
  const kb = await serverSelectKeyboard('resources');
  if (!kb) { bot.sendMessage(msg.chat.id, '❌ No servers found.'); return; }
  bot.sendMessage(msg.chat.id, '<b>📊 Select a server for resources:</b>', { parse_mode: 'HTML', ...kb });
});
bot.onText(/\/users/, async (msg) => {
  const chatId = msg.chat.id;
  const data = await panelApi('GET', '/users');
  if (data.data && data.data.length > 0) {
    let text = '<b>👥 Users:</b>\n\n';
    for (const u of data.data) {
      const a = u.attributes;
      text += '<b>ID:</b> ' + a.id + ' | ' + esc(a.username) + '\n';
      text += '  Email: ' + esc(a.email) + '\n';
      text += '  Name: ' + esc(a.first_name) + ' ' + esc(a.last_name) + '\n';
      text += '  Admin: ' + (a.root_admin ? '✅' : '❌') + '\n\n';
    }
    bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
  } else {
    bot.sendMessage(chatId, 'No users found.');
  }
});
bot.onText(/\/node/, async (msg) => {
  const chatId = msg.chat.id;
  const data = await panelApi('GET', '/nodes');
  if (data.data && data.data.length > 0) {
    let text = '<b>📡 Nodes:</b>\n\n';
    for (const n of data.data) {
      const a = n.attributes;
      text += '<b>' + esc(a.name) + '</b> (ID: ' + a.id + ')\n';
      text += '  FQDN: ' + esc(a.fqdn) + '\n';
      text += '  Memory: ' + a.memory + 'MB (allocated: ' + a.allocated_resources.memory + 'MB)\n';
      text += '  Disk: ' + a.disk + 'MB (allocated: ' + a.allocated_resources.disk + 'MB)\n';
      text += '  Daemon Port: ' + a.daemon_listen + '\n';
      text += '  Maintenance: ' + (a.maintenance_mode ? 'Yes' : 'No') + '\n\n';
    }
    bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  CREATE SERVER — full logic with egg selection
// ─────────────────────────────────────────────────────────────────────────────
async function createServer(chatId, eggKey, planInfo, duration) {
  const egg = EGGS[eggKey];
  if (!egg) { bot.sendMessage(chatId, '❌ Unknown server type.'); return; }

  const { memory, disk, cpu, planName } = planInfo;
  const num = await getNextServerNumber();
  const serverName = eggKey === 'minecraft'
    ? 'Caltex-' + num
    : egg.label.replace(/\s+/g, '-') + '-' + num;
  const password = generatePassword(12);
  const customerEmail    = 'caltex' + num + '@caltexpanel.com';
  const customerUsername = 'caltex' + num;
  const customerFirst    = 'Customer';
  const customerLast     = '#' + num;

  bot.sendMessage(chatId,
    '⏳ Creating <b>' + esc(serverName) + '</b>\n' +
    'Type: ' + egg.emoji + ' ' + esc(egg.label) + '\n' +
    'Plan: ' + esc(planName) + ' (' + memory + 'MB/' + disk + 'MB/' + cpu + '%)\n' +
    'Duration: ' + esc(duration),
    { parse_mode: 'HTML' }
  );

  try {
    // 1. Create or reuse customer account (NEVER admin)
    let userId = 1;
    const usersData = await panelApi('GET', '/users');
    const existing = usersData.data && usersData.data.find(u => u.attributes.email === customerEmail);
    if (existing) {
      userId = existing.attributes.id;
      await panelApi('PATCH', '/users/' + userId, {
        username: existing.attributes.username,
        email: existing.attributes.email,
        first_name: existing.attributes.first_name,
        last_name: existing.attributes.last_name,
        password: password,
        root_admin: false,
      });
    } else {
      const r = await panelApi('POST', '/users', {
        username: customerUsername,
        email: customerEmail,
        first_name: customerFirst,
        last_name: customerLast,
        password: password,
        root_admin: false,
      });
      if (r.attributes) userId = r.attributes.id;
      else { bot.sendMessage(chatId, '❌ Failed to create user: ' + JSON.stringify(r.errors || r)); return; }
    }

    // 2. Verify not admin (force remove if so)
    const verify = await panelApi('GET', '/users/' + userId);
    if (verify.attributes && verify.attributes.root_admin === true) {
      await panelApi('PATCH', '/users/' + userId, {
        username: verify.attributes.username,
        email: verify.attributes.email,
        first_name: verify.attributes.first_name,
        last_name: verify.attributes.last_name,
        password: password,
        root_admin: false,
      });
      bot.sendMessage(chatId, '⚠️ Fixed: Removed admin access from user ' + userId);
    }

    // 3. Find free allocation
    const nodesData = await panelApi('GET', '/nodes/1/allocations');
    const freeAlloc = nodesData.data && nodesData.data.find(a => a.attributes.assigned === false);
    if (!freeAlloc) { bot.sendMessage(chatId, '❌ No free ports available on the node.'); return; }

    // 4. Create the server with the chosen egg
    const serverData = {
      name: serverName,
      user: userId,
      nest: egg.nest_id,
      egg: egg.egg_id,
      docker_image: egg.docker_image,
      startup: egg.startup,
      environment: egg.environment,
      limits: { memory, swap: 0, disk, io: 500, cpu },
      feature_limits: { databases: 1, backups: 1, allocations: 0 },
      allocation: { default: freeAlloc.attributes.id },
      start_on_completion: true,
    };
    const result = await panelApi('POST', '/servers', serverData);

    if (result.attributes) {
      const s = result.attributes;
      let msg = '<b>✅ Server Created Successfully!</b>\n\n' +
        '<b>Name:</b> ' + esc(s.name) + '\n' +
        '<b>Type:</b> ' + egg.emoji + ' ' + esc(egg.label) + '\n' +
        '<b>ID:</b> ' + s.id + '\n' +
        '<b>Identifier:</b> <code>' + s.identifier + '</code>\n' +
        '<b>Plan:</b> ' + esc(planName) + ' (' + memory + 'MB/' + disk + 'MB/' + cpu + '%)\n' +
        '<b>Duration:</b> ' + esc(duration) + '\n\n' +
        '<b>📋 Customer Panel Login:</b>\n' +
        '  Email: <code>' + esc(customerEmail) + '</code>\n' +
        '  Password: <code>' + esc(password) + '</code>\n' +
        '<b>Panel URL:</b> <code>' + PANEL_URL + '</code>\n\n';

      // Egg-specific instructions
      if (eggKey === 'minecraft') {
        msg += '🎮 Players can connect once the Java server finishes loading. Check the console for "Done!".';
      } else if (eggKey === 'caltex_md') {
        msg += '🤖 <b>Next step:</b> Open the panel → click the server → Console tab → click Start.\n' +
               'When prompted, enter your WhatsApp phone number (with country code, e.g. 2547XXXXXXXX).\n' +
               'You will get a pairing code — enter it in WhatsApp → Settings → Linked Devices → Link with phone number.';
      } else if (eggKey === 'universal_node') {
        msg += '🟢 <b>Next step:</b> Upload your bot code via the Files tab (package.json + index.js or similar). The server will auto-run npm install and start your bot.';
      } else if (eggKey === 'universal_python') {
        msg += '🐍 <b>Next step:</b> Upload your bot.py + requirements.txt via the Files tab. The server will auto-run pip install -r requirements.txt and start your bot.';
      } else if (eggKey === 'whatsapp_baileys') {
        msg += '💬 <b>Next step:</b> Upload your Baileys bot code (package.json with @whiskeysockets/baileys + index.js). Start the server and enter your phone number in the console to get a pairing code.';
      } else if (eggKey === 'whatsapp_webjs') {
        msg += '🌐 <b>Next step:</b> Upload your whatsapp-web.js bot code. Start the server and a QR code will appear in the console — scan it with WhatsApp → Linked Devices.';
      }

      bot.sendMessage(chatId, msg, { parse_mode: 'HTML' });
    } else {
      bot.sendMessage(chatId, '❌ Failed to create server: ' + JSON.stringify(result.errors || result));
    }
  } catch (e) {
    bot.sendMessage(chatId, '❌ Error: ' + esc(e.message));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  CALLBACK QUERIES
// ─────────────────────────────────────────────────────────────────────────────
const PLAN_MAP = {
  basic:    { memory: 1024, disk: 5000,  cpu: 50,  planName: 'Basic (1GB/5GB/50%)' },
  standard: { memory: 2048, disk: 10000, cpu: 100, planName: 'Standard (2GB/10GB/100%)' },
  pro:      { memory: 4096, disk: 20000, cpu: 200, planName: 'Pro (4GB/20GB/200%)' },
  ultimate: { memory: 6144, disk: 40000, cpu: 300, planName: 'Ultimate (6GB/40GB/300%)' },
};
const DUR_MAP = { _7d: '7 Days', _14d: '14 Days', _1m: '1 Month' };

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  try {
    // ── Pick egg → show plan selector ──
    if (data.startsWith('pick_egg_')) {
      const eggKey = data.replace('pick_egg_', '');
      const egg = EGGS[eggKey];
      if (!egg) { await bot.answerCallbackQuery(query.id, { text: 'Unknown type.' }); return; }
      await bot.answerCallbackQuery(query.id);
      bot.sendMessage(chatId,
        '<b>' + egg.emoji + ' ' + esc(egg.label) + '</b>\n\n' +
        esc(egg.description) + '\n\n' +
        '<b>Step 2:</b> Choose plan + duration:',
        { parse_mode: 'HTML', ...planKeyboard(eggKey) }
      );
      return;
    }

    // ── Custom plan selector ──
    if (data.startsWith('custom_plan_')) {
      const eggKey = data.replace('custom_plan_', '');
      await bot.answerCallbackQuery(query.id);
      bot.sendMessage(chatId, '<b>📦 Choose a Custom Plan:</b>', { parse_mode: 'HTML', ...customPlanKeyboard(eggKey) });
      return;
    }

    // ── Final: plan_<eggKey>_<planKey>_<durKey> ──
    if (data.startsWith('plan_') && data !== 'plan_basic') {
      // format: plan_<eggKey>_<planKey>_<durKey>   e.g. plan_minecraft_basic_7d
      const rest = data.replace('plan_', '');
      // Find which eggKey matches the prefix
      let eggKey = null, planKey = null, durKey = null;
      for (const k of EGG_KEYS) {
        if (rest.startsWith(k + '_')) {
          eggKey = k;
          const leftover = rest.replace(k + '_', '');
          // leftover like "basic_7d" or "standard_14d"
          const m = leftover.match(/^(basic|standard|pro|ultimate)_(7d|14d|1m)$/);
          if (m) { planKey = m[1]; durKey = '_' + m[2]; }
          break;
        }
      }
      if (!eggKey || !planKey || !durKey) {
        await bot.answerCallbackQuery(query.id, { text: 'Invalid selection.' });
        return;
      }
      const planInfo = PLAN_MAP[planKey];
      const duration = DUR_MAP[durKey] || '7 Days';
      await bot.answerCallbackQuery(query.id, { text: 'Creating ' + EGGS[eggKey].label + ' ' + planInfo.planName + ' ' + duration + '...' });
      await createServer(chatId, eggKey, planInfo, duration);
      return;
    }

    // ── Main menu callbacks ──
    switch (data) {
      case 'list_servers': {
        const data2 = await panelApi('GET', '/servers');
        if (data2.data && data2.data.length > 0) {
          let text = '<b>🖥️ All Servers:</b>\n\n';
          for (const srv of data2.data) {
            const s = srv.attributes;
            let state = 'unknown';
            try {
              const res = await clientApi('GET', '/servers/' + s.identifier + '/resources');
              if (res.attributes) state = res.attributes.current_state;
            } catch (e) {}
            const emoji = state === 'running' ? '🟢' : '🔴';
            text += emoji + ' <b>' + esc(s.name) + '</b> (ID: ' + s.id + ')\n';
            text += '  RAM: ' + s.limits.memory + 'MB | Disk: ' + s.limits.disk + 'MB | CPU: ' + s.limits.cpu + '%\n';
            text += '  State: ' + state + '\n\n';
          }
          bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
        } else { bot.sendMessage(chatId, 'No servers found.'); }
        break;
      }
      case 'create_server': {
        let text = '<b>🚀 Create a New Server</b>\n\n<b>Step 1:</b> Choose what to deploy:\n\n';
        for (const k of EGG_KEYS) {
          const e = EGGS[k];
          text += e.emoji + ' <b>' + esc(e.label) + '</b>\n  ' + esc(e.description) + '\n\n';
        }
        bot.sendMessage(chatId, text, { parse_mode: 'HTML', ...eggSelectKeyboard() });
        break;
      }
      case 'delete_server': {
        const kb = await serverSelectKeyboard('deletesrv');
        if (!kb) { bot.sendMessage(chatId, '❌ No servers found.'); break; }
        bot.sendMessage(chatId, '<b>🗑️ Select a server to delete:</b>', { parse_mode: 'HTML', ...kb });
        break;
      }
      case 'start_server': {
        const kb = await serverSelectKeyboard('startsrv');
        if (!kb) { bot.sendMessage(chatId, '❌ No servers found.'); break; }
        bot.sendMessage(chatId, '<b>▶️ Select a server to start:</b>', { parse_mode: 'HTML', ...kb });
        break;
      }
      case 'stop_server': {
        const kb = await serverSelectKeyboard('stopsrv');
        if (!kb) { bot.sendMessage(chatId, '❌ No servers found.'); break; }
        bot.sendMessage(chatId, '<b>⏹️ Select a server to stop:</b>', { parse_mode: 'HTML', ...kb });
        break;
      }
      case 'restart_server': {
        const kb = await serverSelectKeyboard('restartsrv');
        if (!kb) { bot.sendMessage(chatId, '❌ No servers found.'); break; }
        bot.sendMessage(chatId, '<b>🔄 Select a server to restart:</b>', { parse_mode: 'HTML', ...kb });
        break;
      }
      case 'server_status': {
        const kb = await serverSelectKeyboard('status');
        if (!kb) { bot.sendMessage(chatId, '❌ No servers found.'); break; }
        bot.sendMessage(chatId, '<b>📊 Select a server to check:</b>', { parse_mode: 'HTML', ...kb });
        break;
      }
      case 'list_users': {
        const d = await panelApi('GET', '/users');
        if (d.data && d.data.length > 0) {
          let text = '<b>👥 Users:</b>\n\n';
          for (const u of d.data) {
            const a = u.attributes;
            text += '<b>ID:</b> ' + a.id + ' | ' + esc(a.username) + '\n';
            text += '  Email: ' + esc(a.email) + '\n';
            text += '  Name: ' + esc(a.first_name) + ' ' + esc(a.last_name) + '\n';
            text += '  Admin: ' + (a.root_admin ? '✅' : '❌') + '\n\n';
          }
          bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
        } else { bot.sendMessage(chatId, 'No users found.'); }
        break;
      }
      case 'node_info': {
        const d = await panelApi('GET', '/nodes');
        if (d.data && d.data.length > 0) {
          let text = '<b>📡 Nodes:</b>\n\n';
          for (const n of d.data) {
            const a = n.attributes;
            text += '<b>' + esc(a.name) + '</b> (ID: ' + a.id + ')\n';
            text += '  FQDN: ' + esc(a.fqdn) + '\n';
            text += '  Memory: ' + a.memory + 'MB (allocated: ' + a.allocated_resources.memory + 'MB)\n';
            text += '  Disk: ' + a.disk + 'MB (allocated: ' + a.allocated_resources.disk + 'MB)\n';
            text += '  Daemon Port: ' + a.daemon_listen + '\n';
            text += '  Maintenance: ' + (a.maintenance_mode ? 'Yes' : 'No') + '\n\n';
          }
          bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
        }
        break;
      }
      default:
        // ── Server action callbacks (startsrv_3, stopsrv_3, etc.) ──
        if (data.startsWith('startsrv_')) {
          const sid = data.replace('startsrv_', '');
          const id = await getServerIdentifier(sid);
          if (id) { await clientApi('POST', '/servers/' + id + '/power', { signal: 'start' }); bot.sendMessage(chatId, '▶️ Starting server ID ' + sid + '...'); }
          else { bot.sendMessage(chatId, '❌ Server not found.'); }
        } else if (data.startsWith('stopsrv_')) {
          const sid = data.replace('stopsrv_', '');
          const id = await getServerIdentifier(sid);
          if (id) { await clientApi('POST', '/servers/' + id + '/power', { signal: 'stop' }); bot.sendMessage(chatId, '⏹️ Stopping server ID ' + sid + '...'); }
          else { bot.sendMessage(chatId, '❌ Server not found.'); }
        } else if (data.startsWith('restartsrv_')) {
          const sid = data.replace('restartsrv_', '');
          const id = await getServerIdentifier(sid);
          if (id) { await clientApi('POST', '/servers/' + id + '/power', { signal: 'restart' }); bot.sendMessage(chatId, '🔄 Restarting server ID ' + sid + '...'); }
          else { bot.sendMessage(chatId, '❌ Server not found.'); }
        } else if (data.startsWith('killsrv_')) {
          const sid = data.replace('killsrv_', '');
          const id = await getServerIdentifier(sid);
          if (id) { await clientApi('POST', '/servers/' + id + '/power', { signal: 'kill' }); bot.sendMessage(chatId, '💀 Killing server ID ' + sid + '...'); }
          else { bot.sendMessage(chatId, '❌ Server not found.'); }
        } else if (data.startsWith('deletesrv_')) {
          const sid = data.replace('deletesrv_', '');
          const info = await panelApi('GET', '/servers/' + sid);
          const name = info.attributes ? info.attributes.name : sid;
          bot.sendMessage(chatId, '⚠️ Are you sure you want to delete <b>' + esc(name) + '</b> (ID: ' + sid + ')?', {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [
              [{ text: '✅ Yes, Delete', callback_data: 'confirm_delete_' + sid }],
              [{ text: '❌ Cancel', callback_data: 'cancel_action' }],
            ]}
          });
        } else if (data.startsWith('status_')) {
          const sid = data.replace('status_', '');
          const sData = await panelApi('GET', '/servers/' + sid);
          const s = sData.attributes;
          if (!s) { bot.sendMessage(chatId, '❌ Server not found.'); break; }
          let state = 'unknown'; let resData = null;
          try {
            resData = await clientApi('GET', '/servers/' + s.identifier + '/resources');
            if (resData.attributes) state = resData.attributes.current_state;
          } catch (e) {}
          const emoji = state === 'running' ? '🟢' : '🔴';
          let text = '<b>📊 Server Status</b>\n\n';
          text += '<b>Name:</b> ' + esc(s.name) + '\n';
          text += '<b>ID:</b> ' + s.id + '\n';
          text += '<b>State:</b> ' + emoji + ' ' + state + '\n';
          text += '<b>RAM:</b> ' + s.limits.memory + 'MB | Disk: ' + s.limits.disk + 'MB | CPU: ' + s.limits.cpu + '%\n';
          if (resData && resData.attributes && resData.attributes.resources) {
            const r = resData.attributes.resources;
            const memMB = (r.memory_bytes / 1024 / 1024).toFixed(1);
            text += '\n<b>Live:</b> Memory: ' + memMB + 'MB | CPU: ' + r.cpu_absolute + '%';
          }
          bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
        } else if (data.startsWith('resources_')) {
          const sid = data.replace('resources_', '');
          const id = await getServerIdentifier(sid);
          if (id) {
            const resData = await clientApi('GET', '/servers/' + id + '/resources');
            if (resData.attributes) {
              const r = resData.attributes.resources;
              const memMB = (r.memory_bytes / 1024 / 1024).toFixed(1);
              const diskMB = (r.disk_bytes / 1024 / 1024).toFixed(1);
              let text = '<b>📊 Resources for Server ' + sid + ':</b>\n\n';
              text += 'Memory: ' + memMB + 'MB\n';
              text += 'Disk: ' + diskMB + 'MB\n';
              text += 'CPU: ' + r.cpu_absolute + '%\n';
              text += 'Network RX: ' + (r.network_rx_bytes / 1024).toFixed(1) + 'KB\n';
              text += 'Network TX: ' + (r.network_tx_bytes / 1024).toFixed(1) + 'KB\n';
              text += 'Uptime: ' + Math.floor(r.uptime / 1000) + 's';
              bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
            }
          }
        } else if (data.startsWith('confirm_delete_')) {
          const sid = data.replace('confirm_delete_', '');
          await panelApi('DELETE', '/servers/' + sid);
          bot.sendMessage(chatId, '✅ Server ' + sid + ' has been deleted.');
        } else if (data === 'cancel_action') {
          bot.sendMessage(chatId, '❌ Action cancelled.');
        }
        break;
    }
  } catch (e) {
    bot.sendMessage(chatId, '❌ Error: ' + esc(e.message));
  }

  bot.answerCallbackQuery(query.id);
});

console.log('Bot is ready and listening for messages...');
