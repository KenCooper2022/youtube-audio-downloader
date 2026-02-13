# YouTube Audio Downloader
# Usage:  open Terminal, cd to this folder, then run one of:
#   make install    - First time: install everything and start the app
#   make run        - Daily use: just start the app
#   make desktop    - Build a standalone desktop app
#   make mobile     - Build mobile app
#   make package    - Create a zip for sharing

.PHONY: install run start desktop mobile package clean help

help:
	@echo ""
	@echo "  YouTube Audio Downloader"
	@echo "  ========================"
	@echo ""
	@echo "  make install    First-time setup (installs deps + starts app)"
	@echo "  make run        Start the app (daily use)"
	@echo "  make desktop    Build desktop app (.dmg / .exe)"
	@echo "  make mobile     Build mobile app (Android / iOS)"
	@echo "  make package    Create a zip to share with others"
	@echo "  make clean      Remove build files"
	@echo ""

install: _deps _npm _dbpush _start

run: _start

start: _start

desktop: _deps _npm
	bash install.sh desktop

mobile: _deps _npm
	bash install.sh mobile

package:
	bash script/package-zip.sh

clean:
	rm -rf node_modules dist electron-dist
	rm -f youtube-audio-downloader.tar.gz youtube-audio-downloader.zip

_deps:
	@echo ""
	@echo "  Checking dependencies..."
	@echo ""
	@command -v node >/dev/null 2>&1 || { \
		echo "  Node.js not found. Installing..."; \
		if [ "$$(uname)" = "Darwin" ]; then \
			if command -v brew >/dev/null 2>&1; then \
				brew install node; \
			else \
				echo "  Installing Homebrew first..."; \
				/bin/bash -c "$$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"; \
				if [ "$$(uname -m)" = "arm64" ]; then eval "$$(/opt/homebrew/bin/brew shellenv)"; fi; \
				brew install node; \
			fi; \
		elif command -v apt-get >/dev/null 2>&1; then \
			curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -; \
			sudo apt-get install -y nodejs; \
		fi; \
	}
	@command -v yt-dlp >/dev/null 2>&1 || { \
		echo "  yt-dlp not found. Installing..."; \
		if [ "$$(uname)" = "Darwin" ] && command -v brew >/dev/null 2>&1; then \
			brew install yt-dlp; \
		elif command -v apt-get >/dev/null 2>&1; then \
			sudo apt-get install -y yt-dlp 2>/dev/null || pip3 install yt-dlp; \
		elif command -v pip3 >/dev/null 2>&1; then \
			pip3 install yt-dlp; \
		fi; \
	}
	@command -v ffmpeg >/dev/null 2>&1 || { \
		echo "  FFmpeg not found. Installing..."; \
		if [ "$$(uname)" = "Darwin" ] && command -v brew >/dev/null 2>&1; then \
			brew install ffmpeg; \
		elif command -v apt-get >/dev/null 2>&1; then \
			sudo apt-get install -y ffmpeg; \
		fi; \
	}
	@echo "  Dependencies OK"

_npm:
	@if [ ! -d "node_modules" ]; then \
		echo "  Installing npm packages..."; \
		npm install; \
	fi

_dbpush:
	@if [ -n "$$DATABASE_URL" ]; then \
		echo "  Pushing database schema..."; \
		npm run db:push 2>/dev/null || true; \
	fi

_start:
	@echo ""
	@echo "  Starting on http://localhost:5000"
	@echo "  (Press Ctrl+C to stop)"
	@echo ""
	@sleep 2 && { \
		if [ "$$(uname)" = "Darwin" ]; then \
			open "http://localhost:5000"; \
		elif command -v xdg-open >/dev/null 2>&1; then \
			xdg-open "http://localhost:5000"; \
		fi; \
	} &
	npm run dev
