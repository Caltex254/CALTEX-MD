#!/bin/sh
# ============================================================================
# WhatsApp Bot (whatsapp-web.js / Puppeteer) - Universal Startup Script
# ============================================================================
# Works with ANY whatsapp-web.js based bot. Auto-detects the entry file.
# Installs Chromium dependencies required by Puppeteer on the Yolks image.
#
# Optional env: BOT_PREFIX, STARTUP_FILE, PUPPETEER_SKIP_CHROMIUM_DOWNLOAD
# ============================================================================

echo "=========================================="
echo "  WhatsApp Bot (whatsapp-web.js) - Pterodactyl"
echo "=========================================="
echo "[$(date)] Working directory: $(pwd)"
echo "[$(date)] Node version: $(node --version 2>/dev/null || echo 'NOT FOUND')"

if ! command -v node >/dev/null 2>&1; then
    echo "[FATAL] Node.js runtime not found."
    exit 1
fi

cd /home/container 2>/dev/null || cd "$(dirname "$0")"

# --- Install Chromium deps (whatsapp-web.js uses Puppeteer) ---
# Works on Alpine (yolks:nodejs_*) and Debian (yolks:node_*)
if [ -f "/etc/alpine-release" ]; then
    echo "[$(date)] Alpine Linux detected — installing Chromium deps..."
    # Need to run as root for apk. On Pterodactyl containers, the user is
    # 'container' (UID 988) but apk may not be available. Try with sudo or
    # detect if we have permissions.
    if command -v apk >/dev/null 2>&1 && [ "$(id -u)" = "0" ]; then
        apk add --no-cache chromium nss freetype harfbuzz ttf-freefont 2>&1 | tail -10
    else
        echo "[WARN] Cannot install Chromium deps (not root or apk missing)."
        echo "[WARN] If your bot uses Puppeteer, it may fail to launch Chrome."
        echo "[WARN] Use ghcr.io/pterodactyl/yolks:node_20 (Debian) for full Puppeteer support."
    fi
else
    echo "[$(date)] Debian/Ubuntu image detected — installing Chromium deps..."
    if [ "$(id -u)" = "0" ] && command -v apt-get >/dev/null 2>&1; then
        apt-get update -y >/dev/null 2>&1 && \
        apt-get install -y --no-install-recommends \
            chromium chromium-driver \
            libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libxkbcommon0 \
            libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 \
            libpango-1.0-0 libcairo2 libasound2 2>&1 | tail -10
    else
        echo "[WARN] Cannot install Chromium deps (not root)."
    fi
fi

# --- Install npm dependencies ---
if [ -f "package.json" ]; then
    if [ ! -d "node_modules" ]; then
        echo "[$(date)] node_modules missing — running 'npm install'..."
        # whatsapp-web.js v1.x typically needs --legacy-peer-deps due to puppeteer conflicts
        npm install --no-audit --no-fund --loglevel=error --legacy-peer-deps 2>&1 | tail -20
        NPM_EXIT=$?
        if [ $NPM_EXIT -ne 0 ]; then
            echo "[FATAL] npm install failed (exit $NPM_EXIT)."
            exit 1
        fi
        echo "[$(date)] npm install completed."
    else
        echo "[$(date)] node_modules exists — skipping install."
    fi
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

# --- Tell Puppeteer where Chromium is (if installed via apk/apt) ---
if [ -z "$PUPPETEER_EXECUTABLE_PATH" ]; then
    for chrome in /usr/bin/chromium /usr/bin/chromium-browser /usr/bin/google-chrome \
                  /usr/lib/chromium/chrome /usr/lib/chromium-browser/chrome; do
        if [ -x "$chrome" ]; then
            export PUPPETEER_EXECUTABLE_PATH="$chrome"
            echo "[$(date)] Set PUPPETEER_EXECUTABLE_PATH=$chrome"
            break
        fi
    done
fi

# --- Ensure session folder exists (whatsapp-web.js default) ---
mkdir -p .wwebjs_auth .wwebjs_cache sessions 2>/dev/null

echo ""
echo "=========================================="
echo "  Starting WhatsApp Bot..."
echo "  Entry: $ENTRY"
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
