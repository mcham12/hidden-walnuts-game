#!/bin/bash

# Script to concatenate specified Hidden Walnuts files into a single text file for sharing with AI
# Run from the repository root: ./concat_files.sh

# Ensure we're in the correct repository
if [ ! -f "GameVision.md" ] || [ ! -d "client" ] || [ ! -d "workers" ]; then
    echo "Error: This script must be run from the hidden-walnuts-game repository root."
    exit 1
fi

# List of files to concatenate (relative paths)
files=(
    "GameVision.md"
    "MVP_Plan_Hidden_Walnuts.md"
    "README.md"
    "README_AI.md"
    "conventions.md"
    "deployment_setup.md"
    "todo.md"
    "repo_structure.txt"
    ".github/workflows/deploy-worker.yml"
    "wrangler.toml"
    "client/package.json"
    "client/src/main.ts"
    "client/src/avatar.ts"
    "client/src/terrain.ts"
    "client/src/forest.ts"
    "client/src/types.ts"
    "client/src/constants.ts"
    "workers/api.ts"
    "workers/objects/ForestManager.ts"
    "workers/objects/SquirrelSession.ts"
    "workers/objects/WalnutRegistry.ts"
    "workers/objects/Leaderboard.ts"
    "workers/objects/registry.ts"
    "client/public/_routes.json"
)

# Output text file with date (e.g., hidden-walnuts-files-20250608.txt)
output_file="$HOME/hidden-walnuts-files-$(date +%Y%m%d).txt"

# Initialize output file
> "$output_file"

# Counter for found and missing files
found=0
missing=0

# Concatenate each file with a header
for file in "${files[@]}"; do
    echo "Processing: $file"
    if [ -f "$file" ]; then
        # Add header with file path
        echo "### $file" >> "$output_file"
        echo "---" >> "$output_file"
        # Add file contents
        cat "$file" >> "$output_file"
        # Add separator
        echo -e "\n---\n" >> "$output_file"
        ((found++))
    else
        # Note missing file
        echo "Warning: File not found: $file"
        echo "### $file" >> "$output_file"
        echo "---" >> "$output_file"
        echo "File not found" >> "$output_file"
        echo -e "\n---\n" >> "$output_file"
        ((missing++))
    fi
done

# Append summary to output file
echo "Summary" >> "$output_file"
echo "---" >> "$output_file"
echo "Files found: $found" >> "$output_file"
echo "Files missing: $missing" >> "$output_file"
echo "---" >> "$output_file"

# Report summary to console
echo "Summary: $found files found, $missing files missing."
echo "Created output file: $output_file"

# Instructions for sharing
echo "To share, open $output_file, copy all contents, and paste into your AI conversation."
echo "Command to view: cat $output_file"
echo "If the file is large, you can share key sections (e.g., workers/api.ts, client/src/main.ts)."