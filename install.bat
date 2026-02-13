@echo off
setlocal enabledelayedexpansion

REM ============================================================================
REM  YouTube Audio Downloader - Windows Installer & Builder
REM ============================================================================

echo.
echo ============================================================================
echo   YouTube Audio Downloader - Installer ^& Builder
echo ============================================================================
echo.

set "PROJECT_DIR=%~dp0"
set "BUILD_TARGET=%~1"

REM ============================================================================
REM  Dependency Checks
REM ============================================================================

echo [STEP] Checking required dependencies...
echo.

where node >nul 2>nul
if %errorlevel%==0 (
    for /f "tokens=*" %%v in ('node -v') do echo [OK] Node.js found: %%v
) else (
    echo [WARNING] Node.js not found.
    echo   Install from: https://nodejs.org
    echo   Or use: winget install OpenJS.NodeJS
    echo.
    set "MISSING=1"
)

where yt-dlp >nul 2>nul
if %errorlevel%==0 (
    echo [OK] yt-dlp found
) else (
    echo [WARNING] yt-dlp not found. Attempting install...
    where choco >nul 2>nul
    if %errorlevel%==0 (
        choco install yt-dlp -y
    ) else (
        where winget >nul 2>nul
        if %errorlevel%==0 (
            winget install yt-dlp
        ) else (
            where pip >nul 2>nul
            if %errorlevel%==0 (
                pip install yt-dlp
            ) else (
                echo   Download from: https://github.com/yt-dlp/yt-dlp/releases
                set "MISSING=1"
            )
        )
    )
)

where ffmpeg >nul 2>nul
if %errorlevel%==0 (
    echo [OK] FFmpeg found
) else (
    echo [WARNING] FFmpeg not found. Attempting install...
    where choco >nul 2>nul
    if %errorlevel%==0 (
        choco install ffmpeg -y
    ) else (
        where winget >nul 2>nul
        if %errorlevel%==0 (
            winget install ffmpeg
        ) else (
            echo   Download from: https://ffmpeg.org/download.html
            set "MISSING=1"
        )
    )
)

where psql >nul 2>nul
if %errorlevel%==0 (
    echo [OK] PostgreSQL found
) else (
    echo [INFO] PostgreSQL not found locally.
    echo   Options:
    echo     1. Install locally: https://www.postgresql.org/download/windows/
    echo        Or use: choco install postgresql
    echo     2. Use a cloud database (Neon, Supabase, Railway)
    echo   Set DATABASE_URL after setup.
)

echo.

if defined MISSING (
    echo [WARNING] Some dependencies need manual installation.
    set /p CONTINUE="  Continue anyway? (y/n): "
    if /i not "!CONTINUE!"=="y" exit /b 1
)

REM ============================================================================
REM  Menu
REM ============================================================================

if "%BUILD_TARGET%"=="" (
    echo.
    echo   What would you like to build?
    echo.
    echo     1. Web app only (run locally in browser)
    echo     2. Desktop app (Windows .exe installer)
    echo     3. Mobile app (Android)
    echo     4. Everything
    echo     5. Just install dependencies (no build)
    echo.
    set /p MENU_CHOICE="  Choose an option (1-5): "

    if "!MENU_CHOICE!"=="1" set "BUILD_TARGET=web"
    if "!MENU_CHOICE!"=="2" set "BUILD_TARGET=desktop"
    if "!MENU_CHOICE!"=="3" set "BUILD_TARGET=mobile"
    if "!MENU_CHOICE!"=="4" set "BUILD_TARGET=all"
    if "!MENU_CHOICE!"=="5" set "BUILD_TARGET=deps"
)

REM ============================================================================
REM  Install npm packages
REM ============================================================================

echo.
echo [STEP] Installing npm packages...
cd /d "%PROJECT_DIR%"
call npm install
echo [OK] npm packages installed

REM ============================================================================
REM  API Key Setup
REM ============================================================================

if "%GOOGLE_API_KEY%"=="" (
    echo.
    echo [WARNING] GOOGLE_API_KEY is not set (needed for YouTube search).
    echo   Get a key from: https://console.cloud.google.com
    echo.
    set /p API_KEY="  Enter your Google API Key (or press Enter to skip): "
    if not "!API_KEY!"=="" (
        set "GOOGLE_API_KEY=!API_KEY!"
        echo [OK] GOOGLE_API_KEY set for this session
    ) else (
        echo [WARNING] YouTube search won't work without GOOGLE_API_KEY.
    )
) else (
    echo [OK] GOOGLE_API_KEY is already set
)

REM ============================================================================
REM  Database Setup
REM ============================================================================

echo.
echo [STEP] Setting up database...
if "%DATABASE_URL%"=="" (
    echo [WARNING] DATABASE_URL is not set.
    echo.
    echo   Enter your PostgreSQL connection URL
    echo   (or press Enter to skip database setup):
    echo.
    set /p DB_URL="  DATABASE_URL: "
    if not "!DB_URL!"=="" (
        set "DATABASE_URL=!DB_URL!"
        echo [OK] DATABASE_URL set for this session
    ) else (
        echo [WARNING] Skipping database setup. Set DATABASE_URL before running the app.
        goto :BUILD
    )
)

cd /d "%PROJECT_DIR%"
call npm run db:push 2>nul && echo [OK] Database schema pushed || echo [WARNING] Database push failed. Run 'npm run db:push' manually.

REM ============================================================================
REM  Build
REM ============================================================================

:BUILD

if "%BUILD_TARGET%"=="web" goto :BUILD_WEB
if "%BUILD_TARGET%"=="desktop" goto :BUILD_DESKTOP
if "%BUILD_TARGET%"=="mobile" goto :BUILD_MOBILE
if "%BUILD_TARGET%"=="all" goto :BUILD_ALL
if "%BUILD_TARGET%"=="deps" goto :SUMMARY
goto :SUMMARY

:BUILD_WEB
echo.
echo [STEP] Building web application...
cd /d "%PROJECT_DIR%"
call npm run build
echo [OK] Web application built (output: dist/)
goto :SUMMARY

:BUILD_DESKTOP
echo.
echo [STEP] Building Windows desktop application...
cd /d "%PROJECT_DIR%"
call npm run build
echo   Building Windows .exe installer...
call npx electron-builder --win
echo.
echo [OK] Windows app built!
echo   Output: electron-dist\
dir electron-dist\*.exe 2>nul
goto :SUMMARY

:BUILD_MOBILE
echo.
echo [STEP] Preparing Android app build...
cd /d "%PROJECT_DIR%"
call npm run build
cd /d "%PROJECT_DIR%\client"
if not exist "android" (
    echo   Adding Android platform...
    call npx cap add android
)
echo   Syncing web app to Android project...
call npx cap sync android
echo [OK] Android project ready!
echo.
echo   Next steps:
echo     1. Open in Android Studio:  cd client ^&^& npx cap open android
echo     2. Connect your device or start an emulator
echo     3. Click Run to install the app
goto :SUMMARY

:BUILD_ALL
call :BUILD_WEB
call :BUILD_DESKTOP
call :BUILD_MOBILE
goto :SUMMARY

REM ============================================================================
REM  Summary
REM ============================================================================

:SUMMARY
echo.
echo ============================================================================
echo   Build Complete!
echo ============================================================================
echo.
echo   Platform: Windows
echo   Build:    %BUILD_TARGET%
echo.

if "%BUILD_TARGET%"=="web" (
    echo   To run the web app:
    echo     cd %PROJECT_DIR%
    echo     npm run dev
    echo     Then open http://localhost:5000
    echo.
)

if "%BUILD_TARGET%"=="desktop" (
    echo   Desktop app output: %PROJECT_DIR%electron-dist\
    echo.
)

if "%DATABASE_URL%"=="" (
    echo [WARNING] Remember to set DATABASE_URL before running the app!
)
if "%GOOGLE_API_KEY%"=="" (
    echo [WARNING] Remember to set GOOGLE_API_KEY for YouTube search!
)

echo.
if "%BUILD_TARGET%"=="web" (
    set /p START_APP="  Start the app now? (y/n): "
    if /i "!START_APP!"=="y" (
        cd /d "%PROJECT_DIR%"
        call npm run dev
    )
)

endlocal
