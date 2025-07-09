```bash
#!/bin/bash

# Output file for concatenated contents
OUTPUT_FILE="repo_files.txt"

# List of key files for MVP-8a (excluding unhelpful files like node_modules, dist, .DS_Store)
FILES=(
  "README.md"
  "GameVision.md"
  "docs/MVP_Plan_Hidden_Walnuts-2.md"
  "docs/conventions.md"
  "package.json"
  "tsconfig.json"
  "wrangler.toml"
  "client/vite.config.ts"
  "client/src/main.ts"
  "client/src/core/types.ts"
  "client/src/entities/PlayerFactory.ts"
  "client/src/animation/PlayerAnimationController.ts"
  "client/src/network/WebSocketClient.ts"
  "client/src/rendering/IRenderAdapter.ts"
  "client/src/systems/RenderSystem.ts"
  "client/src/systems/NetworkSystem.ts"
  "client/src/test/multiplayer-sync.test.ts"
  "workers/src/api.ts"
  "workers/src/objects/ForestManager.ts"
  "workers/src/types.ts"
  "public/assets/models"  # Directory to list model files
)

# Clear output file if it exists
> "$OUTPUT_FILE"

# Concatenate each file's contents or list directory with a header
for FILE in "${FILES[@]}"; do
  if [[ -f "$FILE" ]]; then
    echo "=== $FILE ===" >> "$OUTPUT_FILE"
    cat "$FILE" >> "$OUTPUT_FILE"
    echo -e "\n\n" >> "$OUTPUT_FILE"
  elif [[ -d "$FILE" ]]; then
    echo "=== $FILE ===" >> "$OUTPUT_FILE"
    ls -l "$FILE" >> "$OUTPUT_FILE"
    echo -e "\n\n" >> "$OUTPUT_FILE"
  else
    echo "Warning: $FILE not found" >&2
  fi
done

echo "Key file contents and model directory listing saved to $OUTPUT_FILE"
```