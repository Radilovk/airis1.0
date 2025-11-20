#!/bin/bash
# Auto sync script - Синхронизира промени от Spark към airis1.0 repo

set -e

echo "🔄 Starting sync to airis1.0..."

# Check if there are changes
if [[ -z $(git status -s) ]]; then
  echo "✓ No changes to sync"
  exit 0
fi

# Stage all changes
echo "📦 Staging changes..."
git add -A

# Get commit message from last Spark iteration or use default
LAST_COMMIT=$(git log -1 --pretty=%B 2>/dev/null || echo "Spark update")
COMMIT_MSG="${LAST_COMMIT}"

# Commit changes
echo "💾 Committing: ${COMMIT_MSG}"
git commit -m "${COMMIT_MSG}" || echo "Nothing to commit"

# Push to both remotes
echo "🚀 Pushing to origin (main)..."
git push origin main 2>/dev/null || echo "Origin push skipped"

echo "🚀 Pushing to airis1.0..."
git push airis1.0 main --force

echo "✅ Sync completed successfully!"
echo "📍 View changes at: https://github.com/Radilovk/airis1.0"
