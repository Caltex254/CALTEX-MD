# CALTEX MD Bot — Pterodactyl Deployment Guide

This guide explains how to deploy the CALTEX MD WhatsApp bot on a Pterodactyl panel. The bot supports **three connection modes** and will auto-detect the right one at startup.

---

## ⚠️ FIX: "Error: Unable to access jarfile server.jar"

If your Pterodactyl console shows anything like this:

```
openjdk version "25.0.3"
java -Xms128M -XX:MaxRAMPercentage=95.0 -Dterminal.jline=false -Dterminal.ansi=true -jar server.jar
Error: Unable to access jarfile server.jar
```

…then **your server was created with the WRONG egg** (a Java/Minecraft egg). CALTEX MD is a **Node.js + TypeScript + Baileys** bot — it does NOT use Java, does NOT use `server.jar`, and does NOT use a Minecraft egg.

**To fix this you MUST recreate the server with the correct egg.** Pterodactyl does not let you swap eggs on an existing server, so follow the full Quick Start below. In particular:

1. Import the CALTEX MD egg (`egg-caltex-bot.json` from this repo) into your panel.
2. Create a NEW server using that egg (do NOT reuse the Minecraft server).
3. Make sure the Docker image is `ghcr.io/pterodactyl/yolks:node_20`.
4. Make sure the startup command is `bash pterodactyl-start.sh`.
5. Set `BOT_OWNER` to your phone number.
6. Start the server.

The startup logs you SHOULD see are listed in the "What successful startup logs look like" section at the bottom of this guide.

---

## Quick Start (Recommended)

The simplest deployment: just set `BOT_OWNER` to your phone number and start the server. The bot will generate a pairing code on first start — no separate session API or dashboard needed.

### Step 1 — Import the Egg

1. Go to your Pterodactyl admin panel → **Nests** → **Import Egg**
2. Upload `egg-caltex-bot.json` from this repo
3. Assign it to a nest (create one called "WhatsApp Bots" if needed)

### Step 2 — Create a Server

1. Go to **Servers** → **Create New**
2. Select the CALTEX MD egg
3. Set the following:
   - **Docker image**: `Node 20` (ghcr.io/pterodactyl/yolks:node_20)
   - **Memory**: 512 MB minimum, 1024 MB recommended
   - **Disk**: 1024 MB minimum (more if you process lots of media)
   - **Swap**: 0 MB (or 256 MB if you see OOM crashes)
4. Click **Create**

### Step 3 — Upload Bot Files

The egg's installation script will automatically clone the repo and copy the bot files to `/home/container/`. If you prefer to upload manually:

1. Download the contents of `mini-services/caltex-bot/` from this repo
2. Also download `pterodactyl-start.sh` from the repo root
3. Upload everything to `/home/container/` via the Pterodactyl file manager
4. Make sure `pterodactyl-start.sh` is at `/home/container/pterodactyl-start.sh`

### Step 4 — Configure Environment Variables

Go to the server's **Startup** tab and set:

| Variable | Required? | Example | Description |
|----------|-----------|---------|-------------|
| `BOT_OWNER` | **Yes** | `254712345678` | Your phone number in international format (no `+` or spaces). Used for owner-only commands AND as the default phone number for the pairing code flow. |
| `BOT_SESSION_ID` | No | (leave blank) | Leave blank on first start to use the pairing code flow. Set to `CALTEX-XXXX-XXXX` only if you want to restore creds from GitHub (legacy mode). |
| `GITHUB_TOKEN` | No | (leave blank) | Only needed for GitHub credential restore (legacy). |
| `GITHUB_REPO_OWNER` | No | `Caltex254` | Only needed for GitHub credential restore (legacy). |
| `GITHUB_REPO_NAME` | No | `caltex-sessions` | Only needed for GitHub credential restore (legacy). |
| `BOT_NAME` | No | `CALTEX MD` | Display name shown in WhatsApp's Linked Devices list. |
| `BOT_PREFIX` | No | `.` | Command prefix. Use `.` for `.menu`, `!` for `!menu`, etc. |
| `AUTO_READ` | No | `false` | `true` to auto-mark incoming messages as read. |
| `AUTO_TYPING` | No | `false` | `true` to show typing indicator when processing messages. |
| `ANTI_LINK` | No | `false` | `true` to delete messages containing links in groups. |
| `LOG_LEVEL` | No | `info` | Logging verbosity: `debug`, `info`, `warn`, `error`. |

### Step 5 — Start the Server

1. Click **Start** in the Pterodactyl panel
2. Watch the console — within ~5 seconds you should see:

```
[2025-XX-XX HH:MM:SS] INFO (main): HTTP server listening on port XXXX
[STARTUP] No existing credentials found — entering interactive pairing mode.
[STARTUP] BOT_OWNER env var detected — using it as phone number for pairing

  ╔══════════════════════════════════════════════════════════════╗
  ║          CALTEX MD — WHATSAPP PAIRING CODE                   ║
  ║          Phone:  254712345678                                ║
  ║          Code:   ABCD1234                                    ║
  ║   1. Open WhatsApp on your phone                             ║
  ║   2. Go to Settings → Linked Devices                         ║
  ║   3. Tap "Link a Device"                                     ║
  ║   4. Tap "Link with phone number instead"                    ║
  ║   5. Enter the code above: ABCD1234                          ║
  ╚══════════════════════════════════════════════════════════════╝
```

### Step 6 — Enter the Pairing Code in WhatsApp

1. Open **WhatsApp** on your phone (the one matching the `BOT_OWNER` number)
2. Tap **Settings** (iOS) or the **three dots menu** (Android) → **Linked Devices**
3. Tap **Link a Device**
4. Tap **Link with phone number instead** (do NOT scan a QR code)
5. Enter the 8-character pairing code shown in the Pterodactyl console
6. Wait ~3 seconds — you should see in the console:

```
[PAIRING] connection.open — WhatsApp paired successfully, bot is now an active linked device
```

7. You'll receive a WhatsApp message from yourself saying **"BOT CONNECTED SUCCESSFULLY"**

### Step 7 — Test Commands

Send any of these commands to yourself (or in a group where the bot is a member):

- `.ping` — Check if the bot is alive (replies with "🏓 Pong!")
- `.help` — Show all available commands
- `.info` — Show bot information
- `.ai <question>` — Chat with AI (requires AI API key, see below)
- `.sticker` (reply to an image) — Convert image to sticker

The bot will reply automatically. Commands are prefixed with `.` by default (configurable via `BOT_PREFIX`).

## What Happens on Restart?

After the first successful pairing, the bot saves credentials locally to `/home/container/auth_info_baileys/<sessionId>/`. On subsequent restarts:

1. The bot detects local credentials exist
2. Auto-connects in **Mode A** (no pairing code needed)
3. You'll see in the console:

```
[STARTUP] Auto-connecting with existing credentials...
[LIFECYCLE] Local credentials found - skipping GitHub restore
[LIFECYCLE] connection.open — WhatsApp connection established
```

If you ever need to re-pair (e.g. you logged out of the linked device on your phone), just delete the `auth_info_baileys` folder via the Pterodactyl file manager and restart the server.

## Connection Modes Reference

| Mode | Trigger | Behavior |
|------|---------|----------|
| **A — Auto-connect** | Local creds exist at `auth_info_baileys/<sessionId>/creds.json` | Bot connects directly, no pairing needed. |
| **B — GitHub restore (legacy)** | `BOT_SESSION_ID=CALTEX-XXXX-XXXX` AND `GITHUB_TOKEN` set | Bot downloads creds from GitHub, then connects. |
| **C — Interactive pairing (new)** | No local creds, no valid CALTEX ID | Bot uses `BOT_OWNER` env var (or prompts via stdin) for phone number, generates pairing code, displays it in console. |

## Optional: Enable AI Commands

The `.ai`, `.translate`, and `.summarize` commands require an AI API key. To enable them:

1. Get an API key from OpenAI, Google Gemini, Anthropic Claude, or any OpenAI-compatible provider
2. Create a file called `ai-config.json` in `/home/container/` with the following content:

```json
{
  "provider": "openai",
  "openai": {
    "apiKey": "sk-...",
    "model": "gpt-4o-mini"
  }
}
```

3. Restart the server

Alternatively, use the dashboard's API: `PUT /api/config/ai` with the same JSON body.

## Troubleshooting

### "BOT_OWNER is not set" error

Set `BOT_OWNER` in the **Startup** tab of your Pterodactyl server. It must be your phone number in international format (e.g. `254712345678` for Kenya, `447123456789` for UK).

### Pairing code doesn't appear

Check the console for these logs:
- `[PAIRING] Fetched latest Baileys version` — confirms internet access
- `[PAIRING] Creating WhatsApp connection for pairing code flow` — confirms socket creation
- `connected to WA` — confirms WhatsApp server connection
- `[PAIRING] QR event received` — confirms Baileys is ready for pairing

If you don't see `connected to WA` within 30 seconds, your Pterodactyl server might be blocking outgoing WebSocket connections. Check your host's firewall.

### Pairing code expired

Pairing codes are valid for ~60 seconds. If it expires, just restart the server to get a new one.

### Bot doesn't reply to commands

1. Verify the bot is connected: `GET http://localhost:<PORT>/health`
2. Check the command prefix — if you set `BOT_PREFIX=!`, use `!ping` not `.ping`
3. Check you're listed as owner: `BOT_OWNER` env var must match your phone number
4. Check the logs for `[LIFECYCLE] connection.open` — without this, the bot isn't actually connected

### "Cannot find module 'sharp'" error

Restart the server — the install script will reinstall dependencies. If it persists, manually run `npm install` via the Pterodactyl console.

### Port already in use

Pterodactyl auto-assigns `SERVER_PORT`. Don't manually set `PORT` in your env vars.

### Want to reset everything

1. Stop the server
2. Delete these files/folders via the Pterodactyl file manager:
   - `auth_info_baileys/`
   - `bot-config.json`
   - `anti-config.json`
   - `ai-config.json`
   - `bot.log`
3. Restart the server — it will enter first-time setup again

## Logs

Bot logs are written to two places:
- **Pterodactyl console** (stdout) — pretty-formatted, real-time
- **`/home/container/bot.log`** — raw JSON, useful for debugging

Set `LOG_LEVEL=debug` in the Startup tab to see more verbose logs.

## File Structure on Pterodactyl

After deployment, your `/home/container/` will contain:

```
/home/container/
├── index.ts                      # Main entry point
├── package.json                  # Dependencies
├── pterodactyl-start.sh          # Startup script (used by egg)
├── src/
│   ├── connection.ts             # WhatsApp connection manager (Baileys)
│   ├── message-handler.ts        # Command parsing & dispatch
│   ├── session-manager.ts        # Session persistence
│   ├── anti-features.ts          # Anti-link, anti-spam, etc.
│   ├── media-handler.ts          # Stickers, image processing
│   ├── ai-handler.ts             # AI integration
│   ├── group-manager.ts          # Group admin commands
│   ├── scheduler.ts              # Scheduled messages
│   ├── api-client.ts             # Reports to dashboard (optional)
│   ├── github-storage.ts         # GitHub credential storage (legacy)
│   └── types.ts                  # TypeScript types
├── auth_info_baileys/            # ← created after first pairing
│   └── caltex-md/
│       ├── creds.json            # WhatsApp credentials
│       └── app-state-sync-key-*.json
├── bot-config.json               # ← created when you change config via API
├── anti-config.json              # ← created when you change anti-feature config
├── ai-config.json                # ← you create this to enable AI commands
└── bot.log                       # ← created at runtime
```

## Updating the Bot

To update to a new version:

1. Stop the server
2. Delete `index.ts`, `src/`, and `package.json` (keep `auth_info_baileys/`, `*-config.json`, and `bot.log`)
3. Upload the new `index.ts`, `src/`, and `package.json` from `mini-services/caltex-bot/`
4. Upload the new `pterodactyl-start.sh` from the repo root
5. Start the server — dependencies will auto-install

Your existing WhatsApp session (in `auth_info_baileys/`) will be preserved, so you won't need to re-pair.

---

## What successful startup logs look like

When everything is configured correctly, your Pterodactyl console should print something like this on **first start** (no existing credentials):

```
==========================================
  CALTEX MD Bot - Pterodactyl Startup
==========================================
[...] Container working directory: /home/container
[...] Node version: v20.x.x
[...] npm version:  10.x.x
[...] SERVER_PORT: 12345
[...] BOT_OWNER: ***set*** (value hidden for security)
[...] BOT_SESSION_ID: (not set — will use interactive pairing)
[...] GITHUB_TOKEN: (not set — optional)

[...] node_modules not found — running 'npm install'...
[...] Dependencies installed successfully.

==========================================
  Starting CALTEX MD Bot...
  Runtime: Node.js v20.x.x + tsx
  Entry:   index.ts
==========================================

[...] INFO (main): HTTP server listening on port 12345
[...] INFO: ==================================================
[...] INFO:   CALTEX MD WhatsApp Bot - Starting...
[...] INFO: ==================================================
[...] INFO: [STARTUP] Mode detection
    sessionId: "caltex-md"
    isCaltexId: false
    hasLocalCreds: false
    hasGithubEnv: false
    hasBotOwner: true
[...] INFO: HTTP server listening on port 12345
[...] INFO: [STARTUP] No existing credentials found — entering interactive pairing mode.
[...] INFO: [STARTUP] BOT_OWNER env var detected — using it as phone number for pairing
[...] INFO: [PAIRING] Starting interactive pairing code flow...
[...] INFO: [PAIRING] Fetched latest Baileys version
[...] INFO: [PAIRING] Creating WhatsApp connection for pairing code flow
[...] INFO: [PAIRING] connection.update event received
[...] INFO: [PAIRING] QR event received — pairing code will be requested instead of QR display

╔══════════════════════════════════════════════════════════════╗
║          CALTEX MD — WHATSAPP PAIRING CODE                   ║
║          Phone:  254712345678                                ║
║          Code:   ABCD-1234                                   ║
║   1. Open WhatsApp on your phone                             ║
║   2. Go to Settings → Linked Devices                         ║
║   3. Tap "Link a Device"                                     ║
║   4. Tap "Link with phone number instead"                    ║
║   5. Enter the code above: ABCD-1234                         ║
╚══════════════════════════════════════════════════════════════╝
```

After you enter the code on your phone:

```
[...] INFO: [PAIRING] connection.open — WhatsApp paired successfully, bot is now an active linked device
[...] INFO: WhatsApp success message sent to linked account
```

You'll also receive a WhatsApp message from yourself saying **"BOT CONNECTED SUCCESSFULLY"**.

On **subsequent restarts** (credentials already saved locally), the log is much shorter:

```
[...] INFO: [STARTUP] Mode detection
    hasLocalCreds: true
[...] INFO: [STARTUP] Auto-connecting with existing credentials...
[...] INFO: [LIFECYCLE] Local credentials found - skipping GitHub restore
[...] INFO: [LIFECYCLE] connection.open — WhatsApp connection established
```

No pairing code is needed on restart — the bot reconnects automatically.

### What FAILURE looks like (and how to fix it)

| Console output | Meaning | Fix |
|----------------|---------|-----|
| `openjdk version ...` / `Error: Unable to access jarfile server.jar` | Wrong egg — Java/Minecraft egg selected | Recreate server with `egg-caltex-bot.json` (see top of this guide) |
| `[FATAL] Node.js runtime not found in this container.` | Docker image is not Node.js | Change Docker image to `ghcr.io/pterodactyl/yolks:node_20` |
| `[FATAL] BOT_OWNER is not set.` | Required env var missing | Set `BOT_OWNER` in the Startup tab |
| `[FATAL] index.ts not found` | Bot files not uploaded | Upload contents of `mini-services/caltex-bot/` to `/home/container/` |
| `[FATAL] @whiskeysockets/baileys is not installed.` | Dependency install failed | Stop server, delete `node_modules/`, start again |
| `npm install` hangs or fails | Network issue or out of disk | Check disk space in Pterodactyl; check container egress |
| No pairing code after 60s | WebSocket egress blocked | Check host firewall allows outgoing port 443 |

