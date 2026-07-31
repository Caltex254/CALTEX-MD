#!/bin/bash
# ============================================================================
# CALTEX MD Bot - Pterodactyl Panel Startup Script
# ============================================================================
# This script is designed to run inside a Pterodactyl container.
# Pterodactyl sets:
#   - SERVER_PORT: the port the bot must listen on
#   - HOME: /home/container (the working directory)
#   - P_SERVER_* : various server metadata
#
# The script:
#   1. Validates required environment variables
#   2. Ensures dependencies are installed (via npm, NOT bun)
#   3. Starts the bot with `npx tsx index.ts`
#   4. Auto-restarts on crash (with exponential backoff)
#
# ── Connection modes ──
# The bot supports THREE connection modes (auto-detected at runtime):
#
#   A) AUTO-CONNECT (default on restart):
#      Local credentials exist at auth_info_baileys/<sessionId>/creds.json.
#      The bot just connects — no pairing code needed.
#
#   B) GITHUB RESTORE (legacy, still supported):
#      BOT_SESSION_ID is set to a CALTEX-XXXX-XXXX value AND GitHub env vars
#      are set. The bot downloads creds from GitHub, then connects.
#
#   C) INTERACTIVE PAIRING (default on first start):
#      No local creds, no valid CALTEX session ID. The bot uses the BOT_OWNER
#      env var (or prompts the user via stdin) for a phone number, then
#      generates a pairing code directly in the Pterodactyl console.
#
# ── Required env vars ──
#   BOT_OWNER         — phone number of the bot owner (e.g. 254712345678).
#                       Used both for owner-only commands AND as the default
#                       phone number for the interactive pairing flow.
#
# ── Optional env vars ──
#   BOT_SESSION_ID    — CALTEX-XXXX-XXXX for GitHub restore mode (legacy).
#   GITHUB_TOKEN      — for credential restore/upload (legacy).
#   GITHUB_REPO_OWNER — defaults to "Caltex254".
#   GITHUB_REPO_NAME  — defaults to "caltex-sessions".
#   BOT_NAME          — display name (defaults to "CALTEX MD").
#   BOT_PREFIX        — command prefix (defaults to ".").
#   AUTO_READ         — "true"/"false".
#   AUTO_TYPING       — "true"/"false".
#   ANTI_LINK         — "true"/"false".
#   LOG_LEVEL         — "debug"/"info"/"warn"/"error".
# ============================================================================

# NOTE: We intentionally do NOT use `set -e` for the whole script.
# `set -e` would cause the script to exit immediately when `npx tsx index.ts`
# returns a non-zero exit code (i.e. when the bot crashes), which would
# prevent the auto-restart loop below from ever running. Instead, we use
# explicit `|| { ...; exit 1; }` guards for setup steps that must succeed,
# and let the loop capture the bot's exit code itself.

echo "=========================================="
echo "  CALTEX MD Bot - Pterodactyl Startup"
echo "=========================================="
echo "[$(date)] Container working directory: $(pwd)"
echo "[$(date)] Node version: $(node --version 2>/dev/null || echo 'NOT FOUND — this image must be a Node.js image, not Java')"
echo "[$(date)] npm version:  $(npm --version  2>/dev/null || echo 'NOT FOUND')"
echo "[$(date)] SERVER_PORT: ${SERVER_PORT:-'(not set — bot will fall back to PORT env or 3031)'}"
# Print whether each secret is set WITHOUT leaking its value.
if [ -n "$BOT_OWNER" ]; then
    echo "[$(date)] BOT_OWNER: ***set*** (value hidden for security)"
else
    echo "[$(date)] BOT_OWNER: (NOT SET — required)"
fi
if [ -n "$BOT_SESSION_ID" ]; then
    echo "[$(date)] BOT_SESSION_ID: ***set*** (value hidden for security)"
else
    echo "[$(date)] BOT_SESSION_ID: (not set — will use interactive pairing)"
fi
if [ -n "$GITHUB_TOKEN" ]; then
    echo "[$(date)] GITHUB_TOKEN: ***set*** (value hidden for security)"
else
    echo "[$(date)] GITHUB_TOKEN: (not set — optional)"
fi
echo ""

# ── Sanity check: this MUST be a Node.js image, not Java ──
if ! command -v node >/dev/null 2>&1; then
    echo "[FATAL] Node.js runtime not found in this container."
    echo "[FATAL] This server is configured with the WRONG Docker image."
    echo "[FATAL] CALTEX MD requires the Node.js 20 image: ghcr.io/pterodactyl/yolks:node_20"
    echo "[FATAL] DO NOT use a Java/Minecraft image. DO NOT use server.jar."
    exit 1
fi
if command -v java >/dev/null 2>&1 && [ ! -f /home/container/package.json ] && [ ! -f package.json ]; then
    echo "[WARN] Java is present in this image but CALTEX MD does NOT use Java."
    echo "[WARN] Make sure the server egg is set to: ghcr.io/pterodactyl/yolks:node_20"
fi

# ── Required env var: BOT_OWNER ──
# It identifies the bot owner and is used as the default phone number for
# the interactive WhatsApp pairing code flow.
if [ -z "$BOT_OWNER" ]; then
    echo "[FATAL] BOT_OWNER is not set. Set it in the Pterodactyl panel (Startup tab)."
    echo "[FATAL] BOT_OWNER should be your phone number in international format, e.g. 254712345678."
    echo "[FATAL] It is used both for owner-only commands AND as the default phone number"
    echo "[FATAL] for the interactive WhatsApp pairing code flow."
    exit 1
fi

# ── Sanity check: index.ts must exist ──
if [ ! -f "index.ts" ]; then
    echo "[FATAL] index.ts not found in the working directory."
    echo "[FATAL] Expected location: /home/container/index.ts"
    echo "[FATAL] Make sure you uploaded the contents of mini-services/caltex-bot/ to the server."
    echo "[FATAL] See DEPLOYMENT-PTERODACTYL.md for file layout."
    exit 1
fi

# ── Sanity check: package.json must exist ──
if [ ! -f "package.json" ]; then
    echo "[FATAL] package.json not found in the working directory."
    echo "[FATAL] Expected location: /home/container/package.json"
    exit 1
fi

# Ensure we're in the right directory (Pterodactyl uses /home/container)
cd /home/container 2>/dev/null || cd "$(dirname "$0")"

# ── Install dependencies if missing ──
# Uses npm (NOT bun). The bot's package.json declares @whiskeysockets/baileys,
# tsx, pino, qrcode-terminal, etc. as dependencies.
if [ ! -d "node_modules" ]; then
    echo "[$(date)] node_modules not found — running 'npm install'..."
    npm install --no-audit --no-fund --loglevel=error || {
        echo "[FATAL] npm install failed. See logs above.";
        exit 1;
    }
    echo "[$(date)] Dependencies installed successfully."
else
    echo "[$(date)] node_modules exists — skipping install."
fi

# ── Verify tsx is available (the TypeScript runtime) ──
if [ ! -f "node_modules/.bin/tsx" ]; then
    echo "[$(date)] tsx not found — reinstalling dependencies..."
    npm install --no-audit --no-fund --loglevel=error || {
        echo "[FATAL] npm install failed while restoring tsx.";
        exit 1;
    }
fi

# ── Verify @whiskeysockets/baileys is installed ──
if [ ! -d "node_modules/@whiskeysockets/baileys" ]; then
    echo "[FATAL] @whiskeysockets/baileys is not installed."
    echo "[FATAL] Run 'npm install' manually or delete node_modules and restart."
    exit 1
fi

# ── Ensure the auth_info_baileys directory exists (credentials persistence) ──
mkdir -p auth_info_baileys

echo ""
echo "=========================================="
echo "  Starting CALTEX MD Bot..."
echo "  Runtime: Node.js $(node --version) + tsx"
echo "  Entry:   index.ts"
echo "=========================================="
echo ""

# ── Auto-restart loop with exponential backoff ──
# NO `set -e` here — we need to capture the bot's exit code so the restart
# loop can do its job. Setup steps above already have explicit error guards.
RETRY_COUNT=0
MAX_RETRIES=10
BASE_DELAY=5

while true; do
    # Run the bot. `npx tsx index.ts` compiles & runs index.ts on the fly.
    npx tsx index.ts
    EXIT_CODE=$?

    if [ $EXIT_CODE -eq 0 ]; then
        echo "[$(date)] Bot exited cleanly (code 0). Stopping container."
        break
    fi

    RETRY_COUNT=$((RETRY_COUNT + 1))

    if [ $RETRY_COUNT -gt $MAX_RETRIES ]; then
        echo "[$(date)] FATAL: Max retries ($MAX_RETRIES) exceeded. Giving up."
        echo "[$(date)] The bot has crashed $MAX_RETRIES times in a row."
        echo "[$(date)] Check the logs above for the root cause."
        exit 1
    fi

    DELAY=$((BASE_DELAY * (2 ** (RETRY_COUNT - 1))))
    if [ $DELAY -gt 300 ]; then
        DELAY=300
    fi

    echo "[$(date)] Bot crashed with code $EXIT_CODE."
    echo "[$(date)] Retry $RETRY_COUNT/$MAX_RETRIES in ${DELAY}s..."
    sleep $DELAY
done
