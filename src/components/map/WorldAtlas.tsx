import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import InteractiveWorldMap from "@/components/map/InteractiveWorldMap";
import { TourRouteMap, type RoutePoint } from "@/components/tours/TourRouteMap";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface AtlasCity {
  id: string;
  name: string;
  country: string;
  dominant_genre?: string;
  latitude?: number | null;
  longitude?: number | null;
}
interface WorldAtlasProps {
  cities: AtlasCity[];
  currentCityId?: string | null;
  bandId?: string | null;
  mode?: "explore" | "fame" | "tour";
  onCitySelect?: (cityId: string) => void;
  onPlanRoute?: (cityIds: string[]) => void;
}

/** A shared city selection surface. Travel booking remains with the authoritative travel/tour flows. */
export default function WorldAtlas({ cities, currentCityId, bandId, mode = "explore", onCitySelect, onPlanRoute }: WorldAtlasProps) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [onlyReached, setOnlyReached] = useState(false);
  const [plannedStops, setPlannedStops] = useState<string[]>([]);
  const { data: cityFans = [] } = useQuery({
    queryKey: ["atlas-city-fame", bandId],
    enabled: !!bandId,
    queryFn: async () => {
      const { data, error } = await supabase.from("band_city_fans")
        .select("city_id, city_name, city_fame, total_fans, gigs_in_city")
        .eq("band_id", bandId!);
      if (error) throw error;
      return data ?? [];
    },
  });
  const fame = useMemo(() => new Map(cityFans.map(row => [row.city_id, row])), [cityFans]);
  const filtered = useMemo(() => cities.filter(city =>
    (!onlyReached || (fame.get(city.id)?.total_fans ?? 0) > 0) &&
    `${city.name} ${city.country}`.toLowerCase().includes(search.trim().toLowerCase())
  ), [cities, search, onlyReached, fame]);
  const selected = cities.find(city => city.id === selectedId);
  const routePoints: RoutePoint[] = plannedStops.flatMap((id, index) => {
    const city = cities.find(item => item.id === id);
    if (!city || city.latitude == null || city.longitude == null) return [];
    return [{ cityName: city.name, country: city.country, lat: city.latitude,
      lng: city.longitude, index, status: "scheduled" }];
  });
  const selectedFame = selected ? fame.get(selected.id) : null;
  const choose = (id: string) => {
    setSelectedId(id);
    onCitySelect?.(id);
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Input aria-label="Search cities or countries" placeholder="Search cities or countries" value={search}
          onChange={event => setSearch(event.target.value)} className="max-w-sm" />
        {bandId && <Button variant={onlyReached ? "default" : "outline"} onClick={() => setOnlyReached(value => !value)}>
          {onlyReached ? "Showing reached cities" : "Show reached cities"}
        </Button>}
        <Badge variant="secondary">{filtered.length} cities</Badge>
      </div>
      {mode === "tour" && plannedStops.length > 0 && <section className="rounded-lg border p-3 space-y-3" aria-label="Draft tour route">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">Draft route preview ({plannedStops.length} stops)</h3>
          <Button size="sm" variant="outline" onClick={() => setPlannedStops([])}>Clear route</Button>
        </div>
        <p className="text-xs text-muted-foreground">Preview only. Stops are not booked; confirm cities, dates and venues in the tour planner.</p>
        <ol className="flex flex-wrap gap-2 text-sm">
          {plannedStops.map((id, index) => {
            const city = cities.find(item => item.id === id);
            return <li key={id} className="rounded bg-muted px-2 py-1">
              {index + 1}. {city?.name}
              <button type="button" className="ml-2 underline" aria-label={`Remove ${city?.name} from route`}
                onClick={() => setPlannedStops(stops => stops.filter(stop => stop !== id))}>Remove</button>
            </li>;
          })}
        </ol>
        <TourRouteMap points={routePoints} />
        {onPlanRoute && <Button onClick={() => onPlanRoute(plannedStops)}>Continue in tour planner</Button>}
      </section>}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="h-[420px] md:h-[600px] min-w-0 overflow-hidden rounded-lg border">
          <InteractiveWorldMap cities={filtered} currentCityId={currentCityId}
            onCityClick={choose} />
        </div>
        <aside className="rounded-lg border p-3 space-y-3" aria-label="Map city details">
          <h3 className="font-semibold">{selected ? selected.name : "Choose a city"}</h3>
          {selected ? <>
            <p className="text-sm text-muted-foreground">{selected.country}</p>
            {selected.dominant_genre && <p className="text-sm">Music scene: {selected.dominant_genre}</p>}
            {bandId && <div className="text-sm space-y-1">
              <p>Local fame: {(selectedFame?.city_fame ?? 0).toLocaleString()}</p>
              <p>Fans: {(selectedFame?.total_fans ?? 0).toLocaleString()}</p>
              <p>Previous gigs: {selectedFame?.gigs_in_city ?? 0}</p>
            </div>}
            <div className="flex flex-wrap gap-2">
              {mode === "tour" && <Button size="sm" variant="secondary"
                disabled={plannedStops.includes(selected.id) || selected.latitude == null || selected.longitude == null}
                onClick={() => setPlannedStops(stops => [...stops, selected.id])}>Add to route preview</Button>}
              <Button asChild size="sm" variant="outline"><Link to={`/cities/${encodeURIComponent(selected.id)}`}>City details</Link></Button>
              <Button asChild size="sm"><Link to="/travel">Plan travel</Link></Button>
              <Button asChild size="sm" variant="outline"><Link to="/tour-manager">Tour manager</Link></Button>
            </div>
          </> : <p className="text-sm text-muted-foreground">
            Select a pin or a city below to inspect its music scene{bandId ? ", fame and fans" : ""}.
            {mode === "tour" ? " Use Tour Manager to schedule and confirm legs." : ""}
          </p>}
          <div className="max-h-72 overflow-y-auto space-y-1" aria-label="City list">
            {filtered.map(city => <button key={city.id} type="button" onClick={() => choose(city.id)}
              className={`block w-full rounded px-2 py-1 text-left text-sm hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${selectedId === city.id ? "bg-muted" : ""}`}>
              {city.name} <span className="text-muted-foreground">· {city.country}</span>
              {bandId && <span className="float-right">{(fame.get(city.id)?.city_fame ?? 0).toLocaleString()}</span>}
            </button>)}
            {filtered.length === 0 && <p className="text-sm text-muted-foreground">No matching cities.</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
