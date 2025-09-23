import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  MapPin,
  Clock,
  Users,
  Sparkles,
  Coins,
  CloudSun,
  Gauge,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useGameData } from "@/hooks/useGameData";
import { usePlayerStatus } from "@/hooks/usePlayerStatus";
import { formatDurationMinutes, formatDurationCountdown } from "@/utils/datetime";
import { fetchEnvironmentModifiers } from "@/utils/worldEnvironment";
import { supabase } from "@/integrations/supabase/client";

type BuskingSkillKey =
  | "performance"
  | "vocals"
  | "guitar"
  | "bass"
  | "drums"
  | "songwriting";

type BuskingRiskLevel = "low" | "medium" | "high" | "extreme";

interface BuskingLocation {
  id: string;
  name: string;
  description: string;
  neighborhood: string;
  recommendedSkill: BuskingSkillKey;
  basePayout: number;
  crowdPotential: number;
  tipGenerosity: number;
  ambiance: string;
  riskLevel: BuskingRiskLevel;
}

interface BuskingDurationOption {
  value: string;
  label: string;
  minutes: number;
  baseXp: number;
  description: string;
}

interface WeatherSnapshot {
  label: string;
  description: string;
  attendanceModifier: number;
  moraleModifier: number;
}

interface TimeOfDayContext {
  label: string;
  multiplier: number;
}

interface BuskingOutcome {
  xp: number;
  watchers: number;
  earnings: number;
  durationMinutes: number;
  performanceScore: number;
  abilityScore: number;
  crowdReaction: string;
  timeOfDay: string;
  weatherDescription: string;
}

const BUSKING_DURATIONS: BuskingDurationOption[] = [
  {
    value: "30",
    label: "Quick 30 minute set",
    minutes: 30,
    baseXp: 6,
    description: "Warm up the street with a short burst of energy.",
  },
  {
    value: "60",
    label: "1 hour session",
    minutes: 60,
    baseXp: 9,
    description: "Hold the crowd for a full hour and build momentum.",
  },
  {
    value: "120",
    label: "2 hour showcase",
    minutes: 120,
    baseXp: 14,
    description: "Commit to a longer run and see who sticks around.",
  },
];

const FALLBACK_LOCATIONS: BuskingLocation[] = [
  {
    id: "fallback-market-square",
    name: "Market Square Steps",
    description: "Lunchtime shoppers mill about the central square, tossing the occasional coin.",
    neighborhood: "Downtown",
    recommendedSkill: "performance",
    basePayout: 14,
    crowdPotential: 22,
    tipGenerosity: 0.65,
    ambiance: "Sunlight filters between towers while commuters queue for food trucks.",
    riskLevel: "medium",
  },
  {
    id: "fallback-riverfront",
    name: "Riverside Promenade",
    description: "Tourists stroll slowly past cafés, pausing for mellow covers and duets.",
    neighborhood: "Harbor District",
    recommendedSkill: "vocals",
    basePayout: 18,
    crowdPotential: 28,
    tipGenerosity: 0.72,
    ambiance: "Golden reflections on the water and a salty breeze set the vibe.",
    riskLevel: "medium",
  },
  {
    id: "fallback-transit",
    name: "Subway Center Stage",
    description: "Transit tunnels create natural reverb as commuters rush by in waves.",
    neighborhood: "Transit Hub",
    recommendedSkill: "guitar",
    basePayout: 12,
    crowdPotential: 18,
    tipGenerosity: 0.58,
    ambiance: "Echoing announcements and hurried footsteps keep the pace high.",
    riskLevel: "low",
  },
];

const DEFAULT_WEATHER: WeatherSnapshot = {
  label: "Clear skies",
  description: "Mild breeze, easy listening conditions",
  attendanceModifier: 1,
  moraleModifier: 1,
};

const BUSKING_SKILL_KEYS: readonly BuskingSkillKey[] = [
  "performance",
  "vocals",
  "guitar",
  "bass",
  "drums",
  "songwriting",
];

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

const average = (values: number[]) => {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (!filtered.length) {
    return 0;
  }
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
};

const parseNumber = (value: unknown, fallback: number) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const parseSkill = (value: unknown): BuskingSkillKey => {
  if (typeof value !== "string") {
    return "performance";
  }

  const normalized = value.toLowerCase() as BuskingSkillKey;
  return BUSKING_SKILL_KEYS.includes(normalized)
    ? normalized
    : "performance";
};

const determineTimeOfDayContext = (date: Date): TimeOfDayContext => {
  const hour = date.getHours();

  if (hour >= 6 && hour < 11) {
    return { label: "Morning", multiplier: 0.85 };
  }

  if (hour >= 11 && hour < 16) {
    return { label: "Afternoon", multiplier: 1 };
  }

  if (hour >= 16 && hour < 21) {
    return { label: "Evening", multiplier: 1.15 };
  }

  return { label: "Late night", multiplier: 0.7 };
};

const computeBuskingOutcome = (
  location: BuskingLocation,
  duration: BuskingDurationOption,
  playerSkills: ReturnType<typeof useGameData>["skills"],
  playerAttributes: ReturnType<typeof useGameData>["attributes"],
  weather: WeatherSnapshot,
  timeContext: TimeOfDayContext,
): BuskingOutcome => {
  const skills = playerSkills ?? null;
  const attributes = playerAttributes ?? null;

  const baselineSkills = [
    parseNumber(skills?.performance, 32),
    parseNumber(skills?.vocals, 28),
    parseNumber(skills?.guitar, 26),
    parseNumber(skills?.bass, 24),
    parseNumber(skills?.drums, 24),
    parseNumber(skills?.songwriting, 30),
  ];

  const focusSkill = parseNumber(skills?.[location.recommendedSkill], 30);
  const averageSkill = average(baselineSkills);
  const combinedSkill = clamp(average([averageSkill * 0.6, focusSkill * 0.4]), 0, 100);
  const normalizedSkill = clamp(combinedSkill / 100, 0.05, 1);

  const attributeSamples = [
    parseNumber(attributes?.stage_presence, 5),
    parseNumber(attributes?.charisma, 5),
    parseNumber(attributes?.crowd_engagement, 5),
    parseNumber(attributes?.musicality, 5),
    parseNumber(attributes?.technical, 5),
  ];

  const attributeAverage = average(attributeSamples);
  const normalizedAttributes = clamp(attributeAverage / 20, 0.05, 1);

  const overallAbility = clamp(
    normalizedSkill * 0.65 + normalizedAttributes * 0.35,
    0.05,
    1.1,
  );

  const durationFactor = clamp(duration.minutes / 60, 0.5, 2.5);
  const weatherAttendance = clamp(weather.attendanceModifier, 0.6, 1.4);
  const weatherMorale = clamp(weather.moraleModifier, 0.6, 1.4);

  const baseCrowd = location.crowdPotential * durationFactor;
  const crowdInfluence = 0.7 + overallAbility * 0.9 + weatherMorale * 0.1;
  const randomVariance = (Math.random() - 0.4) * 4; // -1.6 to +2.4
  const watchers = Math.max(
    3,
    Math.round(
      baseCrowd * crowdInfluence * timeContext.multiplier * weatherAttendance +
        randomVariance,
    ),
  );

  const earningsBase = location.basePayout * durationFactor;
  const earnings = Math.max(
    2,
    Number(
      (
        earningsBase *
        (0.45 + overallAbility * 0.35) *
        timeContext.multiplier *
        clamp(location.tipGenerosity, 0.4, 1.1)
      ).toFixed(2),
    ),
  );

  const xpBase = duration.baseXp;
  const xpMultiplier = 0.65 + overallAbility * 0.55 + (weatherMorale - 1) * 0.25;
  const xp = Math.max(3, Math.round(xpBase * clamp(xpMultiplier, 0.5, 1.4)));

  const performanceScore = clamp(
    Math.round(
      overallAbility * 70 +
        timeContext.multiplier * 15 +
        weatherMorale * 10 +
        Math.random() * 8,
    ),
    10,
    100,
  );

  const abilityScore = Math.round(overallAbility * 100);

  const crowdReaction =
    performanceScore >= 80
      ? "Heads turned and a small crowd gathered"
      : performanceScore >= 60
      ? "A few curious listeners stuck around"
      : "Passersby nodded politely as they moved on";

  return {
    xp,
    watchers,
    earnings,
    durationMinutes: duration.minutes,
    performanceScore,
    abilityScore,
    crowdReaction,
    timeOfDay: timeContext.label,
    weatherDescription: weather.label,
  };
};

const createFallbackId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `generated-${Math.random().toString(36).slice(2, 10)}`;
};

const mapBuskingLocation = (record: Record<string, unknown>): BuskingLocation => {
  const id = typeof record.id === "string" ? record.id : `generated-${createFallbackId()}`;
  const name = typeof record.name === "string" ? record.name : "Busking Spot";
  const description =
    typeof record.description === "string"
      ? record.description
      : "Reliable foot traffic for a mellow set.";
  const neighborhood =
    typeof record.neighborhood === "string" ? record.neighborhood : "City Center";
  const recommendedSkill = parseSkill(record.recommended_skill);
  const basePayout = parseNumber(record.base_payout, 160) / 10;
  const fameReward = parseNumber(record.fame_reward, 18);
  const experienceReward = parseNumber(record.experience_reward, 50);
  const crowdPotential = Math.max(12, Math.round((fameReward + experienceReward / 4) / 1.8));
  const tipGenerosity = clamp(parseNumber(record.base_payout, 180) / 400, 0.45, 1.15);
  const ambiance =
    typeof record.ambiance === "string" ? record.ambiance : "Ambient city noise accompanies every chord.";
  const riskRaw = typeof record.risk_level === "string" ? record.risk_level.toLowerCase() : "medium";
  const riskLevel: BuskingRiskLevel = ["low", "medium", "high", "extreme"].includes(riskRaw)
    ? (riskRaw as BuskingRiskLevel)
    : "medium";

  return {
    id,
    name,
    description,
    neighborhood,
    recommendedSkill,
    basePayout,
    crowdPotential,
    tipGenerosity,
    ambiance,
    riskLevel,
  };
};

const fetchBuskingLocations = async (): Promise<BuskingLocation[]> => {
  try {
    const { data, error } = await supabase
      .from("busking_locations")
      .select("*")
      .order("experience_reward", { ascending: true })
      .limit(5);

    if (error) {
      throw error;
    }

    if (!data?.length) {
      return FALLBACK_LOCATIONS;
    }

    return data.map((entry) => mapBuskingLocation(entry as Record<string, unknown>));
  } catch (error) {
    console.warn("Failed to load busking locations", error);
    return FALLBACK_LOCATIONS;
  }
};

const fetchWeatherSnapshot = async (
  locationName: string | undefined,
): Promise<WeatherSnapshot> => {
  try {
    if (!locationName) {
      return DEFAULT_WEATHER;
    }

    const summary = await fetchEnvironmentModifiers(locationName, new Date().toISOString());
    const weatherEffect = summary.applied.find((effect) => effect.source === "weather");

    if (!weatherEffect) {
      return {
        ...DEFAULT_WEATHER,
        description: "No notable weather effects",
      };
    }

    return {
      label: weatherEffect.name,
      description: weatherEffect.description ?? "Local conditions shaping the vibe",
      attendanceModifier: weatherEffect.attendanceMultiplier ?? summary.attendanceMultiplier ?? 1,
      moraleModifier: weatherEffect.moraleModifier ?? summary.moraleModifier ?? 1,
    };
  } catch (error) {
    console.warn("Failed to load weather snapshot", error);
    return DEFAULT_WEATHER;
  }
};

export default function Busking() {
  const { toast } = useToast();
  const {
    skills,
    attributes,
    profile,
    currentCity,
    awardActionXp,
    addActivity,
  } = useGameData();
  const { activeStatus, remainingMs, startTimedStatus } = usePlayerStatus();

  const [locations, setLocations] = useState<BuskingLocation[]>(FALLBACK_LOCATIONS);
  const [selectedLocationId, setSelectedLocationId] = useState<string>(FALLBACK_LOCATIONS[0]?.id ?? "");
  const [selectedDuration, setSelectedDuration] = useState<string>(BUSKING_DURATIONS[0].value);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [isBusking, setIsBusking] = useState(false);
  const [weather, setWeather] = useState<WeatherSnapshot>(DEFAULT_WEATHER);
  const [outcome, setOutcome] = useState<BuskingOutcome | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoadingLocations(true);

    void fetchBuskingLocations().then((fetched) => {
      if (!isMounted) {
        return;
      }
      setLocations(fetched);
      if (fetched.length > 0) {
        setSelectedLocationId(fetched[0].id);
      }
      setIsLoadingLocations(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadWeather = async () => {
      const snapshot = await fetchWeatherSnapshot(currentCity?.name);
      if (isMounted) {
        setWeather(snapshot);
      }
    };

    void loadWeather();

    return () => {
      isMounted = false;
    };
  }, [currentCity?.name]);

  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === selectedLocationId) ?? null,
    [locations, selectedLocationId],
  );

  const durationOption = useMemo(
    () => BUSKING_DURATIONS.find((option) => option.value === selectedDuration) ?? BUSKING_DURATIONS[0],
    [selectedDuration],
  );

  const handleRecordSession = useCallback(
    async (computedOutcome: BuskingOutcome, location: BuskingLocation) => {
      if (!profile?.user_id) {
        return;
      }

      try {
        const { error } = await supabase.from("busking_sessions").insert({
          user_id: profile.user_id,
          location_id: location.id,
          duration_minutes: computedOutcome.durationMinutes,
          success: computedOutcome.performanceScore >= 50,
          cash_earned: Math.round(computedOutcome.earnings),
          fame_gained: Math.max(0, Math.round(computedOutcome.earnings / 4)),
          experience_gained: computedOutcome.xp,
          performance_score: Number(computedOutcome.performanceScore.toFixed(2)),
          risk_level: location.riskLevel,
          crowd_reaction: computedOutcome.crowdReaction,
          notes: `Weather: ${computedOutcome.weatherDescription} | Time: ${computedOutcome.timeOfDay}`,
        });

        if (error) {
          throw error;
        }
      } catch (error) {
        console.warn("Failed to record busking session", error);
      }
    },
    [profile?.user_id],
  );

  const handleStartBusking = useCallback(async () => {
    if (!selectedLocation) {
      toast({
        title: "Select a location",
        description: "Choose where you want to perform before starting the session.",
        variant: "destructive",
      });
      return;
    }

    if (isBusking) {
      return;
    }

    const now = new Date();
    const timeContext = determineTimeOfDayContext(now);
    const computedOutcome = computeBuskingOutcome(
      selectedLocation,
      durationOption,
      skills,
      attributes,
      weather,
      timeContext,
    );

    setIsBusking(true);
    setOutcome(computedOutcome);

    startTimedStatus({
      status: "Busking",
      durationMinutes: computedOutcome.durationMinutes,
      metadata: {
        locationId: selectedLocation.id,
        locationName: selectedLocation.name,
        duration: computedOutcome.durationMinutes,
      },
    });

    try {
      await awardActionXp({
        amount: computedOutcome.xp,
        category: "performance",
        actionKey: "busking_session",
        metadata: {
          location: selectedLocation.name,
          duration: computedOutcome.durationMinutes,
          watchers: computedOutcome.watchers,
          weather: computedOutcome.weatherDescription,
          timeOfDay: computedOutcome.timeOfDay,
        },
      });
    } catch (error) {
      console.warn("Failed to award busking XP", error);
      toast({
        title: "Experience not awarded",
        description: "We couldn't register the XP gain with the server.",
        variant: "destructive",
      });
    }

    try {
      await addActivity(
        "busking_session",
        `Busked at ${selectedLocation.name}`,
        Math.round(computedOutcome.earnings),
        {
          watchers: computedOutcome.watchers,
          xp: computedOutcome.xp,
          weather: computedOutcome.weatherDescription,
          timeOfDay: computedOutcome.timeOfDay,
          abilityScore: computedOutcome.abilityScore,
        },
        { status: "Busking", durationMinutes: computedOutcome.durationMinutes },
      );
    } catch (error) {
      console.warn("Failed to log busking activity", error);
    }

    await handleRecordSession(computedOutcome, selectedLocation);

    toast({
      title: "Busking session complete",
      description: `You entertained ${computedOutcome.watchers} listeners and earned ${computedOutcome.xp} XP.`,
    });

    setIsBusking(false);
  }, [
    selectedLocation,
    durationOption,
    skills,
    attributes,
    weather,
    awardActionXp,
    addActivity,
    handleRecordSession,
    startTimedStatus,
    toast,
    isBusking,
  ]);

  return (
    <div className="container mx-auto flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Street Busking</h1>
        <p className="text-muted-foreground">
          Pick a corner, gauge the vibe, and play your heart out. Busking pays modestly but
          keeps your performance chops sharp and your name buzzing.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Select your setup</CardTitle>
            <CardDescription>
              Choose a location and commitment. Weather and time of day influence how many passersby stop to listen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm font-medium">Location</div>
                <Select value={selectedLocationId} onValueChange={setSelectedLocationId} disabled={isLoadingLocations}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedLocation ? (
                  <div className="rounded-lg border bg-muted/40 p-4 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium">{selectedLocation.name}</div>
                      <Badge variant="secondary" className="text-xs capitalize">
                        {selectedLocation.riskLevel} risk
                      </Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground">{selectedLocation.description}</p>
                    <Separator className="my-3" />
                    <div className="grid gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedLocation.neighborhood}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-muted-foreground" />
                        <span>Shines with <span className="font-medium capitalize">{selectedLocation.recommendedSkill}</span> skill</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>Steady foot traffic • ambiance: {selectedLocation.ambiance}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Select a location to view details.</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Session length</div>
                <Select value={selectedDuration} onValueChange={setSelectedDuration}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSKING_DURATIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="rounded-lg border bg-muted/40 p-4 text-sm">
                  <div className="font-medium">{durationOption.label}</div>
                  <p className="mt-1 text-muted-foreground">{durationOption.description}</p>
                  <Separator className="my-3" />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{formatDurationMinutes(durationOption.minutes)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-start gap-3 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <CloudSun className="h-4 w-4 text-muted-foreground" />
                    Local conditions
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{weather.label}</div>
                    <p className="text-xs text-muted-foreground">{weather.description}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Attendance ×{weather.attendanceModifier.toFixed(2)}
                  </Badge>
                </CardContent>
              </Card>
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-start gap-3 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Right now
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{determineTimeOfDayContext(new Date()).label}</div>
                    <p className="text-xs text-muted-foreground">Crowd mood shifts with the time of day.</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Multiplier ×{determineTimeOfDayContext(new Date()).multiplier.toFixed(2)}
                  </Badge>
                </CardContent>
              </Card>
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-start gap-3 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Gauge className="h-4 w-4 text-muted-foreground" />
                    Overall readiness
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{outcome ? `${outcome.abilityScore}%` : "Calibrating"}</div>
                    <p className="text-xs text-muted-foreground">Blend of skills, attributes, and street confidence.</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Performance focus on {selectedLocation?.recommendedSkill ?? "performance"}
                  </Badge>
                </CardContent>
              </Card>
            </div>

            <Button onClick={handleStartBusking} disabled={isBusking || !selectedLocation} className="w-full sm:w-auto">
              {isBusking ? "Calculating session..." : "Start busking"}
            </Button>

            {activeStatus?.status === "Busking" && (
              <div className="rounded-lg border border-dashed bg-muted/40 p-4 text-sm">
                <div className="font-medium">Busking session running</div>
                <p className="text-muted-foreground">
                  {remainingMs > 0
                    ? `Roughly ${formatDurationCountdown(remainingMs)} remaining in your current session.`
                    : "Wrap-up just about finished."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Session summary</CardTitle>
            <CardDescription>
              Modest payouts, tiny fame bumps, and a little experience keep you growing steady.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {outcome ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 p-4">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Listeners gathered</div>
                      <div className="text-2xl font-semibold">{outcome.watchers}</div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {outcome.timeOfDay}
                  </Badge>
                </div>

                <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 p-4">
                  <div className="flex items-center gap-3">
                    <Coins className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Tips collected</div>
                      <div className="text-2xl font-semibold">${outcome.earnings.toFixed(2)}</div>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Modest haul
                  </Badge>
                </div>

                <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 p-4">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Experience earned</div>
                      <div className="text-2xl font-semibold">{outcome.xp} XP</div>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Weather: {outcome.weatherDescription}
                  </Badge>
                </div>

                <div className="rounded-lg border p-4 text-sm">
                  <div className="font-medium">Crowd reaction</div>
                  <p className="mt-1 text-muted-foreground">{outcome.crowdReaction}</p>
                  <Separator className="my-3" />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Gauge className="h-4 w-4" />
                    <span>Performance score: {outcome.performanceScore}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                You haven't busked yet today. Pick a location and length to see your street performance impact.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

