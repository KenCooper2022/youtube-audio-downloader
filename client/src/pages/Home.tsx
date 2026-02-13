import { useState, useEffect, useCallback } from "react";
import { Music, Headphones, Disc, Settings, ChevronLeft, HelpCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SearchBar } from "@/components/SearchBar";
import { SearchResults } from "@/components/SearchResults";
import { LoadingBar } from "@/components/LoadingBar";
import { Library } from "@/components/Library";
import { AlbumSearch } from "@/components/AlbumSearch";
import { AlbumView } from "@/components/AlbumView";
import { ServerSettings } from "@/components/ServerSettings";
import { HowToRun } from "@/components/HowToRun";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { saveSong, getSongByVideoId, initDB } from "@/lib/db";
import { buildApiUrl } from "@/lib/config";
import type { YouTubeVideo, DownloadProgress, SongMetadata, Album, AlbumTrack } from "@shared/schema";

export default function Home() {
  const [searchResults, setSearchResults] = useState<YouTubeVideo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<Map<string, DownloadProgress>>(new Map());
  const [downloadedVideos, setDownloadedVideos] = useState<Set<string>>(new Set());
  const [libraryRefresh, setLibraryRefresh] = useState(0);
  const [activeTab, setActiveTab] = useState("search");
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [isLoadingAlbum, setIsLoadingAlbum] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    initDB().catch(console.error);
  }, []);

  const handleSearch = useCallback(async (query: string, type: "audio" | "lyric" | "both") => {
    setIsSearching(true);
    setSearchResults([]);

    try {
      const response = await fetch(buildApiUrl(`/api/search?q=${encodeURIComponent(query)}&type=${type}`));
      
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

  // Optional knownMetadata for album downloads (bypass iTunes search)
  interface KnownMetadata {
    trackName: string;
    artistName: string;
    albumName: string;
    albumArt: string;
    genre?: string;
    releaseDate?: string;
    trackNumber?: number;
    trackCount?: number;
  }

  const handleDownload = useCallback(async (video: YouTubeVideo, knownMetadata?: KnownMetadata) => {
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
      const response = await fetch(buildApiUrl("/api/download"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: video.videoId,
          title: video.title,
          thumbnail: video.thumbnail,
          channelTitle: video.channelTitle,
          knownMetadata, // Pass known metadata if available (album downloads)
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

  const handleSelectAlbum = useCallback(async (collectionId: number) => {
    setIsLoadingAlbum(true);
    try {
      const response = await fetch(buildApiUrl(`/api/albums/${collectionId}`));
      if (!response.ok) {
        throw new Error("Failed to load album");
      }
      const albumData = await response.json();
      setSelectedAlbum(albumData);
    } catch (error) {
      console.error("Album load error:", error);
      toast({
        title: "Failed to load album",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingAlbum(false);
    }
  }, [toast]);

  const handleDownloadTrack = useCallback(async (track: AlbumTrack) => {
    if (!track.youtubeVideoId || !track.youtubeTitle || !track.youtubeThumbnail) {
      toast({
        title: "Track not available",
        description: "This track is not available on YouTube.",
        variant: "destructive",
      });
      return;
    }

    const video: YouTubeVideo = {
      videoId: track.youtubeVideoId,
      title: track.youtubeTitle,
      thumbnail: track.youtubeThumbnail,
      channelTitle: track.artistName,
      publishedAt: "",
    };

    // Pass known metadata from the album to avoid re-searching iTunes
    const knownMetadata: KnownMetadata | undefined = selectedAlbum ? {
      trackName: track.trackName,
      artistName: track.artistName,
      albumName: selectedAlbum.collectionName,
      albumArt: selectedAlbum.artworkUrl,
      genre: selectedAlbum.genre,
      releaseDate: selectedAlbum.releaseDate,
      trackNumber: track.trackNumber,
      trackCount: selectedAlbum.trackCount,
    } : undefined;

    await handleDownload(video, knownMetadata);
  }, [handleDownload, toast, selectedAlbum]);

  const handleDownloadAllTracks = useCallback(async () => {
    if (!selectedAlbum) return;
    
    const availableTracks = selectedAlbum.tracks.filter(t => 
      t.available && t.youtubeVideoId && !downloadedVideos.has(t.youtubeVideoId)
    );

    if (availableTracks.length === 0) {
      toast({
        title: "No tracks to download",
        description: "All available tracks have already been downloaded.",
      });
      return;
    }

    const albumName = selectedAlbum.collectionName;
    const trackCount = availableTracks.length;

    toast({
      title: "Album download started",
      description: `Downloading ${trackCount} tracks from "${albumName}". You can browse other albums while downloads continue.`,
    });

    // Start all downloads in parallel (non-blocking)
    availableTracks.forEach(track => {
      handleDownloadTrack(track);
    });
  }, [selectedAlbum, downloadedVideos, handleDownloadTrack, toast]);

  const handleBackToAlbumSearch = useCallback(() => {
    setSelectedAlbum(null);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-lg mx-auto grid-cols-5 mb-6">
            <TabsTrigger value="search" className="gap-1 sm:gap-2 text-xs uppercase tracking-wider px-2 sm:px-3" data-testid="tab-search">
              <Music className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Songs</span>
            </TabsTrigger>
            <TabsTrigger value="albums" className="gap-1 sm:gap-2 text-xs uppercase tracking-wider px-2 sm:px-3" data-testid="tab-albums">
              <Disc className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Albums</span>
            </TabsTrigger>
            <TabsTrigger value="library" className="gap-1 sm:gap-2 text-xs uppercase tracking-wider px-2 sm:px-3" data-testid="tab-library">
              <Headphones className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Library</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1 sm:gap-2 text-xs uppercase tracking-wider px-2 sm:px-3" data-testid="tab-settings">
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
            <TabsTrigger value="howto" className="gap-1 sm:gap-2 text-xs uppercase tracking-wider px-2 sm:px-3" data-testid="tab-howto">
              <HelpCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">How To</span>
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

          <TabsContent value="albums" className="mt-0">
            {/* Show album search when no album selected, or album view when selected */}
            {!selectedAlbum ? (
              <AlbumSearch
                onSelectAlbum={handleSelectAlbum}
                isLoading={isLoadingAlbum}
              />
            ) : (
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToAlbumSearch}
                  className="mb-4 gap-2 text-xs uppercase tracking-wider"
                  data-testid="button-back-to-search"
                >
                  <ChevronLeft className="h-3 w-3" />
                  Back to Search
                </Button>
                <AlbumView
                  album={selectedAlbum}
                  onDownloadTrack={handleDownloadTrack}
                  onDownloadAll={handleDownloadAllTracks}
                  downloadProgress={downloadProgress}
                  downloadedVideos={downloadedVideos}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="library" className="mt-0">
            <Library refreshTrigger={libraryRefresh} />
          </TabsContent>

          <TabsContent value="settings" className="mt-0">
            <div className="w-full max-w-3xl mx-auto">
              <h2 className="text-lg font-semibold mb-4">Settings</h2>
              
              <ServerSettings 
                onServerChange={() => {
                  setLibraryRefresh(prev => prev + 1);
                }}
              />

              <div className="text-sm text-muted-foreground space-y-2">
                <p className="font-medium">Mobile App Setup:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Run the server on your computer</li>
                  <li>Find your computer's local IP address (e.g., 192.168.1.x)</li>
                  <li>Enter the server URL above (e.g., http://192.168.1.100:5000)</li>
                  <li>Make sure your phone is on the same WiFi network</li>
                </ol>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="howto" className="mt-0">
            <HowToRun />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
