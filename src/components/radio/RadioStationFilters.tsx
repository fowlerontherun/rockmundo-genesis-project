import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Filter, X, Search } from "lucide-react";

export interface RadioFilters {
  search: string;
  stationType: string;
  minQuality: number;
  maxQuality: number;
  acceptsSubmissions: boolean | null;
  genre: string;
  country: string;
  city: string;
}

interface RadioStationFiltersProps {
  filters: RadioFilters;
  onFiltersChange: (filters: RadioFilters) => void;
  genres: string[];
  countries: string[];
  cities: string[];
  stationTypes: string[];
}

export const defaultFilters: RadioFilters = {
  search: "",
  stationType: "all",
  minQuality: 1,
  maxQuality: 10,
  acceptsSubmissions: null,
  genre: "all",
  country: "all",
  city: "all",
};

export function RadioStationFilters({
  filters,
  onFiltersChange,
  genres,
  countries,
  cities,
  stationTypes,
}: RadioStationFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const activeFilterCount = [
    filters.stationType !== "all",
    filters.minQuality > 1 || filters.maxQuality < 10,
    filters.acceptsSubmissions !== null,
    filters.genre !== "all",
    filters.country !== "all",
    filters.city !== "all",
  ].filter(Boolean).length;

  const handleReset = () => {
    onFiltersChange(defaultFilters);
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search stations..."
          value={filters.search}
          onChange={(e) =>
            onFiltersChange({ ...filters, search: e.target.value })
          }
          className="pl-9"
        />
      </div>

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Filter Stations</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="h-8 px-2 text-xs"
              >
                Reset
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Station Type</Label>
              <Select
                value={filters.stationType}
                onValueChange={(v) =>
                  onFiltersChange({ ...filters, stationType: v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {stationTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Genre</Label>
              <Select
                value={filters.genre}
                onValueChange={(v) =>
                  onFiltersChange({ ...filters, genre: v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All genres" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Genres</SelectItem>
                  {genres.map((genre) => (
                    <SelectItem key={genre} value={genre}>
                      {genre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Country</Label>
              <Select
                value={filters.country}
                onValueChange={(v) =>
                  onFiltersChange({ ...filters, country: v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All countries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  {countries.map((country) => (
                    <SelectItem key={country} value={country}>
                      {country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>City</Label>
              <Select
                value={filters.city}
                onValueChange={(v) =>
                  onFiltersChange({ ...filters, city: v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All cities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cities</SelectItem>
                  {cities.map((city) => (
                    <SelectItem key={city} value={city}>
                      {city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Quality Level</Label>
                <span className="text-xs text-muted-foreground">
                  {filters.minQuality} - {filters.maxQuality}
                </span>
              </div>
              <Slider
                value={[filters.minQuality, filters.maxQuality]}
                onValueChange={([min, max]) =>
                  onFiltersChange({
                    ...filters,
                    minQuality: min,
                    maxQuality: max,
                  })
                }
                min={1}
                max={10}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <Label>Accepts Submissions</Label>
              <div className="flex gap-2">
                <Button
                  variant={
                    filters.acceptsSubmissions === null ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() =>
                    onFiltersChange({ ...filters, acceptsSubmissions: null })
                  }
                >
                  All
                </Button>
                <Button
                  variant={
                    filters.acceptsSubmissions === true ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() =>
                    onFiltersChange({ ...filters, acceptsSubmissions: true })
                  }
                >
                  Yes
                </Button>
                <Button
                  variant={
                    filters.acceptsSubmissions === false ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() =>
                    onFiltersChange({ ...filters, acceptsSubmissions: false })
                  }
                >
                  No
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
