#!/bin/bash

# Script to list documentation and configuration files in the repo.
# Run this from the root of your repo.
# It will output the list to stdout and to 'docs_files.txt'.
# Includes: *.md, *.html, *.json, *.ts (config files), *.yml, *.yaml, *.toml

# Define output file
OUTPUT="docs_files.txt"

# Clear output file
> "$OUTPUT"

# Use find to list documentation and config files only
find . -type f \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  -not -path "*/dist/*" \
  -not -path "*/build/*" \
  -not -path "*/.vite/*" \
  -not -path "*/.wrangler/*" \
  -not -path "*/coverage/*" \
  -not -path "*/public/assets/*" \
  -not -path "*/test-results/*" \
  -not -path "*/.github/*" \
  -not -path "*/client/src/*" \
  -not -path "*/workers/objects/*" \
  -not -path "*/workers/api.ts" \
  -not -path "*/workers/types.ts" \
  -not -path "*/workers/Logger.ts" \
  -not -path "*/workers/constants.ts" \
  -not -path "*/client/src/core/*" \
  -not -path "*/client/src/ecs/*" \
  -not -path "*/client/src/entities/*" \
  -not -path "*/client/src/rendering/*" \
  -not -path "*/client/src/services/*" \
  -not -path "*/client/src/systems/*" \
  -not -path "*/client/src/terrain.ts" \
  -not -path "*/client/src/forest.ts" \
  -not -path "*/client/src/main.ts" \
  -not -path "*/client/src/GameComposition.ts" \
  -not -path "*/client/src/types.ts" \
  -not -path "*/client/src/vite-env.d.ts" \
  -not -path "*/client/src/style.css" \
  -not -path "*/docs/mvp-7/tasks/*" \
  -not -name ".env*" \
  -not -name "package-lock.json" \
  -not -name "yarn.lock" \
  -not -name "assets_metadata.json" \
  -not -name "extract-assets-metadata.js" \
  -not -name "hide-walnut.sh" \
  -not -name "list-repo-files.sh" \
  -not -name "concat_repo_files.sh" \
  -not -name "list-docs-files.sh" \
  -not -name "concat-docs-files.sh" \
  -not -name "repo_files.txt" \
  -not -name "code_bundle.txt" \
  -not -name "docs_files.txt" \
  -not -name "docs_bundle.txt" \
  \( -name "*.md" -o -name "*.html" -o -name "*.json" -o -name "*.yml" -o -name "*.yaml" -o -name "*.toml" -o -name "*.ts" \) \
  -print | tee "$OUTPUT"

echo "Documentation files list written to $OUTPUT. Total files: $(wc -l < "$OUTPUT")" 