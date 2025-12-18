import { useState, useEffect, useMemo } from "react";
import { Loader2, List, Map as MapIcon, Globe } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TravelFilters, TravelFiltersState, defaultFilters } from "./TravelFilters";
import { DestinationCard } from "./DestinationCard";
import { TravelMapSelector } from "./TravelMapSelector";
import { getDestinationsFromCity, CityWithCoords, TravelOption } from "@/utils/dynamicTravel";

interface Destination {
  city: CityWithCoords;
  distanceKm: number;
  options: TravelOption[];
  cheapestOption: TravelOption | null;
  fastestOption: TravelOption | null;
}

interface TravelDestinationBrowserProps {
  currentCityId: string;
  currentCityName: string;
  onSelectDestination: (destination: Destination) => void;
}

export function TravelDestinationBrowser({
  currentCityId,
  currentCityName,
  onSelectDestination,
}: TravelDestinationBrowserProps) {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<TravelFiltersState>(defaultFilters);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await getDestinationsFromCity(currentCityId);
        setDestinations(data);
      } catch (error) {
        console.error("Error loading destinations:", error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentCityId]);

  const filteredDestinations = useMemo(() => {
    let filtered = destinations;

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.city.name.toLowerCase().includes(searchLower) ||
          d.city.country.toLowerCase().includes(searchLower)
      );
    }

    // Region filter
    if (filters.region && filters.region !== "all") {
      filtered = filtered.filter((d) => d.city.region === filters.region);
    }

    // Country filter
    if (filters.country && filters.country !== "all") {
      filtered = filtered.filter((d) => d.city.country === filters.country);
    }

    // Transport type filter
    if (filters.transportType && filters.transportType !== "all") {
      filtered = filtered.filter((d) =>
        d.options.some(
          (o) => o.mode === filters.transportType && o.available
        )
      );
    }

    // Price filter
    filtered = filtered.filter(
      (d) => d.cheapestOption && d.cheapestOption.cost <= filters.maxPrice
    );

    // Duration filter
    filtered = filtered.filter((d) => {
      const fastest = d.options
        .filter((o) => o.available)
        .reduce(
          (min, o) => (o.durationHours < min ? o.durationHours : min),
          Infinity
        );
      return fastest <= filters.maxDuration;
    });

    // Sort
    switch (filters.sortBy) {
      case "distance":
        filtered.sort((a, b) => a.distanceKm - b.distanceKm);
        break;
      case "price":
        filtered.sort((a, b) => {
          const aPrice = a.cheapestOption?.cost ?? Infinity;
          const bPrice = b.cheapestOption?.cost ?? Infinity;
          return aPrice - bPrice;
        });
        break;
      case "duration":
        filtered.sort((a, b) => {
          const aDuration = a.fastestOption?.durationHours ?? Infinity;
          const bDuration = b.fastestOption?.durationHours ?? Infinity;
          return aDuration - bDuration;
        });
        break;
      case "musicScene":
        filtered.sort(
          (a, b) => (b.city.music_scene || 0) - (a.city.music_scene || 0)
        );
        break;
    }

    return filtered;
  }, [destinations, filters]);

  // Stats for header
  const stats = useMemo(() => {
    const availableCount = destinations.filter(
      (d) => d.cheapestOption !== null
    ).length;
    const cheapest = destinations.reduce(
      (min, d) =>
        d.cheapestOption && d.cheapestOption.cost < min
          ? d.cheapestOption.cost
          : min,
      Infinity
    );
    const regions = [
      ...new Set(destinations.map((d) => d.city.region).filter(Boolean)),
    ];
    return { availableCount, cheapest, regionCount: regions.length };
  }, [destinations]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Destinations from {currentCityName}
            </CardTitle>
            <CardDescription className="mt-1">
              {stats.availableCount} destinations • {stats.regionCount} regions •
              From ${stats.cheapest === Infinity ? "N/A" : stats.cheapest}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "map" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("map")}
            >
              <MapIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <TravelFilters
          filters={filters}
          onFiltersChange={setFilters}
          onReset={() => setFilters(defaultFilters)}
        />

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {filteredDestinations.length} of {destinations.length}{" "}
            destinations
          </span>
          {filteredDestinations.length !== destinations.length && (
            <Badge variant="outline">{destinations.length - filteredDestinations.length} filtered</Badge>
          )}
        </div>

        {viewMode === "list" ? (
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-3">
              {filteredDestinations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No destinations match your filters
                </div>
              ) : (
                filteredDestinations.map((destination) => (
                  <DestinationCard
                    key={destination.city.id}
                    city={destination.city}
                    distanceKm={destination.distanceKm}
                    options={destination.options}
                    cheapestOption={destination.cheapestOption}
                    fastestOption={destination.fastestOption}
                    onSelect={() => onSelectDestination(destination)}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        ) : (
          <div className="h-[500px] rounded-lg overflow-hidden border">
            <TravelMapSelector
              cities={destinations.map(d => d.city)}
              currentCityId={currentCityId}
              selectedCityId={null}
              onCitySelect={(cityId) => {
                const dest = destinations.find((d) => d.city.id === cityId);
                if (dest) onSelectDestination(dest);
              }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
