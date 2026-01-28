import { z } from "zod";

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

// Song metadata schema (for storing in client-side DB)
export const songMetadataSchema = z.object({
  id: z.string(),
  videoId: z.string(),
  title: z.string(),
  artist: z.string().optional(),
  album: z.string().optional(),
  genre: z.string().optional(),
  thumbnail: z.string(),
  downloadedAt: z.string(),
  filePath: z.string().optional(),
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
