# replit.md

## Overview

This is a YouTube audio downloader application that allows users to search for songs on YouTube and download them as MP3 files. The app features a React frontend with a search interface, real-time download progress tracking, and a local library for managing downloaded songs. The backend is an Express server that handles YouTube API searches and audio downloads using yt-dlp.

## Technical Documentation

Comprehensive technical documentation is available in the `docs/` directory:

- **docs/README.txt** - Documentation index and reading guide
- **docs/01-ARCHITECTURE-OVERVIEW.txt** - System architecture and technology stack
- **docs/02-FRONTEND-COMPONENTS.txt** - Detailed React component documentation
- **docs/03-BACKEND-API.txt** - Complete API reference and server implementation
- **docs/04-DATA-SCHEMAS.txt** - Data structures and type definitions
- **docs/05-DESIGN-DECISIONS.txt** - Architectural decisions and rationale
- **docs/06-VARIABLE-FUNCTION-REFERENCE.txt** - Complete code reference index
- **docs/07-DATABASE-DOCUMENTATION.txt** - PostgreSQL database schema, SQL operations, and integration guide
- **docs/08-MOBILE-APP-SETUP.txt** - Android and iOS mobile app build and setup guide
- **docs/09-ELECTRON-BUILD.txt** - Desktop application build guide (macOS .dmg, Windows .exe)

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state, local React state for UI
- **Styling**: Tailwind CSS with custom theme configuration (clean white/gray color scheme with IBM Plex Mono font)
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Framework**: Express.js (v5) with TypeScript
- **API Design**: REST endpoints for search, download, and song CRUD operations
- **Database**: PostgreSQL with Drizzle ORM for type-safe queries
- **YouTube Integration**: Uses Google YouTube Data API for search, yt-dlp for downloading
- **File Storage**: Downloads stored in a local `downloads` directory
- **Progress Streaming**: Server-Sent Events (SSE) for real-time download progress

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/search` | GET | Search YouTube for music videos |
| `/api/download` | POST | Download audio as MP3 (SSE stream) |
| `/api/files/:filename` | GET | Serve downloaded MP3 files |
| `/api/songs` | GET | Get all songs from database |
| `/api/songs` | POST | Create a new song record |
| `/api/songs/:id` | GET | Get a song by ID |
| `/api/songs/:id` | PATCH | Update a song's metadata |
| `/api/songs/:id` | DELETE | Delete a song from database |
| `/api/songs/video/:videoId` | GET | Get song by YouTube video ID |

### Key Design Decisions

1. **Server-side database storage**: Song metadata is stored in PostgreSQL via Drizzle ORM. This enables data persistence across devices and sessions.

2. **Monorepo structure**: The project uses a shared directory for schemas and types used by both frontend and backend, ensuring type safety across the stack.

3. **Schema validation**: Zod is used for runtime schema validation on both client and server.

4. **Professional design**: The app uses a subdued beige/white color scheme with IBM Plex Mono monospace font for a technical, professional aesthetic.

5. **Server-Sent Events**: Download progress is streamed to the client via SSE for real-time feedback.

6. **Mobile App Support**: The app can be built as native Android/iOS apps using Capacitor. Mobile apps connect to a server running elsewhere, with configurable server URL in the Settings tab.

### Directory Structure
```
project-root/
├── client/               # React frontend application
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Route-level components
│   │   ├── lib/          # Utilities (db.ts, queryClient.ts, config.ts)
│   │   └── hooks/        # Custom React hooks
│   ├── capacitor.config.ts  # Capacitor mobile configuration
│   ├── android/          # Android native project (after cap add)
│   └── ios/              # iOS native project (after cap add)
├── server/               # Express backend server
│   ├── routes.ts         # API route definitions
│   └── index.ts          # Server entry point
├── shared/               # Shared TypeScript schemas and types
│   └── schema.ts         # Zod schemas
├── docs/                 # Technical documentation
│   └── *.txt             # Documentation files
├── downloads/            # Downloaded MP3 files (created at runtime)
└── script/               # Build scripts
```

## External Dependencies

### APIs and Services
- **YouTube Data API**: Used for searching videos (requires `GOOGLE_API_KEY` environment variable)
- **yt-dlp**: Command-line tool for downloading audio from YouTube videos
- **FFmpeg**: Audio conversion tool used by yt-dlp

### Database
- **PostgreSQL**: Server-side relational database (Neon-backed via Replit)
  - Table: songs
  - Columns: id, video_id (unique), title, artist, album, genre, thumbnail, file_path, downloaded_at
  - ORM: Drizzle ORM for type-safe queries

### Key NPM Packages
- `@tanstack/react-query`: Data fetching and caching
- `zod`: Schema validation
- `wouter`: Client-side routing (1KB alternative to React Router)
- `lucide-react`: Icon library
- `node-id3`: ID3 tag embedding for MP3 metadata
- `@capacitor/core`, `@capacitor/android`, `@capacitor/ios`: Mobile app framework
- Radix UI primitives: Accessible UI component foundations

## Development

### Running the Application
The application runs via the "Start application" workflow which executes `npm run dev`.
This starts both the Express backend and Vite frontend dev server on port 5000.

### Environment Variables
- `GOOGLE_API_KEY`: YouTube Data API v3 key (required for search functionality)

### Universal Installer Script
The project includes an all-in-one installer that works on macOS, Windows, and Linux:

**Quick Start (macOS/Linux):**
```
./install.sh
```

**Quick Start (Windows):**
```
install.bat
```

The installer will:
1. Detect your operating system
2. Install missing dependencies (Node.js, yt-dlp, FFmpeg)
3. Install npm packages
4. Prompt for database and API key setup
5. Build the web app, desktop app, or mobile app (your choice)

**Command-line options:**
- `./install.sh web` - Build web app only
- `./install.sh desktop` - Build desktop app for current OS
- `./install.sh mobile` - Prepare mobile app builds
- `./install.sh all` - Build everything possible

### Packaging for Distribution
To create a zip/tar.gz archive of the project for sharing:
```
./script/package-zip.sh
```
This creates a `youtube-audio-downloader.tar.gz` (or `.zip` if available) containing all source code and the installer scripts. The recipient just extracts and runs `./install.sh`.

### Building Desktop App (macOS .dmg)
To build as a standalone Mac application:
1. Clone the project to a Mac computer
2. Run `npm install`
3. Run `npm run build`
4. Run `./script/build-electron.sh mac`
5. Find the .dmg file in `electron-dist/` directory

Requirements: yt-dlp and FFmpeg must be installed on the Mac (`brew install yt-dlp ffmpeg`)
