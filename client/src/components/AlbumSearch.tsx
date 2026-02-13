import { useState } from "react";
import { Search, Disc, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buildApiUrl } from "@/lib/config";

interface AlbumResult {
  collectionId: number;
  collectionName: string;
  artistName: string;
  artworkUrl: string;
  trackCount: number;
  releaseDate: string;
  genre?: string;
}

interface AlbumSearchProps {
  onSelectAlbum: (collectionId: number) => void;
  isLoading: boolean;
}

export function AlbumSearch({ onSelectAlbum, isLoading }: AlbumSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AlbumResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    setHasSearched(true);
    try {
      const response = await fetch(buildApiUrl(`/api/albums/search?q=${encodeURIComponent(query)}`));
      if (response.ok) {
        const data = await response.json();
        setResults(data.albums || []);
      }
    } catch (error) {
      console.error("Album search error:", error);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search albums by name or artist..."
            className="pl-10"
            data-testid="input-album-search"
          />
        </div>
        <Button 
          onClick={handleSearch} 
          disabled={isSearching || !query.trim()}
          data-testid="button-album-search"
        >
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Search"
          )}
        </Button>
      </div>

      {isSearching && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isSearching && results.length > 0 && (
        <div className="grid gap-3">
          {results.map((album) => (
            <Card
              key={album.collectionId}
              className="p-3 hover-elevate cursor-pointer transition-all"
              onClick={() => onSelectAlbum(album.collectionId)}
              data-testid={`album-card-${album.collectionId}`}
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded overflow-hidden bg-muted flex-shrink-0">
                  <img
                    src={album.artworkUrl}
                    alt={album.collectionName}
                    className="w-full h-full object-cover"
                  />
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">
                    {album.collectionName}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {album.artistName}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
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
                </div>

                <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {!isSearching && hasSearched && results.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Disc className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No albums found. Try a different search term.</p>
        </div>
      )}

      {!hasSearched && (
        <div className="text-center py-12 text-muted-foreground">
          <Disc className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-sm">Search for an album to see its tracklist and download songs.</p>
        </div>
      )}

      {isLoading && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
          <div className="text-center">
            <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Loading album tracks...</p>
          </div>
        </div>
      )}
    </div>
  );
}
