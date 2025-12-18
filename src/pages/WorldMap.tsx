import { useQuery } from "@tanstack/react-query";
import { Loader2, Globe2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchWorldEnvironmentSnapshot } from "@/utils/worldEnvironment";
import InteractiveWorldMap from "@/components/map/InteractiveWorldMap";
import { useTranslation } from "@/hooks/useTranslation";

const WorldMap = () => {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["world-environment", "snapshot"],
    queryFn: fetchWorldEnvironmentSnapshot,
    staleTime: 5 * 60 * 1000,
  });

  const { data: currentLocation } = useQuery({
    queryKey: ["current-location"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("current_city_id")
        .eq("user_id", user.id)
        .single();
      
      return profile?.current_city_id || null;
    },
  });

  const cities = data?.cities ?? [];
  const currentCityId = currentLocation;

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

    if (!cities.length) {
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
      <Card className="overflow-hidden border-none shadow-xl">
        <CardHeader className="border-b border-border bg-card/50 backdrop-blur">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Globe2 className="h-5 w-5" aria-hidden="true" />
            Interactive Global City Network
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative w-full h-[600px]">
            <InteractiveWorldMap 
              cities={cities}
              currentCityId={currentCityId}
            />
          </div>
          <div className="px-6 py-4 text-sm text-muted-foreground border-t border-border">
            🌍 Interact with the globe to explore cities worldwide. Click a city marker to view details and travel options.
            Zoom and drag to navigate the map.
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
