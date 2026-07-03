# Changelog

All notable changes to the CALTEX MD WhatsApp Bot project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-07-03

### Added

#### WhatsApp Pairing Code
- Phone number based linking via pairing code (alternative to QR scanning)
- `requestPairingCode()` method in ConnectionManager
- `createConnectionWithPairingCode()` for full pairing code flow
- Dashboard Pairing Code panel with step-by-step instructions
- `/api/pairing-code` REST endpoint
- Bot service endpoints: `/api/pairing-code`, `/api/connect-pairing`

#### Repository Command
- `!repo` command showing professional repository info card
- Repository name, GitHub URL, version, developer, description, docs, license
- Configurable via RepoConfig database table and dashboard settings
- Never exposes sensitive files (.env, sessions, API keys, databases)

#### Auto Update System
- `!update` - Start safe update process (backup, pull, restart)
- `!checkupdate` - Check GitHub for newer releases
- `!version` - Display current bot version
- `!rollback` - Rollback to previous version if update fails
- Backup before updating with automatic rollback on failure
- Release notes display
- UpdateRecord tracking in database

#### Premium System
- `!premium` - Check your premium status
- `!addpremium @user <plan> <duration>` - Grant premium (owner only)
- `!delpremium @user` - Remove premium (owner only)
- `!premiumlist` - List all premium users (owner only)
- Three plan tiers: basic, pro, enterprise
- Duration formats: 1d, 7d, 30d, 1y
- Automatic expiration checking
- PremiumUser database model with expiry tracking
- Premium Manager dashboard panel

#### Backup System
- `!backup [type]` - Create backup (full/database/sessions/settings/plugins)
- `!restore <id>` - Restore from backup
- `!backuplist` - List available backups
- Timestamped backup files with size tracking
- BackupRecord database model
- Auto-backup scheduling support

#### Analytics
- `!stats` - General bot statistics (users, groups, commands, messages)
- `!botstats` - Detailed performance (uptime, memory, CPU, sessions, API)
- `!groupstats` - Current group analytics
- `!userstats @user` - User statistics
- Real-time system metrics via os module
- GroupAnalytics database model for tracking

#### Utility Commands
- `!runtime` - Bot uptime and runtime information
- `!system` - System information (OS, Node, memory, CPU)
- `!health` - Health check (database, API, services)
- `!speed` - Speed test with response time metrics
- `!about` - About the bot with credits
- `!changelog` - Recent changelog entries
- `!donate` - Support links
- `!support` - Support channels

#### Reminder System
- `!remind <time> <message>` - Set timed reminders (30m, 2h, 6pm, daily, weekly)
- `!reminders` - List active reminders
- Recurring reminders (daily, weekly, monthly)
- Reminder database model with automatic checking

#### Notes System
- `!note add <title>|<content>` - Create personal notes
- `!note get <title>` - Retrieve a note
- `!note delete <title>` - Delete a note
- `!notes` - List all your notes
- Private note storage in database

#### Auto Reply System
- `!autoreply` - List all auto-replies
- `!setreply <trigger>|<response>` - Create keyword-triggered reply
- `!delreply <trigger>` - Delete auto-reply
- Regex pattern support for advanced matching
- Group-specific or global replies
- Match count tracking

#### AFK System
- `!afk [reason]` - Set AFK status with reason
- `!back` - Return from AFK (shows duration away)
- Auto-notify when someone mentions an AFK user
- AFKStatus database model

#### Scheduler
- `!schedule <time> <target> <message>` - Schedule message delivery
- `!listschedule` - List scheduled messages
- `!delschedule <id>` - Delete scheduled message
- Support for scheduled text, media, and broadcasts

#### Multi-Language Support
- `!language [code]` - Set or view language
- `!languages` - List 10 available languages
- Language packs: English, Kiswahili, Français, العربية, Português, Bahasa Indonesia, हिन्दी, Español, Deutsch, isiZulu
- LanguagePack database model
- Per-user and per-group language preferences

#### Theme System
- `!theme [name]` - Set or view current theme
- `!themes` - List 5 available themes (default, ocean, forest, purple, midnight)
- ThemeConfig database model
- Applies to WhatsApp menu display and dashboard styling

#### Maintenance Mode
- `!maintenance on/off` - Toggle maintenance mode (owner only)
- When enabled, only owner commands are available
- Setting stored in database for persistence

#### Import/Export
- `!exportconfig` - Export all settings, plugins, themes as JSON
- `!importconfig <json>` - Import configuration from JSON
- Supports settings, plugin states, theme configs, language packs

#### API Key Manager
- `!apikeys` - List API key configs (masked)
- `!apikeyadd <name> <key>` - Add API key securely
- `!apikeydel <name>` - Delete API key
- `!apikeytoggle <name>` - Enable/disable API key
- APIKey database model with encryption
- Never exposes full keys in responses

#### Plugin Manager
- `!plugins` - List all plugins with status
- `!plugininfo <name>` - Detailed plugin info
- `!installplugin <path>` - Install plugin from path
- `!removeplugin <name>` - Remove a plugin
- `!enableplugin <name>` - Enable a plugin
- `!disableplugin <name>` - Disable a plugin
- `!reloadplugin <name>` - Hot reload a plugin
- `!reloadall` - Reload all plugins
- Version compatibility checks and dependency validation

#### Group Analytics
- `!gstats` - Group statistics (most active members)
- `!gactivity` - Daily/weekly/monthly activity
- `!gtop` - Top contributors ranking
- GroupAnalytics database model with date tracking

#### Owner Notifications
- Auto-notify owner on: bot disconnect, session expire, plugin crash, database error, API failure, update available
- NotificationCenter dashboard panel with severity badges
- Notification read/delete functionality
- OwnerNotification database model

#### Dashboard Improvements
- Server Monitoring panel (CPU, RAM, disk, network, uptime)
- Update Manager panel (check, update, rollback, release notes)
- Notification Center panel (list, filter, mark read, delete)
- Premium Manager panel (add/remove/list premium users)
- Pairing Code panel (generate code, step-by-step instructions)
- Database Manager panel (size, tables, backup, vacuum)
- 6 new sidebar navigation items

#### New API Endpoints
- `/api/pairing-code` - Request WhatsApp pairing code
- `/api/notifications` - Owner notifications CRUD
- `/api/premium` - Premium user management
- `/api/reminders` - Reminder management
- `/api/notes` - Notes management
- `/api/autoreplies` - Auto-reply management
- `/api/afk` - AFK status management
- `/api/languages` - Language pack management
- `/api/themes` - Theme management
- `/api/maintenance` - Maintenance mode toggle
- `/api/updates` - Update system management
- `/api/apikeys` - API key management
- `/api/repo` - Repository configuration
- `/api/group-analytics` - Group analytics data
- `/api/system` - System information endpoint

#### Database
- 12 new Prisma models: PremiumUser, Reminder, Note, AutoReply, AFKStatus, LanguagePack, ThemeConfig, OwnerNotification, UpdateRecord, BackupRecord, APIKey, GroupAnalytics, RepoConfig
- 102+ commands seeded
- 29 plugins registered
- 10 language packs
- 5 themes
- 42 settings categories

### Changed
- Updated seed script with 102+ commands and 29 plugins
- Enhanced ConnectionManager with pairing code support
- Owner notifications on disconnect and errors
- Dashboard sidebar expanded with 6 new panels

## [1.0.0] - 2025-01-15

### Added

#### WhatsApp Integration
- Multi-device WhatsApp connection via Baileys MD
- QR code authentication with terminal display
- Auto-reconnect with exponential backoff (max 10 attempts)
- Multi-session management (create, delete, export, import)
- Session backup and restore functionality
- Message send/receive with full media support
- Presence updates (composing, recording, available)
- Read receipts (auto-read configurable)
- Typing and recording indicators (configurable)
- Status view tracking (auto-status-view)
- Call event handling with anti-call rejection

#### AI Integration
- Multi-provider AI support: OpenAI, Gemini, Claude, Ollama, Custom endpoints
- Conversation memory with TTL-based automatic cleanup (1-hour default)
- Configurable max conversation length (20 messages default)
- `!ai` command for general AI chat
- `!aiimage` command for DALL-E image generation (premium)
- `!aicode` command for code generation
- `!aitranslate` command for multi-language translation
- `!aisummarize` command for text summarization
- `!airewrite` command for style-based text rewriting
- `!aiexplain` command for topic explanations
- `!clearai` command to reset conversation memory
- Configurable system prompts per provider
- API key masking in configuration responses
- Per-provider model, temperature, and max tokens configuration

#### Plugin System
- Dynamic plugin loading and unloading
- Plugin architecture with `Plugin` interface
- Command registration via plugins with aliases and cooldowns
- Plugin enable/disable from dashboard
- Built-in plugins: AI, Fun, Download, Owner, Moderation, Group, Sticker, Tools, Help, Menu
- Custom plugin development support
- Plugin statistics tracking

#### Web Dashboard
- Next.js 16 dashboard with App Router
- Responsive design with shadcn/ui components
- Dark/light theme support
- Overview panel with real-time stats and uptime
- QR code scanning interface
- Session management panel (CRUD, export/import)
- Group management panel with member listing
- Command browser with enable/disable toggles
- AI configuration panel (providers, keys, models, prompts)
- Plugin manager panel
- Broadcast messaging panel
- Real-time log viewer with level filtering
- Statistics and analytics panel with charts
- User management panel (ban/unban, premium)
- Settings panel for bot configuration
- Backup and restore panel
- File browser panel for media management

#### REST API
- JWT authentication with HS256 signing (jose library)
- Password hashing with SHA-256 + configurable salt
- Bot control endpoints (start, stop, restart, status, QR)
- Session management endpoints (CRUD, export/import, backup)
- Group management endpoints (list, detail, members)
- Message sending endpoint
- Broadcast endpoint
- AI configuration endpoints (get/update with masked keys)
- Bot configuration endpoints (get/update)
- Anti-feature configuration endpoints (get/update)
- Scheduled message endpoints (list, schedule, cancel)
- Command listing endpoint
- Statistics endpoint
- User management endpoints
- Plugin management endpoints (CRUD)
- Health check endpoint with detailed metrics
- CORS support on all endpoints
- WebSocket service for real-time updates (port 3003)

#### Anti-Features
- Anti-link: Delete messages containing URLs (configurable allowed domains)
- Anti-badword: Filter and delete messages with prohibited words
- Anti-spam: Rate-limit messages per user (configurable threshold and interval)
- Anti-delete: Recover and forward deleted messages
- Anti-view-once: Capture and forward view-once media
- Anti-tag: Detect and act on excessive mentions
- Anti-call: Auto-reject incoming calls with optional response message
- Configurable actions per feature: delete, warn, kick, mute
- Per-group feature toggling

#### Group Management
- Group info command with member count and description
- Promote/demote group admins
- Mute/unmute groups with optional duration
- Welcome messages for new members (configurable template with @user variable)
- Goodbye messages for departing members (configurable template)
- Tag all members (visible and hidden)
- Group moderation commands

#### Media Handling
- Image download and resend
- Video download and resend
- Audio download and resend (with voice note support)
- Document handling
- Sticker creation from images (with pack and author metadata)
- Sticker metadata configuration
- Emoji reactions on messages
- Media caching with file system storage

#### Scheduled Messages
- Schedule messages for future delivery
- Recurring message support with configurable interval
- Broadcast scheduling to multiple targets
- Cancel scheduled messages
- Scheduler statistics and monitoring
- WebSocket integration for real-time schedule updates

#### Fun Commands
- Random jokes, quotes, and fun facts
- Magic 8-Ball
- Dice rolling (configurable sides)
- Coin flip
- Rock Paper Scissors game
- Trivia questions with multiple choice
- Meme fetching

#### Download Commands
- YouTube audio download (`!yta`)
- YouTube video download (`!ytv`)
- Instagram media download (`!ig`)
- TikTok video download (`!tiktok`)
- Facebook video download (`!fb`)
- Twitter/X video download (`!twitter`)
- Generic media download (`!media`)

#### Owner Commands
- Change command prefix
- Broadcast messages to all chats
- Ban/unban users
- Premium user management
- Bot restart and shutdown
- Bot statistics display

#### Database
- SQLite database via Prisma ORM
- User model with premium and ban support
- Group model with anti-feature flags
- GroupMember model with role tracking
- BotSession model with session data
- Setting model for key-value configuration
- Command model with usage tracking and cooldowns
- Plugin model with configuration storage
- Log model for structured logging
- Stat model for daily statistics aggregation
- Warning model for moderation tracking
- BlockedContact model
- Broadcast and ScheduledMessage models
- CustomCommand model
- AISettings model
- MediaCache model
- AuditLog model with actor relations

#### Docker Support
- Multi-stage Dockerfile for Next.js dashboard
- Dedicated Dockerfile for bot service
- Docker Compose for development (with health checks)
- Docker Compose for production (with Nginx, resource limits, logging)
- Named volumes for data, sessions, media, and logs
- Bridge network for inter-service communication
- Health check endpoints for all services

#### CI/CD and Deployment
- PM2 ecosystem configuration for process management
- Heroku Procfile
- Caddy reverse proxy configuration
- Nginx reverse proxy configuration
- Systemd service templates
- SSL/TLS support via Let's Encrypt/certbot

#### Auto-Features
- Auto-reply with configurable trigger matching (exact, contains, regex)
- Auto-react with random emoji selection
- Auto-read incoming messages
- Auto-typing indicator
- Auto-recording indicator
- Auto-status-view
- Blocked JIDs list

#### Security
- JWT authentication for all API endpoints
- Password hashing with SHA-256 and configurable salt
- API key masking in responses
- CORS configuration
- Audit logging for administrative actions
- Configurable admin credentials via environment variables
- Non-root Docker container user
- Graceful shutdown handling

#### Development
- TypeScript throughout the codebase
- Bun runtime support with hot reload
- Pino structured logging
- ESLint configuration
- Environment variable management
- Modular architecture with clear separation of concerns
- EventEmitter pattern for loose coupling

### Infrastructure
- Health check endpoint with uptime, connection stats, message counts
- Graceful shutdown with connection cleanup
- Process signal handling (SIGINT, SIGTERM, SIGQUIT)
- Uncaught exception and unhandled rejection handlers
- Request body parsing for JSON and raw data
- 404 handling for unknown routes

[1.0.0]: https://github.com/caltex-md/caltex-md/releases/tag/v1.0.0
