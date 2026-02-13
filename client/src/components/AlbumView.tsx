import { Download, Clock, ImageDown, Disc, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Album, AlbumTrack, DownloadProgress } from "@shared/schema";

interface AlbumViewProps {
  album: Album;
  onDownloadTrack: (track: AlbumTrack) => void;
  onDownloadAll: () => void;
  downloadProgress: Map<string, DownloadProgress>;
  downloadedVideos: Set<string>;
}

function formatDuration(ms?: number): string {
  if (!ms) return "";
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function AlbumView({
  album,
  onDownloadTrack,
  onDownloadAll,
  downloadProgress,
  downloadedVideos,
}: AlbumViewProps) {
  const availableTracks = album.tracks.filter(t => t.available);
  const allAvailableDownloaded = availableTracks.every(
    t => t.youtubeVideoId && downloadedVideos.has(t.youtubeVideoId)
  );
  
  // Count tracks currently downloading from this album
  const downloadingCount = availableTracks.filter(t => {
    if (!t.youtubeVideoId) return false;
    const progress = downloadProgress.get(t.youtubeVideoId);
    return progress?.status === "downloading" || progress?.status === "processing";
  }).length;

  const handleDownloadAll = () => {
    onDownloadAll();
  };

  return (
    <div className="w-full max-w-4xl mx-auto mt-8">
      <div className="flex flex-col md:flex-row gap-6 mb-8">
        <div className="flex-shrink-0">
          <div className="relative w-48 h-48 rounded-lg overflow-hidden shadow-lg border border-border bg-muted mx-auto md:mx-0">
            <img
              src={album.artworkUrl}
              alt={album.collectionName}
              className="w-full h-full object-cover"
              data-testid="img-album-cover"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            className="mt-3 gap-1.5 text-xs uppercase tracking-wider w-full"
            onClick={() => {
              const filename = `${album.artistName} - ${album.collectionName}.jpg`;
              window.open(`/api/download-image?url=${encodeURIComponent(album.artworkUrl)}&filename=${encodeURIComponent(filename)}`, '_blank');
            }}
            data-testid="button-download-album-art"
          >
            <ImageDown className="h-3 w-3" />
            Save Cover
          </Button>
        </div>

        <div className="flex-1 text-center md:text-left">
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-album-name">
            {album.collectionName}
          </h1>
          <p className="text-lg text-muted-foreground mt-1" data-testid="text-album-artist">
            {album.artistName}
          </p>
          <div className="flex flex-wrap gap-2 mt-3 justify-center md:justify-start">
            {album.genre && (
              <Badge variant="secondary" className="text-xs">
                {album.genre}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {album.trackCount} tracks
            </Badge>
            <Badge variant="outline" className="text-xs">
              {new Date(album.releaseDate).getFullYear()}
            </Badge>
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              {availableTracks.length} of {album.tracks.length} tracks available on YouTube
            </p>
            
            {availableTracks.length > 0 && (
              <Button
                onClick={handleDownloadAll}
                disabled={allAvailableDownloaded || downloadingCount > 0}
                className="gap-2"
                data-testid="button-download-all"
              >
                {downloadingCount > 0 ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Downloading {downloadingCount} tracks...
                  </>
                ) : allAvailableDownloaded ? (
                  <>
                    <Check className="h-4 w-4" />
                    All Downloaded
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Download All ({availableTracks.length} tracks)
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
          // Tracklist
        </h2>
        <span className="text-xs text-muted-foreground font-mono">
          [{album.tracks.length}]
        </span>
      </div>

      <div className="grid gap-2">
        {album.tracks.map((track) => {
          const progress = track.youtubeVideoId ? downloadProgress.get(track.youtubeVideoId) : undefined;
          const isDownloaded = !!(track.youtubeVideoId && downloadedVideos.has(track.youtubeVideoId));
          const isDownloading = progress?.status === "downloading" || progress?.status === "processing";

          return (
            <Card
              key={track.trackNumber}
              className={`p-3 transition-all ${!track.available ? 'opacity-50' : ''}`}
              data-testid={`track-row-${track.trackNumber}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground font-mono w-6 text-right">
                  {track.trackNumber.toString().padStart(2, "0")}
                </span>

                <Disc className="h-4 w-4 text-muted-foreground flex-shrink-0" />

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">
                    {track.trackName}
                  </p>
                  {track.artistName !== album.artistName && (
                    <p className="text-xs text-muted-foreground truncate">
                      {track.artistName}
                    </p>
                  )}
                </div>

                {track.trackTimeMillis && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatDuration(track.trackTimeMillis)}
                  </div>
                )}

                {track.available ? (
                  <Button
                    size="sm"
                    variant={isDownloaded ? "ghost" : "outline"}
                    onClick={() => onDownloadTrack(track)}
                    disabled={isDownloading || isDownloaded}
                    className="gap-1.5 text-xs"
                    data-testid={`button-download-track-${track.trackNumber}`}
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {progress?.progress ? `${Math.round(progress.progress)}%` : "..."}
                      </>
                    ) : isDownloaded ? (
                      <>
                        <Check className="h-3 w-3" />
                        Done
                      </>
                    ) : (
                      <>
                        <Download className="h-3 w-3" />
                        Download
                      </>
                    )}
                  </Button>
                ) : (
                  <Badge variant="outline" className="text-xs opacity-50">
                    Not Available
                  </Badge>
                )}
              </div>

              {progress && isDownloading && (
                <div className="mt-2 ml-9">
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${progress.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {progress.message}
                  </p>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
