<div align="center">

# ☠️ CALTEX MD

**WhatsApp Multi-Device Bot** — AI integration, plugin system, and web dashboard.

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/caltex-md/caltex-md)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/docker-ready-2496ED.svg)](./Dockerfile)

</div>

---

## Quick Start

### Prerequisites

- **Node.js** >= 20 or **Bun** >= 1.0
- A WhatsApp account with an active phone number
- (Optional) AI provider API keys for AI features

### Install & Run

```bash
git clone https://github.com/caltex-md/caltex-md.git
cd caltex-md
npm install
cp .env.example .env        # Edit with your config
npx prisma db push
npx prisma generate
npm run build
npm start
```

### Docker

```bash
docker compose up -d
```

---

## 🔗 Link WhatsApp

After starting the bot, link it to WhatsApp using one of two methods:

### Method 1: QR Code

1. Open **WhatsApp** > **Settings** > **Linked Devices** > **Link a Device**
2. Scan the QR code displayed in the terminal or at `http://localhost:3000`

### Method 2: Pairing Code (No QR Scanning)

1. Open the Dashboard at `http://localhost:3000` > **Pairing Code** panel
2. Enter your phone number **with country code, no +** (e.g., `254712345678`)
3. Click **Request Pairing Code**
4. On your phone: **WhatsApp** > **Settings** > **Linked Devices** > **Link with Phone Number**
5. Enter the code

**Via API:**
```bash
curl -X POST http://localhost:3000/api/pairing-code \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"254712345678"}'
```

After linking, the terminal shows **Connected** and the Dashboard shows **Online**.

---

## Configuration

Environment variables in `.env`:

| Variable | Description | Default |
|---|---|---|
| `PORT` | Dashboard port | `3000` |
| `DATABASE_URL` | SQLite database path | `file:./data/caltex.db` |
| `BOT_API_URL` | Bot service URL | `http://localhost:3031` |
| `WS_URL` | WebSocket service URL | `http://localhost:3003` |
| `NEXTAUTH_SECRET` | NextAuth secret key | `change-me-in-production` |
| `JWT_SECRET` | JWT signing secret | `caltex-md-bot-secret-key-2024` |
| `ADMIN_USER` | Dashboard admin username | `admin` |
| `ADMIN_PASS` | Dashboard admin password | `admin123` |

Bot and AI config can also be managed from the dashboard at `http://localhost:3000`.

---

## Commands

Prefix is configurable (default `!`). **125+ commands** across 15 categories:

| Category | Key Commands | Count |
|---|---|---|
| **General** | `!ping`, `!help`, `!menu`, `!runtime`, `!system`, `!health`, `!speed`, `!owner`, `!repo` | 14 |
| **AI** | `!ai`, `!aiimage`, `!aicode`, `!aitranslate`, `!aisummarize`, `!airewrite`, `!aiexplain` | 8 |
| **Bug Menu ☠️** | `!bug1`–`!bug20` (owner-only attacks: crash loop, vcard, sticker, audio, reaction bomb, mention bomb, force stop combo, etc.) | 20 |
| **Download** | `!yta`, `!ytv`, `!ig`, `!tiktok`, `!fb`, `!twitter` | 7 |
| **Group Admin** | `!groupinfo`, `!promote`, `!demote`, `!mute`, `!unmute` | 5 |
| **Moderation** | `!antilink`, `!antibadword`, `!antispam`, `!antidelete`, `!antiviewonce`, `!anticall`, `!warn`, `!tagall`, `!hidetag`, `!welcome`, `!goodbye` | 16 |
| **Fun** | `!joke`, `!quote`, `!fact`, `!8ball`, `!roll`, `!flip`, `!rps`, `!trivia`, `!meme` | 9 |
| **Analytics** | `!stats`, `!botstats`, `!groupstats`, `!userstats`, `!gstats`, `!gactivity`, `!gtop` | 7 |
| **Premium** | `!premium`, `!addpremium`, `!delpremium`, `!premiumlist` | 4 |
| **Backup** | `!backup`, `!restore`, `!backuplist` | 3 |
| **Scheduler** | `!schedule`, `!listschedule`, `!delschedule` | 3 |
| **Reminders** | `!remind`, `!reminders` | 2 |
| **Plugins** | `!plugins`, `!installplugin`, `!removeplugin`, `!enableplugin`, `!disableplugin`, `!reloadplugin` | 8 |
| **Owner** | `!setprefix`, `!broadcast`, `!ban`, `!unban`, `!restart`, `!shutdown`, `!maintenance`, `!exportconfig`, `!importconfig`, `!update`, `!rollback` | 14 |
| **Other** | `!sticker`, `!afk`, `!back`, `!note`, `!language`, `!theme`, `!apikeys`, `!autoreply` | 10+ |

---

## Dashboard

Web dashboard at `http://localhost:3000` with login (`admin` / `admin123`):

- **Overview** — Connection status, uptime, message counts
- **QR Code** — Scan to link WhatsApp
- **Pairing Code** — Link via phone number
- **Sessions** — Create, delete, export, import
- **Groups** — Manage groups and anti-features
- **AI** — Configure providers, models, API keys
- **Plugins** — Install, enable/disable, configure
- **Broadcast** — Send messages to all chats
- **Logs** — Real-time log viewer
- **Stats** — Usage charts and analytics
- **Server Monitoring** — CPU, memory, load
- **Update Manager** — Check and apply updates
- **Backup** — Create and restore backups

---

## API

Full REST API with JWT authentication. See [API.md](./API.md) for complete docs.

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Use token
curl http://localhost:3000/api/bot/status \
  -H "Authorization: Bearer <token>"
```

---

## Docs

| Document | Description |
|---|---|
| [API.md](./API.md) | Full API reference |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Docker, VPS, cloud, and PaaS deployment guides |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Common issues and solutions |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Contribution guidelines |
| [SECURITY.md](./SECURITY.md) | Security policy |

---

## License

MIT — see [LICENSE](./LICENSE).

---

<div align="center">

**Built with ☠️ by Caltex Wayne — TECH WIZARD**

</div>
