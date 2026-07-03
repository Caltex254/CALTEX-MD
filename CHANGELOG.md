# Changelog

All notable changes to the CALTEX MD WhatsApp Bot project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
