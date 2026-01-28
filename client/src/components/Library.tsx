import { useState, useEffect } from "react";
import { Music, Trash2, Download, Disc3, User, Calendar, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAllSongs, deleteSong } from "@/lib/db";
import type { SongMetadata } from "@shared/schema";

interface LibraryProps {
  refreshTrigger: number;
}

export function Library({ refreshTrigger }: LibraryProps) {
  const [songs, setSongs] = useState<SongMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
          // Library
        </h2>
        <span className="text-xs text-muted-foreground font-mono">
          [{songs.length}]
        </span>
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
