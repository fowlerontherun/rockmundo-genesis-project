import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

interface SongFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  genreFilter: string;
  onGenreChange: (value: string) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
  availableGenres: string[];
}

export const SongFilters = ({
  searchQuery,
  onSearchChange,
  genreFilter,
  onGenreChange,
  sortBy,
  onSortChange,
  availableGenres,
}: SongFiltersProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="space-y-2">
        <Label htmlFor="search">Search Songs</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="search"
            placeholder="Search by title..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="genre">Genre</Label>
        <Select value={genreFilter} onValueChange={onGenreChange}>
          <SelectTrigger id="genre">
            <SelectValue placeholder="All Genres" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Genres</SelectItem>
            {availableGenres.map((genre) => (
              <SelectItem key={genre} value={genre}>
                {genre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sort">Sort By</Label>
        <Select value={sortBy} onValueChange={onSortChange}>
          <SelectTrigger id="sort">
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date_desc">Newest First</SelectItem>
            <SelectItem value="date_asc">Oldest First</SelectItem>
            <SelectItem value="quality_desc">Highest Quality</SelectItem>
            <SelectItem value="quality_asc">Lowest Quality</SelectItem>
            <SelectItem value="title_asc">Title (A-Z)</SelectItem>
            <SelectItem value="title_desc">Title (Z-A)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
