#!/bin/bash
# CALTEX MD Bot - Startup script (Node.js + tsx)
# Works on Render, Pterodactyl, and local development
cd "$(dirname "$0")"

echo "[$(date)] Starting CALTEX MD Bot (Node.js + tsx)..."

# Install dependencies if node_modules is missing
if [ ! -d "node_modules" ]; then
  echo "[$(date)] Installing dependencies..."
  npm install --no-audit --no-fund
fi

# Auto-restart loop
while true; do
  npx tsx index.ts 2>&1
  EXIT_CODE=$?
  echo "[$(date)] Bot exited with code $EXIT_CODE, restarting in 5s..."
  sleep 5
done
