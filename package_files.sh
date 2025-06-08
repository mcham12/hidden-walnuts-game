#!/bin/bash

# Script to package specified Hidden Walnuts files for sharing with AI
# Run from the repository root: ./package_files.sh

# Ensure we're in the correct repository
if [ ! -f "GameVision.md" ] || [ ! -d "client" ] || [ ! -d "workers" ]; then
    echo "Error: This script must be run from the hidden-walnuts-game repository root."
    exit 1
fi

# List of files to package (relative paths)
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
    "workers/wrangler.toml"
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

# Output archive name with date (e.g., hidden-walnuts-files-20250608.tar.gz)
output_file="$HOME/hidden-walnuts-files-$(date +%Y%m%d).tar.gz"

# Temporary directory for collecting files
temp_dir=$(mktemp -d)
if [ ! -d "$temp_dir" ]; then
    echo "Error: Failed to create temporary directory."
    exit 1
fi

# Counter for found and missing files
found=0
missing=0

# Copy each file to temp directory, preserving directory structure
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        # Create parent directory in temp_dir if needed
        mkdir -p "$temp_dir/$(dirname "$file")"
        # Copy file to temp_dir
        cp "$file" "$temp_dir/$file"
        echo "Copied: $file"
        ((found++))
    else
        echo "Warning: File not found: $file"
        ((missing++))
    fi
done

# Report summary
echo "Summary: $found files found, $missing files missing."

# Package files into a tar.gz archive
if [ $found -gt 0 ]; then
    # Change to temp_dir to create tar with correct paths
    cd "$temp_dir" || exit 1
    tar -czf "$output_file" .
    cd - || exit 1
    echo "Created archive: $output_file"
else
    echo "Error: No files found to package."
    rm -rf "$temp_dir"
    exit 1
fi

# Clean up temporary directory
rm -rf "$temp_dir"
echo "Cleaned up temporary directory."

# Instructions for sharing
echo "To share the archive, upload $output_file to a file-sharing service or share its contents."
echo "To extract and view: tar -xzf $output_file"