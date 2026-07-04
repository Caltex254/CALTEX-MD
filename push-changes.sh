#!/bin/bash
# ============================================================================
# CALTEX MD - Push Script
# Run this script to push all local changes to GitHub
# Usage: bash push.sh <YOUR_GITHUB_TOKEN>
# ============================================================================

TOKEN="${1:-$GITHUB_TOKEN}"

if [ -z "$TOKEN" ]; then
  echo "❌ Error: GitHub token required!"
  echo ""
  echo "Usage: bash push.sh <YOUR_GITHUB_TOKEN>"
  echo ""
  echo "Create a token at: https://github.com/settings/tokens/new"
  echo "Required scopes: repo (full control of private repositories)"
  exit 1
fi

echo "🔧 Setting up git credentials..."
git remote set-url origin "https://Caltex254:${TOKEN}@github.com/Caltex254/CALTEX-MD.git"

echo "📦 Pushing to GitHub..."
git push origin main

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Successfully pushed to GitHub!"
  echo ""
  echo "What happens next:"
  echo "  • Vercel will auto-deploy the updated scan page"
  echo "  • Render will auto-deploy the updated Session API"
  echo ""
  echo "Scan page: https://caltex-md.vercel.app/scan"
  echo "Session API: https://caltex-session-api.onrender.com/health"
else
  echo ""
  echo "❌ Push failed. Check your token and try again."
fi

# Clean up the token from the remote URL
git remote set-url origin "https://Caltex254:@github.com/Caltex254/CALTEX-MD.git"
