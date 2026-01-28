import { Download, Play, Clock, User } from "lucide-react";
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

  return (
    <div className="w-full max-w-4xl mx-auto mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-foreground">
          Search Results
        </h2>
        <Badge variant="secondary" className="text-sm">
          {results.length} {results.length === 1 ? "result" : "results"}
        </Badge>
      </div>

      <div className="grid gap-4">
        {results.map((video) => {
          const progress = getProgressStatus(video.videoId);
          const isDownloaded = downloadedVideos.has(video.videoId);
          const isDownloading = progress && progress.status !== "complete" && progress.status !== "error";

          return (
            <Card
              key={video.videoId}
              className="p-4 hover-elevate transition-all duration-200"
              data-testid={`card-result-${video.videoId}`}
            >
              <div className="flex gap-4">
                <div className="relative flex-shrink-0 w-32 h-24 sm:w-40 sm:h-28 rounded-lg overflow-hidden bg-muted">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <a
                      href={`https://youtube.com/watch?v=${video.videoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-full bg-white/20 backdrop-blur"
                      data-testid={`link-preview-${video.videoId}`}
                    >
                      <Play className="h-6 w-6 text-white" />
                    </a>
                  </div>
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <h3 className="font-medium text-foreground line-clamp-2 mb-1" title={video.title}>
                      {video.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {video.channelTitle}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDate(video.publishedAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    {isDownloaded ? (
                      <Badge variant="secondary" className="bg-accent/20 text-accent border-accent/30">
                        Downloaded
                      </Badge>
                    ) : isDownloading ? (
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-muted-foreground">{progress?.message || "Processing..."}</span>
                          <span className="text-primary font-medium">{progress?.progress || 0}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-300 rounded-full"
                            style={{ width: `${progress?.progress || 0}%` }}
                          />
                        </div>
                      </div>
                    ) : progress?.status === "error" ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive">Error</Badge>
                        <Button
                          size="sm"
                          onClick={() => onDownload(video)}
                          data-testid={`button-retry-${video.videoId}`}
                        >
                          Retry
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => onDownload(video)}
                        className="gap-2"
                        data-testid={`button-download-${video.videoId}`}
                      >
                        <Download className="h-4 w-4" />
                        Download MP3
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
