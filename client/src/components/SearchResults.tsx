import { useState, useEffect } from "react";
import { Download, Play, Clock, User, ImageDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { YouTubeVideo, DownloadProgress } from "@shared/schema";

interface SearchResultsProps {
  results: YouTubeVideo[];
  onDownload: (video: YouTubeVideo) => void;
  downloadProgress: Map<string, DownloadProgress>;
  downloadedVideos: Set<string>;
}

export function SearchResults({ 
  results, 
  onDownload, 
  downloadProgress,
  downloadedVideos 
}: SearchResultsProps) {
  if (results.length === 0) {
    return null;
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { 
      year: "numeric", 
      month: "short", 
      day: "numeric" 
    });
  };

  const getProgressStatus = (videoId: string) => {
    return downloadProgress.get(videoId);
  };

  const [albumArt, setAlbumArt] = useState<string | null>(null);
  const [isLoadingArt, setIsLoadingArt] = useState(false);

  const getHighResThumbnail = (videoId: string) => {
    return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  };

  const parseArtistFromTitle = (title: string) => {
    const patterns = [
      /^(.+?)\s*[-–—]\s*.+/,
      /^(.+?)\s*[|]\s*.+/,
      /^(.+?)\s*ft\.?\s*.+/i,
      /^(.+?)\s*feat\.?\s*.+/i,
    ];
    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) return match[1].trim();
    }
    return null;
  };

  const parseSongFromTitle = (title: string) => {
    const patterns = [
      /^.+?\s*[-–—]\s*(.+?)(?:\s*[\(\[]|$)/,
      /^.+?\s*[|]\s*(.+?)(?:\s*[\(\[]|$)/,
    ];
    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) return match[1].trim();
    }
    return title;
  };

  const featuredResult = results[0];
  const artist = parseArtistFromTitle(featuredResult.title);
  const songName = parseSongFromTitle(featuredResult.title);

  useEffect(() => {
    const fetchAlbumArt = async () => {
      if (!artist && !songName) return;
      
      setIsLoadingArt(true);
      try {
        const params = new URLSearchParams();
        if (artist) params.append("artist", artist);
        if (songName) params.append("song", songName);
        
        const response = await fetch(`/api/album-art?${params.toString()}`);
        const data = await response.json();
        
        if (data.albumArt) {
          setAlbumArt(data.albumArt);
        } else {
          setAlbumArt(null);
        }
      } catch (error) {
        console.error("Failed to fetch album art:", error);
        setAlbumArt(null);
      } finally {
        setIsLoadingArt(false);
      }
    };

    setAlbumArt(null);
    fetchAlbumArt();
  }, [featuredResult.videoId, artist, songName]);

  const displayArt = albumArt || getHighResThumbnail(featuredResult.videoId);

  return (
    <div className="w-full max-w-3xl mx-auto mt-8">
      {/* Featured Album Art */}
      <div className="flex flex-col items-center mb-8">
        <div className="relative w-48 h-48 rounded-lg overflow-hidden shadow-lg border border-border bg-muted">
          {isLoadingArt ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <img
              src={displayArt}
              alt="Album Art"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = featuredResult.thumbnail;
              }}
              data-testid="img-album-cover"
            />
          )}
        </div>
        <div className="text-center mt-4">
          <h2 className="text-lg font-semibold text-foreground" data-testid="text-song-title">
            {songName}
          </h2>
          {artist && (
            <p className="text-sm text-muted-foreground mt-1" data-testid="text-artist-name">
              {artist}
            </p>
          )}
          <Button
            size="sm"
            variant="outline"
            className="mt-3 gap-1.5 text-xs uppercase tracking-wider"
            onClick={() => {
              const filename = `${artist ? artist + " - " : ""}${songName || "album-art"}.jpg`;
              const imageUrl = displayArt;
              window.open(`/api/download-image?url=${encodeURIComponent(imageUrl)}&filename=${encodeURIComponent(filename)}`, '_blank');
            }}
            disabled={isLoadingArt}
            data-testid="button-download-art"
          >
            <ImageDown className="h-3 w-3" />
            Save Cover
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
          // Results
        </h2>
        <span className="text-xs text-muted-foreground font-mono">
          [{results.length}]
        </span>
      </div>

      <div className="grid gap-3">
        {results.map((video) => {
          const progress = getProgressStatus(video.videoId);
          const isDownloaded = downloadedVideos.has(video.videoId);
          const isDownloading = progress && progress.status !== "complete" && progress.status !== "error";

          return (
            <Card
              key={video.videoId}
              className="p-4 hover-elevate transition-all duration-150 border border-border"
              data-testid={`card-result-${video.videoId}`}
            >
              <div className="flex gap-4">
                <div className="relative flex-shrink-0 w-28 h-20 rounded overflow-hidden bg-muted border border-border">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-foreground/60 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <a
                      href={`https://youtube.com/watch?v=${video.videoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded border border-background/30"
                      data-testid={`link-preview-${video.videoId}`}
                    >
                      <Play className="h-4 w-4 text-background" />
                    </a>
                  </div>
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-foreground line-clamp-2 mb-1.5 leading-snug" title={video.title}>
                      {video.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground font-mono">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {video.channelTitle}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(video.publishedAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    {isDownloaded ? (
                      <Badge variant="secondary" className="text-xs uppercase tracking-wider font-mono">
                        Downloaded
                      </Badge>
                    ) : isDownloading ? (
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-xs mb-1 font-mono">
                          <span className="text-muted-foreground">{progress?.message || "Processing..."}</span>
                          <span className="text-foreground">{progress?.progress || 0}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-sm overflow-hidden">
                          <div 
                            className="h-full bg-foreground transition-all duration-300"
                            style={{ width: `${progress?.progress || 0}%` }}
                          />
                        </div>
                      </div>
                    ) : progress?.status === "error" ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive" className="text-xs uppercase">Error</Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onDownload(video)}
                          className="text-xs uppercase tracking-wider"
                          data-testid={`button-retry-${video.videoId}`}
                        >
                          Retry
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => onDownload(video)}
                        className="gap-1.5 text-xs uppercase tracking-wider"
                        data-testid={`button-download-${video.videoId}`}
                      >
                        <Download className="h-3 w-3" />
                        Download
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
