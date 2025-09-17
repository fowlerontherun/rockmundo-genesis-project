import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  Activity,
  Award,
  Clock,
  Coins,
  Flame,
  Gauge,
  History,
  Loader2,
  MapPin,
  Mic,
  ShieldAlert,
  SparklesIcon,
  TrendingUp,
} from "lucide-react";

type BuskingLocation = Tables<"busking_locations">;
type BuskingModifier = Tables<"busking_modifiers">;
type BuskingSession = Tables<"busking_sessions">;

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

const Busking = () => {
  const { user, loading: authLoading } = useAuth();
  const { profile, skills, updateProfile, addActivity, loading: gameLoading, currentCity } = useGameData();
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
    const creativity = skills?.creativity ?? 50;
    return Math.round((performance * 0.4 + vocals * 0.25 + guitar * 0.2 + creativity * 0.15) || 0);
  }, [skills]);

  const riskLevel = toRiskLevel(selectedLocation?.risk_level);
  const riskPercent = riskPercentMap[riskLevel];
  const riskDescription = riskDescriptionMap[riskLevel];

  const successChance = useMemo(() => {
    if (!selectedLocation) return 0;
    const baseChance = 58 + (skillScore - selectedLocation.recommended_skill) * 0.7;
    const riskPenalty = riskPenaltyWeights[toRiskLevel(selectedLocation.risk_level)];
    const modifierRisk = selectedModifier ? selectedModifier.risk_modifier * 100 : 0;
    const cityInfluence = (cityBuskingValue - 1) * 20;
    const calculated = baseChance - riskPenalty - modifierRisk + cityInfluence;
    return Math.min(95, Math.max(10, Math.round(calculated)));
  }, [selectedLocation, selectedModifier, skillScore, cityBuskingValue]);

  const expectedCash = useMemo(() => {
    if (!selectedLocation) return 0;
    const modifierMultiplier = selectedModifier?.payout_multiplier ?? 1;
    const expectancy = successChance / 100;
    return Math.max(
      0,
      Math.round(selectedLocation.base_payout * modifierMultiplier * cityBuskingValue * (0.4 + expectancy))
    );
  }, [selectedLocation, selectedModifier, successChance, cityBuskingValue]);

  const expectedFame = useMemo(() => {
    if (!selectedLocation) return 0;
    const modifierMultiplier = selectedModifier?.fame_multiplier ?? 1;
    const expectancy = successChance / 100;
    return Math.max(
      0,
      Math.round(selectedLocation.fame_reward * modifierMultiplier * cityBuskingValue * (0.5 + expectancy * 0.5))
    );
  }, [selectedLocation, selectedModifier, successChance, cityBuskingValue]);

  const expectedExperience = useMemo(() => {
    if (!selectedLocation) return 0;
    const modifierBonus = selectedModifier?.experience_bonus ?? 0;
    const expectancy = successChance / 100;
    return Math.max(
      0,
      Math.round(
        (selectedLocation.experience_reward + modifierBonus) * cityBuskingValue * (0.6 + expectancy * 0.4)
      )
    );
  }, [selectedLocation, selectedModifier, successChance, cityBuskingValue]);

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
      const payoutMultiplier = modifier?.payout_multiplier ?? 1;
      const cashEarned = success
        ? Math.round(baseCash * payoutMultiplier * cityMultiplier * (0.85 + Math.random() * 0.6))
        : Math.round(baseCash * 0.25 * cityMultiplier * (0.7 + Math.random() * 0.4));

      const baseFame = selectedLocation.fame_reward;
      const fameMultiplier = modifier?.fame_multiplier ?? 1;
      const fameGained = success
        ? Math.round(baseFame * fameMultiplier * cityMultiplier * (0.9 + Math.random() * 0.4))
        : Math.round(baseFame * 0.4 * cityMultiplier * (0.6 + Math.random() * 0.3));

      const baseExperience = selectedLocation.experience_reward + (modifier?.experience_bonus ?? 0);
      const experienceGained = success
        ? Math.round(baseExperience * cityMultiplier * (0.9 + Math.random() * 0.5))
        : Math.round(baseExperience * 0.5 * cityMultiplier * (0.7 + Math.random() * 0.3));

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
      const crowdReaction = success
        ? crowdReactionsSuccess[Math.floor(Math.random() * crowdReactionsSuccess.length)]
        : crowdReactionsFailure[Math.floor(Math.random() * crowdReactionsFailure.length)];

      const failureReasons = [
        "Crowd fatigue",
        "Technical hiccups",
        "Unexpected competition",
        "Permit interruption",
      ];

      const durationMinutes = Math.max(20, Math.round((selectedLocation.cooldown_minutes ?? 60) * 0.45));
      const locationTag = cityName ? `${selectedLocation.name} in ${cityName}` : selectedLocation.name;
      const summaryMessage = success
        ? `Crushed it at ${locationTag}! Earned $${cashEarned.toLocaleString()} with ${modifierName}.`
        : `Tough break at ${locationTag}. Still brought home $${cashEarned.toLocaleString()}.`;

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
                  <p className="text-xs text-muted-foreground mt-1">
                    Based on success odds, modifiers, and
                    {" "}
                    {currentCity
                      ? `${currentCity.name}'s busking climate (×${buskingBoostLabel})`
                      : `a neutral city boost (×${buskingBoostLabel})`}
                    .
                  </p>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-xs uppercase text-muted-foreground tracking-wide">Projected Fame</p>
                  <div className="flex items-center gap-2 mt-2">
                    <SparklesIcon className="h-5 w-5 text-warning" />
                    <span className="text-xl font-semibold">+{expectedFame}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">More eyes on you mean more followers.</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-xs uppercase text-muted-foreground tracking-wide">Experience Gain</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Award className="h-5 w-5 text-accent" />
                    <span className="text-xl font-semibold">+{expectedExperience}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Street practice feeds level ups.</p>
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
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    {currentCity
                      ? `${currentCity.name} boost ×${buskingBoostLabel}`
                      : `Neutral city boost ×${buskingBoostLabel}`}
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
