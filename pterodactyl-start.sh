#!/bin/sh
# ============================================================================
# CALTEX MD Bot - Pterodactyl Panel Startup Script (v1.7.0 — rate-limit aware)
# ============================================================================
# v1.7.0: When the bot detects WhatsApp rate-limiting (401 loggedOut /
#         device_removed during pairing), it exits cleanly with code 0.
#         This script treats exit 0 as "user-initiated stop" and does NOT
#         auto-restart — the user must manually click "Start" on the panel
#         after waiting 1-12 hours for WhatsApp's rate-limit to expire.
#
# v1.6.0: This script is silent on success. Only prints on errors or restart.
# The bot itself prints the clean startup banner:
#   === WHATSAPP BOT STARTED ===
#   Waiting for WhatsApp number...
#   Enter number with country code:
#
# Connection modes (auto-detected at runtime):
#   A) AUTO-CONNECT: Local creds exist — bot connects directly.
#   B) GITHUB RESTORE: BOT_SESSION_ID + GitHub env — bot downloads creds.
#   C) INTERACTIVE PAIRING: No creds — bot prompts for phone number.
#
# Optional env vars:
#   BOT_OWNER         — phone number for pairing (skips the prompt).
#   BOT_SESSION_ID    — CALTEX-XXXX-XXXX for GitHub restore mode.
#   GITHUB_TOKEN      — for credential restore/upload.
#   GITHUB_REPO_OWNER — defaults to "Caltex254".
#   GITHUB_REPO_NAME  — defaults to "caltex-sessions".
#   LOG_LEVEL         — "warn" (default) / "info" / "debug".
# ============================================================================

# NOTE: No `set -e` — the auto-restart loop needs to capture the bot's exit code.

# ── Load .env file from /home/container/ if it exists ──
if [ -f /home/container/.env ]; then
    while IFS='=' read -r key value || [ -n "$key" ]; do
        case "$key" in
            ''|\#*) continue ;;
        esac
        key=$(echo "$key" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        value=$(echo "$value" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//;s/^"//;s/"$//;s/^'\''//;s/'\''$//')
        if [ -z "$(eval echo \"\$$key\")" ]; then
            export "$key=$value"
        fi
    done < /home/container/.env
fi

# ── Sanity checks (silent on success, fatal on failure) ──
if ! command -v node >/dev/null 2>&1; then
    echo "[FATAL] Node.js runtime not found. Use ghcr.io/pterodactyl/yolks:nodejs_20 image."
    exit 1
fi
if [ ! -f "index.ts" ]; then
    echo "[FATAL] index.ts not found in /home/container/."
    exit 1
fi
if [ ! -f "package.json" ]; then
    echo "[FATAL] package.json not found in /home/container/."
    exit 1
fi

# Ensure we're in the right directory
cd /home/container 2>/dev/null || cd "$(dirname "$0")"

# ── Install dependencies if missing (silent on success) ──
if [ ! -d "node_modules" ]; then
    npm install --no-audit --no-fund --loglevel=error >/dev/null 2>&1 || {
        echo "[FATAL] npm install failed. Run 'npm install' manually to see the error.";
        exit 1;
    }
fi

# ── Verify tsx and baileys are installed ──
if [ ! -f "node_modules/.bin/tsx" ] || [ ! -d "node_modules/@whiskeysockets/baileys" ]; then
    npm install --no-audit --no-fund --loglevel=error >/dev/null 2>&1 || {
        echo "[FATAL] npm install failed while restoring dependencies.";
        exit 1;
    }
fi

# ── Ensure auth_info_baileys directory exists ──
mkdir -p auth_info_baileys

# ── Auto-restart loop with exponential backoff ──
# v1.7.0: Reduced MAX_RETRIES from 10 to 3, increased BASE_DELAY from 5 to 30.
#         Exit code 0 = bot shut down cleanly (e.g. rate-limit detected) —
#         do NOT restart, the user must manually click "Start" on the panel.
#         Exit code non-zero = bot crashed — retry with backoff.
RETRY_COUNT=0
MAX_RETRIES=3
BASE_DELAY=30

while true; do
    # Run the bot. All stdout/stderr goes to the Pterodactyl console.
    npx tsx index.ts
    EXIT_CODE=$?

    if [ $EXIT_CODE -eq 0 ]; then
        # v1.7.0: Exit 0 = clean shutdown (rate-limit detected, or user pressed Ctrl-C).
        # Do NOT auto-restart — user must manually click "Start" on the panel.
        break
    fi

    RETRY_COUNT=$((RETRY_COUNT + 1))

    if [ $RETRY_COUNT -gt $MAX_RETRIES ]; then
        echo "[FATAL] Max retries ($MAX_RETRIES) exceeded. Bot has crashed $MAX_RETRIES times in a row."
        echo "[FATAL] If the bot is failing to pair, please WAIT 1-12 hours for"
        echo "[FATAL] WhatsApp's rate-limit to expire, then click Start on the panel."
        exit 1
    fi

    DELAY=$((BASE_DELAY * (2 ** (RETRY_COUNT - 1))))
    if [ $DELAY -gt 300 ]; then
        DELAY=300
    fi

    echo "[CRASH] Bot exited with code $EXIT_CODE. Retry $RETRY_COUNT/$MAX_RETRIES in ${DELAY}s..."
    sleep $DELAY
done
