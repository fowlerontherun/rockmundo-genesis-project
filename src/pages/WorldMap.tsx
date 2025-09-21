import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Globe2, MapPin } from "lucide-react";

import mapBackground from "@/assets/world-map.svg";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fetchWorldEnvironmentSnapshot } from "@/utils/worldEnvironment";
import { getCoordinatesForCity } from "@/utils/worldTravel";
import { projectCoordinates } from "@/utils/mapProjection";

const MAP_DIMENSIONS = { width: 1200, height: 620, padding: 48 } as const;

const WorldMap = () => {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["world-environment", "snapshot"],
    queryFn: fetchWorldEnvironmentSnapshot,
    staleTime: 5 * 60 * 1000,
  });

  const pins = useMemo(() => {
    const cityList = data?.cities ?? [];

    if (!cityList.length) {
      return [] as Array<{
        id: string;
        label: string;
        left: string;
        top: string;
        description?: string;
      }>;
    }

    return cityList.map((city) => {
      const coordinates = getCoordinatesForCity(city.name, city.country, {
        latitude: city.latitude ?? null,
        longitude: city.longitude ?? null,
      });
      const point = projectCoordinates(coordinates, MAP_DIMENSIONS);
      const left = `${(point.x / MAP_DIMENSIONS.width) * 100}%`;
      const top = `${(point.y / MAP_DIMENSIONS.height) * 100}%`;
      const label = city.country ? `${city.name}, ${city.country}` : city.name;
      const description = city.dominant_genre
        ? `Dominant genre: ${city.dominant_genre}`
        : "Click to explore this city's opportunities.";

      return {
        id: city.id,
        label,
        left,
        top,
        description,
      };
    });
  }, [data?.cities]);

  const renderMap = () => {
    if (isLoading) {
      return (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium text-muted-foreground">Loading world snapshot...</p>
          </CardContent>
        </Card>
      );
    }

    if (isError) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <p className="text-base font-semibold text-foreground">We couldn't load the world map right now.</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Please check your connection and try again. If the problem continues, our team may be updating the
              world data.
            </p>
            <Button onClick={() => refetch()} variant="outline">
              Retry loading
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (!pins.length) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <MapPin className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-base font-semibold text-foreground">No cities are available yet.</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Once cities are unlocked they will appear here so you can plan your next move across the Rockmundo world.
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="overflow-hidden border-none bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 shadow-xl">
        <CardHeader className="border-b border-white/5 bg-white/5 backdrop-blur">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
            <Globe2 className="h-5 w-5" aria-hidden="true" />
            Global city network
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-0">
          <div className="relative w-full overflow-hidden">
            <div className="relative w-full pt-[56%] sm:pt-[48%]">
              <img
                src={mapBackground}
                alt="Stylised Rockmundo world map"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0">
                {pins.map((pin) => (
                  <Tooltip key={pin.id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => navigate(`/cities/${encodeURIComponent(pin.id)}`)}
                        className="group absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/90 px-3 py-1 text-xs font-semibold text-primary-foreground shadow-lg shadow-primary/20 ring-1 ring-primary/40 transition hover:-translate-y-2 hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
                        style={{ left: pin.left, top: pin.top }}
                        aria-label={`Open details for ${pin.label}`}
                      >
                        <span className="pointer-events-none flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 transition-transform group-hover:scale-110" aria-hidden="true" />
                          <span>{pin.label}</span>
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" align="center" className="max-w-xs text-left">
                      <p className="font-semibold leading-none">{pin.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{pin.description}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          </div>
          <div className="px-6 pb-6 text-sm text-slate-200/80">
            Click a city pin to jump to its upcoming opportunities, venue intel, and travel options. Locations are projected
            using an equirectangular layout so their placement mirrors real-world geography.
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 space-y-3 text-center md:text-left">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
          <Globe2 className="h-4 w-4" aria-hidden="true" />
          Touring intelligence hub
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">World Map</h1>
        <p className="mx-auto max-w-3xl text-sm text-muted-foreground md:text-base">
          Survey Rockmundo's global network of music cities. Each hub reveals its dominant genre, unlocks travel planning
          data, and helps you decide where the next tour stop should be.
        </p>
      </header>

      {renderMap()}
    </div>
  );
};

export default WorldMap;
