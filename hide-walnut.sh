#!/bin/bash

SQUIRREL_ID="d15f69b7-44cd-44a2-a577-e0780d905014"
BASE_URL="http://localhost:8787"

echo "Joining with squirrelId: $SQUIRREL_ID"
curl -s "$BASE_URL/join?squirrelId=$SQUIRREL_ID"

echo -e "\nHiding walnut..."
curl -s -X POST "$BASE_URL/hide?squirrelId=$SQUIRREL_ID" \
  -H "Content-Type: application/json" \
  -d '{"location": {"x": 12.3, "y": 0, "z": 42.1}, "hiddenIn": "buried"}'

echo -e "\nDone."
