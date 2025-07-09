#!/bin/bash

# Generate a clean repository structure, excluding unhelpful files
tree -a -I 'node_modules|.wrangler|dist|.git|.env|*.log|*.cache' -o repo_structure.txt

echo "Repository structure saved to repo_structure.txt"