# replit.md

## Overview

This is a music downloader application that allows users to search for songs on YouTube and download them. The app features a React frontend with a search interface, download progress tracking, and a local library for managing downloaded songs. The backend is an Express server that handles YouTube API searches and audio downloads using yt-dlp.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state, local React state for UI
- **Styling**: Tailwind CSS with custom theme configuration (magenta, white, black, cyan color scheme)
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Local Storage**: IndexedDB for storing downloaded song metadata (browser-side database)
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Framework**: Express.js (v5) with TypeScript
- **API Design**: REST endpoints for search and download operations
- **YouTube Integration**: Uses Google YouTube Data API for search, yt-dlp for downloading
- **File Storage**: Downloads stored in a local `downloads` directory

### Key Design Decisions

1. **Client-side metadata storage**: Song metadata is stored in IndexedDB rather than a server database. This keeps the app simple and allows offline access to library information.

2. **Monorepo structure**: The project uses a shared directory for schemas and types used by both frontend and backend, ensuring type safety across the stack.

3. **Schema validation**: Zod is used for runtime schema validation on both client and server, with drizzle-zod for database schema generation.

4. **Dark mode by default**: The app defaults to dark mode with a vibrant magenta/cyan color scheme.

### Directory Structure
- `client/` - React frontend application
- `server/` - Express backend server
- `shared/` - Shared TypeScript schemas and types
- `script/` - Build scripts
- `migrations/` - Drizzle database migrations

## External Dependencies

### APIs and Services
- **YouTube Data API**: Used for searching videos (requires `GOOGLE_API_KEY` environment variable)
- **yt-dlp**: Command-line tool for downloading audio from YouTube videos (must be installed on the system)

### Database
- **PostgreSQL**: Configured via Drizzle ORM (requires `DATABASE_URL` environment variable)
- **IndexedDB**: Browser-side storage for song library metadata

### Key NPM Packages
- `drizzle-orm` / `drizzle-kit`: Database ORM and migrations
- `@tanstack/react-query`: Data fetching and caching
- `zod`: Schema validation
- `express-session` / `connect-pg-simple`: Session management with PostgreSQL store
- `wouter`: Client-side routing
- Radix UI primitives: Accessible UI component foundations