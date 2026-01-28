import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";

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
    const ytdlp = spawn("yt-dlp", [
      "-x",
      "--audio-format", "mp3",
      "--audio-quality", "0",
      "-o", outputPath,
      "--no-playlist",
      "--newline",
      "--progress",
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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
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
      const filename = decodeURIComponent(req.params.filename);
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

  return httpServer;
}
