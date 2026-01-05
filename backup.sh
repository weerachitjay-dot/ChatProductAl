#!/bin/bash

# Configuration
BACKUP_DIR="backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
PROJECT_DIR=$(dirname "$0")
APP_JS="$PROJECT_DIR/app.js"

# Extract version from app.js
if [ -f "$APP_JS" ]; then
    VERSION=$(grep "APP_VERSION =" "$APP_JS" | cut -d"'" -f2)
else
    VERSION="unknown"
fi

if [ -z "$VERSION" ]; then
    VERSION="unknown"
fi

BACKUP_NAME="coppy-web-v${VERSION}-${TIMESTAMP}.zip"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

# Create backup directory if it doesn't exist
if [ ! -d "$BACKUP_DIR" ]; then
    mkdir -p "$BACKUP_DIR"
fi

# Create zip backup
echo "Creating backup: $BACKUP_NAME"
echo "Version: $VERSION"

# Zip excluding backups folder and other potential clutter
zip -r "$BACKUP_PATH" . -x "backups/*" -x ".git/*" -x "node_modules/*" -x ".DS_Store"

if [ $? -eq 0 ]; then
    echo "✅ Backup created successfully at: $BACKUP_PATH"
else
    echo "❌ Backup failed!"
    exit 1
fi
