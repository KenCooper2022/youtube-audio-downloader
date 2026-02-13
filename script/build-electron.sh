#!/bin/bash

# Electron Build Script for YouTube Audio Downloader
# This script builds the desktop application for macOS, Windows, or Linux

set -e

echo "=== YouTube Audio Downloader - Electron Build ==="
echo ""

# Check if platform argument is provided
PLATFORM=${1:-"mac"}

# Step 1: Build the web application
echo "Step 1: Building web application..."
npm run build

# Step 2: Build Electron app for specified platform
echo ""
echo "Step 2: Building Electron app for $PLATFORM..."

case $PLATFORM in
  "mac")
    echo "Building for macOS (.dmg)..."
    npx electron-builder --mac
    ;;
  "win")
    echo "Building for Windows (.exe)..."
    npx electron-builder --win
    ;;
  "linux")
    echo "Building for Linux (.AppImage)..."
    npx electron-builder --linux
    ;;
  "all")
    echo "Building for all platforms..."
    npx electron-builder --mac --win --linux
    ;;
  *)
    echo "Unknown platform: $PLATFORM"
    echo "Usage: ./script/build-electron.sh [mac|win|linux|all]"
    exit 1
    ;;
esac

echo ""
echo "=== Build complete! ==="
echo "Output files are in the electron-dist/ directory"
echo ""
ls -la electron-dist/ 2>/dev/null || echo "(No output yet - check for errors above)"
