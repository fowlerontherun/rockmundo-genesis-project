import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MapPin, RefreshCcw, Sparkles, Star, TrendingUp } from "lucide-react";

interface StudioRecord {
  id: string;
  name: string | null;
  city_id: string | null;
  quality: number | null;
  engineer_rating: number | null;
  equipment_rating: number | null;
  cost_per_day: number | string | null;
  cities?: {
    name?: string | null;
  } | null;
}

interface Studio {
  id: string;
  name: string;
  cityId: string | null;
  cityName: string;
  quality: number | null;
  engineerRating: number | null;
  equipmentRating: number | null;
  costPerDay: number | null;
  baseEfficiency: number | null;
  costPerEfficiency: number | null;
}

interface CitySummary {
  key: string;
  cityId: string | null;
  cityName: string;
  studioCount: number;
  averageBaseEfficiency: number | null;
  averageDailyRate: number | null;
  topStudio: Studio | null;
}

const UNASSIGNED_CITY_KEY = "__unassigned__";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const toNumericOrNull = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
};

const calculateBaseEfficiency = (studio: StudioRecord): number | null => {
  const quality = toNumericOrNull(studio.quality);
  const engineer = toNumericOrNull(studio.engineer_rating);
  const equipment = toNumericOrNull(studio.equipment_rating);

  if (quality === null || engineer === null || equipment === null) {
    return null;
  }

  return Math.round((quality + engineer + equipment) / 3);
};

const createStudio = (record: StudioRecord): Studio => {
  const name = record.name?.trim() || "Untitled Studio";
  const cityName = record.cities?.name?.trim() || "Unassigned city";
  const quality = toNumericOrNull(record.quality);
  const engineerRating = toNumericOrNull(record.engineer_rating);
  const equipmentRating = toNumericOrNull(record.equipment_rating);
  const costPerDayRaw = toNumericOrNull(record.cost_per_day);
  const baseEfficiency = calculateBaseEfficiency(record);

  const costPerEfficiency =
    baseEfficiency !== null && baseEfficiency > 0 && costPerDayRaw !== null && costPerDayRaw > 0
      ? Math.round((costPerDayRaw / baseEfficiency) * 10) / 10
      : null;

  return {
    id: record.id,
    name,
    cityId: record.city_id,
    cityName,
    quality,
    engineerRating,
    equipmentRating,
    costPerDay: costPerDayRaw,
    baseEfficiency,
    costPerEfficiency,
  };
};

const getCityKey = (studio: Studio) => studio.cityId ?? UNASSIGNED_CITY_KEY;

const MusicStudio = () => {
  const [studios, setStudios] = useState<Studio[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStudios = useCallback(
    async (showInitialLoading = false) => {
      if (showInitialLoading) {
        setIsLoading(true);
      }

      setIsRefreshing(true);
      setError(null);

      try {
        // Stub out the missing studios table
        console.info("Studios table is not available yet; using empty data.");
        const mapped: Studio[] = [];
        
        // For demo purposes, add some fake data
        mapped.push({
          id: '1',
          name: 'Demo Studio',
          cityId: null,
          cityName: 'Available Soon',
          quality: 80,
          engineerRating: 75,
          equipmentRating: 85,
          costPerDay: 500,
          baseEfficiency: 80,
          costPerEfficiency: 6.25
        });
        setStudios(mapped);
        setLastUpdated(new Date());
      } catch (fetchError) {
        console.error("Failed to load studios", fetchError);
        const message =
          fetchError instanceof Error ? fetchError.message : "We couldn't load studio information.";
        setError(message);
      } finally {
        setIsRefreshing(false);
        setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void fetchStudios(true);
  }, [fetchStudios]);

  const sortedStudios = useMemo(() => {
    return [...studios].sort((a, b) => {
      const baseA = a.baseEfficiency ?? -1;
      const baseB = b.baseEfficiency ?? -1;

      if (baseA === baseB) {
        return a.name.localeCompare(b.name);
      }

      return baseB - baseA;
    });
  }, [studios]);

  const citySummaries = useMemo<CitySummary[]>(() => {
    if (!studios.length) {
      return [];
    }

    const groups = new Map<string, { cityId: string | null; cityName: string; studios: Studio[] }>();

    studios.forEach((studio) => {
      const key = getCityKey(studio);
      const existing = groups.get(key);

      if (existing) {
        existing.studios.push(studio);
      } else {
        groups.set(key, {
          cityId: studio.cityId,
          cityName: studio.cityName,
          studios: [studio],
        });
      }
    });

    return Array.from(groups.entries())
      .map(([key, group]) => {
        const baseValues = group.studios
          .map((studio) => studio.baseEfficiency)
          .filter((value): value is number => value !== null);

        const averageBaseEfficiency = baseValues.length
          ? Math.round(baseValues.reduce((total, value) => total + value, 0) / baseValues.length)
          : null;

        const rateValues = group.studios
          .map((studio) => studio.costPerDay)
          .filter((value): value is number => value !== null && value > 0);

        const averageDailyRate = rateValues.length
          ? Math.round(rateValues.reduce((total, value) => total + value, 0) / rateValues.length)
          : null;

        const topStudio = [...group.studios].sort((a, b) => {
          const baseA = a.baseEfficiency ?? -1;
          const baseB = b.baseEfficiency ?? -1;
          return baseB - baseA;
        })[0];

        return {
          key,
          cityId: group.cityId,
          cityName: group.cityName,
          studioCount: group.studios.length,
          averageBaseEfficiency,
          averageDailyRate,
          topStudio: topStudio ?? null,
        };
      })
      .sort((a, b) => {
        const baseA = a.averageBaseEfficiency ?? -1;
        const baseB = b.averageBaseEfficiency ?? -1;
        return baseB - baseA;
      });
  }, [studios]);

  const cityOptions = useMemo(() => {
    const baseOptions = [
      {
        value: "all",
        label: "All cities",
      },
    ];

    const cityEntries = citySummaries.map((summary) => ({
      value: summary.key,
      label: summary.cityName,
    }));

    return [...baseOptions, ...cityEntries];
  }, [citySummaries]);

  useEffect(() => {
    if (!cityOptions.some((option) => option.value === selectedCity)) {
      setSelectedCity("all");
    }
  }, [cityOptions, selectedCity]);

  const filteredStudios = useMemo(() => {
    if (selectedCity === "all") {
      return sortedStudios;
    }

    return sortedStudios.filter((studio) => getCityKey(studio) === selectedCity);
  }, [selectedCity, sortedStudios]);

  const metrics = useMemo(() => {
    if (!studios.length) {
      return {
        total: 0,
        averageBase: null as number | null,
        averageRate: null as number | null,
        topPerformer: null as Studio | null,
        bestValue: null as Studio | null,
      };
    }

    const baseValues = studios
      .map((studio) => studio.baseEfficiency)
      .filter((value): value is number => value !== null);
    const averageBase = baseValues.length
      ? Math.round(baseValues.reduce((total, value) => total + value, 0) / baseValues.length)
      : null;

    const rateValues = studios
      .map((studio) => studio.costPerDay)
      .filter((value): value is number => value !== null && value > 0);
    const averageRate = rateValues.length
      ? Math.round(rateValues.reduce((total, value) => total + value, 0) / rateValues.length)
      : null;

    const topPerformer = sortedStudios[0] ?? null;

    const bestValue = studios.reduce<Studio | null>((currentBest, studio) => {
      if (studio.costPerEfficiency === null) {
        return currentBest;
      }

      if (!currentBest || (studio.costPerEfficiency ?? Infinity) < (currentBest.costPerEfficiency ?? Infinity)) {
        return studio;
      }

      return currentBest;
    }, null);

    return {
      total: studios.length,
      averageBase,
      averageRate,
      topPerformer,
      bestValue,
    };
  }, [sortedStudios, studios]);

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdated) {
      return null;
    }

    try {
      return formatDistanceToNow(lastUpdated, { addSuffix: true });
    } catch {
      return lastUpdated.toLocaleTimeString();
    }
  }, [lastUpdated]);

  return (
    <div className="container mx-auto space-y-8 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Music Studio</h1>
        <p className="text-muted-foreground">
          Explore booking-ready studios, compare performance ratings, and identify the most efficient spaces for your next
          recording sprint.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load studio data</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total studios</CardDescription>
            <CardTitle className="text-3xl font-bold">{metrics.total}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Managed spaces available for immediate booking.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average base efficiency</CardDescription>
            <CardTitle className="text-3xl font-bold">
              {metrics.averageBase !== null ? `${metrics.averageBase}%` : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Calculated from quality, engineer talent, and equipment ratings across all studios.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Top performer</CardDescription>
            <CardTitle className="text-xl font-semibold leading-tight">
              {metrics.topPerformer ? metrics.topPerformer.name : "Awaiting ratings"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {metrics.topPerformer ? (
              <>
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Star className="h-4 w-4" aria-hidden="true" />
                  Base efficiency ~{metrics.topPerformer.baseEfficiency}%
                </p>
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  {metrics.topPerformer.cityName}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Create a studio profile to surface your first leader.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Best value</CardDescription>
            <CardTitle className="text-xl font-semibold leading-tight">
              {metrics.bestValue ? metrics.bestValue.name : "Set rates to compare"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {metrics.bestValue ? (
              <>
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4" aria-hidden="true" />
                  {metrics.bestValue.costPerEfficiency !== null
                    ? `~${currencyFormatter.format(metrics.bestValue.costPerEfficiency)} per efficiency point`
                    : "Rate not available"}
                </p>
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  {metrics.bestValue.cityName}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Add daily rates to evaluate which studio stretches your budget the furthest.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>City performance snapshot</CardTitle>
          <CardDescription>Compare studio depth and efficiency across each city in your roster.</CardDescription>
        </CardHeader>
        <CardContent>
          {citySummaries.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {citySummaries.map((summary) => (
                <div key={summary.key} className="rounded-lg border bg-muted/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{summary.cityName}</p>
                      <p className="text-xs text-muted-foreground">{summary.studioCount} studio(s)</p>
                    </div>
                    <Badge variant="secondary">{summary.averageBaseEfficiency ?? "—"}% avg</Badge>
                  </div>

                  <div className="mt-4 space-y-2 text-sm">
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <Sparkles className="h-4 w-4" aria-hidden="true" />
                      {summary.topStudio && summary.topStudio.baseEfficiency !== null
                        ? `${summary.topStudio.name} · ${summary.topStudio.baseEfficiency}%`
                        : "Top studio pending"}
                    </p>
                    <p className="text-muted-foreground">
                      Average daily rate: {summary.averageDailyRate ? currencyFormatter.format(summary.averageDailyRate) : "—"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Studio cities will appear here after you configure your first space in the admin console.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Studio booking grid</CardTitle>
              <CardDescription>Filter by city to plan the production environment that matches your next session.</CardDescription>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex flex-col gap-1">
                <Label htmlFor="studio-city-filter" className="text-xs uppercase text-muted-foreground">
                  City
                </Label>
                <Select value={selectedCity} onValueChange={setSelectedCity}>
                  <SelectTrigger id="studio-city-filter" className="w-[220px]">
                    <SelectValue placeholder="All cities" />
                  </SelectTrigger>
                  <SelectContent>
                    {cityOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button variant="outline" onClick={() => void fetchStudios()} disabled={isRefreshing}>
                {isRefreshing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Refreshing
                  </>
                ) : (
                  <>
                    <RefreshCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                    Refresh data
                  </>
                )}
              </Button>
            </div>
          </div>

          {lastUpdatedLabel ? (
            <p className="text-xs text-muted-foreground">Updated {lastUpdatedLabel}</p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              <div className="h-24 animate-pulse rounded-lg bg-muted/40" />
              <div className="h-24 animate-pulse rounded-lg bg-muted/40" />
              <div className="h-24 animate-pulse rounded-lg bg-muted/40" />
            </div>
          ) : filteredStudios.length ? (
            <div className="grid gap-4">
              {filteredStudios.map((studio) => {
                const isTopPerformer = metrics.topPerformer?.id === studio.id;
                const isBestValue = metrics.bestValue?.id === studio.id;

                return (
                  <div key={studio.id} className="rounded-lg border bg-card p-4 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold leading-tight">{studio.name}</h3>
                          {isTopPerformer ? <Badge>Top performer</Badge> : null}
                          {isBestValue ? <Badge variant="outline">Best value</Badge> : null}
                          {studio.baseEfficiency !== null ? (
                            <Badge variant="secondary">Base {studio.baseEfficiency}%</Badge>
                          ) : null}
                        </div>
                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4" aria-hidden="true" />
                          {studio.cityName}
                        </p>
                      </div>

                      <div className="flex flex-wrap justify-end gap-4 text-right text-sm">
                        {studio.costPerDay !== null ? (
                          <div>
                            <p className="text-xs uppercase text-muted-foreground">Daily rate</p>
                            <p className="text-lg font-semibold">{currencyFormatter.format(studio.costPerDay)}</p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs uppercase text-muted-foreground">Daily rate</p>
                            <p className="text-lg font-semibold">—</p>
                          </div>
                        )}
                        {studio.costPerEfficiency !== null ? (
                          <div>
                            <p className="text-xs uppercase text-muted-foreground">Cost / efficiency</p>
                            <p className="text-lg font-semibold">
                              {currencyFormatter.format(studio.costPerEfficiency)}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <p className="text-xs uppercase text-muted-foreground">Quality</p>
                        <p className="text-sm font-medium">{studio.quality !== null ? `${studio.quality}%` : "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-muted-foreground">Engineer rating</p>
                        <p className="text-sm font-medium">{studio.engineerRating !== null ? `${studio.engineerRating}%` : "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-muted-foreground">Equipment rating</p>
                        <p className="text-sm font-medium">{studio.equipmentRating !== null ? `${studio.equipmentRating}%` : "—"}</p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs uppercase text-muted-foreground">Base efficiency</p>
                          <span className="text-xs font-medium">
                            {studio.baseEfficiency !== null ? `${studio.baseEfficiency}%` : "—"}
                          </span>
                        </div>
                        <Progress value={studio.baseEfficiency ?? 0} className="h-2" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
              <p className="font-medium">No studios available</p>
              <p className="text-sm">
                Once your admin team configures studios, they will appear here with live performance insights.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MusicStudio;
