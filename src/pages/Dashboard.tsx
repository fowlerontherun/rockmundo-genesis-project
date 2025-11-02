import { useState, useEffect, useMemo, useCallback, type ReactNode } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Music,
  Users,
  Calendar,
  TrendingUp,
  Guitar,
  Mic,
  Headphones,
  DollarSign,
  Star,
  Play,
  AlertCircle,
  Sparkles,
  MessageSquare,
  Bell,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useGameData, type PlayerAttributes, type SkillProgressRow } from "@/hooks/useGameData";
import { supabase } from "@/integrations/supabase/client";
import RealtimeChatPanel from "@/components/chat/RealtimeChatPanel";
import { CurrentLocationWidget } from "@/components/city/CurrentLocationWidget";
import type { Database } from "@/lib/supabase-types";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlayerPresenceStats } from "@/hooks/usePlayerPresenceStats";
import { GameDateWidget } from "@/components/calendar/GameDateWidget";
import { BirthdayNotification } from "@/components/calendar/BirthdayNotification";
import { useGameCalendar, useBirthdayCheck } from "@/hooks/useGameCalendar";
import { useGameNotifications } from "@/hooks/useGameNotifications";
import { useAutoRecordingCompletion } from "@/hooks/useAutoRecordingCompletion";
import { useAutoRehearsalCompletion } from "@/hooks/useAutoRehearsalCompletion";
import { useAutoUniversityAttendance } from "@/hooks/useAutoUniversityAttendance";
import { useAutoBookReading } from "@/hooks/useAutoBookReading";
import { useAutoShiftClockOut } from "@/hooks/useAutoShiftClockOut";
import { useAutoGigStart } from "@/hooks/useAutoGigStart";
import { useGigNotifications } from "@/hooks/useGigNotifications";

type ActivityFeedRow = Database["public"]["Tables"]["activity_feed"]["Row"];
type ProfileActivityStatusRow = Database["public"]["Tables"]["profile_activity_statuses"]["Row"];

type ChatScope = "general" | "city";

interface ActivityEntry {
  id: string;
  activity_type: string;
  message: string;
  created_at: string;
  earnings: number;
  metadata?: Record<string, unknown> | null;
}

interface XpLedgerEntry {
  id: string;
  event_type: string;
  xp_delta?: number | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
}

interface DashboardNotification {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  iconClasses: string;
  timestamp?: string;
}

const genderLabels: Record<string, string> = {
  female: "Female",
  male: "Male",
  non_binary: "Non-binary",
  other: "Other",
  prefer_not_to_say: "Prefer not to say",
};

const formatNotificationDate = (isoString: string | null | undefined) => {
  if (!isoString) {
    return undefined;
  }

  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
};

const formatAttributeLabel = (attributeKey: keyof PlayerAttributes) =>
  attributeKey
    .toString()
    .split("_")
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const formatSkillName = (slug: string) =>
  slug
    .split(/[_-]/)
    .filter(segment => segment.length > 0)
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const toDisplayLabel = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  return value
    .split(/[_-]/)
    .filter(segment => segment.length > 0)
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

const getStatusEndDate = (status: ProfileActivityStatusRow | null): Date | null => {
  if (!status || status.status === "idle") {
    return null;
  }

  if (status.ends_at) {
    const parsed = new Date(status.ends_at);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  if (!status.started_at || typeof status.duration_minutes !== "number") {
    return null;
  }

  const startedAt = new Date(status.started_at);
  if (Number.isNaN(startedAt.getTime())) {
    return null;
  }

  return new Date(startedAt.getTime() + status.duration_minutes * 60_000);
};

const getMetadataString = (metadata: ProfileActivityStatusRow["metadata"], ...keys: string[]): string | null => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const record = metadata as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return null;
};

const DAILY_XP_STIPEND = 100;

const Dashboard = () => {
  const navigate = useNavigate();
  const {
    profile,
    attributes,
    xpWallet,
    xpLedger,
    skillProgress,
    dailyXpGrant,
    freshWeeklyBonusAvailable,
    currentCity,
    activities,
    activityStatus,
    loading,
    error
  } = useGameData();
  
  // Game notifications and auto-completion hooks
  useGameNotifications(profile?.user_id || null);
  useAutoRecordingCompletion(profile?.user_id || null);
  useAutoRehearsalCompletion(profile?.user_id || null);
  useAutoUniversityAttendance(profile?.user_id || null);
  useAutoBookReading(profile?.user_id || null);
  useAutoShiftClockOut(profile?.user_id || null);
  useAutoGigStart();
  useGigNotifications();
  
  const [birthCityLabel, setBirthCityLabel] = useState<string | null>(null);
  const [activeChatTab, setActiveChatTab] = useState<ChatScope>("general");
  const [chatOnlineCounts, setChatOnlineCounts] = useState<Record<ChatScope, number>>({
    general: 0,
    city: 0
  });
  const [chatConnections, setChatConnections] = useState<Record<ChatScope, boolean>>({
    general: false,
    city: false
  });

  const {
    totalPlayers,
    onlinePlayers,
    loading: presenceLoading,
    error: presenceError,
  } = usePlayerPresenceStats();

  const formatPresenceValue = useCallback((value: number | null) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value.toLocaleString();
    }

    return "—";
  }, []);

  const statusEndsAt = useMemo(() => getStatusEndDate(activityStatus), [activityStatus]);

  const activityCountdown = useMemo(() => {
    if (!activityStatus || activityStatus.status === "idle" || !statusEndsAt) {
      return null;
    }

    if (statusEndsAt.getTime() <= Date.now()) {
      return null;
    }

    try {
      return formatDistanceToNowStrict(statusEndsAt, { addSuffix: true });
    } catch (countdownError) {
      console.error("Failed to format activity countdown", countdownError);
      return null;
    }
  }, [activityStatus, statusEndsAt]);

  const isBusy = useMemo(() => {
    if (!activityStatus || activityStatus.status === "idle") {
      return false;
    }

    if (!statusEndsAt) {
      return true;
    }

    return statusEndsAt.getTime() > Date.now();
  }, [activityStatus, statusEndsAt]);

  const activityLabel = useMemo(() => toDisplayLabel(activityStatus?.status) ?? "You're ready to rock", [activityStatus]);

  const activityTypeLabel = useMemo(() => toDisplayLabel(activityStatus?.activity_type), [activityStatus]);
  const activityLocationLabel = useMemo(
    () =>
      getMetadataString(
        activityStatus?.metadata ?? null,
        "location_name",
        "job_title",
        "activity_name",
        "venue_name",
      ),
    [activityStatus],
  );

  const activitySubtitle = useMemo(() => {
    if (!isBusy) {
      return "Start a gig, rehearsal, or job to keep building momentum.";
    }

    const parts = [activityTypeLabel, activityLocationLabel].filter(
      (part): part is string => typeof part === "string" && part.length > 0,
    );

    if (parts.length === 0) {
      return "Activity in progress";
    }

    return parts.join(" · ");
  }, [activityTypeLabel, activityLocationLabel, isBusy]);

  const attributeKeys: (keyof PlayerAttributes)[] = [
    "charisma",
    "looks",
    "mental_focus",
    "musicality",
    "physical_endurance",
    "stage_presence",
    "crowd_engagement",
    "social_reach"
  ];

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const dailyXpClaimedToday = (dailyXpGrant?.grant_date ?? null) === todayIso;
  const dailyXpAmount = dailyXpClaimedToday
    ? Math.max(0, Number((dailyXpGrant as any)?.xp_awarded ?? dailyXpGrant?.xp_amount ?? DAILY_XP_STIPEND))
    : DAILY_XP_STIPEND;
  const dailyXpClaimedAtLabel = (dailyXpGrant as any)?.claimed_at ? formatNotificationDate((dailyXpGrant as any).claimed_at) : undefined;
  const spendableXpBalance = Math.max(0, Number(xpWallet?.xp_balance ?? 0));

  const handleChatTabChange = useCallback((value: string) => {
    setActiveChatTab(value === "city" ? "city" : "general");
  }, []);

  const handleGeneralOnlineCount = useCallback((count: number) => {
    setChatOnlineCounts(previous => ({ ...previous, general: count }));
  }, []);

  const handleCityOnlineCount = useCallback((count: number) => {
    setChatOnlineCounts(previous => ({ ...previous, city: count }));
  }, []);

  const handleGeneralConnection = useCallback((connected: boolean) => {
    setChatConnections(previous => ({ ...previous, general: connected }));
  }, []);

  const handleCityConnection = useCallback((connected: boolean) => {
    setChatConnections(previous => ({ ...previous, city: connected }));
  }, []);

  // City channel simplified - current_city_id not in schema
  const cityChannel = null;

  const cityNameLabel = useMemo(() => {
    if (!currentCity || !currentCity.name) {
      return null;
    }

    return currentCity.country ? `${currentCity.name}, ${currentCity.country}` : currentCity.name;
  }, [currentCity]);

  const cityTabLabel = cityNameLabel ? `${cityNameLabel} Chat` : "City Chat";
  const currentCityDisplay = `Current City: ${cityNameLabel ?? "London"}`;
  const activeOnlineCount = chatOnlineCounts[activeChatTab];
  const activeConnection = chatConnections[activeChatTab];
  const cityChatPlaceholder = "Say hello to fellow musicians...";
  const chatCardDescription = activeChatTab === "city"
    ? "Connect with performers in your current city."
    : "Chat with the global community of musicians.";

  const toNumber = (value: unknown, fallback = 0) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim().length === 0) {
      return fallback;
    }

    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  };

  const formatLedgerEvent = (eventType: string) => {
    if (!eventType) {
      return "XP adjustment";
    }

    if (eventType === "weekly_bonus") {
      return "Weekly bonus";
    }

    return eventType
      .split("_")
      .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ");
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "gig": return <Play className="h-4 w-4" />;
      case "skill": return <TrendingUp className="h-4 w-4" />;
      case "fan": return <Users className="h-4 w-4" />;
      case "song": return <Music className="h-4 w-4" />;
      case "join": return <Star className="h-4 w-4" />;
      case "busking": return <Mic className="h-4 w-4" />;
      case "university_attendance": return <Activity className="h-4 w-4" />;
      case "work_shift": return <Activity className="h-4 w-4" />;
      case "point_grant":
      case "weekly_bonus":
        return <Sparkles className="h-4 w-4" />;
      default: return <Star className="h-4 w-4" />;
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadCity = async (cityId: string) => {
      try {
        const { data, error } = await supabase
          .from("cities")
          .select("name, country")
          .eq("id", cityId)
          .maybeSingle();

        if (error) throw error;
        if (!isMounted) return;

        if (data) {
          const cityName = data.name ?? "Unnamed City";
          const label = data.country ? `${cityName}, ${data.country}` : cityName;
          setBirthCityLabel(label ?? null);
        } else {
          setBirthCityLabel(null);
        }
      } catch (error) {
        console.error("Error loading birth city:", error);
        if (isMounted) {
          setBirthCityLabel(null);
        }
      }
    };

    // Initialize the birth city label before profile data loads
    setBirthCityLabel(null);

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadCity = async (cityId: string) => {
      try {
        const { data, error: queryError } = await supabase
          .from("cities")
          .select("name, country")
          .eq("id", cityId)
          .maybeSingle();

        if (queryError) throw queryError;
        if (!isMounted) return;

        if (data) {
          const cityName = data.name ?? "Unnamed City";
          const label = data.country ? `${cityName}, ${data.country}` : cityName;
          setBirthCityLabel(label ?? null);
        } else {
          setBirthCityLabel(null);
        }
      } catch (caughtError) {
        console.error("Error loading birth city:", caughtError);
        if (isMounted) {
          setBirthCityLabel(null);
        }
      }
    };

    const birthCityId = (profile as any)?.city_of_birth ?? null;

    if (birthCityId) {
      void loadCity(birthCityId);
    } else {
      setBirthCityLabel(null);
    }

    return () => {
      isMounted = false;
    };
  }, [(profile as any)?.city_of_birth]);

  const trackedSkillProgress = useMemo<SkillProgressRow[]>(
    () => (Array.isArray(skillProgress) ? skillProgress.filter(entry => entry && entry.skill_slug) : []),
    [skillProgress],
  );

  const highlightedSkillProgress = useMemo(() => {
    const sorted = [...trackedSkillProgress].sort((a, b) => {
      const levelDifference = (b.current_level ?? 0) - (a.current_level ?? 0);
      if (levelDifference !== 0) {
        return levelDifference;
      }

      const aRequired = Math.max(1, Number(a.required_xp ?? 1));
      const bRequired = Math.max(1, Number(b.required_xp ?? 1));
      const aProgress = Math.max(0, Number(a.current_xp ?? 0)) / aRequired;
      const bProgress = Math.max(0, Number(b.current_xp ?? 0)) / bRequired;
      return bProgress - aProgress;
    });

    return sorted.slice(0, 6);
  }, [trackedSkillProgress]);

  const activeSkillCount = useMemo(
    () =>
      trackedSkillProgress.reduce((count, entry) => {
        const level = Number(entry.current_level ?? 0);
        const xp = Number(entry.current_xp ?? 0);
        return level > 0 || xp > 0 ? count + 1 : count;
      }, 0),
    [trackedSkillProgress],
  );

  const totalTrackedSkills = trackedSkillProgress.length;
  const skillSummaryLabel = totalTrackedSkills === 1 ? "skill" : "skills";

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-stage flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-oswald">Loading your music empire...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-stage p-6">
        <div className="max-w-2xl mx-auto">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Error loading your data: {error}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  const profileGenderLabel = genderLabels[(profile as any).gender ?? "prefer_not_to_say"] ?? genderLabels.prefer_not_to_say;

  const parseDate = (value?: string | null) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const lifetimeXp = Math.max(0, Number(xpWallet?.lifetime_xp ?? 0));
  const experienceProgress = lifetimeXp % 1000;
  const latestWeeklyBonus = xpLedger.find(entry => entry.event_type === "weekly_bonus");
  const latestWeeklyMetadata = (latestWeeklyBonus?.metadata as Record<string, unknown> | null) ?? null;
  const weeklyBonusAmount = latestWeeklyBonus
    ? toNumber(latestWeeklyMetadata?.bonus_awarded ?? latestWeeklyBonus.xp_delta ?? 0, 0)
    : 0;
  const weeklyBonusSourceXp = latestWeeklyMetadata ? toNumber(latestWeeklyMetadata?.experience_gained, 0) : 0;
  const weeklyBonusStreak = latestWeeklyBonus ? Math.max(toNumber(latestWeeklyMetadata?.streak, 1), 1) : 0;
  const weeklyBonusRecorded = parseDate(latestWeeklyBonus?.created_at ?? null);
  const formattedWeeklyBonusRecorded = weeklyBonusRecorded
    ? new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).format(weeklyBonusRecorded)
    : null;
  const formattedWeeklyBonusAmount = weeklyBonusAmount.toLocaleString();
  const formattedWeeklyBonusSourceXp = weeklyBonusSourceXp.toLocaleString();
  const latestWeeklyBonusId = latestWeeklyBonus?.id ?? null;

  const notifications: DashboardNotification[] = (() => {
    const items: DashboardNotification[] = [];

    if (dailyXpClaimedToday) {
      items.push({
        id: "daily-xp-claimed",
        title: "Daily XP ready",
        description: `You received ${dailyXpAmount.toLocaleString()} XP today. Spend it on My Character to keep growing.`,
        icon: <Sparkles className="h-4 w-4" />,
        iconClasses: "bg-primary/10 text-primary",
        timestamp: dailyXpClaimedAtLabel,
      });
    } else {
      items.push({
        id: "daily-xp-available",
        title: "Daily XP available",
        description: `Claim ${dailyXpAmount.toLocaleString()} XP and invest it on the My Character screen.`,
        icon: <Sparkles className="h-4 w-4" />,
        iconClasses: "bg-primary/10 text-primary",
        timestamp: undefined,
      });
    }

    if (freshWeeklyBonusAvailable) {
      items.push({
        id: "weekly-bonus-available",
        title: "Weekly bonus available",
        description:
          weeklyBonusAmount > 0
            ? `Collect your ${formattedWeeklyBonusAmount} XP bonus${weeklyBonusSourceXp > 0 ? ` for earning ${formattedWeeklyBonusSourceXp} XP last week.` : "."}`
            : "Your weekly rehearsal bonus is ready whenever you are.",
        icon: <Sparkles className="h-4 w-4" />,
        iconClasses: "bg-primary/10 text-primary",
        timestamp: formattedWeeklyBonusRecorded ?? undefined,
      });
    } else if (latestWeeklyBonusId) {
      items.push({
        id: "weekly-bonus-summary",
        title: "Weekly bonus processed",
        description:
          weeklyBonusAmount > 0
            ? `You received ${formattedWeeklyBonusAmount} XP after gaining ${formattedWeeklyBonusSourceXp} XP last week.`
            : "No bonus was awarded this cycle. Earn more XP this week to unlock it.",
        icon: <Sparkles className="h-4 w-4" />,
        iconClasses: "bg-primary/10 text-primary",
        timestamp: formattedWeeklyBonusRecorded ?? undefined,
      });
    }

    const latestActivity = activities[0];
    if (latestActivity) {
      items.push({
        id: `activity-${latestActivity.id}`,
        title: "Latest activity",
        description: latestActivity.message,
        icon: getActivityIcon(latestActivity.activity_type),
        iconClasses: "bg-secondary/40 text-foreground",
        timestamp: formatNotificationDate(latestActivity.created_at),
      });
    }

    const universityActivity = activities.find(activity => activity.activity_type === "university_attendance");
    if (universityActivity && (!latestActivity || universityActivity.id !== latestActivity.id)) {
      items.push({
        id: `university-${universityActivity.id}`,
        title: "Class attendance",
        description: universityActivity.message,
        icon: <Activity className="h-4 w-4" />,
        iconClasses: "bg-blue-500/10 text-blue-500",
        timestamp: formatNotificationDate(universityActivity.created_at),
      });
    }

    const skillActivity = activities.find(activity => activity.activity_type === "skill");
    if (skillActivity && (!latestActivity || skillActivity.id !== latestActivity.id)) {
      items.push({
        id: `skill-${skillActivity.id}`,
        title: "Skill progress",
        description: skillActivity.message,
        icon: <Guitar className="h-4 w-4" />,
        iconClasses: "bg-success/10 text-success",
        timestamp: formatNotificationDate(skillActivity.created_at),
      });
    }

    return items.slice(0, 4);
  })();
  const recentLedgerEntries = xpLedger.slice(0, 5);

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bebas tracking-wider bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
              Welcome back, {profile.display_name || profile.username}
            </h1>
            <p className="text-muted-foreground font-oswald">Ready to rock the world?</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="border-border text-foreground/80">
                Level {profile.level}
              </Badge>
              <Badge variant="outline" className="border-border text-foreground/80">
                {profileGenderLabel}
              </Badge>
              <Badge variant="outline" className="border-border text-foreground/80">
                Rising Artist
              </Badge>
              <Badge variant="outline" className="border-border text-foreground/80">
                {currentCityDisplay}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-primary/20 bg-card/80 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Registered Players</p>
                {presenceLoading ? (
                  <Skeleton className="mt-2 h-7 w-20" />
                ) : (
                  <p className="text-2xl font-bebas tracking-wide text-foreground">
                    {formatPresenceValue(totalPlayers)}
                  </p>
                )}
                <p className="text-xs text-muted-foreground/70">Musicians who have joined Rockmundo.</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-primary/20 bg-card/80 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2 text-primary">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Players Online Now</p>
                {presenceLoading ? (
                  <Skeleton className="mt-2 h-7 w-20" />
                ) : (
                  <p className="text-2xl font-bebas tracking-wide text-foreground">
                    {formatPresenceValue(onlinePlayers)}
                  </p>
                )}
                <p className="text-xs text-muted-foreground/70">Currently exploring the world alongside you.</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-primary/20 bg-card/80 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Current Activity</p>
                <p className="text-xl font-bebas tracking-wide text-foreground">{activityLabel}</p>
                <p className="text-xs text-muted-foreground/80">{activitySubtitle}</p>
                {isBusy && activityCountdown && (
                  <p className="mt-2 text-xs font-medium text-primary">Wraps up {activityCountdown}</p>
                )}
              </div>
              <Badge
                variant={isBusy ? "secondary" : "outline"}
                className={
                  isBusy
                    ? "border-primary/30 bg-primary/15 text-primary"
                    : "border-border/60 text-muted-foreground"
                }
              >
                {isBusy ? "In Progress" : "Idle"}
              </Badge>
            </div>
          </div>
        </div>

        {presenceError && (
          <p className="text-sm font-oswald text-destructive/80">
            {presenceError}
          </p>
        )}

        <Alert className="border-primary/40 bg-primary/5 text-foreground">
          <Sparkles className="h-4 w-4" />
          <AlertTitle>
            {dailyXpClaimedToday ? "Today's XP stipend claimed" : "Daily XP stipend available"}
          </AlertTitle>
          <AlertDescription className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span>
              {dailyXpClaimedToday
                ? `You received ${dailyXpAmount.toLocaleString()} XP today${
                    dailyXpClaimedAtLabel ? ` at ${dailyXpClaimedAtLabel}` : ""
                  }. Spend your ${spendableXpBalance.toLocaleString()} XP balance on the My Character page.`
                : `Claim ${dailyXpAmount.toLocaleString()} XP now and invest it into attributes or skills on the My Character page.`}
            </span>
            <Button asChild size="sm" variant="outline">
              <Link to="/my-character">Open My Character</Link>
            </Button>
          </AlertDescription>
        </Alert>

        {latestWeeklyBonus ? (
          <Alert className="border-primary/30 bg-primary/5 text-primary">
            <Sparkles className="h-4 w-4" />
            <AlertTitle className="flex items-center gap-2">
              Weekly rehearsal bonus delivered
              {freshWeeklyBonusAvailable && (
                <Badge variant="secondary" className="border-primary/40 bg-primary/10 text-primary">
                  New this week
                </Badge>
              )}
            </AlertTitle>
            <AlertDescription className="space-y-3 text-sm">
              <p>
                {weeklyBonusAmount > 0
                  ? `You gained ${weeklyBonusSourceXp} XP through play and received a ${weeklyBonusAmount} XP bonus for keeping up your momentum.`
                  : "No bonus was awarded this cycle. Earn more XP during the week to unlock next Monday's boost."}
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                {weeklyBonusAmount > 0 && (
                  <Badge variant="secondary" className="border-primary/30 bg-primary/10 text-primary">
                    +{weeklyBonusAmount} XP bonus
                  </Badge>
                )}
                {weeklyBonusSourceXp > 0 && (
                  <Badge variant="outline" className="border-primary/40 text-primary">
                    {weeklyBonusSourceXp} XP earned
                  </Badge>
                )}
                {weeklyBonusStreak > 1 && (
                  <Badge variant="outline" className="border-primary/40 text-primary">
                    {weeklyBonusStreak}-week streak
                  </Badge>
                )}
              </div>
              {formattedWeeklyBonusRecorded && (
                <p className="text-xs text-primary/70">
                  Processed {formattedWeeklyBonusRecorded} UTC · Next bonus hits Mondays at 05:15 UTC.
                </p>
              )}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-primary/30 bg-primary/5 text-primary">
            <Sparkles className="h-4 w-4" />
            <AlertTitle>Weekly rehearsal bonus</AlertTitle>
            <AlertDescription className="text-sm">
              Build experience through gigs, practice, and storytelling. Every Monday at 05:15 UTC we grant a bonus based on the XP you earned over the previous week.
            </AlertDescription>
          </Alert>
        )}

        {/* Notifications */}
        <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Notifications
            </CardTitle>
            <CardDescription>Stay in the loop with your latest milestones and opportunities.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {notifications.length > 0 ? (
              notifications.map(notification => (
                <div
                  key={notification.id}
                  className="flex items-start gap-3 rounded-lg border border-primary/10 bg-secondary/20 p-3"
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full ${notification.iconClasses}`}
                  >
                    {notification.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{notification.title}</p>
                    <p className="text-xs text-muted-foreground">{notification.description}</p>
                    {notification.timestamp && (
                      <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                        {notification.timestamp}
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                You're all caught up. Complete gigs or jam with friends to generate new updates.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Game Calendar Widget */}
        <GameDateWidget profileCreatedAt={profile.created_at ? new Date(profile.created_at) : undefined} />

        {/* Birthday Notification */}
        {(() => {
          const { data: gameCalendar } = useGameCalendar(profile.created_at ? new Date(profile.created_at) : undefined);
          const { data: birthdayCheck } = useBirthdayCheck(
            profile.id,
            profile.character_birth_date ? new Date(profile.character_birth_date) : null,
            gameCalendar || undefined
          );

          return birthdayCheck?.isBirthday && birthdayCheck?.canClaim && gameCalendar ? (
            <BirthdayNotification
              userId={profile.user_id}
              profileId={profile.id}
              gameYear={birthdayCheck.gameYear}
              birthDate={new Date(profile.character_birth_date!)}
              createdAt={new Date(profile.created_at)}
              inGameDate={gameCalendar}
            />
          ) : null;
        })()}

        {/* Location Widget */}
        <CurrentLocationWidget city={currentCity} loading={loading} />

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Level</CardTitle>
              <Star className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{profile.level}</div>
              <Progress 
                value={(experienceProgress / 1000) * 100} 
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {experienceProgress}/1000 XP to level {profile.level + 1}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cash</CardTitle>
              <DollarSign className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                ${profile.cash.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                From recent performances
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fame</CardTitle>
              <TrendingUp className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{profile.fame}</div>
              <p className="text-xs text-muted-foreground">
                Keep performing to gain more fame!
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Band Popularity</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">Solo Artist</div>
              <p className="text-xs text-muted-foreground">
                Create or join a band to unlock more features
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Community Chat
              </CardTitle>
              <div className="flex items-center gap-3">
                <Badge
                  variant="secondary"
                  className="border-primary/30 bg-primary/10 text-primary"
                >
                  {activeOnlineCount}
                </Badge>
                <div
                  className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                    activeConnection
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      activeConnection ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                  {activeConnection ? "Connected" : "Connecting..."}
                </div>
              </div>
            </div>
            <CardDescription>{chatCardDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeChatTab} onValueChange={handleChatTabChange} className="space-y-4">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="general" className="flex items-center justify-center gap-2">
                  General
                  <Badge variant={activeChatTab === "general" ? "secondary" : "outline"}>
                    {chatOnlineCounts.general}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="city" className="flex items-center justify-center gap-2">
                  {cityTabLabel}
                  <Badge variant={activeChatTab === "city" ? "secondary" : "outline"}>
                    {chatOnlineCounts.city}
                  </Badge>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="general" className="mt-4">
                <RealtimeChatPanel
                  channelKey="general"
                  title="Global Chat"
                  className="h-[28rem] border border-primary/20 bg-card/90 backdrop-blur-sm"
                  onConnectionStatusChange={handleGeneralConnection}
                  onParticipantCountChange={handleGeneralOnlineCount}
                />
              </TabsContent>
              <TabsContent value="city" className="mt-4">
                <RealtimeChatPanel
                  channelKey={`city-${currentCity?.id ?? 'lobby'}`}
                  title={cityTabLabel}
                  className="h-[28rem] border border-primary/20 bg-card/90 backdrop-blur-sm"
                  onConnectionStatusChange={handleCityConnection}
                  onParticipantCountChange={handleCityOnlineCount}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Skill Progress */}
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <CardTitle className="flex items-center gap-2">
                  <Guitar className="h-5 w-5 text-primary" />
                  Skill Progress
                </CardTitle>
                <Badge variant="outline" className="border-primary/40 text-primary">
                  Active {activeSkillCount}
                </Badge>
              </div>
              <CardDescription>
                {totalTrackedSkills > 0
                  ? `Tracking ${totalTrackedSkills} ${skillSummaryLabel} across your journey.`
                  : "Your practice sessions will appear here once you start leveling up."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {highlightedSkillProgress.length > 0 ? (
                highlightedSkillProgress.map(progressEntry => {
                  const level = Math.max(0, Number(progressEntry.current_level ?? 0));
                  const currentXp = Math.max(0, Number(progressEntry.current_xp ?? 0));
                  const requiredXp = Math.max(1, Number(progressEntry.required_xp ?? 100));
                  const percent = Math.min(100, (currentXp / requiredXp) * 100);
                  const label = formatSkillName(progressEntry.skill_slug);
                  const xpLabel = `${currentXp.toLocaleString()} / ${requiredXp.toLocaleString()} XP`;

                  return (
                    <div key={progressEntry.id ?? progressEntry.skill_slug} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{label}</span>
                        <span className="text-xs text-muted-foreground">Level {level} · {xpLabel}</span>
                      </div>
                      <Progress
                        value={percent}
                        className="h-2"
                        aria-label={`${label} progress level ${level} with ${xpLabel}`}
                      />
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">
                  Dive into practice sessions, education, and gigs to begin charting your progress. Your highlighted skills will
                  appear here as you level up.
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Core Attributes
              </CardTitle>
              <CardDescription>Signature traits that shape your performances</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {attributeKeys.map(attributeKey => {
                const value = Number(attributes?.[attributeKey] ?? 0);
                const percent = Math.min(100, (value / 1000) * 100);
                const label = formatAttributeLabel(attributeKey);
                return (
                  <div key={attributeKey} className="space-y-2">
                    <span className="font-medium text-sm">{label}</span>
                    <Progress
                      value={percent}
                      className="h-2"
                      aria-label={`${label} attribute score ${value} out of 1000`}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Band Info & Activity */}
          <div className="space-y-4">
            {/* Band Info */}
            <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Headphones className="h-5 w-5 text-accent" />
                  Solo Career
                </CardTitle>
                <CardDescription>Build your musical empire</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <p className="font-semibold">Independent Artist</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Next Goal</p>
                    <p className="font-semibold">Form a Band</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Music className="h-5 w-5 text-primary" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {activities.length > 0 ? activities.map(activity => {
                  const metadata = (activity.metadata as Record<string, unknown> | null) ?? null;
                  const skillPointsAwarded = toNumber(metadata?.skill_points);
                  const attributePointsAwarded = toNumber(metadata?.attribute_points);
                  const experienceConverted = toNumber(metadata?.experience_converted);
                  const bonusAwarded = toNumber(metadata?.bonus_awarded);
                  const experienceGainedFromBonus = toNumber(metadata?.experience_gained);
                  const streakCount = toNumber(metadata?.streak);
                  const isPointGrant = activity.activity_type === "point_grant";
                  const isWeeklyBonus = activity.activity_type === "weekly_bonus";

                  return (
                    <div key={activity.id} className="flex items-start gap-3 p-2 rounded-lg bg-secondary/30">
                      <div className="text-primary mt-0.5">
                        {getActivityIcon(activity.activity_type)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{activity.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(activity.created_at).toLocaleDateString()}
                        </p>
                        {activity.earnings > 0 && (
                          <Badge variant="outline" className="mt-1 text-xs border-success text-success">
                            +${activity.earnings}
                          </Badge>
                        )}
                        {isPointGrant && (
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            {skillPointsAwarded > 0 && (
                              <Badge variant="secondary" className="border-primary/20 bg-primary/10 text-primary">
                                +{skillPointsAwarded} skill {skillPointsAwarded === 1 ? "point" : "points"}
                              </Badge>
                            )}
                            {attributePointsAwarded > 0 && (
                              <Badge variant="secondary" className="border-primary/20 bg-primary/10 text-primary">
                                +{attributePointsAwarded} attribute {attributePointsAwarded === 1 ? "point" : "points"}
                              </Badge>
                            )}
                            {experienceConverted > 0 && (
                              <Badge variant="outline" className="border-primary/30 text-primary">
                                {experienceConverted} XP converted
                              </Badge>
                            )}
                          </div>
                        )}
                        {isWeeklyBonus && (
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            {bonusAwarded > 0 && (
                              <Badge variant="secondary" className="border-primary/20 bg-primary/10 text-primary">
                                +{bonusAwarded} XP bonus
                              </Badge>
                            )}
                            {experienceGainedFromBonus > 0 && (
                              <Badge variant="outline" className="border-primary/30 text-primary">
                                {experienceGainedFromBonus} XP earned
                              </Badge>
                            )}
                            {streakCount > 1 && (
                              <Badge variant="outline" className="border-primary/30 text-primary">
                                {streakCount}-week streak
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }) : (
                  <p className="text-center text-muted-foreground text-sm py-4">
                    No recent activity. Start your musical journey!
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  XP Ledger
                </CardTitle>
                <CardDescription>Weekly bonuses and other XP adjustments appear here.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentLedgerEntries.length > 0 ? recentLedgerEntries.map(entry => {
                  const entryMetadata = (entry.metadata as Record<string, unknown> | null) ?? null;
                  const sourceXp = toNumber(entryMetadata?.experience_gained);
                  const streak = toNumber(entryMetadata?.streak);
                  const recordedAt = parseDate(entry.created_at);
                  const recordedLabel = recordedAt
                    ? new Intl.DateTimeFormat(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      }).format(recordedAt)
                    : new Date(entry.created_at).toLocaleString();
                  const isGain = entry.xp_delta >= 0;
                  const badgeVariant = isGain ? "secondary" : "outline";
                  const badgeClasses = isGain
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-destructive/30 text-destructive";

                  return (
                    <div key={entry.id} className="flex items-start justify-between gap-3 rounded-lg border border-primary/10 bg-secondary/20 p-3">
                      <div>
                        <p className="text-sm font-medium">{formatLedgerEvent(entry.event_type)}</p>
                        <p className="text-xs text-muted-foreground">{recordedLabel} UTC</p>
                        {entry.event_type === "weekly_bonus" && sourceXp > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Based on {sourceXp} XP earned{streak > 1 ? ` • ${streak}-week streak` : ""}
                          </p>
                        )}
                      </div>
                      <Badge variant={badgeVariant} className={badgeClasses}>
                        {entry.xp_delta >= 0 ? "+" : ""}{entry.xp_delta} XP
                      </Badge>
                    </div>
                  );
                }) : (
                  <p className="text-center text-muted-foreground text-sm py-4">
                    No XP adjustments yet. Keep playing to unlock your first weekly bonus.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;