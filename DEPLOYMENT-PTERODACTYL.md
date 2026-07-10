# CALTEX MD Bot — Pterodactyl Panel Deployment Guide

This guide explains how to deploy the CALTEX MD WhatsApp Bot on a Pterodactyl panel.

## Prerequisites

1. **A Pterodactyl panel** with access to create servers
2. **Node 20 egg** available (or import our custom egg)
3. **Your CALTEX Session ID** (e.g. `CALTEX-R4QA-TWE4`) from the [pairing dashboard](https://caltex-md.vercel.app/scan)
4. **A GitHub personal access token** with `repo` scope
5. **A private GitHub repo** named `caltex-sessions` (for credential storage)

## Option A: Use the Custom Egg (Recommended)

### Step 1: Import the Egg

1. Go to your Pterodactyl admin panel
2. Navigate to **Nests** → Create a new nest called `WhatsApp Bots`
3. Click **Import Egg** and upload `egg-caltex-bot.json` from this repo
4. The egg will appear under the `WhatsApp Bots` nest

### Step 2: Create a Server

1. In the user panel, click **Create Server**
2. Select the `WhatsApp Bots` nest and the `CALTEX MD WhatsApp Bot` egg
3. Configure:
   - **Server Name**: `caltex-md-bot`
   - **Docker Image**: `Node 20` (ghcr.io/pterodactyl/yolks:node_20)
   - **Memory**: 512 MB minimum (1024 MB recommended)
   - **Disk**: 1024 MB minimum
   - **CPU Limit**: 100%
4. Click **Create Server**

### Step 3: Upload Bot Files

The egg's install script auto-clones the repo. If it doesn't, manually upload:

1. Download the `mini-services/caltex-bot/` directory from this repo
2. In the Pterodactyl **File Manager**, upload all files to `/home/container/`
3. Make sure `package.json`, `index.ts`, `tsconfig.json`, and the `src/` folder are at the root

### Step 4: Configure Environment Variables

Go to the server's **Startup** tab and set:

| Variable | Value | Required |
|----------|-------|----------|
| Bot Session ID | `CALTEX-R4QA-TWE4` (your ID) | ✅ Yes |
| Bot Owner Phone | `254104906247` (your number) | ✅ Yes |
| GitHub Token | `ghp_xxxxxxxxxxxx` | ✅ Yes |
| GitHub Repo Owner | `Caltex254` | ✅ Yes |
| GitHub Repo Name | `caltex-sessions` | ✅ Yes |
| Bot Name | `CALTEX MD` | Optional |
| Command Prefix | `.` | Optional |
| Auto Read Messages | `false` | Optional |
| Auto Typing | `false` | Optional |
| Anti Link | `false` | Optional |
| Log Level | `info` | Optional |

### Step 5: Start the Server

1. Click **Start** in the panel
2. Watch the console — you should see:
   ```
   [STARTUP] Reading BOT_SESSION_ID env var... value=CALTEX-R4QA-TWE4
   [STARTUP] BOT_SESSION_ID is valid
   [STARTUP] GitHub credential storage is configured
   [LIFECYCLE] Loading credentials...
   [LIFECYCLE] Credentials downloaded from GitHub
   [LIFECYCLE] connection.open — WhatsApp connection established
   ```
3. The bot is now connected! Check WhatsApp → Settings → Linked Devices

## Option B: Manual Setup (Generic Node.js Egg)

If you don't want to import the custom egg:

1. Create a server using the generic **Node.js** egg
2. Set the **Startup Command** to:
   ```
   if [ ! -d node_modules ]; then npm install --no-audit --no-fund; fi && npx tsx index.ts
   ```
3. Upload the bot files from `mini-services/caltex-bot/` to `/home/container/`
4. Set all environment variables (see Step 4 above)
5. Start the server

## Port Configuration

Pterodactyl assigns a dynamic port via the `SERVER_PORT` environment variable. The bot automatically reads this:

```typescript
const PORT = parseInt(process.env.PORT || process.env.SERVER_PORT || '3031', 10);
```

You don't need to manually configure the port — Pterodactyl handles it.

## Troubleshooting

### "BOT_SESSION_ID is not set"
- Go to the **Startup** tab in Pterodactyl
- Set the **Bot Session ID** variable to your `CALTEX-XXXX-XXXX` ID
- Restart the server

### "Could not restore credentials from GitHub"
- Verify `GITHUB_TOKEN` is set and has `repo` scope
- Verify `GITHUB_REPO_OWNER` and `GITHUB_REPO_NAME` are correct
- Check that the `caltex-sessions` repo exists and is private
- Verify the session ID exists in the repo: `https://github.com/Caltex254/caltex-sessions/blob/main/sessions/CALTEX-XXXX-XXXX.json`

### "npx tsx: command not found"
- The startup script auto-installs dependencies. If it fails:
  1. Go to the **File Manager**
  2. Delete the `node_modules` folder
  3. Restart the server (it will reinstall)

### "sharp module not found" or native build errors
- `sharp` is used for image processing (optional)
- If it fails to build, you can remove it from `package.json` — the bot will still work for text messages
- Or switch to a Pterodactyl egg with build tools installed

### Bot connects then disconnects immediately
- This is usually a **session conflict** — another service is using the same WhatsApp credentials
- Make sure only ONE bot instance is running with this session ID
- If you have the bot on Render too, either:
  - Stop the Render service, OR
  - Use a different session ID (pair again on the dashboard)

### Port already in use
- Pterodactyl assigns `SERVER_PORT` automatically
- If you get "EADDRINUSE", check that no other process is using the port
- The bot reads `SERVER_PORT` first, then `PORT`, then defaults to 3031

## File Structure on Pterodactyl

```
/home/container/
├── index.ts                    # Bot entry point
├── package.json                # Dependencies
├── tsconfig.json               # TypeScript config
├── pterodactyl-start.sh        # Pterodactyl startup script
├── start.sh                    # Generic startup script
├── src/
│   ├── connection.ts           # WhatsApp connection manager
│   ├── session-manager.ts      # Session persistence
│   ├── message-handler.ts      # Incoming message handler
│   ├── ai-handler.ts           # AI integration
│   ├── media-handler.ts        # Media processing
│   ├── group-manager.ts        # Group management
│   ├── anti-features.ts        # Anti-spam/anti-link
│   ├── scheduler.ts            # Scheduled messages
│   ├── api-client.ts           # Dashboard API client
│   ├── github-storage.ts       # GitHub credential storage
│   └── types.ts                # TypeScript types
├── auth_info_baileys/          # WhatsApp session (auto-created)
│   └── CALTEX-XXXX-XXXX/       # Credentials per session
├── logs/                       # Log files (auto-created)
└── media/                      # Downloaded media (auto-created)
```

## Resource Recommendations

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| Memory | 512 MB | 1024 MB |
| Disk | 1024 MB | 2048 MB |
| CPU | 50% | 100% |
| Swap | 0 MB | 256 MB |

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `BOT_SESSION_ID` | (required) | CALTEX-XXXX-XXXX session ID |
| `BOT_OWNER` | (required) | Owner phone number |
| `GITHUB_TOKEN` | (required) | GitHub PAT with repo scope |
| `GITHUB_REPO_OWNER` | `Caltex254` | GitHub repo owner |
| `GITHUB_REPO_NAME` | `caltex-sessions` | GitHub repo name |
| `BOT_NAME` | `CALTEX MD` | Bot display name |
| `BOT_PREFIX` | `.` | Command prefix |
| `BOT_PORT` | `3031` | HTTP API port (overridden by SERVER_PORT) |
| `NODE_ENV` | `production` | Node environment |
| `LOG_LEVEL` | `info` | Logging verbosity |
| `AUTO_READ` | `false` | Auto-read messages |
| `AUTO_TYPING` | `false` | Show typing indicator |
| `ANTI_LINK` | `false` | Delete links in groups |
| `ANTI_BADWORD` | `false` | Delete bad words |
| `ANTI_SPAM` | `false` | Anti-spam protection |

## Support

- GitHub: https://github.com/Caltex254/CALTEX-MD
- Dashboard: https://caltex-md.vercel.app
- Session API: https://caltex-session-api.onrender.com
