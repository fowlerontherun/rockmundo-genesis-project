import { useCallback, useEffect, useMemo, useState } from "react";

import { BookOpen, GraduationCap, Loader2, PlaySquare, Sparkles, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type TierName } from "@/data/skillTree";
import { useGameData, type PlayerAttributes, type PlayerSkills } from "@/hooks/useGameData";
import { useSkillSystem } from "@/hooks/useSkillSystem";
import { type SkillDefinitionRecord, type SkillProgressRecord } from "@/hooks/useSkillSystem.types";
import { useToast } from "@/hooks/use-toast";
import {
  ATTRIBUTE_METADATA,
  type AttributeKey,
  applyAttributeToValue
} from "@/utils/attributeProgression";

type SkillMetadata = SkillDefinitionRecord["metadata"];

const TIER_SETTINGS: Record<
  TierName,
  {
    durationMinutes: number;
    difficultyMultiplier: number;
  }
> = {
  Basic: { durationMinutes: 30, difficultyMultiplier: 1 },
  Professional: { durationMinutes: 45, difficultyMultiplier: 1.5 },
  Mastery: { durationMinutes: 60, difficultyMultiplier: 2 }
};

const WATCH_BONUS_INCREMENT = 0.1;
const MAX_WATCH_BONUS_STACKS = 5;
const MIN_COOLDOWN_PORTION = 0.45;
const MIN_COOLDOWN_MINUTES = 15;

const ATTRIBUTE_MATCHERS: Array<{ match: RegExp; keys: AttributeKey[] }> = [
  { match: /(songwriting|lyrics|compos|arrang|melody)/i, keys: ["creative_insight"] },
  { match: /(production|mix|engineer|studio|record)/i, keys: ["technical_mastery"] },
  { match: /(performance|stage|tour|crowd|show)/i, keys: ["stage_presence"] },
  { match: /(marketing|promo|brand|social)/i, keys: ["marketing_savvy"] },
  { match: /(business|manager|finance|deal)/i, keys: ["business_acumen"] },
  { match: /(rhythm|drum|groove|percussion)/i, keys: ["rhythm_sense"] },
  { match: /(vocal|sing|voice)/i, keys: ["vocal_talent"] },
  { match: /(guitar|bass|instrument|technique|musician)/i, keys: ["musical_ability"] }
];

const ensureTier = (tierValue: unknown): TierName => {
  if (tierValue === "Professional" || tierValue === "Mastery") {
    return tierValue;
  }
  return "Basic";
};

const inferAttributeKeys = (slug: string, metadata: SkillMetadata): AttributeKey[] => {
  const haystack = `${slug} ${(metadata?.track as string | undefined) ?? ""} ${(metadata?.category as string | undefined) ?? ""}`;
  for (const entry of ATTRIBUTE_MATCHERS) {
    if (entry.match.test(haystack)) {
      return entry.keys;
    }
  }
  return ["musical_ability"];
};

const buildVideoUrl = (definition: SkillDefinitionRecord) => {
  const searchTerm = definition.display_name ?? definition.slug.replace(/_/g, " ");
  const query = encodeURIComponent(`${searchTerm} music lesson`);
  return `https://www.youtube.com/results?search_query=${query}`;
};

const computeCooldownMinutes = (durationMinutes: number, watchCount: number) => {
  const stacks = Math.max(0, Math.min(MAX_WATCH_BONUS_STACKS, watchCount - 1));
  const reductionRatio = Math.max(MIN_COOLDOWN_PORTION, 1 - stacks * 0.1);
  const computed = Math.round(durationMinutes * reductionRatio);
  return Math.max(MIN_COOLDOWN_MINUTES, computed);
};

type TrainingPreview = {
  xpGain: number;
  durationMinutes: number;
  tier: TierName;
  attributeMultiplier: number;
  averageAttributeValue: number;
  attributeKeys: AttributeKey[];
  watchBonus: number;
  difficultyMultiplier: number;
};

const computeTrainingPreview = (
  definition: SkillDefinitionRecord,
  attributes: PlayerAttributes,
  nextWatchCount: number
): TrainingPreview => {
  const tier = ensureTier(definition.metadata?.tier);
  const settings = TIER_SETTINGS[tier];
  const baseXp = Math.max(1, Number(definition.base_xp_gain ?? 6));
  const stacks = Math.max(0, Math.min(MAX_WATCH_BONUS_STACKS, nextWatchCount - 1));
  const watchBonus = 1 + stacks * WATCH_BONUS_INCREMENT;
  const attributeKeys = inferAttributeKeys(definition.slug, definition.metadata);
  const rawXp = Math.round(baseXp * settings.difficultyMultiplier * watchBonus);
  const { value: xpGain, multiplier: attributeMultiplier, averageValue } = applyAttributeToValue(
    rawXp,
    attributes,
    attributeKeys
  );

  return {
    xpGain,
    durationMinutes: settings.durationMinutes,
    tier,
    attributeMultiplier,
    averageAttributeValue: averageValue,
    attributeKeys,
    watchBonus,
    difficultyMultiplier: settings.difficultyMultiplier
  };
};

const tabs = [
  {
    value: "books",
    label: "Books",
    icon: BookOpen,
    description: "Build a foundational library for musicianship, songwriting, and career growth."
  },
  {
    value: "university",
    label: "University",
    icon: GraduationCap,
    description: "Map out formal education paths and micro-credentials that align with your goals."
  },
  {
    value: "videos",
    label: "YouTube Videos",
    icon: PlaySquare,
    description: "Curated playlists and channels that deliver high-impact lessons on demand."
  },
  {
    value: "mentors",
    label: "Mentors",
    icon: Users,
    description: "Connect with experts for personalized feedback, coaching, and accountability."
  },
  {
    value: "band",
    label: "Band Learning",
    icon: Sparkles,
    description: "Structured learning plans designed to level up your entire band together."
  }
];

const bookCollections = [
  {
    title: "Foundational Musicianship",
    description:
      "Master the essentials of music theory, ear training, and instrument technique to build confident performance skills.",
    items: [
      {
        name: "The Musician's Handbook",
        author: "Bobby Borg",
        focus: "Career Fundamentals",
        takeaway: "Establish a rock-solid foundation for navigating the industry and building sustainable habits."
      },
      {
        name: "Music Theory for Guitarists",
        author: "Tom Kolb",
        focus: "Theory Essentials",
        takeaway: "Translate theory concepts directly onto the fretboard with modern practice drills."
      },
      {
        name: "Effortless Mastery",
        author: "Kenny Werner",
        focus: "Mindset & Practice",
        takeaway: "Unlock flow-state practicing with techniques that balance discipline and creativity."
      }
    ]
  },
  {
    title: "Songwriting & Creativity",
    description:
      "Upgrade your writing toolkit with books that unpack lyricism, storytelling, and arranging for modern audiences.",
    items: [
      {
        name: "Writing Better Lyrics",
        author: "Pat Pattison",
        focus: "Lyric Craft",
        takeaway: "A semester-style guide to turning song ideas into compelling narratives."
      },
      {
        name: "Tunesmith",
        author: "Jimmy Webb",
        focus: "Composition",
        takeaway: "Legendary songwriting lessons from a Grammy-winning composer with exercises you can apply immediately."
      },
      {
        name: "Songwriters On Songwriting",
        author: "Paul Zollo",
        focus: "Creative Process",
        takeaway: "Dozens of interviews with iconic writers that reveal breakthrough moments and creative systems."
      }
    ]
  },
  {
    title: "Music Business & Branding",
    description:
      "Navigate the modern music economy with guides that demystify contracts, marketing, and independent releases.",
    items: [
      {
        name: "All You Need to Know About the Music Business",
        author: "Donald Passman",
        focus: "Industry",
        takeaway: "Understand contracts, royalties, and negotiation tactics before your next big opportunity."
      },
      {
        name: "Creative Quest",
        author: "Questlove",
        focus: "Creative Leadership",
        takeaway: "Blend artistry and entrepreneurship through stories from one of music's most inventive minds."
      },
      {
        name: "How to Make It in the New Music Business",
        author: "Ari Herstand",
        focus: "Indie Strategy",
        takeaway: "A modern blueprint for self-managed releases, touring, and audience growth."
      }
    ]
  }
];

const universityTracks = [
  {
    title: "Degree Pathways",
    description:
      "Explore accredited programs that combine performance, technology, and music business training.",
    highlights: [
      {
        name: "BFA in Contemporary Performance",
        school: "Berklee College of Music",
        focus: "Performance Major",
        details: "Focus on live performance labs, ensemble work, and songwriting collaborations."
      },
      {
        name: "BA in Music Business",
        school: "Middle Tennessee State University",
        focus: "Industry Leadership",
        details: "Blend legal, marketing, and management courses with internship placements in Nashville."
      },
      {
        name: "BS in Music Production",
        school: "Full Sail University",
        focus: "Studio Technology",
        details: "Hands-on studio time with DAW mastery, audio engineering, and mixing for release."
      }
    ],
    action: {
      label: "Download Program Guide",
      href: "https://www.berklee.edu/majors"
    }
  },
  {
    title: "Micro-Credentials & Certificates",
    description:
      "Stack short-form credentials to sharpen niche skills while staying active in the scene.",
    highlights: [
      {
        name: "Modern Music Production",
        school: "Coursera x Berklee",
        focus: "12-Week Certificate",
        details: "Project-based program covering beat design, mixing, and mastering workflows."
      },
      {
        name: "Music Marketing Accelerator",
        school: "Soundfly",
        focus: "Mentor-Guided",
        details: "Learn digital strategy, branding, and fan funnels with 1:1 mentor feedback."
      },
      {
        name: "Live Event Production",
        school: "Point Blank Music School",
        focus: "Hybrid",
        details: "Develop stage management and tour logistics skills with live practicum opportunities."
      }
    ],
    action: {
      label: "Browse Certificates",
      href: "https://online.berklee.edu/programs"
    }
  },
  {
    title: "Semester Planner",
    description:
      "Balance academic study with band commitments using this repeatable 15-week structure.",
    highlights: [
      {
        name: "Weeks 1-5",
        school: "Skill Ramp-Up",
        focus: "Technique & Theory",
        details: "Double down on practice labs and music theory intensives while scheduling songwriting sprints."
      },
      {
        name: "Weeks 6-10",
        school: "Creative Production",
        focus: "Studio & Writing",
        details: "Shift toward arranging, collaboration projects, and recording sessions for portfolio tracks."
      },
      {
        name: "Weeks 11-15",
        school: "Career Launch",
        focus: "Showcase & Networking",
        details: "Secure live showcases, meet with advisors, and prepare EPK updates ahead of finals."
      }
    ],
    action: {
      label: "Download Planner",
      href: "https://calendar.google.com"
    }
  }
];

const videoPlaylists = [
  {
    title: "Technique & Theory Channels",
    description:
      "Weekly uploads from trusted educators to keep your chops sharp and your theory knowledge fresh.",
    resources: [
      {
        name: "Rick Beato",
        format: "Deep-Dive Lessons",
        focus: "Ear Training & Analysis",
        link: "https://www.youtube.com/user/pegzch",
        summary: "Break down legendary songs, chord progressions, and arrangement secrets in long-form videos."
      },
      {
        name: "Marty Music",
        format: "Guitar Tutorials",
        focus: "Technique",
        link: "https://www.youtube.com/c/martyschwartz",
        summary: "Accessible guitar lessons covering riffs, tone tips, and style-specific workouts."
      },
      {
        name: "Nahre Sol",
        format: "Creative Exercises",
        focus: "Composition",
        link: "https://www.youtube.com/c/nahresol",
        summary: "Hybrid classical & electronic explorations for players who love experimentation."
      }
    ]
  },
  {
    title: "Structured Playlists",
    description:
      "Follow curated playlists that simulate guided courses complete with homework prompts.",
    resources: [
      {
        name: "30-Day Songwriting Bootcamp",
        format: "Playlist",
        focus: "Daily Prompts",
        link: "https://www.youtube.com/playlist?list=PL1A2F2A3",
        summary: "Short daily assignments that move from lyric sketches to full demos in a month."
      },
      {
        name: "Mixing Essentials in Logic Pro",
        format: "Playlist",
        focus: "Home Studio",
        link: "https://www.youtube.com/playlist?list=PL2F3G4H5",
        summary: "Step-by-step walkthroughs on EQ, compression, and mix bus processing for indie releases."
      },
      {
        name: "Stage Presence Fundamentals",
        format: "Mini-Series",
        focus: "Performance",
        link: "https://www.youtube.com/playlist?list=PL7K8L9M0",
        summary: "Learn crowd engagement, mic control, and dynamic movement in live settings."
      }
    ]
  },
  {
    title: "Practice Accountability",
    description:
      "Use these formats to keep consistent practice logs and track incremental progress.",
    resources: [
      {
        name: "Practice With Me Streams",
        format: "Co-Practice",
        focus: "Routine Building",
        link: "https://www.youtube.com/results?search_query=music+practice+with+me",
        summary: "Join real-time practice rooms that mimic study halls for musicians working on technique."
      },
      {
        name: "Looped Backing Tracks",
        format: "Play-Along",
        focus: "Improvisation",
        link: "https://www.youtube.com/results?search_query=backing+tracks+for+guitar",
        summary: "Select tempo-specific jam tracks to develop improvisation vocabulary and stage endurance."
      },
      {
        name: "Ear Training Drills",
        format: "Interactive",
        focus: "Listening Skills",
        link: "https://www.youtube.com/results?search_query=ear+training+intervals",
        summary: "Build interval recognition speed with call-and-response exercises and on-screen quizzes."
      }
    ]
  }
];

const mentorPrograms = [
  {
    title: "Mentorship Tracks",
    description:
      "Choose a pathway that matches your current career phase and desired feedback style.",
    cohorts: [
      {
        name: "Songwriting Lab",
        focus: "Co-Writing Circle",
        cadence: "Bi-weekly",
        support: "Collaborative feedback on drafts, melody rewrites, and lyric polish." 
      },
      {
        name: "Stagecraft Intensive",
        focus: "Performance Coaching",
        cadence: "Monthly",
        support: "Virtual showcase critiques with movement and mic technique guidance."
      },
      {
        name: "Indie Release Accelerator",
        focus: "Launch Strategy",
        cadence: "Weekly",
        support: "Release calendar planning, marketing funnels, and analytics reviews."
      }
    ],
    action: {
      label: "Apply for Mentorship",
      href: "https://forms.gle/mentor-application"
    }
  },
  {
    title: "Expert Network",
    description:
      "Tap into a curated roster of industry veterans for one-off consultations or recurring coaching.",
    cohorts: [
      {
        name: "Creative Director",
        focus: "Visual Branding",
        cadence: "On-Demand",
        support: "Refine album art, stage visuals, and social media style guides."
      },
      {
        name: "Music Attorney",
        focus: "Contract Review",
        cadence: "Retainer",
        support: "Protect intellectual property, negotiate deals, and review licensing opportunities."
      },
      {
        name: "Tour Manager",
        focus: "Live Logistics",
        cadence: "Consulting",
        support: "Route tours, manage advancing, and streamline crew coordination."
      }
    ],
    action: {
      label: "Browse Mentor Roster",
      href: "https://rockmundo.com/mentors"
    }
  },
  {
    title: "Accountability Systems",
    description:
      "Stay consistent with structured check-ins, progress dashboards, and peer support.",
    cohorts: [
      {
        name: "Weekly Standups",
        focus: "Goal Tracking",
        cadence: "15 min",
        support: "Share wins, blockers, and next actions with your mentor pod."
      },
      {
        name: "Progress Journals",
        focus: "Reflection",
        cadence: "Daily",
        support: "Log practice stats, gig insights, and mindset notes inside Rockmundo."
      },
      {
        name: "Quarterly Audits",
        focus: "Career Review",
        cadence: "Seasonal",
        support: "Assess KPIs, adjust roadmaps, and celebrate milestones with your coach."
      }
    ],
    action: {
      label: "Download Templates",
      href: "https://notion.so"
    }
  }
];

const bandLearningTracks = [
  {
    title: "Band Intensives",
    description:
      "Plan immersive weekends that combine rehearsal, songwriting, and branding workshops.",
    sessions: [
      {
        name: "Day 1: Groove Lab",
        focus: "Tighten Rhythmic Chemistry",
        deliverable: "Record a live rehearsal take with click + crowd cues."
      },
      {
        name: "Day 2: Story & Stage",
        focus: "Brand Alignment",
        deliverable: "Craft a unified band bio, stage plot, and social hook."
      },
      {
        name: "Day 3: Release Sprint",
        focus: "Content Production",
        deliverable: "Capture video + photo assets for upcoming release cycle."
      }
    ],
    action: {
      label: "Download Weekend Agenda",
      href: "https://docs.google.com"
    }
  },
  {
    title: "Ongoing Band Curriculum",
    description:
      "Rotate focus areas each month to keep the whole group evolving in sync.",
    sessions: [
      {
        name: "Month 1: Arrangement Lab",
        focus: "Reimagine Setlist",
        deliverable: "New live transitions, medleys, and crowd participation cues."
      },
      {
        name: "Month 2: Business HQ",
        focus: "Operational Systems",
        deliverable: "Shared budget tracker, merch inventory log, and task board."
      },
      {
        name: "Month 3: Audience Engine",
        focus: "Growth Experiments",
        deliverable: "Launch fan challenges, collect emails, and test paid promotion."
      }
    ],
    action: {
      label: "View Curriculum",
      href: "https://rockmundo.com/band-learning"
    }
  },
  {
    title: "Performance Feedback Loops",
    description:
      "Capture data from every show to iterate faster as a unit.",
    sessions: [
      {
        name: "Show Debrief",
        focus: "Immediate Reflection",
        deliverable: "Rate crowd energy, set pacing, and technical stability within 24 hours."
      },
      {
        name: "Fan Pulse",
        focus: "Community Insights",
        deliverable: "Survey attendees, review social mentions, and note merch conversion."
      },
      {
        name: "Iterate & Implement",
        focus: "Action Plan",
        deliverable: "Assign next-step experiments for setlist, visuals, and engagement."
      }
    ],
    action: {
      label: "Create Feedback Form",
      href: "https://forms.gle/band-feedback"
    }
  }
];

const Education = () => {
  const { toast } = useToast();
  const {
    definitions,
    progress,
    loading: skillsLoading,
    error: skillsError,
    refreshProgress,
    updateSkillProgress
  } = useSkillSystem();
  const { attributes, skills, addActivity } = useGameData();

  const [videoWatchCounts, setVideoWatchCounts] = useState<Record<string, number>>({});
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [lastWatchedAt, setLastWatchedAt] = useState<Record<string, number>>({});

  useEffect(() => {
    void refreshProgress();
  }, [refreshProgress]);

  const progressBySlug = useMemo(() => {
    const map = new Map<string, SkillProgressRecord>();
    for (const record of progress ?? []) {
      if (record?.skill_slug) {
        map.set(record.skill_slug, record);
      }
    }
    return map;
  }, [progress]);

  const skillsRecord = useMemo(() => {
    return (skills as PlayerSkills | null) ?? null;
  }, [skills]);

  const getSkillValue = useCallback(
    (slug: string) => {
      const progressRecord = progressBySlug.get(slug);
      if (progressRecord) {
        const numeric = Number(progressRecord.current_value ?? progressRecord.total_xp ?? 0);
        if (Number.isFinite(numeric)) {
          return numeric;
        }
      }

      const fallback = skillsRecord?.[slug];
      if (typeof fallback === "number" && Number.isFinite(fallback)) {
        return fallback;
      }

      return 0;
    },
    [progressBySlug, skillsRecord]
  );

  const getCooldownRemaining = useCallback(
    (slug: string) => {
      const readyAt = cooldowns[slug];
      if (!readyAt) {
        return 0;
      }

      const remainingMs = readyAt - Date.now();
      if (remainingMs <= 0) {
        return 0;
      }

      return Math.ceil(remainingMs / 60000);
    },
    [cooldowns]
  );

  const groupedSkills = useMemo(() => {
    if (!definitions || definitions.length === 0) {
      return [] as Array<{ category: string; skills: SkillDefinitionRecord[] }>;
    }

    const map = new Map<string, SkillDefinitionRecord[]>();
    for (const definition of definitions) {
      const category = (definition.metadata?.category as string | undefined) ?? "General";
      if (!map.has(category)) {
        map.set(category, []);
      }
      map.get(category)?.push(definition);
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, list]) => ({
        category,
        skills: list.sort((a, b) => {
          const tierA = ensureTier(a.metadata?.tier);
          const tierB = ensureTier(b.metadata?.tier);
          if (tierA === tierB) {
            return (a.display_name ?? a.slug).localeCompare(b.display_name ?? b.slug);
          }
          const order: Record<TierName, number> = { Basic: 0, Professional: 1, Mastery: 2 };
          return order[tierA] - order[tierB];
        })
      }));
  }, [definitions]);

  const startTrainingSession = useCallback(
    async (
      payload: {
        skillSlug: string;
        skillName: string;
        durationMinutes: number;
        xpGain: number;
        videoUrl: string;
        watchCount: number;
        tier: TierName;
        attributeMultiplier: number;
        attributeKeys: AttributeKey[];
      }
    ) => {
      try {
        await addActivity(
          "skill_training",
          `Watched a ${payload.skillName} YouTube lesson`,
          undefined,
          {
            source: "youtube_video",
            skill_slug: payload.skillSlug,
            duration_minutes: payload.durationMinutes,
            xp_gain: payload.xpGain,
            watch_count: payload.watchCount,
            tier: payload.tier,
            attribute_multiplier: payload.attributeMultiplier,
            attribute_keys: payload.attributeKeys,
            video_url: payload.videoUrl
          }
        );
      } catch (error) {
        console.error("Failed to log training session", error);
      }
    },
    [addActivity]
  );

  const handleWatchVideo = useCallback(
    async (definition: SkillDefinitionRecord) => {
      const slug = definition.slug;
      const skillValue = getSkillValue(slug);

      if (skillValue <= 0) {
        toast({
          title: "Skill locked",
          description: "Unlock this skill by reaching level 1 before training with videos.",
          variant: "destructive"
        });
        return;
      }

      const remainingCooldown = getCooldownRemaining(slug);
      if (remainingCooldown > 0) {
        toast({
          title: "Cooldown active",
          description: `Come back in ${remainingCooldown} minute${remainingCooldown === 1 ? "" : "s"} to gain full rewards.`,
          variant: "default"
        });
        return;
      }

      const videoUrl = buildVideoUrl(definition);
      let pendingWindow: Window | null = null;
      if (typeof window !== "undefined") {
        pendingWindow = window.open(videoUrl, "_blank", "noopener,noreferrer");
      }

      setActiveSkill(slug);

      try {
        const watchCount = videoWatchCounts[slug] ?? 0;
        const nextWatchCount = watchCount + 1;
        const preview = computeTrainingPreview(definition, attributes, nextWatchCount);

        await startTrainingSession({
          skillSlug: slug,
          skillName: definition.display_name ?? slug,
          durationMinutes: preview.durationMinutes,
          xpGain: preview.xpGain,
          videoUrl,
          watchCount: nextWatchCount,
          tier: preview.tier,
          attributeMultiplier: preview.attributeMultiplier,
          attributeKeys: preview.attributeKeys
        });

        const newSkillValue = Math.min(1000, Math.round(skillValue + preview.xpGain));
        await updateSkillProgress({
          skillSlug: slug,
          newSkillValue,
          xpGain: preview.xpGain,
          timestamp: new Date().toISOString(),
          markUnlocked: true
        });

        setVideoWatchCounts((prev) => ({
          ...prev,
          [slug]: nextWatchCount
        }));

        const cooldownMinutes = computeCooldownMinutes(preview.durationMinutes, nextWatchCount);
        setCooldowns((prev) => ({
          ...prev,
          [slug]: Date.now() + cooldownMinutes * 60000
        }));

        setLastWatchedAt((prev) => ({
          ...prev,
          [slug]: Date.now()
        }));

        toast({
          title: "Session completed",
          description: `You earned ${preview.xpGain} XP from ${definition.display_name ?? slug}.`
        });

        void refreshProgress();
      } catch (error) {
        console.error("Failed to process training session", error);
        if (pendingWindow && !pendingWindow.closed) {
          pendingWindow.close();
        }
        toast({
          title: "Training failed",
          description: error instanceof Error ? error.message : "Something went wrong while awarding XP.",
          variant: "destructive"
        });
      } finally {
        setActiveSkill(null);
      }
    },
    [
      attributes,
      getCooldownRemaining,
      getSkillValue,
      refreshProgress,
      startTrainingSession,
      toast,
      updateSkillProgress,
      videoWatchCounts
    ]
  );

  const renderSkillCard = useCallback(
    (definition: SkillDefinitionRecord) => {
      const slug = definition.slug;
      const displayName = definition.display_name ?? slug;
      const watchCount = videoWatchCounts[slug] ?? 0;
      const nextPreview = computeTrainingPreview(definition, attributes, watchCount + 1);
      const tier = nextPreview.tier;
      const cooldownRemaining = getCooldownRemaining(slug);
      const skillValue = getSkillValue(slug);
      const progressValue = Number.isFinite(skillValue) ? Math.min(100, (skillValue / 1000) * 100) : 0;
      const attributeLabels = nextPreview.attributeKeys.map((key) => ATTRIBUTE_METADATA[key]?.label ?? key).join(", ");
      const lastWatched = lastWatchedAt[slug];

      return (
        <Card key={slug} className="h-full border-dashed">
          <CardHeader className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base font-semibold">{displayName}</CardTitle>
                {definition.description ? (
                  <CardDescription className="text-xs">{definition.description}</CardDescription>
                ) : null}
              </div>
              <Badge variant="secondary" className="text-xs font-semibold">
                {tier}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{(definition.metadata?.track as string | undefined) ?? "Skill Training"}</span>
              <span className="hidden sm:inline">•</span>
              <span>{(definition.metadata?.category as string | undefined) ?? "General"}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Progress value={progressValue} className="h-2" />
              <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
                <span>Skill value</span>
                <span>{Math.round(skillValue)}</span>
              </div>
            </div>

            <div className="space-y-1 rounded-lg border bg-muted/40 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span>Next XP reward</span>
                <span className="font-semibold">+{nextPreview.xpGain}</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Duration</span>
                <span>{nextPreview.durationMinutes} minutes</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Attribute boost</span>
                <span>
                  ×{nextPreview.attributeMultiplier.toFixed(2)}
                  {attributeLabels ? ` (${attributeLabels})` : ""}
                </span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Watch bonus</span>
                <span>{((nextPreview.watchBonus - 1) * 100).toFixed(0)}%</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Cooldown after session</span>
                <span>{computeCooldownMinutes(nextPreview.durationMinutes, watchCount + 1)} min</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>Watch count: {watchCount}</span>
              {lastWatched ? (
                <span>Last watched {new Date(lastWatched).toLocaleTimeString()}</span>
              ) : (
                <span>Not watched yet</span>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={() => handleWatchVideo(definition)}
                disabled={activeSkill === slug || skillValue <= 0}
                className="w-full sm:flex-1"
              >
                {activeSkill === slug ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing
                  </>
                ) : (
                  <>
                    <PlaySquare className="mr-2 h-4 w-4" />
                    Watch & Train
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => {
                  const url = buildVideoUrl(definition);
                  if (typeof window !== "undefined") {
                    window.open(url, "_blank", "noopener,noreferrer");
                  }
                }}
              >
                Open Playlist
              </Button>
            </div>

            {skillValue <= 0 ? (
              <p className="text-xs font-medium text-destructive">
                Unlock this skill by progressing to level 1 before training with YouTube resources.
              </p>
            ) : cooldownRemaining > 0 ? (
              <p className="text-xs text-muted-foreground">
                Cooldown active — ready in {cooldownRemaining} minute{cooldownRemaining === 1 ? "" : "s"}.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Ready to train now.</p>
            )}
          </CardContent>
        </Card>
      );
    },
    [
      activeSkill,
      attributes,
      getCooldownRemaining,
      getSkillValue,
      handleWatchVideo,
      lastWatchedAt,
      videoWatchCounts
    ]
  );

  return (
    <div className="space-y-8 pb-16">
      <div className="space-y-3 text-center">
        <Badge variant="outline" className="mx-auto w-fit px-4 py-1 text-sm font-semibold">
          Education Hub
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Level Up Your Musical Journey</h1>
        <p className="mx-auto max-w-3xl text-base text-muted-foreground sm:text-lg">
          Discover the best resources for self-paced learning, formal education, and collaborative growth. Pick a
          pathway, follow the curated plan, and keep your skills—and your band—constantly evolving.
        </p>
      </div>

      <Tabs defaultValue="books" className="space-y-6">
        <TabsList className="grid w-full gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger key={tab.value} value={tab.value} className="flex flex-col gap-1 py-3">
                <span className="flex items-center justify-center gap-2 text-sm font-semibold">
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </span>
                <span className="hidden text-xs font-normal text-muted-foreground lg:block">{tab.description}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="books" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Curated Reading Tracks</CardTitle>
              <CardDescription>
                Start with foundational skills, then branch into creative mastery and business strategy as you grow.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {bookCollections.map((collection) => (
                <Card key={collection.title} className="border-dashed">
                  <CardHeader className="space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <CardTitle className="text-lg">{collection.title}</CardTitle>
                      <Badge variant="secondary">3 titles</Badge>
                    </div>
                    <CardDescription>{collection.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {collection.items.map((item) => (
                      <div key={item.name} className="rounded-lg border bg-muted/30 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{item.author}</p>
                          </div>
                          <Badge variant="outline" className="whitespace-nowrap text-xs">
                            {item.focus}
                          </Badge>
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">{item.takeaway}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="university" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Academic Pathways</CardTitle>
              <CardDescription>
                Blend formal study with real-world experience using programs designed for modern performers.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-3">
              {universityTracks.map((track) => (
                <Card key={track.title} className="border-dashed">
                  <CardHeader className="space-y-2">
                    <CardTitle className="text-lg">{track.title}</CardTitle>
                    <CardDescription>{track.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      {track.highlights.map((highlight) => (
                        <div key={highlight.name} className="rounded-lg border bg-muted/30 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold">{highlight.name}</p>
                              <p className="text-xs text-muted-foreground">{highlight.school}</p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {highlight.focus}
                            </Badge>
                          </div>
                          <p className="mt-3 text-xs text-muted-foreground">{highlight.details}</p>
                        </div>
                      ))}
                    </div>
                    {track.action ? (
                      <Button asChild variant="secondary" className="w-full">
                        <a href={track.action.href} target="_blank" rel="noreferrer">
                          {track.action.label}
                        </a>
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="videos" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>YouTube Skill Training</CardTitle>
              <CardDescription>
                Pick a skill, watch a curated lesson, and earn XP scaled by your mastery tier and attribute strengths.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {skillsError ? (
                <p className="text-sm text-destructive">
                  Unable to load skill data right now. Refresh the page or try again later.
                </p>
              ) : null}

              {skillsLoading ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-64 animate-pulse rounded-lg border border-dashed bg-muted/40"
                    />
                  ))}
                </div>
              ) : groupedSkills.length > 0 ? (
                groupedSkills.map((group) => (
                  <div key={group.category} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        {group.category}
                      </h3>
                      <Badge variant="outline" className="text-xs">
                        {group.skills.length} skills
                      </Badge>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {group.skills.map((definition) => renderSkillCard(definition))}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No trainable skills are available yet. Unlock skills in your profile to see tailored lessons.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Supplemental Playlists</CardTitle>
              <CardDescription>
                Keep learning between training sessions with curated channels and playlists covering every discipline.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {videoPlaylists.map((playlist) => (
                <Card key={playlist.title} className="border-dashed">
                  <CardHeader className="space-y-2">
                    <CardTitle className="text-lg">{playlist.title}</CardTitle>
                    <CardDescription>{playlist.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {playlist.resources.map((resource) => (
                      <div key={resource.name} className="space-y-3 rounded-lg border bg-muted/30 p-4">
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
                          <a href={resource.link} target="_blank" rel="noreferrer">
                            Watch now
                          </a>
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mentors" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Guided Mentorship</CardTitle>
              <CardDescription>
                Partner with mentors who accelerate your growth with actionable feedback and steady accountability.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {mentorPrograms.map((program) => (
                <Card key={program.title} className="border-dashed">
                  <CardHeader className="space-y-2">
                    <CardTitle className="text-lg">{program.title}</CardTitle>
                    <CardDescription>{program.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      {program.cohorts.map((cohort) => (
                        <div key={cohort.name} className="rounded-lg border bg-muted/30 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold">{cohort.name}</p>
                              <p className="text-xs text-muted-foreground">{cohort.focus}</p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {cohort.cadence}
                            </Badge>
                          </div>
                          <p className="mt-3 text-xs text-muted-foreground">{cohort.support}</p>
                        </div>
                      ))}
                    </div>
                    {program.action ? (
                      <Button asChild variant="secondary" className="w-full">
                        <a href={program.action.href} target="_blank" rel="noreferrer">
                          {program.action.label}
                        </a>
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="band" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Band Learning Lab</CardTitle>
              <CardDescription>
                Align your entire crew with immersive intensives, monthly focus cycles, and actionable feedback loops.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {bandLearningTracks.map((track) => (
                <Card key={track.title} className="border-dashed">
                  <CardHeader className="space-y-2">
                    <CardTitle className="text-lg">{track.title}</CardTitle>
                    <CardDescription>{track.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {track.sessions.map((session) => (
                      <div key={session.name} className="rounded-lg border bg-muted/30 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{session.name}</p>
                            <p className="text-xs text-muted-foreground">{session.focus}</p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {session.deliverable}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {track.action ? (
                      <Button asChild variant="secondary" className="w-full">
                        <a href={track.action.href} target="_blank" rel="noreferrer">
                          {track.action.label}
                        </a>
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Education;
