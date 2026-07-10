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
# ============================================================================

set -e

echo "=========================================="
echo "  CALTEX MD Bot - Pterodactyl Startup"
echo "=========================================="
echo "[$(date)] Container working directory: $(pwd)"
echo "[$(date)] Node version: $(node --version 2>/dev/null || echo 'not found')"
echo "[$(date)] npm version: $(npm --version 2>/dev/null || echo 'not found')"
echo "[$(date)] SERVER_PORT: ${SERVER_PORT:-'(not set)'}"
echo "[$(date)] BOT_SESSION_ID: ${BOT_SESSION_ID:+'***set***'}${BOT_SESSION_ID:-'(not set)'}"
echo "[$(date)] GITHUB_TOKEN: ${GITHUB_TOKEN:+'***set***'}${GITHUB_TOKEN:-'(not set)'}"
echo ""

# Verify required env vars
if [ -z "$BOT_SESSION_ID" ]; then
    echo "[FATAL] BOT_SESSION_ID is not set. Set it in the Pterodactyl panel (Startup tab)."
    echo "[FATAL] The bot needs a CALTEX-XXXX-XXXX session ID to auto-connect."
    exit 1
fi

if [ -z "$GITHUB_TOKEN" ]; then
    echo "[FATAL] GITHUB_TOKEN is not set. Set it in the Pterodactyl panel (Startup tab)."
    echo "[FATAL] The bot needs GitHub access to restore WhatsApp credentials."
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
