# CALTEX MD — Pterodactyl Deploy Guide

This package contains **only** the files needed to run the CALTEX MD WhatsApp
bot on a Pterodactyl panel. The bot connects to WhatsApp using a phone-number
pairing code (no QR code scanning required) and persists credentials locally
so subsequent restarts auto-connect.

---

## 1. What's in this ZIP

```
caltex-pterodactyl/
├── index.ts                  # Bot entry point (run with tsx)
├── src/                      # Bot source code
│   ├── connection.ts         # Baileys WhatsApp connection + pairing code logic
│   ├── message-handler.ts    # Incoming message router
│   ├── ai-handler.ts         # AI reply handler
│   ├── anti-features.ts      # Anti-link, anti-spam, etc.
│   ├── media-handler.ts      # Image/video/audio processing
│   ├── group-manager.ts      # Group admin commands
│   ├── scheduler.ts          # Scheduled messages
│   ├── session-manager.ts    # Local session persistence
│   ├── api-client.ts         # HTTP API client for dashboard
│   ├── github-storage.ts     # Optional GitHub credential backup
│   └── types.ts              # TypeScript types
├── package.json              # Dependencies (Baileys, tsx, pino, ...)
├── package-lock.json         # Locked dependency tree
├── tsconfig.json
├── pterodactyl-start.sh      # Pterodactyl startup script (sh, NOT bash)
├── egg-caltex-bot.json       # Egg definition — import this into your panel
├── .env.example              # Example env vars
└── README-PTERODACTYL.md     # This file
```

---

## 2. Panel setup (one-time, admin)

1. Log in to your Pterodactyl panel as an admin.
2. Go to **Admin → Nests** and create a new nest called `CALTEX MD`
   (or reuse an existing one).
3. Go to **Admin → Eggs → Import Egg** and upload `egg-caltex-bot.json`.
4. Verify the egg shows:
   - **Docker image:** `ghcr.io/pterodactyl/yolks:nodejs_20`
   - **Startup command:** `sh pterodactyl-start.sh`

> The egg has 12 variables (BOT_OWNER, BOT_NAME, BOT_PREFIX, etc.).
> Only `BOT_NAME`, `BOT_PREFIX`, `AUTO_READ`, `AUTO_TYPING`, `ANTI_LINK`,
> `NODE_ENV`, and `LOG_LEVEL` are required — they all have sensible defaults.
> **BOT_OWNER is optional** — leave it blank to use the interactive pairing
> flow on first start.

---

## 3. Create a server

1. Go to **Admin → Servers → Create New**.
2. Select the CALTEX MD egg.
3. Allocate a port (any free port — the bot listens on it for HTTP health checks).
4. Set resource limits (256 MB RAM is enough; 512 MB recommended).
5. Leave `BOT_OWNER` blank — you'll pair interactively on first start.
6. Click **Create**.

---

## 4. Upload the bot files

1. In the panel, switch to the user view and open your new server.
2. Go to the **File Manager** tab.
3. Upload **all** files from this ZIP (the contents of `caltex-pterodactyl/`)
   to the server root (`/home/container/`).
4. Make sure `pterodactyl-start.sh` is executable (right-click → Permissions →
   check "Execute", or just leave it — the start script fixes it on first run).

> **Do NOT upload the entire CALTEX-MD GitHub repo.** Only the files in this
> ZIP are needed. Uploading the full repo will cause `npm install` to fail
> because the repo's `package.json` references dashboard dependencies that
> the bot doesn't use.

---

## 5. Start the server and pair

1. Click the **Start** button.
2. Watch the console. You'll see:

   ```
   ╔══════════════════════════════════════════════════════════════╗
   ║          CALTEX MD — FIRST-TIME WHATSAPP SETUP               ║
   ║                                                              ║
   ║   No existing WhatsApp session was found. To link this       ║
   ║   bot to a WhatsApp account, type the phone number below     ║
   ║   and press ENTER. A pairing code will be generated.         ║
   ║                                                              ║
   ║   Format: country code + number, no + or spaces.             ║
   ║   Examples: 254712345678  (Kenya)                           ║
   ║             2348012345678  (Nigeria)                        ║
   ║             14155552671    (USA)                            ║
   ╚══════════════════════════════════════════════════════════════╝

   Enter your WhatsApp phone number:
   ```

3. Type your phone number in international format (digits only, no `+`).
   - Kenya: `254712345678`
   - Nigeria: `2348012345678`
   - USA: `14155552671`
   - You can also type `0712345678` — the bot assumes Kenya and prepends `254`.

4. Press **Enter**. Within 5–15 seconds you'll see:

   ```
   ┌─────────────────────────────────────────────────────────┐
   │  Pairing code sent to WhatsApp servers for: 254712345678│
   │  Code: ABCD-1234                                        │
   │  Waiting for you to enter it on your phone...           │
   └─────────────────────────────────────────────────────────┘
   ```

5. Open WhatsApp on your phone:
   - **Settings → Linked Devices → Link a Device**
   - Tap **"Link with phone number instead"**
   - Type the code (e.g. `ABCD-1234`)
   - WhatsApp shows a popup confirming the device was linked

6. The bot receives the confirmation and sends you a WhatsApp message:

   ```
   🤖 CALTEX MD

   ✅ BOT CONNECTED SUCCESSFULLY

   Congratulations! 🎉
   Your CALTEX MD bot has been deployed successfully and is now online.
   ```

7. Test the bot by sending `.menu` to your own number (or any group you're in).

---

## 6. Subsequent restarts

Once paired, credentials are saved at:

```
/home/container/auth_info_baileys/<sessionId>/creds.json
```

On every restart after the first one, the bot detects the saved credentials
and auto-connects — no pairing code needed. You'll just see:

```
[STARTUP] Mode detection: { hasLocalCreds: true, mode: 'A (local creds)' }
[STARTUP] Auto-connecting with existing credentials...
[LIFECYCLE] connection.open — WhatsApp paired successfully
```

---

## 7. Troubleshooting

### "No popup on WhatsApp after entering the code"

This was a known issue in v1.2.0 and is **fixed in v1.3.0+**. The fix involves:

- Setting `markOnlineOnConnect = false` during the pairing flow (was `true`).
- Using `Browsers.ubuntu('CALTEX MD')` instead of `Browsers.appropriate()`
  (the latter returns undefined on Alpine/musl).
- Adding a 1.5s delay between the QR event and `requestPairingCode()` call
  so Baileys can fully register its noise keypair.
- Increasing `connectTimeoutMs` from 120s to 300s to give the user time.

If you still see this issue:
1. Stop the server.
2. Delete `/home/container/auth_info_baileys/` (clears stale creds).
3. Restart the server — it will prompt for the phone number again.
4. Make sure you type the **full international format** (e.g. `254712345678`,
   not `0712345678` if you're outside Kenya).

### "Container exits with code 2 — can't execute 'bash'"

Your egg is using the old startup `bash pterodactyl-start.sh`. Update the egg
in the panel to use `sh pterodactyl-start.sh` (or re-import
`egg-caltex-bot.json` v1.3.0+).

### "manifest unknown" when pulling Docker image

The egg references `ghcr.io/pterodactyl/yolks:nodejs_20` (NOT `node_20`).
The tag `node_20` does not exist in the GHCR registry. If you see this error,
re-import `egg-caltex-bot.json` v1.3.0+.

### Bot crashes with "Cannot find module '@whiskeysockets/baileys'"

The `node_modules` directory wasn't installed. The start script runs
`npm install` automatically on first run. If `npm install` itself fails:
1. Stop the server.
2. Open the File Manager.
3. Delete `node_modules/` and `package-lock.json`.
4. Start the server again.

### "Too many invalid phone number attempts — exiting"

You typed 5 invalid phone numbers in a row. Stop and restart the server to
try again. Valid formats:
- `254712345678` (Kenya, full international)
- `0712345678` (Kenya, local — bot converts to `254712345678`)
- `+254712345678` (the `+` is stripped)
- `00254712345678` (the `00` is stripped)
- `2348012345678` (Nigeria, full international)

---

## 8. Need more help?

- Open an issue: <https://github.com/Caltex254/CALTEX-MD/issues>
- Read the full deployment docs in the main repo: `DEPLOYMENT-PTERODACTYL.md`
- Check the troubleshooting guide: `TROUBLESHOOTING.md`
