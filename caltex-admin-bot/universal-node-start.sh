#!/bin/sh
# ============================================================================
# Universal Node.js Bot Startup Script for Pterodactyl
# ============================================================================
# Works with ANY Node.js bot: WhatsApp (Baileys / whatsapp-web.js), Telegram,
# Discord, Slack, IRC, or any other framework. Auto-detects the entry file.
#
# Detection order (first match wins):
#   1. STARTUP_FILE env var (if set)
#   2. package.json "scripts.start" / "scripts.bot"
#   3. index.ts → tsx index.ts
#   4. index.js → node index.js
#   5. bot.ts / bot.js / app.ts / app.js / main.ts / main.js / src/index.ts
#
# Auto-restarts on crash with exponential backoff (configurable).
# ============================================================================

# NOTE: POSIX sh only. No bashisms. Works on Alpine (yolks:nodejs_*) and Debian.

echo "=========================================="
echo "  Universal Node.js Bot - Pterodactyl"
echo "=========================================="
echo "[$(date)] Working directory: $(pwd)"
echo "[$(date)] Node version: $(node --version 2>/dev/null || echo 'NOT FOUND')"
echo "[$(date)] npm version:  $(npm --version  2>/dev/null || echo 'NOT FOUND')"

# --- Sanity check: Node.js must exist ---
if ! command -v node >/dev/null 2>&1; then
    echo "[FATAL] Node.js runtime not found. Use a Node.js Yolks image:"
    echo "[FATAL]   ghcr.io/pterodactyl/yolks:nodejs_20  (Alpine)"
    echo "[FATAL]   ghcr.io/pterodactyl/yolks:node_20    (Debian)"
    exit 1
fi

cd /home/container 2>/dev/null || cd "$(dirname "$0")"

# --- Install dependencies if missing ---
# Note: npm install succeeds even with no deps, but doesn't create node_modules
# in that case. So we check the exit code, not the directory.
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
    echo "[WARN] No package.json found. Will try to run entry file directly."
fi

# --- Detect entry file ---
ENTRY=""
RUN_CMD=""

# 1. Honor STARTUP_FILE env override
if [ -n "$STARTUP_FILE" ]; then
    if [ -f "$STARTUP_FILE" ]; then
        ENTRY="$STARTUP_FILE"
        # Also set RUN_CMD based on file extension
        case "$ENTRY" in
            *.ts)
                if [ -x "node_modules/.bin/tsx" ]; then
                    RUN_CMD="node_modules/.bin/tsx $ENTRY"
                elif [ -x "node_modules/.bin/ts-node" ]; then
                    RUN_CMD="node_modules/.bin/ts-node $ENTRY"
                else
                    RUN_CMD="npx tsx $ENTRY"
                fi
                ;;
            *.js)
                RUN_CMD="node $ENTRY"
                ;;
            *)
                # If STARTUP_FILE is something like "npm start" or a non-file command,
                # use it directly
                RUN_CMD="$ENTRY"
                ;;
        esac
    else
        echo "[WARN] STARTUP_FILE=$STARTUP_FILE not found — falling back to auto-detect."
    fi
fi

# 2. Try package.json scripts
if [ -z "$ENTRY" ] && [ -f "package.json" ]; then
    HAS_START=$(node -e "const p=require('./package.json'); console.log(p.scripts && p.scripts.start ? 'yes' : 'no')" 2>/dev/null)
    if [ "$HAS_START" = "yes" ] && [ -z "$SKIP_NPM_START" ]; then
        RUN_CMD="npm start"
        ENTRY="npm start"
    fi
fi

# 3. Auto-detect entry file
if [ -z "$ENTRY" ] && [ -z "$RUN_CMD" ]; then
    for f in index.ts bot.ts app.ts main.ts src/index.ts src/bot.ts src/app.ts \
             index.js bot.js app.js main.js src/index.js src/bot.js src/app.js; do
        if [ -f "$f" ]; then
            ENTRY="$f"
            break
        fi
    done

    if [ -n "$ENTRY" ]; then
        case "$ENTRY" in
            *.ts)
                # Use tsx if available, fall back to ts-node, then npx tsx
                if [ -x "node_modules/.bin/tsx" ]; then
                    RUN_CMD="node_modules/.bin/tsx $ENTRY"
                elif [ -x "node_modules/.bin/ts-node" ]; then
                    RUN_CMD="node_modules/.bin/ts-node $ENTRY"
                else
                    echo "[$(date)] TypeScript entry detected but tsx/ts-node not installed. Installing tsx..."
                    npm install --no-save tsx 2>&1 | tail -5
                    RUN_CMD="npx tsx $ENTRY"
                fi
                ;;
            *.js)
                RUN_CMD="node $ENTRY"
                ;;
        esac
    fi
fi

if [ -z "$ENTRY" ]; then
    echo "[FATAL] Could not detect entry file."
    echo "[FATAL] Looked for: index.ts, index.js, bot.ts, bot.js, app.ts, app.js,"
    echo "[FATAL]            main.ts, main.js, src/index.ts, src/index.js, src/bot.*"
    echo "[FATAL] Either upload your bot files, or set STARTUP_FILE env var."
    exit 1
fi

echo ""
echo "=========================================="
echo "  Starting bot..."
echo "  Entry: $ENTRY"
echo "  Command: $RUN_CMD"
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
        echo "[$(date)] Bot exited cleanly. Stopping container."
        break
    fi

    RETRY_COUNT=$((RETRY_COUNT + 1))

    if [ $RETRY_COUNT -gt $MAX_RETRIES ]; then
        echo "[$(date)] FATAL: Max retries ($MAX_RETRIES) exceeded."
        exit 1
    fi

    # POSIX sh doesn't support ** — use a portable exponentiation
    DELAY=$BASE_DELAY
    i=1
    while [ $i -lt $RETRY_COUNT ]; do
        DELAY=$((DELAY * 2))
        i=$((i + 1))
    done
    if [ $DELAY -gt 300 ]; then
        DELAY=300
    fi

    echo "[$(date)] Bot crashed (code $EXIT_CODE). Retry $RETRY_COUNT/$MAX_RETRIES in ${DELAY}s..."
    sleep $DELAY
done
