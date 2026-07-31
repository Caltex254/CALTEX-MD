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
#   1. Ensures dependencies are installed
#   2. Starts the bot with npx tsx
#   3. Auto-restarts on crash (with backoff)
#
# ── Connection modes ──
# The bot now supports THREE connection modes (auto-detected at runtime):
#
#   A) AUTO-CONNECT (default on restart):
#      Local credentials exist at auth_info_baileys/<sessionId>/creds.json.
#      The bot just connects — no pairing code needed.
#
#   B) GITHUB RESTORE (legacy, still supported):
#      BOT_SESSION_ID is set to a CALTEX-XXXX-XXXX value AND GitHub env vars are set.
#      The bot downloads creds from GitHub, then connects.
#
#   C) INTERACTIVE PAIRING (new!):
#      No local creds, no valid CALTEX session ID. The bot uses BOT_OWNER env var
#      (or prompts the user via stdin) for a phone number, then generates a
#      pairing code directly on Pterodactyl — no Render or Vercel needed.
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
#   BOT_PREFIX        — command prefix (defaults to ".").
#   AUTO_READ         — "true"/"false".
#   AUTO_TYPING       — "true"/"false".
#   ANTI_LINK         — "true"/"false".
#   LOG_LEVEL         — "debug"/"info"/"warn"/"error".
# ============================================================================

set -e

echo "=========================================="
echo "  CALTEX MD Bot - Pterodactyl Startup"
echo "=========================================="
echo "[$(date)] Container working directory: $(pwd)"
echo "[$(date)] Node version: $(node --version 2>/dev/null || echo 'not found')"
echo "[$(date)] npm version: $(npm --version 2>/dev/null || echo 'not found')"
echo "[$(date)] SERVER_PORT: ${SERVER_PORT:-'(not set)'}"
echo "[$(date)] BOT_OWNER: ${BOT_OWNER:+'***set***'}${BOT_OWNER:-'(not set)'}"
echo "[$(date)] BOT_SESSION_ID: ${BOT_SESSION_ID:+'***set***'}${BOT_SESSION_ID:-'(not set — will use interactive pairing)'}"
echo "[$(date)] GITHUB_TOKEN: ${GITHUB_TOKEN:+'***set***'}${GITHUB_TOKEN:-'(not set — optional)'}"
echo ""

# BOT_OWNER is the only required env var — it identifies the bot owner
# and is used as the default phone number for the interactive pairing flow.
if [ -z "$BOT_OWNER" ]; then
    echo "[FATAL] BOT_OWNER is not set. Set it in the Pterodactyl panel (Startup tab)."
    echo "[FATAL] BOT_OWNER should be your phone number in international format, e.g. 254712345678."
    echo "[FATAL] It is used both for owner-only commands AND as the default phone number"
    echo "[FATAL] for the interactive WhatsApp pairing code flow."
    exit 1
fi

# Ensure we're in the right directory (Pterodactyl uses /home/container)
cd /home/container 2>/dev/null || cd "$(dirname "$0")"

# Install dependencies if missing
if [ ! -d "node_modules" ]; then
    echo "[$(date)] node_modules not found — running npm install..."
    npm install --no-audit --no-fund
    echo "[$(date)] Dependencies installed."
else
    echo "[$(date)] node_modules exists — skipping install."
fi

# Verify tsx is available
if [ ! -f "node_modules/.bin/tsx" ]; then
    echo "[$(date)] tsx not found — reinstalling dependencies..."
    npm install --no-audit --no-fund
fi

echo ""
echo "=========================================="
echo "  Starting CALTEX MD Bot..."
echo "=========================================="
echo ""

# Auto-restart loop with exponential backoff
RETRY_COUNT=0
MAX_RETRIES=10
BASE_DELAY=5

while true; do
    npx tsx index.ts
    EXIT_CODE=$?

    if [ $EXIT_CODE -eq 0 ]; then
        echo "[$(date)] Bot exited cleanly (code 0). Stopping."
        break
    fi

    RETRY_COUNT=$((RETRY_COUNT + 1))

    if [ $RETRY_COUNT -gt $MAX_RETRIES ]; then
        echo "[$(date)] FATAL: Max retries ($MAX_RETRIES) exceeded. Giving up."
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
