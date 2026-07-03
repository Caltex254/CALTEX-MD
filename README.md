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

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/caltex-md/caltex-md)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.x-3178c6.svg)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/runtime-bun-f9f1e1.svg)](https://bun.sh/)
[![Docker](https://img.shields.io/badge/docker-ready-2496ED.svg)](./Dockerfile)

</div>

---

## Overview

CALTEX MD is a full-featured WhatsApp multi-device bot built on the Baileys library. It provides a rich command system, multi-provider AI integration, a plugin architecture, group moderation tools, media handling, scheduled messaging, and a beautiful Next.js web dashboard for complete bot management.

## Key Features

### WhatsApp Integration
- Multi-device support via Baileys MD
- QR code and pairing code authentication
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
- Plugin enable/disable from the dashboard
- Hot-reload support for development

### Web Dashboard
- Real-time bot status and health monitoring
- QR code scanning interface
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

### REST API
- Full JWT-authenticated REST API
- Bot control (start, stop, restart, status)
- Message sending and scheduling
- Session and group management
- Configuration endpoints for bot, anti-features, and AI
- WebSocket real-time updates

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

Commands use a configurable prefix (default: `!`).

### General

| Command | Aliases | Description |
|---|---|---|
| `!ping` | `!p` | Check if the bot is alive |
| `!help` | `!h`, `!menu` | Show available commands |
| `!info` | `!about` | Show bot information |

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

### Owner

| Command | Aliases | Description |
|---|---|---|
| `!setprefix <char>` | `!prefix` | Change the bot command prefix |
| `!broadcast <message>` | `!bc`, `!announce` | Send a broadcast message |
| `!ban @user` | `!block` | Ban a user from using the bot |
| `!unban @user` | `!unblock` | Unban a previously banned user |
| `!premium @user <on/off>` | `!setpremium` | Set or remove premium status |
| `!restart` | `!reboot` | Restart the bot service |
| `!stats` | `!botstats`, `!stat` | Show bot statistics |
| `!shutdown` | `!die`, `!kill` | Gracefully shut down the bot |

---

## Dashboard Features

The web dashboard runs on port **3000** and provides:

- **Overview Panel** - Real-time stats, connection status, uptime, message counts
- **QR Panel** - QR code display for WhatsApp linking
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

---

## API Documentation

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

### Bot Internal API (Port 3031)

The bot service also exposes an internal API on port 3031:

- `GET /health` - Health check with detailed metrics
- `GET /api/status` - Session status overview
- `GET /api/qr` - QR code status
- `POST /api/connect` - Connect a WhatsApp session
- `POST /api/disconnect` - Disconnect a session
- `GET /api/sessions` - List all sessions
- `POST /api/sessions/create` - Create a new session
- `POST /api/sessions/delete` - Delete a session
- `POST /api/sessions/export` - Export session data
- `POST /api/sessions/import` - Import session data
- `POST /api/backup` - Backup all sessions
- `GET /api/commands` - List registered commands
- `GET /api/config/bot` - Get bot configuration
- `PUT /api/config/bot` - Update bot configuration
- `GET /api/config/anti` - Get anti-feature configuration
- `PUT /api/config/anti` - Update anti-feature configuration
- `GET /api/config/ai` - Get AI configuration (masked keys)
- `PUT /api/config/ai` - Update AI configuration
- `POST /api/send` - Send a message
- `GET /api/scheduler/messages` - List scheduled messages
- `POST /api/scheduler/schedule` - Schedule a message
- `POST /api/scheduler/cancel` - Cancel a scheduled message

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

1. Create your plugin file in `src/lib/commands/`
2. Export it as a default `Plugin` object
3. The plugin loader will automatically discover and register it
4. Enable/disable from the dashboard Plugins panel

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

**Built with ❤️ by the CALTEX MD Team**

</div>
