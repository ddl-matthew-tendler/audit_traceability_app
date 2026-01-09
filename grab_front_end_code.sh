#!/bin/bash

# Script to download frontend code from the repository and place it in example_domino_frontend_code
# This folder will not have git continuity - the .git directory is removed after download

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="$SCRIPT_DIR/example_domino_frontend_code"
TEMP_DIR=$(mktemp -d)
REPO_URL="https://github.com/cerebrotech/frontend-web-ui-service.git"

echo "📥 Downloading repository from $REPO_URL..."
git clone "$REPO_URL" "$TEMP_DIR"

echo "🧹 Cleaning up git history..."
rm -rf "$TEMP_DIR/.git"

echo "📦 Preparing target directory..."
rm -rf "$TARGET_DIR"/*
rm -rf "$TARGET_DIR"/.*

echo "📂 Copying files to $TARGET_DIR..."
cp -r "$TEMP_DIR"/* "$TARGET_DIR/" 2>/dev/null || true
cp -r "$TEMP_DIR"/.[!.]* "$TARGET_DIR/" 2>/dev/null || true

echo "🧽 Cleaning up temporary directory..."
rm -rf "$TEMP_DIR"

echo "✅ Done! Frontend code is now in $TARGET_DIR without git continuity."
