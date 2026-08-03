# CALTEX Admin Bot

A **single-process Telegram + WhatsApp bridge** for the CALTEX panel.

## What it does

1. You (the admin) message it on Telegram with `/link <phone>`
2. It requests a WhatsApp pairing code via Baileys
3. The code is sent back to you in Telegram
4. You enter the code in WhatsApp → Settings → Linked Devices → Link with phone number
5. A popup appears in WhatsApp confirming the link
6. From now on, anyone who messages your WhatsApp number gets auto-replies to commands:
   - `.menu` / `.help` — show WhatsApp commands
   - `.ping` — Pong! 🏓
   - `.info` — bot info
   - `.alive` — alive check
   - `.time` — current time
   - `.owner` — owner info
   - `.jid` — your WhatsApp JID

## Telegram admin commands

```
/start           — welcome + how it works
/help            — command list
/link <phone>    — link a WhatsApp number (e.g. /link 254712345678)
/status          — WhatsApp connection status
/unlink          — disconnect WhatsApp
/menu            — show the WhatsApp-side command menu
```

## Configuration

Environment variables (set in the Pterodactyl panel → Startup tab):

| Var | Required | Description |
|-----|----------|-------------|
| `BOT_TOKEN` | ✅ | Telegram bot token from @BotFather |
| `ADMIN_CHAT_ID` | ❌ | Optional. If set, only this Telegram chat ID can use the bot |

If `ADMIN_CHAT_ID` is not set, anyone who finds the bot token can use it. To find your chat ID, message [@userinfobot](https://t.me/userinfobot) on Telegram.

## Session persistence

The WhatsApp session is saved in `./auth_info_baileys/` inside the container. After a container restart, the bot reconnects automatically — no need to re-pair.

If you `/unlink` from Telegram, the auth state is wiped and a fresh pairing is required.

## Deployment

This bot runs as a Pterodactyl server using the **Universal Node.js Bot** egg (id=16).

- Docker image: `ghcr.io/pterodactyl/yolks:nodejs_20`
- Startup: `/bin/sh /home/container/universal-node-start.sh`
- The universal start script auto-runs `npm install` then `node index.js`

## Files

```
index.js         — the bot (single file, ~400 lines)
package.json     — deps: node-telegram-bot-api, @whiskeysockets/baileys, pino, @hapi/boom
auth_info_baileys/  — created at runtime, stores the WhatsApp session
```

## Rate-limit handling

If WhatsApp returns 401/loggedOut (you removed the device from your phone) or 410 (rate-limited), the bot:
- Prints a clear message to Telegram
- Wipes the auth state (on loggedOut)
- Does NOT auto-retry (which would worsen the rate-limit)
- Waits for you to issue `/link <phone>` again manually

## Extending the WhatsApp commands

Edit `handleIncomingWhatsAppMessage()` in `index.js` and add a new `case 'yourcmd':` block. Restart the container to apply.
