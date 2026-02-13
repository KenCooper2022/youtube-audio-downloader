@echo off
setlocal enabledelayedexpansion

REM YouTube Audio Downloader - Double-click to start (Windows)
REM Automatically installs everything needed on first run.

cd /d "%~dp0"

echo.
echo  ============================================
echo    YouTube Audio Downloader
echo  ============================================
echo.

REM --- Install Node.js if missing ---
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  Node.js not found. Installing...
    where winget >nul 2>nul
    if %errorlevel%==0 (
        winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    ) else (
        where choco >nul 2>nul
        if %errorlevel%==0 (
            choco install nodejs-lts -y
        ) else (
            echo.
            echo  Could not install Node.js automatically.
            echo  Please download and install from: https://nodejs.org
            echo  Then double-click this file again.
            echo.
            pause
            exit /b 1
        )
    )
    REM Refresh PATH after install
    set "PATH=%ProgramFiles%\nodejs;%PATH%"
)

REM --- Install yt-dlp if missing ---
where yt-dlp >nul 2>nul
if %errorlevel% neq 0 (
    echo  yt-dlp not found. Installing...
    where winget >nul 2>nul
    if %errorlevel%==0 (
        winget install yt-dlp.yt-dlp --accept-source-agreements --accept-package-agreements
    ) else (
        where choco >nul 2>nul
        if %errorlevel%==0 (
            choco install yt-dlp -y
        ) else (
            where pip >nul 2>nul
            if %errorlevel%==0 (
                pip install yt-dlp
            ) else (
                echo  WARNING: Could not install yt-dlp. Downloads won't work.
                echo  Install manually from: https://github.com/yt-dlp/yt-dlp/releases
            )
        )
    )
)

REM --- Install FFmpeg if missing ---
where ffmpeg >nul 2>nul
if %errorlevel% neq 0 (
    echo  FFmpeg not found. Installing...
    where winget >nul 2>nul
    if %errorlevel%==0 (
        winget install Gyan.FFmpeg --accept-source-agreements --accept-package-agreements
    ) else (
        where choco >nul 2>nul
        if %errorlevel%==0 (
            choco install ffmpeg -y
        ) else (
            echo  WARNING: Could not install FFmpeg. Audio conversion may not work.
            echo  Install manually from: https://ffmpeg.org/download.html
        )
    )
)

REM --- Install npm packages on first run ---
if not exist "node_modules" (
    echo  Installing app packages (first run)...
    call npm install
)

REM --- Push database schema if DATABASE_URL is set ---
if defined DATABASE_URL (
    call npm run db:push 2>nul
)

echo.
echo  Starting on http://localhost:5000
echo  Opening in your browser...
echo  (Close this window to stop the server)
echo.

timeout /t 2 /nobreak >nul
start http://localhost:5000

call npm run dev

endlocal
