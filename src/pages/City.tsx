import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { MapPin, Building2, Train, Plane, Music, Sparkles, Loader2 } from "lucide-react";

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

type CityRouteParams = {
  cityId?: string;
};

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
}

export interface CityPageLoadResult {
  city: CityRecord;
  details: CityEnvironmentDetails | null;
  detailsError: string | null;
}

export const CITY_NOT_FOUND_ERROR = "CITY_NOT_FOUND";

const TRANSPORT_ICON_MAP: Record<string, LucideIcon> = {
  rail: Train,
  train: Train,
  subway: Train,
  metro: Train,
  tram: Train,
  ground: Train,
  bus: Train,
  air: Plane,
  flight: Plane,
  airport: Plane,
};

const getTransportIcon = (type?: string): LucideIcon => {
  if (!type) {
    return MapPin;
  }

  const normalized = type.toLowerCase().trim();
  return TRANSPORT_ICON_MAP[normalized] ?? MapPin;
};

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
    detailsError = "We couldn't load extended city details right now.";
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
}: CityContentProps) => {
  const culturalEvents = useMemo(
    () => (city?.cultural_events ?? []).filter((event) => typeof event === "string" && event.trim().length > 0),
    [city?.cultural_events],
  );

  const venueHighlights = city?.venueHighlights ?? [];
  const studioProfiles = city?.studioProfiles ?? [];
  const transportLinks = city?.transportLinks ?? [];
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

    return "This city is ready to be explored. Updated details will appear here as the world simulation grows.";
  }, [metadata?.summary, city?.profileDescription, city?.description]);

  const famousResident = metadata?.famousResident ?? city?.famousResident ?? null;
  const signatureSound = metadata?.signatureSound ?? null;
  const travelHub = city?.travelHub ?? metadata?.metroArea ?? null;

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
      <header className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="space-y-4">
          <div className="space-y-2">
            <Badge variant="secondary" className="text-sm uppercase tracking-wide">
              City Overview
            </Badge>
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{city.name}</h1>
              <p className="text-muted-foreground md:text-base">{summary}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{city.country}</Badge>
            {playerCount > 0 && (
              <Badge variant="outline" className="bg-primary/10 text-primary">
                {playerCount} {playerCount === 1 ? "player" : "players"} here
              </Badge>
            )}
            {signatureSound && (
              <Badge variant="outline" className="bg-primary/5 text-primary">
                Signature sound: {signatureSound}
              </Badge>
            )}
            {travelHub && (
              <Badge variant="outline" className="bg-secondary/20">
                Travel hub: {travelHub}
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
        <div className="flex flex-col items-stretch gap-3">
          <Button variant="outline" asChild>
            <Link to="/cities">Back to cities</Link>
          </Button>
          <div className="rounded-md border border-border/60 p-3 text-sm text-muted-foreground">
            <div className="font-medium text-foreground">City metrics</div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Population</div>
                <div className="font-semibold">{(city.population / 1_000_000).toFixed(1)}M</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Music Scene</div>
                <div className="font-semibold">{city.music_scene}%</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Cost of Living</div>
                <div className="font-semibold">{city.cost_of_living}%</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Local Bonus</div>
                <div className="font-semibold text-green-600">
                  {Number.isFinite(city.local_bonus) ? `${city.local_bonus}%` : "—"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {detailsError && (
        <Alert variant="default" className="border-yellow-200 bg-yellow-50 text-yellow-900">
          <AlertTitle>Some information is unavailable</AlertTitle>
          <AlertDescription>{detailsError}</AlertDescription>
        </Alert>
      )}

      <CityDistrictsSection districts={districts} />

      <div className="grid gap-6 lg:grid-cols-2">
        <CityStudiosSection studios={studios} />

        <CityNightClubsSection nightClubs={nightClubs} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Train className="h-5 w-5 text-primary" />
              Transport Connections
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {transportLinks.length ? (
              transportLinks.map((option) => {
                const Icon = getTransportIcon(option.type);
                return (
                  <div key={`${option.name}-${option.type}`} className="space-y-2 rounded-lg border border-border/60 p-4">
                    <div className="flex items-start gap-3">
                      <Icon className="mt-1 h-5 w-5 text-muted-foreground" />
                      <div>
                        <h3 className="text-base font-semibold">{option.name}</h3>
                        <p className="text-sm text-muted-foreground">{option.description}</p>
                      </div>
                    </div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {option.distance ? option.distance : "Distance not specified"}
                    </p>
                  </div>
                );
              })
            ) : (
              <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                Transport data will appear here once routes are confirmed.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Festival Circuit Highlights
            </CardTitle>
          </CardHeader>
          <CardContent>
            {culturalEvents.length ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {culturalEvents.map((event) => (
                  <div key={`${city.id}-event-${event}`} className="flex flex-col justify-between rounded-lg border border-border/60 p-4">
                    <div className="space-y-2">
                      <h3 className="text-base font-semibold leading-snug">{event}</h3>
                      <p className="text-sm text-muted-foreground">
                        Plan your tour routing to align with this signature moment in {city.name}.
                      </p>
                    </div>
                    <div className="pt-4 text-xs text-muted-foreground">
                      Opportunity index: {city.music_scene}% | Local bonus {city.local_bonus}x
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

        // Load districts, studios, and player count in parallel
        const [districtsResult, studiosResult, playerCountResult, cityDetails] = await Promise.allSettled([
          supabase.from("city_districts").select("*").eq("city_id", matchedCity.id).order("name"),
          supabase.from("city_studios").select("*, district:city_districts(name)").eq("city_id", matchedCity.id).order("quality_rating", { ascending: false }),
          supabase.from("profiles").select("id", { count: "exact", head: true }).eq("current_city_id", matchedCity.id),
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
          
          if (playerCountResult.status === "fulfilled" && playerCountResult.value.count !== null) {
            setPlayerCount(playerCountResult.value.count);
          }
          
          if (cityDetails.status === "fulfilled") {
            setDetails(cityDetails.value);
            setNightClubs(cityDetails.value.nightClubs ?? []);
          } else if (cityDetails.status === "rejected") {
            console.error(`Failed to load city environment details for ${matchedCity.name}`, cityDetails.reason);
            setDetailsError("We couldn't load extended city details right now.");
            setNightClubs([]);
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
      districts={districts}
      studios={studios}
      playerCount={playerCount}
      nightClubs={nightClubs}
      onRetry={() => {
        void loadCity();
      }}
    />
  );
}
