# Pterodactyl Eggs — Generic / Universal Bots

This directory contains **generic Pterodactyl eggs** that can run **ANY** WhatsApp bot
(or any other Node.js/Python bot) — not just CALTEX-MD.

## Available Eggs

| Egg Name | Use Case | Languages |
|----------|----------|-----------|
| **Universal Node.js Bot** | Any Node.js bot (WhatsApp / Telegram / Discord / Slack / IRC) | JS / TS |
| **Universal Python Bot** | Any Python bot (WhatsApp / Telegram / Discord / Slack / IRC) | Python 3.10+ |
| **WhatsApp Bot (Baileys)** | Any `@whiskeysockets/baileys` based WhatsApp bot | JS / TS |
| **WhatsApp Bot (whatsapp-web.js)** | Any `whatsapp-web.js` (Puppeteer) based WhatsApp bot | JS / TS |

## How each egg works

Each egg ships with a **universal startup script** that:

1. Validates the runtime (Node.js or Python) is present in the Docker image.
2. Auto-installs dependencies:
   - Node.js: `npm install` if `package.json` exists.
   - Python: `pip install -r requirements.txt` (or Pipfile / pyproject.toml).
3. **Auto-detects the entry file** (no need to configure it manually):
   - Node.js: `STARTUP_FILE` env var → `package.json` `start` script → `index.ts` / `index.js` / `bot.ts` / `bot.js` / `app.ts` / `app.js` / `main.ts` / `main.js` / `src/index.ts` / etc.
   - Python: `STARTUP_FILE` env var → `main.py` / `bot.py` / `app.py` / `run.py` / `start.py` / `src/main.py` / `src/bot.py`.
4. Runs the bot with auto-restart on crash (exponential backoff, configurable via `MAX_RETRIES` and `BASE_DELAY` env vars).

## Installation

### Option A — Import via Pterodactyl panel UI

1. Log in to the panel as admin.
2. Go to **Nests** → **Bots & Software** (or any nest you want).
3. Click **Import Egg**.
4. Upload the `.json` file for the egg you want.
5. (Pterodactyl auto-uploads the matching `.sh` startup script via the egg's install hook.)

### Option B — Import via MySQL (advanced)

If you have direct DB access (e.g. for automation), you can insert the egg
directly into the `eggs` and `egg_variables` tables. See
`scripts/import_generic_eggs_v2.py` for an example.

## Docker Images

The eggs support multiple Yolks images:

- **Alpine** (`ghcr.io/pterodactyl/yolks:nodejs_20`, `python_3_11`) — small footprint, `sh` shell.
- **Debian** (`ghcr.io/pterodactyl/yolks:node_20`, `node_18`) — has `bash`, full glibc, **recommended for whatsapp-web.js / Puppeteer**.

The startup scripts are POSIX-`sh`-compatible — they work on both Alpine and Debian.

## Environment Variables (all eggs)

| Var | Default | Description |
|-----|---------|-------------|
| `STARTUP_FILE` | _(auto-detect)_ | Override the entry file (e.g. `src/bot.ts`). |
| `MAX_RETRIES` | `10` | Auto-restart attempts before giving up. |
| `BASE_DELAY` | `5` | Initial restart delay (seconds). Doubles each retry, capped at 300s. |

### WhatsApp Bot (Baileys) extras

| Var | Default | Description |
|-----|---------|-------------|
| `BOT_PHONE` | _(empty)_ | Phone number for pairing code (e.g. `254712345678`). |
| `BOT_OWNER` | _(empty)_ | Owner phone for permissions. |
| `BOT_PREFIX` | `.` | Command prefix. |
| `BOT_NAME` | `My WhatsApp Bot` | Linked-device display name. |
| `BOT_SESSION_ID` | `default` | Session identifier (used by some frameworks). |
| `LOG_LEVEL` | `warn` | `debug`/`info`/`warn`/`error`. |

### WhatsApp Bot (whatsapp-web.js) extras

| Var | Default | Description |
|-----|---------|-------------|
| `BOT_OWNER` | _(empty)_ | Owner phone (if your bot uses it). |
| `BOT_PREFIX` | `!` | Command prefix. |
| `PUPPETEER_EXECUTABLE_PATH` | _(auto-detect)_ | Override Chromium path. |

## Creating a New Server With a Generic Egg

1. In the Pterodactyl panel, go to **Servers** → **Create Server**.
2. Pick the **Universal Node.js Bot** (or other generic) egg.
3. Set the resource limits (512 MB RAM is enough for most bots).
4. Set the Docker image (use Debian if your bot uses Puppeteer).
5. After the server is created, **upload your bot files** to the server via the
   panel's File Manager (or SFTP).
6. Set any required env vars (e.g. `BOT_PHONE` for WhatsApp bots) on the
   **Startup** tab.
7. Click **Start**. The egg will auto-detect your entry file and run it.

## Why this is better than a single-purpose egg

- **No code changes needed** when you switch bot frameworks. Just upload the new
  bot's files and the egg handles the rest.
- **Works with any framework**: Baileys, whatsapp-web.js, telegraf, discord.js,
  python-telegram-bot, discord.py, slack-bolt, IRC bots, custom scripts, etc.
- **No "this egg only works for X" lock-in**. You can host any Node.js or Python
  bot on the same Pterodactyl panel without needing to install new eggs.
- **The startup script auto-adapts**: detects TypeScript vs JavaScript, detects
  package.json scripts, detects the right Python venv, etc.
