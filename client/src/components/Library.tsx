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
      <div className="w-full max-w-4xl mx-auto mt-8">
        <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
          <Music className="h-5 w-5 text-primary" />
          My Library
        </h2>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="flex gap-4">
                <div className="w-20 h-20 rounded-lg bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                  <div className="h-4 bg-muted rounded w-1/4" />
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
      <div className="w-full max-w-4xl mx-auto mt-8">
        <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
          <Music className="h-5 w-5 text-primary" />
          My Library
        </h2>
        <Card className="p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
            <Music className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">No songs yet</h3>
          <p className="text-muted-foreground">
            Search for songs above and download them to build your library.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <Music className="h-5 w-5 text-primary" />
          My Library
        </h2>
        <Badge variant="secondary">
          {songs.length} {songs.length === 1 ? "song" : "songs"}
        </Badge>
      </div>

      <div className="grid gap-4">
        {songs.map((song) => (
          <Card
            key={song.id}
            className="p-4 hover-elevate transition-all duration-200"
            data-testid={`card-library-${song.id}`}
          >
            <div className="flex gap-4">
              <div className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-muted">
                <img
                  src={song.thumbnail}
                  alt={song.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground line-clamp-1 mb-2" title={song.title}>
                  {song.title}
                </h3>
                
                <div className="flex flex-wrap gap-2 mb-2">
                  {song.artist && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <User className="h-3 w-3" />
                      {song.artist}
                    </Badge>
                  )}
                  {song.album && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Disc3 className="h-3 w-3" />
                      {song.album}
                    </Badge>
                  )}
                  {song.genre && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Tag className="h-3 w-3" />
                      {song.genre}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Downloaded {formatDate(song.downloadedAt)}
                  </span>

                  <div className="flex items-center gap-2">
                    {song.filePath && (
                      <Button
                        size="sm"
                        variant="ghost"
                        asChild
                        data-testid={`button-redownload-${song.id}`}
                      >
                        <a href={song.filePath} download>
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(song.id)}
                      className="text-muted-foreground hover:text-destructive"
                      data-testid={`button-delete-${song.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
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
