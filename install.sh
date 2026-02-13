#!/bin/bash

# ============================================================================
#  YouTube Audio Downloader - Universal Installer & Builder
# ============================================================================
#
#  This script detects your operating system, installs all required
#  dependencies, builds the web app, and optionally builds desktop
#  or mobile versions.
#
#  Usage:
#    ./install.sh              Interactive mode (prompts for build target)
#    ./install.sh web          Build web app only
#    ./install.sh desktop      Build desktop app for current OS
#    ./install.sh mobile       Prepare mobile app builds
#    ./install.sh all          Build everything possible for current OS
#
# ============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

print_banner() {
  echo ""
  echo -e "${CYAN}============================================================================${NC}"
  echo -e "${CYAN}  YouTube Audio Downloader - Installer & Builder${NC}"
  echo -e "${CYAN}============================================================================${NC}"
  echo ""
}

print_step() {
  echo -e "${BLUE}[STEP]${NC} $1"
}

print_success() {
  echo -e "${GREEN}[OK]${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

print_info() {
  echo -e "${BOLD}$1${NC}"
}

# ============================================================================
#  OS Detection
# ============================================================================

detect_os() {
  case "$(uname -s)" in
    Darwin*)  OS="macos" ;;
    Linux*)   OS="linux" ;;
    MINGW*|MSYS*|CYGWIN*)
      echo -e "${YELLOW}[WARNING]${NC} Windows detected."
      echo ""
      echo "  On Windows, please use install.bat instead:"
      echo "    install.bat"
      echo ""
      echo "  (This bash script is designed for macOS and Linux.)"
      exit 0
      ;;
    *)        OS="unknown" ;;
  esac

  case "$(uname -m)" in
    x86_64|amd64)  ARCH="x64" ;;
    arm64|aarch64) ARCH="arm64" ;;
    *)             ARCH="unknown" ;;
  esac

  echo -e "  Detected OS:   ${BOLD}${OS}${NC} (${ARCH})"
}

# ============================================================================
#  Dependency Checks
# ============================================================================

check_command() {
  if command -v "$1" &> /dev/null; then
    local version=$($1 --version 2>&1 | head -1)
    print_success "$1 found: $version"
    return 0
  else
    return 1
  fi
}

check_node() {
  if check_command node; then
    local major=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$major" -lt 18 ]; then
      print_warning "Node.js v18+ recommended (found v$(node -v | sed 's/v//'))"
      return 1
    fi
    return 0
  fi
  return 1
}

install_node() {
  print_step "Installing Node.js..."
  case $OS in
    macos)
      if command -v brew &> /dev/null; then
        brew install node
      else
        print_error "Homebrew not found. Install it first: https://brew.sh"
        print_info "  Or download Node.js from: https://nodejs.org"
        return 1
      fi
      ;;
    linux)
      if command -v apt-get &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
      elif command -v dnf &> /dev/null; then
        sudo dnf install -y nodejs
      elif command -v pacman &> /dev/null; then
        sudo pacman -S --noconfirm nodejs npm
      else
        print_error "Could not detect package manager. Install Node.js manually: https://nodejs.org"
        return 1
      fi
      ;;
    windows)
      print_info "  Download Node.js from: https://nodejs.org/en/download"
      print_info "  Or use: choco install nodejs"
      return 1
      ;;
  esac
}

install_ytdlp() {
  print_step "Installing yt-dlp..."
  case $OS in
    macos)
      if command -v brew &> /dev/null; then
        brew install yt-dlp
      else
        pip3 install yt-dlp 2>/dev/null || pip install yt-dlp 2>/dev/null || {
          print_error "Install yt-dlp manually: pip install yt-dlp"
          return 1
        }
      fi
      ;;
    linux)
      if command -v apt-get &> /dev/null; then
        sudo apt-get install -y yt-dlp 2>/dev/null || {
          pip3 install yt-dlp 2>/dev/null || pip install yt-dlp 2>/dev/null || {
            sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
            sudo chmod a+rx /usr/local/bin/yt-dlp
          }
        }
      elif command -v pacman &> /dev/null; then
        sudo pacman -S --noconfirm yt-dlp
      else
        pip3 install yt-dlp 2>/dev/null || pip install yt-dlp
      fi
      ;;
    windows)
      if command -v choco &> /dev/null; then
        choco install yt-dlp -y
      elif command -v winget &> /dev/null; then
        winget install yt-dlp
      else
        print_info "  Download yt-dlp from: https://github.com/yt-dlp/yt-dlp/releases"
        print_info "  Or use: pip install yt-dlp"
        return 1
      fi
      ;;
  esac
}

install_ffmpeg() {
  print_step "Installing FFmpeg..."
  case $OS in
    macos)
      if command -v brew &> /dev/null; then
        brew install ffmpeg
      else
        print_error "Install Homebrew first (https://brew.sh) then: brew install ffmpeg"
        return 1
      fi
      ;;
    linux)
      if command -v apt-get &> /dev/null; then
        sudo apt-get install -y ffmpeg
      elif command -v dnf &> /dev/null; then
        sudo dnf install -y ffmpeg
      elif command -v pacman &> /dev/null; then
        sudo pacman -S --noconfirm ffmpeg
      else
        print_error "Install FFmpeg manually from: https://ffmpeg.org/download.html"
        return 1
      fi
      ;;
    windows)
      if command -v choco &> /dev/null; then
        choco install ffmpeg -y
      elif command -v winget &> /dev/null; then
        winget install ffmpeg
      else
        print_info "  Download FFmpeg from: https://ffmpeg.org/download.html"
        print_info "  Or use: choco install ffmpeg"
        return 1
      fi
      ;;
  esac
}

install_postgres() {
  print_step "Checking PostgreSQL..."
  if check_command psql; then
    return 0
  fi

  echo ""
  print_warning "PostgreSQL is not installed."
  print_info "  You have two options:"
  echo ""
  echo "  1. Install PostgreSQL locally:"
  case $OS in
    macos)  echo "     brew install postgresql@16 && brew services start postgresql@16" ;;
    linux)  echo "     sudo apt-get install postgresql && sudo systemctl start postgresql" ;;
    windows) echo "     Download from: https://www.postgresql.org/download/windows/" ;;
  esac
  echo ""
  echo "  2. Use a cloud database (e.g., Neon, Supabase, Railway)"
  echo "     Get a connection URL and set it as DATABASE_URL"
  echo ""
  print_info "  After setting up PostgreSQL, set the DATABASE_URL environment variable:"
  echo "     export DATABASE_URL=\"postgresql://user:password@localhost:5432/youtube_downloader\""
  echo ""
  return 1
}

# ============================================================================
#  Dependency Installation
# ============================================================================

install_dependencies() {
  print_step "Checking required dependencies..."
  echo ""

  local missing=0

  if ! check_node; then
    install_node || { missing=1; print_warning "Node.js needs manual installation"; }
  fi

  if ! check_command yt-dlp; then
    install_ytdlp || { missing=1; print_warning "yt-dlp needs manual installation"; }
  fi

  if ! check_command ffmpeg; then
    install_ffmpeg || { missing=1; print_warning "FFmpeg needs manual installation"; }
  fi

  echo ""

  if [ $missing -eq 1 ]; then
    print_warning "Some dependencies could not be installed automatically."
    print_info "  Please install them manually before continuing."
    echo ""
    read -p "  Continue anyway? (y/n): " choice
    if [ "$choice" != "y" ] && [ "$choice" != "Y" ]; then
      exit 1
    fi
  fi
}

# ============================================================================
#  Build Functions
# ============================================================================

install_npm_packages() {
  print_step "Installing npm packages..."
  cd "$PROJECT_DIR"
  npm install
  print_success "npm packages installed"
}

setup_database() {
  print_step "Setting up database..."
  if [ -z "$DATABASE_URL" ]; then
    print_warning "DATABASE_URL is not set."
    echo ""
    print_info "  Enter your PostgreSQL connection URL"
    print_info "  (or press Enter to skip database setup for now):"
    echo ""
    read -p "  DATABASE_URL: " db_url
    if [ -n "$db_url" ]; then
      export DATABASE_URL="$db_url"
      print_success "DATABASE_URL set for this session"
    else
      print_warning "Skipping database setup. Set DATABASE_URL before running the app."
      return 0
    fi
  fi

  cd "$PROJECT_DIR"
  npm run db:push 2>/dev/null && print_success "Database schema pushed" || {
    print_warning "Database push failed. You may need to run 'npm run db:push' manually."
  }
}

setup_api_key() {
  if [ -z "$GOOGLE_API_KEY" ]; then
    echo ""
    print_warning "GOOGLE_API_KEY is not set (needed for YouTube search)."
    print_info "  Get a YouTube Data API v3 key from: https://console.cloud.google.com"
    echo ""
    read -p "  Enter your Google API Key (or press Enter to skip): " api_key
    if [ -n "$api_key" ]; then
      export GOOGLE_API_KEY="$api_key"
      print_success "GOOGLE_API_KEY set for this session"
    else
      print_warning "YouTube search won't work without GOOGLE_API_KEY."
    fi
  else
    print_success "GOOGLE_API_KEY is already set"
  fi
}

build_web() {
  print_step "Building web application..."
  cd "$PROJECT_DIR"
  npm run build
  print_success "Web application built (output: dist/)"
}

build_desktop() {
  print_step "Building desktop application..."
  cd "$PROJECT_DIR"

  npm run build

  case $OS in
    macos)
      print_info "  Building macOS .dmg..."
      npx electron-builder --mac
      echo ""
      print_success "macOS app built!"
      print_info "  Output: electron-dist/"
      ls -la electron-dist/*.dmg 2>/dev/null || true
      ;;
    windows)
      print_info "  Building Windows .exe installer..."
      npx electron-builder --win
      echo ""
      print_success "Windows app built!"
      print_info "  Output: electron-dist/"
      ls -la electron-dist/*.exe 2>/dev/null || true
      ;;
    linux)
      print_info "  Building Linux AppImage..."
      npx electron-builder --linux
      echo ""
      print_success "Linux app built!"
      print_info "  Output: electron-dist/"
      ls -la electron-dist/*.AppImage 2>/dev/null || true
      ;;
  esac
}

build_mobile() {
  print_step "Preparing mobile app builds..."
  cd "$PROJECT_DIR"

  npm run build

  cd "$PROJECT_DIR/client"

  echo ""
  print_info "  Available mobile platforms:"
  echo "    1. Android"
  echo "    2. iOS (macOS only)"
  echo "    3. Both"
  echo ""
  read -p "  Choose platform (1/2/3): " mobile_choice

  case $mobile_choice in
    1)
      build_android
      ;;
    2)
      if [ "$OS" != "macos" ]; then
        print_error "iOS builds require macOS with Xcode."
        return 1
      fi
      build_ios
      ;;
    3)
      build_android
      if [ "$OS" = "macos" ]; then
        build_ios
      else
        print_warning "Skipping iOS (requires macOS)"
      fi
      ;;
    *)
      print_error "Invalid choice"
      return 1
      ;;
  esac
}

build_android() {
  print_step "Building Android app..."
  cd "$PROJECT_DIR/client"

  if [ ! -d "android" ]; then
    print_info "  Adding Android platform (first time)..."
    npx cap add android
  fi

  print_info "  Syncing web app to Android project..."
  npx cap sync android

  print_success "Android project ready!"
  echo ""
  print_info "  Next steps:"
  echo "    1. Open in Android Studio:  cd client && npx cap open android"
  echo "    2. Connect your device or start an emulator"
  echo "    3. Click Run to install the app"
  echo "    4. In the app, go to Settings and enter your server URL"
  echo ""
}

build_ios() {
  print_step "Building iOS app..."
  cd "$PROJECT_DIR/client"

  if [ "$OS" != "macos" ]; then
    print_error "iOS builds require macOS with Xcode."
    return 1
  fi

  if [ ! -d "ios" ]; then
    print_info "  Adding iOS platform (first time)..."
    npx cap add ios
  fi

  print_info "  Syncing web app to iOS project..."
  npx cap sync ios

  print_success "iOS project ready!"
  echo ""
  print_info "  Next steps:"
  echo "    1. Open in Xcode:  cd client && npx cap open ios"
  echo "    2. Select your development team in Signing & Capabilities"
  echo "    3. Connect your device and click Run"
  echo "    4. In the app, go to Settings and enter your server URL"
  echo ""
}

# ============================================================================
#  Run App
# ============================================================================

run_app() {
  echo ""
  read -p "  Start the app now? (y/n): " start_choice
  if [ "$start_choice" = "y" ] || [ "$start_choice" = "Y" ]; then
    print_step "Starting the application on http://localhost:5000 ..."
    cd "$PROJECT_DIR"
    npm run dev
  fi
}

# ============================================================================
#  Interactive Menu
# ============================================================================

show_menu() {
  echo ""
  print_info "  What would you like to build?"
  echo ""
  echo "    1. Web app only (run locally in browser)"
  echo "    2. Desktop app (macOS .dmg / Windows .exe / Linux AppImage)"
  echo "    3. Mobile app (Android / iOS)"
  echo "    4. Everything possible for this OS"
  echo "    5. Just install dependencies (no build)"
  echo ""
  read -p "  Choose an option (1-5): " menu_choice
  echo ""

  case $menu_choice in
    1) BUILD_TARGET="web" ;;
    2) BUILD_TARGET="desktop" ;;
    3) BUILD_TARGET="mobile" ;;
    4) BUILD_TARGET="all" ;;
    5) BUILD_TARGET="deps" ;;
    *)
      print_error "Invalid choice. Exiting."
      exit 1
      ;;
  esac
}

# ============================================================================
#  Summary
# ============================================================================

print_summary() {
  echo ""
  echo -e "${CYAN}============================================================================${NC}"
  echo -e "${GREEN}  Build Complete!${NC}"
  echo -e "${CYAN}============================================================================${NC}"
  echo ""
  echo "  Platform: $OS ($ARCH)"
  echo "  Build:    $BUILD_TARGET"
  echo ""

  if [ "$BUILD_TARGET" = "web" ] || [ "$BUILD_TARGET" = "all" ] || [ "$BUILD_TARGET" = "deps" ]; then
    echo "  To run the web app:"
    echo "    cd $PROJECT_DIR"
    echo "    npm run dev"
    echo "    Then open http://localhost:5000"
    echo ""
  fi

  if [ "$BUILD_TARGET" = "desktop" ] || [ "$BUILD_TARGET" = "all" ]; then
    echo "  Desktop app output: $PROJECT_DIR/electron-dist/"
    echo ""
  fi

  if [ -z "$DATABASE_URL" ]; then
    print_warning "Remember to set DATABASE_URL before running the app!"
  fi

  if [ -z "$GOOGLE_API_KEY" ]; then
    print_warning "Remember to set GOOGLE_API_KEY for YouTube search!"
  fi

  echo ""
}

# ============================================================================
#  Main
# ============================================================================

main() {
  print_banner
  detect_os
  echo ""

  BUILD_TARGET="${1:-}"

  if [ -z "$BUILD_TARGET" ]; then
    show_menu
  fi

  install_dependencies
  echo ""

  install_npm_packages
  echo ""

  setup_api_key
  echo ""

  setup_database
  echo ""

  case $BUILD_TARGET in
    web)
      build_web
      run_app
      ;;
    desktop)
      build_desktop
      ;;
    mobile)
      build_mobile
      ;;
    all)
      build_web
      build_desktop
      build_mobile
      ;;
    deps)
      print_success "All dependencies installed. Ready to build."
      ;;
    *)
      print_error "Unknown build target: $BUILD_TARGET"
      echo "  Usage: ./install.sh [web|desktop|mobile|all]"
      exit 1
      ;;
  esac

  print_summary
}

main "$@"
