#!/bin/bash

# Script to concatenate relevant files from repo_files.txt into a single text file.
# Run from the repo root after generating repo_files.txt.
# Outputs to code_bundle.txt with headers for each file.
# Skips binary or irrelevant files.

# Input and output files
INPUT="repo_files.txt"
OUTPUT="code_bundle.txt"

# Maximum file size to include (in bytes) - 1MB
MAX_FILE_SIZE=1048576

# Check if input exists
if [ ! -f "$INPUT" ]; then
  echo "Error: $INPUT not found. Run list_repo_files.sh first."
  exit 1
fi

# Clear output file
> "$OUTPUT"

# Count total files for progress
total_files=$(wc -l < "$INPUT")
processed=0
skipped=0
errors=0

echo "Concatenating $total_files files into $OUTPUT..."
echo "Maximum file size: $((MAX_FILE_SIZE / 1024))KB"

# Function to check if file is binary
is_binary() {
  local file="$1"
  # Check first 1024 bytes for null bytes
  if head -c 1024 "$file" | grep -q $'\x00'; then
    return 0  # Binary
  fi
  # Check if file contains mostly printable characters
  local printable_chars=$(head -c 1024 "$file" | tr -d '[:print:]\n\r\t' | wc -c)
  if [ "$printable_chars" -gt 50 ]; then
    return 0  # Binary (too many non-printable chars)
  fi
  return 1  # Text
}

# Function to check file extension
is_binary_extension() {
  local file="$1"
  local ext="${file##*.}"
  case "$ext" in
    glb|png|jpg|jpeg|gif|ico|svg|mp3|wav|ogg|flac|zip|gz|tar|rar|7z|exe|dll|so|dylib|bin|obj|class|pyc|o|a|lib|pdf|doc|docx|xls|xlsx|ppt|pptx)
      return 0  # Binary extension
      ;;
    *)
      return 1  # Text extension
      ;;
  esac
}

# Read each file path from repo_files.txt
while IFS= read -r file; do
  # Skip empty lines
  if [[ -z "$file" ]]; then
    ((processed++))
    continue
  fi

  # Skip unwanted files
  if [[ "$file" =~ \.DS_Store$ || "$file" =~ favicon\.(ico|svg)$ || "$file" =~ code_bundle\.txt$ || "$file" =~ repo_files\.txt$ ]]; then
    echo "Skipping system file: $file"
    ((skipped++))
    ((processed++))
    echo "Processed $processed/$total_files (skipped: $skipped, errors: $errors)"
    continue
  fi

  # Check if file exists and is readable
  if [ ! -f "$file" ]; then
    echo "Warning: File not found: $file"
    ((errors++))
    ((processed++))
    echo "Processed $processed/$total_files (skipped: $skipped, errors: $errors)"
    continue
  fi

  if [ ! -r "$file" ]; then
    echo "Warning: Cannot read file: $file"
    ((errors++))
    ((processed++))
    echo "Processed $processed/$total_files (skipped: $skipped, errors: $errors)"
    continue
  fi

  # Check file size
  # file_size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo "0")
  # if [ "$file_size" -gt "$MAX_FILE_SIZE" ]; then
  #   echo "Skipping large file ($((file_size / 1024))KB): $file"
  #   ((skipped++))
  #   ((processed++))
  #   echo "Processed $processed/$total_files (skipped: $skipped, errors: $errors)"
  #   continue
  # fi

  # Check if file is binary (only check extension, not content)
  if is_binary_extension "$file"; then
    echo "Skipping binary file: $file"
    ((skipped++))
    ((processed++))
    echo "Processed $processed/$total_files (skipped: $skipped, errors: $errors)"
    continue
  fi

  # Add file to output
  echo "Adding file: $file"
  echo "=== FILE: $file ===" >> "$OUTPUT"
  # Remove // comments and /* ... */ block comments, preserve indentation and line breaks
  sed -E '/\/\*/,/\*\//d; s/^[[:space:]]*\/\/.*$//; s/\/\/.*$//' "$file" | sed '/^\s*$/d' >> "$OUTPUT" 2>/dev/null || echo "Error reading file content" >> "$OUTPUT"
  echo "" >> "$OUTPUT"
  echo "=== END FILE ===" >> "$OUTPUT"
  echo "" >> "$OUTPUT"

  ((processed++))
  echo "Processed $processed/$total_files (skipped: $skipped, errors: $errors)"
done < "$INPUT"

echo ""
echo "Concatenation complete. Output written to $OUTPUT."
echo "Total files included: $(grep -c "^=== FILE:" "$OUTPUT")"
echo "Files skipped: $skipped"
echo "Errors encountered: $errors"
echo "Output file size: $(du -h "$OUTPUT" | cut -f1)"