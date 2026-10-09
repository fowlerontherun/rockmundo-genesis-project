import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { groupSkillFamilies, resolveSkillTier, skillFamilyKey } from "@/utils/skillFamilies";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/lib/supabase-types";
import { useGameData } from "@/hooks/useGameData";
import {
  Star,
  Music,
  Users,
  Mic,
  Lock,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  List,
  Filter,
  GraduationCap,
  Palette,
} from "lucide-react";
import { HierarchicalSkillNode } from "./skills/HierarchicalSkillNode";
import { CompactSkillRow } from "./skills/CompactSkillRow";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShareMomentSheet } from "@/features/shareable-moments/ShareMomentSheet";
import type { ShareMoment } from "@/features/shareable-moments/types";
import { shouldOfferSharePrompt } from "@/features/shareable-moments/prompts";
import { referralAwareDestination } from "@/features/shareable-moments/referralDestination";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  type EducationSource,
  getSourceFromActivityType,
} from "./skills/EducationSourceBadge";
import {
  useSkillCatalogue,
  useProfileSkillAvailability,
} from "@/hooks/useSkillCatalogue";
import {
  getSkillAttributeLinks,
  getSkillPrerequisites,
  getSkillRoleLinks,
  getSkillSystemLinks,
  getAttributeLabel,
  getSkillUnlockRoutes,
} from "@/utils/skillCatalogue";

type SkillDefinition = Database["public"]["Tables"]["skill_definitions"]["Row"];
type SkillProgress = Database["public"]["Tables"]["skill_progress"]["Row"];

interface SkillCategory {
  key: string;
  name: string;
  icon: React.ReactNode;
  patterns: string[];
}

interface SkillTreeProps {
  xpBalance?: number;
  onXpSpent?: () => void;
}

type ViewMode = "card" | "list";
type FilterMode = "all" | "learned" | "education" | "unlearned" | "maxed";
const tierOrder = { basic: 0, professional: 1, mastery: 2 } as const;

const SKILL_CATEGORIES: SkillCategory[] = [
  {
    key: "songwriting",
    name: "Songwriting & Production",
    icon: <Music className="h-5 w-5" />,
    patterns: [
      "songwriting",
      "composing",
      "lyrics",
      "production",
      "daw",
      "beatmaking",
      "sampling",
      "sound_design",
      "mixing",
      "vocal",
      "ai_music",
      "live_looping",
    ],
  },
  {
    key: "genres",
    name: "Genres",
    icon: <Star className="h-5 w-5" />,
    patterns: [
      "genres_",
      "rock",
      "pop",
      "hip_hop",
      "jazz",
      "blues",
      "edm",
      "trap",
      "country",
      "reggae",
      "metal",
      "classical",
      "latin",
      "rnb",
      "punk",
      "flamenco",
      "african",
      "drill",
      "lofi",
      "kpop",
      "afrobeats",
      "synthwave",
      "indie",
      "hyperpop",
      "metalcore",
      "alt_rnb",
      "funk",
      "soul",
      "gospel",
      "folk",
      "ska",
      "grunge",
      "ambient",
      "house",
      "techno",
      "trance",
      "dubstep",
    ],
  },
  {
    key: "instruments",
    name: "Instruments & Performance",
    icon: <Mic className="h-5 w-5" />,
    patterns: [
      "instruments_",
      "singing",
      "rapping",
      "brass",
      "keyboard",
      "percussions",
      "strings",
      "woodwind",
      "electronic_instruments",
      "modern_bass",
      "synths",
      "percussion_drums",
      "dj",
      "midi",
      "piano",
      "drums",
      "guitar",
      "bass",
      "vocals",
      "violin",
      "cello",
      "saxophone",
      "trumpet",
      "harmonica",
    ],
  },
  {
    key: "tattooing",
    name: "Tattooing",
    icon: <Palette className="h-5 w-5" />,
    patterns: ["tattooing_"],
  },
  {
    key: "stage",
    name: "Stage & Showmanship",
    icon: <Users className="h-5 w-5" />,
    patterns: [
      "showmanship",
      "stage",
      "visual",
      "social_media",
      "streaming",
      "crowd",
      "performance",
    ],
  },
];

const matchesCategory = (slug: string, category: SkillCategory): boolean => {
  const lowerSlug = slug.toLowerCase();
  return category.patterns.some((pattern) => lowerSlug.includes(pattern));
};

export const SkillTree: React.FC<SkillTreeProps> = ({
  xpBalance = 0,
  onXpSpent,
}) => {
  const { profile } = useGameData();
  const catalogueQuery = useSkillCatalogue();
  const availabilityQuery = useProfileSkillAvailability(profile?.id);
  const [skills, setSkills] = useState<SkillDefinition[]>([]);
  const [progress, setProgress] = useState<SkillProgress[]>([]);
  const [educationSources, setEducationSources] = useState<
    Record<string, EducationSource[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showUnlocked, setShowUnlocked] = useState(false);
  const [shareMoment, setShareMoment] = useState<ShareMoment | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [hideMaxed, setHideMaxed] = useState(false);
  const [groupFamilies, setGroupFamilies] = useState(true);
  const [skillSearch, setSkillSearch] = useState("");
  const [expandedFamilies, setExpandedFamilies] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const canonicalSkills = catalogueQuery.data ?? [];
      setSkills(
        canonicalSkills.map(
          (skill) =>
            ({
              id: skill.id,
              slug: skill.slug,
              display_name: skill.name,
              description: skill.description,
              tier_caps: {
                max_level: skill.max_level,
                tier: skill.tier,
              } as any,
              created_at: null,
              updated_at: null,
            }) as SkillDefinition,
        ),
      );

      if (profile) {
        // Fetch progress
        const { data: progressData, error: progressError } = await supabase
          .from("skill_progress")
          .select("*")
          .eq("profile_id", profile.id);

        if (progressError) throw progressError;
        setProgress(progressData ?? []);

        // Fetch education sources from experience_ledger
        const { data: ledgerData } = await supabase
          .from("experience_ledger")
          .select("skill_slug, activity_type")
          .eq("profile_id", profile.id)
          .not("skill_slug", "is", null);

        if (ledgerData) {
          const sourcesMap: Record<string, Set<EducationSource>> = {};
          ledgerData.forEach((entry) => {
            if (!entry.skill_slug) return;
            const source = getSourceFromActivityType(entry.activity_type);
            if (source) {
              if (!sourcesMap[entry.skill_slug]) {
                sourcesMap[entry.skill_slug] = new Set();
              }
              sourcesMap[entry.skill_slug].add(source);
            }
          });

          const formatted: Record<string, EducationSource[]> = {};
          Object.entries(sourcesMap).forEach(([slug, sources]) => {
            formatted[slug] = Array.from(sources);
          });
          setEducationSources(formatted);
        }
      }
    } catch (error) {
      console.error("Error fetching skills:", error);
      toast.error("Failed to load skills");
    } finally {
      setLoading(false);
    }
  }, [profile, catalogueQuery.data]);

  useEffect(() => {
    if (!catalogueQuery.isLoading) fetchData();
  }, [fetchData, refreshKey, catalogueQuery.isLoading]);

  const handleSkillTrained = () => {
    setRefreshKey((prev) => prev + 1);
    void availabilityQuery.refetch();
    onXpSpent?.();
  };

  const getSkillProgress = (skillSlug: string): SkillProgress | null => {
    return progress.find((p) => p.skill_slug === skillSlug) || null;
  };

  // Get set of learned skill slugs
  const learnedSlugs = useMemo(
    () => new Set(progress.filter((p) => (p.current_level ?? 0) > 0).map((p) => p.skill_slug)),
    [progress],
  );

  // Education skill slugs
  const educationSlugs = useMemo(
    () => new Set(Object.keys(educationSources)),
    [educationSources],
  );

  // Filter and categorize skills
  const filteredSkills = useMemo(() => {
    let filtered = [...skills];

    // Also include skills from progress that might not be in definitions
    const progressSlugs = progress.map((p) => p.skill_slug);
    const missingFromDefs = progressSlugs.filter(
      (slug) => !skills.some((s) => s.slug === slug),
    );

    // Add placeholder definitions for missing skills
    missingFromDefs.forEach((slug) => {
      filtered.push({
        id: slug,
        slug,
        display_name: slug
          .split("_")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" "),
        description: "Skill from education or training",
        tier_caps: null,
        created_at: null,
        updated_at: null,
      });
    });

    const search = skillSearch.trim().toLowerCase();
    if (search) filtered = filtered.filter((skill) =>
      skill.display_name.toLowerCase().includes(search) ||
      skill.slug.toLowerCase().includes(search) ||
      skillFamilyKey(skill.slug).replace(/_/g, " ").includes(search) ||
      skillFamilyKey(skill.slug).includes(search)
    );

    // Apply category filter
    if (selectedCategory !== "all") {
      const category = SKILL_CATEGORIES.find((c) => c.key === selectedCategory);
      if (category) {
        filtered = filtered.filter((skill) =>
          matchesCategory(skill.slug, category),
        );
      }
    }

    // Apply filter mode
    switch (filterMode) {
      case "learned":
        filtered = filtered.filter((skill) => learnedSlugs.has(skill.slug));
        break;
      case "maxed":
        filtered = filtered.filter((skill) => {
          const level = progress.find((p) => p.skill_slug === skill.slug)?.current_level ?? 0;
          const cap = Number((skill.tier_caps as any)?.max_level) || 100;
          return level >= cap;
        });
        break;
      case "education":
        filtered = filtered.filter((skill) => educationSlugs.has(skill.slug));
        break;
      case "unlearned":
        filtered = filtered.filter((skill) => !learnedSlugs.has(skill.slug));
        break;
    }

    // An explicit Maxed filter takes precedence over the hide-maxed preference.
    if (hideMaxed && filterMode !== "maxed") {
      filtered = filtered.filter((skill) => {
        const sp = progress.find((p) => p.skill_slug === skill.slug);
        const lvl = sp?.current_level ?? 0;
        const cap = Number((skill.tier_caps as any)?.max_level) || 100;
        return lvl < cap;
      });
    }

    // Sort by tier then name
    filtered.sort((a, b) => {
      const tierDiff =
        tierOrder[resolveSkillTier(a.slug, (a.tier_caps as any)?.tier)] - tierOrder[resolveSkillTier(b.slug, (b.tier_caps as any)?.tier)];
      if (tierDiff !== 0) return tierDiff;
      return a.display_name.localeCompare(b.display_name);
    });

    if (groupFamilies) filtered.sort((a, b) =>
      skillFamilyKey(a.slug).localeCompare(skillFamilyKey(b.slug)) ||
      tierOrder[resolveSkillTier(a.slug, (a.tier_caps as any)?.tier)] - tierOrder[resolveSkillTier(b.slug, (b.tier_caps as any)?.tier)] ||
      a.display_name.localeCompare(b.display_name)
    );
    return filtered;
  }, [
    skills,
    progress,
    selectedCategory,
    filterMode,
    learnedSlugs,
    educationSlugs,
    hideMaxed,
    groupFamilies,
    skillSearch,
  ]);

  // Count skills per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: learnedSlugs.size };
    SKILL_CATEGORIES.forEach((cat) => {
      counts[cat.key] = [...learnedSlugs].filter((slug) =>
        matchesCategory(slug, cat),
      ).length;
    });
    return counts;
  }, [learnedSlugs]);

  const skillFamilies = useMemo(() => groupSkillFamilies(skills.map((skill) => ({
    slug: skill.slug,
    name: skill.display_name,
    tier: resolveSkillTier(skill.slug, (skill.tier_caps as any)?.tier),
    maxLevel: Number((skill.tier_caps as any)?.max_level) || 100,
    level: progress.find((item) => item.skill_slug === skill.slug)?.current_level ?? 0,
  }))), [skills, progress]);

  const maxedCount = useMemo(() => skills.filter((skill) => {
    const level = progress.find((p) => p.skill_slug === skill.slug)?.current_level ?? 0;
    const cap = Number((skill.tier_caps as any)?.max_level) || 100;
    return cap > 0 && level >= cap;
  }).length, [skills, progress]);

  const nextSteps = useMemo(() => skills.filter((skill) => {
    if (learnedSlugs.has(skill.slug)) return false;
    const prerequisites = getSkillPrerequisites(skill.slug).filter((req) => req.prerequisite_type === "required");
    return prerequisites.every((req) =>
      (progress.find((p) => p.skill_slug === req.prerequisite_skill_slug)?.current_level ?? 0) >= req.required_level
    );
  }).filter((skill) => (availabilityQuery.data ?? []).some((item) => item.slug === skill.slug && item.status === "available_to_unlock"))
    .sort((a, b) => {
      const roleScore = (slug: string) => getSkillRoleLinks(slug).reduce((sum, link) => sum + link.weight, 0);
      const score = (skill: SkillDefinition) =>
        (skillFamilies.find((family) => family.key === skillFamilyKey(skill.slug))?.skills.some((item) => item.level > 0) ? 100 : 0) +
        roleScore(skill.slug) * 10 +
        (getSkillPrerequisites(skill.slug).some((req) => req.prerequisite_type === "required") ? 5 : 0);
      return score(b) - score(a) || a.display_name.localeCompare(b.display_name);
    }).slice(0, 5), [skills, progress, learnedSlugs, availabilityQuery.data, skillFamilies]);

  const availabilityBySlug = useMemo(
    () =>
      new Map((availabilityQuery.data ?? []).map((item) => [item.slug, item])),
    [availabilityQuery.data],
  );

  const unlockedNextTiers = useMemo(() => {
    const normalise = skillFamilyKey;
    return progress.flatMap((p) => {
      const from = skills.find((s) => s.slug === p.skill_slug);
      if (!from) return [];
      const fromTier = resolveSkillTier(from.slug, (from.tier_caps as any)?.tier);
      if (fromTier === "mastery") return [];
      const cap = Number((from.tier_caps as any)?.max_level) || 100;
      if ((p.current_level || 0) < cap) return [];
      const targetTier = fromTier === "basic" ? "professional" : "mastery";
      const core = normalise(from.slug);
      const next = skills.find(
        (s) => resolveSkillTier(s.slug, (s.tier_caps as any)?.tier) === targetTier && normalise(s.slug) === core,
      );
      if (!next) return [];
      const nextProgress = progress.find((q) => q.skill_slug === next.slug);
      return [{ from, next, started: (nextProgress?.current_level || 0) > 0 }];
    });
  }, [progress, skills]);

  useEffect(() => {
    if (!profile?.id || shareMoment || skills.length === 0) return;
    const mastered = progress.find((item) => {
      const skill = skills.find((candidate) => candidate.slug === item.skill_slug);
      const cap = Number((skill?.tier_caps as any)?.max_level) || 100;
      return cap > 0 && (item.current_level || 0) >= cap;
    });
    if (!mastered) return;
    const skill = skills.find((candidate) => candidate.slug === mastered.skill_slug);
    if (!skill || !shouldOfferSharePrompt("skill-mastered", `${profile.id}:${skill.slug}`)) return;
    void (async () => {
      const destinationUrl = await referralAwareDestination(profile.id, window.location.href, "skill_share");
      setShareMoment({
      version: 1,
      promptOnly: true,
      promptKind: "skill-mastered",
      promptSourceId: `${profile.id}:${skill.slug}`,
      promptLabel: "Share skill mastery",
      type: "achievement",
      id: `skill:${skill.slug}`,
      eyebrow: "SKILL MASTERED",
      headline: skill.display_name,
      subheadline: "Mastered a RockMundo skill",
      metrics: [{ label: "Level", value: String(mastered.current_level || 0) }, { label: "Tier", value: resolveSkillTier(skill.slug, (skill.tier_caps as any)?.tier) }],
      destinationUrl,
      referralCode: null,
      createdAt: new Date().toISOString(),
    });
    })();
  }, [profile?.id, progress, skills, shareMoment]);

  useEffect(() => {
    if (!profile?.id || unlockedNextTiers.length === 0 || availabilityQuery.isLoading) return;
    unlockedNextTiers.filter(({ next }) => availabilityBySlug.get(next.slug)?.status === "available_to_unlock").forEach(({ from, next }) => {
      const key = `rockmundo:skill-tier-unlock:${profile.id}:${next.slug}`;
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
      toast.success(`${next.display_name} unlocked`, {
        description: `You maxed ${from.display_name}. The next tier is now visible in your skill tree and can be learned through Education.`,
      });
    });
  }, [profile?.id, unlockedNextTiers, availabilityBySlug, availabilityQuery.isLoading]);

  if (loading || catalogueQuery.isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Skill progression summary">
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Learned</p><p className="text-xl font-bold">{learnedSlugs.size}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Maxed</p><p className="text-xl font-bold">{maxedCount}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Not learned</p><p className="text-xl font-bold">{skills.filter((s) => !learnedSlugs.has(s.slug)).length}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Suggested unlocks</p><p className="text-xl font-bold">{nextSteps.length}</p></CardContent></Card>
      </div>
      {nextSteps.length > 0 && <Card><CardHeader className="pb-2"><CardTitle className="text-base">Suggested next skills</CardTitle></CardHeader><CardContent className="space-y-2">
        {nextSteps.map((skill) => <div key={skill.slug} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{skill.display_name}</span><Button size="sm" variant="outline" onClick={() => { setSelectedCategory("all"); setFilterMode("all"); setHideMaxed(false); setGroupFamilies(true); setSkillSearch(skillFamilyKey(skill.slug)); setExpandedFamilies((current) => [...new Set([...current, skillFamilyKey(skill.slug)])]); document.getElementById("skill-tree-results")?.scrollIntoView({behavior:"smooth"}); }}>View progression</Button></div>)}
        <p className="text-xs text-muted-foreground">Prerequisites met based on recorded levels. Check skill availability and Education before training.</p>
      </CardContent></Card>}
      <p className="text-xs text-muted-foreground">{skillFamilies.length} skill families in the catalogue</p>
      {/* Header with controls */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">Skills</h2>
            <Badge variant="secondary">{learnedSlugs.size} learned</Badge>
            {educationSlugs.size > 0 && (
              <Badge variant="outline" className="gap-1">
                <GraduationCap className="h-3 w-3" />
                {educationSlugs.size} from education
              </Badge>
            )}
          </div>

          {/* View mode toggle */}
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(v) => v && setViewMode(v as ViewMode)}
          >
            <ToggleGroupItem value="list" aria-label="List view" size="sm">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="card" aria-label="Card view" size="sm">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedCategory === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory("all")}
          >
            All
            <Badge variant="secondary" className="ml-1.5 text-xs">
              {categoryCounts.all}
            </Badge>
          </Button>
          {SKILL_CATEGORIES.map((category) => (
            <Button
              key={category.key}
              variant={
                selectedCategory === category.key ? "default" : "outline"
              }
              size="sm"
              onClick={() => setSelectedCategory(category.key)}
              className="flex items-center gap-1.5"
            >
              {category.icon}
              <span className="hidden sm:inline">{category.name}</span>
              <span className="sm:hidden">
                {category.key.charAt(0).toUpperCase() + category.key.slice(1)}
              </span>
              <Badge variant="secondary" className="ml-1 text-xs">
                {categoryCounts[category.key] || 0}
              </Badge>
            </Button>
          ))}
        </div>

        <Input aria-label="Search skills" placeholder="Search skills and families" value={skillSearch} onChange={(event) => setSkillSearch(event.target.value)} className="max-w-sm" />
        {/* Filter mode */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <ToggleGroup
            type="single"
            value={filterMode}
            onValueChange={(v) => v && setFilterMode(v as FilterMode)}
          >
            <ToggleGroupItem value="learned" size="sm">
              Learned
            </ToggleGroupItem>
            <ToggleGroupItem value="education" size="sm">
              <GraduationCap className="h-3 w-3 mr-1" />
              Education
            </ToggleGroupItem>
            <ToggleGroupItem value="all" size="sm">
              All
            </ToggleGroupItem>
            <ToggleGroupItem value="maxed" size="sm">Maxed</ToggleGroupItem>
            <ToggleGroupItem value="unlearned" size="sm">
              Unlearned
            </ToggleGroupItem>
          </ToggleGroup>
          <Button size="sm" variant={groupFamilies ? "default" : "outline"} onClick={() => setGroupFamilies((v) => !v)}>{groupFamilies ? "Grouped by family" : "Group families"}</Button>
          <Button
            variant={hideMaxed ? "default" : "outline"}
            size="sm"
            onClick={() => setHideMaxed((v) => !v)}
            className="text-xs h-8"
          >
            {hideMaxed ? "Hide maxed" : "Show maxed"}
          </Button>
        </div>
      </div>

      {/* Clear next-tier unlocks in the tree */}
      {unlockedNextTiers.some(({ next }) => availabilityBySlug.get(next.slug)?.status === "available_to_unlock") && (
        <div className="mb-2 rounded-md border border-primary/30 bg-primary/5 p-3">
          <p className="text-sm font-semibold">New skill tier unlocked</p>
          <div className="mt-2 space-y-1">
            {unlockedNextTiers.filter(({ next }) => availabilityBySlug.get(next.slug)?.status === "available_to_unlock").slice(0, 6).map(({ from, next, started }) => (
              <div key={next.slug} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">{from.display_name} maxed →</span>
                <span className="font-medium">{next.display_name}</span>
                <Badge variant="secondary">{started ? "In progress" : "Ready to learn"}</Badge>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Open Education and choose a book, course, YouTube course or mentor for the unlocked skill.
          </p>
        </div>
      )}

      {/* Skill availability is authoritative; unknown skills remain read-only until loaded. */}
      {/* Skills display */}
      <ScrollArea id="skill-tree-results" className="h-[500px] rounded-md border p-3">
        {filteredSkills.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No skills found matching your filters.</p>
            <p className="text-sm mt-1">Try changing the category or filter.</p>
          </div>
        ) : viewMode === "list" ? (
          <div className="space-y-1.5">
            {filteredSkills.map((skill, index) => {
              const previous = filteredSkills[index - 1];
              const family = skillFamilyKey(skill.slug);
              const showFamilyHeading = groupFamilies && (!previous || skillFamilyKey(previous.slug) !== family);
              const skillProgress = getSkillProgress(skill.slug);
              const tier = resolveSkillTier(skill.slug, (skill.tier_caps as any)?.tier);
              const availability = availabilityBySlug.get(skill.slug);
              const attrSummary = getSkillAttributeLinks(skill.slug)
                .map(
                  (link) =>
                    `${getAttributeLabel(link.attribute_key)} ${Math.round(link.weight * 100)}%`,
                )
                .join(", ");
              const prereqSummary = getSkillPrerequisites(skill.slug)
                .map(
                  (req) =>
                    `${req.prerequisite_skill_slug} Lv ${req.required_level}`,
                )
                .join(", ");
              const systems = getSkillSystemLinks(skill.slug)
                .map((link) => link.system_key.replace(/_/g, " "))
                .join(", ");
              const roles = getSkillRoleLinks(skill.slug)
                .map((link) => link.role_key.replace(/_/g, " "))
                .join(", ");
              return (
                <div key={skill.id} className="space-y-1">
                  {showFamilyHeading && (
                    <div className="rounded bg-muted px-3 py-2">
                      <button type="button" className="flex w-full items-center justify-between gap-2 text-left text-sm font-semibold capitalize" aria-expanded={expandedFamilies.includes(family)} onClick={() => setExpandedFamilies((current) => current.includes(family) ? current.filter((key) => key !== family) : [...current, family])}>
                        <span>{family.replace(/_/g, " ")} <span className="font-normal text-muted-foreground">· {skillFamilies.find((group) => group.key === family)?.skills.map((item) => item.tier).join(" → ")}</span></span>
                        {expandedFamilies.includes(family) ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                      </button>
                      {expandedFamilies.includes(family) && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {skillFamilies.find((group) => group.key === family)?.skills.map((item) => (
                            <Badge key={item.slug} variant={item.level >= item.maxLevel ? "default" : "outline"} className="capitalize">
                              {item.tier}: {item.level}/{item.maxLevel}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <CompactSkillRow
                    key={skill.id}
                    skill={skill}
                    progress={
                      skillProgress
                        ? {
                            current_level: skillProgress.current_level || 0,
                            current_xp: skillProgress.current_xp || 0,
                            required_xp: skillProgress.required_xp || 100,
                          }
                        : null
                    }
                    tier={tier}
                    isLocked={!availability || availability.status === "prerequisites_missing" || availability.status === "inactive" || availability.status === "hidden"}
                    xpBalance={xpBalance}
                    educationSources={educationSources[skill.slug] || []}
                    onTrain={handleSkillTrained}
                  />
                  <div className="px-3 pb-2 text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                    <span>
                      Max {(skill.tier_caps as any)?.max_level ?? 100}
                    </span>
                    {availability && (
                      <span>
                        Status: {availability.status.replace(/_/g, " ")}
                      </span>
                    )}
                    {availability?.blockedReason && (
                      <span className="text-destructive">
                        {availability.blockedReason.message}
                      </span>
                    )}
                    {getSkillUnlockRoutes(skill.slug).some((route) => route.route_type === "university_course") && <Link className="underline hover:text-foreground" to={`/education?tab=university&skill=${encodeURIComponent(skill.slug)}`}>Browse University courses</Link>}
                    {getSkillUnlockRoutes(skill.slug).some((route) => route.route_type === "book") && <Link className="underline hover:text-foreground" to={`/education?tab=books&skill=${encodeURIComponent(skill.slug)}`}>Browse Books</Link>}
                    {getSkillUnlockRoutes(skill.slug).some((route) => route.route_type === "lesson") && <Link className="underline hover:text-foreground" to={`/education?tab=mentors&skill=${encodeURIComponent(skill.slug)}`}>Find Mentors</Link>}
                    {getSkillUnlockRoutes(skill.slug).some((route) => route.route_type === "starter") && <span>Starter skill</span>}
                    <Link className="underline hover:text-foreground" to={`/education?tab=videos&skill=${encodeURIComponent(skill.slug)}`}>Browse Videos</Link>
                    {attrSummary && <span>Attributes: {attrSummary}</span>}
                    {prereqSummary && <span>Prereqs: {prereqSummary}</span>}
                    {systems && <span>Systems: {systems}</span>}
                    {roles && <span>Roles: {roles}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredSkills.map((skill) => {
              const skillProgress = getSkillProgress(skill.slug);
              const tier = resolveSkillTier(skill.slug, (skill.tier_caps as any)?.tier);
              return (
                <HierarchicalSkillNode
                  key={skill.id}
                  skill={skill}
                  progress={
                    skillProgress
                      ? {
                          current_level: skillProgress.current_level || 0,
                          current_xp: skillProgress.current_xp || 0,
                          required_xp: skillProgress.required_xp || 100,
                        }
                      : null
                  }
                  tier={tier}
                  maxLevel={Number((skill.tier_caps as any)?.max_level) || 100}
                  isLocked={!availabilityBySlug.get(skill.slug) || ["prerequisites_missing", "inactive", "hidden"].includes(availabilityBySlug.get(skill.slug)!.status)}
                  xpBalance={xpBalance}
                  onTrain={handleSkillTrained}
                />
              );
            })}
          </div>
        )}
      </ScrollArea>

      <ShareMomentSheet moment={shareMoment} open={!!shareMoment} onOpenChange={(open) => { if (!open) setShareMoment(null); }} />

      {/* Skills Not Started Section */}
      {filterMode !== "unlearned" &&
        skills.filter((s) => !learnedSlugs.has(s.slug)).length > 0 && (
          <Card className="border-muted bg-muted/20">
            <Collapsible open={showUnlocked} onOpenChange={setShowUnlocked}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-3">
                  <CardTitle className="flex items-center justify-between text-muted-foreground text-sm">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      <span>Skills Not Started</span>
                      <Badge variant="secondary" className="ml-1">
                        {skills.filter((s) => !learnedSlugs.has(s.slug)).length}
                      </Badge>
                    </div>
                    {showUnlocked ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground mb-3">
                    Learn skills through University, Books, Mentors, or YouTube
                    videos.
                  </p>
                  <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                    {skills
                      .filter((s) => !learnedSlugs.has(s.slug))
                      .slice(0, 24)
                      .map((skill) => (
                        <div
                          key={skill.id}
                          className="p-2 rounded border border-muted bg-background/50 opacity-60"
                        >
                          <p className="text-xs font-medium truncate">
                            {skill.display_name}
                          </p>
                          <Badge variant="outline" className="text-xs mt-0.5">
                            {resolveSkillTier(skill.slug, (skill.tier_caps as any)?.tier)}
                          </Badge>
                        </div>
                      ))}
                    {skills.filter((s) => !learnedSlugs.has(s.slug)).length >
                      24 && (
                      <div className="p-2 text-xs text-muted-foreground">
                        +
                        {skills.filter((s) => !learnedSlugs.has(s.slug)).length -
                          24}{" "}
                        more
                      </div>
                    )}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )}
    </div>
  );
};

export default SkillTree;
