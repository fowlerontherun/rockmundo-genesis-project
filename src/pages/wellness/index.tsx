import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bed,
  Bus,
  Dumbbell,
  Heart,
  Sparkles,
  Wine,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

import WellnessVitalsPanel from "@/components/wellness/WellnessVitalsPanel";
import ActivityCard from "@/components/wellness/ActivityCard";
import AilmentsPanel from "@/components/wellness/AilmentsPanel";
import NutritionHydrationPanel from "@/components/wellness/NutritionHydrationPanel";
import { ProfessionalSupportPanel } from "@/components/wellness/ProfessionalSupportPanel";
import { LifestyleRoutinePanel } from "@/components/wellness/LifestyleRoutinePanel";
import { TimeAwayLongevityPanel } from "@/components/wellness/TimeAwayLongevityPanel";
import { CareerStageLongevityPanel } from "@/components/wellness/CareerStageLongevityPanel";

import { useGameData } from "@/hooks/useGameData";
import { useWellnessState } from "@/hooks/useWellnessState";
import { usePlayerProperties, usePlayerRental } from "@/hooks/useHousing";
import { useTravelStatus } from "@/hooks/useTravelStatus";
import type { WellnessCategory } from "@/lib/api/wellnessActivities";
import {
  calculateTravelFatigueEffect,
  forecastWellnessAfterRecovery,
  resolveAccommodationRecoveryProfile,
  type AccommodationSource,
  type TravelSegmentInput,
} from "@/lib/wellnessRecovery";
import {
  buildCoreWellnessModifiers,
  calculateCanonicalReadiness,
  createDefaultWellnessCore,
  type WellnessCoreValues,
} from "@/lib/wellnessSystem";

const tierFromLevel = (tier?: number): AccommodationSource["tier"] => {
  const t = tier ?? 2;
  if (t <= 1) return "basic";
  if (t === 2) return "standard";
  if (t === 3) return "premium";
  return "specialist";
};

const rentalTierFromLevel = (tier?: number): AccommodationSource["tier"] => {
  const t = tier ?? 1;
  if (t <= 1) return "basic";
  if (t === 2) return "standard";
  return "premium";
};

const vehicleFromTransport = (
  transport?: string | null,
): TravelSegmentInput["vehicleTier"] => {
  const t = (transport ?? "").toLowerCase();
  if (t.includes("plane") || t.includes("fly") || t.includes("jet") || t.includes("air")) return "plane";
  if (t.includes("train") || t.includes("rail")) return "train";
  if (t.includes("ferry") || t.includes("boat")) return "ferry";
  if (t.includes("tour")) return "full_tour_bus";
  if (t.includes("bus") || t.includes("coach")) return "small_tour_bus";
  if (t.includes("sprinter")) return "sprinter";
  if (t.includes("van") || t.includes("mini")) return "minivan";
  return "rusty_van";
};

const CATEGORIES: {
  key: WellnessCategory;
  label: string;
  icon: JSX.Element;
  blurb: string;
}[] = [
  { key: "recovery", label: "Recovery", icon: <Heart className="h-4 w-4" />, blurb: "Restore mood, lower stress" },
  { key: "fitness", label: "Fitness", icon: <Dumbbell className="h-4 w-4" />, blurb: "Build long-term health" },
  { key: "medical", label: "Medical", icon: <Sparkles className="h-4 w-4" />, blurb: "Clear ailments, prevent injury" },
  { key: "indulgence", label: "Indulgence", icon: <Wine className="h-4 w-4" />, blurb: "Mood up — but with consequences" },
];

const WellnessPage = () => {
  const { profile } = useGameData();
  const profileId = profile?.id ?? null;
  const {
    catalog,
    cooldowns,
    ailments,
    blocks,
    vitals,
    lifestyle,
    loading,
    error,
    perform,
  } = useWellnessState(profileId);
  const { data: properties = [] } = usePlayerProperties();
  const { data: rental } = usePlayerRental();
  const { travelStatus } = useTravelStatus();
  const [performing, setPerforming] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WellnessCategory>("recovery");

  const cooldownMap = useMemo(
    () => new Map(cooldowns.map((c) => [c.catalog_slug, c])),
    [cooldowns],
  );
  const coreVitals = useMemo<WellnessCoreValues>(() => ({ ...createDefaultWellnessCore(), ...vitals }), [vitals]);

  const accommodationSource = useMemo<AccommodationSource>(() => {
    const homeCityId = profile?.current_city_id ?? null;
    const primary = properties.find((p) => p.is_primary) ?? properties[0];
    if (primary) {
      const ht = primary.housing_types;
      return {
        id: primary.id,
        kind: "home",
        tier: tierFromLevel(ht?.tier),
        name: ht?.name ?? "Owned residence",
        quality: 50 + Math.min(40, (ht?.tier ?? 2) * 10),
        isHomeCity: !!homeCityId && primary.country === (profile as any)?.current_city_country,
        occupied: true,
        upgrades: [],
      };
    }
    if (rental) {
      const rt = rental.rental_types;
      return {
        id: rental.id,
        kind: "temporary",
        tier: rentalTierFromLevel(rt?.tier),
        name: rt?.name ?? "Rented apartment",
        quality: 45 + Math.min(35, (rt?.tier ?? 1) * 10),
        occupied: true,
        upgrades: [],
      };
    }
    return { kind: "none", tier: "none", name: "No accommodation", occupied: false };
  }, [properties, rental, profile]);

  const accommodationProfile = useMemo(
    () => resolveAccommodationRecoveryProfile(accommodationSource),
    [accommodationSource],
  );

  const travelEffect = useMemo(() => {
    if (!travelStatus?.is_traveling || !travelStatus.departure_time || !travelStatus.travel_arrives_at) return null;
    const durationHours = Math.max(
      0.25,
      (new Date(travelStatus.travel_arrives_at).getTime() - new Date(travelStatus.departure_time).getTime()) / 3_600_000,
    );
    const vehicleTier = vehicleFromTransport(travelStatus.transport_type);
    const distanceKm = durationHours * (vehicleTier === "plane" ? 700 : vehicleTier === "train" ? 180 : 80);
    return calculateTravelFatigueEffect(
      { id: travelStatus.travel_id ?? "current", durationHours, distanceKm, vehicleTier },
      coreVitals,
    );
  }, [travelStatus, coreVitals]);

  const recoveryForecast = useMemo(
    () => forecastWellnessAfterRecovery(coreVitals, accommodationProfile, travelEffect ?? undefined, 0),
    [coreVitals, accommodationProfile, travelEffect],
  );

  const readiness = useMemo(
    () =>
      calculateCanonicalReadiness({
        role: "gig",
        core: coreVitals,
        modifiers: buildCoreWellnessModifiers(coreVitals, "gig"),
        confidence: "actual",
      }),
    [coreVitals],
  );

  const grouped = useMemo(() => {
    const g: Record<WellnessCategory, typeof catalog> = {
      recovery: [],
      fitness: [],
      medical: [],
      indulgence: [],
    };
    catalog.forEach((e) => g[e.category]?.push(e));
    return g;
  }, [catalog]);

  const handlePerform = async (slug: string) => {
    setPerforming(slug);
    try {
      const res = await perform(slug);
      const entry = catalog.find((c) => c.slug === slug);
      toast.success(`${entry?.name ?? "Activity"} complete`, {
        description: res.ailments.length
          ? `Side effect: ${res.ailments.join(",")}`
          : "Stats updated.",
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't perform activity");
    } finally {
      setPerforming(null);
    }
  };

  if (!profileId) {
    return (
      <div className="space-y-4 p-6">
        <Alert>
          <AlertTitle>No active character</AlertTitle>
          <AlertDescription>
            Create or select a character to manage wellness.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!vitals) {
    return (
      <div className="space-y-4 p-6">
        <Alert>
          <AlertTitle>Wellness data unavailable</AlertTitle>
          <AlertDescription>
            We couldn't load your character's vitals yet. Try refreshing the page in a moment.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-display text-xs text-muted-foreground">
            Lifestyle
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Wellness & Lifestyle
          </h1>
          <p className="text-sm text-muted-foreground">
            Your health gates what you can do on stage, in studio, and on tour.
          </p>
        </div>
        {blocks.length > 0 && (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" /> {blocks.length} active block
            {blocks.length > 1 ? "s" : ""}
          </Badge>
        )}
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Couldn't load wellness</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <WellnessVitalsPanel vitals={vitals} fame={profile?.fame ?? 0} />

      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-primary" /> Canonical readiness
            <Badge variant="outline">{readiness.state.split("_").join(" ")}</Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">Live readiness score for your next gig based on current vitals.</p>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[160px_1fr]">
          <div className="rounded-lg border p-3 text-center" role="group" aria-label={`Gig readiness ${readiness.score} out of 100`}>
            <p className="text-3xl font-bold">{readiness.score}</p>
            <p className="text-xs text-muted-foreground">Gig readiness</p>
          </div>
          <div className="space-y-2 text-sm">
            <p>{readiness.explanation.summary}</p>
            <p className="text-muted-foreground">Recommended action: {readiness.explanation.suggestedAction}</p>
            <details className="rounded-md border p-3">
              <summary className="cursor-pointer font-medium">Calculation details</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                <li>Base value: {readiness.explanation.baseValue}</li>
                <li>Positive contributors: {readiness.explanation.positiveContributors.map((c) => c.explanation).join(", ") || "None"}</li>
                <li>Negative contributors: {readiness.explanation.negativeContributors.map((c) => c.explanation).join(", ") || "None"}</li>
                <li>Capped contributors: {readiness.explanation.cappedContributors.length}</li>
              </ul>
            </details>
          </div>
        </CardContent>
      </Card>

      <LifestyleRoutinePanel lifestyle={lifestyle} fame={profile?.fame ?? 0} />

      <NutritionHydrationPanel vitals={vitals} />

      <ProfessionalSupportPanel vitals={coreVitals} fame={profile?.fame ?? 0} />

      <TimeAwayLongevityPanel vitals={vitals} fame={profile?.fame ?? 0} />

      <CareerStageLongevityPanel vitals={vitals} fame={profile?.fame ?? 0} profileAge={(profile as { age?: number } | null)?.age ?? 24} />

      {blocks.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" /> Active Blocks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {blocks.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between gap-3"
              >
                <span>{b.reason}</span>
                <span className="text-xs text-muted-foreground">
                  until{" "}
                  {new Date(b.expires_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <AilmentsPanel
        ailments={ailments}
        catalog={catalog}
        onTreat={handlePerform}
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bed className="h-4 w-4 text-primary" /> Accommodation & Travel Recovery
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Based on your current property, rental, and any active travel.
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Current accommodation</p>
            <p className="font-semibold">{accommodationProfile.name}</p>
            <p className="text-sm">
              Sleep quality {accommodationProfile.sleep_quality_modifier >= 0 ? "+" : ""}
              {accommodationProfile.sleep_quality_modifier} · Recovery {accommodationProfile.comfort_rating}/100
            </p>
            <p className="text-xs text-muted-foreground">
              {accommodationProfile.facilities.length
                ? `Facilities: ${accommodationProfile.facilities.join(", ")}`
                : "No extra facilities — consider upgrades."}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Bus className="h-3 w-3" /> Travel status
            </p>
            {travelEffect ? (
              <>
                <p className="font-semibold">Arrival readiness {travelEffect.arrivalReadiness}%</p>
                <p className="text-sm">
                  Fatigue +{travelEffect.fatigueDelta} · partial sleep {travelEffect.partialSleepHours}h
                </p>
                <p className="text-xs text-muted-foreground">{travelEffect.summary}</p>
              </>
            ) : (
              <>
                <p className="font-semibold">Not travelling</p>
                <p className="text-sm text-muted-foreground">No travel fatigue in effect.</p>
              </>
            )}
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Tonight's recovery forecast</p>
            <p className="font-semibold">Readiness {recoveryForecast.readiness}%</p>
            <p className="text-sm">
              Energy {recoveryForecast.values.energy} · Fatigue {recoveryForecast.values.fatigue} · Stress{" "}
              {recoveryForecast.values.stress}
            </p>
            <p className="text-xs text-muted-foreground">
              {recoveryForecast.readiness < 60
                ? "Low — add rest days or upgrade your accommodation."
                : "Your recovery is on track for tomorrow."}
            </p>
          </div>
        </CardContent>
      </Card>



      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-primary" /> Activities
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Daily cap: 3 actions · max 1 indulgence per day.
          </p>
        </CardHeader>
        <CardContent>
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as WellnessCategory)}
          >
            <TabsList className="grid w-full grid-cols-4">
              {CATEGORIES.map((c) => (
                <TabsTrigger
                  key={c.key}
                  value={c.key}
                  className="gap-1.5 text-xs"
                >
                  {c.icon}
                  <span className="hidden sm:inline">{c.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            {CATEGORIES.map((c) => (
              <TabsContent key={c.key} value={c.key} className="mt-4">
                <p className="mb-3 text-xs text-muted-foreground">{c.blurb}</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {grouped[c.key].map((entry) => (
                    <ActivityCard
                      key={entry.id}
                      entry={entry}
                      cooldown={cooldownMap.get(entry.slug)}
                      vitals={vitals}
                      fame={profile?.fame ?? 0}
                      performing={performing === entry.slug}
                      onPerform={handlePerform}
                    />
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default WellnessPage;
