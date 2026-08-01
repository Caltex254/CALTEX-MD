#!/bin/sh
# ============================================================================
# WhatsApp Bot (Baileys / @whiskeysockets/baileys) - Universal Startup Script
# ============================================================================
# Works with ANY Baileys-based WhatsApp bot. Auto-detects the entry file.
# Supports the interactive pairing-code flow on first start.
#
# Required env: BOT_PHONE (phone number for pairing code)
# Optional env: BOT_PREFIX, BOT_OWNER, BOT_NAME, STARTUP_FILE, AUTO_RESTART
# ============================================================================

echo "=========================================="
echo "  WhatsApp Bot (Baileys) - Pterodactyl"
echo "=========================================="
echo "[$(date)] Working directory: $(pwd)"
echo "[$(date)] Node version: $(node --version 2>/dev/null || echo 'NOT FOUND')"

if ! command -v node >/dev/null 2>&1; then
    echo "[FATAL] Node.js runtime not found. Use a Node.js Yolks image:"
    echo "[FATAL]   ghcr.io/pterodactyl/yolks:nodejs_20  (Alpine)"
    echo "[FATAL]   ghcr.io/pterodactyl/yolks:node_20    (Debian)"
    exit 1
fi

cd /home/container 2>/dev/null || cd "$(dirname "$0")"

# --- Install dependencies ---
if [ -f "package.json" ]; then
    if [ ! -d "node_modules" ]; then
        echo "[$(date)] node_modules missing — running 'npm install'..."
        npm install --no-audit --no-fund --loglevel=error 2>&1 | tail -20
        NPM_EXIT=$?
        if [ $NPM_EXIT -ne 0 ]; then
            echo "[FATAL] npm install failed (exit $NPM_EXIT)."
            exit 1
        fi
        echo "[$(date)] npm install completed."
    else
        echo "[$(date)] node_modules exists — skipping install."
    fi
else
    echo "[WARN] No package.json found."
fi

# --- Make sure baileys is installed (if not, install it) ---
if [ -f "package.json" ] && [ ! -d "node_modules/@whiskeysockets/baileys" ] && [ ! -d "node_modules/baileys" ]; then
    echo "[$(date)] @whiskeysockets/baileys not installed — installing..."
    npm install --no-save @whiskeysockets/baileys 2>&1 | tail -5
fi

# --- Make sure tsx is available if entry is .ts ---
if [ -f "index.ts" ] || [ -f "bot.ts" ] || [ -f "app.ts" ] || [ -f "main.ts" ]; then
    if [ ! -x "node_modules/.bin/tsx" ]; then
        echo "[$(date)] TypeScript entry detected — installing tsx..."
        npm install --no-save tsx 2>&1 | tail -5
    fi
fi

# --- Detect entry file ---
ENTRY=""
if [ -n "$STARTUP_FILE" ] && [ -f "$STARTUP_FILE" ]; then
    ENTRY="$STARTUP_FILE"
else
    for f in index.ts bot.ts app.ts main.ts src/index.ts src/bot.ts \
             index.js bot.js app.js main.js src/index.js src/bot.js; do
        if [ -f "$f" ]; then
            ENTRY="$f"
            break
        fi
    done
fi

if [ -z "$ENTRY" ]; then
    echo "[FATAL] Could not detect entry file."
    echo "[FATAL] Set STARTUP_FILE env var or upload index.ts/bot.ts/app.ts/etc."
    exit 1
fi

RUN_CMD=""
case "$ENTRY" in
    *.ts)
        if [ -x "node_modules/.bin/tsx" ]; then
            RUN_CMD="node_modules/.bin/tsx $ENTRY"
        else
            RUN_CMD="npx tsx $ENTRY"
        fi
        ;;
    *.js)
        RUN_CMD="node $ENTRY"
        ;;
esac

# --- Ensure auth folder exists (for credential persistence) ---
mkdir -p auth_info_baileys auth 2>/dev/null

echo ""
echo "=========================================="
echo "  Starting WhatsApp Bot..."
echo "  Entry: $ENTRY"
echo "  Phone: ${BOT_PHONE:-(not set — bot may prompt)}"
echo "  Prefix: ${BOT_PREFIX:-.}"
echo "=========================================="
echo ""

# --- Auto-restart loop ---
RETRY_COUNT=0
MAX_RETRIES=${MAX_RETRIES:-10}
BASE_DELAY=${BASE_DELAY:-5}

while true; do
    sh -c "$RUN_CMD"
    EXIT_CODE=$?

    if [ $EXIT_CODE -eq 0 ]; then
        echo "[$(date)] Bot exited cleanly."
        break
    fi

    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -gt $MAX_RETRIES ]; then
        echo "[$(date)] FATAL: Max retries ($MAX_RETRIES) exceeded."
        exit 1
    fi

    DELAY=$BASE_DELAY
    i=1
    while [ $i -lt $RETRY_COUNT ]; do
        DELAY=$((DELAY * 2))
        i=$((i + 1))
    done
    if [ $DELAY -gt 300 ]; then DELAY=300; fi

    echo "[$(date)] Bot crashed (code $EXIT_CODE). Retry $RETRY_COUNT/$MAX_RETRIES in ${DELAY}s..."
    sleep $DELAY
done
