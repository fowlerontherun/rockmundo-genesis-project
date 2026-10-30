import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Globe2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchWorldEnvironmentSnapshot } from "@/utils/worldEnvironment";
import WorldAtlas from "@/components/map/WorldAtlas";
import { useTranslation } from "@/hooks/useTranslation";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { activeWorldScenes, isWorldSceneStatus } from "@/features/city-scene-challenges/worldSceneStatus";

const WorldMap = () => {
  const { t } = useTranslation();
  const { profile: activeProfile } = useActiveProfile();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["world-environment", "snapshot"],
    queryFn: fetchWorldEnvironmentSnapshot,
    staleTime: 5 * 60 * 1000,
  });

  const [sceneMode, setSceneMode] = useState(false);
  const [sceneNowMs, setSceneNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!sceneMode) return;
    const clock = window.setInterval(() => setSceneNowMs(Date.now()), 60_000);
    return () => window.clearInterval(clock);
  }, [sceneMode]);

  const sceneQuery = useQuery({
    queryKey: ["world-city-scene-confirmed-stages"],
    enabled: sceneMode,
    staleTime: 60_000,
    refetchInterval: sceneMode ? 5 * 60_000 : false,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_world_city_scene_status");
      if (error || !isWorldSceneStatus(data)) throw new Error("Verified City Scene map data is unavailable");
      return data;
    },
  });
  const sceneStatusByCity = useMemo(
    () => activeWorldScenes(sceneQuery.data, sceneNowMs),
    [sceneQuery.data, sceneNowMs],
  );

  const currentLocation = activeProfile?.current_city_id || null;

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
          <div className="space-y-2 border-b border-border px-5 py-4">
            <div role="group" aria-label="World map layer" className="flex flex-wrap gap-2">
              <Button size="sm" variant={!sceneMode ? "default" : "outline"} onClick={() => setSceneMode(false)}>Cities</Button>
              <Button size="sm" variant={sceneMode ? "default" : "outline"} onClick={() => { setSceneNowMs(Date.now()); setSceneMode(true); }}>City Scene glow</Button>
            </div>
            {sceneMode && sceneQuery.isPending && <p role="status" className="text-xs text-muted-foreground">Loading confirmed City Scene milestones…</p>}
            {sceneMode && sceneQuery.isError && <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
              <span>City Scene map updates are unavailable. The normal city map is still usable.</span>
              <Button variant="outline" size="sm" onClick={() => void sceneQuery.refetch()}>Retry</Button>
            </div>}
            {sceneMode && sceneQuery.isSuccess && <p className="text-xs text-muted-foreground">
              Pin colours show confirmed 25/50/75/100% mural stages against each city's campaign target, not player counts or real-time scores. Purple 0% pins are active without an unlocked checkpoint; grey pins have no active verified campaign. Checkpoints can be revoked after corrections.
            </p>}
          </div>
          <div className="relative w-full">
            <WorldAtlas cities={cities} currentCityId={currentCityId}
              mode={sceneMode && sceneQuery.isSuccess ? "scene" : "explore"}
              sceneStatusByCity={sceneMode && sceneQuery.isSuccess ? sceneStatusByCity : undefined} />
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
    <FMPageScaffold
      title="World Map"
      subtitle="Survey Rockmundo's global network of music cities — each hub reveals its dominant genre and unlocks travel planning data."
      icon={Globe2}
      backTo="/hub/world-social"
    >
      {renderMap()}
    </FMPageScaffold>
  );
};

export default WorldMap;
