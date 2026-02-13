import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import archiver from "archiver";
import NodeID3 from "node-id3";
import { storage } from "./storage";
import { insertSongSchema, youtubeTrackCache, songs } from "@shared/schema";
import { randomUUID, createHash } from "crypto";
import { db } from "./db";
import { eq } from "drizzle-orm";

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

// Fallback search using yt-dlp (no API quota)
async function searchWithYtDlp(query: string, maxResults: number = 10): Promise<YouTubeSearchItem[]> {
  return new Promise((resolve) => {
    const results: YouTubeSearchItem[] = [];
    const searchQuery = `ytsearch${maxResults}:${query}`;
    const ytdlpPath = process.env.YTDLP_PATH || "/tmp/yt-dlp";
    
    const ytdlp = spawn(ytdlpPath, [
      "--dump-json",
      "--flat-playlist",
      "--no-warnings",
      "--extractor-args", "youtube:player_client=android",
      "--geo-bypass",
      searchQuery,
    ]);
    
    let buffer = "";
    
    ytdlp.stdout.on("data", (data) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const item = JSON.parse(line);
            results.push({
              id: { videoId: item.id },
              snippet: {
                title: item.title || "",
                channelTitle: item.channel || item.uploader || "",
                publishedAt: item.upload_date || "",
                description: item.description || "",
                thumbnails: {
                  high: { url: item.thumbnail || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg` },
                },
              },
            });
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    });
    
    ytdlp.on("close", () => {
      resolve(results);
    });
    
    ytdlp.on("error", () => {
      resolve([]);
    });
    
    // Timeout after 15 seconds
    setTimeout(() => {
      ytdlp.kill();
      resolve(results);
    }, 15000);
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

const PLAYER_CLIENTS = [
  "android",
  "android_vr",
  "web",
  "mweb",
  "ios",
];

function downloadAudioWithClient(
  videoId: string, 
  outputPath: string,
  playerClient: string,
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
      "--extractor-args", `youtube:player_client=${playerClient}`,
      "--no-check-certificates",
      "--geo-bypass",
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

async function downloadAudio(
  videoId: string, 
  outputPath: string,
  onProgress: (progress: number, message: string) => void
): Promise<void> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < PLAYER_CLIENTS.length; i++) {
    const client = PLAYER_CLIENTS[i];
    try {
      onProgress(10, `Trying download method ${i + 1}/${PLAYER_CLIENTS.length}...`);
      await downloadAudioWithClient(videoId, outputPath, client, onProgress);
      return;
    } catch (error) {
      console.log(`Player client "${client}" failed for ${videoId}, trying next...`);
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  
  throw lastError || new Error("All download methods failed");
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 100);
}

async function fetchImageAsBuffer(url: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const protocol = url.startsWith("https") ? https : require("http");
    protocol.get(url, (response: any) => {
      if (response.statusCode !== 200) {
        resolve(null);
        return;
      }
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => resolve(Buffer.concat(chunks)));
      response.on("error", () => resolve(null));
    }).on("error", () => resolve(null));
  });
}

async function embedID3Tags(
  filePath: string,
  metadata: {
    title?: string;
    artist?: string;
    album?: string;
    genre?: string;
    year?: string;
    trackNumber?: number;
    albumArtUrl?: string;
    fallbackArtUrl?: string; // YouTube thumbnail as fallback
  }
): Promise<void> {
  try {
    const tags: NodeID3.Tags = {};
    
    if (metadata.title) tags.title = metadata.title;
    if (metadata.artist) tags.artist = metadata.artist;
    if (metadata.album) tags.album = metadata.album;
    if (metadata.genre) tags.genre = metadata.genre;
    if (metadata.year) tags.year = metadata.year;
    if (metadata.trackNumber) tags.trackNumber = String(metadata.trackNumber);
    
    // Fetch and embed album art - try primary URL first, then fallback
    let imageBuffer: Buffer | null = null;
    
    if (metadata.albumArtUrl) {
      console.log(`Fetching HD album art from: ${metadata.albumArtUrl}`);
      imageBuffer = await fetchImageAsBuffer(metadata.albumArtUrl);
      if (imageBuffer) {
        console.log(`Successfully fetched album art (${imageBuffer.length} bytes)`);
      } else {
        console.log("Failed to fetch primary album art, trying fallback...");
      }
    }
    
    // Try fallback (YouTube thumbnail) if primary failed
    if (!imageBuffer && metadata.fallbackArtUrl) {
      console.log(`Fetching fallback art from: ${metadata.fallbackArtUrl}`);
      imageBuffer = await fetchImageAsBuffer(metadata.fallbackArtUrl);
      if (imageBuffer) {
        console.log(`Using fallback art (${imageBuffer.length} bytes)`);
      }
    }
    
    if (imageBuffer) {
      tags.image = {
        mime: "image/jpeg",
        type: { id: 3, name: "front cover" },
        description: "Album Art",
        imageBuffer: imageBuffer,
      };
    } else {
      console.log("No album art available for this track");
    }
    
    const success = NodeID3.write(tags, filePath);
    if (!success) {
      console.error("Failed to write ID3 tags to:", filePath);
    }
  } catch (error) {
    console.error("Error embedding ID3 tags:", error);
  }
}

interface SongMetadataResult {
  found: boolean;
  trackName: string | null;
  artistName: string | null;
  albumName: string | null;
  albumArt: string | null;
  releaseDate: string | null;
  genre: string | null;
  trackNumber: number | null;
  trackCount: number | null;
  discNumber: number | null;
  discCount: number | null;
  durationMs: number | null;
  isExplicit: boolean;
  collectionType: string | null;
  previewUrl: string | null;
}

// Clean YouTube title to extract actual song name
function cleanSongTitle(title: string): string {
  return title
    // Remove common YouTube video suffixes
    .replace(/\s*\(Official\s*(Music\s*)?Video\)/gi, "")
    .replace(/\s*\(Official\s*Audio\)/gi, "")
    .replace(/\s*\(Lyrics?\)/gi, "")
    .replace(/\s*\(Lyric\s*Video\)/gi, "")
    .replace(/\s*\(Audio\)/gi, "")
    .replace(/\s*\(Visualizer\)/gi, "")
    .replace(/\s*\(HD\)/gi, "")
    .replace(/\s*\(HQ\)/gi, "")
    .replace(/\s*\[Official.*?\]/gi, "")
    .replace(/\s*\[Lyrics?\]/gi, "")
    .replace(/\s*\[Audio\]/gi, "")
    .replace(/\s*\[HD\]/gi, "")
    .replace(/\s*\(feat\.\s*[^)]+\)/gi, "") // Keep for cleaner search, will be in iTunes result
    .replace(/\s*ft\.\s+\S+/gi, "")
    .replace(/\s*-\s*Topic$/gi, "")
    .replace(/\s*VEVO$/gi, "")
    .replace(/\s*#\w+/g, "") // Remove hashtags
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

// Calculate similarity between two strings (0-1)
function stringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.8;
  }
  
  // Word-based matching
  const words1 = s1.split(/\s+/).filter(w => w.length > 2);
  const words2 = s2.split(/\s+/).filter(w => w.length > 2);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  let matchCount = 0;
  for (const word of words1) {
    if (words2.some(w => w.includes(word) || word.includes(w))) {
      matchCount++;
    }
  }
  
  return matchCount / Math.max(words1.length, words2.length);
}

async function searchITunesSongMetadata(artist: string, song: string): Promise<SongMetadataResult> {
  const emptyResult: SongMetadataResult = {
    found: false,
    trackName: null,
    artistName: null,
    albumName: null,
    albumArt: null,
    releaseDate: null,
    genre: null,
    trackNumber: null,
    trackCount: null,
    discNumber: null,
    discCount: null,
    durationMs: null,
    isExplicit: false,
    collectionType: null,
    previewUrl: null,
  };

  try {
    // Clean the song title for better matching
    const cleanedSong = cleanSongTitle(song);
    const cleanedArtist = artist.trim();
    
    // Extract song name if it's in "Artist - Song" format
    let searchSong = cleanedSong;
    let searchArtist = cleanedArtist;
    
    const separators = [" - ", " – ", " — "];
    for (const sep of separators) {
      if (cleanedSong.includes(sep)) {
        const parts = cleanedSong.split(sep);
        if (parts.length >= 2) {
          // If we don't have an artist, use first part
          if (!searchArtist) {
            searchArtist = parts[0].trim();
          }
          // Song name is the second part
          searchSong = parts.slice(1).join(sep).trim();
          break;
        }
      }
    }
    
    const query = encodeURIComponent(`${searchArtist} ${searchSong}`.trim());
    const response = await fetch(
      `https://itunes.apple.com/search?term=${query}&media=music&entity=song&limit=15`
    );
    
    if (!response.ok) return emptyResult;
    
    const data = await response.json();
    if (!data.results || data.results.length === 0) return emptyResult;
    
    // Find the best matching track
    let bestTrack = null;
    let bestScore = 0;
    
    for (const track of data.results) {
      const trackArtist = track.artistName || "";
      const trackName = track.trackName || "";
      
      // Calculate match scores
      const artistScore = stringSimilarity(searchArtist, trackArtist);
      const songScore = stringSimilarity(searchSong, trackName);
      
      // Weighted score - song title match is more important
      const totalScore = (artistScore * 0.4) + (songScore * 0.6);
      
      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestTrack = track;
      }
    }
    
    // Only return result if we have a reasonable match (score > 0.3)
    if (!bestTrack || bestScore < 0.3) {
      console.log(`iTunes: No good match found for "${searchArtist} - ${searchSong}" (best score: ${bestScore.toFixed(2)})`);
      return emptyResult;
    }
    
    console.log(`iTunes: Matched "${searchArtist} - ${searchSong}" to "${bestTrack.artistName} - ${bestTrack.trackName}" (score: ${bestScore.toFixed(2)})`);
    
    // Use highest resolution available (1200x1200 for HD album art)
    const artwork = bestTrack.artworkUrl100?.replace('100x100bb', '1200x1200bb') || null;
    
    return {
      found: true,
      trackName: bestTrack.trackName || null,
      artistName: bestTrack.artistName || null,
      albumName: bestTrack.collectionName || null,
      albumArt: artwork,
      releaseDate: bestTrack.releaseDate || null,
      genre: bestTrack.primaryGenreName || null,
      trackNumber: bestTrack.trackNumber || null,
      trackCount: bestTrack.trackCount || null,
      discNumber: bestTrack.discNumber || null,
      discCount: bestTrack.discCount || null,
      durationMs: bestTrack.trackTimeMillis || null,
      isExplicit: bestTrack.trackExplicitness === "explicit",
      collectionType: bestTrack.collectionType || null,
      previewUrl: bestTrack.previewUrl || null,
    };
  } catch (error) {
    console.error("iTunes metadata search error:", error);
    return emptyResult;
  }
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
        return artwork.replace('100x100bb', '1200x1200bb');
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
    // Search for albums, songs, AND artists in parallel
    const [albumResponse, songResponse, artistResponse] = await Promise.all([
      fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=album&limit=15`),
      fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=25`),
      fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=musicArtist&limit=3`)
    ]);
    
    const albumResults: ITunesAlbumResult[] = [];
    const seenCollectionIds = new Set<number>();
    
    if (albumResponse.ok) {
      const albumData = await albumResponse.json();
      for (const album of (albumData.results || [])) {
        if (!seenCollectionIds.has(album.collectionId)) {
          seenCollectionIds.add(album.collectionId);
          albumResults.push(album);
        }
      }
    }
    
    // Track artist IDs from songs to look up their discographies too
    const artistIdsFromSongs = new Set<number>();
    
    if (songResponse.ok) {
      const songData = await songResponse.json();
      for (const song of (songData.results || [])) {
        if (song.artistId) {
          artistIdsFromSongs.add(song.artistId);
        }
        if (song.collectionId && !seenCollectionIds.has(song.collectionId)) {
          seenCollectionIds.add(song.collectionId);
          albumResults.push({
            collectionId: song.collectionId,
            collectionName: song.collectionName,
            artistName: song.artistName,
            artworkUrl100: song.artworkUrl100,
            trackCount: song.trackCount,
            releaseDate: song.releaseDate,
            primaryGenreName: song.primaryGenreName,
          } as ITunesAlbumResult);
        }
      }
    }
    
    // Collect artist IDs from artist search AND from song results
    const allArtistIds = new Set<number>();
    
    if (artistResponse.ok) {
      const artistData = await artistResponse.json();
      const artists = (artistData.results || []).filter((r: any) => r.wrapperType === 'artist');
      for (const artist of artists.slice(0, 2)) {
        allArtistIds.add(artist.artistId);
      }
    }
    
    // Also add artist IDs from song results (up to 3 unique artists)
    for (const artistId of Array.from(artistIdsFromSongs).slice(0, 3)) {
      allArtistIds.add(artistId);
    }
    
    // Fetch discographies for all collected artists
    if (allArtistIds.size > 0) {
      const artistAlbumPromises = Array.from(allArtistIds).slice(0, 4).map(async (artistId: number) => {
        try {
          const discogResponse = await fetch(
            `https://itunes.apple.com/lookup?id=${artistId}&entity=album&limit=200`
          );
          if (discogResponse.ok) {
            const discogData = await discogResponse.json();
            return (discogData.results || []).filter((r: any) => r.wrapperType === 'collection');
          }
        } catch (e) {
          console.error("Artist discography lookup error:", e);
        }
        return [];
      });
      
      const artistAlbumsArrays = await Promise.all(artistAlbumPromises);
      const queryLower = query.toLowerCase();
      const queryWords = queryLower.split(/\s+/).filter(w => w.length > 1);
      
      // Separate matched albums by priority for better sorting
      const priorityAlbums: any[] = [];
      const otherAlbums: any[] = [];
      
      for (const artistAlbums of artistAlbumsArrays) {
        for (const album of artistAlbums) {
          if (seenCollectionIds.has(album.collectionId)) continue;
          
          const albumNameLower = (album.collectionName || '').toLowerCase();
          const hasWordMatch = queryWords.some(word => albumNameLower.includes(word));
          const isFullMatch = albumNameLower.includes(queryLower) || queryLower.includes(albumNameLower);
          
          if (isFullMatch || hasWordMatch) {
            seenCollectionIds.add(album.collectionId);
            priorityAlbums.push(album);
          } else if (albumResults.length + priorityAlbums.length + otherAlbums.length < 30) {
            seenCollectionIds.add(album.collectionId);
            otherAlbums.push(album);
          }
        }
      }
      
      // Add priority albums first (those matching query), then others
      albumResults.push(...priorityAlbums, ...otherAlbums);
    }
    
    // Re-sort all results to prioritize albums matching query words
    // Weight less common words (not artist name) more heavily
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 1);
    const commonArtistWords = ['young', 'thug', 'the', 'lil', 'big', 'dj', 'and', 'feat', 'featuring'];
    
    albumResults.sort((a, b) => {
      const aName = (a.collectionName || '').toLowerCase();
      const bName = (b.collectionName || '').toLowerCase();
      
      // Give more weight to uncommon/specific words (album titles vs artist names)
      let aScore = 0, bScore = 0;
      for (const word of queryWords) {
        const weight = commonArtistWords.includes(word) ? 1 : 3; // Specific words worth 3x
        if (aName.includes(word)) aScore += weight;
        if (bName.includes(word)) bScore += weight;
      }
      return bScore - aScore; // Higher score first
    });
    
    return albumResults;
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

function getCacheKey(artistName: string, trackName: string): string {
  const normalized = `${artistName.toLowerCase().trim()}|${trackName.toLowerCase().trim()}`;
  return createHash('sha256').update(normalized).digest('hex').slice(0, 64);
}

async function findYouTubeForTrack(artistName: string, trackName: string): Promise<{videoId: string; title: string; thumbnail: string} | null> {
  try {
    const cacheKey = getCacheKey(artistName, trackName);
    
    // Check cache first - only use if we have a valid videoId
    if (db) {
      const cached = await db.select().from(youtubeTrackCache).where(eq(youtubeTrackCache.id, cacheKey)).limit(1);
      if (cached.length > 0) {
        const entry = cached[0];
        if (entry.youtubeVideoId) {
          console.log(`Cache hit for "${trackName}"`);
          return {
            videoId: entry.youtubeVideoId,
            title: entry.youtubeTitle || '',
            thumbnail: entry.youtubeThumbnail || '',
          };
        }
        console.log(`Removing stale cache entry for "${trackName}" (no videoId)`);
        await db.delete(youtubeTrackCache).where(eq(youtubeTrackCache.id, cacheKey));
      }
    }
    
    // Simple search query
    const query = `${artistName} ${trackName}`;
    let items: any[] = [];
    
    // Try YouTube API first if available
    if (YOUTUBE_API_KEY) {
      const params = new URLSearchParams({
        part: "snippet",
        q: query,
        type: "video",
        maxResults: "5",
        key: YOUTUBE_API_KEY,
      });
      
      const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
      
      if (response.ok) {
        const data = await response.json();
        items = data.items || [];
      } else {
        console.log(`YouTube API failed for "${trackName}", using yt-dlp fallback`);
      }
    }
    
    // Fallback to yt-dlp if API failed or returned no results
    if (items.length === 0) {
      const ytdlpResults = await searchWithYtDlp(query, 5);
      items = ytdlpResults.map(r => ({
        id: { videoId: r.id.videoId },
        snippet: r.snippet,
      }));
    }
    
    if (items.length === 0) {
      console.log(`No results for "${query}" - not caching (will retry next time)`);
      // Don't cache "not found" results - allow retry next time
      // This prevents permanent "unavailable" status due to temporary API issues
      return null;
    }
    
    // Find the best match by checking if track name appears in title
    const trackLower = trackName.toLowerCase();
    let result: {videoId: string; title: string; thumbnail: string} | null = null;
    
    // First try to find a match with track name
    for (const item of items) {
      const titleLower = (item.snippet?.title || '').toLowerCase();
      if (titleLower.includes(trackLower)) {
        result = {
          videoId: item.id.videoId,
          title: item.snippet.title,
          thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || '',
        };
        break;
      }
    }
    
    // Fall back to first result
    if (!result) {
      const item = items[0];
      result = {
        videoId: item.id.videoId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || '',
      };
    }
    
    if (db) {
      await db.insert(youtubeTrackCache).values({
        id: cacheKey,
        artistName,
        trackName,
        youtubeVideoId: result.videoId,
        youtubeTitle: result.title,
        youtubeThumbnail: result.thumbnail,
      }).onConflictDoNothing();
      console.log(`Cached YouTube result for "${trackName}"`);
    }
    return result;
  } catch (error) {
    console.error("YouTube track search error:", error);
    return null;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Enable CORS for mobile app access
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Health check endpoint for mobile apps
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

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
        artworkUrl: album.artworkUrl100?.replace('100x100bb', '1200x1200bb') || '',
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
        artworkUrl: albumInfo.artworkUrl100?.replace('100x100bb', '1200x1200bb') || '',
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

  app.get("/api/song-metadata", async (req: Request, res: Response) => {
    try {
      const artist = req.query.artist as string;
      const song = req.query.song as string;
      
      if (!artist && !song) {
        return res.status(400).json({ message: "Artist or song name required" });
      }
      
      const metadata = await searchITunesSongMetadata(artist || "", song || "");
      res.json(metadata);
    } catch (error) {
      console.error("Song metadata search error:", error);
      res.json({ found: false });
    }
  });
  
  app.get("/api/search", async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;
      const type = (req.query.type as string) || "both";

      if (!query) {
        return res.status(400).json({ message: "Search query is required" });
      }

      let items: YouTubeSearchItem[] = [];
      let nextPageToken: string | undefined;
      let usedFallback = false;

      // Try YouTube API first if available
      if (YOUTUBE_API_KEY) {
        try {
          const response = await searchYouTube(query, type);
          items = response.items;
          nextPageToken = response.nextPageToken;
        } catch (apiError) {
          // If quota exceeded or API error, fall back to yt-dlp
          console.log("YouTube API failed, using yt-dlp fallback:", apiError);
          usedFallback = true;
        }
      } else {
        usedFallback = true;
      }

      // Fallback to yt-dlp search (no quota limits)
      if (usedFallback || items.length === 0) {
        let searchQuery = query;
        if (type === "audio") {
          searchQuery = `${query} official audio`;
        } else if (type === "lyric") {
          searchQuery = `${query} lyric video`;
        }
        
        console.log("Using yt-dlp search for:", searchQuery);
        items = await searchWithYtDlp(searchQuery, 20);
      }
      
      const results = items
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

      res.json({ results, nextPageToken });
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Search failed",
      });
    }
  });

  app.post("/api/download", async (req: Request, res: Response) => {
    try {
      const { videoId, title, channelTitle, thumbnail, knownMetadata } = req.body;

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

      // Download to a temp file first, then rename based on metadata
      const tempPath = path.join(DOWNLOAD_DIR, `${videoId}_temp.mp3`);

      sendProgress({
        progress: 5,
        status: "downloading",
        message: "Connecting to YouTube...",
      });

      // Parse artist and song from title for metadata lookup
      const parsedMetadata = parseMetadataFromTitle(title || "", channelTitle || "");
      
      sendProgress({
        progress: 10,
        status: "downloading",
        message: "Fetching song metadata...",
      });

      // Use pre-known metadata if provided (from album download), otherwise search iTunes
      let iTunesMetadata: SongMetadataResult | null = null;
      
      if (knownMetadata) {
        // Use the pre-known metadata from album (skip iTunes search entirely)
        console.log(`Using known metadata for "${knownMetadata.trackName}" from "${knownMetadata.albumName}"`);
        iTunesMetadata = {
          found: true,
          trackName: knownMetadata.trackName,
          artistName: knownMetadata.artistName,
          albumName: knownMetadata.albumName,
          albumArt: knownMetadata.albumArt,
          genre: knownMetadata.genre,
          releaseDate: knownMetadata.releaseDate,
          trackNumber: knownMetadata.trackNumber,
          trackCount: knownMetadata.trackCount,
          discNumber: knownMetadata.discNumber,
          discCount: knownMetadata.discCount,
          durationMs: knownMetadata.durationMs,
          isExplicit: knownMetadata.isExplicit,
          collectionType: knownMetadata.collectionType,
          previewUrl: knownMetadata.previewUrl,
        };
      } else {
        // Search iTunes for metadata
        try {
          iTunesMetadata = await searchITunesSongMetadata(
            parsedMetadata.artist || "",
            title || ""
          );
        } catch (e) {
          console.log("iTunes metadata lookup failed, using parsed metadata");
        }
      }

      sendProgress({
        progress: 15,
        status: "downloading",
        message: "Fetching audio stream...",
      });

      await downloadAudio(videoId, tempPath, (progress, message) => {
        sendProgress({
          progress,
          status: "downloading",
          message,
        });
      });

      sendProgress({
        progress: 85,
        status: "processing",
        message: "Embedding ID3 tags...",
      });

      if (!fs.existsSync(tempPath)) {
        throw new Error("Download failed - file not created");
      }

      // Build final metadata combining iTunes and parsed data
      const finalMetadata = {
        artist: iTunesMetadata?.artistName || parsedMetadata.artist || "",
        album: iTunesMetadata?.albumName || parsedMetadata.album || "",
        genre: iTunesMetadata?.genre || parsedMetadata.genre || "",
      };

      // Build song title from metadata
      const songTitle = iTunesMetadata?.trackName || parsedMetadata.artist ? 
        (title || "").replace(new RegExp(`^${parsedMetadata.artist}\\s*[-–—]\\s*`, 'i'), '').trim() : 
        (title || videoId);

      // Get YouTube HD thumbnail as fallback (maxresdefault is 1280x720)
      const youtubeHDThumbnail = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
      const youtubeHQThumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      
      // Embed ID3 tags with all available metadata
      const id3Metadata = {
        title: iTunesMetadata?.trackName || songTitle,
        artist: finalMetadata.artist,
        album: finalMetadata.album,
        genre: finalMetadata.genre,
        year: iTunesMetadata?.releaseDate ? new Date(iTunesMetadata.releaseDate).getFullYear().toString() : undefined,
        trackNumber: iTunesMetadata?.trackNumber || undefined,
        albumArtUrl: iTunesMetadata?.albumArt || undefined,
        fallbackArtUrl: thumbnail || youtubeHDThumbnail, // Use provided thumbnail or HD YouTube thumbnail
      };

      await embedID3Tags(tempPath, id3Metadata);

      // Create final filename based on metadata: "Artist - Song Title.mp3"
      const finalSongTitle = iTunesMetadata?.trackName || songTitle;
      const finalArtist = finalMetadata.artist;
      const finalFilename = finalArtist && finalSongTitle ? 
        sanitizeFilename(`${finalArtist} - ${finalSongTitle}`) : 
        sanitizeFilename(title || videoId);
      const finalPath = path.join(DOWNLOAD_DIR, `${finalFilename}.mp3`);

      // Rename temp file to final path (handle duplicates by adding suffix)
      let actualPath = finalPath;
      let counter = 1;
      while (fs.existsSync(actualPath) && actualPath !== tempPath) {
        actualPath = path.join(DOWNLOAD_DIR, `${finalFilename}_${counter}.mp3`);
        counter++;
      }
      
      if (tempPath !== actualPath) {
        fs.renameSync(tempPath, actualPath);
      }

      sendProgress({
        progress: 95,
        status: "processing",
        message: "Finalizing...",
      });

      const downloadUrl = `/api/files/${encodeURIComponent(path.basename(actualPath))}`;

      sendProgress({
        progress: 100,
        status: "complete",
        message: "Download complete!",
        downloadUrl,
        metadata: finalMetadata,
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
      // Sanitize filename for Content-Disposition header (remove non-ASCII chars)
      const safeFilename = filename.replace(/[^\x20-\x7E]/g, '_');
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeFilename}"`
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

  app.get("/api/export-library", async (req: Request, res: Response) => {
    try {
      const songs = await storage.getAllSongs();
      
      if (songs.length === 0) {
        return res.status(400).json({ message: "No songs in library to export" });
      }

      // Filter songs that have actual files
      const songsWithFiles = songs.filter(song => {
        if (!song.filePath) return false;
        const filename = path.basename(song.filePath);
        const fullPath = path.join(DOWNLOAD_DIR, filename);
        return fs.existsSync(fullPath);
      });

      if (songsWithFiles.length === 0) {
        return res.status(400).json({ message: "No downloadable files found in library" });
      }

      // Set headers for ZIP download
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", 'attachment; filename="music-library.zip"');

      // Create archive
      const archive = archiver("zip", { zlib: { level: 5 } });
      
      archive.on("error", (err) => {
        console.error("Archive error:", err);
        if (!res.headersSent) {
          res.status(500).json({ message: "Failed to create archive" });
        }
      });

      // Pipe archive to response
      archive.pipe(res);

      // Add each song to the archive with organized folder structure
      for (const song of songsWithFiles) {
        const filename = path.basename(song.filePath!);
        const fullPath = path.join(DOWNLOAD_DIR, filename);
        
        // Create folder structure: Artist/Album/Song.mp3
        // Use "Unknown Artist" and "Unknown Album" if not available
        const artistFolder = sanitizeFilename(song.artist || "Unknown Artist");
        const albumFolder = sanitizeFilename(song.album || "Unknown Album");
        const songFilename = filename;
        
        const archivePath = `${artistFolder}/${albumFolder}/${songFilename}`;
        
        archive.file(fullPath, { name: archivePath });
      }

      // Finalize the archive
      await archive.finalize();
    } catch (error) {
      console.error("Export library error:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to export library" });
      }
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

  /**
   * DELETE /api/library/clear
   * Clear entire library - deletes all songs from database and all MP3 files
   */
  app.delete("/api/library/clear", async (_req: Request, res: Response) => {
    try {
      if (db) {
        await db.delete(songs);
      }
      
      // Delete all files in downloads directory
      if (fs.existsSync(DOWNLOAD_DIR)) {
        const files = fs.readdirSync(DOWNLOAD_DIR);
        for (const file of files) {
          const filePath = path.join(DOWNLOAD_DIR, file);
          if (fs.statSync(filePath).isFile()) {
            fs.unlinkSync(filePath);
          }
        }
      }
      
      res.json({ message: "Library cleared successfully" });
    } catch (error) {
      console.error("Clear library error:", error);
      res.status(500).json({ message: "Failed to clear library" });
    }
  });

  /**
   * POST /api/songs/:id/retag
   * Re-tag a single song with clean iTunes metadata
   */
  app.post("/api/songs/:id/retag", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const song = await storage.getSong(id);
      
      if (!song) {
        return res.status(404).json({ message: "Song not found" });
      }
      
      // Find the MP3 file
      const filePath = song.filePath ? path.join(DOWNLOAD_DIR, path.basename(song.filePath)) : null;
      if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).json({ message: "MP3 file not found" });
      }
      
      // Clean the title before iTunes lookup to remove "lyric video" etc.
      const cleanedTitle = cleanSongTitle(song.title);
      const metadata = await searchITunesSongMetadata(song.artist || "", cleanedTitle);
      
      if (!metadata.found) {
        return res.status(404).json({ message: "Could not find iTunes metadata for this song" });
      }
      
      // Re-embed ID3 tags with clean metadata
      await embedID3Tags(filePath, {
        title: metadata.trackName || song.title,
        artist: metadata.artistName || song.artist || undefined,
        album: metadata.albumName || song.album || undefined,
        genre: metadata.genre || song.genre || undefined,
        year: metadata.releaseDate ? new Date(metadata.releaseDate).getFullYear().toString() : undefined,
        trackNumber: metadata.trackNumber || undefined,
        albumArtUrl: metadata.albumArt || undefined,
        fallbackArtUrl: song.thumbnail,
      });
      
      // Update database record with clean metadata
      const updatedSong = await storage.updateSong(id, {
        title: metadata.trackName || song.title,
        artist: metadata.artistName || song.artist,
        album: metadata.albumName || song.album,
        genre: metadata.genre || song.genre,
        thumbnail: metadata.albumArt || song.thumbnail,
      });
      
      res.json({
        message: "Song re-tagged successfully",
        song: updatedSong ? { ...updatedSong, downloadedAt: updatedSong.downloadedAt.toISOString() } : null,
      });
    } catch (error) {
      console.error("Re-tag song error:", error);
      res.status(500).json({ message: "Failed to re-tag song" });
    }
  });

  /**
   * POST /api/library/retag-all
   * Re-tag all songs in the library with clean iTunes metadata
   * Uses SSE to stream progress updates
   */
  app.post("/api/library/retag-all", async (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    
    const sendProgress = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    
    try {
      const allSongs = await storage.getAllSongs();
      const total = allSongs.length;
      let processed = 0;
      let success = 0;
      let failed = 0;
      
      sendProgress({ status: "starting", total, message: `Starting to re-tag ${total} songs...` });
      
      for (const song of allSongs) {
        processed++;
        
        try {
          // Find the MP3 file
          const filePath = song.filePath ? path.join(DOWNLOAD_DIR, path.basename(song.filePath)) : null;
          if (!filePath || !fs.existsSync(filePath)) {
            sendProgress({ 
              status: "progress", 
              processed, 
              total, 
              success, 
              failed: ++failed,
              current: song.title,
              message: `Skipped: ${song.title} (file not found)` 
            });
            continue;
          }
          
          // Clean the title and look up iTunes metadata
          const cleanedTitle = cleanSongTitle(song.title);
          const metadata = await searchITunesSongMetadata(song.artist || "", cleanedTitle);
          
          if (!metadata.found) {
            sendProgress({ 
              status: "progress", 
              processed, 
              total, 
              success, 
              failed: ++failed,
              current: song.title,
              message: `No iTunes match: ${cleanedTitle}` 
            });
            continue;
          }
          
          // Re-embed ID3 tags
          await embedID3Tags(filePath, {
            title: metadata.trackName || song.title,
            artist: metadata.artistName || song.artist || undefined,
            album: metadata.albumName || song.album || undefined,
            genre: metadata.genre || song.genre || undefined,
            year: metadata.releaseDate ? new Date(metadata.releaseDate).getFullYear().toString() : undefined,
            trackNumber: metadata.trackNumber || undefined,
            albumArtUrl: metadata.albumArt || undefined,
            fallbackArtUrl: song.thumbnail,
          });
          
          // Update database
          await storage.updateSong(song.id, {
            title: metadata.trackName || song.title,
            artist: metadata.artistName || song.artist,
            album: metadata.albumName || song.album,
            genre: metadata.genre || song.genre,
            thumbnail: metadata.albumArt || song.thumbnail,
          });
          
          success++;
          sendProgress({ 
            status: "progress", 
            processed, 
            total, 
            success, 
            failed,
            current: metadata.trackName || song.title,
            message: `Re-tagged: ${metadata.artistName} - ${metadata.trackName}` 
          });
          
        } catch (songError) {
          failed++;
          sendProgress({ 
            status: "progress", 
            processed, 
            total, 
            success, 
            failed,
            current: song.title,
            message: `Error: ${song.title}` 
          });
        }
      }
      
      sendProgress({ 
        status: "complete", 
        processed, 
        total, 
        success, 
        failed,
        message: `Completed! ${success} songs re-tagged, ${failed} failed.` 
      });
      
      res.end();
    } catch (error) {
      console.error("Re-tag all error:", error);
      sendProgress({ status: "error", message: "Failed to re-tag library" });
      res.end();
    }
  });

  return httpServer;
}
