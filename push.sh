#!/bin/bash
# Push CALTEX MD to GitHub
# Usage: ./push.sh <GITHUB_TOKEN>
# 
# Get your token from: https://github.com/settings/tokens
# Required scopes: repo (full control)

if [ -z "$1" ]; then
    echo "❌ Usage: ./push.sh <GITHUB_TOKEN>"
    echo ""
    echo "Get your token at: https://github.com/settings/tokens/new"
    echo "Required scope: repo"
    exit 1
fi

TOKEN="$1"
REPO="Caltex254/CALTEX-MD"
BRANCH="main"

cd /home/z/my-project

# Set remote with token
git remote set-url origin "https://${TOKEN}@github.com/${REPO}.git"

# Push
echo "🚀 Pushing to GitHub..."
git push origin ${BRANCH}

if [ $? -eq 0 ]; then
    echo "✅ Push successful!"
    echo "🔗 https://github.com/${REPO}"
    # Remove token from remote URL for security
    git remote set-url origin "https://github.com/${REPO}.git"
else
    echo "❌ Push failed. Check your token."
    git remote set-url origin "https://github.com/${REPO}.git"
fi
