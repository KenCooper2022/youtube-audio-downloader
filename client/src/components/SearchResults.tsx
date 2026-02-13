import { useState, useEffect } from "react";
import { Download, Play, Clock, User, ImageDown, Disc, Music, Calendar, Hash, Timer, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buildApiUrl } from "@/lib/config";
import type { YouTubeVideo, DownloadProgress } from "@shared/schema";

interface SongMetadata {
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

  const [songMetadata, setSongMetadata] = useState<SongMetadata | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);

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

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const formatReleaseDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { 
      year: "numeric", 
      month: "long", 
      day: "numeric" 
    });
  };

  const featuredResult = results[0];
  const parsedArtist = parseArtistFromTitle(featuredResult.title);
  const parsedSongName = parseSongFromTitle(featuredResult.title);

  useEffect(() => {
    const fetchSongMetadata = async () => {
      if (!parsedArtist && !parsedSongName) return;
      
      setIsLoadingMetadata(true);
      try {
        const params = new URLSearchParams();
        if (parsedArtist) params.append("artist", parsedArtist);
        if (parsedSongName) params.append("song", parsedSongName);
        
        const response = await fetch(buildApiUrl(`/api/song-metadata?${params.toString()}`));
        const data = await response.json();
        setSongMetadata(data);
      } catch (error) {
        console.error("Failed to fetch song metadata:", error);
        setSongMetadata(null);
      } finally {
        setIsLoadingMetadata(false);
      }
    };

    setSongMetadata(null);
    fetchSongMetadata();
  }, [featuredResult.videoId, parsedArtist, parsedSongName]);

  const displayArt = songMetadata?.albumArt || getHighResThumbnail(featuredResult.videoId);
  const displayArtist = songMetadata?.artistName || parsedArtist;
  const displaySongName = songMetadata?.trackName || parsedSongName;
  const isSingle = songMetadata?.found && songMetadata?.trackCount === 1;

  return (
    <div className="w-full max-w-3xl mx-auto mt-8">
      {/* Song Overview Panel */}
      <Card className="p-6 mb-8 border border-border" data-testid="card-song-overview">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Album Art */}
          <div className="flex-shrink-0">
            <div className="relative w-40 h-40 md:w-48 md:h-48 rounded-lg overflow-hidden shadow-lg border border-border bg-muted mx-auto md:mx-0">
              {isLoadingMetadata ? (
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
            <div className="flex justify-center mt-3">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs uppercase tracking-wider"
                onClick={() => {
                  const filename = `${displayArtist ? displayArtist + " - " : ""}${displaySongName || "album-art"}.jpg`;
                  const imageUrl = displayArt;
                  window.open(`/api/download-image?url=${encodeURIComponent(imageUrl)}&filename=${encodeURIComponent(filename)}`, '_blank');
                }}
                disabled={isLoadingMetadata}
                data-testid="button-download-art"
              >
                <ImageDown className="h-3 w-3" />
                Save Cover
              </Button>
            </div>
          </div>

          {/* Metadata Info */}
          <div className="flex-1 min-w-0">
            {isLoadingMetadata ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-6 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2" />
                <div className="h-4 bg-muted rounded w-2/3" />
              </div>
            ) : (
              <>
                {/* Track Name */}
                <h2 className="text-xl font-semibold text-foreground mb-1" data-testid="text-song-title">
                  {displaySongName}
                </h2>
                
                {/* Artist */}
                {displayArtist && (
                  <p className="text-base text-muted-foreground mb-4" data-testid="text-artist-name">
                    {displayArtist}
                  </p>
                )}

                {/* Metadata Grid */}
                {songMetadata?.found ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                    {/* Album Info */}
                    {songMetadata.albumName && (
                      <div className="flex items-start gap-2">
                        <Disc className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Album</p>
                          <p className="text-sm text-foreground" data-testid="text-album-name">{songMetadata.albumName}</p>
                        </div>
                      </div>
                    )}

                    {/* Release Type (Single vs Album Track) */}
                    <div className="flex items-start gap-2">
                      <Music className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Type</p>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={isSingle ? "secondary" : "outline"} 
                            className="text-xs"
                            data-testid="badge-track-type"
                          >
                            {isSingle ? "Single" : "Album Track"}
                          </Badge>
                          {songMetadata.trackNumber && songMetadata.trackCount && !isSingle && (
                            <span className="text-xs text-muted-foreground font-mono">
                              Track {songMetadata.trackNumber} of {songMetadata.trackCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Genre */}
                    {songMetadata.genre && (
                      <div className="flex items-start gap-2">
                        <Hash className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Genre</p>
                          <p className="text-sm text-foreground" data-testid="text-genre">{songMetadata.genre}</p>
                        </div>
                      </div>
                    )}

                    {/* Duration */}
                    {songMetadata.durationMs && (
                      <div className="flex items-start gap-2">
                        <Timer className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Duration</p>
                          <p className="text-sm text-foreground font-mono" data-testid="text-duration">
                            {formatDuration(songMetadata.durationMs)}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Release Date */}
                    {songMetadata.releaseDate && (
                      <div className="flex items-start gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Released</p>
                          <p className="text-sm text-foreground" data-testid="text-release-date">
                            {formatReleaseDate(songMetadata.releaseDate)}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Explicit */}
                    {songMetadata.isExplicit && (
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Content</p>
                          <Badge variant="destructive" className="text-xs" data-testid="badge-explicit">
                            Explicit
                          </Badge>
                        </div>
                      </div>
                    )}

                    {/* Disc Info (if multi-disc album) */}
                    {songMetadata.discCount && songMetadata.discCount > 1 && (
                      <div className="flex items-start gap-2">
                        <Disc className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Disc</p>
                          <p className="text-sm text-foreground font-mono">
                            {songMetadata.discNumber} of {songMetadata.discCount}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 text-sm text-muted-foreground italic">
                    Additional metadata not available for this track.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </Card>

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
