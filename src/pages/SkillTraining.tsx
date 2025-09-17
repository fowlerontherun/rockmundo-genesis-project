import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { type PlayerAttributes, useGameData } from "@/hooks/useGameData";
import {
  calculateTrainingCost,
  getSkillCap,
  isOnCooldown,
  getRemainingCooldown,
  COOLDOWNS
} from "@/utils/gameBalance";
import { applyCooldownModifier, applyRewardBonus, resolveAttributeValue } from "@/utils/attributeModifiers";
import { type LucideIcon, Guitar, Mic, Music, Drum, Volume2, PenTool, Star, Coins, Clock, TrendingUp } from "lucide-react";

type SkillName = "guitar" | "vocals" | "drums" | "bass" | "performance" | "songwriting";

interface TrainingSession {
  skill: SkillName;
  name: string;
  icon: LucideIcon;
  duration: number;
  xpGain: number;
  description: string;
}

const ATTRIBUTE_ICONS: Record<AttributeKey, LucideIcon> = {
  musical_ability: Sparkles,
  vocal_talent: Mic2,
  rhythm_sense: Metronome,
  stage_presence: PersonStanding,
  creative_insight: Palette,
  technical_mastery: Cpu,
  business_acumen: Briefcase,
  marketing_savvy: Megaphone
};

const SkillTraining = () => {
  const { toast } = useToast();
  const { profile, skills, attributes, updateSkills, updateProfile, updateAttributes, addActivity, loading } = useGameData();
  const [training, setTraining] = useState(false);
  const [activeTrainingKey, setActiveTrainingKey] = useState<string | null>(null);
  const trainingCooldown = COOLDOWNS.skillTraining;

  const attributeSummaries = useMemo(() =>
    ATTRIBUTE_KEYS.map(key => {
      const value = clampAttributeValue(Number(attributes?.[key] ?? 0));
      return {
        key,
        value,
        metadata: ATTRIBUTE_METADATA[key],
        icon: ATTRIBUTE_ICONS[key],
        cost: getAttributeTrainingCost(value),
        percentage: ATTRIBUTE_MAX_VALUE > 0 ? (value / ATTRIBUTE_MAX_VALUE) * 100 : 0
      };
    }),
  [attributes]);

  const attributeSource = attributes as unknown as Record<string, unknown> | null;
  const physicalEndurance = resolveAttributeValue(attributeSource, "physical_endurance", 1);
  const mentalFocus = resolveAttributeValue(attributeSource, "mental_focus", 1);

  const trainingSessions: TrainingSession[] = [
    {
      skill: "guitar",
      name: "Guitar Practice",
      icon: Guitar,
      duration: 30,
      xpGain: 5,
      description: "Master guitar techniques and improve your playing skills"
    },
    {
      skill: "vocals",
      name: "Vocal Training",
      icon: Mic,
      duration: 45,
      xpGain: 6,
      description: "Develop your voice range, control, and stage presence"
    },
    {
      skill: "drums",
      name: "Drum Lessons",
      icon: Drum,
      duration: 40,
      xpGain: 5,
      description: "Learn rhythm patterns and improve your timing"
    },
    {
      skill: "bass",
      name: "Bass Workshop",
      icon: Volume2,
      duration: 35,
      xpGain: 5,
      description: "Strengthen your bass fundamentals and groove"
    },
    {
      skill: "performance",
      name: "Stage Performance",
      icon: Star,
      duration: 60,
      xpGain: 8,
      description: "Enhance your stage presence and crowd engagement"
    },
    {
      skill: "songwriting",
      name: "Songwriting Class",
      icon: PenTool,
      duration: 50,
      xpGain: 7,
      description: "Learn composition, lyrics, and musical arrangement"
    }
  ];

  const trainingCooldown = applyCooldownModifier(baseTrainingCooldown, physicalEndurance);

  const playerLevel = Number(profile?.level ?? 1);
  const totalExperience = Number(profile?.experience ?? 0);
  const skillCap = getSkillCap(playerLevel, totalExperience);
  const lastTrainingTime = skills?.updated_at ?? null;
  const cooldownActive = lastTrainingTime ? isOnCooldown(lastTrainingTime, trainingCooldown) : false;
  const remainingCooldown = cooldownActive && lastTrainingTime
    ? getRemainingCooldown(lastTrainingTime, trainingCooldown)
    : 0;

  const handleTraining = async (session: TrainingSession) => {
    if (!skills || !profile) return;

    const currentSkill = Number(skills[session.skill] ?? 0);
    const playerCash = Number(profile.cash ?? 0);
    const playerLevel = Number(profile.level ?? 1);
    const totalExperience = Number(profile.experience ?? 0);
    const skillCap = getSkillCap(playerLevel, totalExperience);
    const trainingCost = calculateTrainingCost(currentSkill);
    const lastTraining = skills.updated_at;
    const cooldownActive = lastTraining ? isOnCooldown(lastTraining, trainingCooldown) : false;
    const attributeKey = SKILL_ATTRIBUTE_MAP[session.skill] as AttributeKey | undefined;
    const attributeResult = applyAttributeToValue(session.xpGain, attributes, attributeKey);

    if (currentSkill >= skillCap) {
      toast({
        variant: "destructive",
        title: "Skill Cap Reached",
        description: `Level up to increase your ${session.skill} cap before training again.`
      });
      return;
    }

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

    if (playerCash < trainingCost) {
      toast({
        variant: "destructive",
        title: "Insufficient Funds",
        description: `You need $${trainingCost.toLocaleString()} to afford this training session.`
      });
      return;
    }

    setTraining(true);
    setActiveTrainingKey(session.skill);

    try {
      const focusedXp = applyRewardBonus(session.xpGain, mentalFocus);
      const newSkillValue = Math.min(skillCap, currentSkill + focusedXp);
      const skillGain = newSkillValue - currentSkill;
      const newCash = playerCash - trainingCost;
      const experienceGain = attributeResult.value;
      const newExperience = totalExperience + experienceGain;
      const timestamp = new Date().toISOString();

      await updateSkills({
        [session.skill]: newSkillValue,
        updated_at: timestamp
      });

      await updateProfile({
        cash: newCash,
        experience: newExperience,
        updated_at: timestamp
      });

      const attributeLabel = attributeKey ? ATTRIBUTE_METADATA[attributeKey].label : null;

      await addActivity(
        "training",
        attributeLabel
          ? `Completed ${session.name} (+${experienceGain} XP, ${attributeLabel} ×${attributeResult.multiplier.toFixed(2)})`
          : `Completed ${session.name} training session (+${experienceGain} XP)`,
        -trainingCost,
        attributeKey
          ? {
              attribute: attributeKey,
              multiplier: attributeResult.multiplier,
              experience: experienceGain
            }
          : undefined

      );

      toast({
        title: "Training Complete!",
        description: `Your ${session.skill} skill increased by ${skillGain} points (+${experienceGain} XP).`
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

    const availableExperience = Math.max(0, Number(profile.experience ?? 0));
    const trainingCost = getAttributeTrainingCost(currentValue);

    if (availableExperience < trainingCost) {
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
      const nextExperience = Math.max(0, availableExperience - trainingCost);

      const attributeUpdates: Partial<PlayerAttributes> = {
        [attributeKey]: nextValue,
        updated_at: timestamp
      } as Partial<PlayerAttributes>;

      await updateAttributes(attributeUpdates);

      await updateProfile({
        experience: nextExperience,
        updated_at: timestamp
      });

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

  const getSkillLevel = (skill: number): string => {
    if (skill >= 90) return "Master";
    if (skill >= 75) return "Expert";
    if (skill >= 60) return "Advanced";
    if (skill >= 40) return "Intermediate";
    if (skill >= 20) return "Beginner";
    return "Novice";
  };

  const getSkillColor = (skill: number): string => {
    if (skill >= 90) return "text-purple-400";
    if (skill >= 75) return "text-blue-400";
    if (skill >= 60) return "text-green-400";
    if (skill >= 40) return "text-yellow-400";
    if (skill >= 20) return "text-orange-400";
    return "text-red-400";
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
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
            <span className="font-oswald">${profile?.cash?.toLocaleString() || 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-400" />
            <span className="font-oswald">{profile?.experience || 0} XP</span>
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
            {trainingSessions.map(session => {
              const Icon = session.icon;
              const numericValue = Number(skills?.[session.skill] ?? 0);
              const progressValue = skillCap > 0 ? Math.min(100, (numericValue / skillCap) * 100) : 0;

              return (
                <Card key={session.skill} className="relative overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg font-oswald capitalize">{session.skill}</CardTitle>
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

        <TabsContent value="training" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trainingSessions.map((session) => {
            const Icon = session.icon;
            const currentSkill = Number(skills?.[session.skill] ?? 0);
            const trainingCost = calculateTrainingCost(currentSkill);
            const canAfford = (profile?.cash ?? 0) >= trainingCost;
            const isAtCap = currentSkill >= skillCap;
            const attributeKey = SKILL_ATTRIBUTE_MAP[session.skill] as AttributeKey | undefined;
            const attributePreview = applyAttributeToValue(session.xpGain, attributes, attributeKey);
            const expectedXpGain = attributePreview.value;
            const attributeLabel = attributeKey ? ATTRIBUTE_METADATA[attributeKey].label : null;
            const multiplierLabel = attributePreview.multiplier.toFixed(2);
            const buttonDisabled = training || !canAfford || isAtCap || cooldownActive;
            const isActive = activeTrainingKey === session.skill;
            return (
              <Card key={session.skill} className="relative">
                <CardHeader>
                  <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-primary" />
                      <div>
                        <CardTitle className="text-lg font-oswald">{session.name}</CardTitle>
                        <CardDescription className="text-sm">{session.description}</CardDescription>
                      </div>
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
                          +{expectedXpGain} XP
                          {attributeLabel ? ` • ${attributeLabel} ×${multiplierLabel}` : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-green-400" />
                        <span>Skill: {currentSkill}/{skillCap}</span>
                      </div>
                    </div>

                    {isAtCap && (
                      <div className="flex items-center gap-2 text-sm text-destructive">
                        <TrendingUp className="h-3 w-3" />
                        <span>Skill cap reached. Level up to continue training.</span>
                      </div>
                    )}

                    {cooldownActive && (
                      <div className="flex items-center gap-2 text-sm text-yellow-500">
                        <Clock className="h-3 w-3" />
                        <span>Training available in {remainingCooldown}m</span>
                      </div>
                    )}

                    <Button
                      onClick={() => handleTraining(session)}
                      disabled={buttonDisabled}
                      className="w-full"
                      variant={canAfford && !isAtCap && !cooldownActive ? "default" : "outline"}
                    >
                      {training && isActive
                        ? "Training..."
                        : isAtCap
                          ? "Skill Cap Reached"
                          : cooldownActive
                            ? `Cooldown (${remainingCooldown}m)`
                            : !canAfford
                              ? "Can't Afford"
                              : "Start Training"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="attributes" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {attributeSummaries.map(({ key, value, metadata, icon: AttributeIcon, cost, percentage }) => {
              const availableExperience = Math.max(0, Number(profile?.experience ?? 0));
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

export default SkillTraining;