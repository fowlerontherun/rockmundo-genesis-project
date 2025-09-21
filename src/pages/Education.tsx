import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  BookOpen,
  Clock,
  Gauge,
  GraduationCap,
  Loader2,
  Play,
  PlaySquare,
  Sparkles,
  Timer,
  Trophy,
  Users
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { useGameData } from "@/hooks/useGameData";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  DIFFICULTY_ORDER,
  LESSON_DIFFICULTIES,
  LESSON_DIFFICULTY_CONFIG,
  SKILL_LABELS,
  type LessonDifficulty,
  type PrimarySkill
} from "@/features/education/constants";
import { useEducationVideoPlaylists } from "@/features/education/hooks/useEducationVideoPlaylists";
import { awardActionXp } from "@/utils/progression";
import {
  ATTRIBUTE_KEYS,
  applyAttributeToValue,
  calculateAttributeMultiplier,
  SKILL_ATTRIBUTE_MAP,
  type AttributeKey
} from "@/utils/attributeProgression";
import type { Band } from "@/types/database";

const tabItems = [
  {
    value: "books",
    label: "Books",
    icon: BookOpen,
    blurb: "Deep dives, playbooks, and creative inspiration for every stage of your music journey."
  },
  {
    value: "university",
    label: "University",
    icon: GraduationCap,
    blurb: "Accredited pathways and stackable certificates that sync with touring life."

  },
  {
    value: "videos",
    label: "YouTube Videos",
    icon: PlaySquare,
    blurb: "High-impact playlists and channels to keep your technique sharp on demand."

  },
  {
    value: "mentors",
    label: "Mentors",
    icon: Users,
    blurb: "Coaching collectives and expert rosters for personalized feedback loops."

  },
  {
    value: "band",
    label: "Band Learning",
    icon: Sparkles,
    blurb: "Immersive programs that level up your entire crew together."
  }
];

const BASE_XP_PER_MINUTE = 2.2;
const REPEAT_STACK_BONUS = 0.07;
const MAX_REPEAT_STACKS = 5;
const LESSON_SKILL_GAIN_RATIO = 0.75;
const BAND_SKILL_GAIN_RATIO = 0.85;
const TEAM_SIZE_BONUS = 0.08;
const SYNERGY_CAP = 0.35;

const VIDEO_VIEW_STORAGE_KEY = "education_skill_view_counts_v1";
const MENTOR_COOLDOWN_STORAGE_KEY = "education_mentor_cooldowns_v1";
const BAND_COOLDOWN_STORAGE_KEY = "education_band_cooldowns_v1";

interface SkillLesson {
  id: string;
  skill: PrimarySkill;
  title: string;
  channel: string;
  focus: string;
  summary: string;
  url: string;
  difficulty: LessonDifficulty;
  durationMinutes: number;
  attributeKeys?: AttributeKey[];
  requiredSkillValue?: number;
}

interface MentorOption {
  id: string;
  name: string;
  focusSkill: PrimarySkill;
  description: string;
  specialty: string;
  cost: number;
  cooldownHours: number;
  baseXp: number;
  difficulty: LessonDifficulty;
  attributeKeys: AttributeKey[];
  requiredSkillValue: number;
  skillGainRatio: number;
  bonusDescription: string;
}

interface BandSession {
  id: string;
  title: string;
  description: string;
  focusSkills: PrimarySkill[];
  attributeKeys: AttributeKey[];
  baseXp: number;
  durationMinutes: 60 | 75 | 90;
  cooldownHours: number;
  difficulty: LessonDifficulty;
  synergyNotes: string;
}

interface BandMemberWithProfile {
  id: string;
  band_id: string;
  user_id: string;
  role: string | null;
  joined_at: string | null;
  salary: number | null;
  profiles?: {
    display_name: string | null;
    username: string | null;
  };
}

type YoutubeLessonRow = Tables<'education_youtube_lessons'>;

const LESSON_QUERY_KEY = ["education", "youtube-lessons"] as const;
const PRIMARY_SKILL_VALUES = Object.keys(SKILL_LABELS) as PrimarySkill[];
const ATTRIBUTE_KEY_SET = new Set<AttributeKey>(ATTRIBUTE_KEYS);

const isDefined = <T,>(value: T | null | undefined): value is T => value !== null && value !== undefined;

const isPrimarySkillValue = (value: string | null | undefined): value is PrimarySkill =>
  typeof value === "string" && (PRIMARY_SKILL_VALUES as readonly string[]).includes(value);

const isLessonDifficultyValue = (value: string | null | undefined): value is LessonDifficulty =>
  typeof value === "string" && (LESSON_DIFFICULTIES as readonly string[]).includes(value);

const normalizeAttributeKeys = (keys: string[] | null | undefined): AttributeKey[] =>
  (keys ?? []).filter((key): key is AttributeKey => ATTRIBUTE_KEY_SET.has(key as AttributeKey));

const mapLessonRow = (row: YoutubeLessonRow): SkillLesson | null => {
  if (!isPrimarySkillValue(row.skill) || !isLessonDifficultyValue(row.difficulty)) {
    return null;
  }

  if (row.duration_minutes === null || Number.isNaN(row.duration_minutes)) {
    return null;
  }

  return {
    id: row.id,
    skill: row.skill,
    title: row.title,
    channel: row.channel,
    focus: row.focus,
    summary: row.summary,
    url: row.url,
    difficulty: row.difficulty,
    durationMinutes: row.duration_minutes,
    attributeKeys: normalizeAttributeKeys(row.attribute_keys as string[] | null | undefined),
    requiredSkillValue: row.required_skill_value ?? undefined,
  };
};

const sortLessons = (a: SkillLesson, b: SkillLesson) => {
  const difficultyComparison = DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty];
  if (difficultyComparison !== 0) {
    return difficultyComparison;
  }

  const requiredComparison = (a.requiredSkillValue ?? 0) - (b.requiredSkillValue ?? 0);
  if (requiredComparison !== 0) {
    return requiredComparison;
  }

  if (a.durationMinutes !== b.durationMinutes) {
    return a.durationMinutes - b.durationMinutes;
  }

  return a.title.localeCompare(b.title);
};

const bookJourneys = [
  {
    title: "Creative Foundations",
    description:
      "Build core musicianship and mindset habits so practice, performance, and writing feel effortless.",
    resources: [
      {
        name: "The Musician's Way",
        author: "Gerald Klickstein",
        focus: "Practice Systems",
        takeaway: "Design repeatable practice rituals that translate directly to confident stage time."
      },
      {
        name: "Effortless Mastery",
        author: "Kenny Werner",
        focus: "Mindset",
        takeaway: "Rewire performance anxiety into calm focus with proven mental exercises."
      },
      {
        name: "Music Theory for Guitarists",
        author: "Tom Kolb",
        focus: "Theory Essentials",
        takeaway: "Bridge fretboard fluency with modern harmony so ideas land faster."
      }
    ]
  },
  {
    title: "Songcraft Lab",
    description:
      "Level up lyricism, arrangement, and production workflows that stand out in a crowded release cycle.",
    resources: [
      {
        name: "Writing Better Lyrics",
        author: "Pat Pattison",
        focus: "Lyric Craft",
        takeaway: "Follow semester-style prompts that sharpen storytelling and emotional arcs."
      },
      {
        name: "Tunesmith",
        author: "Jimmy Webb",
        focus: "Composition",
        takeaway: "Peek inside Grammy-winning processes and adapt them to your band's workflow."
      },
      {
        name: "How to Make It in the New Music Business",
        author: "Ari Herstand",
        focus: "Indie Strategy",
        takeaway: "Turn your releases into campaigns with actionable marketing checklists."
      }
    ]
  },
  {
    title: "Career Architect",
    description:
      "Navigate deals, branding, and financial strategy with resources tailored for modern rock artists.",
    resources: [
      {
        name: "All You Need to Know About the Music Business",
        author: "Donald Passman",
        focus: "Contracts",
        takeaway: "Understand royalties, licensing, and negotiation language before meetings happen."
      },
      {
        name: "Creative Quest",
        author: "Questlove",
        focus: "Creative Leadership",
        takeaway: "Blend artistry and entrepreneurship through stories from a legendary collaborator."
      },
      {
        name: "Company of One",
        author: "Paul Jarvis",
        focus: "Sustainable Growth",
        takeaway: "Build a resilient music business without burning out your team or fan trust."
      }
    ],
    action: {
      label: "Download release checklist",
      href: "https://notion.so"
    }
  }
];


const universityRoutes = [
  {
    title: "Degree Pathways",
    description: "Immersive programs that balance ensemble work, songwriting labs, and career coaching.",
    highlights: [
      {
        program: "BFA in Contemporary Performance",
        school: "Berklee College of Music",
        focus: "Performance Lab",
        details: "Daily ensemble rotations with songwriting bootcamps and showcase nights."
      },
      {
        program: "BA in Music Business",
        school: "Middle Tennessee State University",
        focus: "Industry Leadership",
        details: "Blend legal, marketing, and analytics courses with Nashville internship placements."

      },
      {
        program: "BS in Music Production",
        school: "Full Sail University",
        focus: "Studio Technology",
        details: "Hands-on studio tracking, mixing, and mastering alongside release simulations."
      }
    ],
    action: {
      label: "Download program guide",
      href: "https://www.berklee.edu/majors"
    }
  },
  {
    title: "Micro-Credentials",
    description: "Short sprints that stack with your touring schedule while keeping your skills sharp.",
    highlights: [
      {
        program: "Modern Music Production",
        school: "Coursera x Berklee",
        focus: "12-Week Certificate",
        details: "Project-based DAW mastery with mentor feedback on each mix."
      },
      {
        program: "Music Marketing Accelerator",
        school: "Soundfly",
        focus: "Mentor Guided",
        details: "Launch funnels, fan journeys, and social ads with weekly strategy reviews."
      },
      {
        program: "Live Event Production",
        school: "Point Blank Music School",
        focus: "Hybrid",
        details: "Route tours, advance shows, and manage crews with real-world case studies."
      }
    ],
    action: {
      label: "Browse certificates",
      href: "https://online.berklee.edu/programs"
    }
  },
  {
    title: "Semester Planner",
    description: "Use this repeatable 15-week cadence to balance study, creation, and stage time.",
    highlights: [
      {
        program: "Weeks 1-5",
        school: "Skill Ramp-Up",
        focus: "Technique + Theory",
        details: "Stack practice labs, ear training, and songwriting prompts."
      },
      {
        program: "Weeks 6-10",
        school: "Creative Production",
        focus: "Studio Sprints",
        details: "Batch arrange, record, and collaborate on portfolio-ready tracks."
      },
      {
        program: "Weeks 11-15",
        school: "Career Launch",
        focus: "Showcase",
        details: "Book showcases, refresh your EPK, and meet with advisors for next steps."
      }
    ],
    action: {
      label: "Grab the planner template",
      href: "https://calendar.google.com"
    }
  }
];

const mentorOptions: MentorOption[] = [
  {
    id: "mentor-stage-architect",
    name: "Nova Reyes",
    focusSkill: "performance",
    description: "Award-winning tour director who rebuilds stage shows from the ground up with cinematic pacing.",
    specialty: "Stagecraft Architect",
    cost: 850,
    cooldownHours: 72,
    baseXp: 260,
    difficulty: "advanced",
    attributeKeys: ["stage_presence", "musical_ability"],
    requiredSkillValue: 240,
    skillGainRatio: 0.9,
    bonusDescription: "Large stage-presence scaling and stamina drills tailored for amphitheater audiences."
  },
  {
    id: "mentor-song-catalyst",
    name: "Avery Quinn",
    focusSkill: "songwriting",
    description: "Billboard-charting writer specializing in modern pop hooks and cinematic lyric arcs.",
    specialty: "Story Catalyst",
    cost: 620,
    cooldownHours: 48,
    baseXp: 210,
    difficulty: "intermediate",
    attributeKeys: ["creative_insight", "marketing_savvy"],
    requiredSkillValue: 180,
    skillGainRatio: 0.85,
    bonusDescription: "Improves topline agility and positioning for sync placements and playlist pitches."
  },
  {
    id: "mentor-vocal-innovator",
    name: "Lyric Sol",
    focusSkill: "vocals",
    description: "Session vocalist famed for hybrid belting techniques and vocal health optimization on tour.",
    specialty: "Vocal Innovator",
    cost: 540,
    cooldownHours: 36,
    baseXp: 190,
    difficulty: "intermediate",
    attributeKeys: ["vocal_talent", "physical_endurance"],
    requiredSkillValue: 160,
    skillGainRatio: 0.8,
    bonusDescription: "Adds sustain control exercises that accelerate range stability and nightly recovery."
  }
];

const bandSessions: BandSession[] = [
  {
    id: "band-sync-lock",
    title: "Sync Lock Intensive",
    description: "Full-band groove lab focused on rhythmic lock, stop-time precision, and cue language.",
    focusSkills: ["drums", "bass", "performance"],
    attributeKeys: ["rhythm_sense", "musical_ability"],
    baseXp: 280,
    durationMinutes: 75,
    cooldownHours: 24,
    difficulty: "intermediate",
    synergyNotes: "Higher bonuses for tight rhythm section attributes and collaborative listening drills."
  },
  {
    id: "band-dynamic-story",
    title: "Dynamic Story Rehearsal",
    description: "Design emotional arcs, transitions, and crowd prompts that carry headline-length sets.",
    focusSkills: ["performance", "songwriting", "vocals"],
    attributeKeys: ["stage_presence", "creative_insight"],
    baseXp: 300,
    durationMinutes: 90,
    cooldownHours: 36,
    difficulty: "advanced",
    synergyNotes: "Synergy scales with storytelling attributes and the band’s collective stage presence."
  },
  {
    id: "band-arrangement-lab",
    title: "Arrangement Innovation Lab",
    description: "Rework setlist anchors with harmony swaps, drop builds, and modular intros/outros.",
    focusSkills: ["songwriting", "guitar", "bass"],
    attributeKeys: ["creative_insight", "technical_mastery"],
    baseXp: 260,
    durationMinutes: 60,
    cooldownHours: 18,
    difficulty: "intermediate",
    synergyNotes: "Amplified gains when composition skills and creative insight average above 200."
  }
];

const Education = () => {
  const { toast } = useToast();
  const { profile, skills, attributes, refetch, addActivity, updateProfile } = useGameData();

  const {
    data: lessonRows,
    isLoading: isLoadingLessons,
    isError: isLessonsError,
    error: lessonsError,
  } = useQuery({
    queryKey: LESSON_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("education_youtube_lessons")
        .select("*")
        .order("skill", { ascending: true })
        .order("required_skill_value", { ascending: true, nullsFirst: true })
        .order("difficulty", { ascending: true })
        .order("duration_minutes", { ascending: true })
        .order("title", { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as YoutubeLessonRow[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const skillLessons = useMemo<SkillLesson[]>(() => {
    if (!lessonRows) {
      return [];
    }

    const normalized = lessonRows.map(mapLessonRow).filter(isDefined);
    normalized.sort(sortLessons);
    return normalized;
  }, [lessonRows]);

  const {
    data: playlistData,
    isLoading: isLoadingPlaylists,
    isError: isPlaylistsError,
    error: playlistsError,
  } = useEducationVideoPlaylists();

  const videoPlaylists = playlistData ?? [];
  const lessonsErrorMessage =
    lessonsError instanceof Error
      ? lessonsError.message
      : lessonsError
        ? "We couldn't load curated lessons. Please try again later."
        : "";
  const playlistsErrorMessage =
    playlistsError instanceof Error
      ? playlistsError.message
      : playlistsError
        ? "We couldn't load resource playlists. Please try again later."
        : "";

  const [viewCounts, setViewCounts] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(VIDEO_VIEW_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, number>;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  });

  const [mentorCooldowns, setMentorCooldowns] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(MENTOR_COOLDOWN_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, string>;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  });

  const [bandCooldowns, setBandCooldowns] = useState<Record<string, Record<string, string>>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(BAND_COOLDOWN_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, Record<string, string>>;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  });

  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [activeMentorId, setActiveMentorId] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [band, setBand] = useState<Band | null>(null);
  const [bandMembers, setBandMembers] = useState<BandMemberWithProfile[]>([]);
  const [bandLoading, setBandLoading] = useState(false);

  const activeBandKey = band?.id ?? "solo";

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(VIDEO_VIEW_STORAGE_KEY, JSON.stringify(viewCounts));
  }, [viewCounts]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(MENTOR_COOLDOWN_STORAGE_KEY, JSON.stringify(mentorCooldowns));
  }, [mentorCooldowns]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(BAND_COOLDOWN_STORAGE_KEY, JSON.stringify(bandCooldowns));
  }, [bandCooldowns]);

  const resolveSkillValue = (skill: PrimarySkill | string): number => {
    const raw = skills?.[skill];
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return raw;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const isSkillUnlocked = (skill: PrimarySkill, requiredValue = 1) => {
    const value = resolveSkillValue(skill);
    return Number.isFinite(value) && value >= requiredValue;
  };

  const resolveAttributeFocus = (skill: PrimarySkill, attributeKeys?: AttributeKey[]) => {
    if (attributeKeys && attributeKeys.length > 0) {
      return attributeKeys;
    }
    const mapped = SKILL_ATTRIBUTE_MAP[skill];
    return mapped ? [mapped] : [];
  };

  const getRepeatMultiplier = (skill: PrimarySkill) => {
    const views = viewCounts[skill] ?? 0;
    return 1 + Math.min(views, MAX_REPEAT_STACKS) * REPEAT_STACK_BONUS;
  };

  const computeLessonReward = (lesson: SkillLesson) => {
    const difficultyConfig = LESSON_DIFFICULTY_CONFIG[lesson.difficulty];
    const baseXp = Math.round(lesson.durationMinutes * BASE_XP_PER_MINUTE * difficultyConfig.multiplier);
    const attributeFocus = resolveAttributeFocus(lesson.skill, lesson.attributeKeys);
    const attributeResult = applyAttributeToValue(baseXp, attributes, attributeFocus);
    const repeatMultiplier = getRepeatMultiplier(lesson.skill);
    const effectiveXp = Math.max(1, Math.round(attributeResult.value * repeatMultiplier));
    const skillGain = Math.max(1, Math.round(effectiveXp * LESSON_SKILL_GAIN_RATIO));

    return {
      baseXp,
      effectiveXp,
      repeatMultiplier,
      attributeMultiplier: attributeResult.multiplier,
      averageAttribute: attributeResult.averageValue,
      skillGain
    };
  };

  const computeMentorReward = (mentor: MentorOption) => {
    const difficultyConfig = LESSON_DIFFICULTY_CONFIG[mentor.difficulty];
    const baseXp = Math.round(mentor.baseXp * difficultyConfig.multiplier);
    const attributeResult = applyAttributeToValue(baseXp, attributes, mentor.attributeKeys);
    const focusSkillValue = resolveSkillValue(mentor.focusSkill);
    const masteryBoost = 1 + Math.min(0.25, Math.max(0, focusSkillValue - mentor.requiredSkillValue) / 800);
    const effectiveXp = Math.max(1, Math.round(attributeResult.value * masteryBoost));
    const skillGain = Math.max(1, Math.round(effectiveXp * mentor.skillGainRatio));

    return {
      baseXp,
      effectiveXp,
      attributeMultiplier: attributeResult.multiplier,
      averageAttribute: attributeResult.averageValue,
      masteryBoost,
      skillGain
    };
  };

  const computeBandReward = (session: BandSession) => {
    const difficultyConfig = LESSON_DIFFICULTY_CONFIG[session.difficulty];
    const baseXp = Math.round(session.baseXp * difficultyConfig.multiplier);
    const attributeResult = applyAttributeToValue(baseXp, attributes, session.attributeKeys);
    const rosterBonus = 1 + Math.max(0, bandMembers.length - 1) * TEAM_SIZE_BONUS;
    const skillAverage = session.focusSkills.length
      ? session.focusSkills.reduce((sum, skill) => sum + resolveSkillValue(skill), 0) /
        (session.focusSkills.length * 1000)
      : 0;
    const synergyBonus = 1 + Math.min(SYNERGY_CAP, Math.max(0, skillAverage));
    const effectiveXp = Math.max(1, Math.round(attributeResult.value * rosterBonus * synergyBonus));
    const skillGainPerSkill = session.focusSkills.length
      ? Math.max(1, Math.round((effectiveXp * BAND_SKILL_GAIN_RATIO) / session.focusSkills.length))
      : 0;

    return {
      baseXp,
      effectiveXp,
      attributeMultiplier: attributeResult.multiplier,
      averageAttribute: attributeResult.averageValue,
      rosterBonus,
      synergyBonus,
      skillGainPerSkill
    };
  };

  const formatRemainingTime = (iso: string | null | undefined) => {
    if (!iso) return null;
    const target = new Date(iso);
    if (Number.isNaN(target.getTime())) return null;
    const diff = target.getTime() - Date.now();
    if (diff <= 0) return null;
    const hours = Math.floor(diff / (60 * 60 * 1000));
    const minutes = Math.ceil((diff % (60 * 60 * 1000)) / (60 * 1000));
    if (hours <= 0) {
      return `${Math.max(minutes, 1)}m`;
    }
    if (minutes >= 60) {
      return `${hours + 1}h`;
    }
    return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  };

  const applySkillGains = async (skillDeltas: Record<string, number>) => {
    if (!profile) return;

    const payload: Record<string, unknown> = {
      user_id: profile.user_id,
      profile_id: profile.id,
      updated_at: new Date().toISOString()
    };

    if (typeof skills?.id === "string") {
      payload.id = skills.id;
    }

    const nextValues: Record<string, number> = {};

    for (const [skillKey, delta] of Object.entries(skillDeltas)) {
      const numericDelta = Number(delta ?? 0);
      if (!Number.isFinite(numericDelta) || numericDelta <= 0) {
        continue;
      }

      const currentValue = nextValues[skillKey] ?? resolveSkillValue(skillKey);
      const nextValue = Math.min(1000, Math.round(currentValue + numericDelta));
      nextValues[skillKey] = nextValue;
      payload[skillKey] = nextValue;
    }

    if (Object.keys(nextValues).length === 0) {
      return;
    }

    const { error } = await supabase
      .from("player_skills")
      .upsert(payload, { onConflict: "profile_id" });

    if (error) {
      throw error;
    }
  };

  const fetchBandContext = useCallback(async () => {
    if (!profile?.user_id) {
      setBand(null);
      setBandMembers([]);
      return;
    }

    setBandLoading(true);

    try {
      let resolvedBand: Band | null = null;
      let resolvedBandId: string | null = null;

      const { data: leaderBand, error: leaderError } = await supabase
        .from("bands")
        .select("*")
        .eq("leader_id", profile.user_id)
        .maybeSingle();

      if (leaderError && leaderError.code !== "PGRST116") {
        throw leaderError;
      }

      if (leaderBand) {
        resolvedBand = leaderBand as Band;
        resolvedBandId = leaderBand.id as string;
      }

      if (!resolvedBandId) {
        const { data: membership, error: membershipError } = await supabase
          .from("band_members")
          .select("band_id, bands(*)")
          .eq("user_id", profile.user_id)
          .maybeSingle();

        if (membershipError && membershipError.code !== "PGRST116") {
          throw membershipError;
        }

        if (membership?.band_id && membership?.bands) {
          resolvedBandId = membership.band_id as string;
          resolvedBand = membership.bands as Band;
        }
      }

      setBand(resolvedBand);

      if (resolvedBandId) {
        const { data: memberRows, error: membersError } = await supabase
          .from("band_members")
          .select("*, profiles:user_id (display_name, username)")
          .eq("band_id", resolvedBandId);

        if (membersError) {
          throw membersError;
        }

        setBandMembers((memberRows ?? []) as BandMemberWithProfile[]);
      } else {
        setBandMembers([]);
      }
    } catch (error) {
      console.error("Error loading band context:", error);
      setBand(null);
      setBandMembers([]);
    } finally {
      setBandLoading(false);
    }
  }, [profile?.user_id]);

  useEffect(() => {
    void fetchBandContext();
  }, [fetchBandContext]);

  const lessonGroups = useMemo(() => {
    const groups: Partial<Record<PrimarySkill, SkillLesson[]>> = {};
    for (const lesson of skillLessons) {
      const existing = groups[lesson.skill] ?? [];
      existing.push(lesson);
      groups[lesson.skill] = existing;
    }

    for (const key of Object.keys(groups) as PrimarySkill[]) {
      groups[key]?.sort(sortLessons);
    }

    return groups;
  }, [skillLessons]);

  const bandCooldownLookup = bandCooldowns[activeBandKey] ?? {};
  const bandSize = bandMembers.length;
  const availableSkillKeys = PRIMARY_SKILL_VALUES.filter((skillKey) => (lessonGroups[skillKey]?.length ?? 0) > 0);

  const handleWatchLesson = async (lesson: SkillLesson) => {
    if (!profile) {
      toast({
        title: "Sign in to train",
        description: "Create or select a character to record training progress.",
        variant: "destructive"
      });
      return;
    }

    const requirement = lesson.requiredSkillValue ?? 1;
    if (!isSkillUnlocked(lesson.skill, requirement)) {
      toast({
        title: "Unlock required",
        description: `Reach ${requirement} ${SKILL_LABELS[lesson.skill]} to access this lesson.`,
        variant: "destructive"
      });
      return;
    }

    const reward = computeLessonReward(lesson);
    setActiveLessonId(lesson.id);

    try {
      await awardActionXp({
        amount: reward.effectiveXp,
        category: "practice",
        actionKey: "education_youtube_lesson",
        uniqueEventId: `${profile.id}:lesson:${lesson.id}:${(viewCounts[lesson.skill] ?? 0) + 1}`,
        metadata: {
          skill: lesson.skill,
          duration_minutes: lesson.durationMinutes,
          difficulty: lesson.difficulty,
          repeat_multiplier: reward.repeatMultiplier,
          attribute_multiplier: reward.attributeMultiplier
        }
      });

      await applySkillGains({ [lesson.skill]: reward.skillGain });

      setViewCounts((prev) => ({
        ...prev,
        [lesson.skill]: (prev[lesson.skill] ?? 0) + 1
      }));

      await addActivity(
        "education_lesson",
        `Studied ${lesson.title} (${SKILL_LABELS[lesson.skill]}) — +${reward.effectiveXp} XP`,
        undefined,
        {
          lesson_id: lesson.id,
          xp_awarded: reward.effectiveXp,
          skill_gain: reward.skillGain
        }
      );

      toast({
        title: "Lesson complete",
        description: `You earned ${reward.effectiveXp} XP and boosted ${SKILL_LABELS[lesson.skill].toLowerCase()} skills.`,
        variant: "default"
      });

      await refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to record lesson.";
      toast({
        title: "Training failed",
        description: message,
        variant: "destructive"
      });
    } finally {
      setActiveLessonId(null);
    }
  };

  const handleBookMentor = async (mentor: MentorOption) => {
    if (!profile) {
      toast({
        title: "Sign in to schedule",
        description: "You need an active character to book mentors.",
        variant: "destructive"
      });
      return;
    }

    const requirementMet = isSkillUnlocked(mentor.focusSkill, mentor.requiredSkillValue);
    if (!requirementMet) {
      toast({
        title: "Skill requirement",
        description: `Reach ${mentor.requiredSkillValue} ${SKILL_LABELS[mentor.focusSkill]} to learn from ${mentor.name}.`,
        variant: "destructive"
      });
      return;
    }

    const cooldownRemaining = formatRemainingTime(mentorCooldowns[mentor.id]);
    if (cooldownRemaining) {
      toast({
        title: "Mentor on cooldown",
        description: `${mentor.name} will be available again in ${cooldownRemaining}.`,
        variant: "destructive"
      });
      return;
    }

    const availableCash = Number(profile.cash ?? 0);
    if (availableCash < mentor.cost) {
      toast({
        title: "Insufficient funds",
        description: `You need $${mentor.cost.toLocaleString()} to book ${mentor.name}.`,
        variant: "destructive"
      });
      return;
    }

    const reward = computeMentorReward(mentor);
    setActiveMentorId(mentor.id);

    try {
      await awardActionXp({
        amount: reward.effectiveXp,
        category: "practice",
        actionKey: "education_mentor_session",
        uniqueEventId: `${profile.id}:mentor:${mentor.id}:${Date.now()}`,
        metadata: {
          mentor_id: mentor.id,
          focus_skill: mentor.focusSkill,
          attribute_multiplier: reward.attributeMultiplier,
          mastery_boost: reward.masteryBoost
        }
      });

      await applySkillGains({ [mentor.focusSkill]: reward.skillGain });

      const updatedCash = Math.max(0, availableCash - mentor.cost);
      await updateProfile({ cash: updatedCash });

      const nextWindow = new Date(Date.now() + mentor.cooldownHours * 60 * 60 * 1000).toISOString();
      setMentorCooldowns((prev) => ({
        ...prev,
        [mentor.id]: nextWindow
      }));

      await addActivity(
        "education_mentor",
        `Completed a ${mentor.specialty.toLowerCase()} with ${mentor.name} — +${reward.effectiveXp} XP`,
        -mentor.cost,
        {
          mentor_id: mentor.id,
          xp_awarded: reward.effectiveXp,
          skill_gain: reward.skillGain
        }
      );

      toast({
        title: `${mentor.name} session complete`,
        description: `You invested $${mentor.cost.toLocaleString()} and gained ${reward.effectiveXp} XP.`,
        variant: "default"
      });

      await refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to complete mentor session.";
      toast({
        title: "Session failed",
        description: message,
        variant: "destructive"
      });
    } finally {
      setActiveMentorId(null);
    }
  };

  const handleBandSession = async (session: BandSession) => {
    if (!profile) {
      toast({
        title: "Sign in to coordinate",
        description: "Create or select a character to schedule band intensives.",
        variant: "destructive"
      });
      return;
    }

    if (!band || bandMembers.length < 2) {
      toast({
        title: "Bandmates required",
        description: "Invite at least one bandmate before launching team training.",
        variant: "destructive"
      });
      return;
    }

    const cooldownRemaining = formatRemainingTime(bandCooldownLookup[session.id]);
    if (cooldownRemaining) {
      toast({
        title: "Session on cooldown",
        description: `Try again in ${cooldownRemaining}.`,
        variant: "destructive"
      });
      return;
    }

    const reward = computeBandReward(session);
    setActiveSessionId(session.id);

    try {
      await awardActionXp({
        amount: reward.effectiveXp,
        category: "practice",
        actionKey: "education_band_session",
        uniqueEventId: `${profile.id}:band:${session.id}:${Date.now()}`,
        metadata: {
          session_id: session.id,
          focus_skills: session.focusSkills,
          attribute_multiplier: reward.attributeMultiplier,
          roster_bonus: reward.rosterBonus,
          synergy_bonus: reward.synergyBonus
        }
      });

      const skillUpdates: Record<string, number> = {};
      for (const skillKey of session.focusSkills) {
        skillUpdates[skillKey] = (skillUpdates[skillKey] ?? 0) + reward.skillGainPerSkill;
      }
      await applySkillGains(skillUpdates);

      const nextWindow = new Date(Date.now() + session.cooldownHours * 60 * 60 * 1000).toISOString();
      setBandCooldowns((prev) => ({
        ...prev,
        [activeBandKey]: {
          ...(prev[activeBandKey] ?? {}),
          [session.id]: nextWindow
        }
      }));

      await addActivity(
        "education_band",
        `Ran ${session.title} — +${reward.effectiveXp} XP shared across the band.`,
        undefined,
        {
          session_id: session.id,
          xp_awarded: reward.effectiveXp,
          skill_gain: reward.skillGainPerSkill
        }
      );

      toast({
        title: "Band intensive complete",
        description: `Collected ${reward.effectiveXp} XP with your crew.`,
        variant: "default"
      });

      await refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to run band session.";
      toast({
        title: "Session failed",
        description: message,
        variant: "destructive"
      });
    } finally {
      setActiveSessionId(null);
    }
  };

  return (
    <div className="space-y-10 px-4 pb-16 pt-8 md:px-8 lg:px-16">
      <div className="text-center">
        <Badge variant="secondary" className="mb-3">Learning Engine</Badge>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Education</h1>
        <p className="mx-auto mt-3 max-w-3xl text-base text-muted-foreground sm:text-lg">
          Craft a learning roadmap that keeps your artistry, business savvy, and band cohesion in sync. Dive into
          curated resources, structured programs, and real mentors tailored for the Rockmundo universe.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <a href="https://rockmundo.com/education" target="_blank" rel="noreferrer">
              Start a learning sprint
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href="https://notion.so" target="_blank" rel="noreferrer">
              Download study planner
            </a>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="books" className="space-y-6">
        <TabsList className="grid w-full gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {tabItems.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger key={tab.value} value={tab.value} className="flex flex-col gap-1 py-3">
                <span className="flex items-center justify-center gap-2 text-sm font-semibold">
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </span>
                <span className="hidden text-xs text-muted-foreground lg:block">{tab.blurb}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="books" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Curated Reading Journeys</CardTitle>
              <CardDescription>
                Progress from foundational chops to advanced career strategy with books we keep in every Rockmundo locker.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {bookJourneys.map((journey) => (
                <Card key={journey.title} className="border-dashed">
                  <CardHeader className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="text-lg">{journey.title}</CardTitle>
                      <Badge variant="secondary" className="text-xs">
                        {journey.resources.length} picks
                      </Badge>
                    </div>
                    <CardDescription>{journey.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {journey.resources.map((resource) => (
                      <div key={resource.name} className="rounded-lg border bg-muted/40 p-4 text-left">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{resource.name}</p>
                            <p className="text-xs text-muted-foreground">{resource.author}</p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {resource.focus}
                          </Badge>
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">{resource.takeaway}</p>
                      </div>
                    ))}
                    {journey.action ? (
                      <Button asChild variant="secondary" className="w-full">
                        <a href={journey.action.href} target="_blank" rel="noreferrer">
                          {journey.action.label}
                        </a>
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="university" className="space-y-6">
          {universityRoutes.map((route) => (
            <Card key={route.title}>
              <CardHeader>
                <CardTitle>{route.title}</CardTitle>
                <CardDescription>{route.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  {route.highlights.map((item) => (
                    <div key={item.program} className="space-y-1 rounded-lg border p-4">
                      <div className="font-semibold">{item.program}</div>
                      <div className="text-sm text-muted-foreground">{item.school}</div>
                      <div className="text-sm text-muted-foreground">{item.format}</div>
                      <p className="text-sm">{item.detail}</p>
                    </div>
                  ))}
                </div>
                <Button variant="outline" asChild>
                  <a href={route.action.href} target="_blank" rel="noreferrer">
                    {route.action.label}
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="videos">
          <Card>
            <CardHeader>
              <CardTitle>YouTube Skill Training</CardTitle>
              <CardDescription>
                Blend formal study with real-world shows, mentorship, and portfolio milestones.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-3">
              {availableSkillKeys.length > 0 ? (
                availableSkillKeys.map((skillKey) => {
                  const lessons = lessonGroups[skillKey] ?? [];
                  const featuredLesson = lessons[0];
                  const highestRequirement = lessons.reduce(
                    (max, lesson) => Math.max(max, lesson.requiredSkillValue ?? 0),
                    0
                  );
                  const requirementTarget = Math.max(highestRequirement, 1);
                  const unlocked = isSkillUnlocked(skillKey, requirementTarget);
                  const reward = featuredLesson ? computeLessonReward(featuredLesson) : null;
                  const viewCount = viewCounts[skillKey] ?? 0;

                  return (
                    <div key={skillKey} className="space-y-3 rounded-lg border bg-muted/40 p-4 text-left">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{SKILL_LABELS[skillKey]}</p>
                          <p className="text-xs text-muted-foreground">
                            {lessons.length} curated lesson{lessons.length === 1 ? "" : "s"}
                          </p>
                        </div>
                        <Badge variant={unlocked ? "secondary" : "outline"} className="text-xs">
                          {unlocked ? "Ready" : `Needs ${requirementTarget}+`}
                        </Badge>
                      </div>
                      {featuredLesson ? (
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm font-semibold">{featuredLesson.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {featuredLesson.focus} • {featuredLesson.channel}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-xs">
                              {LESSON_DIFFICULTY_CONFIG[featuredLesson.difficulty].label}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {featuredLesson.durationMinutes} min
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              Views: {viewCount}
                            </Badge>
                          </div>
                          {reward ? (
                            <p className="text-xs text-muted-foreground">
                              Next reward: {reward.effectiveXp} XP • Skill gain ≈ {reward.skillGain}
                            </p>
                          ) : null}
                          <Button asChild size="sm" variant="secondary" className="w-full">
                            <a href={featuredLesson.url} target="_blank" rel="noreferrer">
                              Watch featured lesson
                            </a>
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">
                  No trainable skills are available yet. Unlock skills in your profile to see tailored lessons.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>YouTube Skill Intensives</CardTitle>
              <CardDescription>
                Unlock curated lessons per skill. Rewards scale with difficulty, repeat focus, and your attribute loadout.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoadingLessons ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading curated lessons...
                </div>
              ) : isLessonsError ? (
                <Alert variant="destructive">
                  <AlertTitle>Unable to load lessons</AlertTitle>
                  <AlertDescription>{lessonsErrorMessage}</AlertDescription>
                </Alert>
              ) : availableSkillKeys.length === 0 ? (
                <div className="rounded-lg border border-dashed bg-muted/40 p-6 text-sm text-muted-foreground">
                  No lessons have been published yet. Check back soon for fresh training drops.
                </div>
              ) : (
                availableSkillKeys.map((skillKey) => {
                  const lessons = lessonGroups[skillKey];
                  if (!lessons || lessons.length === 0) return null;

                  const skillLevel = resolveSkillValue(skillKey);
                  const viewCount = viewCounts[skillKey] ?? 0;
                  const highestRequirement = lessons.reduce(
                    (max, lesson) => Math.max(max, lesson.requiredSkillValue ?? 0),
                    0
                  );
                  const unlocked = isSkillUnlocked(skillKey, Math.max(highestRequirement, 1));

                  return (
                    <Card key={skillKey} className="border-dashed">
                      <CardHeader className="space-y-2">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <CardTitle className="text-lg">{SKILL_LABELS[skillKey]}</CardTitle>
                            <CardDescription>
                              Current rating: {Math.round(skillLevel)} • Repeat stacks: {Math.min(viewCount, MAX_REPEAT_STACKS)} / {MAX_REPEAT_STACKS}
                            </CardDescription>
                          </div>
                          <Badge variant={unlocked ? "secondary" : "outline"} className="whitespace-nowrap text-xs">
                            {unlocked ? "Unlocked" : `Requires ${highestRequirement}+`}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {lessons.map((lesson) => {
                          const reward = computeLessonReward(lesson);
                          const locked = !isSkillUnlocked(lesson.skill, lesson.requiredSkillValue ?? 1);

                          return (
                            <div key={lesson.id} className="space-y-4 rounded-lg border bg-muted/40 p-4">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <p className="text-sm font-semibold">{lesson.title}</p>
                                  <p className="text-xs text-muted-foreground">{lesson.focus} • {lesson.channel}</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {LESSON_DIFFICULTY_CONFIG[lesson.difficulty].label}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {lesson.durationMinutes} min
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    Views: {viewCounts[lesson.skill] ?? 0}
                                  </Badge>
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground">{lesson.summary}</p>
                              <div className="grid gap-2 sm:grid-cols-3">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Clock className="h-4 w-4" />
                                  Session time: {lesson.durationMinutes} min
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Trophy className="h-4 w-4 text-primary" />
                                  Next reward: {reward.effectiveXp} XP
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Gauge className="h-4 w-4" />
                                  Attribute boost: {(Math.max(0, reward.attributeMultiplier - 1) * 100).toFixed(0)}%
                                </div>
                              </div>
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="text-xs text-muted-foreground">
                                  Repeat bonus: {((reward.repeatMultiplier - 1) * 100).toFixed(0)}% • Skill gain ≈ {reward.skillGain}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleWatchLesson(lesson)}
                                    disabled={locked || activeLessonId === lesson.id}
                                  >
                                    {locked
                                      ? "Unlock skill first"
                                      : activeLessonId === lesson.id
                                        ? "Recording..."
                                        : "Watch & Earn"}
                                  </Button>
                                  <Button asChild size="sm" variant="ghost">
                                    <a href={lesson.url} target="_blank" rel="noreferrer">
                                      <Play className="mr-2 h-4 w-4" /> Preview
                                    </a>
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Resource Playlists</CardTitle>
              <CardDescription>
                Supplement your focused training with curated playlists and channels you can binge between sessions.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {isLoadingPlaylists ? (
                <div className="col-span-full flex items-center justify-center py-8 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading playlists...
                </div>
              ) : isPlaylistsError ? (
                <div className="col-span-full">
                  <Alert variant="destructive">
                    <AlertTitle>Unable to load playlists</AlertTitle>
                    <AlertDescription>{playlistsErrorMessage}</AlertDescription>
                  </Alert>
                </div>
              ) : videoPlaylists.length === 0 ? (
                <div className="col-span-full rounded-lg border border-dashed bg-muted/40 p-6 text-sm text-muted-foreground">
                  No playlists are available yet. Add resources from the admin panel to surface recommendations.
                </div>
              ) : (
                videoPlaylists.map((collection) => (
                  <Card key={collection.key} className="border-dashed">
                    <CardHeader className="space-y-2">
                      <CardTitle className="text-lg">{collection.title}</CardTitle>
                      <CardDescription>{collection.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {collection.resources.map((resource) => (
                        <div key={resource.id} className="space-y-3 rounded-lg border bg-muted/40 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold">{resource.name}</p>
                              <p className="text-xs text-muted-foreground">{resource.format}</p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {resource.focus}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{resource.summary}</p>
                          <Button asChild variant="link" className="h-auto px-0 text-xs font-semibold">
                            <a href={resource.url} target="_blank" rel="noreferrer">
                              Watch now
                            </a>
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mentors">
          <Card>
            <CardHeader>
              <CardTitle>Mentor Roster</CardTitle>
              <CardDescription>
                Book targeted coaching sessions. Fees deduct from your cash balance and scale XP with your attributes.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {mentorOptions.map((mentor) => {
                const reward = computeMentorReward(mentor);
                const cooldownRemaining = formatRemainingTime(mentorCooldowns[mentor.id]);
                const requirementMet = isSkillUnlocked(mentor.focusSkill, mentor.requiredSkillValue);
                const availableCash = Number(profile?.cash ?? 0);
                const insufficientFunds = availableCash < mentor.cost;
                const disabled =
                  !requirementMet || Boolean(cooldownRemaining) || insufficientFunds || activeMentorId === mentor.id;

                return (
                  <Card key={mentor.id} className="border-dashed">
                    <CardHeader className="space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-base font-semibold">{mentor.name}</CardTitle>
                          <CardDescription>{mentor.specialty}</CardDescription>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {LESSON_DIFFICULTY_CONFIG[mentor.difficulty].label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-xs text-muted-foreground">{mentor.description}</p>
                      <div className="grid gap-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <BadgeDollarSign className="h-4 w-4" />
                          Session cost: ${mentor.cost.toLocaleString()}
                        </div>
                        <div className="flex items-center gap-2">
                          <Trophy className="h-4 w-4 text-primary" />
                          Reward: {reward.effectiveXp} XP • Skill gain ≈ {reward.skillGain}
                        </div>
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          Attribute boost: {(Math.max(0, reward.attributeMultiplier - 1) * 100).toFixed(0)}%
                        </div>
                        <div className="flex items-center gap-2">
                          <Timer className="h-4 w-4" />
                          Cooldown: {mentor.cooldownHours}h
                          {cooldownRemaining ? ` • ${cooldownRemaining} remaining` : ""}
                        </div>
                      </div>
                      <div className="space-y-2 text-xs text-muted-foreground">
                        <p>
                          Requires {mentor.requiredSkillValue}+ {SKILL_LABELS[mentor.focusSkill]} • {mentor.bonusDescription}
                        </p>
                      </div>
                      <Button
                        className="w-full"
                        onClick={() => handleBookMentor(mentor)}
                        disabled={disabled}
                      >
                        {cooldownRemaining
                          ? `Available in ${cooldownRemaining}`
                          : insufficientFunds
                            ? "Not enough cash"
                            : activeMentorId === mentor.id
                              ? "Scheduling..."
                              : "Book mentor session"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="band">
          <Card>
            <CardHeader>
              <CardTitle>Band Readiness</CardTitle>
              <CardDescription>
                Band intensives reuse your roster, share cooldowns, and scale with collective attributes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {bandLoading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : band ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{band.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {band.genre ?? "Genre agnostic"} • Members: {bandSize}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      Shared cooldowns active
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {bandMembers.map((member) => (
                      <div key={member.id} className="flex items-center justify-between rounded border bg-muted/30 px-3 py-2">
                        <div>
                          <p className="text-xs font-semibold">
                            {member.profiles?.display_name ?? member.profiles?.username ?? "Bandmate"}
                          </p>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            {member.role ?? "Member"}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          Joined {member.joined_at ? new Date(member.joined_at).toLocaleDateString() : "--"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                  Create or join a band to unlock collaborative training boosts.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Band Intensives</CardTitle>
              <CardDescription>
                Coordinate sessions that apply attribute synergy and grant XP to the whole crew.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {bandSessions.map((session) => {
                const reward = computeBandReward(session);
                const cooldownRemaining = formatRemainingTime(bandCooldownLookup[session.id]);
                const disabled =
                  !band || bandMembers.length < 2 || Boolean(cooldownRemaining) || activeSessionId === session.id;

                return (
                  <div key={session.id} className="space-y-4 rounded-lg border bg-muted/40 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold">{session.title}</p>
                        <p className="text-xs text-muted-foreground">{session.description}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {LESSON_DIFFICULTY_CONFIG[session.difficulty].label}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {session.durationMinutes} min
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Focus: {session.focusSkills.map((skill) => SKILL_LABELS[skill]).join(", ")}
                        </Badge>
                      </div>
                    </div>
                    <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-primary" />
                        Reward: {reward.effectiveXp} XP • Skill gain ≈ {reward.skillGainPerSkill} each
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Roster bonus: {((reward.rosterBonus - 1) * 100).toFixed(0)}% • Synergy: {((reward.synergyBonus - 1) * 100).toFixed(0)}%
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{session.synergyNotes}</p>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs text-muted-foreground">
                        Cooldown: {session.cooldownHours}h
                        {cooldownRemaining ? ` • ${cooldownRemaining} remaining` : ""}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleBandSession(session)}
                        disabled={disabled}
                      >
                        {cooldownRemaining
                          ? `Available in ${cooldownRemaining}`
                          : !band || bandMembers.length < 2
                            ? "Bandmates needed"
                            : activeSessionId === session.id
                              ? "Running..."
                              : "Run session"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default Education;

