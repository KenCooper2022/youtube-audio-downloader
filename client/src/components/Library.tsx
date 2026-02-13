import { useState, useEffect } from "react";
import { Music, Trash2, Download, Disc3, User, Calendar, Tag, FolderArchive, Loader2, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getAllSongs, deleteSong } from "@/lib/db";
import { buildApiUrl } from "@/lib/config";
import type { SongMetadata } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface LibraryProps {
  refreshTrigger: number;
}

export function Library({ refreshTrigger }: LibraryProps) {
  const [songs, setSongs] = useState<SongMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isRetagging, setIsRetagging] = useState(false);
  const [retagProgress, setRetagProgress] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    loadSongs();
  }, [refreshTrigger]);

  const loadSongs = async () => {
    try {
      setIsLoading(true);
      const allSongs = await getAllSongs();
      setSongs(allSongs);
    } catch (error) {
      console.error("Failed to load songs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSong(id);
      setSongs(songs.filter(song => song.id !== id));
    } catch (error) {
      console.error("Failed to delete song:", error);
    }
  };

  const handleExportLibrary = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(buildApiUrl("/api/export-library"));
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Export failed");
      }

      // Get the blob and create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "music-library.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export complete",
        description: `Your library has been exported as a ZIP file organized by Artist/Album.`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearLibrary = async () => {
    setIsClearing(true);
    try {
      const response = await fetch(buildApiUrl("/api/library/clear"), {
        method: "DELETE",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to clear library");
      }

      setSongs([]);
      toast({
        title: "Library cleared",
        description: "All songs and files have been removed.",
      });
    } catch (error) {
      console.error("Clear library error:", error);
      toast({
        title: "Failed to clear library",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  const handleRetagLibrary = async () => {
    setIsRetagging(true);
    setRetagProgress("Starting...");
    
    try {
      const response = await fetch(buildApiUrl("/api/library/retag-all"), {
        method: "POST",
      });
      
      if (!response.ok) {
        throw new Error("Failed to start re-tagging");
      }
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");
      
      const decoder = new TextDecoder();
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
              setRetagProgress(data.message || "Processing...");
              
              if (data.status === "complete") {
                toast({
                  title: "Re-tagging complete",
                  description: `${data.success} songs updated, ${data.failed} failed.`,
                });
                await loadSongs();
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      console.error("Re-tag error:", error);
      toast({
        title: "Re-tagging failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRetagging(false);
      setRetagProgress("");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { 
      year: "numeric", 
      month: "short", 
      day: "numeric" 
    });
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-3xl mx-auto mt-8">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4">
          // Library
        </h2>
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4 animate-pulse border border-border">
              <div className="flex gap-4">
                <div className="w-16 h-16 rounded bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                  <div className="h-3 bg-muted rounded w-1/4" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (songs.length === 0) {
    return (
      <div className="w-full max-w-3xl mx-auto mt-8">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4">
          // Library
        </h2>
        <Card className="p-10 text-center border border-border">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded border border-border bg-muted mb-4">
            <Music className="h-5 w-5 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-medium text-foreground mb-2">No songs yet</h3>
          <p className="text-xs text-muted-foreground font-mono">
            Search and download songs to build your library.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto mt-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
            // Library
          </h2>
          <span className="text-xs text-muted-foreground font-mono">
            [{songs.length}]
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRetagLibrary}
            disabled={isRetagging || songs.length === 0}
            className="gap-1.5 text-xs uppercase tracking-wider"
            data-testid="button-retag-library"
          >
            {isRetagging ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            {isRetagging ? retagProgress : "Fix Metadata"}
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportLibrary}
            disabled={isExporting || songs.length === 0}
            className="gap-1.5 text-xs uppercase tracking-wider"
            data-testid="button-export-library"
          >
            {isExporting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <FolderArchive className="h-3 w-3" />
            )}
            {isExporting ? "Exporting..." : "Export for iTunes"}
          </Button>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                disabled={isClearing || songs.length === 0}
                className="gap-1.5 text-xs uppercase tracking-wider text-destructive hover:text-destructive"
                data-testid="button-clear-library"
              >
                {isClearing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <XCircle className="h-3 w-3" />
                )}
                {isClearing ? "Clearing..." : "Clear Library"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear entire library?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all {songs.length} song{songs.length !== 1 ? 's' : ''} from your library and remove all downloaded MP3 files. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClearLibrary}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  data-testid="button-confirm-clear"
                >
                  Clear Library
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid gap-3">
        {songs.map((song) => (
          <Card
            key={song.id}
            className="p-4 hover-elevate transition-all duration-150 border border-border"
            data-testid={`card-library-${song.id}`}
          >
            <div className="flex gap-4">
              <div className="relative flex-shrink-0 w-16 h-16 rounded overflow-hidden bg-muted border border-border">
                <img
                  src={song.thumbnail}
                  alt={song.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-foreground line-clamp-1 mb-2" title={song.title}>
                  {song.title}
                </h3>
                
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {song.artist && (
                    <Badge variant="outline" className="text-xs gap-1 font-mono uppercase tracking-wider">
                      <User className="h-2.5 w-2.5" />
                      {song.artist}
                    </Badge>
                  )}
                  {song.album && (
                    <Badge variant="outline" className="text-xs gap-1 font-mono uppercase tracking-wider">
                      <Disc3 className="h-2.5 w-2.5" />
                      {song.album}
                    </Badge>
                  )}
                  {song.genre && (
                    <Badge variant="outline" className="text-xs gap-1 font-mono uppercase tracking-wider">
                      <Tag className="h-2.5 w-2.5" />
                      {song.genre}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                    <Calendar className="h-2.5 w-2.5" />
                    {formatDate(song.downloadedAt)}
                  </span>

                  <div className="flex items-center gap-1">
                    {song.filePath && (
                      <Button
                        size="icon"
                        variant="ghost"
                        asChild
                        data-testid={`button-redownload-${song.id}`}
                      >
                        <a href={song.filePath} download>
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(song.id)}
                      className="text-muted-foreground hover:text-destructive"
                      data-testid={`button-delete-${song.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
