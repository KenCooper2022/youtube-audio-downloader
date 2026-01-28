import { z } from "zod";
import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// ============================================================================
// DATABASE TABLES (Drizzle ORM - PostgreSQL)
// ============================================================================

/**
 * SONGS TABLE
 * 
 * Primary table for storing downloaded song metadata.
 * Each record represents a single downloaded audio file.
 * 
 * SQL equivalent:
 * CREATE TABLE songs (
 *   id VARCHAR PRIMARY KEY,
 *   video_id VARCHAR NOT NULL UNIQUE,
 *   title TEXT NOT NULL,
 *   artist TEXT,
 *   album TEXT,
 *   genre TEXT,
 *   thumbnail TEXT NOT NULL,
 *   file_path TEXT,
 *   downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
 * );
 * 
 * Indexes:
 * - PRIMARY KEY on id (implicit)
 * - UNIQUE constraint on video_id (prevents duplicate downloads)
 */
export const songs = pgTable("songs", {
  // Primary key - UUID generated on insert
  id: varchar("id", { length: 36 }).primaryKey(),
  
  // YouTube video identifier - must be unique to prevent duplicates
  videoId: varchar("video_id", { length: 32 }).notNull().unique(),
  
  // Original video title from YouTube
  title: text("title").notNull(),
  
  // Extracted or inferred artist name (nullable)
  artist: text("artist"),
  
  // Album name if detected from title (nullable)
  album: text("album"),
  
  // Musical genre inferred from keywords (nullable)
  genre: text("genre"),
  
  // YouTube thumbnail URL for display
  thumbnail: text("thumbnail").notNull(),
  
  // Server file path for re-downloading (nullable)
  filePath: text("file_path"),
  
  // Timestamp when song was downloaded
  downloadedAt: timestamp("downloaded_at", { withTimezone: true }).defaultNow().notNull(),
});

// Insert schema for validation (omits auto-generated fields)
export const insertSongSchema = createInsertSchema(songs).omit({
  downloadedAt: true,
});

// Types derived from table definition
export type Song = typeof songs.$inferSelect;
export type InsertSong = z.infer<typeof insertSongSchema>;

// ============================================================================
// ZOD SCHEMAS (API Validation)
// ============================================================================

// YouTube search result schema
export const youtubeVideoSchema = z.object({
  videoId: z.string(),
  title: z.string(),
  channelTitle: z.string(),
  thumbnail: z.string(),
  publishedAt: z.string(),
  description: z.string().optional(),
});

export type YouTubeVideo = z.infer<typeof youtubeVideoSchema>;

// Search request schema
export const searchRequestSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  type: z.enum(["audio", "lyric", "both"]).default("both"),
});

export type SearchRequest = z.infer<typeof searchRequestSchema>;

// Search response schema
export const searchResponseSchema = z.object({
  results: z.array(youtubeVideoSchema),
  nextPageToken: z.string().optional(),
});

export type SearchResponse = z.infer<typeof searchResponseSchema>;

// Song metadata schema (legacy - for API responses)
export const songMetadataSchema = z.object({
  id: z.string(),
  videoId: z.string(),
  title: z.string(),
  artist: z.string().nullable().optional(),
  album: z.string().nullable().optional(),
  genre: z.string().nullable().optional(),
  thumbnail: z.string(),
  downloadedAt: z.string(),
  filePath: z.string().nullable().optional(),
});

export type SongMetadata = z.infer<typeof songMetadataSchema>;

// Download request schema
export const downloadRequestSchema = z.object({
  videoId: z.string(),
  title: z.string(),
  thumbnail: z.string(),
});

export type DownloadRequest = z.infer<typeof downloadRequestSchema>;

// Download progress schema
export const downloadProgressSchema = z.object({
  videoId: z.string(),
  progress: z.number().min(0).max(100),
  status: z.enum(["pending", "downloading", "processing", "complete", "error"]),
  message: z.string().optional(),
  downloadUrl: z.string().optional(),
});

export type DownloadProgress = z.infer<typeof downloadProgressSchema>;

// Metadata search result schema
export const metadataResultSchema = z.object({
  artist: z.string().optional(),
  album: z.string().optional(),
  genre: z.string().optional(),
  releaseYear: z.string().optional(),
});

export type MetadataResult = z.infer<typeof metadataResultSchema>;

// Album track schema
export const albumTrackSchema = z.object({
  trackNumber: z.number(),
  trackName: z.string(),
  artistName: z.string(),
  trackTimeMillis: z.number().optional(),
  youtubeVideoId: z.string().optional(),
  youtubeTitle: z.string().optional(),
  youtubeThumbnail: z.string().optional(),
  available: z.boolean(),
});

export type AlbumTrack = z.infer<typeof albumTrackSchema>;

// Album schema
export const albumSchema = z.object({
  collectionId: z.number(),
  collectionName: z.string(),
  artistName: z.string(),
  artworkUrl: z.string(),
  trackCount: z.number(),
  releaseDate: z.string(),
  genre: z.string().optional(),
  tracks: z.array(albumTrackSchema),
});

export type Album = z.infer<typeof albumSchema>;
