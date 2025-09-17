import { useCallback, useEffect, useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { calculateAttributeMultiplier, type AttributeKey } from "@/utils/attributeProgression";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { fetchWorldEnvironmentSnapshot, type WeatherCondition } from "@/utils/worldEnvironment";
import { calculateFanGain, calculateGigPayment, type PerformanceAttributeBonuses } from "@/utils/gameBalance";
import { resolveAttributeValue } from "@/utils/attributeModifiers";
import {
  Activity,
  Award,
  Cloud,
  CloudLightning,
  CloudRain,
  CloudSun,
  Clock,
  Coins,
  Flame,
  Gauge,
  History,
  Loader2,
  MapPin,
  Mic,
  MoonStar,
  ShieldAlert,
  Snowflake,
  Sun,
  SparklesIcon,
  TrendingUp,
} from "lucide-react";

type BuskingLocation = Tables<"busking_locations">;
type BuskingModifier = Tables<"busking_modifiers">;
type BuskingSession = Tables<"busking_sessions">;
type PlayerAttributes = Tables<"player_attributes">;

type BuskingSessionWithRelations = BuskingSession & {
  busking_locations: BuskingLocation | null;
  busking_modifiers: BuskingModifier | null;
};

type RiskLevel = "low" | "medium" | "high" | "extreme";
type ModifierRarity = "common" | "uncommon" | "rare" | "legendary";

interface BuskingResult {
  success: boolean;
  cash: number;
  fame: number;
  experience: number;
  performanceScore: number;
  message: string;
  crowdReaction: string;
  locationName: string;
  modifierName: string;
  environmentSummary: {
    successAdjustment: number;
    successMultiplier: number;
    payoutMultiplier: number;
    fameMultiplier: number;
    experienceMultiplier: number;
    timeOfDay: string;
    daySegment: string;
    weatherLabel?: string;
  };
}

const fallbackTimestamp = "1970-01-01T00:00:00.000Z";

const fallbackLocations: BuskingLocation[] = [
  {
    id: "fallback-offices",
    name: "Near Local Offices",
    description: "Weekday lunch crowd of office workers eager for quick hits and covers.",
    neighborhood: "Financial Commons",
    recommended_skill: 50,
    base_payout: 180,
    fame_reward: 10,
    experience_reward: 48,
    risk_level: "medium",
    ambiance: "Clockwork foot traffic surges at noon while security keeps an eye out.",
    cooldown_minutes: 50,
    created_at: fallbackTimestamp,
  },
  {
    id: "fallback-town-center",
    name: "Town Center",
    description: "Central plaza with families, tourists, and street food all afternoon.",
    neighborhood: "Civic Plaza",
    recommended_skill: 65,
    base_payout: 260,
    fame_reward: 16,
    experience_reward: 68,
    risk_level: "medium",
    ambiance: "Community events keep energy steady with occasional festival spikes.",
    cooldown_minutes: 70,
    created_at: fallbackTimestamp,
  },
  {
    id: "fallback-high-street",
    name: "High Street",
    description: "Premier shopping strip packed with trendsetters and impulse tippers.",
    neighborhood: "Retail Row",
    recommended_skill: 75,
    base_payout: 360,
    fame_reward: 22,
    experience_reward: 85,
    risk_level: "high",
    ambiance: "Boutique launches and brand pop-ups make for fierce competition.",
    cooldown_minutes: 85,
    created_at: fallbackTimestamp,
  },
  {
    id: "fallback-subway",
    name: "Subway Center Stage",
    description: "A bustling underground transit hub with great acoustics.",
    neighborhood: "Downtown Transit Plaza",
    recommended_skill: 45,
    base_payout: 140,
    fame_reward: 8,
    experience_reward: 40,
    risk_level: "low",
    ambiance: "Echoing tunnels amplify your sound, commuters pass by quickly.",
    cooldown_minutes: 45,
    created_at: fallbackTimestamp,
  },
  {
    id: "fallback-riverside",
    name: "Riverside Boardwalk",
    description: "Open-air walkway beside the river, popular during sunsets.",
    neighborhood: "Harbor District",
    recommended_skill: 60,
    base_payout: 220,
    fame_reward: 12,
    experience_reward: 55,
    risk_level: "medium",
    ambiance: "Tourists stroll slowly, perfect for ballads and duets.",
    cooldown_minutes: 60,
    created_at: fallbackTimestamp,
  },
  {
    id: "fallback-market",
    name: "Night Market Spotlight",
    description: "Energetic evening market with vibrant crowds.",
    neighborhood: "Old Town Bazaar",
    recommended_skill: 70,
    base_payout: 320,
    fame_reward: 18,
    experience_reward: 75,
    risk_level: "high",
    ambiance: "Vendors cheer you on but noise levels spike unpredictably.",
    cooldown_minutes: 75,
    created_at: fallbackTimestamp,
  },
  {
    id: "fallback-skyline",
    name: "Skyline Overlook",
    description: "Scenic rooftop park visited by influencers and vloggers.",
    neighborhood: "Skyline Heights",
    recommended_skill: 80,
    base_payout: 420,
    fame_reward: 24,
    experience_reward: 90,
    risk_level: "high",
    ambiance: "Stunning views attract attention but the wind can be unforgiving.",
    cooldown_minutes: 90,
    created_at: fallbackTimestamp,
  },
  {
    id: "fallback-festival",
    name: "Festival Pop-Up Stage",
    description: "Temporary stage during seasonal festivals, massive foot traffic.",
    neighborhood: "Festival Grounds",
    recommended_skill: 85,
    base_payout: 520,
    fame_reward: 30,
    experience_reward: 120,
    risk_level: "extreme",
    ambiance: "Crowd is massive but expectations are sky high.",
    cooldown_minutes: 120,
    created_at: fallbackTimestamp,
  },
];

const locationAudienceHighlights: Record<
  string,
  {
    label: string;
    description: string;
  }
> = {
  "Near Local Offices": {
    label: "Workday Crowd",
    description: "Lunch breaks surge from 11:30 to 2:00—arrive early to lock the spot.",
  },
  "Town Center": {
    label: "Community Mix",
    description: "Families and tourists linger for sing-alongs and upbeat covers.",
  },
  "High Street": {
    label: "Retail Rush",
    description: "Peak shoppers chase hype tracks and big hooks during evening hours.",
  },
};

const fallbackModifiers: BuskingModifier[] = [
  {
    id: "fallback-none",
    name: "Acoustic Purist",
    description: "Rely on pure skill with no backing tracks. Higher respect, lower cushion.",
    rarity: "common",
    payout_multiplier: 1.1,
    fame_multiplier: 1.05,
    experience_bonus: 10,
    risk_modifier: 0.15,
    created_at: fallbackTimestamp,
  },
  {
    id: "fallback-hype",
    name: "Crowd Hype Crew",
    description: "Friends warm up the crowd before you play.",
    rarity: "uncommon",
    payout_multiplier: 1.25,
    fame_multiplier: 1.3,
    experience_bonus: 20,
    risk_modifier: -0.1,
    created_at: fallbackTimestamp,
  },
  {
    id: "fallback-merch",
    name: "Merch Table Setup",
    description: "Sell limited-run merch while performing.",
    rarity: "rare",
    payout_multiplier: 1.45,
    fame_multiplier: 1.1,
    experience_bonus: 25,
    risk_modifier: 0.05,
    created_at: fallbackTimestamp,
  },
  {
    id: "fallback-permit",
    name: "City Permit Spotlight",
    description: "Officially sanctioned performance spot with city promotion.",
    rarity: "rare",
    payout_multiplier: 1.6,
    fame_multiplier: 1.45,
    experience_bonus: 35,
    risk_modifier: -0.05,
    created_at: fallbackTimestamp,
  },
  {
    id: "fallback-viral",
    name: "Viral Stream Collab",
    description: "Livestream collaboration with a popular influencer.",
    rarity: "legendary",
    payout_multiplier: 1.9,
    fame_multiplier: 1.8,
    experience_bonus: 40,
    risk_modifier: 0.2,
    created_at: fallbackTimestamp,
  },
];

const riskBadgeClasses: Record<RiskLevel, string> = {
  low: "bg-success/10 text-success border-success/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  high: "bg-destructive/10 text-destructive border-destructive/30",
  extreme: "bg-destructive/20 text-destructive border-destructive/40",
};

const riskPercentMap: Record<RiskLevel, number> = {
  low: 30,
  medium: 55,
  high: 75,
  extreme: 90,
};

type TimeOfDayKey = "morning" | "afternoon" | "evening" | "lateNight";
type DaySegmentKey = "weekday" | "friday" | "weekend";

interface TimeOfDayImpact {
  label: string;
  description: string;
  success: number;
  payout: number;
  fame: number;
  experience: number;
  accent: string;
}

interface DaySegmentImpact {
  label: string;
  description: string;
  success: number;
  payout: number;
  fame: number;
  experience: number;
  accent: string;
}

type WeatherMatchConfidence = "exact" | "partial" | "fallback" | "none";

const TIME_OF_DAY_EFFECTS: Record<TimeOfDayKey, TimeOfDayImpact> = {
  morning: {
    label: "Morning Rush",
    description: "Commuters hustle past before work, tips are lighter but practice is solid.",
    success: -4,
    payout: 0.92,
    fame: 0.95,
    experience: 1.05,
    accent: "text-amber-500",
  },
  afternoon: {
    label: "Midday Flow",
    description: "Lunch crowds give a balanced vibe with steady attention.",
    success: 0,
    payout: 1,
    fame: 1,
    experience: 1,
    accent: "text-primary",
  },
  evening: {
    label: "Golden Hour",
    description: "Tourists linger and date night energy boosts engagement.",
    success: 6,
    payout: 1.15,
    fame: 1.1,
    experience: 1.05,
    accent: "text-orange-500",
  },
  lateNight: {
    label: "Late Night Vibes",
    description: "Night owls stay generous but the crowd thins out.",
    success: -2,
    payout: 1.05,
    fame: 1.08,
    experience: 1.02,
    accent: "text-indigo-400",
  },
};

const DAY_SEGMENT_EFFECTS: Record<DaySegmentKey, DaySegmentImpact> = {
  weekday: {
    label: "Weekday Flow",
    description: "Locals provide consistent foot traffic and measured tips.",
    success: 0,
    payout: 1,
    fame: 1,
    experience: 1,
    accent: "text-muted-foreground",
  },
  friday: {
    label: "Friday Buzz",
    description: "Weekend anticipation brings livelier, spend-happy listeners.",
    success: 3,
    payout: 1.1,
    fame: 1.12,
    experience: 1.05,
    accent: "text-warning",
  },
  weekend: {
    label: "Weekend Rush",
    description: "Tourists and relaxed locals mean bigger crowds and payouts.",
    success: 5,
    payout: 1.2,
    fame: 1.18,
    experience: 1.1,
    accent: "text-success",
  },
};

const WEATHER_CONFIDENCE_TEXT: Record<Exclude<WeatherMatchConfidence, "none">, string> = {
  exact: "Direct city match",
  partial: "Nearby conditions",
  fallback: "Closest available data",
};

const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const formatSignedNumber = (value: number, digits = 0) => `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;

const getTimeOfDayKey = (date: Date): TimeOfDayKey => {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) {
    return "morning";
  }
  if (hour >= 11 && hour < 17) {
    return "afternoon";
  }
  if (hour >= 17 && hour < 22) {
    return "evening";
  }
  return "lateNight";
};

const getDaySegmentKey = (date: Date): DaySegmentKey => {
  const day = date.getDay();
  if (day === 5) {
    return "friday";
  }
  if (day === 0 || day === 6) {
    return "weekend";
  }
  return "weekday";
};

const findWeatherForLocation = (
  weatherList: WeatherCondition[],
  candidates: string[],
): { weather: WeatherCondition | null; confidence: WeatherMatchConfidence } => {
  if (!weatherList.length) {
    return { weather: null, confidence: "none" };
  }

  const normalizedCandidates = candidates
    .map((value) => (typeof value === "string" ? value.toLowerCase().trim() : ""))
    .filter(Boolean);

  if (!normalizedCandidates.length) {
    return { weather: weatherList[0], confidence: "fallback" };
  }

  const exactMatch = weatherList.find((condition) => {
    const city = condition.city.toLowerCase().trim();
    return normalizedCandidates.some((candidate) => candidate === city);
  });

  if (exactMatch) {
    return { weather: exactMatch, confidence: "exact" };
  }

  const partialMatch = weatherList.find((condition) => {
    const city = condition.city.toLowerCase().trim();
    return normalizedCandidates.some(
      (candidate) => city.includes(candidate) || candidate.includes(city),
    );
  });

  if (partialMatch) {
    return { weather: partialMatch, confidence: "partial" };
  }

  return { weather: weatherList[0], confidence: "fallback" };
};

const capitalize = (value: string) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : "");

const getWeatherIcon = (condition: WeatherCondition["condition"]) => {
  switch (condition) {
    case "sunny":
      return Sun;
    case "cloudy":
      return Cloud;
    case "rainy":
      return CloudRain;
    case "stormy":
      return CloudLightning;
    case "snowy":
      return Snowflake;
    default:
      return CloudSun;
  }
};

const getTimeOfDayIcon = (key: TimeOfDayKey) => {
  switch (key) {
    case "evening":
      return CloudSun;
    case "lateNight":
      return MoonStar;
    default:
      return Sun;
  }
};

const riskDescriptionMap: Record<RiskLevel, string> = {
  low: "Gentle crowds with forgiving expectations.",
  medium: "Balanced foot traffic with moderate stakes.",
  high: "Loud, energetic spaces where mistakes echo.",
  extreme: "High-stakes spotlight with viral potential.",
};

const riskPenaltyWeights: Record<RiskLevel, number> = {
  low: 8,
  medium: 15,
  high: 24,
  extreme: 32,
};

const rarityBadgeClasses: Record<ModifierRarity, string> = {
  common: "bg-muted text-muted-foreground border-border",
  uncommon: "bg-primary/10 text-primary border-primary/20",
  rare: "bg-accent/10 text-accent border-accent/20",
  legendary: "bg-warning/15 text-warning border-warning/20",
};

const modifierDescriptions: Record<ModifierRarity, string> = {
  common: "Reliable boosts that keep the groove steady.",
  uncommon: "Notable upgrades that sway the crowd your way.",
  rare: "Significant perks that unlock new earnings tiers.",
  legendary: "Game-changing effects for headline moments.",
};

const toRiskLevel = (value: string | null | undefined): RiskLevel => {
  switch (value) {
    case "low":
    case "medium":
    case "high":
    case "extreme":
      return value;
    default:
      return "medium";
  }
};

const toRarity = (value: string | null | undefined): ModifierRarity => {
  switch (value) {
    case "common":
    case "uncommon":
    case "rare":
    case "legendary":
      return value;
    default:
      return "common";
  }
};

const BUSKING_ATTRIBUTE_KEYS: AttributeKey[] = [
  "stage_presence",
  "musical_ability",
  "vocal_talent"
];

const Busking = () => {
  const { user, loading: authLoading } = useAuth();
  const { profile, skills, attributes, updateProfile, addActivity, loading: gameLoading, currentCity } = useGameData();
  const { toast } = useToast();
  const [locations, setLocations] = useState<BuskingLocation[]>([]);
  const [modifiers, setModifiers] = useState<BuskingModifier[]>([]);
  const [history, setHistory] = useState<BuskingSessionWithRelations[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [selectedModifierId, setSelectedModifierId] = useState<string>("none");
  const [isLoading, setIsLoading] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BuskingResult | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [weatherConditions, setWeatherConditions] = useState<WeatherCondition[]>([]);
  const [environmentLoading, setEnvironmentLoading] = useState(true);
  const [environmentError, setEnvironmentError] = useState<string | null>(null);
  const [attributes, setAttributes] = useState<PlayerAttributes | null>(null);
  const attributeBonuses = useMemo<PerformanceAttributeBonuses>(() => {
    const source = attributes as unknown as Record<string, unknown> | null;
    return {
      stagePresence: resolveAttributeValue(source, "stage_presence", 1),
      crowdEngagement: resolveAttributeValue(source, "crowd_engagement", 1),
      socialReach: resolveAttributeValue(source, "social_reach", 1),
    };
  }, [attributes]);

  const cityBuskingValue = useMemo(() => {
    if (!currentCity) return 1;
    const numericValue = Number(currentCity.busking_value ?? 1);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return 1;
    }
    return numericValue;
  }, [currentCity]);

  const buskingBoostLabel = useMemo(
    () =>
      cityBuskingValue.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [cityBuskingValue]
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadEnvironment = async () => {
      try {
        setEnvironmentLoading(true);
        const snapshot = await fetchWorldEnvironmentSnapshot();
        if (!isMounted) return;
        setWeatherConditions(snapshot.weather ?? []);
        setEnvironmentError(null);
      } catch (err) {
        console.error("Failed to load world environment", err);
        if (isMounted) {
          setEnvironmentError("Live environment data is temporarily unavailable. Using neutral modifiers.");
          setWeatherConditions([]);
        }
      } finally {
        if (isMounted) {
          setEnvironmentLoading(false);
        }
      }
    };

    loadEnvironment();
    const refreshInterval = setInterval(loadEnvironment, 5 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(refreshInterval);
    };
  }, []);

  const fetchBuskingData = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const [locationResponse, modifierResponse, historyResponse] = await Promise.all([
        supabase.from("busking_locations").select("*").order("base_payout", { ascending: true }),
        supabase.from("busking_modifiers").select("*").order("payout_multiplier", { ascending: true }),
        supabase
          .from("busking_sessions")
          .select(
            `*,
            busking_locations:busking_locations!busking_sessions_location_id_fkey(*),
            busking_modifiers:busking_modifiers!busking_sessions_modifier_id_fkey(*)
          `
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(12),
      ]);

      if (locationResponse.error) throw locationResponse.error;
      if (modifierResponse.error) throw modifierResponse.error;
      if (historyResponse.error) throw historyResponse.error;

      const fetchedLocations =
        locationResponse.data && locationResponse.data.length > 0
          ? (locationResponse.data as BuskingLocation[])
          : fallbackLocations;
      const fetchedModifiers =
        modifierResponse.data && modifierResponse.data.length > 0
          ? (modifierResponse.data as BuskingModifier[])
          : fallbackModifiers;
      const fetchedHistory = (historyResponse.data as BuskingSessionWithRelations[]) ?? [];

      setLocations(fetchedLocations);
      setModifiers(fetchedModifiers);
      setHistory(fetchedHistory);

      if (fetchedLocations.length > 0) {
        setSelectedLocationId((current) => current || fetchedLocations[0].id);
      } else {
        setSelectedLocationId("");
      }
    } catch (err) {
      console.error("Failed to load busking data", err);
      setError("We couldn't load the busking data. Try again shortly.");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchBuskingData();
  }, [fetchBuskingData]);

  useEffect(() => {
    if (!user || !selectedCharacterId) {
      setAttributes(null);
      return;
    }

    let isMounted = true;

    const loadAttributes = async () => {
      const { data, error } = await supabase
        .from("player_attributes")
        .select("*")
        .eq("profile_id", selectedCharacterId)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      if (error) {
        console.error("Failed to load player attributes:", error);
        setAttributes(null);
        return;
      }

      setAttributes(data ?? null);
    };

    void loadAttributes();

    return () => {
      isMounted = false;
    };
  }, [selectedCharacterId, user]);

  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === selectedLocationId) ?? null,
    [locations, selectedLocationId]
  );

  const selectedModifier = useMemo(() => {
    if (selectedModifierId === "none") return null;
    return modifiers.find((modifier) => modifier.id === selectedModifierId) ?? null;
  }, [modifiers, selectedModifierId]);

  const skillScore = useMemo(() => {
    const performance = skills?.performance ?? 55;
    const vocals = skills?.vocals ?? 50;
    const guitar = skills?.guitar ?? 45;
    const creativity = (attributes?.creativity ?? 500) / 10;
    return Math.round((performance * 0.4 + vocals * 0.25 + guitar * 0.2 + creativity * 0.15) || 0);
  }, [attributes, skills]);

  const riskLevel = toRiskLevel(selectedLocation?.risk_level);
  const riskPercent = riskPercentMap[riskLevel];
  const riskDescription = riskDescriptionMap[riskLevel];

  const environmentDetails = useMemo(() => {
    const currentDate = new Date(now);
    const timeOfDayKey = getTimeOfDayKey(currentDate);
    const daySegmentKey = getDaySegmentKey(currentDate);
    const timeOfDay = TIME_OF_DAY_EFFECTS[timeOfDayKey];
    const daySegment = DAY_SEGMENT_EFFECTS[daySegmentKey];

    const candidates = [selectedLocation?.neighborhood ?? "", selectedLocation?.name ?? ""];
    const { weather: matchedWeather, confidence } = findWeatherForLocation(weatherConditions, candidates);

    const attendanceEffect = matchedWeather?.effects.gig_attendance ?? 1;
    const moodEffect = matchedWeather?.effects.mood_modifier ?? 1;

    const successMultiplier = clampNumber(1 + (attendanceEffect - 1) * 0.6, 0.7, 1.4);
    const payoutMultiplier = clampNumber(attendanceEffect, 0.6, 1.6);
    const fameMultiplier = clampNumber(moodEffect, 0.7, 1.5);
    const experienceMultiplier = clampNumber(1 + (moodEffect - 1) * 0.5, 0.8, 1.3);

    return {
      contextDate: currentDate,
      dayName: format(currentDate, "EEEE"),
      timeLabel: format(currentDate, "h:mm a"),
      timeOfDayKey,
      daySegmentKey,
      timeOfDay,
      daySegment,
      weather: matchedWeather,
      weatherConfidence: matchedWeather ? confidence : ("none" as WeatherMatchConfidence),
      weatherMultipliers: {
        successMultiplier,
        payoutMultiplier,
        fameMultiplier,
        experienceMultiplier,
      },
      combined: {
        successAdjustment: timeOfDay.success + daySegment.success,
        successMultiplier,
        payoutMultiplier: timeOfDay.payout * daySegment.payout * payoutMultiplier,
        fameMultiplier: timeOfDay.fame * daySegment.fame * fameMultiplier,
        experienceMultiplier: timeOfDay.experience * daySegment.experience * experienceMultiplier,
      },
    };
  }, [now, selectedLocation, weatherConditions]);

  const successChance = useMemo(() => {
    if (!selectedLocation) return 0;
    const baseChance = 58 + (skillScore - selectedLocation.recommended_skill) * 0.7;
    const riskPenalty = riskPenaltyWeights[toRiskLevel(selectedLocation.risk_level)];
    const modifierRisk = selectedModifier ? selectedModifier.risk_modifier * 100 : 0;
    const withEnvironment = baseChance - riskPenalty - modifierRisk + environmentDetails.combined.successAdjustment;
    const normalized = Math.max(5, withEnvironment);
    const adjusted = normalized * environmentDetails.combined.successMultiplier;
    return Math.min(95, Math.max(10, Math.round(adjusted)));
  }, [selectedLocation, selectedModifier, skillScore, environmentDetails]);

  const expectedCash = useMemo(() => {
    if (!selectedLocation) return 0;
    const modifierMultiplier = selectedModifier?.payout_multiplier ?? 1;
    const environmentMultiplier = environmentDetails.combined.payoutMultiplier;
    const expectancy = successChance / 100;
    const baseEstimate = Math.max(
      0,
      Math.round(
        selectedLocation.base_payout * modifierMultiplier * environmentMultiplier * (0.4 + expectancy),
      ),
    );

    const baselinePayment = calculateGigPayment(
      selectedLocation.base_payout,
      skills?.performance ?? 0,
      profile?.fame ?? 0,
      expectancy,
    );

    const adjustedPayment = calculateGigPayment(
      selectedLocation.base_payout,
      skills?.performance ?? 0,
      profile?.fame ?? 0,
      expectancy,
      attributeBonuses,
    );

    const payoutAdjustment = baselinePayment > 0 ? adjustedPayment / baselinePayment : 1;
    return Math.max(0, Math.round(baseEstimate * payoutAdjustment));
  }, [
    selectedLocation,
    selectedModifier,
    successChance,
    environmentDetails,
    skills,
    profile,
    attributeBonuses,
  ]);

  const expectedFame = useMemo(() => {
    if (!selectedLocation) return 0;
    const modifierMultiplier = selectedModifier?.fame_multiplier ?? 1;
    const environmentMultiplier = environmentDetails.combined.fameMultiplier;
    const expectancy = successChance / 100;
    const baseEstimate = Math.max(
      0,
      Math.round(
        selectedLocation.fame_reward * modifierMultiplier * environmentMultiplier * (0.5 + expectancy * 0.5),
      ),
    );

    const baselineFanGain = calculateFanGain(
      selectedLocation.fame_reward,
      skills?.performance ?? 0,
      skills?.vocals ?? 0,
    );
    const adjustedFanGain = calculateFanGain(
      selectedLocation.fame_reward,
      skills?.performance ?? 0,
      skills?.vocals ?? 0,
      attributeBonuses,
    );
    const fameAdjustment = baselineFanGain > 0 ? adjustedFanGain / baselineFanGain : 1;

    return Math.max(0, Math.round(baseEstimate * fameAdjustment));
  }, [
    selectedLocation,
    selectedModifier,
    successChance,
    environmentDetails,
    skills,
    attributeBonuses,
  ]);

  const expectedExperience = useMemo(() => {
    if (!selectedLocation) return 0;
    const modifierBonus = selectedModifier?.experience_bonus ?? 0;
    const environmentMultiplier = environmentDetails.combined.experienceMultiplier;
    const expectancy = successChance / 100;
    return Math.max(
      0,
      Math.round(
        (selectedLocation.experience_reward + modifierBonus) * environmentMultiplier * (0.6 + expectancy * 0.4),
      ),
    );
  }, [selectedLocation, selectedModifier, successChance, environmentDetails]);

  const WeatherIcon = environmentDetails.weather
    ? getWeatherIcon(environmentDetails.weather.condition)
    : CloudSun;
  const TimeOfDayIcon = getTimeOfDayIcon(environmentDetails.timeOfDayKey);
  const weatherConfidenceLabel =
    environmentDetails.weather && environmentDetails.weatherConfidence !== "none"
      ? WEATHER_CONFIDENCE_TEXT[environmentDetails.weatherConfidence]
      : null;
  const dateLabel = format(environmentDetails.contextDate, "MMM d, yyyy");
  const environmentWeatherLabel = environmentDetails.weather
    ? `${capitalize(environmentDetails.weather.condition)} ${Math.round(environmentDetails.weather.temperature)}°C`
    : "Neutral conditions";
  const environmentWeatherLocation = environmentDetails.weather
    ? `${environmentDetails.weather.city}${environmentDetails.weather.country ? `, ${environmentDetails.weather.country}` : ""}`
    : null;
  const locationSummary = selectedLocation
    ? `${selectedLocation.name}${selectedLocation.neighborhood ? ` • ${selectedLocation.neighborhood}` : ""}`
    : "your next performance";
  const successAdditiveLabel = formatSignedNumber(environmentDetails.combined.successAdjustment);
  const successMultiplierLabel = environmentDetails.combined.successMultiplier !== 1
    ? `×${environmentDetails.combined.successMultiplier.toFixed(2)}`
    : "×1.00";
  const payoutMultiplierLabel = environmentDetails.combined.payoutMultiplier.toFixed(2);
  const fameMultiplierLabel = environmentDetails.combined.fameMultiplier.toFixed(2);
  const experienceMultiplierLabel = environmentDetails.combined.experienceMultiplier.toFixed(2);

  const maxBasePayout = useMemo(() => Math.max(1, ...locations.map((location) => location.base_payout ?? 0)), [locations]);

  const lastSessionForLocation = useCallback(
    (locationId: string) => history.find((session) => session.location_id === locationId) ?? null,
    [history]
  );

  const cooldownRemainingMs = useCallback(
    (location: BuskingLocation | null) => {
      if (!location) return 0;
      const recent = lastSessionForLocation(location.id);
      if (!recent) return 0;
      const totalCooldown = (location.cooldown_minutes ?? 0) * 60 * 1000;
      if (totalCooldown <= 0) return 0;
      const lastPlayed = new Date(recent.created_at).getTime();
      const availableAt = lastPlayed + totalCooldown;
      return Math.max(0, availableAt - now);
    },
    [lastSessionForLocation, now]
  );

  const selectedCooldownMs = cooldownRemainingMs(selectedLocation);

  const formatCooldown = (ms: number) => {
    if (ms <= 0) return "Ready";
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
    }
    return `${seconds}s`;
  };

  const handleStartBusking = async () => {
    if (!user || !profile || !selectedLocation) {
      toast({
        variant: "destructive",
        title: "Missing data",
        description: "We need your profile, skills, and a location before you can busk.",
      });
      return;
    }

    if (selectedCooldownMs > 0) {
      toast({
        variant: "destructive",
        title: "Location cooling down",
        description: "Give the crowd a breather before playing here again.",
      });
      return;
    }

    try {
      setIsSimulating(true);
      setError(null);

      const modifier = selectedModifier;
      const modifierName = modifier ? modifier.name : "No Modifier";
      const cityName = currentCity?.name;
      const cityMultiplier = cityBuskingValue;
      const performanceVariance = Math.random() * 12 - 6;
      const performanceScore = Math.min(100, Math.max(15, successChance + performanceVariance));
      const roll = Math.random() * 100;
      const success = roll <= successChance;

      const baseCash = selectedLocation.base_payout;
      const successRatio = successChance / 100;
      const combinedPayoutMultiplier =
        (modifier?.payout_multiplier ?? 1) * environmentDetails.combined.payoutMultiplier;

      const baselineGigPayment = calculateGigPayment(
        baseCash,
        skills?.performance ?? 0,
        profile.fame ?? 0,
        successRatio,
      );
      const adjustedGigPayment = calculateGigPayment(
        baseCash,
        skills?.performance ?? 0,
        profile.fame ?? 0,
        successRatio,
        attributeBonuses,
      );
      const payoutAdjustment = baselineGigPayment > 0 ? adjustedGigPayment / baselineGigPayment : 1;

      const cashEarned = success
        ? Math.round(
          baseCash * combinedPayoutMultiplier * (0.85 + Math.random() * 0.6) * payoutAdjustment,
        )
        : Math.round(
          baseCash * 0.25 * combinedPayoutMultiplier * (0.7 + Math.random() * 0.4) * payoutAdjustment,
        );

      const baseFame = selectedLocation.fame_reward;
      const combinedFameMultiplier =
        (modifier?.fame_multiplier ?? 1) * environmentDetails.combined.fameMultiplier;

      const baselineFanGain = calculateFanGain(
        baseFame,
        skills?.performance ?? 0,
        skills?.vocals ?? 0,
      );
      const adjustedFanGain = calculateFanGain(
        baseFame,
        skills?.performance ?? 0,
        skills?.vocals ?? 0,
        attributeBonuses,
      );
      const fameAdjustment = baselineFanGain > 0 ? adjustedFanGain / baselineFanGain : 1;

      const fameGained = success
        ? Math.round(
          baseFame * combinedFameMultiplier * (0.9 + Math.random() * 0.4) * fameAdjustment,
        )
        : Math.round(
          baseFame * 0.4 * combinedFameMultiplier * (0.6 + Math.random() * 0.3) * fameAdjustment,
        );

      const baseExperience =
        (selectedLocation.experience_reward + (modifier?.experience_bonus ?? 0)) *
        environmentDetails.combined.experienceMultiplier;
      const attributeMultiplier = calculateAttributeMultiplier(attributes, BUSKING_ATTRIBUTE_KEYS).multiplier;
      const successVariance = 0.9 + Math.random() * 0.5;
      const failureVariance = 0.7 + Math.random() * 0.3;
      const experienceGained = success
        ? Math.round(baseExperience * cityMultiplier * successVariance * attributeMultiplier)
        : Math.round(baseExperience * 0.5 * cityMultiplier * failureVariance * attributeMultiplier);

      const crowdReactionsSuccess = [
        "The crowd formed a circle and started cheering!",
        "Tourists stopped to film your performance.",
        "Someone dropped a huge tip into your guitar case!",
      ];
      const crowdReactionsFailure = [
        "A sudden downpour scattered the crowd.",
        "Competing noise drowned out your solo.",
        "Security asked you to wrap it up early.",
      ];
      const baseCrowdReaction = success
        ? crowdReactionsSuccess[Math.floor(Math.random() * crowdReactionsSuccess.length)]
        : crowdReactionsFailure[Math.floor(Math.random() * crowdReactionsFailure.length)];

      const weatherData = environmentDetails.weather;
      const weatherAttendanceEffect = weatherData?.effects.gig_attendance ?? 1;
      const weatherConditionLabel = weatherData ? capitalize(weatherData.condition) : null;
      const weatherTemperatureLabel = weatherData ? `${Math.round(weatherData.temperature)}°C` : null;
      const weatherLabelCombined = [weatherConditionLabel ?? "", weatherTemperatureLabel ?? ""]
        .map((piece) => piece.trim())
        .filter((piece) => piece.length > 0)
        .join(" ");
      const environmentLabel = weatherData
        ? weatherLabelCombined || weatherConditionLabel || "Weather boost"
        : environmentDetails.timeOfDay.label;
      const environmentCrowdNote = weatherData
        ? weatherAttendanceEffect >= 1
          ? success
            ? `The ${weatherConditionLabel?.toLowerCase()} skies kept listeners hanging around.`
            : `Even with ${weatherConditionLabel?.toLowerCase()} skies, the crowd drifted quicker than hoped.`
          : success
            ? `Despite the ${weatherConditionLabel?.toLowerCase()} weather you kept listeners engaged.`
            : `The ${weatherConditionLabel?.toLowerCase()} weather made it harder to hold attention.`
        : success
          ? `The ${environmentDetails.timeOfDay.label.toLowerCase()} crowd was feeling it.`
          : `The ${environmentDetails.timeOfDay.label.toLowerCase()} lull hit hard.`;
      const crowdReaction = `${baseCrowdReaction} ${environmentCrowdNote}`.trim();

      const failureReasons = [
        "Crowd fatigue",
        "Technical hiccups",
        "Unexpected competition",
        "Permit interruption",
      ];

      const durationMinutes = Math.max(20, Math.round((selectedLocation.cooldown_minutes ?? 60) * 0.45));
      const locationTag = cityName ? `${selectedLocation.name} in ${cityName}` : selectedLocation.name;
      const summaryMessage = success
        ? `Crushed it at ${selectedLocation.name} during ${environmentDetails.timeOfDay.label.toLowerCase()} — ${environmentLabel}. Earned $${cashEarned.toLocaleString()} with ${modifierName}.`
        : `Tough break at ${selectedLocation.name} amid ${environmentLabel}. Still brought home $${cashEarned.toLocaleString()} with ${modifierName}.`;

        const insertPayload: TablesInsert<"busking_sessions"> = {
          user_id: user.id,
          location_id: selectedLocation.id,
          modifier_id: modifier?.id ?? null,
          success,
          cash_earned: cashEarned,
          fame_gained: fameGained,
          experience_gained: experienceGained,
          performance_score: Math.round(performanceScore),
          risk_level: selectedLocation.risk_level,
          crowd_reaction: crowdReaction,
          notes: summaryMessage,
          failure_reason: success ? null : failureReasons[Math.floor(Math.random() * failureReasons.length)],
          duration_minutes: durationMinutes,
        };

      const { data: sessionRecord, error: sessionError } = await supabase
        .from("busking_sessions")
        .insert(insertPayload)
        .select(
          `*,
          busking_locations:busking_locations!busking_sessions_location_id_fkey(*),
          busking_modifiers:busking_modifiers!busking_sessions_modifier_id_fkey(*)
        `
        )
        .single();

      if (sessionError) {
        throw sessionError;
      }

      const nextCash = (profile.cash ?? 0) + cashEarned;
      const nextFame = (profile.fame ?? 0) + fameGained;
      const nextExperience = (profile.experience ?? 0) + experienceGained;

      await updateProfile({
        cash: nextCash,
        fame: nextFame,
        experience: nextExperience,
      });

      const activityMessage = success
        ? `Street performance success at ${selectedLocation.name}${cityName ? ` (${cityName})` : ""}!`
        : `Busking setback at ${selectedLocation.name}${cityName ? ` (${cityName})` : ""}. Time to regroup.`;

      await addActivity("busking", activityMessage, cashEarned);

      const detailedSession = sessionRecord as BuskingSessionWithRelations;
      setHistory((prev) => [detailedSession, ...prev].slice(0, 12));
      const environmentSummaryForResult = {
        successAdjustment: environmentDetails.combined.successAdjustment,
        successMultiplier: environmentDetails.combined.successMultiplier,
        payoutMultiplier: environmentDetails.combined.payoutMultiplier,
        fameMultiplier: environmentDetails.combined.fameMultiplier,
        experienceMultiplier: environmentDetails.combined.experienceMultiplier,
        timeOfDay: environmentDetails.timeOfDay.label,
        daySegment: environmentDetails.daySegment.label,
        weatherLabel: weatherLabelCombined || undefined,
      };

      setResult({
        success,
        cash: cashEarned,
        fame: fameGained,
        experience: experienceGained,
        performanceScore: Math.round(performanceScore),
        message: summaryMessage,
        crowdReaction,
        locationName: locationTag,
        modifierName,
        environmentSummary: environmentSummaryForResult,
      });

      setNow(Date.now());

      toast({
        variant: success ? "default" : "destructive",
        title: success ? "Busking success!" : "Busking attempt finished",
        description: success
          ? `You earned $${cashEarned.toLocaleString()} and gained ${fameGained} fame (${currentCity ? `${currentCity.name}` : "Neutral city"} boost ×${buskingBoostLabel}).`
          : `You still pocketed $${cashEarned.toLocaleString()} despite the hurdles (${currentCity ? `${currentCity.name}` : "Neutral city"} boost ×${buskingBoostLabel}).`,
      });
    } catch (err) {
      console.error("Failed to complete busking session", err);
      setError("The session could not be recorded. Please try again.");
      toast({
        variant: "destructive",
        title: "Busking failed",
        description: "We ran into an issue saving this busking run. Please retry.",
      });
    } finally {
      setIsSimulating(false);
    }
  };

  if (authLoading || gameLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-stage flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="font-oswald tracking-wide text-muted-foreground">Loading street performance data...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-stage p-6 flex items-center justify-center">
        <Card className="max-w-md bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5 text-primary" />
              Sign in to Start Busking
            </CardTitle>
            <CardDescription>
              Log in to RockMundo to track your street performances and rewards.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-4xl font-bebas tracking-widest text-foreground flex items-center gap-3">
              <Mic className="h-8 w-8 text-primary" />
              Street Busking
            </h1>
            <p className="text-muted-foreground font-oswald">
              Scout the best city corners, hype the crowd, and grow your legend in real time.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Badge variant="outline" className="gap-2 bg-muted/30 border-muted/50 text-muted-foreground">
              <MapPin className="h-4 w-4 text-primary" />
              {currentCity
                ? `${currentCity.name} • Busking Boost ×${buskingBoostLabel}`
                : `No active city • Busking Boost ×${buskingBoostLabel}`}
            </Badge>
            <Badge variant="outline" className="gap-2 bg-primary/10 border-primary/30 text-primary">
              <Activity className="h-4 w-4" />
              Skill Readiness: {skillScore}
            </Badge>
            <Badge variant="outline" className="gap-2 bg-secondary/20 border-secondary/30 text-secondary-foreground">
              <TrendingUp className="h-4 w-4" />
              Success Window: {successChance}%
            </Badge>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-card/80 backdrop-blur border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">On-hand Cash</CardTitle>
              <Coins className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">${(profile.cash ?? 0).toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Fresh earnings fuel new upgrades.</p>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fame</CardTitle>
              <SparklesIcon className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{profile.fame ?? 0}</div>
              <p className="text-xs text-muted-foreground">Busking boosts your street reputation.</p>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Experience</CardTitle>
              <Award className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{profile.experience ?? 0}</div>
              <p className="text-xs text-muted-foreground">Every street set sharpens your craft.</p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card/80 backdrop-blur border-primary/20">
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg">
                <WeatherIcon className="h-5 w-5 text-primary" />
                Environment Pulse
              </CardTitle>
              <CardDescription>Live context for {locationSummary}.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2 text-xs md:text-sm">
              <Badge variant="outline" className="flex items-center gap-1 bg-secondary/20 border-secondary/40 text-secondary-foreground">
                <Clock className="h-3 w-3" />
                {environmentDetails.timeLabel}
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1 bg-secondary/10 border-secondary/30 text-secondary-foreground">
                {environmentDetails.dayName}
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1 bg-primary/10 border-primary/30 text-primary">
                {dateLabel}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {environmentLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>Loading live environment data...</span>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-secondary/30 bg-secondary/10 p-4 space-y-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Time Slot</p>
                  <div className="flex items-center gap-2">
                    <TimeOfDayIcon className="h-5 w-5 text-primary" />
                    <span className={`text-sm font-semibold ${environmentDetails.timeOfDay.accent}`}>
                      {environmentDetails.timeOfDay.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{environmentDetails.timeOfDay.description}</p>
                  <p className="text-xs text-muted-foreground">
                    Success {formatSignedNumber(environmentDetails.timeOfDay.success)}% • Cash ×
                    {environmentDetails.timeOfDay.payout.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Fame ×{environmentDetails.timeOfDay.fame.toFixed(2)} • XP ×
                    {environmentDetails.timeOfDay.experience.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-lg border border-secondary/30 bg-secondary/10 p-4 space-y-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Day Rhythm</p>
                  <div className="flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    <span className={`text-sm font-semibold ${environmentDetails.daySegment.accent}`}>
                      {environmentDetails.daySegment.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{environmentDetails.daySegment.description}</p>
                  <p className="text-xs text-muted-foreground">
                    Success {formatSignedNumber(environmentDetails.daySegment.success)}% • Cash ×
                    {environmentDetails.daySegment.payout.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Fame ×{environmentDetails.daySegment.fame.toFixed(2)} • XP ×
                    {environmentDetails.daySegment.experience.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-lg border border-secondary/30 bg-secondary/10 p-4 space-y-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Weather</p>
                  <div className="flex items-center gap-2">
                    <WeatherIcon className="h-5 w-5 text-primary" />
                    <span className="text-sm font-semibold">{environmentWeatherLabel}</span>
                  </div>
                  {environmentWeatherLocation && (
                    <p className="text-xs text-muted-foreground">{environmentWeatherLocation}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Attendance ×{environmentDetails.weatherMultipliers.payoutMultiplier.toFixed(2)} • Mood ×
                    {environmentDetails.weatherMultipliers.fameMultiplier.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Success ×{environmentDetails.weatherMultipliers.successMultiplier.toFixed(2)} • XP ×
                    {environmentDetails.weatherMultipliers.experienceMultiplier.toFixed(2)}
                  </p>
                  {weatherConfidenceLabel && (
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{weatherConfidenceLabel}</p>
                  )}
                  {!environmentDetails.weather && (
                    <p className="text-xs text-muted-foreground">
                      No active weather data matched this spot. Using neutral modifiers.
                    </p>
                  )}
                </div>
              </div>
            )}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground leading-relaxed">
              <p>
                Combined impact → Success {successAdditiveLabel}%
                {successMultiplierLabel !== "×1.00" ? ` • Weather ${successMultiplierLabel}` : ""}
                , Cash ×{payoutMultiplierLabel}, Fame ×{fameMultiplierLabel}, XP ×{experienceMultiplierLabel}.
              </p>
            </div>
            {environmentError && (
              <Alert className="bg-warning/10 border-warning/30 text-warning-foreground">
                <AlertTitle>Using fallback environment data</AlertTitle>
                <AlertDescription>{environmentError}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bebas tracking-widest text-foreground">Choose Your Stage</h2>
              <p className="text-sm text-muted-foreground font-oswald">
                Tap into office lunch rushes, civic plaza hangouts, or the high street spotlight—each
                location has its own risk profile, audience rhythms, and cooldown timer.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {locations.map((location) => {
              const level = toRiskLevel(location.risk_level);
              const isSelected = selectedLocationId === location.id;
              const cooldownMs = cooldownRemainingMs(location);
              const totalCooldownMs = (location.cooldown_minutes ?? 0) * 60 * 1000;
              const progressValue = totalCooldownMs > 0 ? Math.min(100, Math.max(0, ((totalCooldownMs - cooldownMs) / totalCooldownMs) * 100)) : 100;
              const rewardPercent = Math.round((location.base_payout / maxBasePayout) * 100);
              const highlight = locationAudienceHighlights[location.name ?? ""];

              return (
                <Card
                  key={location.id}
                  className={`transition-all duration-300 cursor-pointer border ${
                    isSelected
                      ? "border-primary/60 shadow-lg shadow-primary/10"
                      : "border-primary/10 hover:border-primary/40"
                  } bg-card/80 backdrop-blur`}
                  onClick={() => setSelectedLocationId(location.id)}
                >
                  <CardHeader className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-primary" />
                          {location.name}
                        </CardTitle>
                        <CardDescription>{location.neighborhood}</CardDescription>
                      </div>
                      <Badge variant="outline" className={`${riskBadgeClasses[level]} uppercase tracking-wide`}>
                        <ShieldAlert className="h-3.5 w-3.5 mr-1" />
                        {level}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{location.description}</p>
                    {highlight && (
                      <div className="flex items-start gap-2 rounded-md bg-muted/30 p-3">
                        <History className="h-4 w-4 text-primary mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                            {highlight.label}
                          </p>
                          <p className="text-xs text-muted-foreground">{highlight.description}</p>
                        </div>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Base payout</span>
                      <span className="font-semibold">${location.base_payout}</span>
                    </div>
                    <Progress value={rewardPercent} className="h-2" />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Skill target</span>
                      <span className="font-semibold">{location.recommended_skill}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>
                        Cooldown: {formatCooldown(cooldownMs)}
                      </span>
                    </div>
                    {totalCooldownMs > 0 && cooldownMs > 0 && <Progress value={progressValue} className="h-1.5" />}
                    <Button
                      variant={isSelected ? "default" : "secondary"}
                      className="w-full mt-2"
                      onClick={() => setSelectedLocationId(location.id)}
                    >
                      {isSelected ? "Selected" : "Set Destination"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-6">
          <Card className="bg-card/90 backdrop-blur border-primary/20">
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Flame className="h-5 w-5 text-primary" />
                Performance Outlook
              </CardTitle>
              <CardDescription>
                We crunch your skills, location difficulty, modifiers, and
                {" "}
                {currentCity ? `${currentCity.name}'s street energy` : "neutral city conditions"}
                {" "}
                to predict the vibe of your next set.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-secondary/20 border border-secondary/30">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Success Chance</p>
                  <div className="flex items-center gap-2 mt-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <span className="text-2xl font-bold">{successChance}%</span>
                  </div>
                  <Progress value={successChance} className="mt-3 h-2" />
                </div>
                <div className="p-4 rounded-lg bg-secondary/20 border border-secondary/30">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Risk Pressure</p>
                  <div className="flex items-center gap-2 mt-2">
                    <ShieldAlert className="h-5 w-5 text-destructive" />
                    <span className="text-2xl font-bold">{riskPercent}%</span>
                  </div>
                  <Progress value={riskPercent} className="mt-3 h-2" />
                  <p className="text-xs text-muted-foreground mt-2">{riskDescription}</p>
                </div>
                <div className="p-4 rounded-lg bg-secondary/20 border border-secondary/30">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Performance Meter</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Gauge className="h-5 w-5 text-accent" />
                    <span className="text-2xl font-bold">{Math.round((skillScore + successChance) / 2)}</span>
                  </div>
                  <Progress value={Math.min(100, Math.round((skillScore + successChance) / 2))} className="mt-3 h-2" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-xs uppercase text-muted-foreground tracking-wide">Projected Cash</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Coins className="h-5 w-5 text-success" />
                    <span className="text-xl font-semibold">${expectedCash}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Based on success odds, modifiers, and live environment.</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-xs uppercase text-muted-foreground tracking-wide">Projected Fame</p>
                  <div className="flex items-center gap-2 mt-2">
                    <SparklesIcon className="h-5 w-5 text-warning" />
                    <span className="text-xl font-semibold">+{expectedFame}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Modifiers and environment buzz amplify your reach.</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-xs uppercase text-muted-foreground tracking-wide">Experience Gain</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Award className="h-5 w-5 text-accent" />
                    <span className="text-xl font-semibold">+{expectedExperience}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Weather and timing adjust how much practice sticks.</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-muted-foreground">
                  <p>
                    Modifier Risk Impact: {selectedModifier ? `${(selectedModifier.risk_modifier * 100).toFixed(0)}%` : "Neutral"}
                  </p>
                  <p>
                    Cooldown after play: {selectedLocation?.cooldown_minutes ?? 0} minutes
                  </p>
                  <p>
                    Environment influence: Success {successAdditiveLabel}%
                    {successMultiplierLabel !== "×1.00" ? ` • Weather ${successMultiplierLabel}` : ""} • Cash ×
                    {payoutMultiplierLabel} • Fame ×{fameMultiplierLabel} • XP ×{experienceMultiplierLabel}
                  </p>
                </div>
                <Button
                  size="lg"
                  className="bg-gradient-primary hover:shadow-electric"
                  onClick={handleStartBusking}
                  disabled={isSimulating || selectedCooldownMs > 0}
                >
                  {isSimulating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Performing...
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4 mr-2" />
                      Start Busking Session
                    </>
                  )}
                </Button>
              </div>
              {selectedCooldownMs > 0 && (
                <Alert className="bg-warning/10 border-warning/40 text-warning-foreground">
                  <AlertTitle>Cooldown active</AlertTitle>
                  <AlertDescription>
                    This spot will be ready in {formatCooldown(selectedCooldownMs)}. Try another location or wait it out.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/90 backdrop-blur border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <History className="h-5 w-5 text-primary" />
                Select a Modifier
              </CardTitle>
              <CardDescription>
                Add situational twists to boost rewards or reduce risk.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={selectedModifierId} onValueChange={setSelectedModifierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose your edge" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No modifier (go solo)</SelectItem>
                  {modifiers.map((modifier) => (
                    <SelectItem key={modifier.id} value={modifier.id}>
                      {modifier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="p-4 rounded-lg bg-muted/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">
                      {selectedModifier ? selectedModifier.name : "Going Solo"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedModifier
                        ? selectedModifier.description
                        : "Perform without bonuses. Pure skill, pure heart."}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      selectedModifier
                        ? `${rarityBadgeClasses[toRarity(selectedModifier.rarity)]} capitalize`
                        : "bg-muted text-muted-foreground border-border"
                    }
                  >
                    {selectedModifier ? toRarity(selectedModifier.rarity) : "solo"}
                  </Badge>
                </div>
                {selectedModifier && (
                  <ul className="text-xs space-y-1 text-muted-foreground">
                    <li>• Payout multiplier: ×{selectedModifier.payout_multiplier.toFixed(2)}</li>
                    <li>• Fame multiplier: ×{selectedModifier.fame_multiplier.toFixed(2)}</li>
                    <li>• Bonus experience: +{selectedModifier.experience_bonus}</li>
                    <li>
                      • Risk adjustment: {selectedModifier.risk_modifier >= 0 ? "+" : ""}
                      {(selectedModifier.risk_modifier * 100).toFixed(0)}%
                    </li>
                    <li>
                      • {modifierDescriptions[toRarity(selectedModifier.rarity)]}
                    </li>
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-card/90 backdrop-blur border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-success" />
                Latest Session Outcome
              </CardTitle>
              <CardDescription>
                Track the story behind your most recent street performance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {result ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className={result.success ? "border-success/40 text-success bg-success/10" : "border-destructive/40 text-destructive bg-destructive/10"}
                    >
                      {result.success ? "Successful" : "Challenging"}
                    </Badge>
                    <p className="text-sm text-muted-foreground">
                      {result.locationName} • {result.modifierName}
                    </p>
                  </div>
                  <p className="text-base font-medium text-foreground">{result.message}</p>
                  <p className="text-sm text-muted-foreground">{result.crowdReaction}</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 rounded-lg bg-success/10 text-success">
                      <p className="text-xs uppercase">Cash</p>
                      <p className="text-lg font-bold">${result.cash.toLocaleString()}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-warning/10 text-warning">
                      <p className="text-xs uppercase">Fame</p>
                      <p className="text-lg font-bold">+{result.fame}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-accent/10 text-accent">
                      <p className="text-xs uppercase">XP</p>
                      <p className="text-lg font-bold">+{result.experience}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Gauge className="h-4 w-4 text-accent" />
                    Performance score: {result.performanceScore}
                  </div>
                  <div className="rounded-lg border border-secondary/30 bg-secondary/10 p-3 text-xs text-muted-foreground space-y-1">
                    <p className="uppercase tracking-wide text-[10px] text-muted-foreground/80">Environment impact</p>
                    <p>
                      {result.environmentSummary.timeOfDay} • {result.environmentSummary.daySegment}
                      {result.environmentSummary.weatherLabel ? ` • ${result.environmentSummary.weatherLabel}` : ""}
                    </p>
                    <p>
                      Success {formatSignedNumber(result.environmentSummary.successAdjustment)}%
                      {result.environmentSummary.successMultiplier !== 1
                        ? ` • Weather ×${result.environmentSummary.successMultiplier.toFixed(2)}`
                        : " • Weather ×1.00"}
                    </p>
                    <p>
                      Cash ×{result.environmentSummary.payoutMultiplier.toFixed(2)} • Fame ×
                      {result.environmentSummary.fameMultiplier.toFixed(2)} • XP ×
                      {result.environmentSummary.experienceMultiplier.toFixed(2)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  You haven&apos;t logged a street performance yet. Choose a location to get started!
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/90 backdrop-blur border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <History className="h-5 w-5 text-primary" />
                Session History
              </CardTitle>
              <CardDescription>
                Recent busking runs with payouts, fame gains, and success streaks.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {history.length > 0 ? (
                history.map((session) => {
                  const location = session.busking_locations;
                  const modifier = session.busking_modifiers;
                  const sessionRisk = toRiskLevel(session.risk_level ?? location?.risk_level);
                  return (
                    <div
                      key={session.id}
                      className="p-3 rounded-lg border border-primary/10 bg-secondary/10"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm">{location?.name ?? "Unknown location"}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            session.success
                              ? "border-success/40 text-success bg-success/10"
                              : "border-destructive/40 text-destructive bg-destructive/10"
                          }
                        >
                          {session.success ? "Success" : "Miss"}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-3 mt-3 text-xs">
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Cash</p>
                          <p className="font-semibold">${session.cash_earned.toLocaleString()}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Fame</p>
                          <p className="font-semibold">+{session.fame_gained}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">XP</p>
                          <p className="font-semibold">+{session.experience_gained}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-muted-foreground">
                        <Badge variant="outline" className={`${riskBadgeClasses[sessionRisk]} capitalize`}>
                          {sessionRisk}
                        </Badge>
                        {modifier && (
                          <Badge
                            variant="outline"
                            className={`${rarityBadgeClasses[toRarity(modifier.rarity)]} capitalize`}
                          >
                            {modifier.name}
                          </Badge>
                        )}
                        {session.crowd_reaction && <span>• {session.crowd_reaction}</span>}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">
                  No busking sessions recorded yet. Hit the streets to fill this log!
                </p>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
};

export default Busking;
