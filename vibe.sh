#!/bin/bash
set -e

TASK="$*"

echo "Aider: $TASK"

# 1. Edit + auto git add/commit
aider --model xai/grok-4-fast-reasoning --map-tokens 0 xai/grok-4-fast-reasoning \
      --auto-commit \
      --message "Aider: $TASK"

# 2. Local client build
echo "Building client..."
npm run build:client

# 3. Local worker build
echo "Building worker..."
cd workers && npm run build

# 4. Push to GitHub
echo "Pushing..."
git push origin $(git rev-parse --abbrev-ref HEAD)

echo "Done! Builds passed. GitHub Actions will deploy."
