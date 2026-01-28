# replit.md

## Overview

SoundGrab is a YouTube audio downloader application that allows users to search for songs on YouTube and download them as MP3 files. The app features a React frontend with a search interface, real-time download progress tracking, and a local library for managing downloaded songs. The backend is an Express server that handles YouTube API searches and audio downloads using yt-dlp.

## Technical Documentation

Comprehensive technical documentation is available in the `docs/` directory:

- **docs/README.txt** - Documentation index and reading guide
- **docs/01-ARCHITECTURE-OVERVIEW.txt** - System architecture and technology stack
- **docs/02-FRONTEND-COMPONENTS.txt** - Detailed React component documentation
- **docs/03-BACKEND-API.txt** - Complete API reference and server implementation
- **docs/04-DATA-SCHEMAS.txt** - Data structures and type definitions
- **docs/05-DESIGN-DECISIONS.txt** - Architectural decisions and rationale
- **docs/06-VARIABLE-FUNCTION-REFERENCE.txt** - Complete code reference index

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state, local React state for UI
- **Styling**: Tailwind CSS with custom theme configuration (professional beige/white color scheme with IBM Plex Mono font)
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Local Storage**: IndexedDB for storing downloaded song metadata (browser-side database)
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Framework**: Express.js (v5) with TypeScript
- **API Design**: REST endpoints for search and download operations
- **YouTube Integration**: Uses Google YouTube Data API for search, yt-dlp for downloading
- **File Storage**: Downloads stored in a local `downloads` directory
- **Progress Streaming**: Server-Sent Events (SSE) for real-time download progress

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/search` | GET | Search YouTube for music videos |
| `/api/download` | POST | Download audio as MP3 (SSE stream) |
| `/api/files/:filename` | GET | Serve downloaded MP3 files |

### Key Design Decisions

1. **Client-side metadata storage**: Song metadata is stored in IndexedDB rather than a server database. This keeps the app simple and allows offline access to library information.

2. **Monorepo structure**: The project uses a shared directory for schemas and types used by both frontend and backend, ensuring type safety across the stack.

3. **Schema validation**: Zod is used for runtime schema validation on both client and server.

4. **Professional design**: The app uses a subdued beige/white color scheme with IBM Plex Mono monospace font for a technical, professional aesthetic.

5. **Server-Sent Events**: Download progress is streamed to the client via SSE for real-time feedback.

### Directory Structure
```
project-root/
├── client/               # React frontend application
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Route-level components
│   │   ├── lib/          # Utilities (db.ts, queryClient.ts)
│   │   └── hooks/        # Custom React hooks
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

### Client-Side Storage
- **IndexedDB**: Browser-side storage for song library metadata
  - Database: MusicDownloaderDB
  - Store: songs
  - Indexes: videoId (unique), artist, downloadedAt

### Key NPM Packages
- `@tanstack/react-query`: Data fetching and caching
- `zod`: Schema validation
- `wouter`: Client-side routing (1KB alternative to React Router)
- `lucide-react`: Icon library
- Radix UI primitives: Accessible UI component foundations

## Development

### Running the Application
The application runs via the "Start application" workflow which executes `npm run dev`.
This starts both the Express backend and Vite frontend dev server on port 5000.

### Environment Variables
- `GOOGLE_API_KEY`: YouTube Data API v3 key (required for search functionality)
