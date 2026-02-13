#!/bin/bash

# ============================================================================
#  Package the project into a distributable archive
# ============================================================================

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ARCHIVE_NAME="youtube-audio-downloader"

echo ""
echo "=== Packaging YouTube Audio Downloader ==="
echo ""

cd "$PROJECT_DIR"

FILES=(
  client/src/
  client/public/
  client/index.html
  client/capacitor.config.ts
  server/
  shared/
  electron/
  script/
  docs/
  Makefile
  install.sh
  install.bat
  start.bat
  HOW-TO-RUN.html
  package.json
  package-lock.json
  tsconfig.json
  tailwind.config.ts
  postcss.config.js
  vite.config.ts
  drizzle.config.ts
  electron-builder.yml
  components.json
  replit.md
)

EXISTING_FILES=()
for f in "${FILES[@]}"; do
  if [ -e "$f" ]; then
    EXISTING_FILES+=("$f")
  fi
done

if command -v zip &> /dev/null; then
  OUTPUT_PATH="$PROJECT_DIR/${ARCHIVE_NAME}.zip"
  rm -f "$OUTPUT_PATH"

  zip -r "$OUTPUT_PATH" \
    "${EXISTING_FILES[@]}" \
    -x "*/node_modules/*" \
    -x "*/.git/*" \
    -x "*/dist/*" \
    -x "*/downloads/*" \
    -x "*/.DS_Store" \
    -x "*/android/*" \
    -x "*/ios/*" \
    -x "*/electron-dist/*"
else
  OUTPUT_PATH="$PROJECT_DIR/${ARCHIVE_NAME}.tar.gz"
  rm -f "$OUTPUT_PATH"

  tar czf "$OUTPUT_PATH" \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='dist' \
    --exclude='downloads' \
    --exclude='.DS_Store' \
    --exclude='android' \
    --exclude='ios' \
    --exclude='electron-dist' \
    --exclude='*.tar.gz' \
    --exclude='*.zip' \
    "${EXISTING_FILES[@]}"
fi

echo ""
echo "=== Package created! ==="
echo "  File: $OUTPUT_PATH"
echo "  Size: $(du -h "$OUTPUT_PATH" | cut -f1)"
echo ""
echo "To use on another machine:"
if [[ "$OUTPUT_PATH" == *.zip ]]; then
  echo "  1. Unzip the file"
else
  echo "  1. Extract:  tar xzf ${ARCHIVE_NAME}.tar.gz"
fi
echo "  2. Run:  ./install.sh"
echo "     (or install.bat on Windows)"
echo ""
