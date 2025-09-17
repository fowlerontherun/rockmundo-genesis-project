import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/use-auth-context";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Heart, AlertTriangle, MessageSquare, Star, Coffee, Loader2, Target } from "lucide-react";

type ProfileSkillProgressRow = Database["public"]["Tables"]["profile_skill_progress"]["Row"];
type ProfileSkillUnlockRow = Database["public"]["Tables"]["profile_skill_unlocks"]["Row"];
type SkillDefinitionRow = Database["public"]["Tables"]["skill_definitions"]["Row"];

type ProfileSkillProgressWithDefinition = ProfileSkillProgressRow & {
  skill_definitions?: Pick<SkillDefinitionRow, "slug"> | null;
};

type ProfileSkillUnlockWithDefinition = ProfileSkillUnlockRow & {
  skill_definitions?: Pick<SkillDefinitionRow, "slug"> | null;
};

const SKILL_LABELS: Record<string, string> = {
  guitar: "Guitar",
  vocals: "Vocals",
  drums: "Drums",
  bass: "Bass",
  performance: "Performance",
  songwriting: "Songwriting",
};

const CORE_SKILL_SLUGS = Object.keys(SKILL_LABELS);

type SkillEntry = {
  level: number;
  unlocked: boolean;
  hasProgress: boolean;
};

type SkillMap = Record<string, SkillEntry>;

type SkillStatusType = "ready" | "developing" | "locked" | "missing";

type SkillStatus = {
  slug: string;
  label: string;
  level: number;
  unlocked: boolean;
  hasProgress: boolean;
  status: SkillStatusType;
};

const formatSkillLabel = (slug: string) =>
  SKILL_LABELS[slug] ??
  slug
    .split(/[-_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const resolveSkillSlug = (
  item:
    | ProfileSkillProgressWithDefinition
    | ProfileSkillUnlockWithDefinition
    | { skill_slug: string | null; skill_definitions?: Pick<SkillDefinitionRow, "slug"> | null }
) => item.skill_slug ?? item.skill_definitions?.slug ?? null;

const mapSkillProgress = (
  progressRows: ProfileSkillProgressWithDefinition[] | null | undefined,
  unlockRows: ProfileSkillUnlockWithDefinition[] | null | undefined
): SkillMap => {
  const map: SkillMap = {};

  const unlockSlugs = new Set(
    (unlockRows ?? [])
      .map((unlock) => resolveSkillSlug(unlock))
      .filter((slug): slug is string => Boolean(slug))
  );

  (progressRows ?? []).forEach((row) => {
    const slug = resolveSkillSlug(row);
    if (!slug) return;
    const level = typeof row.current_level === "number" ? row.current_level : 0;
    const unlocked = unlockSlugs.has(slug) || level > 0;
    map[slug] = {
      level,
      unlocked,
      hasProgress: true,
    };
  });

  (unlockRows ?? []).forEach((unlock) => {
    const slug = resolveSkillSlug(unlock);
    if (!slug) return;
    if (!map[slug]) {
      map[slug] = {
        level: 0,
        unlocked: true,
        hasProgress: false,
      };
    } else if (!map[slug].unlocked) {
      map[slug] = {
        ...map[slug],
        unlocked: true,
      };
    }
  });

  CORE_SKILL_SLUGS.forEach((slug) => {
    if (!map[slug]) {
      map[slug] = {
        level: 0,
        unlocked: unlockSlugs.has(slug),
        hasProgress: false,
      };
    }
  });

  return map;
};

const getSkillEntry = (skills: SkillMap | undefined, slug: string): SkillEntry =>
  skills?.[slug] ?? {
    level: 0,
    unlocked: false,
    hasProgress: false,
  };

const getEffectiveSkillLevel = (skills: SkillMap | undefined, slug: string) => {
  const entry = getSkillEntry(skills, slug);
  return entry.unlocked ? entry.level : 0;
};

const getRelevantSkillSlugs = (role: string) => {
  const normalized = role.toLowerCase();
  const slugs = new Set<string>(["performance", "songwriting"]);

  if (normalized.includes("guitar")) {
    slugs.add("guitar");
  }
  if (normalized.includes("vocal") || normalized.includes("singer") || normalized.includes("front")) {
    slugs.add("vocals");
  }
  if (normalized.includes("drum")) {
    slugs.add("drums");
  }
  if (normalized.includes("bass")) {
    slugs.add("bass");
  }
  if (
    normalized.includes("song") ||
    normalized.includes("writer") ||
    normalized.includes("compose") ||
    normalized.includes("lyric")
  ) {
    slugs.add("songwriting");
  }
  if (normalized.includes("keyboard") || normalized.includes("piano") || normalized.includes("synth")) {
    slugs.add("songwriting");
    slugs.add("performance");
  }
  if (normalized.includes("producer") || normalized.includes("studio")) {
    slugs.add("songwriting");
  }

  return Array.from(slugs);
};

const buildSkillStatuses = (role: string, skills: SkillMap): SkillStatus[] => {
  const relevantSlugs = getRelevantSkillSlugs(role);

  return relevantSlugs.map((slug) => {
    const entry = getSkillEntry(skills, slug);
    const label = formatSkillLabel(slug);
    let status: SkillStatusType;

    if (!entry.hasProgress && !entry.unlocked) {
      status = "missing";
    } else if (!entry.unlocked) {
      status = "locked";
    } else if (entry.level >= 60) {
      status = "ready";
    } else {
      status = "developing";
    }

    return {
      slug,
      label,
      level: entry.unlocked ? entry.level : 0,
      unlocked: entry.unlocked,
      hasProgress: entry.hasProgress,
      status,
    };
  });
};

type BandMemberCard = {
  id: string;
  userId: string;
  name: string;
  instrument: string;
  mood: string;
  morale: number;
  chemistry: number;
  skill: number;
  loyalty: number;
  energy: number;
  avatar: string;
  personality: string;
  issues: string[];
  strengths: string[];
  skills: SkillMap;
  skillStatuses: SkillStatus[];
};

type TeamEvent = {
  id: number;
  name: string;
  cost: number;
  moraleBenefit: number;
  chemistryBenefit: number;
  duration: string;
  description: string;
};

type ConflictSeverity = "High" | "Medium" | "Low";

type BandConflict = {
  id: number;
  type: string;
  members: string[];
  severity: ConflictSeverity;
  description: string;
  timeAgo: string;
  resolved: boolean;
  moraleDelta: number;
  chemistryDelta: number;
  cost: number;
};

const clampStat = (value: number) => Math.max(0, Math.min(100, value));

const getMoodFromMorale = (morale: number) => {
  if (morale >= 85) return "Excited";
  if (morale >= 70) return "Motivated";
  if (morale >= 55) return "Content";
  if (morale >= 40) return "Neutral";
  return "Frustrated";
};

const getRoleAvatar = (role: string) => {
  const normalized = role.toLowerCase();
  if (normalized.includes("drum")) return "🥁";
  if (normalized.includes("bass")) return "🎵";
  if (normalized.includes("keyboard") || normalized.includes("piano")) return "🎹";
  if (normalized.includes("vocal")) return "🎤";
  if (normalized.includes("guitar")) return "🎸";
  return "🎼";
};

const getRolePersonality = (role: string) => {
  const normalized = role.toLowerCase();
  if (normalized.includes("lead")) return "Dynamic";
  if (normalized.includes("bass")) return "Steady";
  if (normalized.includes("drum")) return "Intense";
  if (normalized.includes("keyboard")) return "Harmonious";
  if (normalized.includes("vocal")) return "Charismatic";
  return "Collaborative";
};

const getRoleStrengths = (
  role: string,
  skills?: SkillMap | null,
  precomputedStatuses?: SkillStatus[]
) => {
  const strengths: string[] = [];
  const statuses = precomputedStatuses ?? (skills ? buildSkillStatuses(role, skills) : []);

  if (statuses.length > 0) {
    const ready = statuses
      .filter((status) => status.status === "ready")
      .sort((a, b) => b.level - a.level);
    ready.slice(0, 2).forEach((status) => {
      strengths.push(`${status.label} expertise (Lvl ${status.level})`);
    });

    if (strengths.length < 2) {
      const developing = statuses
        .filter((status) => status.status === "developing")
        .sort((a, b) => b.level - a.level);
      developing.slice(0, 2 - strengths.length).forEach((status) => {
        strengths.push(`${status.label} developing (Lvl ${status.level})`);
      });
    }

    if (strengths.length === 0) {
      const locked = statuses.filter((status) => status.status === "locked");
      if (locked.length > 0) {
        strengths.push(`Unlock ${locked[0].label} to meet role needs`);
      } else {
        const missing = statuses.filter((status) => status.status === "missing");
        if (missing.length > 0) {
          strengths.push(`${missing[0].label} skill data missing`);
        }
      }
    }
  }

  if (strengths.length === 0) {
    const normalized = role.toLowerCase();
    if (normalized.includes("drum")) return ["Powerful beats", "Precise timing"];
    if (normalized.includes("bass")) return ["Solid groove", "Reliable foundation"];
    if (normalized.includes("keyboard")) return ["Arrangement skills", "Melodic layers"];
    if (normalized.includes("vocal")) return ["Stage charisma", "Audience connection"];
    if (normalized.includes("guitar")) return ["Creative riffs", "Showmanship"];
    return ["Team-focused", "Adaptable performer"];
  }

  return strengths;
};

const deriveIssues = (morale: number, statuses: SkillStatus[]) => {
  const issues = new Set<string>();

  if (morale < 45) {
    issues.add("Needs support");
    issues.add("Seeking clearer communication");
  } else if (morale < 60) {
    issues.add("Wants more creative input");
  }

  statuses.forEach((status) => {
    if (status.status === "locked") {
      issues.add(`${status.label} skill locked for this role`);
    } else if (status.status === "missing") {
      issues.add(`${status.label} skill data missing`);
    } else if (status.status === "developing") {
      issues.add(`${status.label} skill needs development (Lvl ${status.level})`);
    }
  });

  return Array.from(issues);
};

const calculateSkillAverage = (skills?: SkillMap | null) => {
  if (!skills) return 60;
  const entries = CORE_SKILL_SLUGS.map((slug) => getSkillEntry(skills, slug));
  const hasData = entries.some((entry) => entry.hasProgress || entry.unlocked);
  if (!hasData) return 60;

  const total = entries.reduce((sum, entry) => sum + (entry.unlocked ? entry.level : 0), 0);
  return Math.round(total / entries.length);
};

const getMoodColor = (mood: string) => {
  switch (mood) {
    case "Excited":
      return "text-blue-300";
    case "Motivated":
      return "text-green-400";
    case "Content":
      return "text-yellow-400";
    case "Neutral":
      return "text-cream/70";
    case "Frustrated":
      return "text-red-400";
    default:
      return "text-gray-400";
  }
};

const getChemistryColor = (chemistry: number) => {
  if (chemistry >= 80) return "text-green-400";
  if (chemistry >= 60) return "text-yellow-400";
  if (chemistry >= 40) return "text-orange-400";
  return "text-red-400";
};

const getSeverityColor = (severity: ConflictSeverity) => {
  switch (severity) {
    case "High":
      return "bg-red-500";
    case "Medium":
      return "bg-yellow-500";
    case "Low":
      return "bg-blue-500";
    default:
      return "bg-gray-500";
  }
};

const buildErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Please try again.";
const teamEvents: TeamEvent[] = [
  {
    id: 1,
    name: "Band Dinner",
    cost: 200,
    moraleBenefit: 15,
    chemistryBenefit: 10,
    duration: "2 hours",
    description: "Casual dinner to bond and discuss music",
  },
  {
    id: 2,
    name: "Studio Jam Session",
    cost: 500,
    moraleBenefit: 20,
    chemistryBenefit: 25,
    duration: "4 hours",
    description: "Free-form creative session to build musical chemistry",
  },
  {
    id: 3,
    name: "Team Building Retreat",
    cost: 2000,
    moraleBenefit: 35,
    chemistryBenefit: 40,
    duration: "2 days",
    description: "Weekend retreat focused on communication and collaboration",
  },
];

const initialConflicts: BandConflict[] = [
  {
    id: 1,
    type: "Creative Difference",
    members: ["Alex Rivera", "Sam Taylor"],
    severity: "Medium",
    description: "Disagreement over song arrangement for new single",
    timeAgo: "2 days ago",
    resolved: false,
    moraleDelta: 12,
    chemistryDelta: 9,
    cost: 150,
  },
  {
    id: 2,
    type: "Schedule Conflict",
    members: ["Sam Taylor"],
    severity: "Low",
    description: "Wants different rehearsal times due to side job",
    timeAgo: "1 week ago",
    resolved: false,
    moraleDelta: 8,
    chemistryDelta: 6,
    cost: 0,
  },
];

const BandChemistry = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [skillDefinitions, setSkillDefinitions] = useState<SkillDefinitionRow[]>([]);
  const [bandId, setBandId] = useState<string | null>(null);
  const [bandMembers, setBandMembers] = useState<BandMemberCard[]>([]);
  const [bandMorale, setBandMorale] = useState(0);
  const [bandEventCount, setBandEventCount] = useState(0);
  const [recentConflicts, setRecentConflicts] = useState<BandConflict[]>(() => initialConflicts);
  const [loading, setLoading] = useState(true);
  const [processingEventId, setProcessingEventId] = useState<number | null>(null);
  const [resolvingConflictId, setResolvingConflictId] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadDefinitions = async () => {
      const { data, error } = await supabase
        .from("skill_definitions")
        .select("id, slug, name, display_order")
        .order("display_order", { ascending: true });

      if (!error && isMounted) {
        setSkillDefinitions(data ?? []);
      }
    };

    void loadDefinitions();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (skillDefinitions.length === 0) {
      return;
    }

    setBandMembers(previousMembers =>
      previousMembers.map(member => {
        const skillAverage = calculateSkillAverage(member.skills);
        const loyalty = clampStat(40 + Math.round(skillAverage / 5));
        const performanceScore = (() => {
          const value = getSkillLevel(member.skills, "performance", 0);
          return typeof value === "number" ? value : 0;
        })();
        const songwritingScore = (() => {
          const value = getSkillLevel(member.skills, "songwriting", 0);
          return typeof value === "number" ? value : 0;
        })();
        const energy = clampStat(
          60 + Math.round((performanceScore + songwritingScore) / 4)
        );
        const strengths = getRoleStrengths(member.instrument, member.skills);

        if (
          member.skill === skillAverage &&
          member.loyalty === loyalty &&
          member.energy === energy &&
          member.strengths.join("|") === strengths.join("|")
        ) {
          return member;
        }

        return {
          ...member,
          skill: skillAverage,
          loyalty,
          energy,
          strengths
        };
      })
    );
  }, [calculateSkillAverage, getRoleStrengths, skillDefinitions]);

  const averageChemistry = useMemo(() => {
    if (bandMembers.length === 0) return 0;
    const total = bandMembers.reduce((sum, member) => sum + member.chemistry, 0);
    return Math.round(total / bandMembers.length);
  }, [bandMembers]);

  const activeConflicts = useMemo(
    () => recentConflicts.filter((conflict) => !conflict.resolved).length,
    [recentConflicts]
  );

  const calculateSkillAverage = useCallback(
    (skills?: SkillLevelMap | null) => {
      if (!skills) return 0;

      const slugs = collectSkillSlugs(skillDefinitions, skills);
      const values = slugs
        .map(slug => getSkillLevel(skills, slug, 0))
        .filter((value): value is number => typeof value === "number");

      if (values.length === 0) {
        return 0;
      }

      const total = values.reduce((sum, value) => sum + value, 0);
      return Math.round(total / values.length);
    },
    [skillDefinitions]
  );

  const getRoleStrengths = useCallback(
    (role: string, skills?: SkillLevelMap | null) => {
      if (!skills) {
        return getDefaultStrengths(role);
      }

      const slugs = collectSkillSlugs(skillDefinitions, skills);
      if (slugs.length === 0) {
        return getDefaultStrengths(role);
      }

      const entries = slugs.map(slug => {
        const value = getSkillLevel(skills, slug, 0);
        return {
          slug,
          value: typeof value === "number" ? value : 0,
          label: getSkillLabel(slug, skillDefinitions)
        };
      });

      entries.sort((a, b) => b.value - a.value);

      const strengths: string[] = [];
      entries.forEach(entry => {
        if (entry.value > 0 && strengths.length < 2) {
          strengths.push(`${entry.label} expertise`);
        }
      });

      if (strengths.length < 2) {
        entries
          .filter(entry => entry.value <= 0)
          .slice(0, 2 - strengths.length)
          .forEach(entry => {
            strengths.push(`${entry.label} (Locked)`);
          });
      }

      return strengths.length > 0 ? strengths : getDefaultStrengths(role);
    },
    [skillDefinitions]
  );

  const fetchProfileSkillMap = useCallback(
    async (profileId: string | null): Promise<SkillLevelMap> => {
      if (!profileId) {
        return {};
      }

      const { data, error } = await supabase
        .from("profile_skill_progress")
        .select("skill_id, skill_slug, current_level, skill_definitions ( slug, name )")
        .eq("profile_id", profileId);

      if (error) {
        console.error("Error loading skills data:", error);
        return {};
      }

      return buildSkillLevelMap(
        (data as SkillProgressWithDefinition[] | null | undefined) ?? [],
        skillDefinitions
      );
    },
    [skillDefinitions]
  );

  const fetchPrimaryBandId = useCallback(async (): Promise<string | null> => {
    if (!user) return null;
    const { data: leaderBands, error: leaderError } = await supabase
      .from("bands")
      .select("id")
      .eq("leader_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1);

    if (leaderError) throw leaderError;
    if (leaderBands && leaderBands.length > 0) return leaderBands[0].id;

    const { data: memberBands, error: memberError } = await supabase
      .from("band_members")
      .select("band_id")
      .eq("user_id", user.id)
      .limit(1);

    if (memberError) throw memberError;
    if (memberBands && memberBands.length > 0) return memberBands[0].band_id;

    return null;
  }, [user]);

  const fetchBandEventCount = useCallback(async (targetBandId: string) => {
    const { count, error } = await supabase
      .from("band_events")
      .select("*", { head: true, count: "exact" })
      .eq("band_id", targetBandId);

    if (error) {
      console.error("Error fetching band event count:", error);
      return;
    }

    setBandEventCount(count ?? 0);
  }, []);

  const fetchBandMembers = useCallback(async (targetBandId: string) => {
    const { data: membersData, error: membersError } = await supabase
      .from("band_members")
      .select("id, user_id, role, morale, chemistry")
      .eq("band_id", targetBandId);

    if (membersError) throw membersError;

    const members: BandMemberCard[] = await Promise.all(
      (membersData ?? []).map(async (member) => {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url, level")
          .eq("user_id", member.user_id)
          .eq("is_active", true)
          .maybeSingle();

        if (profileError) {
          console.error("Error loading profile data:", profileError);
        }

        let skillMap = mapSkillProgress([], []);

        if (profileData?.id) {
          const [
            { data: progressData, error: progressError },
            { data: unlocksData, error: unlocksError },
          ] = await Promise.all([
            supabase
              .from("profile_skill_progress")
              .select(
                `
                  current_level,
                  skill_id,
                  skill_slug,
                  skill_definitions!inner (
                    slug
                  )
                `
              )
              .eq("profile_id", profileData.id),
            supabase
              .from("profile_skill_unlocks")
              .select(
                `
                  skill_id,
                  skill_slug,
                  skill_definitions!inner (
                    slug
                  )
                `
              )
              .eq("profile_id", profileData.id),
          ]);

          if (progressError) {
            console.error("Error loading skill progress:", progressError);
          }

          if (unlocksError) {
            console.error("Error loading skill unlocks:", unlocksError);
          }

          skillMap = mapSkillProgress(
            (progressData as ProfileSkillProgressWithDefinition[]) ?? [],
            (unlocksData as ProfileSkillUnlockWithDefinition[]) ?? []
          );
        }

        const morale = member.morale ?? 60;
        const chemistry = member.chemistry ?? 60;
        const roleLabel = member.role || "Band Member";
        const skillStatuses = buildSkillStatuses(roleLabel, skillMap);
        const skillAverage = calculateSkillAverage(skillMap);
        const energy = clampStat(
          60 +
            Math.round(
              (getEffectiveSkillLevel(skillMap, "performance") +
                getEffectiveSkillLevel(skillMap, "songwriting")) /
                4
            )
        );

        return {
          id: member.id,
          userId: member.user_id,
          name: profileData?.display_name ?? profileData?.username ?? "Band Member",
          instrument: roleLabel,
          mood: getMoodFromMorale(morale),
          morale,
          chemistry,
          skill: skillAverage,
          loyalty: clampStat(40 + Math.round(skillAverage / 5)),
          energy,
          avatar: getRoleAvatar(roleLabel),
          personality: getRolePersonality(roleLabel),
          issues: deriveIssues(morale, skillStatuses),
          strengths: getRoleStrengths(roleLabel, skillMap, skillStatuses),
          skills: skillMap,
          skillStatuses,
        };
      })
    );

    setBandMembers(members);

    const moraleAverage =
      members.length > 0
        ? Math.round(members.reduce((sum, member) => sum + member.morale, 0) / members.length)
        : 0;
    setBandMorale(moraleAverage);
  }, [calculateSkillAverage, fetchProfileSkillMap, getRoleStrengths]);

  const initializeBandData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const primaryBandId = await fetchPrimaryBandId();

      if (!primaryBandId) {
        setBandId(null);
        setBandMembers([]);
        setBandMorale(0);
        setBandEventCount(0);
        return;
      }

      setBandId(primaryBandId);
      await Promise.all([fetchBandMembers(primaryBandId), fetchBandEventCount(primaryBandId)]);
    } catch (error) {
      console.error("Error loading band chemistry data:", error);
      toast({
        title: "Unable to load band chemistry",
        description: buildErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [fetchBandEventCount, fetchBandMembers, fetchPrimaryBandId, toast, user]);

  const refreshBandData = useCallback(async () => {
    if (!bandId) return;
    await Promise.all([fetchBandMembers(bandId), fetchBandEventCount(bandId)]);
  }, [bandId, fetchBandEventCount, fetchBandMembers]);

  useEffect(() => {
    void initializeBandData();
  }, [initializeBandData]);
  const handleTeamEvent = async (event: TeamEvent) => {
    if (!bandId || !user) {
      toast({
        title: "Band not available",
        description: "Join or create a band to schedule events.",
        variant: "destructive",
      });
      return;
    }

    setProcessingEventId(event.id);

    try {
      const { error: insertError } = await supabase.from("band_events").insert({
        band_id: bandId,
        triggered_by: user.id,
        event_type: "team_event",
        cost: event.cost,
        morale_change: event.moraleBenefit,
        chemistry_change: event.chemistryBenefit,
        metadata: { eventId: event.id, eventName: event.name },
      });

      if (insertError) throw insertError;

      await Promise.all(
        bandMembers.map(async (member) => {
          const morale = clampStat(member.morale + event.moraleBenefit);
          const chemistry = clampStat(member.chemistry + event.chemistryBenefit);

          const { error: updateError } = await supabase
            .from("band_members")
            .update({ morale, chemistry })
            .eq("id", member.id);

          if (updateError) throw updateError;
        })
      );

      await refreshBandData();

      toast({
        title: "Team Event Scheduled!",
        description: `${event.name} will improve band chemistry and morale.`,
      });
    } catch (error) {
      console.error("Error scheduling team event:", error);
      toast({
        title: "Unable to schedule event",
        description: buildErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setProcessingEventId(null);
    }
  };

  const handleResolveConflict = async (conflictId: number) => {
    if (!bandId || !user) {
      toast({
        title: "Band not available",
        description: "Join or create a band to resolve conflicts.",
        variant: "destructive",
      });
      return;
    }

    const conflict = recentConflicts.find((item) => item.id === conflictId);
    if (!conflict) return;

    setResolvingConflictId(conflictId);

    try {
      const { error: insertError } = await supabase.from("band_events").insert({
        band_id: bandId,
        triggered_by: user.id,
        event_type: "conflict_resolution",
        cost: conflict.cost,
        morale_change: conflict.moraleDelta,
        chemistry_change: conflict.chemistryDelta,
        metadata: {
          conflictId: conflict.id,
          conflictType: conflict.type,
          members: conflict.members,
          severity: conflict.severity,
        },
      });

      if (insertError) throw insertError;

      const targetedMembers = bandMembers.filter((member) =>
        conflict.members.includes(member.name)
      );
      const membersToAdjust = targetedMembers.length > 0 ? targetedMembers : bandMembers;

      await Promise.all(
        membersToAdjust.map(async (member) => {
          const morale = clampStat(member.morale + conflict.moraleDelta);
          const chemistry = clampStat(member.chemistry + conflict.chemistryDelta);

          const { error: updateError } = await supabase
            .from("band_members")
            .update({ morale, chemistry })
            .eq("id", member.id);

          if (updateError) throw updateError;
        })
      );

      await refreshBandData();

      setRecentConflicts((previous) =>
        previous.map((item) =>
          item.id === conflictId ? { ...item, resolved: true, timeAgo: "Just now" } : item
        )
      );

      toast({
        title: "Conflict Resolved!",
        description: "The band conflict has been successfully mediated.",
      });
    } catch (error) {
      console.error("Error resolving conflict:", error);
      toast({
        title: "Unable to resolve conflict",
        description: buildErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setResolvingConflictId(null);
    }

    return conflict.involved_member_ids
      .map(memberId => bandMembers.find(member => member.member_id === memberId)?.member_name)
      .filter((name): name is string => Boolean(name));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-primary p-6">
        <div className="mx-auto flex min-h-[60vh] max-w-7xl flex-col items-center justify-center space-y-4 text-cream">
          <Loader2 className="h-10 w-10 animate-spin" />
          <p className="text-xl font-oswald tracking-wide">Loading band chemistry insights...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-primary p-6">
      <div className="mx-auto space-y-6 max-w-7xl">
        <div className="space-y-4 text-center">
          <h1 className="text-5xl font-bebas tracking-wider text-cream">BAND CHEMISTRY</h1>
          <p className="text-xl font-oswald text-cream/80">
            Manage relationships and keep the band together
          </p>
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-2 text-cream">
              <Heart className="h-6 w-6" />
              <span className="text-lg">Band Morale: {bandMoraleDisplay}/100</span>
            </div>
          </div>
          {!bandId && (
            <p className="text-sm font-oswald uppercase tracking-[0.35em] text-cream/60">
              Join or create a band to unlock chemistry analytics
            </p>
          )}
        </div>
        <Tabs defaultValue="members" className="space-y-6">
          <TabsList className="grid w-full max-w-lg grid-cols-4">
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="conflicts">Conflicts</TabsTrigger>
            <TabsTrigger value="events">Team Events</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="space-y-6">
            {bandMembers.length === 0 ? (
              <Card className="border-accent bg-card/80">
                <CardContent className="pt-6 text-center text-cream/80">
                  <p>
                    No band members found. Invite musicians to start tracking morale and chemistry.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {bandMembers.map((member) => (
                  <Card key={member.id} className="border-accent bg-card/80">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="text-3xl">{member.avatar}</div>
                          <div>
                            <CardTitle className="text-cream">{member.name}</CardTitle>
                            <CardDescription>{member.instrument}</CardDescription>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="mb-1">
                            {member.personality}
                          </Badge>
                          <p className={`text-sm font-semibold ${getMoodColor(member.mood)}`}>
                            {member.mood}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-cream/60">Chemistry</span>
                              <span className={`font-bold ${getChemistryColor(member.chemistry)}`}>
                                {member.chemistry}%
                              </span>
                            </div>
                            <Progress value={member.chemistry} className="h-2" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-cream/60">Skill</span>
                              <span className="font-bold text-accent">{member.skill}%</span>
                            </div>
                            <Progress value={member.skill} className="h-2" />
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-cream/60">Loyalty</span>
                              <span className="font-bold text-accent">{member.loyalty}%</span>
                            </div>
                            <Progress value={member.loyalty} className="h-2" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-cream/60">Energy</span>
                              <span className="font-bold text-accent">{member.energy}%</span>
                            </div>
                            <Progress value={member.energy} className="h-2" />
                          </div>
                        </div>
                      </div>

                      {member.skillStatuses.length > 0 && (
                        <div className="space-y-2">
                          <p className="flex items-center gap-1 text-sm text-cream/60">
                            <Target className="h-4 w-4" />
                            Role Requirements
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {member.skillStatuses.map((status) => {
                              let badgeClass = "border-slate-500 text-slate-300";

                              if (status.status === "ready") {
                                badgeClass = "border-green-500 text-green-300";
                              } else if (status.status === "developing") {
                                badgeClass = "border-yellow-500 text-yellow-300";
                              } else if (status.status === "locked") {
                                badgeClass = "border-red-500 text-red-300";
                              }

                              const statusText =
                                status.status === "ready" || status.status === "developing"
                                  ? `Lvl ${status.level}`
                                  : status.status === "locked"
                                  ? "Locked"
                                  : "No data";

                              return (
                                <Badge
                                  key={status.slug}
                                  variant="outline"
                                  className={`text-xs ${badgeClass}`}
                                >
                                  {status.label}: {statusText}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {member.issues.length > 0 && (
                        <div className="space-y-2">
                          <p className="flex items-center gap-1 text-sm text-cream/60">
                            <AlertTriangle className="h-4 w-4" />
                            Current Issues
                          </p>
                          <div className="space-y-1">
                            {member.issues.map((issue, index) => (
                              <Badge key={index} variant="destructive" className="mr-1 text-xs">
                                {issue}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <p className="flex items-center gap-1 text-sm text-cream/60">
                          <Star className="h-4 w-4" />
                          Strengths
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {member.strengths.map((strength, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {strength}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 bg-accent text-background hover:bg-accent/80"
                          disabled={!bandId}
                        >
                          <MessageSquare className="mr-1 h-4 w-4" />
                          Talk
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-accent text-accent hover:bg-accent/10"
                          disabled={!bandId}
                        >
                          <Coffee className="mr-1 h-4 w-4" />
                          Hang Out
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="conflicts" className="space-y-6">
            <div className="space-y-4">
              {recentConflicts.length > 0 ? (
                recentConflicts.map((conflict) => (
                  <Card key={conflict.id} className="border-accent bg-card/80">
                    <CardContent className="pt-6">
                      <div className="mb-4 flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold text-cream">{conflict.type}</h3>
                            <Badge className={`${getSeverityColor(conflict.severity)} text-white`}>
                              {conflict.severity}
                            </Badge>
                            {conflict.resolved && (
                              <Badge variant="outline" className="border-green-500 text-green-300">
                                Resolved
                              </Badge>
                            )}
                          </div>
                          <p className="text-cream/80">{conflict.description}</p>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-cream/60">
                            <span>Members: {conflict.members.join(", ")}</span>
                            <span>{conflict.timeAgo}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleResolveConflict(conflict.id)}
                            size="sm"
                            className="bg-accent text-background hover:bg-accent/80"
                            disabled={!bandId || conflict.resolved || resolvingConflictId === conflict.id}
                          >
                            {resolvingConflictId === conflict.id ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Mediating...
                              </>
                            ) : conflict.resolved ? (
                              "Resolved"
                            ) : (
                              "Mediate"
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-accent text-accent hover:bg-accent/10"
                            disabled={!bandId}
                          >
                            <Coffee className="h-4 w-4 mr-1" />
                            Hang Out
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="border-accent bg-card/80">
                  <CardContent className="pt-6 text-center">
                    <Heart className="mx-auto mb-4 h-12 w-12 text-accent" />
                    <h3 className="mb-2 text-xl font-semibold text-cream">All Good!</h3>
                    <p className="text-cream/80">
                      No current conflicts in the band. Keep up the great chemistry!
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="events" className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {teamEvents.map((event) => (
                <Card key={event.id} className="border-accent bg-card/80">
                  <CardHeader>
                    <CardTitle className="text-cream">{event.name}</CardTitle>
                    <CardDescription>{event.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-sm text-cream/60">Cost</p>
                        <p className="text-lg font-bold text-accent">${event.cost}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-cream/60">Duration</p>
                        <p className="text-cream">{event.duration}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm text-cream/60">Benefits</p>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-xs">
                          +{event.moraleBenefit} Morale
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          +{event.chemistryBenefit} Chemistry
                        </Badge>
                      </div>
                    </div>

                    <Button
                      onClick={() => handleTeamEvent(event)}
                      className="w-full bg-accent text-background hover:bg-accent/80"
                      disabled={!bandId || processingEventId === event.id}
                    >
                      {processingEventId === event.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Scheduling...
                        </>
                      ) : (
                        "Schedule Event"
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <Card className="border-accent bg-card/80">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-cream">Average Chemistry</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">{averageChemistry}%</div>
                  <p className="text-sm text-cream/60">
                    {averageChemistry >= 75
                      ? "Great harmony"
                      : averageChemistry >= 50
                      ? "Solid cohesion"
                      : "Needs attention"}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-accent bg-card/80">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-cream">Active Conflicts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">{activeConflicts}</div>
                  <p className="text-sm text-cream/60">Items still requiring mediation</p>
                </CardContent>
              </Card>
              <Card className="border-accent bg-card/80">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-cream">Team Events Logged</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">{bandEventCount}</div>
                  <p className="text-sm text-cream/60">Tracked morale and chemistry boosters</p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-accent bg-card/80">
              <CardHeader>
                <CardTitle className="text-cream">Member Performance Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {bandMembers.map((member) => {
                    const lockedCount = member.skillStatuses.filter((status) => status.status === "locked")
                      .length;
                    const missingCount = member.skillStatuses.filter((status) => status.status === "missing")
                      .length;
                    const unmetRequirements = lockedCount + missingCount;

                    return (
                      <div key={member.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{member.avatar}</span>
                            <span className="font-semibold text-cream">{member.name}</span>
                          </div>
                          <div className="text-right">
                            <span className={`font-bold ${getChemistryColor(member.chemistry)}`}>
                              {member.chemistry}% Chemistry
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-cream/60">Skill: </span>
                            <span className="text-accent">{member.skill}%</span>
                          </div>
                          <div>
                            <span className="text-cream/60">Loyalty: </span>
                            <span className="text-accent">{member.loyalty}%</span>
                          </div>
                          <div>
                            <span className="text-cream/60">Energy: </span>
                            <span className="text-accent">{member.energy}%</span>
                          </div>
                          <div>
                            <span className="text-cream/60">Morale: </span>
                            <span className="text-accent">{member.morale}%</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-cream/60">
                          <span>
                            Issues:{" "}
                            <span className={member.issues.length > 0 ? "text-red-400" : "text-green-400"}>
                              {member.issues.length}
                            </span>
                          </span>
                          <span>
                            Strengths:{" "}
                            {member.strengths.length > 0 ? member.strengths.slice(0, 2).join(", ") : "—"}
                          </span>
                          <span>
                            Locked/Missing:{" "}
                            <span className={unmetRequirements > 0 ? "text-red-400" : "text-green-400"}>
                              {unmetRequirements}
                            </span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BandChemistry;
