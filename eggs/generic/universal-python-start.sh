#!/bin/sh
# ============================================================================
# Universal Python Bot Startup Script for Pterodactyl
# ============================================================================
# Works with ANY Python bot: WhatsApp (whatsapp-web.py, baileys-python wrappers),
# Telegram (python-telegram-bot, aiogram, telethon), Discord (discord.py, nextcord,
# py-cord), Slack (slack-bolt), IRC, or any other framework.
#
# Detection order (first match wins):
#   1. STARTUP_FILE env var (if set)
#   2. main.py > bot.py > app.py > run.py > start.py > src/main.py > src/bot.py
#
# Auto-installs requirements.txt / Pipfile / pyproject.toml deps if present.
# Auto-restarts on crash with exponential backoff (configurable).
# ============================================================================

echo "=========================================="
echo "  Universal Python Bot - Pterodactyl"
echo "=========================================="
echo "[$(date)] Working directory: $(pwd)"
echo "[$(date)] Python version: $(python3 --version 2>/dev/null || echo 'NOT FOUND')"
echo "[$(date)] pip version:     $(pip3 --version 2>/dev/null || echo 'NOT FOUND')"

if ! command -v python3 >/dev/null 2>&1; then
    echo "[FATAL] Python 3 runtime not found. Use a Python Yolks image:"
    echo "[FATAL]   ghcr.io/pterodactyl/yolks:python_3_11"
    echo "[FATAL]   ghcr.io/pterodactyl/yolks:python_3_12"
    exit 1
fi

cd /home/container 2>/dev/null || cd "$(dirname "$0")"

# --- Install dependencies ---
if [ -f "requirements.txt" ]; then
    echo "[$(date)] Installing requirements.txt..."
    pip3 install --no-cache-dir --user -r requirements.txt 2>&1 | tail -20
    echo "[$(date)] Done."
elif [ -f "Pipfile" ]; then
    echo "[$(date)] Pipfile found — installing pipenv and deps..."
    pip3 install --no-cache-dir --user pipenv 2>&1 | tail -5
    export PIPENV_VENV_IN_PROJECT=1
    python3 -m pipenv install 2>&1 | tail -20
elif [ -f "pyproject.toml" ]; then
    echo "[$(date)] pyproject.toml found — installing poetry and deps..."
    pip3 install --no-cache-dir --user poetry 2>&1 | tail -5
    python3 -m poetry install --no-root 2>&1 | tail -20
else
    echo "[$(date)] No dependency file found (requirements.txt/Pipfile/pyproject.toml)."
fi

# --- Detect entry file ---
ENTRY=""

if [ -n "$STARTUP_FILE" ]; then
    if [ -f "$STARTUP_FILE" ]; then
        ENTRY="$STARTUP_FILE"
    else
        echo "[WARN] STARTUP_FILE=$STARTUP_FILE not found — falling back to auto-detect."
    fi
fi

if [ -z "$ENTRY" ]; then
    for f in main.py bot.py app.py run.py start.py whbot.py whatsapp.py \
             src/main.py src/bot.py src/app.py src/run.py; do
        if [ -f "$f" ]; then
            ENTRY="$f"
            break
        fi
    done
fi

if [ -z "$ENTRY" ]; then
    echo "[FATAL] Could not detect Python entry file."
    echo "[FATAL] Looked for: main.py, bot.py, app.py, run.py, start.py, src/*.py"
    echo "[FATAL] Either upload your bot files, or set STARTUP_FILE env var."
    exit 1
fi

# Choose runner (poetry/pipenv/venv/plain python3)
RUN_CMD=""
if [ -d ".venv" ] && [ -x ".venv/bin/python" ]; then
    RUN_CMD=".venv/bin/python $ENTRY"
elif [ -f "Pipfile" ] && command -v pipenv >/dev/null 2>&1; then
    RUN_CMD="python3 -m pipenv run python $ENTRY"
elif [ -f "pyproject.toml" ] && command -v poetry >/dev/null 2>&1; then
    RUN_CMD="python3 -m poetry run python $ENTRY"
else
    RUN_CMD="python3 $ENTRY"
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
