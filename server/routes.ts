import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import { storage } from "./storage";
import { insertSongSchema } from "@shared/schema";
import { randomUUID } from "crypto";

const YOUTUBE_API_KEY = process.env.GOOGLE_API_KEY;
const DOWNLOAD_DIR = path.join(process.cwd(), "downloads");

if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

interface YouTubeSearchItem {
  id: { videoId: string };
  snippet: {
    title: string;
    channelTitle: string;
    publishedAt: string;
    description: string;
    thumbnails: {
      high?: { url: string };
      medium?: { url: string };
      default?: { url: string };
    };
  };
}

interface YouTubeSearchResponse {
  items: YouTubeSearchItem[];
  nextPageToken?: string;
}

interface MusicMetadata {
  artist: string;
  album: string;
  genre: string;
}

async function searchYouTube(query: string, type: string): Promise<YouTubeSearchResponse> {
  return new Promise((resolve, reject) => {
    let searchQuery = query;
    if (type === "audio") {
      searchQuery = `${query} official audio`;
    } else if (type === "lyric") {
      searchQuery = `${query} lyric video`;
    } else {
      searchQuery = `${query} audio OR lyric video`;
    }

    const params = new URLSearchParams({
      part: "snippet",
      q: searchQuery,
      type: "video",
      videoCategoryId: "10",
      maxResults: "20",
      key: YOUTUBE_API_KEY || "",
    });

    const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;

    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(json.error.message || "YouTube API error"));
          } else {
            resolve(json);
          }
        } catch (e) {
          reject(new Error("Failed to parse YouTube response"));
        }
      });
    }).on("error", reject);
  });
}

function parseMetadataFromTitle(title: string, channelTitle: string): MusicMetadata {
  let artist = "";
  let album = "";
  let genre = "";

  const separators = [" - ", " – ", " — ", " | ", " by "];
  for (const sep of separators) {
    if (title.includes(sep)) {
      const parts = title.split(sep);
      if (parts.length >= 2) {
        artist = parts[0].trim();
        break;
      }
    }
  }

  if (!artist && channelTitle) {
    const cleanChannel = channelTitle
      .replace(/VEVO$/i, "")
      .replace(/Official$/i, "")
      .replace(/Music$/i, "")
      .trim();
    artist = cleanChannel;
  }

  const titleLower = title.toLowerCase();
  if (titleLower.includes("hip hop") || titleLower.includes("rap")) {
    genre = "Hip Hop";
  } else if (titleLower.includes("rock")) {
    genre = "Rock";
  } else if (titleLower.includes("pop")) {
    genre = "Pop";
  } else if (titleLower.includes("jazz")) {
    genre = "Jazz";
  } else if (titleLower.includes("classical")) {
    genre = "Classical";
  } else if (titleLower.includes("electronic") || titleLower.includes("edm")) {
    genre = "Electronic";
  } else if (titleLower.includes("r&b") || titleLower.includes("soul")) {
    genre = "R&B/Soul";
  } else if (titleLower.includes("country")) {
    genre = "Country";
  } else if (titleLower.includes("latin") || titleLower.includes("reggaeton")) {
    genre = "Latin";
  } else if (titleLower.includes("indie")) {
    genre = "Indie";
  }

  const albumPatterns = [
    /\(from ["']?([^"')]+)["']?\)/i,
    /\[from ["']?([^"'\]]+)["']?\]/i,
    /album[:\s]+["']?([^"']+)["']?/i,
  ];
  for (const pattern of albumPatterns) {
    const match = title.match(pattern);
    if (match) {
      album = match[1].trim();
      break;
    }
  }

  return { artist, album, genre };
}

function downloadAudio(
  videoId: string, 
  outputPath: string,
  onProgress: (progress: number, message: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const ytdlpPath = process.env.YTDLP_PATH || "/tmp/yt-dlp";
    const ytdlp = spawn(ytdlpPath, [
      "-x",
      "--audio-format", "mp3",
      "--audio-quality", "0",
      "-o", outputPath,
      "--no-playlist",
      "--newline",
      "--progress",
      "--extractor-args", "youtube:player_client=android_vr",
      `https://www.youtube.com/watch?v=${videoId}`,
    ]);

    let stderr = "";
    
    ytdlp.stdout.on("data", (data) => {
      const output = data.toString();
      const lines = output.split("\n");
      
      for (const line of lines) {
        const progressMatch = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
        if (progressMatch) {
          const percent = parseFloat(progressMatch[1]);
          const scaledProgress = 20 + (percent * 0.6);
          onProgress(Math.min(80, scaledProgress), `Downloading: ${Math.round(percent)}%`);
        }
        
        if (line.includes("[ExtractAudio]")) {
          onProgress(85, "Converting to MP3...");
        }
      }
    });

    ytdlp.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ytdlp.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr || `yt-dlp exited with code ${code}`));
      }
    });

    ytdlp.on("error", (err) => {
      reject(new Error(`Failed to start yt-dlp: ${err.message}`));
    });
  });
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 100);
}

async function searchITunesAlbumArt(artist: string, song: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(`${artist} ${song}`);
    const response = await fetch(
      `https://itunes.apple.com/search?term=${query}&media=music&entity=song&limit=5`
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      const artwork = data.results[0].artworkUrl100;
      if (artwork) {
        return artwork.replace('100x100bb', '600x600bb');
      }
    }
    return null;
  } catch (error) {
    console.error("iTunes search error:", error);
    return null;
  }
}

interface ITunesAlbumResult {
  collectionId: number;
  collectionName: string;
  artistName: string;
  artworkUrl100: string;
  trackCount: number;
  releaseDate: string;
  primaryGenreName?: string;
}

interface ITunesTrackResult {
  wrapperType: string;
  trackNumber: number;
  trackName: string;
  artistName: string;
  trackTimeMillis?: number;
}

async function searchITunesAlbums(query: string): Promise<ITunesAlbumResult[]> {
  try {
    const response = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=album&limit=10`
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("iTunes album search error:", error);
    return [];
  }
}

async function getAlbumTracks(collectionId: number): Promise<ITunesTrackResult[]> {
  try {
    const response = await fetch(
      `https://itunes.apple.com/lookup?id=${collectionId}&entity=song`
    );
    if (!response.ok) return [];
    const data = await response.json();
    return (data.results || []).filter((r: any) => r.wrapperType === 'track');
  } catch (error) {
    console.error("iTunes track lookup error:", error);
    return [];
  }
}

async function findYouTubeForTrack(artistName: string, trackName: string): Promise<{videoId: string; title: string; thumbnail: string} | null> {
  try {
    if (!YOUTUBE_API_KEY) return null;
    const query = `${artistName} ${trackName} official audio`;
    const params = new URLSearchParams({
      part: "snippet",
      q: query,
      type: "video",
      videoCategoryId: "10",
      maxResults: "1",
      key: YOUTUBE_API_KEY,
    });
    
    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.items && data.items.length > 0) {
      const item = data.items[0];
      return {
        videoId: item.id.videoId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || '',
      };
    }
    return null;
  } catch (error) {
    console.error("YouTube track search error:", error);
    return null;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/download-image", async (req: Request, res: Response) => {
    try {
      const url = req.query.url as string;
      const filename = (req.query.filename as string) || "album-art.jpg";
      
      if (!url) {
        return res.status(400).json({ message: "Image URL is required" });
      }

      const response = await fetch(url);
      if (!response.ok) {
        return res.status(404).json({ message: "Image not found" });
      }

      const contentType = response.headers.get("content-type") || "image/jpeg";
      const buffer = await response.arrayBuffer();

      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error("Image download error:", error);
      res.status(500).json({ message: "Failed to download image" });
    }
  });

  app.get("/api/albums/search", async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ message: "Search query is required" });
      }
      
      const albums = await searchITunesAlbums(query);
      const results = albums.map(album => ({
        collectionId: album.collectionId,
        collectionName: album.collectionName,
        artistName: album.artistName,
        artworkUrl: album.artworkUrl100?.replace('100x100bb', '600x600bb') || '',
        trackCount: album.trackCount,
        releaseDate: album.releaseDate,
        genre: album.primaryGenreName,
      }));
      
      res.json({ albums: results });
    } catch (error) {
      console.error("Album search error:", error);
      res.status(500).json({ message: "Album search failed" });
    }
  });

  app.get("/api/albums/:collectionId", async (req: Request, res: Response) => {
    try {
      const collectionId = parseInt(req.params.collectionId);
      if (isNaN(collectionId)) {
        return res.status(400).json({ message: "Invalid collection ID" });
      }

      const response = await fetch(
        `https://itunes.apple.com/lookup?id=${collectionId}&entity=song`
      );
      if (!response.ok) {
        return res.status(404).json({ message: "Album not found" });
      }
      
      const data = await response.json();
      const results = data.results || [];
      
      if (results.length === 0) {
        return res.status(404).json({ message: "Album not found" });
      }
      
      const albumInfo = results[0];
      const tracks = results.filter((r: any) => r.wrapperType === 'track');
      
      const tracksWithYouTube = await Promise.all(
        tracks.map(async (track: ITunesTrackResult) => {
          const ytResult = await findYouTubeForTrack(track.artistName, track.trackName);
          return {
            trackNumber: track.trackNumber,
            trackName: track.trackName,
            artistName: track.artistName,
            trackTimeMillis: track.trackTimeMillis,
            youtubeVideoId: ytResult?.videoId || undefined,
            youtubeTitle: ytResult?.title || undefined,
            youtubeThumbnail: ytResult?.thumbnail || undefined,
            available: !!ytResult,
          };
        })
      );
      
      res.json({
        collectionId: albumInfo.collectionId,
        collectionName: albumInfo.collectionName,
        artistName: albumInfo.artistName,
        artworkUrl: albumInfo.artworkUrl100?.replace('100x100bb', '600x600bb') || '',
        trackCount: albumInfo.trackCount,
        releaseDate: albumInfo.releaseDate,
        genre: albumInfo.primaryGenreName,
        tracks: tracksWithYouTube,
      });
    } catch (error) {
      console.error("Album lookup error:", error);
      res.status(500).json({ message: "Album lookup failed" });
    }
  });

  app.get("/api/album-art", async (req: Request, res: Response) => {
    try {
      const artist = req.query.artist as string;
      const song = req.query.song as string;
      
      if (!artist && !song) {
        return res.status(400).json({ message: "Artist or song name required" });
      }
      
      const albumArt = await searchITunesAlbumArt(artist || "", song || "");
      
      if (albumArt) {
        res.json({ albumArt, source: "itunes" });
      } else {
        res.json({ albumArt: null, source: null });
      }
    } catch (error) {
      console.error("Album art search error:", error);
      res.json({ albumArt: null, source: null });
    }
  });
  
  app.get("/api/search", async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;
      const type = (req.query.type as string) || "both";

      if (!query) {
        return res.status(400).json({ message: "Search query is required" });
      }

      if (!YOUTUBE_API_KEY) {
        return res.status(500).json({ message: "YouTube API key not configured" });
      }

      const response = await searchYouTube(query, type);
      
      const results = response.items
        .filter((item) => item.id.videoId)
        .map((item) => ({
          videoId: item.id.videoId,
          title: item.snippet.title,
          channelTitle: item.snippet.channelTitle,
          publishedAt: item.snippet.publishedAt,
          description: item.snippet.description,
          thumbnail:
            item.snippet.thumbnails.high?.url ||
            item.snippet.thumbnails.medium?.url ||
            item.snippet.thumbnails.default?.url ||
            "",
        }));

      res.json({ results, nextPageToken: response.nextPageToken });
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Search failed",
      });
    }
  });

  app.post("/api/download", async (req: Request, res: Response) => {
    try {
      const { videoId, title, channelTitle } = req.body;

      if (!videoId) {
        return res.status(400).json({ message: "Video ID is required" });
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      const sendProgress = (data: object) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      const safeTitle = sanitizeFilename(title || videoId);
      const outputPath = path.join(DOWNLOAD_DIR, `${safeTitle}.mp3`);

      sendProgress({
        progress: 5,
        status: "downloading",
        message: "Connecting to YouTube...",
      });

      sendProgress({
        progress: 15,
        status: "downloading",
        message: "Fetching audio stream...",
      });

      const metadata = parseMetadataFromTitle(title || "", channelTitle || "");

      await downloadAudio(videoId, outputPath, (progress, message) => {
        sendProgress({
          progress,
          status: "downloading",
          message,
        });
      });

      sendProgress({
        progress: 90,
        status: "processing",
        message: "Finalizing...",
      });

      if (!fs.existsSync(outputPath)) {
        throw new Error("Download failed - file not created");
      }

      const downloadUrl = `/api/files/${encodeURIComponent(path.basename(outputPath))}`;

      sendProgress({
        progress: 100,
        status: "complete",
        message: "Download complete!",
        downloadUrl,
        metadata,
      });

      res.end();
    } catch (error) {
      console.error("Download error:", error);
      res.write(
        `data: ${JSON.stringify({
          progress: 0,
          status: "error",
          message: error instanceof Error ? error.message : "Download failed",
        })}\n\n`
      );
      res.end();
    }
  });

  app.get("/api/files/:filename", (req: Request, res: Response) => {
    try {
      const rawFilename = req.params.filename;
      const filename = decodeURIComponent(Array.isArray(rawFilename) ? rawFilename[0] : rawFilename);
      const filePath = path.join(DOWNLOAD_DIR, filename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found" });
      }

      const safePath = path.resolve(filePath);
      if (!safePath.startsWith(path.resolve(DOWNLOAD_DIR))) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("File serve error:", error);
      res.status(500).json({ message: "Failed to serve file" });
    }
  });

  // ============================================================================
  // SONG CRUD ENDPOINTS (PostgreSQL Database)
  // ============================================================================

  /**
   * GET /api/songs
   * 
   * Retrieves all songs from the database.
   * SQL: SELECT * FROM songs ORDER BY downloaded_at DESC
   * 
   * Response: Array of Song objects
   */
  app.get("/api/songs", async (req: Request, res: Response) => {
    try {
      const songs = await storage.getAllSongs();
      // Convert Date objects to ISO strings for JSON serialization
      const serialized = songs.map(song => ({
        ...song,
        downloadedAt: song.downloadedAt.toISOString(),
      }));
      res.json(serialized);
    } catch (error) {
      console.error("Get songs error:", error);
      res.status(500).json({ message: "Failed to retrieve songs" });
    }
  });

  /**
   * GET /api/songs/:id
   * 
   * Retrieves a single song by primary key.
   * SQL: SELECT * FROM songs WHERE id = $1
   * 
   * Response: Song object or 404
   */
  app.get("/api/songs/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const song = await storage.getSong(id);
      
      if (!song) {
        return res.status(404).json({ message: "Song not found" });
      }
      
      res.json({
        ...song,
        downloadedAt: song.downloadedAt.toISOString(),
      });
    } catch (error) {
      console.error("Get song error:", error);
      res.status(500).json({ message: "Failed to retrieve song" });
    }
  });

  /**
   * GET /api/songs/video/:videoId
   * 
   * Retrieves a song by YouTube video ID.
   * SQL: SELECT * FROM songs WHERE video_id = $1
   * 
   * Used to check if a video has already been downloaded.
   * Response: Song object or 404
   */
  app.get("/api/songs/video/:videoId", async (req: Request, res: Response) => {
    try {
      const { videoId } = req.params;
      const song = await storage.getSongByVideoId(videoId);
      
      if (!song) {
        return res.status(404).json({ message: "Song not found" });
      }
      
      res.json({
        ...song,
        downloadedAt: song.downloadedAt.toISOString(),
      });
    } catch (error) {
      console.error("Get song by video ID error:", error);
      res.status(500).json({ message: "Failed to retrieve song" });
    }
  });

  /**
   * POST /api/songs
   * 
   * Creates a new song record in the database.
   * SQL: INSERT INTO songs (...) VALUES (...) RETURNING *
   * 
   * Request body: Song data (id, videoId, title, artist?, album?, genre?, thumbnail, filePath?)
   * Response: Created Song object
   */
  app.post("/api/songs", async (req: Request, res: Response) => {
    try {
      const songData = {
        id: req.body.id || randomUUID(),
        videoId: req.body.videoId,
        title: req.body.title,
        artist: req.body.artist || null,
        album: req.body.album || null,
        genre: req.body.genre || null,
        thumbnail: req.body.thumbnail,
        filePath: req.body.filePath || null,
      };

      // Validate with Zod schema
      const validation = insertSongSchema.safeParse(songData);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid song data",
          errors: validation.error.errors,
        });
      }

      const song = await storage.createSong(validation.data);
      
      res.status(201).json({
        ...song,
        downloadedAt: song.downloadedAt.toISOString(),
      });
    } catch (error: any) {
      console.error("Create song error:", error);
      
      // Handle unique constraint violation (duplicate videoId)
      if (error.code === '23505') {
        return res.status(409).json({ message: "Song already exists" });
      }
      
      res.status(500).json({ message: "Failed to create song" });
    }
  });

  /**
   * PATCH /api/songs/:id
   * 
   * Updates a song's metadata.
   * SQL: UPDATE songs SET ... WHERE id = $1 RETURNING *
   * 
   * Request body: Partial song data
   * Response: Updated Song object
   */
  app.patch("/api/songs/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const song = await storage.updateSong(id, updates);
      
      if (!song) {
        return res.status(404).json({ message: "Song not found" });
      }
      
      res.json({
        ...song,
        downloadedAt: song.downloadedAt.toISOString(),
      });
    } catch (error) {
      console.error("Update song error:", error);
      res.status(500).json({ message: "Failed to update song" });
    }
  });

  /**
   * DELETE /api/songs/:id
   * 
   * Deletes a song from the database.
   * SQL: DELETE FROM songs WHERE id = $1
   * 
   * Note: Does not delete the physical MP3 file.
   * Response: Success message or 404
   */
  app.delete("/api/songs/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteSong(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Song not found" });
      }
      
      res.json({ message: "Song deleted successfully" });
    } catch (error) {
      console.error("Delete song error:", error);
      res.status(500).json({ message: "Failed to delete song" });
    }
  });

  return httpServer;
}
