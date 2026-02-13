#!/bin/bash

# YouTube Audio Downloader - Double-click to start (macOS/Linux)
# Automatically installs everything needed on first run.

cd "$(dirname "$0")"

echo ""
echo "============================================"
echo "  YouTube Audio Downloader"
echo "============================================"
echo ""

# --- Install Homebrew if missing (macOS only) ---
if [[ "$(uname)" == "Darwin" ]] && ! command -v brew &> /dev/null; then
  echo "  Installing Homebrew (package manager)..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  if [[ "$(uname -m)" == "arm64" ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  else
    eval "$(/usr/local/bin/brew shellenv)"
  fi
fi

# --- Install Node.js if missing ---
if ! command -v node &> /dev/null; then
  echo "  Installing Node.js..."
  if [[ "$(uname)" == "Darwin" ]]; then
    brew install node
  elif command -v apt-get &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
  elif command -v dnf &> /dev/null; then
    sudo dnf install -y nodejs
  elif command -v pacman &> /dev/null; then
    sudo pacman -S --noconfirm nodejs npm
  fi
fi

if ! command -v node &> /dev/null; then
  echo ""
  echo "  ERROR: Could not install Node.js automatically."
  echo "  Please install it from https://nodejs.org and try again."
  echo ""
  read -p "  Press Enter to exit..."
  exit 1
fi

# --- Install yt-dlp if missing ---
if ! command -v yt-dlp &> /dev/null; then
  echo "  Installing yt-dlp..."
  if [[ "$(uname)" == "Darwin" ]]; then
    brew install yt-dlp
  elif command -v apt-get &> /dev/null; then
    sudo apt-get install -y yt-dlp 2>/dev/null || pip3 install yt-dlp 2>/dev/null || {
      sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
      sudo chmod a+rx /usr/local/bin/yt-dlp
    }
  elif command -v pacman &> /dev/null; then
    sudo pacman -S --noconfirm yt-dlp
  else
    pip3 install yt-dlp 2>/dev/null || pip install yt-dlp 2>/dev/null
  fi
fi

# --- Install FFmpeg if missing ---
if ! command -v ffmpeg &> /dev/null; then
  echo "  Installing FFmpeg..."
  if [[ "$(uname)" == "Darwin" ]]; then
    brew install ffmpeg
  elif command -v apt-get &> /dev/null; then
    sudo apt-get install -y ffmpeg
  elif command -v dnf &> /dev/null; then
    sudo dnf install -y ffmpeg
  elif command -v pacman &> /dev/null; then
    sudo pacman -S --noconfirm ffmpeg
  fi
fi

# --- Install npm packages on first run ---
if [ ! -d "node_modules" ]; then
  echo "  Installing app packages (first run)..."
  npm install
fi

# --- Push database schema if DATABASE_URL is set ---
if [ -n "$DATABASE_URL" ]; then
  npm run db:push 2>/dev/null
fi

echo ""
echo "  Starting on http://localhost:5000"
echo "  Opening in your browser..."
echo "  (Close this window to stop the server)"
echo ""

sleep 2 && {
  if [[ "$(uname)" == "Darwin" ]]; then
    open "http://localhost:5000"
  else
    xdg-open "http://localhost:5000" 2>/dev/null || echo "  Open http://localhost:5000 in your browser"
  fi
} &

npm run dev
