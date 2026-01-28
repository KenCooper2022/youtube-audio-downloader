import { useState, useEffect, useCallback } from "react";
import { Music, Headphones, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SearchBar } from "@/components/SearchBar";
import { SearchResults } from "@/components/SearchResults";
import { LoadingBar } from "@/components/LoadingBar";
import { Library } from "@/components/Library";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { saveSong, getSongByVideoId, initDB } from "@/lib/db";
import type { YouTubeVideo, DownloadProgress, SongMetadata } from "@shared/schema";

export default function Home() {
  const [searchResults, setSearchResults] = useState<YouTubeVideo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<Map<string, DownloadProgress>>(new Map());
  const [downloadedVideos, setDownloadedVideos] = useState<Set<string>>(new Set());
  const [libraryRefresh, setLibraryRefresh] = useState(0);
  const [activeTab, setActiveTab] = useState("search");
  const { toast } = useToast();

  useEffect(() => {
    initDB().catch(console.error);
  }, []);

  const handleSearch = useCallback(async (query: string, type: "audio" | "lyric" | "both") => {
    setIsSearching(true);
    setSearchResults([]);

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=${type}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Search failed");
      }

      const data = await response.json();
      setSearchResults(data.results);

      if (data.results.length === 0) {
        toast({
          title: "No results found",
          description: "Try a different search term or filter.",
        });
      }
    } catch (error) {
      console.error("Search error:", error);
      toast({
        title: "Search failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  }, [toast]);

  const handleDownload = useCallback(async (video: YouTubeVideo) => {
    const existing = await getSongByVideoId(video.videoId);
    if (existing) {
      toast({
        title: "Already downloaded",
        description: "This song is already in your library.",
      });
      setDownloadedVideos(prev => new Set(prev).add(video.videoId));
      return;
    }

    setDownloadProgress(prev => {
      const next = new Map(prev);
      next.set(video.videoId, {
        videoId: video.videoId,
        progress: 0,
        status: "pending",
        message: "Starting download...",
      });
      return next;
    });

    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: video.videoId,
          title: video.title,
          thumbnail: video.thumbnail,
          channelTitle: video.channelTitle,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Download failed");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("Stream not available");
      }

      let downloadUrl = "";
      let metadata = { artist: "", album: "", genre: "" };
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              
              setDownloadProgress(prev => {
                const next = new Map(prev);
                next.set(video.videoId, {
                  videoId: video.videoId,
                  progress: data.progress || 0,
                  status: data.status || "downloading",
                  message: data.message || "Processing...",
                  downloadUrl: data.downloadUrl,
                });
                return next;
              });

              if (data.downloadUrl) {
                downloadUrl = data.downloadUrl;
              }
              if (data.metadata) {
                metadata = data.metadata;
              }

              if (data.status === "complete" && data.downloadUrl) {
                const songData: SongMetadata = {
                  id: crypto.randomUUID(),
                  videoId: video.videoId,
                  title: video.title,
                  artist: metadata.artist || undefined,
                  album: metadata.album || undefined,
                  genre: metadata.genre || undefined,
                  thumbnail: video.thumbnail,
                  downloadedAt: new Date().toISOString(),
                  filePath: data.downloadUrl,
                };

                await saveSong(songData);
                setDownloadedVideos(prev => new Set(prev).add(video.videoId));
                setLibraryRefresh(prev => prev + 1);

                toast({
                  title: "Download complete",
                  description: `"${video.title}" has been added to your library.`,
                });

                const link = document.createElement("a");
                link.href = data.downloadUrl;
                link.download = `${video.title}.mp3`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }
            } catch (e) {
              console.error("Error parsing SSE data:", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Download error:", error);
      
      setDownloadProgress(prev => {
        const next = new Map(prev);
        next.set(video.videoId, {
          videoId: video.videoId,
          progress: 0,
          status: "error",
          message: error instanceof Error ? error.message : "Download failed",
        });
        return next;
      });

      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  }, [toast]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 border border-border rounded-md bg-card">
                <Download className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-medium tracking-tight text-foreground uppercase">Audio Downloader</h1>
                <p className="text-xs text-muted-foreground tracking-wider">MP3_EXTRACTION</p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="text-center mb-10">
          <p className="text-xs text-muted-foreground tracking-widest uppercase mb-2">
            // YOUTUBE AUDIO DOWNLOADER
          </p>
          <h2 className="text-2xl font-medium text-foreground tracking-tight mb-3">
            Extract Audio from YouTube
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            Search for songs, lyric videos, or audio tracks. 
            Download as MP3 files. Library stored locally.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-sm mx-auto grid-cols-2 mb-8">
            <TabsTrigger value="search" className="gap-2 text-xs uppercase tracking-wider" data-testid="tab-search">
              <Music className="h-3.5 w-3.5" />
              Search
            </TabsTrigger>
            <TabsTrigger value="library" className="gap-2 text-xs uppercase tracking-wider" data-testid="tab-library">
              <Headphones className="h-3.5 w-3.5" />
              Library
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="mt-0">
            <SearchBar onSearch={handleSearch} isLoading={isSearching} />
            <LoadingBar 
              isLoading={isSearching} 
              message="Searching YouTube..." 
            />
            <SearchResults
              results={searchResults}
              onDownload={handleDownload}
              downloadProgress={downloadProgress}
              downloadedVideos={downloadedVideos}
            />
          </TabsContent>

          <TabsContent value="library" className="mt-0">
            <Library refreshTrigger={libraryRefresh} />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t border-border mt-16">
        <div className="container mx-auto px-4 py-6">
          <p className="text-center text-xs text-muted-foreground tracking-wider uppercase">
            Personal use only // Respect copyright
          </p>
        </div>
      </footer>
    </div>
  );
}
