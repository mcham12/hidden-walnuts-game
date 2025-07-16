#!/bin/bash

# Script to list all relevant files in the repo, excluding clutter directories.
# Run this from the root of your repo.
# It will output the list to stdout and to 'repo_files.txt'.
# Excludes: node_modules, .git, dist, build, .vite, .wrangler, coverage, public/assets/models (binaries), public/assets/animations (binaries), public/assets/textures (images), .env*, package-lock.json, yarn.lock, docs/mvp-7, assets_metadata.json, test-results, .github, wrangler.toml, env.example, hide-walnut.sh, extract-assets-metadata.js, docs/GameVision.md, docs/README_AI.md, client/src/ENTERPRISE_ARCHITECTURE.md, client/src/ARCHITECTURE_README.md, *.md, *.html, *.test.ts, setup.ts, package.json, tsconfig.json, vite.config.ts, vitest.config.ts.

# Define output file
OUTPUT="repo_files.txt"

# Clear output file
> "$OUTPUT"

# Use find to list files, excluding clutter. Keep all exclusions as requested.
find . -type f \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  -not -path "*/dist/*" \
  -not -path "*/build/*" \
  -not -path "*/.vite/*" \
  -not -path "*/.wrangler/*" \
  -not -path "*/coverage/*" \
  -not -path "*/public/assets/models/*" \
  -not -path "*/public/assets/animations/*" \
  -not -path "*/public/assets/textures/*" \
  -not -path "*/docs/mvp-7/*" \
  -not -path "*/test-results/*" \
  -not -path "*/.github/*" \
  -not -name ".env*" \
  -not -name "package-lock.json" \
  -not -name "yarn.lock" \
  -not -name "assets_metadata.json" \
  -not -name "wrangler.toml" \
  -not -name "env.example" \
  -not -name "hide-walnut.sh" \
  -not -name "extract-assets-metadata.js" \
  -not -name "GameVision.md" \
  -not -name "README_AI.md" \
  -not -name "ENTERPRISE_ARCHITECTURE.md" \
  -not -name "ARCHITECTURE_README.md" \
  -not -name "*.md" \
  -not -name "*.html" \
  -not -name "*.test.ts" \
  -not -name "setup.ts" \
  -not -name "package.json" \
  -not -name "tsconfig.json" \
  -not -name "vite.config.ts" \
  -not -name "vitest.config.ts" \
  -print | tee "$OUTPUT"

echo "File list written to $OUTPUT. Total files: $(wc -l < "$OUTPUT")"