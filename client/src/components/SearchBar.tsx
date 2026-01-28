import { Search, Music, Mic2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SearchBarProps {
  onSearch: (query: string, type: "audio" | "lyric" | "both") => void;
  isLoading: boolean;
}

export function SearchBar({ onSearch, isLoading }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<"audio" | "lyric" | "both">("both");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim(), searchType);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="flex flex-col gap-4">
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
            <Search className="h-5 w-5" />
          </div>
          <Input
            type="search"
            placeholder="Search for a song, artist, or lyrics..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-12 pr-4 h-14 text-lg bg-card border-2 border-border focus:border-primary transition-colors rounded-xl"
            disabled={isLoading}
            data-testid="input-search"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={searchType}
            onValueChange={(value) => setSearchType(value as "audio" | "lyric" | "both")}
            disabled={isLoading}
          >
            <SelectTrigger className="w-40" data-testid="select-search-type">
              <SelectValue placeholder="Search type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="both" data-testid="option-both">
                <div className="flex items-center gap-2">
                  <Music className="h-4 w-4" />
                  <span>All Music</span>
                </div>
              </SelectItem>
              <SelectItem value="audio" data-testid="option-audio">
                <div className="flex items-center gap-2">
                  <Mic2 className="h-4 w-4" />
                  <span>Audio Only</span>
                </div>
              </SelectItem>
              <SelectItem value="lyric" data-testid="option-lyric">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  <span>Lyric Videos</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          <Button
            type="submit"
            disabled={!query.trim() || isLoading}
            className="flex-1 sm:flex-none h-10 px-8 font-semibold"
            data-testid="button-search"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Searching...
              </span>
            ) : (
              "Search"
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
