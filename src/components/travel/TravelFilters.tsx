import { useState, useEffect } from "react";
import { Filter, X, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { getUniqueRegions, getUniqueCountries } from "@/utils/dynamicTravel";

export interface TravelFiltersState {
  search: string;
  region: string;
  country: string;
  transportType: string;
  maxPrice: number;
  maxDuration: number;
  sortBy: "distance" | "price" | "duration" | "musicScene";
}

interface TravelFiltersProps {
  filters: TravelFiltersState;
  onFiltersChange: (filters: TravelFiltersState) => void;
  onReset: () => void;
}

export const defaultFilters: TravelFiltersState = {
  search: "",
  region: "all",
  country: "all",
  transportType: "all",
  maxPrice: 5000,
  maxDuration: 48,
  sortBy: "distance",
};

export function TravelFilters({ filters, onFiltersChange, onReset }: TravelFiltersProps) {
  const [regions, setRegions] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    getUniqueRegions().then(setRegions);
  }, []);

  useEffect(() => {
    if (filters.region && filters.region !== "all") {
      getUniqueCountries(filters.region).then(setCountries);
    } else {
      getUniqueCountries().then(setCountries);
    }
  }, [filters.region]);

  const updateFilter = <K extends keyof TravelFiltersState>(
    key: K,
    value: TravelFiltersState[K]
  ) => {
    const newFilters = { ...filters, [key]: value };
    // Reset country when region changes
    if (key === "region") {
      newFilters.country = "all";
    }
    onFiltersChange(newFilters);
  };

  const activeFilterCount = [
    filters.search,
    filters.region !== "all" ? filters.region : null,
    filters.country !== "all" ? filters.country : null,
    filters.transportType !== "all" ? filters.transportType : null,
    filters.maxPrice < 5000 ? filters.maxPrice : null,
    filters.maxDuration < 48 ? filters.maxDuration : null,
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search cities..."
          value={filters.search}
          onChange={(e) => updateFilter("search", e.target.value)}
          className="pl-10"
        />
      </div>

      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {activeFilterCount}
                </Badge>
              )}
            </span>
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="pt-4 space-y-4">
          {/* Region & Country */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Region</Label>
              <Select
                value={filters.region}
                onValueChange={(v) => updateFilter("region", v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Regions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  {regions.map((region) => (
                    <SelectItem key={region} value={region}>
                      {region}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Country</Label>
              <Select
                value={filters.country}
                onValueChange={(v) => updateFilter("country", v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Countries" />
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
          </div>

          {/* Transport Type */}
          <div className="space-y-2">
            <Label className="text-xs">Transport Type</Label>
            <Select
              value={filters.transportType}
              onValueChange={(v) => updateFilter("transportType", v)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="bus">🚌 Bus</SelectItem>
                <SelectItem value="train">🚄 Train</SelectItem>
                <SelectItem value="plane">✈️ Plane</SelectItem>
                <SelectItem value="ship">🚢 Ship</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Price Range */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label className="text-xs">Max Price</Label>
              <span className="text-xs text-muted-foreground">
                ${filters.maxPrice.toLocaleString()}
              </span>
            </div>
            <Slider
              value={[filters.maxPrice]}
              min={50}
              max={5000}
              step={50}
              onValueChange={([v]) => updateFilter("maxPrice", v)}
            />
          </div>

          {/* Duration Range */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label className="text-xs">Max Duration</Label>
              <span className="text-xs text-muted-foreground">
                {filters.maxDuration}h
              </span>
            </div>
            <Slider
              value={[filters.maxDuration]}
              min={1}
              max={48}
              step={1}
              onValueChange={([v]) => updateFilter("maxDuration", v)}
            />
          </div>

          {/* Sort By */}
          <div className="space-y-2">
            <Label className="text-xs">Sort By</Label>
            <Select
              value={filters.sortBy}
              onValueChange={(v) => updateFilter("sortBy", v as TravelFiltersState["sortBy"])}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="distance">Distance (Nearest)</SelectItem>
                <SelectItem value="price">Price (Cheapest)</SelectItem>
                <SelectItem value="duration">Duration (Fastest)</SelectItem>
                <SelectItem value="musicScene">Music Scene (Best)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reset Button */}
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={onReset} className="w-full">
              <X className="h-4 w-4 mr-2" />
              Clear All Filters
            </Button>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
