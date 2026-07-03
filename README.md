<div align="center">

```
 ██████╗██╗      █████╗ ███████╗████████╗███████╗██████╗
██╔════╝██║     ██╔══██╗██╔════╝╚══██╔══╝██╔════╝██╔══██╗
██║     ██║     ███████║███████╗   ██║   █████╗  ██████╔╝
██║     ██║     ██╔══██║╚════██║   ██║   ██╔══╝  ██╔══██╗
╚██████╗███████╗██║  ██║███████║   ██║   ███████╗██║  ██║
 ╚═════╝╚══════╝╚═╝  ╚═╝╚══════╝   ╚═╝   ╚══════╝╚═╝  ╚═╝
                    ███╗   ███╗ ████╗███████╗
                    ████╗ ████║╚═██║╚════██║
                    ██╔████╔██║  ██║    ██╔╝
                    ██║╚██╔╝██║  ██║   ██╔╝
                    ██║ ╚═╝ ██║███████╗███████╗
                    ╚═╝     ╚═╝╚══════╝╚══════╝
```

# CALTEX MD - WhatsApp Multi-Device Bot

**A powerful, extensible WhatsApp bot with AI integration, plugin system, and web dashboard.**

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/caltex-md/caltex-md)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.x-3178c6.svg)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/runtime-bun-f9f1e1.svg)](https://bun.sh/)
[![Docker](https://img.shields.io/badge/docker-ready-2496ED.svg)](./Dockerfile)
[![Commands](https://img.shields.io/badge/commands-125+-purple.svg)](#commands)

</div>

---

## What's New in v2.0.0

> **125+ commands | 20 bug attacks | Changeable prefix | Owner profile | 10 languages | 5 themes**

| Feature | Description |
|---|---|
| **☠️ Bug Menu** | 20 powerful WhatsApp bug attacks (crash loop, vcard injection, document, sticker, viewonce, audio, payment, group invite, reaction bomb, contact array, location, poll, list, button, newsletter, mention bomb, forwarded, caption, status, force stop combo) |
| **🔧 Change Prefix** | Dynamically change bot command prefix (! . # $ / etc.) |
| **👤 Owner Profile** | Full owner info display (Caltex wayne - TECH WIZARD ☠️) |
| **WhatsApp Pairing Code** | Link your bot via phone number — no QR code scanning needed |
| **Repository Command** | Professional repo info card (`.repo`) |
| **Auto Update System** | Check, apply, and rollback updates from WhatsApp |
| **Premium System** | Tiered plans (basic/pro/enterprise) with duration & auto-expiry |
| **Backup System** | Full, database, sessions, settings, or plugins backups |
| **Analytics** | Bot-wide, group-level, and per-user statistics |
| **Utility Commands** | Runtime, system info, health check, speed test, changelog, and more |
| **Reminder System** | Timed & recurring reminders with flexible time formats |
| **Notes System** | Personal notes with add/get/delete/list |
| **Auto Reply** | Regex-powered auto-reply rules (global or group-specific) |
| **AFK System** | Set AFK status with auto-notification on mentions |
| **Scheduler** | Schedule messages for future delivery |
| **Multi-Language** | 10 languages with per-user/group preferences |
| **Theme System** | 5 display themes for the bot menu |
| **Maintenance Mode** | Lock bot to owner-only commands during maintenance |
| **Import/Export** | Export & import bot configuration as JSON |
| **API Key Manager** | Securely manage provider API keys with masking |
| **Plugin Manager** | Full lifecycle: install, remove, enable, disable, reload |
| **Group Analytics** | Activity tracking, top contributors, member stats |
| **Owner Notifications** | Auto-notify on disconnect, crash, and errors |
| **Dashboard Expansion** | 6+ new panels: Server Monitoring, Update Manager, Notification Center, Premium Manager, Pairing Code, Database Manager |

---

## Overview

CALTEX MD is a full-featured WhatsApp multi-device bot built on the Baileys library. It provides a rich command system, multi-provider AI integration, a plugin architecture, group moderation tools, media handling, scheduled messaging, and a beautiful Next.js web dashboard for complete bot management.

## Key Features

### WhatsApp Integration
- Multi-device support via Baileys MD
- QR code authentication
- **Pairing code authentication** — link via phone number without scanning
- Auto-reconnect with configurable retry logic
- Multi-session management
- Message send/receive with full media support

### AI Integration
- Multi-provider support: **OpenAI**, **Gemini**, **Claude**, **Ollama**, **Custom**
- Conversation memory with TTL-based cleanup
- Chat, image generation, code generation, translation, summarization, rewriting, and explanation
- Configurable system prompts and model parameters

### Plugin System
- Dynamic plugin loading and unloading
- Custom command registration via plugins
- Plugin enable/disable from the dashboard or WhatsApp commands
- Hot-reload support for development
- Install plugins from file paths
- Full lifecycle management: install, remove, enable, disable, reload

### Web Dashboard
- Real-time bot status and health monitoring
- QR code scanning interface
- **Pairing code panel** — link via phone number
- Session management (create, delete, export, import)
- Group management and moderation controls
- AI configuration panel
- Scheduled message management
- Broadcast messaging
- Log viewer with filtering
- Statistics and analytics charts
- Plugin manager
- User management
- Backup and restore
- **Server Monitoring panel** — CPU, memory, uptime, load
- **Update Manager panel** — check & apply updates, view history
- **Notification Center panel** — owner alerts for disconnects, crashes, errors
- **Premium Manager panel** — manage premium users and plans
- **Database Manager panel** — browse, query, and manage database records

### REST API
- Full JWT-authenticated REST API
- Bot control (start, stop, restart, status)
- Message sending and scheduling
- Session and group management
- Configuration endpoints for bot, anti-features, and AI
- WebSocket real-time updates
- 20+ new endpoints for v1.1.0 features (see [API Endpoints](#api-endpoints))

### Multi-Language Support
- 10 supported languages: English, Kiswahili, Français, العربية, Bahasa Indonesia, Español, Português, हिन्दी, Deutsch, 日本語
- Per-user language preference
- Per-group language preference
- Configurable translation packs

### Theme System
- 5 built-in themes: Default, Neon, Minimal, Retro, Elegant
- Affects bot menu display style
- Configurable via WhatsApp commands or dashboard

### Security
- JWT authentication with HS256 signing
- Password hashing with SHA-256 + salt
- API key masking in configuration responses
- Rate limiting support
- Audit logging for all administrative actions

---

## Quick Start

### Prerequisites

- **Node.js** >= 20 or **Bun** >= 1.0
- **npm** or **bun** package manager
- A WhatsApp account with an active phone number
- (Optional) AI provider API keys for AI features

### Installation

```bash
# Clone the repository
git clone https://github.com/caltex-md/caltex-md.git
cd caltex-md

# Install dependencies
npm install
# or with bun
bun install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Initialize the database
npx prisma db push
npx prisma generate

# Build the dashboard
npm run build
```

### Running the Bot

```bash
# Start all services (Dashboard + Bot + WebSocket)
npm start

# Development mode (Dashboard only)
npm run dev

# Start bot service separately
cd mini-services/caltex-bot
bun run dev
```

When the bot starts, it will display a QR code in the console. Scan it with WhatsApp:

> **WhatsApp** > **Settings** > **Linked Devices** > **Link a Device**

### Using Pairing Code (New in v1.1.0)

Instead of scanning a QR code, you can link your bot using a phone number:

1. Open the **Dashboard** > **Pairing Code** panel
2. Enter your WhatsApp phone number (e.g., `6281234567890`)
3. Click **Request Pairing Code**
4. Enter the received code on your phone:
   > **WhatsApp** > **Settings** > **Linked Devices** > **Link with Phone Number**

You can also request a pairing code via the API:

```bash
curl -X POST http://localhost:3000/api/pairing-code \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"6281234567890"}'
```

### Docker Quick Start

```bash
# Start all services with Docker Compose
docker compose up -d

# View logs
docker compose logs -f

# Stop all services
docker compose down
```

---

## Configuration

All configuration is managed through environment variables in the `.env` file:

| Variable | Description | Default |
|---|---|---|
| `NODE_ENV` | Runtime environment | `development` |
| `PORT` | Dashboard port | `3000` |
| `DATABASE_URL` | SQLite database path | `file:./data/caltex.db` |
| `BOT_API_URL` | Bot service URL | `http://localhost:3031` |
| `WS_URL` | WebSocket service URL | `http://localhost:3003` |
| `NEXTAUTH_SECRET` | NextAuth secret key | `change-me-in-production` |
| `NEXTAUTH_URL` | NextAuth callback URL | `http://localhost:3000` |
| `JWT_SECRET` | JWT signing secret | `caltex-md-bot-secret-key-2024` |
| `ADMIN_USER` | Dashboard admin username | `admin` |
| `ADMIN_PASS` | Dashboard admin password | `admin123` |
| `PASSWORD_SALT` | Password hashing salt | `caltex-salt` |

Bot-specific configuration is also managed via the `bot-config.json` and `ai-config.json` files, which can be edited from the dashboard.

---

## Commands

Commands use a configurable prefix (default: `!`). The bot ships with **102+ commands** across 15+ categories.

### General

| Command | Aliases | Description |
|---|---|---|
| `!ping` | `!p` | Check if the bot is alive |
| `!help` | `!h`, `!menu` | Show available commands |
| `!info` | `!about`, `!botabout` | Show bot information |
| `!menu` | `!allcommands`, `!list` | Styled bot menu with all categories |
| `!runtime` | `!uptime`, `!alive` | Show bot uptime and runtime information |
| `!system` | `!sysinfo`, `!sys` | System information (OS, Node, memory, CPU) |
| `!health` | `!healthcheck`, `!checkhealth` | Health check (database, API, services) |
| `!speed` | `!speedtest` | Speed test with response time metrics |
| `!about` | `!botabout`, `!info` | About the bot |
| `!changelog` | `!changes`, `!whatsnew` | Recent changelog entries |
| `!donate` | `!support`, `!tip` | Show donation/support links |
| `!support` | `!helpdesk`, `!contact` | Show support channels |
| `!owner` | `!ownerinfo`, `!dev` | Display owner information |
| `!repo` | `!repository`, `!source`, `!github` | Show repository info card |

### AI

| Command | Aliases | Description |
|---|---|---|
| `!ai <question>` | `!chat`, `!ask`, `!gpt` | Chat with AI |
| `!aiimage <prompt>` | `!aimg`, `!generate`, `!dalle` | Generate an image with AI (Premium) |
| `!aicode <description>` | `!code`, `!codegen` | Generate code with AI |
| `!aitranslate <lang> <text>` | `!trans`, `!translate` | Translate text using AI |
| `!aisummarize <text>` | `!summarize`, `!sum`, `!tldr` | Summarize text using AI |
| `!airewrite <style> <text>` | `!rewrite`, `!rephrase` | Rewrite text in a style |
| `!aiexplain <topic>` | `!explain`, `!elaborate` | Get an AI explanation |
| `!clearai` | `!resetai`, `!clearchat` | Clear AI conversation memory |

### Fun

| Command | Aliases | Description |
|---|---|---|
| `!joke` | `!jokes`, `!dadjoke` | Get a random joke |
| `!quote` | `!quotes`, `!inspire` | Get an inspirational quote |
| `!fact` | `!facts`, `!funfact` | Get a random fun fact |
| `!8ball <question>` | `!eightball`, `!magic8` | Ask the Magic 8-Ball |
| `!roll [sides]` | `!dice`, `!rolldice` | Roll a dice |
| `!flip` | `!coin`, `!coinflip` | Flip a coin |
| `!rps <choice>` | `!rockpaperscissors` | Play Rock Paper Scissors |
| `!trivia` | `!quiz`, `!question` | Get a random trivia question |
| `!meme` | `!memes`, `!funny` | Get a random meme |

### Download

| Command | Aliases | Description |
|---|---|---|
| `!yta <url>` | `!ytaudio`, `!ytmp3` | Download YouTube audio |
| `!ytv <url>` | `!ytvideo`, `!ytmp4` | Download YouTube video |
| `!ig <url>` | `!instagram`, `!insta` | Download Instagram media |
| `!tiktok <url>` | `!tt`, `!tik` | Download TikTok video |
| `!fb <url>` | `!facebook`, `!fbvideo` | Download Facebook video |
| `!twitter <url>` | `!tw`, `!twdl` | Download Twitter/X video |
| `!media <url>` | `!dl`, `!download` | Generic media download |

### Media

| Command | Aliases | Description |
|---|---|---|
| `!sticker` | `!s`, `!stiker` | Convert image to sticker |

### Group Admin

| Command | Aliases | Description |
|---|---|---|
| `!groupinfo` | `!gi` | Show group information |
| `!promote @user` | `!pm` | Promote user to admin |
| `!demote @user` | `!dm` | Demote admin to member |
| `!mute [minutes]` | - | Mute group (admin-only chat) |
| `!unmute` | - | Unmute group |

### Group Analytics

| Command | Aliases | Description |
|---|---|---|
| `!gstats` | `!groupmembers`, `!activemembers` | Show most active members in the group |
| `!gactivity [daily/weekly/monthly]` | `!groupactivity`, `!activity` | Show group activity over time |
| `!gtop` | `!grouptop`, `!topmembers` | Show top contributors in the group |

### Moderation

| Command | Aliases | Description |
|---|---|---|
| `!antilink [on/off]` | `!antiland` | Toggle anti-link protection |
| `!antibadword [on/off]` | `!antibw`, `!badword` | Toggle anti-badword filter |
| `!antispam [on/off]` | `!spam` | Toggle anti-spam protection |
| `!antidelete [on/off]` | `!adelete` | Toggle anti-delete (recover deleted messages) |
| `!antiviewonce [on/off]` | `!aviewonce`, `!antivo` | Toggle anti-view-once |
| `!anticall [on/off]` | `!acall`, `!blockcall` | Toggle anti-call (auto-reject calls) |
| `!warn @user [reason]` | `!warning`, `!addwarn` | Warn a user |
| `!unwarn @user` | `!delwarn`, `!clearwarn` | Remove warnings for a user |
| `!warnings [@user]` | `!checkwarn`, `!warns` | Check warnings for a user |
| `!purge [count]` | `!clear`, `!clean` | Delete recent messages |
| `!tagall [message]` | `!mentionall`, `!everyone` | Tag all group members |
| `!hidetag [message]` | `!ht`, `!secretag` | Hidden tag all members |
| `!welcome [on/off]` | `!wel`, `!autowelcome` | Toggle welcome messages |
| `!goodbye [on/off]` | `!bye`, `!autogoodbye` | Toggle goodbye messages |
| `!setwelcome <message>` | `!swelcome` | Set welcome message template |
| `!setgoodbye <message>` | `!sgoodbye` | Set goodbye message template |

### Auto Reply

| Command | Aliases | Description |
|---|---|---|
| `!autoreply` | `!replies`, `!listreply` | List all auto-reply rules |
| `!setreply <trigger>\|<response> [-regex] [-group <jid>]` | `!addreply`, `!createreply` | Create an auto-reply rule |
| `!delreply <trigger>` | `!deletereply`, `!removereplay` | Delete an auto-reply rule |

### AFK

| Command | Aliases | Description |
|---|---|---|
| `!afk [reason]` | `!away`, `!brb` | Set AFK status with auto-notification on mentions |
| `!back` | `!return`, `!imback` | Return from AFK and show away duration |

### Reminders

| Command | Aliases | Description |
|---|---|---|
| `!remind <time> <message>` | `!remindme`, `!setreminder` | Set a timed or recurring reminder |
| `!reminders` | `!myreminders`, `!listreminders` | List your active reminders |

> **Time formats:** `30m` (minutes), `2h` (hours), `1d` (days), `daily`, `weekly`, `6pm`, `14:30`

### Notes

| Command | Aliases | Description |
|---|---|---|
| `!note add <title>\|<content>` | `!notesmanage`, `!mynote` | Add or update a note |
| `!note get <title>` | — | Retrieve a note by title |
| `!note delete <title>` | — | Delete a note by title |
| `!notes` | `!listnotes`, `!mynotes` | List all your saved notes |

### Scheduler

| Command | Aliases | Description |
|---|---|---|
| `!schedule <time> <target> <message>` | `!sched`, `!schedulemsg` | Schedule a message for future delivery |
| `!listschedule` | `!scheduled`, `!schedlist` | List all scheduled messages |
| `!delschedule <id>` | `!cancelschedule`, `!removeschedule` | Cancel a scheduled message |

### Analytics

| Command | Aliases | Description |
|---|---|---|
| `!stats` | `!botinfo`, `!infobot` | General bot statistics overview |
| `!botstats` | `!performance`, `!perf` | Detailed bot performance stats (uptime, memory, CPU) |
| `!groupstats` | `!gstats`, `!groupinfo` | Current group analytics |
| `!userstats [@user]` | `!ustats`, `!userinfo` | User statistics for a specific user |

### Premium

| Command | Aliases | Description |
|---|---|---|
| `!premium` | `!mystatus`, `!premiumstatus` | Check your premium status |
| `!addpremium @user <plan> <duration>` | `!grantpremium`, `!setpremium` | Grant premium to a user (Owner) |
| `!delpremium @user` | `!removepremium`, `!revokepremium` | Remove premium from a user (Owner) |
| `!premiumlist` | `!listpremium`, `!premiumusers` | List all premium users (Owner) |

> **Plans:** basic, pro, enterprise | **Durations:** `1d`, `7d`, `30d`, `1y`

### Backup

| Command | Aliases | Description |
|---|---|---|
| `!backup [type]` | `!createbackup`, `!backupcreate` | Create a backup (Owner) |
| `!restore <backup_id>` | `!restorebackup` | Restore from a backup (Owner) |
| `!backuplist` | `!backups`, `!listbackups` | List all available backups (Owner) |

> **Backup types:** `full`, `database`, `sessions`, `settings`, `plugins`

### Auto Update

| Command | Aliases | Description |
|---|---|---|
| `!update` | `!updatebot`, `!autoupdate` | Start the update process (Owner) |
| `!checkupdate` | `!checkupdates`, `!newversion` | Check GitHub for newer releases (Owner) |
| `!version` | `!ver`, `!v` | Show current bot version |
| `!rollback` | `!revert`, `!downgrade` | Rollback to the previous version (Owner) |

### Plugin Manager

| Command | Aliases | Description |
|---|---|---|
| `!plugins` | `!listplugins`, `!pluginlist` | List all plugins with status (Owner) |
| `!plugininfo <name>` | `!plugindetail`, `!pinfo` | Show detailed plugin information (Owner) |
| `!installplugin <path>` | `!plugininstall`, `!addplugin` | Install a plugin from a file path (Owner) |
| `!removeplugin <name>` | `!pluginremove`, `!deleteplugin` | Remove a plugin from the registry (Owner) |
| `!enableplugin <name>` | `!pluginenable` | Enable a plugin (Owner) |
| `!disableplugin <name>` | `!plugindisable` | Disable a plugin (Owner) |
| `!reloadplugin <name>` | `!pluginreload` | Hot reload a plugin (Owner) |
| `!reloadall` | `!reloadplugins` | Reload all plugins (Owner) |

### API Key Manager

| Command | Aliases | Description |
|---|---|---|
| `!apikeys` | `!listkeys`, `!keys` | List all configured API keys (masked) (Owner) |
| `!apikeyadd <name> <key> [provider]` | `!addkey`, `!addapikey` | Add an API key (Owner) |
| `!apikeydel <name>` | `!delkey`, `!deletekey` | Delete an API key (Owner) |
| `!apikeytoggle <name>` | `!togglekey`, `!keytoggle` | Enable/disable an API key (Owner) |

### Language

| Command | Aliases | Description |
|---|---|---|
| `!language [code]` | `!lang`, `!setlang` | Set or view your language preference |
| `!languages` | `!langs`, `!listlang` | List all available languages |

> **Supported languages (10):** 🇬🇧 English (`en`), 🇰🇪 Kiswahili (`sw`), 🇫🇷 Français (`fr`), 🇸🇦 العربية (`ar`), 🇮🇩 Bahasa Indonesia (`id`), 🇪🇸 Español (`es`), 🇧🇷 Português (`pt`), 🇮🇳 हिन्दी (`hi`), 🇩🇪 Deutsch (`de`), 🇯🇵 日本語 (`ja`)

### Theme

| Command | Aliases | Description |
|---|---|---|
| `!theme [name]` | `!settheme`, `!bottheme` | Set or view the current bot theme |
| `!themes` | `!listthemes`, `!themelist` | List all available themes |

> **Built-in themes (5):** `default` (clean & minimal), `neon` (dark with vibrant colors), `minimal` (ultra-minimal), `retro` (terminal-style ASCII), `elegant` (professional)

### Maintenance Mode

| Command | Aliases | Description |
|---|---|---|
| `!maintenance <on\|off\|status>` | `!maint`, `!mm` | Toggle maintenance mode (Owner) |

### Import/Export

| Command | Aliases | Description |
|---|---|---|
| `!exportconfig` | `!export`, `!backupconfig` | Export all settings as JSON (Owner) |
| `!importconfig <json>` | `!import`, `!restoreconfig` | Import configuration from JSON (Owner) |

### Owner

| Command | Aliases | Description |
|---|---|---|
| `!setprefix <char>` | `!prefix` | Change the bot command prefix |
| `!broadcast <message>` | `!bc`, `!announce` | Send a broadcast message |
| `!ban @user` | `!block` | Ban a user from using the bot |
| `!unban @user` | `!unblock` | Unban a previously banned user |
| `!restart` | `!reboot` | Restart the bot service |
| `!shutdown` | `!die`, `!kill` | Gracefully shut down the bot |
| `!changeprefix <new>` | `!setprefix`, `!prefix` | Change bot command prefix (1-3 symbols) |
| `!getprefix` | `!prefixinfo`, `!currentprefix` | Show the current bot prefix |

### Bug Menu ☠️

> ⚠️ All bug commands are **owner-only**. Usage: `!bug<N> <phone_number>`

| Command | Aliases | Description |
|---|---|---|
| `!bugmenu` | `!bugs`, `!buglist`, `!attackmenu` | Show the full bug menu |
| `!bug1 <number>` | `!crashloop`, `!crash1` | Crash loop - zero-width poison bytes |
| `!bug2 <number>` | `!vcardbug`, `!crash2` | VCard injection - 300 oversized contacts |
| `!bug3 <number>` | `!docbug`, `!crash3` | Document - RLO character filename |
| `!bug4 <number>` | `!stickerbug`, `!crash4` | Sticker - corrupted webp payload |
| `!bug5 <number>` | `!viewoncebug`, `!crash5` | ViewOnce - oversized caption |
| `!bug6 <number>` | `!audiobug`, `!crash6` | Audio - corrupted voice note header |
| `!bug7 <number>` | `!paymentbug`, `!crash7` | Payment - corrupted amounts |
| `!bug8 <number>` | `!invitebug`, `!crash8` | Group invite - corrupted invite data |
| `!bug9 <number>` | `!reactionbug`, `!crash9` | Reaction bomb - 50 rapid reactions |
| `!bug10 <number>` | `!contactbug`, `!crash10` | Contact array - 500 malformed vcards |
| `!bug11 <number>` | `!locationbug`, `!crash11` | Location - extreme coordinates |
| `!bug12 <number>` | `!pollbug`, `!crash12` | Poll - 100 oversized options |
| `!bug13 <number>` | `!listbug`, `!crash13` | List message - 100 overflow rows |
| `!bug14 <number>` | `!buttonbug`, `!crash14` | Button - 50 oversized buttons |
| `!bug15 <number>` | `!newsletterbug`, `!crash15` | Newsletter - corrupted ad reply |
| `!bug16 <number>` | `!mentionbug`, `!mentionbomb`, `!crash16` | Mention bomb - 300 mentions |
| `!bug17 <number>` | `!forwardbug`, `!crash17` | Forwarded - deep chain (999M score) |
| `!bug18 <number>` | `!captionbug`, `!crash18` | Caption - massive invisible caption |
| `!bug19 <number>` | `!statusbug`, `!crash19` | Status - corrupted broadcast |
| `!bug20 <number>` | `!forcestop`, `!combo`, `!kill`, `!crash20` | Force stop - combo attack (3 phases) |

---

## Dashboard Features

The web dashboard runs on port **3000** and provides 20 panels:

### Core Panels
- **Overview Panel** - Real-time stats, connection status, uptime, message counts
- **QR Panel** - QR code display for WhatsApp linking
- **Pairing Code Panel** - Link WhatsApp via phone number (no QR scanning)
- **Sessions Panel** - Create, delete, export, and import sessions
- **Groups Panel** - Manage groups, view members, configure anti-features
- **Commands Panel** - Browse, enable/disable, and configure commands
- **AI Panel** - Configure AI providers, models, API keys, system prompts
- **Plugins Panel** - Install, enable/disable, and configure plugins
- **Broadcast Panel** - Send broadcast messages to all chats or specific targets
- **Logs Panel** - Real-time log viewer with level filtering
- **Stats Panel** - Usage charts, command statistics, activity graphs
- **Users Panel** - Manage users, ban/unban, premium status
- **Settings Panel** - Bot configuration, prefix, auto-features
- **Backup Panel** - Create and restore session backups
- **Files Panel** - Browse and manage uploaded media and files

### New in v2.0.0
- **Bug Menu Panel** - Manage and launch bug attacks from the dashboard
- **Server Monitoring Panel** - CPU usage, memory usage, system load, process uptime, network stats
- **Update Manager Panel** - Check for updates, view release notes, apply updates, rollback versions
- **Notification Center Panel** - Owner notifications for disconnects, crashes, errors with severity and filtering
- **Premium Manager Panel** - Manage premium users, plans, durations, and auto-expiry settings
- **Pairing Code Panel** - Request and display WhatsApp pairing codes for phone-number linking
- **Database Manager Panel** - Browse tables, run queries, manage records, view schema

---

## API Endpoints

The bot exposes a comprehensive REST API. See [API.md](./API.md) for complete documentation.

### Authentication

All API endpoints require JWT authentication:

```bash
# Login and get a token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Use the token in subsequent requests
curl http://localhost:3000/api/bot/status \
  -H "Authorization: Bearer <your-token>"
```

### Dashboard API (Port 3000)

#### Bot Control
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/bot/status` | Get bot status |
| `GET` | `/api/bot/qr` | Get QR code status |
| `POST` | `/api/bot/start` | Start the bot |
| `POST` | `/api/bot/stop` | Stop the bot |
| `POST` | `/api/bot/restart` | Restart the bot |

#### Pairing Code
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/pairing-code` | Request a WhatsApp pairing code |

#### Sessions
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/bot/status` | Session status overview |

#### Groups
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/groups` | List all groups |
| `GET` | `/api/groups/[jid]` | Get group details |

#### Users
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/users` | List all users |
| `GET` | `/api/users/[jid]` | Get user details |

#### Premium
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/premium` | List premium users |
| `GET` | `/api/premium/[jid]` | Get premium status for user |

#### Commands
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/commands` | List registered commands |
| `GET` | `/api/commands/[id]` | Get command details |

#### Plugins
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/plugins` | List plugins |
| `GET` | `/api/plugins/[id]` | Get plugin details |

#### Notes
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/notes` | List notes |
| `GET` | `/api/notes/[id]` | Get note details |

#### Auto Replies
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/autoreplies` | List auto-reply rules |
| `GET` | `/api/autoreplies/[id]` | Get auto-reply details |

#### Notifications
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/notifications` | List owner notifications |
| `GET` | `/api/notifications/[id]` | Get notification details |

#### System & Health
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check with detailed metrics |
| `GET` | `/api/system` | System information (CPU, memory, OS) |
| `GET` | `/api/stats` | Bot statistics |
| `GET` | `/api/maintenance` | Maintenance mode status |
| `POST` | `/api/maintenance` | Toggle maintenance mode |

#### Configuration
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/settings` | Get bot settings |
| `PUT` | `/api/settings` | Update bot settings |
| `GET` | `/api/ai` | Get AI configuration (masked keys) |
| `PUT` | `/api/ai` | Update AI configuration |

#### Data Management
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/backup` | List backups |
| `POST` | `/api/backup` | Create a backup |
| `POST` | `/api/broadcast` | Send a broadcast message |
| `POST` | `/api/send-message` | Send a message |

#### Feature APIs
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/updates` | Check for bot updates |
| `GET` | `/api/group-analytics` | Group analytics data |
| `GET` | `/api/reminders` | List reminders |
| `GET` | `/api/afk` | List AFK statuses |
| `GET` | `/api/languages` | List supported languages |
| `GET` | `/api/themes` | List available themes |
| `GET` | `/api/apikeys` | List API keys (masked) |
| `GET` | `/api/apikeys/[id]` | Get API key details |
| `GET` | `/api/repo` | Get repository configuration |

### Bot Internal API (Port 3031)

The bot service also exposes an internal API on port 3031:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check with detailed metrics |
| `GET` | `/api/status` | Session status overview |
| `GET` | `/api/qr` | QR code status |
| `POST` | `/api/connect` | Connect a WhatsApp session |
| `POST` | `/api/disconnect` | Disconnect a session |
| `GET` | `/api/sessions` | List all sessions |
| `POST` | `/api/sessions/create` | Create a new session |
| `POST` | `/api/sessions/delete` | Delete a session |
| `POST` | `/api/sessions/export` | Export session data |
| `POST` | `/api/sessions/import` | Import session data |
| `POST` | `/api/backup` | Backup all sessions |
| `GET` | `/api/commands` | List registered commands |
| `GET` | `/api/config/bot` | Get bot configuration |
| `PUT` | `/api/config/bot` | Update bot configuration |
| `GET` | `/api/config/anti` | Get anti-feature configuration |
| `PUT` | `/api/config/anti` | Update anti-feature configuration |
| `GET` | `/api/config/ai` | Get AI configuration (masked keys) |
| `PUT` | `/api/config/ai` | Update AI configuration |
| `POST` | `/api/send` | Send a message |
| `POST` | `/api/pairing-code` | Request a pairing code |
| `GET` | `/api/scheduler/messages` | List scheduled messages |
| `POST` | `/api/scheduler/schedule` | Schedule a message |
| `POST` | `/api/scheduler/cancel` | Cancel a scheduled message |

---

## Owner Notifications

CALTEX MD v1.1.0 automatically notifies the bot owner of critical events:

| Event | Severity | Description |
|---|---|---|
| **Disconnect** | Warning | WhatsApp connection lost |
| **Crash** | Critical | Unhandled exception causing bot crash |
| **Error** | Error | Non-fatal errors requiring attention |
| **Update Available** | Info | New version detected on GitHub |
| **Premium Expiry** | Warning | Premium user subscription expiring soon |

Notifications are accessible via the **Notification Center** dashboard panel and the `/api/notifications` API endpoint.

---

## Plugin Development

CALTEX MD supports a plugin architecture for extending bot functionality.

### Plugin Structure

```typescript
import type { Plugin, CommandContext } from '@/lib/plugin-loader';

const myPlugin: Plugin = {
  name: 'my-plugin',
  version: '1.0.0',
  description: 'My custom plugin',
  author: 'Your Name',
  enabled: true,
  commands: [
    {
      name: 'hello',
      description: 'Say hello',
      category: 'custom',
      aliases: ['hi', 'hey'],
      cooldown: 3,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        await ctx.reply('Hello from my plugin! 👋');
      },
    },
  ],
};

export default myPlugin;
```

### Command Context

Each command handler receives a `CommandContext` object with:

| Property | Type | Description |
|---|---|---|
| `sock` | `WASocket` | WhatsApp socket instance |
| `jid` | `string` | Chat JID |
| `sender` | `string` | Sender JID |
| `args` | `string[]` | Command arguments |
| `text` | `string` | Full message text |
| `isGroup` | `boolean` | Whether the message is from a group |
| `isOwner` | `boolean` | Whether the sender is a bot owner |
| `isAdmin` | `boolean` | Whether the sender is a group admin |
| `reply(text)` | `function` | Reply to the message |
| `react(emoji)` | `function` | React to the message |

### Installing Plugins

1. **Via WhatsApp command:** `!installplugin ./custom-plugins/my-plugin.ts`
2. **Via dashboard:** Plugins panel > Install
3. **Via file system:** Place your plugin file in `src/lib/commands/` and it will auto-load
4. Enable/disable from the dashboard Plugins panel or via `!enableplugin`/`!disableplugin`
5. Hot-reload during development with `!reloadplugin <name>`

---

## Deployment

CALTEX MD can be deployed on various platforms. See [DEPLOYMENT.md](./DEPLOYMENT.md) for comprehensive deployment guides covering:

- **Docker** and **Docker Compose** (recommended)
- **Ubuntu/Debian VPS** with PM2, Nginx, and SSL
- **Cloud providers**: AWS EC2, Google Cloud, Azure, Oracle Cloud, DigitalOcean
- **PaaS**: Render, Railway, Heroku
- **Game panels**: Pterodactyl

---

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for solutions to common issues including:

- Connection and QR code problems
- Pairing code issues
- Session and authentication issues
- Database errors
- Docker and deployment issues
- Performance optimization
- Debug mode instructions

---

## Contributing

We welcome contributions! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for details on:

- Code of Conduct
- Development setup
- Code style guidelines
- Commit message conventions
- Pull request process

---

## Security

For security concerns, please read [SECURITY.md](./SECURITY.md) for our vulnerability reporting policy and security best practices.

---

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

## Credits

- [Baileys](https://github.com/WhiskeySockets/Baileys) - WhatsApp Web API
- [Next.js](https://nextjs.org/) - React framework for the dashboard
- [Prisma](https://www.prisma.io/) - Database ORM
- [shadcn/ui](https://ui.shadcn.com/) - UI component library
- [Bun](https://bun.sh/) - JavaScript runtime
- [jose](https://github.com/panva/jose) - JWT library
- [Sharp](https://sharp.pixelplumbing.com/) - Image processing

---

<div align="center">

**Built with ☠️ by Caltex wayne - TECH WIZARD**

</div>
