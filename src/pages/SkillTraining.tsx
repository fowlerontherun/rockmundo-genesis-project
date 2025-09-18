
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { SKILL_TIER_ORDER, type TierName } from "@/data/skillTree";
import { type PlayerAttributes, useGameData } from "@/hooks/useGameData";
import { SkillSystemProvider } from "@/hooks/SkillSystemProvider";
import { useSkillSystem } from "@/hooks/useSkillSystem";
import {
  type SkillDefinitionRecord,
  type SkillProgressRecord,
  type SkillRelationshipRecord
} from "@/hooks/useSkillSystem.types";
import {
  calculateTrainingCost,
  extractAttributeScores,
  getFocusAttributeScore,
  getSkillCap,
  isOnCooldown,
  getRemainingCooldown,
  COOLDOWNS,
  type AttributeFocus
} from "@/utils/gameBalance";
import { applyCooldownModifier, applyRewardBonus } from "@/utils/attributeModifiers";
import {
  type LucideIcon,
  Guitar,
  Mic,
  Music,
  Drum,
  Volume2,
  PenTool,
  Star,
  Lock,
  Coins,
  Clock,
  TrendingUp,
  Wallet
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  guitar: Guitar,
  vocals: Mic,
  drums: Drum,
  bass: Volume2,
  performance: Star,
  songwriting: PenTool,
  genre: Music,
  stagecraft: Star
};

interface CurrentSkillEntry {
  slug: string;
  name: string;
  currentValue: number;
  description?: string;
  order: number;
}

const fallbackDefinitions: SkillDefinitionRecord[] = [
  {
    id: "guitar",
    slug: "guitar",
    display_name: "Guitar Practice",
    description: "Master guitar techniques and improve your playing skills",
    base_xp_gain: 5,
    training_duration_minutes: 30,
    icon_slug: "guitar",
    is_trainable: true
  },
  {
    id: "vocals",
    slug: "vocals",
    display_name: "Vocal Training",
    description: "Develop your voice range, control, and stage presence",
    base_xp_gain: 6,
    training_duration_minutes: 45,
    icon_slug: "vocals",
    is_trainable: true
  },
  {
    id: "drums",
    slug: "drums",
    display_name: "Drum Lessons",
    description: "Learn rhythm patterns and improve your timing",
    base_xp_gain: 5,
    training_duration_minutes: 40,
    icon_slug: "drums",
    is_trainable: true
  },
  {
    id: "bass",
    slug: "bass",
    display_name: "Bass Workshop",
    description: "Strengthen your bass fundamentals and groove",
    base_xp_gain: 5,
    training_duration_minutes: 35,
    icon_slug: "bass",
    is_trainable: true
  },
  {
    id: "performance",
    slug: "performance",
    display_name: "Stage Performance",
    description: "Enhance your stage presence and crowd engagement",
    base_xp_gain: 8,
    training_duration_minutes: 60,
    icon_slug: "performance",
    is_trainable: true
  },
  {
    id: "songwriting",
    slug: "songwriting",
    display_name: "Songwriting Class",
    description: "Learn composition, lyrics, and musical arrangement",
    base_xp_gain: 7,
    training_duration_minutes: 50,
    icon_slug: "songwriting",
    is_trainable: true
  }
];

const fallbackDescriptionBySlug = fallbackDefinitions.reduce<Record<string, string>>((acc, definition) => {
  acc[definition.slug] = definition.description ?? "";
  return acc;
}, {});

const fallbackDurationBySlug = fallbackDefinitions.reduce<Record<string, number>>((acc, definition) => {
  acc[definition.slug] = definition.training_duration_minutes ?? 30;
  return acc;
}, {});

const fallbackXpBySlug = fallbackDefinitions.reduce<Record<string, number>>((acc, definition) => {
  acc[definition.slug] = definition.base_xp_gain ?? 5;
  return acc;
}, {});

interface TrainingSessionConfig {
  slug: string;
  name: string;
  icon: LucideIcon;
  duration: number;
  xpGain: number;
  description: string;
  category: string;
  tier: TierName;
  track?: string;
  definition: SkillDefinitionRecord;
}

interface SessionRequirement {
  relationship: SkillRelationshipRecord;
  requiredName: string;
  currentValue: number;
}

interface DerivedSession extends TrainingSessionConfig {
  progressEntry?: SkillProgressRecord;
  isUnlocked: boolean;
  missingRequirement?: SessionRequirement;
  cooldownActive: boolean;
  remainingCooldown: number;
}

const resolveSessionFocus = (session: DerivedSession): AttributeFocus => {
  const slug = session.slug.toLowerCase();
  const category = session.category.toLowerCase();
  const track = session.track?.toLowerCase() ?? "";

  if (slug.includes("vocal") || category.includes("vocal") || track.includes("vocal")) {
    return "vocals";
  }

  if (
    slug.includes("song") ||
    category.includes("songwriting") ||
    track.includes("song") ||
    track.includes("lyric")
  ) {
    return "songwriting";
  }

  if (slug.includes("performance") || category.includes("stage") || track.includes("stage")) {
    return "performance";
  }

  if (category.includes("instrument") || track.includes("guitar") || track.includes("drum") || track.includes("bass")) {
    return "instrumental";
  }

  return "instrumental";
};

const formatSkillName = (slug: string) =>
  slug
    .split("_")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const isTierName = (value: unknown): value is TierName =>
  typeof value === "string" && SKILL_TIER_ORDER.includes(value as TierName);

const tierDescriptions: Record<TierName, string> = {
  Basic: "Foundation training and entry-level techniques.",
  Professional: "Advanced industry workflows and expert coaching.",
  Mastery: "Signature artistry for world-class performers."
};

const CATEGORY_ORDER = [
  "Songwriting & Production",
  "Genres",
  "Instruments & Performance",
  "Stage & Showmanship"
] as const;

const categoryPriority = new Map<string, number>(
  CATEGORY_ORDER.map((category, index) => [category, index])
);

const SkillTrainingContent = () => {
  const { toast } = useToast();
  const {
    profile,
    skills,
    attributes,
    xpWallet,
    updateProfile,
    awardActionXp,
    buyAttributeStar,
    addActivity,
    loading: gameDataLoading
  } = useGameData();
  const {
    definitions,
    relationships,
    progress,
    loading: skillSystemLoading,
    updateSkillProgress
  } = useSkillSystem();
  const [training, setTraining] = useState(false);

  const baseTrainingCooldown = COOLDOWNS.skillTraining;
  const trainingCooldown = applyCooldownModifier(baseTrainingCooldown, attributes?.physical_endurance);

  const playerLevel = Number(profile?.level ?? 1);
  const totalExperience = Number(profile?.experience ?? 0);
  const skillCap = getSkillCap(playerLevel, totalExperience);
  const walletBalance = Math.max(0, xpWallet?.xp_balance ?? 0);
  const lifetimeXp = Math.max(0, xpWallet?.lifetime_xp ?? totalExperience);

  const availableDefinitions = useMemo(() => {
    const trainable = definitions.filter(definition => definition.is_trainable !== false);
    return trainable.length > 0 ? trainable : fallbackDefinitions;
  }, [definitions]);

  const definitionBySlug = useMemo(() => {
    return availableDefinitions.reduce<Record<string, SkillDefinitionRecord>>((acc, definition) => {
      acc[definition.slug] = definition;
      return acc;
    }, {});
  }, [availableDefinitions]);

  const trainingSessions = useMemo<TrainingSessionConfig[]>(() => {
    return availableDefinitions.map(definition => {
      const slug = definition.slug;
      const iconKey = definition.icon_slug ?? slug;
      const Icon = iconMap[iconKey] ?? Music;
      const name = definition.display_name ?? formatSkillName(slug);
      const duration = Number(
        definition.training_duration_minutes ?? fallbackDurationBySlug[slug] ?? 30
      );
      const xpGain = Number(definition.base_xp_gain ?? fallbackXpBySlug[slug] ?? 5);
      const description = definition.description ?? fallbackDescriptionBySlug[slug] ?? name;
      const metadata = (definition.metadata ?? {}) as Record<string, unknown>;
      const category = typeof metadata.category === "string" ? metadata.category : "General";
      const rawTier = metadata.tier;
      const tier: TierName = isTierName(rawTier) ? rawTier : "Basic";
      const track = typeof metadata.track === "string" ? metadata.track : undefined;

      return {
        slug,
        name,
        icon: Icon,
        duration,
        xpGain,
        description,
        category,
        tier,
        track,
        definition
      } satisfies TrainingSessionConfig;
    });
  }, [availableDefinitions]);

  const relationshipsBySkill = useMemo(() => {
    return relationships.reduce<Record<string, SkillRelationshipRecord[]>>((acc, relationship) => {
      if (!relationship.skill_slug) return acc;
      if (!acc[relationship.skill_slug]) {
        acc[relationship.skill_slug] = [];
      }
      acc[relationship.skill_slug].push(relationship);
      return acc;
    }, {});
  }, [relationships]);

  const progressMap = useMemo(() => {
    return progress.reduce<Record<string, SkillProgressRecord>>((acc, entry) => {
      if (entry.skill_slug) {
        acc[entry.skill_slug] = entry;
      }
      return acc;
    }, {});
  }, [progress]);

  const currentSkillEntries = useMemo<CurrentSkillEntry[]>(() => {
    const entries: CurrentSkillEntry[] = [];
    const processedSlugs = new Set<string>();

    if (skills) {
      Object.entries(skills)
        .filter(([key]) => !["id", "user_id", "profile_id", "created_at", "updated_at"].includes(key))
        .forEach(([key, value], index) => {
          const numericValue = typeof value === "number" ? value : Number(value ?? 0);
          const sanitizedValue = Number.isFinite(numericValue) ? Math.max(0, numericValue) : 0;

          entries.push({
            slug: key,
            name: formatSkillName(key),
            currentValue: sanitizedValue,
            order: index
          });

          processedSlugs.add(key);
        });
    }

    const baseCount = entries.length;

    availableDefinitions.forEach((definition, definitionIndex) => {
      const slug = definition.slug;
      if (!slug || processedSlugs.has(slug)) {
        return;
      }

      const displayName = definition.display_name ?? formatSkillName(slug);
      const description = definition.description ?? undefined;

      entries.push({
        slug,
        name: displayName,
        description,
        currentValue: 0,
        order: baseCount + definitionIndex
      });

      processedSlugs.add(slug);
    });

    return entries.sort((a, b) => a.order - b.order);
  }, [availableDefinitions, skills]);

  const getSkillValue = useCallback(
    (slug: string) => {
      if (!skills) return 0;
      const record = skills as unknown as Record<string, unknown>;
      const value = record[slug];
      if (typeof value === "number") return value;
      if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
      }
      return 0;
    },
    [skills]
  );

  const derivedSessions = useMemo<DerivedSession[]>(() => {
    return trainingSessions.map(session => {
      const requirements = relationshipsBySkill[session.slug] ?? [];
      const missingRequirement = requirements
        .map(relationship => {
          const currentValue = getSkillValue(relationship.required_skill_slug);
          const requiredDefinition = definitionBySlug[relationship.required_skill_slug];
          return {
            relationship,
            currentValue,
            requiredName: requiredDefinition?.display_name ?? formatSkillName(relationship.required_skill_slug)
          } satisfies SessionRequirement;
        })
        .find(requirement => requirement.currentValue < requirement.relationship.required_value);

      const progressEntry = progressMap[session.slug];
      const lastTraining = progressEntry?.last_trained_at ?? progressEntry?.updated_at ?? null;
      const cooldownActive = lastTraining ? isOnCooldown(lastTraining, trainingCooldown) : false;
      const remainingCooldown = cooldownActive && lastTraining
        ? getRemainingCooldown(lastTraining, trainingCooldown)
        : 0;

      const isUnlocked = Boolean(progressEntry?.unlocked_at) || !missingRequirement;

      return {
        ...session,
        progressEntry,
        isUnlocked,
        missingRequirement,
        cooldownActive,
        remainingCooldown
      } satisfies DerivedSession;
    });
  }, [
    trainingSessions,
    relationshipsBySkill,
    getSkillValue,
    definitionBySlug,
    progressMap,
    trainingCooldown
  ]);

  const sessionBySlug = useMemo(() => {
    return derivedSessions.reduce<Map<string, DerivedSession>>((acc, session) => {
      acc.set(session.slug, session);
      return acc;
    }, new Map<string, DerivedSession>());
  }, [derivedSessions]);

  const categoryGroups = useMemo(() => {
    const categoryMap = new Map<string, Map<TierName, DerivedSession[]>>();

    derivedSessions.forEach(session => {
      const { category, tier } = session;
      if (!categoryMap.has(category)) {
        categoryMap.set(category, new Map());
      }

      const tierMap = categoryMap.get(category)!;
      const existing = tierMap.get(tier) ?? [];
      tierMap.set(tier, [...existing, session]);
    });

    return Array.from(categoryMap.entries())
      .map(([category, tierMap]) => {
        const tiers = (SKILL_TIER_ORDER as TierName[])
          .map(tier => {
            const sessions = tierMap.get(tier) ?? [];
            return {
              tier,
              sessions: [...sessions].sort((a, b) => a.name.localeCompare(b.name))
            };
          })
          .filter(group => group.sessions.length > 0);

        const total = tiers.reduce((sum, group) => sum + group.sessions.length, 0);

        return { category, tiers, total };
      })
      .sort((a, b) => {
        const priorityA = categoryPriority.get(a.category) ?? Number.MAX_SAFE_INTEGER;
        const priorityB = categoryPriority.get(b.category) ?? Number.MAX_SAFE_INTEGER;
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }
        return a.category.localeCompare(b.category);
      });
  }, [derivedSessions]);

  const isLoading = gameDataLoading || skillSystemLoading;

  const getSkillLevel = (value: number) => {
    if (value >= 900) return "Master";
    if (value >= 750) return "Expert";
    if (value >= 600) return "Advanced";
    if (value >= 400) return "Intermediate";
    if (value >= 200) return "Beginner";
    return "Novice";
  };

  const getSkillColor = (value: number) => {
    if (value >= 900) return "text-purple-400";
    if (value >= 750) return "text-blue-400";
    if (value >= 600) return "text-green-400";
    if (value >= 400) return "text-yellow-400";
    if (value >= 200) return "text-orange-400";
    return "text-red-400";
  };

  const handleTraining = async (session: DerivedSession) => {
    if (!skills || !profile) return;

    if (!session.isUnlocked) {
      const requirement = session.missingRequirement;
      toast({
        variant: "destructive",
        title: "Skill Locked",
        description: requirement
          ? `Reach ${requirement.requiredName} ${requirement.relationship.required_value} to unlock.`
          : "This training session is currently locked."
      });
      return;
    }

    const progressEntry = session.progressEntry;
    const lastTraining = progressEntry?.last_trained_at ?? progressEntry?.updated_at ?? null;
    const cooldownActive = lastTraining ? isOnCooldown(lastTraining, trainingCooldown) : false;

    if (cooldownActive) {
      const remainingMinutes = lastTraining
        ? getRemainingCooldown(lastTraining, trainingCooldown)
        : 0;
      toast({
        variant: "destructive",
        title: "Training Cooldown",
        description: `You can train again in ${remainingMinutes} minutes.`
      });
      return;
    }

    const currentSkill = getSkillValue(session.slug);
    const playerCash = Number(profile.cash ?? 0);
    const playerLevel = Number(profile.level ?? 1);
    const totalExperience = Number(profile.experience ?? 0);
    const skillCap = getSkillCap(playerLevel, totalExperience);
    const trainingCost = calculateTrainingCost(currentSkill);

    if (currentSkill >= skillCap) {
      toast({
        variant: "destructive",
        title: "Skill Cap Reached",
        description: `Level up to increase your ${session.slug} cap before training again.`
      });
      return;
    }

    if (playerCash < trainingCost) {
      toast({
        variant: "destructive",
        title: "Insufficient Funds",
        description: `You need $${trainingCost.toLocaleString()} to afford this training session.`
      });
      return;
    }

    const focusedXp = applyRewardBonus(session.xpGain, attributes?.mental_focus);
    const newSkillValue = Math.min(skillCap, currentSkill + focusedXp);
    const skillGain = newSkillValue - currentSkill;
    const sessionFocus = resolveSessionFocus(session);

    if (skillGain <= 0) {
      toast({
        variant: "destructive",
        title: "No Progress",
        description: "This session won't increase your skill right now. Try raising your cap first."
      });
      return;
    }

    const newCash = playerCash - trainingCost;
    const timestamp = new Date().toISOString();

    setTraining(true);
    try {
      await updateSkillProgress({
        skillSlug: session.slug,
        newSkillValue,
        xpGain: skillGain,
        timestamp
      });

      await updateProfile({
        cash: newCash,
        updated_at: timestamp
      });

      await awardActionXp({
        amount: focusedXp,
        category: "training",
        actionKey: "skill_training",
        sessionSlug: session.slug,
        focus: sessionFocus,
        durationMinutes: session.duration,
        collaborationCount: 0,
        quality: skillGain,
        metadata: {
          skill_gain: skillGain,
          skill_value_after: newSkillValue,
          training_cost: trainingCost,
          category: session.category,
          tier: session.tier,
          track: session.track
        }
      });

      await addActivity(
        "training",
        `Completed ${session.name} training session (+${focusedXp} XP)`,
        -trainingCost
      );

      toast({
        title: "Training Complete!",
        description: `Your ${session.slug} skill increased by ${skillGain} points!`
      });
    } catch (error) {
      console.error("Error during training:", error);
      toast({
        variant: "destructive",
        title: "Training Failed",
        description: "Something went wrong during your training session."
      });
    } finally {
      setTraining(false);
      setActiveTrainingKey(null);
    }
  };

  const handleAttributeTraining = async (attributeKey: AttributeKey) => {
    if (!profile || !attributes) {
      toast({
        variant: "destructive",
        title: "Attributes Unavailable",
        description: "We couldn't load your attribute data yet. Try again shortly."
      });
      return;
    }

    const currentValue = clampAttributeValue(Number(attributes[attributeKey] ?? 0));
    if (currentValue >= ATTRIBUTE_MAX_VALUE) {
      toast({
        variant: "destructive",
        title: "Attribute Maxed",
        description: `${ATTRIBUTE_METADATA[attributeKey].label} is already at its peak.`
      });
      return;
    }

    const availableXp = Math.max(0, Number(xpWallet?.xp_balance ?? 0));
    const trainingCost = getAttributeTrainingCost(currentValue);

    if (availableXp < trainingCost) {
      toast({
        variant: "destructive",
        title: "Not Enough XP",
        description: `You need ${trainingCost} XP to train ${ATTRIBUTE_METADATA[attributeKey].label}.`
      });
      return;
    }

    setTraining(true);
    setActiveTrainingKey(`attribute:${attributeKey}`);

    try {
      const timestamp = new Date().toISOString();
      const nextValue = clampAttributeValue(currentValue + ATTRIBUTE_TRAINING_INCREMENT);
      const actualGain = nextValue - currentValue;

      const attributeUpdates: Partial<PlayerAttributes> = {
        [attributeKey]: nextValue,
        updated_at: timestamp
      } as Partial<PlayerAttributes>;

      const starsPurchased = Math.max(1, Math.round(actualGain / ATTRIBUTE_TRAINING_INCREMENT));

      await buyAttributeStar({
        attributeKey,
        stars: starsPurchased,
        metadata: {
          xp_cost: trainingCost,
          attribute_gain: actualGain
        }
      });

      await updateAttributes(attributeUpdates);

      await addActivity(
        "attribute_training",
        `Invested ${trainingCost} XP to improve ${ATTRIBUTE_METADATA[attributeKey].label} (+${actualGain}).`,
        0,
        {
          attribute: attributeKey,
          gain: actualGain,
          cost: trainingCost
        }
      );

      toast({
        title: "Attribute Improved!",
        description: `${ATTRIBUTE_METADATA[attributeKey].label} increased by ${actualGain} (cost ${trainingCost} XP).`
      });
    } catch (error) {
      console.error("Error during attribute training:", error);
      toast({
        variant: "destructive",
        title: "Training Failed",
        description: "Something went wrong while training that attribute."
      });
    } finally {
      setTraining(false);
      setActiveTrainingKey(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-lg font-oswald">Loading training center...</p>
        </div>
      </div>
    );
  }

  if (!skills || !profile) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bebas tracking-wide">Character data unavailable</h2>
          <p className="text-muted-foreground">
            Select or create a character from your profile before starting a training session.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bebas tracking-wider">SKILL TRAINING CENTER</h1>
        <p className="text-lg text-muted-foreground font-oswald">
          Hone your craft and become a music legend
        </p>
        <div className="flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-yellow-400" />
            <span className="font-oswald">${profile.cash?.toLocaleString() || 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-blue-400" />
            <span className="font-oswald">{walletBalance.toLocaleString()} XP available</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-400" />
            <span className="font-oswald">{lifetimeXp.toLocaleString()} lifetime XP</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-purple-400" />
            <span className="font-oswald">
              {cooldownActive ? `Cooldown: ${remainingCooldown}m` : "Ready to train"}
            </span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="skills" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="skills">Current Skills</TabsTrigger>
          <TabsTrigger value="training">Training Sessions</TabsTrigger>
          <TabsTrigger value="attributes">Attribute Development</TabsTrigger>
        </TabsList>

        <TabsContent value="skills" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentSkillEntries.map(entry => {
              const session = sessionBySlug.get(entry.slug);
              const Icon = session?.icon ?? Music;
              const numericValue = entry.currentValue;
              const progressValue = skillCap > 0 ? Math.min(100, (numericValue / skillCap) * 100) : 0;
              const displayName = session?.name ?? entry.name;

              return (
                <Card key={entry.slug} className="relative overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg font-oswald">{displayName}</CardTitle>
                      </div>
                      <Badge variant="outline" className={getSkillColor(numericValue)}>
                        {getSkillLevel(numericValue)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span className="font-mono">{numericValue}/{skillCap}</span>
                      </div>
                      <Progress value={progressValue} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="training" className="space-y-6">
          {categoryGroups.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              No training sessions available yet. Check back after creating new skills.
            </div>
          ) : (
            categoryGroups.map(group => (
              <section key={group.category} className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="space-y-1">
                    <h3 className="text-2xl font-oswald">{group.category}</h3>
                    <p className="text-sm text-muted-foreground">
                      Specialized development paths across {group.category}.
                    </p>
                  </div>
                  <Badge variant="secondary" className="h-fit">
                    {group.total} skill{group.total === 1 ? '' : 's'}
                  </Badge>
                </div>

                {group.tiers.map(({ tier, sessions }) => (
                  <div key={tier} className="space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="uppercase tracking-wide">
                          {tier}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{tierDescriptions[tier]}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {sessions.map(session => {
                        const currentSkill = getSkillValue(session.slug);
                        const trainingCost = calculateTrainingCost(currentSkill);
                        const canAfford = (profile.cash ?? 0) >= trainingCost;
                        const effectiveSkillCap = Math.max(skillCap, currentSkill);
                        const isAtCap = currentSkill >= skillCap;
                        const buttonDisabled =
                          training ||
                          !canAfford ||
                          isAtCap ||
                          session.cooldownActive ||
                          !session.isUnlocked;

                        const buttonLabel = training
                          ? "Training..."
                          : !session.isUnlocked
                            ? "Locked"
                            : isAtCap
                              ? "Skill Cap Reached"
                              : session.cooldownActive
                                ? `Cooldown (${session.remainingCooldown}m)`
                                : !canAfford
                                  ? "Can't Afford"
                                  : "Start Training";

                        return (
                          <Card key={session.slug} className="relative">
                            <CardHeader>
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3">
                                  <session.icon className="h-6 w-6 text-primary" />
                                  <div className="space-y-1">
                                    <CardTitle className="text-lg font-oswald">{session.name}</CardTitle>
                                    <CardDescription className="text-sm">
                                      {session.description}
                                    </CardDescription>
                                    <div className="flex flex-wrap gap-2 pt-1">
                                      <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                                        {session.track ?? session.category}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                                {!session.isUnlocked && (
                                  <Badge variant="secondary" className="flex items-center gap-1">
                                    <Lock className="h-3 w-3" />
                                    Locked
                                  </Badge>
                                )}
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="flex items-center gap-1">
                                  <Coins className="h-3 w-3 text-yellow-400" />
                                  <span>${trainingCost.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3 text-blue-400" />
                                  <span>{session.duration}m</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Star className="h-3 w-3 text-purple-400" />
                                  <span>
                                    +{applyRewardBonus(session.xpGain, attributes?.mental_focus)} XP
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <TrendingUp className="h-3 w-3 text-green-400" />
                                  <span>Skill: {currentSkill}/{effectiveSkillCap}</span>
                                </div>
                              </div>

                              {session.missingRequirement && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Lock className="h-3 w-3" />
                                  <span>
                                    Requires {session.missingRequirement.requiredName}{' '}
                                    {session.missingRequirement.relationship.required_value} (current{' '}
                                    {session.missingRequirement.currentValue})
                                  </span>
                                </div>
                              )}

                              {isAtCap && (
                                <div className="flex items-center gap-2 text-sm text-destructive">
                                  <TrendingUp className="h-3 w-3" />
                                  <span>Skill cap reached. Level up to continue training.</span>
                                </div>
                              )}

                              {session.cooldownActive && (
                                <div className="flex items-center gap-2 text-sm text-yellow-500">
                                  <Clock className="h-3 w-3" />
                                  <span>Training available in {session.remainingCooldown}m</span>
                                </div>
                              )}

                              <Button
                                onClick={() => handleTraining(session)}
                                disabled={buttonDisabled}
                                className="w-full"
                                variant={
                                  !session.isUnlocked || !canAfford || isAtCap || session.cooldownActive
                                    ? "outline"
                                    : "default"
                                }
                              >
                                {buttonLabel}
                              </Button>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </section>
            ))
          )}
        </TabsContent>

        <TabsContent value="attributes" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {attributeSummaries.map(({ key, value, metadata, icon: AttributeIcon, cost, percentage }) => {
              const availableExperience = Math.max(0, Number(xpWallet?.xp_balance ?? 0));
              const canAfford = availableExperience >= cost;
              const isMaxed = value >= ATTRIBUTE_MAX_VALUE;
              const isActive = activeTrainingKey === `attribute:${key}`;

              return (
                <Card key={key} className="relative">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <AttributeIcon className="h-5 w-5 text-primary" />
                      <div>
                        <CardTitle className="text-lg font-oswald">{metadata.label}</CardTitle>
                        <CardDescription className="text-sm">{metadata.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span className="font-mono">{value}/{ATTRIBUTE_MAX_VALUE}</span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                      {metadata.relatedSkills.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Boosts: {metadata.relatedSkills.join(", ")}
                        </p>
                      )}
                    </div>

                    <div className="flex justify-between text-sm">
                      <span>Training Cost</span>
                      <span>{cost} XP</span>
                    </div>

                    {isMaxed && (
                      <div className="text-sm text-green-500">
                        Attribute mastered!
                      </div>
                    )}

                    {!isMaxed && !canAfford && (
                      <div className="text-sm text-destructive">
                        Need {Math.max(0, cost - Math.floor(availableExperience))} more XP
                      </div>
                    )}

                    <Button
                      onClick={() => handleAttributeTraining(key)}
                      disabled={training || isMaxed || !canAfford}
                      className="w-full"
                      variant={canAfford && !isMaxed ? "default" : "outline"}
                    >
                      {isMaxed
                        ? "Maxed Out"
                        : training && isActive
                          ? "Training..."
                          : canAfford
                            ? `Train (+${ATTRIBUTE_TRAINING_INCREMENT})`
                            : "Need XP"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const SkillTraining = () => (
  <SkillSystemProvider>
    <SkillTrainingContent />
  </SkillSystemProvider>
);

export default SkillTraining;
