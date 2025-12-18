import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { MapPin, Building2, Train, Plane, Music, Sparkles, Loader2, Globe, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  fetchWorldEnvironmentSnapshot,
  fetchCityEnvironmentDetails,
  type City as CityRecord,
  type CityEnvironmentDetails,
  type CityNightClub,
} from "@/utils/worldEnvironment";
import { supabase } from "@/integrations/supabase/client";
import { CityDistrictsSection } from "@/components/city/CityDistrictsSection";
import { CityStudiosSection } from "@/components/city/CityStudiosSection";
import { CityNightClubsSection } from "@/components/city/CityNightClubsSection";
import { CityTransportSection } from "@/components/city/CityTransportSection";
import { CityMusicSceneCard } from "@/components/city/CityMusicSceneCard";
import { CityCostBreakdown } from "@/components/city/CityCostBreakdown";


type CityRouteParams = {
  cityId?: string;
};

interface TransportRoute {
  id: string;
  transport_type: string;
  duration_hours: number;
  base_cost: number;
  comfort_rating: number;
  frequency: string | null;
  to_city: { name: string; country: string } | null;
  from_city: { name: string; country: string } | null;
}

interface CityContentProps {
  city: CityRecord | null;
  details: CityEnvironmentDetails | null;
  detailsLoading: boolean;
  loading: boolean;
  error: string | null;
  detailsError: string | null;
  onRetry: () => void;
  districts: any[];
  studios: any[];
  playerCount: number;
  nightClubs: CityNightClub[];
  transportRoutes: TransportRoute[];
  venueCount: number;
}

export interface CityPageLoadResult {
  city: CityRecord;
  details: CityEnvironmentDetails | null;
  detailsError: string | null;
}

export const CITY_NOT_FOUND_ERROR = "CITY_NOT_FOUND";

export const loadCityPageData = async (cityId: string): Promise<CityPageLoadResult> => {
  const snapshot = await fetchWorldEnvironmentSnapshot();
  const matchedCity = snapshot.cities.find((entry) => entry.id === cityId);

  if (!matchedCity) {
    throw new Error(CITY_NOT_FOUND_ERROR);
  }

  let details: CityEnvironmentDetails | null = null;
  let detailsError: string | null = null;

  try {
    details = await fetchCityEnvironmentDetails(matchedCity.id, {
      cityName: matchedCity.name,
      country: matchedCity.country,
    });
  } catch (error) {
    console.error(`Failed to load city environment details for ${matchedCity.name}`, error);
    // Only show error for critical failures, not optional metadata
    detailsError = null;
  }

  return {
    city: matchedCity,
    details,
    detailsError,
  };
};

export const CityContent = ({
  city,
  details,
  detailsLoading,
  loading,
  error,
  detailsError,
  onRetry,
  districts,
  studios,
  playerCount,
  nightClubs,
  transportRoutes,
  venueCount,
  rehearsalRooms = [],
}: CityContentProps & { rehearsalRooms?: any[] }) => {
  const culturalEvents = useMemo(
    () => (city?.cultural_events ?? []).filter((event) => typeof event === "string" && event.trim().length > 0),
    [city?.cultural_events],
  );

  const metadata = details?.metadata ?? null;

  const summary = useMemo(() => {
    if (metadata?.summary && metadata.summary.trim().length > 0) {
      return metadata.summary;
    }

    if (city?.profileDescription && city.profileDescription.trim().length > 0) {
      return city.profileDescription;
    }

    if (city?.description && city.description.trim().length > 0) {
      return city.description;
    }

    return `Welcome to ${city?.name ?? 'this city'} - a vibrant destination for musicians with ${city?.music_scene ?? 0}% music scene rating.`;
  }, [metadata?.summary, city?.profileDescription, city?.description, city?.name, city?.music_scene]);

  const famousResident = metadata?.famousResident ?? city?.famousResident ?? null;
  const signatureSound = metadata?.signatureSound ?? null;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading city insights...</span>
        </div>
      </div>
    );
  }

  if (error || !city) {
    return (
      <div className="container mx-auto px-4 py-10">
        <div className="mx-auto flex max-w-xl flex-col gap-4">
          <Alert variant="destructive">
            <AlertTitle>City unavailable</AlertTitle>
            <AlertDescription>{error ?? "We couldn't find the requested city."}</AlertDescription>
          </Alert>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" asChild>
              <Link to="/cities">Back to cities</Link>
            </Button>
            <Button onClick={onRetry}>Try again</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-8 px-4 py-10">
      <header className="relative rounded-xl border border-border/60 p-6 overflow-hidden">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between relative z-10">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-sm uppercase tracking-wide">
                  City Overview
                </Badge>
              </div>
              <div className="space-y-1">
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{city.name}</h1>
                <p className="text-muted-foreground md:text-base max-w-2xl">{summary}</p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <Globe className="h-3 w-3" />
                {city.country}
              </Badge>
              {playerCount > 0 && (
                <Badge variant="outline" className="bg-primary/10 text-primary flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {playerCount} {playerCount === 1 ? "player" : "players"} here
                </Badge>
              )}
              {signatureSound && (
                <Badge variant="outline" className="bg-primary/5 text-primary flex items-center gap-1">
                  <Music className="h-3 w-3" />
                  {signatureSound}
                </Badge>
              )}
            </div>
            
            {famousResident && (
              <p className="text-sm text-muted-foreground">
                Famous resident: <span className="font-medium text-foreground">{famousResident}</span>
              </p>
            )}
            
            {detailsLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Fetching extended city data...
              </div>
            )}
          </div>
          
          <div className="flex flex-col items-stretch gap-3 min-w-[200px]">
            <Button variant="outline" asChild>
              <Link to="/cities">Back to cities</Link>
            </Button>
            <div className="rounded-md border border-border/60 bg-background/80 p-3 text-sm">
              <div className="font-medium text-foreground mb-2">Quick Stats</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Population</div>
                  <div className="font-semibold">{(city.population / 1_000_000).toFixed(1)}M</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Music Scene</div>
                  <div className="font-semibold text-primary">{city.music_scene}%</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Cost of Living</div>
                  <div className="font-semibold">{city.cost_of_living}%</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Local Bonus</div>
                  <div className="font-semibold text-green-600">
                    {Number.isFinite(city.local_bonus) ? `+${city.local_bonus}%` : "—"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Music Scene & Cost Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <CityMusicSceneCard
          musicScene={city.music_scene}
          dominantGenre={city.dominant_genre}
          localBonus={city.local_bonus}
          venueCount={venueCount}
          playerCount={playerCount}
        />
        <CityCostBreakdown
          costOfLiving={city.cost_of_living}
          cityName={city.name}
        />
        <CityTransportSection
          routes={transportRoutes}
          cityName={city.name}
        />
      </div>

      {/* Districts */}
      <CityDistrictsSection districts={districts} />

      {/* Studios, Night Clubs, Festivals */}
      <div className="grid gap-6 lg:grid-cols-2">
        <CityStudiosSection studios={studios} />
        <CityNightClubsSection nightClubs={nightClubs} />

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Festival Circuit & Cultural Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            {culturalEvents.length ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {culturalEvents.map((event) => (
                  <div key={`${city.id}-event-${event}`} className="flex flex-col justify-between rounded-lg border border-border/60 p-4 hover:border-primary/50 transition-colors">
                    <div className="space-y-2">
                      <h3 className="text-base font-semibold leading-snug">{event}</h3>
                      <p className="text-sm text-muted-foreground">
                        Plan your tour routing to align with this signature moment in {city.name}.
                      </p>
                    </div>
                    <div className="pt-4 text-xs text-muted-foreground">
                      Opportunity index: {city.music_scene}% | Local bonus +{city.local_bonus}%
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                No festivals or cultural events have been cataloged for this city yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default function City() {
  const { cityId } = useParams<CityRouteParams>();
  const [city, setCity] = useState<CityRecord | null>(null);
  const [details, setDetails] = useState<CityEnvironmentDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [districts, setDistricts] = useState<any[]>([]);
  const [studios, setStudios] = useState<any[]>([]);
  const [playerCount, setPlayerCount] = useState<number>(0);
  const [nightClubs, setNightClubs] = useState<CityNightClub[]>([]);
  const [rehearsalRooms, setRehearsalRooms] = useState<any[]>([]);
  const [transportRoutes, setTransportRoutes] = useState<TransportRoute[]>([]);
  const [venueCount, setVenueCount] = useState<number>(0);

  const loadCity = useCallback(
    async (options: { signal?: { cancelled: boolean } } = {}) => {
      if (!cityId) {
        return;
      }

      setLoading(true);
      setCity(null);
      setDetails(null);
      setError(null);
      setDetailsError(null);
      setDetailsLoading(false);
      setNightClubs([]);
      setTransportRoutes([]);

      try {
        const snapshot = await fetchWorldEnvironmentSnapshot();
        if (options.signal?.cancelled) {
          return;
        }

        const matchedCity = snapshot.cities.find((entry) => entry.id === cityId);
        if (!matchedCity) {
          if (!options.signal?.cancelled) {
            setError("We couldn't find that city.");
            setLoading(false);
            setDetailsLoading(false);
          }
          return;
        }

        if (options.signal?.cancelled) {
          return;
        }

        setCity(matchedCity);
        setLoading(false);
        setDetailsLoading(true);

        // Load all city data in parallel - use matchedCity.id for all queries
        const [
          districtsResult,
          studiosResult,
          nightClubsResult,
          rehearsalRoomsResult,
          playerCountResult,
          transportResult,
          venueCountResult,
          cityDetails
        ] = await Promise.allSettled([
          supabase.from("city_districts").select("*").eq("city_id", matchedCity.id).order("name"),
          supabase.from("city_studios").select("*, district:city_districts(name)").eq("city_id", matchedCity.id).order("quality_rating", { ascending: false }),
          supabase.from("city_night_clubs").select("*").eq("city_id", matchedCity.id).order("quality_level", { ascending: false }),
          supabase.from("rehearsal_rooms").select("*, city:cities(name)").eq("city_id", matchedCity.id).order("quality_rating", { ascending: false }),
          supabase.from("profiles").select("id", { count: "exact", head: true }).eq("current_city_id", matchedCity.id),
          supabase
            .from("city_transport_routes")
            .select("*, from_city:cities!city_transport_routes_from_city_id_fkey(name, country), to_city:cities!city_transport_routes_to_city_id_fkey(name, country)")
            .eq("from_city_id", matchedCity.id)
            .order("duration_hours", { ascending: true }),
          supabase.from("venues").select("id", { count: "exact", head: true }).eq("city_id", matchedCity.id),
          fetchCityEnvironmentDetails(matchedCity.id, {
            cityName: matchedCity.name,
            country: matchedCity.country,
          })
        ]);

        if (!options.signal?.cancelled) {
          if (districtsResult.status === "fulfilled" && districtsResult.value.data) {
            setDistricts(districtsResult.value.data);
          }
          
          if (studiosResult.status === "fulfilled" && studiosResult.value.data) {
            setStudios(studiosResult.value.data);
          }

          if (nightClubsResult.status === "fulfilled" && nightClubsResult.value.data) {
            setNightClubs(nightClubsResult.value.data as any);
          }

          if (rehearsalRoomsResult.status === "fulfilled" && rehearsalRoomsResult.value.data) {
            setRehearsalRooms(rehearsalRoomsResult.value.data);
          }
          
          if (playerCountResult.status === "fulfilled" && playerCountResult.value.count !== null) {
            setPlayerCount(playerCountResult.value.count);
          }

          if (transportResult.status === "fulfilled" && transportResult.value.data) {
            setTransportRoutes(transportResult.value.data as TransportRoute[]);
          }

          if (venueCountResult.status === "fulfilled" && venueCountResult.value.count !== null) {
            setVenueCount(venueCountResult.value.count);
          }
          
          if (cityDetails.status === "fulfilled") {
            setDetails(cityDetails.value);
            // Only override night clubs if we didn't get them from DB
            if (nightClubsResult.status === "rejected" && cityDetails.value.nightClubs) {
              setNightClubs(cityDetails.value.nightClubs ?? []);
            }
          } else if (cityDetails.status === "rejected") {
            console.error(`Failed to load city environment details for ${matchedCity.name}`, cityDetails.reason);
            // Don't show error banner for optional metadata failures
            setDetailsError(null);
            if (nightClubsResult.status === "rejected") {
              setNightClubs([]);
            }
          }
          
          setDetailsLoading(false);
        }
      } catch (snapshotError) {
        if (!options.signal?.cancelled) {
          console.error("Failed to load city information", snapshotError);
          setError("Unable to load this city right now. Please try again.");
          setLoading(false);
          setDetailsLoading(false);
        }
      }
    },
    [cityId],
  );

  useEffect(() => {
    if (!cityId) {
      return;
    }

    const signal = { cancelled: false };
    void loadCity({ signal });

    return () => {
      signal.cancelled = true;
    };
  }, [cityId, loadCity]);

  if (!cityId) {
    return <Navigate to="/cities" replace />;
  }

  return (
    <CityContent
      city={city}
      details={details}
      detailsLoading={detailsLoading}
      loading={loading}
      error={error}
      detailsError={detailsError}
      onRetry={loadCity}
      districts={districts}
      studios={studios}
      playerCount={playerCount}
      nightClubs={nightClubs}
      rehearsalRooms={rehearsalRooms}
      transportRoutes={transportRoutes}
      venueCount={venueCount}
    />
  );
}
