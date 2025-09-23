import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { MapPin, Building2, Train, Plane, Music, Sparkles, Loader2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { useGameData } from "@/hooks/useGameData";
import { usePlayerStatus } from "@/hooks/usePlayerStatus";
import { supabase } from "@/integrations/supabase/client";
import type { PostgrestError } from "@supabase/supabase-js";
import { ACTIVITY_STATUS_DURATIONS } from "@/utils/gameBalance";
import { formatDurationMinutes } from "@/utils/datetime";
import {
  fetchWorldEnvironmentSnapshot,
  fetchCityEnvironmentDetails,
  type City as CityRecord,
  type CityEnvironmentDetails,
} from "@/utils/worldEnvironment";
import { isTableMissingFromSchemaCache } from "@/utils/postgrestErrors";

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
}

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

interface CityTravelOption {
  id: string;
  mode: string;
  modeLabel: string;
  destinationName: string;
  destinationCityId: string | null;
  description: string | null;
  operator: string | null;
  schedule: string | null;
  sustainability: string | null;
  comfort: number | null;
  price: number | null;
  currency: string | null;
  durationMinutes: number | null;
  healthImpact: number;
}

interface CityTravelOptionGroup {
  key: string;
  mode: string;
  modeLabel: string;
  options: CityTravelOption[];
}

type TravelTableName = "travel_flights" | "travel_trains" | "travel_taxis" | "travel_ferries";

const TRAVEL_TABLE_CONFIG: Array<{
  table: TravelTableName;
  mode: string;
  modeLabel: string;
  defaultCurrency?: string;
}> = [
  { table: "travel_flights", mode: "flight", modeLabel: "Flight", defaultCurrency: "USD" },
  { table: "travel_trains", mode: "train", modeLabel: "Train", defaultCurrency: "USD" },
  { table: "travel_taxis", mode: "taxi", modeLabel: "Taxi", defaultCurrency: "USD" },
  { table: "travel_ferries", mode: "ferry", modeLabel: "Ferry", defaultCurrency: "USD" },
];

const toStringOrNull = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return null;
};

const pickString = (...values: unknown[]): string | null => {
  for (const value of values) {
    const result = toStringOrNull(value);
    if (result) {
      return result;
    }
  }
  return null;
};

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9+\-.,hHmM ]/g, "");
    const hourMatch = cleaned.match(/([0-9]+(?:\.[0-9]+)?)\s*h/i);
    const minuteMatch = cleaned.match(/([0-9]+(?:\.[0-9]+)?)\s*m/i);
    if (hourMatch || minuteMatch) {
      const hours = hourMatch ? Number.parseFloat(hourMatch[1]) : 0;
      const minutes = minuteMatch ? Number.parseFloat(minuteMatch[1]) : 0;
      const totalMinutes = hours * 60 + minutes;
      return Number.isFinite(totalMinutes) ? totalMinutes : null;
    }
    const parsed = Number.parseFloat(cleaned.replace(/,/g, ""));
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

const pickNumber = (...values: unknown[]): number | null => {
  for (const value of values) {
    const result = toNumberOrNull(value);
    if (result !== null) {
      return result;
    }
  }
  return null;
};

const formatModeLabel = (mode: string): string => {
  if (!mode) {
    return "Travel";
  }
  return mode
    .split(/[-_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const normalizeComfortValue = (comfort: number | null): number | null => {
  if (comfort === null) {
    return null;
  }
  if (!Number.isFinite(comfort)) {
    return null;
  }
  if (comfort <= 1) {
    return Math.round(comfort * 100);
  }
  if (comfort <= 10) {
    return Math.round((comfort / 10) * 100);
  }
  return Math.round(comfort);
};

const formatDuration = (minutes: number | null): string => {
  if (minutes === null || !Number.isFinite(minutes) || minutes <= 0) {
    return "Varies";
  }
  const totalMinutes = Math.round(minutes);
  const hours = Math.floor(totalMinutes / 60);
  const remainder = totalMinutes % 60;
  if (hours > 0 && remainder > 0) {
    return `${hours}h ${remainder}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${remainder}m`;
};

const formatPrice = (value: number | null, currency: string | null): string => {
  if (value === null || !Number.isFinite(value) || value < 0) {
    return "Varies";
  }
  const normalizedCurrency = currency && currency.trim().length === 3 ? currency.trim().toUpperCase() : "USD";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: normalizedCurrency,
      maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    }).format(value);
  } catch (intlError) {
    console.warn("Falling back to simple currency formatting", intlError);
    const symbol = normalizedCurrency === "USD" ? "$" : `${normalizedCurrency} `;
    return `${symbol}${value.toLocaleString()}`;
  }
};

const normalizeTravelOptionRow = (
  row: Record<string, unknown>,
  index: number,
): CityTravelOption | null => {
  if (!row) {
    return null;
  }

  const modeRaw = pickString(
    row.mode,
    row.mode_id,
    row.mode_slug,
    row.travel_mode,
    row.transport_mode,
    row.modeKey,
    row.type,
    row.transport_type,
    row.route_mode,
  );
  const mode = (modeRaw ?? "").toString().toLowerCase();
  const modeLabel = pickString(row.mode_label, row.modeLabel, row.mode_name, row.mode_display, row.modeTitle) ?? formatModeLabel(mode || "Travel");

  const destinationName =
    pickString(
      row.destination_name,
      row.destination_city_name,
      row.city_to_name,
      row.destination,
      row.destination_city,
      row.destination_label,
      row.destinationTitle,
      row.arrival_city_name,
    ) ?? "Confirmed destination";

  const destinationCityId =
    pickString(
      row.destination_city_id,
      row.destinationCityId,
      row.city_to,
      row.destination_id,
      row.arrival_city_id,
      row.destinationCityID,
    ) ?? null;

  const description = pickString(row.description, row.summary, row.details, row.notes, row.narrative, row.pitch) ?? null;
  const operator = pickString(row.operator, row.carrier, row.provider, row.company, row.operator_name) ?? null;
  const schedule = pickString(row.schedule, row.departure_window, row.frequency, row.cadence, row.service_window) ?? null;
  const sustainability =
    pickString(
      row.sustainability,
      row.sustainability_note,
      row.sustainability_score,
      row.environmental_note,
      row.carbon_impact,
    ) ?? null;
  const comfort = normalizeComfortValue(pickNumber(row.comfort, row.comfort_score, row.comfort_rating, row.quality_rating));
  const price = pickNumber(row.cost, row.base_cost, row.price, row.ticket_price, row.average_cost, row.estimated_cost);
  const currency = pickString(row.currency, row.price_currency, row.cost_currency, row.fare_currency);

  const durationCandidate = pickNumber(
    row.duration_minutes,
    row.durationMinutes,
    row.travel_time_minutes,
    row.travel_minutes,
    row.duration,
  );
  const durationHours = pickNumber(
    row.duration_hours,
    row.durationHours,
    row.travel_time_hours,
    row.time_hours,
    row.estimated_hours,
  );
  const durationText = pickString(row.duration_text, row.duration_display, row.travel_time_text);

  let durationMinutes: number | null = durationCandidate;
  if (durationMinutes === null && durationHours !== null) {
    durationMinutes = Math.round(durationHours * 60);
  }
  if (durationMinutes === null && durationText) {
    durationMinutes = toNumberOrNull(durationText);
  }

  const healthImpactRaw = pickNumber(
    row.health_impact,
    row.healthImpact,
    row.health_penalty,
    row.health_cost,
    row.health_delta,
  );
  const healthImpact =
    healthImpactRaw === null || !Number.isFinite(healthImpactRaw) ? 0 : Math.abs(healthImpactRaw);

  const identifier =
    pickString(row.id, row.route_id, row.option_id, row.travel_option_id, row.travelRouteId, row.travelOptionId) ??
    `${mode || "travel"}-${destinationCityId ?? destinationName}-${index}`;

  return {
    id: identifier,
    mode: mode || "travel",
    modeLabel,
    destinationName,
    destinationCityId,
    description,
    operator,
    schedule,
    sustainability,
    comfort,
    price,
    currency: currency ? currency.toUpperCase() : null,
    durationMinutes,
    healthImpact,
  };
};

const flattenTravelRows = (rows: Record<string, unknown>[]): CityTravelOption[] => {
  const options: CityTravelOption[] = [];

  rows.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") {
      return;
    }

    const record = entry as Record<string, unknown>;
    const nestedCandidates = [
      record.options,
      record.routes,
      record.travel_options,
      record.travelRoutes,
      record.mode_options,
    ];

    const nested = nestedCandidates.find((candidate) => Array.isArray(candidate)) as unknown[] | undefined;

    if (nested && nested.length > 0) {
      nested.forEach((nestedEntry, nestedIndex) => {
        if (!nestedEntry || typeof nestedEntry !== "object") {
          return;
        }
        const mergedRecord = {
          ...record,
          ...(nestedEntry as Record<string, unknown>),
        } as Record<string, unknown>;
        const normalized = normalizeTravelOptionRow(mergedRecord, Number(`${index}${nestedIndex}`));
        if (normalized) {
          options.push(normalized);
        }
      });
      return;
    }

    const normalized = normalizeTravelOptionRow(record, index);
    if (normalized) {
      options.push(normalized);
    }
  });

  return options;
};

const groupTravelOptionsByMode = (options: CityTravelOption[]): CityTravelOptionGroup[] => {
  const groups = new Map<string, CityTravelOptionGroup>();

  options.forEach((option) => {
    const key = option.mode.toLowerCase();
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        mode: option.mode,
        modeLabel: option.modeLabel,
        options: [],
      });
    }
    const group = groups.get(key);
    if (group) {
      group.options.push(option);
    }
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      options: group.options.sort((a, b) => {
        const priceA = a.price ?? Number.POSITIVE_INFINITY;
        const priceB = b.price ?? Number.POSITIVE_INFINITY;
        if (priceA === priceB) {
          const durationA = a.durationMinutes ?? Number.POSITIVE_INFINITY;
          const durationB = b.durationMinutes ?? Number.POSITIVE_INFINITY;
          return durationA - durationB;
        }
        return priceA - priceB;
      }),
    }))
    .sort((a, b) => a.modeLabel.localeCompare(b.modeLabel));
};

// eslint-disable-next-line react-refresh/only-export-components
export const __cityTravelTestUtils = {
  normalizeTravelOptionRow,
  flattenTravelRows,
  groupTravelOptionsByMode,
};

export const CityContent = ({
  city,
  details,
  detailsLoading,
  loading,
  error,
  detailsError,
  onRetry,
}: CityContentProps) => {
  const { toast } = useToast();
  const { profile, currentCity, updateProfile, addActivity } = useGameData();
  const { startTimedStatus } = usePlayerStatus();
  const culturalEvents = useMemo(
    () => (city?.cultural_events ?? []).filter((event) => typeof event === "string" && event.trim().length > 0),
    [city?.cultural_events],
  );

  const venueHighlights = city?.venueHighlights ?? [];
  const studioProfiles = city?.studioProfiles ?? [];
  const transportLinks = city?.transportLinks ?? [];
  const metadata = details?.metadata ?? null;
  const [travelGroups, setTravelGroups] = useState<CityTravelOptionGroup[]>([]);
  const [travelLoading, setTravelLoading] = useState(false);
  const [travelError, setTravelError] = useState<string | null>(null);
  const [bookingOptionId, setBookingOptionId] = useState<string | null>(null);

  const loadTravelOptions = useCallback(async (): Promise<CityTravelOptionGroup[]> => {
    if (!city?.id) {
      return [];
    }

    const collectedRows: Record<string, unknown>[] = [];
    const destinationIds = new Set<string>();

    for (const config of TRAVEL_TABLE_CONFIG) {
      try {
        const response = await supabase
          .from(config.table)
          .select("id, city_from, city_to, cost, duration_minutes, health_impact")
          .eq("city_from", city.id);

        if (response.error) {
          if (isTableMissingFromSchemaCache(response.error)) {
            continue;
          }
          throw response.error;
        }

        const rows = Array.isArray(response.data) ? (response.data as Record<string, unknown>[]) : [];

        rows.forEach((row) => {
          if (!row || typeof row !== "object") {
            return;
          }

          const destinationCityId =
            typeof (row as Record<string, unknown>).city_to === "string"
              ? ((row as Record<string, unknown>).city_to as string)
              : null;

          if (destinationCityId) {
            destinationIds.add(destinationCityId);
          }

          collectedRows.push({
            ...row,
            mode: config.mode,
            mode_label: config.modeLabel,
            destination_city_id: destinationCityId,
            currency: config.defaultCurrency ?? null,
          });
        });
      } catch (unknownError) {
        if (isTableMissingFromSchemaCache(unknownError)) {
          continue;
        }

        throw unknownError;
      }
    }

    if (collectedRows.length === 0) {
      return [];
    }

    let destinationMap = new Map<string, string>();

    if (destinationIds.size > 0) {
      try {
        const response = await supabase
          .from("cities")
          .select("id, name")
          .in("id", Array.from(destinationIds));

        if (!response.error && Array.isArray(response.data)) {
          destinationMap = new Map(
            response.data
              .filter((entry): entry is { id: string; name: string | null } =>
                Boolean(entry && typeof entry.id === "string"),
              )
              .map((entry) => [entry.id, entry.name ?? "Confirmed destination"]),
          );
        }
      } catch (lookupError) {
        console.warn("Failed to resolve destination city names", lookupError);
      }
    }

    const enrichedRows = collectedRows.map((row) => {
      const destinationCityId =
        typeof row.destination_city_id === "string" ? (row.destination_city_id as string) : null;
      const destinationName =
        (destinationCityId ? destinationMap.get(destinationCityId) : undefined) ??
        (typeof row.destination_name === "string" ? (row.destination_name as string) : undefined);

      return {
        ...row,
        destination_name: destinationName ?? "Confirmed destination",
      } as Record<string, unknown>;
    });

    const normalized = flattenTravelRows(enrichedRows);
    if (normalized.length === 0) {
      return [];
    }

    return groupTravelOptionsByMode(normalized);
  }, [city?.id]);

  const refreshTravelOptions = useCallback(async () => {
    if (!city?.id) {
      setTravelGroups([]);
      return;
    }

    setTravelLoading(true);
    setTravelError(null);

    try {
      const groups = await loadTravelOptions();
      setTravelGroups(groups);
    } catch (error) {
      console.error("Failed to load travel options", error);
      setTravelGroups([]);
      setTravelError("We couldn't load travel options right now. Please try again.");
    } finally {
      setTravelLoading(false);
    }
  }, [city?.id, loadTravelOptions]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!city?.id) {
        setTravelGroups([]);
        return;
      }

      setTravelLoading(true);
      setTravelError(null);

      try {
        const groups = await loadTravelOptions();
        if (!cancelled) {
          setTravelGroups(groups);
        }
      } catch (error) {
        console.error("Failed to load travel options", error);
        if (!cancelled) {
          setTravelGroups([]);
          setTravelError("We couldn't load travel options right now. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setTravelLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [city?.id, loadTravelOptions]);

  const handleBookTravel = useCallback(
    async (option: CityTravelOption) => {
      if (!profile) {
        toast({
          title: "Profile required",
          description: "Create or load your artist profile to confirm travel plans.",
          variant: "destructive",
        });
        return;
      }

      if (!city) {
        toast({
          title: "Unable to book travel",
          description: "We couldn't determine the origin city for this booking.",
          variant: "destructive",
        });
        return;
      }

      const currentHealth = typeof profile.health === "number" ? profile.health : 100;
      const nextHealth = Math.max(0, currentHealth - option.healthImpact);

      setBookingOptionId(option.id);

      try {
        const updates: Record<string, unknown> = {
          health: nextHealth,
        };

        if (option.destinationCityId) {
          updates.current_city_id = option.destinationCityId;
        }

        await updateProfile(updates as Parameters<typeof updateProfile>[0]);

        const bookingPayload = {
          profile_id: profile.id,
          travel_option_id: option.id,
          origin_city_id: city.id,
          destination_city_id: option.destinationCityId,
          travel_mode: option.mode,
          cost: option.price,
          currency: option.currency,
        };

        try {
          const { error: bookingError } = await supabase.from("travel_bookings").insert(bookingPayload);
          if (bookingError && (bookingError as PostgrestError)?.code !== "42P01") {
            console.warn("Failed to log travel booking", bookingError);
          }
        } catch (bookingInsertError) {
          const postgrestError = bookingInsertError as PostgrestError;
          if (postgrestError?.code !== "42P01") {
            console.warn("Unexpected error while logging travel booking", bookingInsertError);
          }
        }

        try {
          await addActivity(
            "travel",
            `Booked travel to ${option.destinationName} via ${option.modeLabel}`,
            undefined,
            {
              origin_city_id: city.id,
              origin_city_name: city.name,
              destination_city_id: option.destinationCityId,
              destination_name: option.destinationName,
              travel_mode: option.mode,
              travel_option_id: option.id,
            },
          );
        } catch (activityError) {
          console.warn("Failed to log travel activity", activityError);
        }

        const travelDurationCandidate = Number(option.durationMinutes);
        const travelDurationMinutes = Number.isFinite(travelDurationCandidate)
          ? Math.max(1, Math.round(travelDurationCandidate))
          : ACTIVITY_STATUS_DURATIONS.travelFallback;
        startTimedStatus({
          status: "Traveling",
          durationMinutes: travelDurationMinutes,
          metadata: {
            origin: city.name,
            destination: option.destinationName,
            mode: option.modeLabel,
            travel_option_id: option.id,
          },
        });
        const travelDurationLabel = formatDurationMinutes(travelDurationMinutes);

        toast({
          title: "Traveling",
          description: option.destinationCityId
            ? `Traveling to ${option.destinationName} via ${option.modeLabel} — about ${travelDurationLabel} remaining.`
            : `Traveling toward ${option.destinationName} via ${option.modeLabel} — about ${travelDurationLabel} remaining.`,
        });
      } catch (error) {
        console.error("Failed to confirm travel booking", error);
        toast({
          title: "Unable to book travel",
          description: "Something went wrong while confirming this route. Please try again.",
          variant: "destructive",
        });
      } finally {
        setBookingOptionId(null);
      }
    },
    [addActivity, city, profile, startTimedStatus, toast, updateProfile],
  );

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
                <div className="font-semibold text-green-600">{city.local_bonus}x</div>
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Key District Highlights
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {venueHighlights.length ? (
            venueHighlights.map((venue) => (
              <div key={venue.name} className="space-y-3 rounded-lg border border-border/60 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{venue.name}</h3>
                    <p className="text-sm text-muted-foreground">{venue.district}</p>
                  </div>
                  {venue.capacity && <Badge variant="outline">{venue.capacity}</Badge>}
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{venue.description}</p>
              </div>
            ))
          ) : (
            <div className="md:col-span-3 rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
              Venue highlights are still being compiled for this city.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music className="h-5 w-5 text-primary" />
              Studios &amp; Creative Spaces
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {studioProfiles.length ? (
              studioProfiles.map((studio) => (
                <div key={studio.name} className="space-y-2 rounded-lg border border-border/60 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-base font-semibold">{studio.name}</h3>
                      {studio.neighborhood && (
                        <p className="text-sm text-muted-foreground">{studio.neighborhood}</p>
                      )}
                    </div>
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  {studio.specialties.length ? (
                    <div className="flex flex-wrap gap-2">
                      {studio.specialties.map((specialty) => (
                        <Badge key={`${studio.name}-${specialty}`} variant="secondary">
                          {specialty}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No specialties recorded yet.</p>
                  )}
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                Studio profiles are still being curated for this city.
              </div>
            )}
          </CardContent>
        </Card>

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
              <Plane className="h-5 w-5 text-primary" />
              Travel Booking Desk
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {travelLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Gathering live travel itineraries...
              </div>
            ) : travelError ? (
              <Alert variant="destructive">
                <AlertTitle>Travel options unavailable</AlertTitle>
                <AlertDescription>{travelError}</AlertDescription>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => refreshTravelOptions()}>
                    Try again
                  </Button>
                </div>
              </Alert>
            ) : travelGroups.length ? (
              <div className="space-y-4">
                {travelGroups.map((group) => {
                  const Icon = getTransportIcon(group.mode);
                  return (
                    <div key={group.key} className="space-y-3 rounded-lg border border-border/60 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Icon className="h-5 w-5 text-muted-foreground" />
                          <h3 className="text-lg font-semibold leading-tight">{group.modeLabel}</h3>
                        </div>
                        {currentCity && (
                          <Badge variant="secondary" className="text-xs">
                            Departing {currentCity.name}
                          </Badge>
                        )}
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Destination</TableHead>
                            <TableHead className="hidden sm:table-cell">Operator</TableHead>
                            <TableHead className="hidden md:table-cell">Duration</TableHead>
                            <TableHead className="hidden md:table-cell">Cost</TableHead>
                            <TableHead className="w-[160px] text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.options.map((option) => {
                            const bookingInProgress = bookingOptionId === option.id;
                            const destinationMatchesCurrent = Boolean(
                              option.destinationCityId &&
                                (profile?.current_city_id === option.destinationCityId ||
                                  currentCity?.id === option.destinationCityId),
                            );
                            return (
                              <TableRow key={option.id} className="align-top">
                                <TableCell>
                                  <div className="flex flex-col gap-1">
                                    <span className="font-medium text-foreground">{option.destinationName}</span>
                                    {option.description && (
                                      <span className="text-xs text-muted-foreground">{option.description}</span>
                                    )}
                                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                      {option.schedule && <span className="rounded bg-muted px-2 py-0.5">{option.schedule}</span>}
                                      {option.sustainability && (
                                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-700">
                                          {option.sustainability}
                                        </span>
                                      )}
                                      {typeof option.comfort === "number" && (
                                        <span className="rounded bg-muted px-2 py-0.5">
                                          Comfort {option.comfort}%
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="hidden sm:table-cell">
                                  {option.operator ? option.operator : <span className="text-muted-foreground">—</span>}
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
                                  <span>{formatDuration(option.durationMinutes)}</span>
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
                                  <span>{formatPrice(option.price, option.currency)}</span>
                                </TableCell>
                                <TableCell className="w-[160px] text-right">
                                  <Button
                                    size="sm"
                                    className="w-full"
                                    disabled={bookingInProgress || destinationMatchesCurrent}
                                    onClick={() => handleBookTravel(option)}
                                  >
                                    {bookingInProgress ? (
                                      <span className="flex items-center justify-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Booking...
                                      </span>
                                    ) : destinationMatchesCurrent ? (
                                      "Already here"
                                    ) : profile ? (
                                      "Book travel"
                                    ) : (
                                      "Sign in to book"
                                    )}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                Dedicated travel itineraries will appear here as routes are unlocked for {city.name}.
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

        try {
          const cityDetails = await fetchCityEnvironmentDetails(matchedCity.id, {
            cityName: matchedCity.name,
            country: matchedCity.country,
          });
          if (!options.signal?.cancelled) {
            setDetails(cityDetails);
          }
        } catch (detailsFetchError) {
          if (!options.signal?.cancelled) {
            console.error(`Failed to load city environment details for ${matchedCity.name}`, detailsFetchError);
            setDetailsError("We couldn't load extended city details right now.");
          }
        } finally {
          if (!options.signal?.cancelled) {
            setDetailsLoading(false);
          }
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
      onRetry={() => {
        void loadCity();
      }}
    />
  );
}
