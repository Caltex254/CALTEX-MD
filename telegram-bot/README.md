# CALTEX PANEL Telegram Bot

This is the **management bot** that lets you create and control Pterodactyl servers from Telegram.

## What it does

When users message this Telegram bot, they can:
- Create new servers (any of the supported egg types below)
- Start / stop / restart / kill / delete existing servers
- View server status, resource usage, user list, node info

## Supported egg types (v2)

When a user runs `/createsrv`, they pick from one of these:

| Egg | Description | Docker image |
|-----|-------------|--------------|
| 🎮 Minecraft Paper | Minecraft Java server with PaperMC | `ghcr.io/pterodactyl/yolks:java_25` |
| 🤖 CALTEX MD WhatsApp Bot | Full CALTEX-MD WhatsApp bot | `ghcr.io/pterodactyl/yolks:nodejs_20` |
| 🟢 Universal Node.js Bot | ANY Node.js bot (auto-detects entry) | `ghcr.io/pterodactyl/yolks:nodejs_20` |
| 🐍 Universal Python Bot | ANY Python bot (auto-installs requirements.txt) | `ghcr.io/pterodactyl/yolks:python_3.11` |
| 💬 WhatsApp Bot (Baileys) | Universal WhatsApp bot using @whiskeysockets/baileys | `ghcr.io/pterodactyl/yolks:nodejs_20` |
| 🌐 WhatsApp Bot (whatsapp-web.js) | Universal WhatsApp bot using Puppeteer | `ghcr.io/pterodactyl/yolks:nodejs_20` |

## Bot commands

```
/start        — Welcome + supported types
/menu         — Main menu (inline buttons)
/createsrv    — Create a server (pick egg → plan → duration)
/servers      — List all servers
/startsrv     — Start a server
/stopsrv      — Stop a server
/restartsrv   — Restart a server
/killsrv      — Kill a server
/deletesrv    — Delete a server
/status       — Server status
/resources    — Server resource usage
/users        — List panel users
/node         — Node info
```

## Configuration (hardcoded in index.js)

| Var | Value |
|-----|-------|
| `BOT_TOKEN` | Telegram bot token from @BotFather |
| `PANEL_URL` | `https://caltexpanel.kenya.qzz.io` |
| `API_KEY` | Panel Application API key (`ptla_...`) |
| `CLIENT_API_KEY` | Panel Client API key (`ptlc_...`) |

## Deploy

The bot runs as a Pterodactyl server itself (egg=Paper is reused as a generic Node.js runtime — the docker_image was overridden to `pterodactyl-node:20-alpine`).

To update the bot code:
1. Edit `index.js` in this folder
2. Upload it to the panel server's volume: `/var/lib/pterodactyl/volumes/e31a4289-6828-4a46-bcd7-ce494c80ed5e/index.js`
3. Restart the container: `docker restart e31a4289-6828-4a46-bcd7-ce494c80ed5e`

## Security model

- Only `admin@caltexpanel.com` has admin access on the panel
- Every server created via Telegram gets its OWN non-admin customer account (`caltex1@caltexpanel.com`, `caltex2@...`, etc.)
- The bot FORCES `root_admin: false` on every customer account it creates — even if it already existed
