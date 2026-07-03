#!/bin/bash
cd "$(dirname "$0")"
echo "[$(date)] Starting CALTEX MD Bot..."
while true; do
  bun index.ts 2>&1
  EXIT_CODE=$?
  echo "[$(date)] Bot exited with code $EXIT_CODE, restarting in 5s..."
  sleep 5
done
