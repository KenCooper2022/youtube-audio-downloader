#!/bin/bash

# Run this ONCE after extracting the zip to allow the app to open.
# After this, just double-click "YouTube Audio Downloader" to start.

cd "$(dirname "$0")"

echo ""
echo "============================================"
echo "  Setting up YouTube Audio Downloader"
echo "============================================"
echo ""

xattr -cr "YouTube Audio Downloader.app" 2>/dev/null
chmod +x "YouTube Audio Downloader.app/Contents/MacOS/launcher" 2>/dev/null
chmod +x "YouTube Audio Downloader.app/Contents/MacOS/install-deps" 2>/dev/null

echo "  Done! You can now double-click the app to start it."
echo ""
echo "  Launching now..."
echo ""

open "YouTube Audio Downloader.app"
