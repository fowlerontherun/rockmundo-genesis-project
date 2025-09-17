import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trophy,
  Star,
  Crown,
  Target,
  Clock,
  CheckCircle,
  Lock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";

type AchievementValue = number | string;

type AchievementRequirements = Record<string, AchievementValue>;
type AchievementRewards = Record<string, AchievementValue>;
type AchievementProgress = Record<string, AchievementValue>;

interface Achievement {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  rarity: string;
  requirements: AchievementRequirements;
  rewards: AchievementRewards;
}

interface PlayerAchievement {
  id: string;
  achievement_id: string;
  unlocked_at: string;
  progress: AchievementProgress;
  achievement: Achievement;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const isAchievementValue = (value: unknown): value is AchievementValue => {
  return typeof value === "number" || typeof value === "string";
};

const toStringOrEmpty = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
};

const formatCurrencyValue = (value: AchievementValue): string => {
  return typeof value === "number" ? value.toLocaleString() : value;
};

const formatBasicValue = (value: AchievementValue): string => {
  return typeof value === "string" ? value : value.toString();
};

const parseRequirements = (value: unknown): AchievementRequirements => {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<AchievementRequirements>((acc, [key, entryValue]) => {
    if (isAchievementValue(entryValue)) {
      acc[key] = entryValue;
    }
    return acc;
  }, {});
};

const parseRewards = (value: unknown): AchievementRewards => {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<AchievementRewards>((acc, [key, entryValue]) => {
    if (isAchievementValue(entryValue)) {
      acc[key] = entryValue;
    }
    return acc;
  }, {});
};

const parseProgress = (value: unknown): AchievementProgress => {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<AchievementProgress>((acc, [key, entryValue]) => {
    if (isAchievementValue(entryValue)) {
      acc[key] = entryValue;
    }
    return acc;
  }, {});
};

const parseAchievementRow = (value: unknown): Achievement | null => {
  if (!isRecord(value)) {
    return null;
  }

  const id = toStringOrEmpty(value.id);
  const name = toStringOrEmpty(value.name);
  const description = toStringOrEmpty(value.description);
  const category = toStringOrEmpty(value.category);
  const icon = toStringOrEmpty(value.icon);
  const rarity = toStringOrEmpty(value.rarity);

  if (!id || !name || !category || !rarity) {
    return null;
  }

  return {
    id,
    name,
    description,
    category,
    icon,
    rarity,
    requirements: parseRequirements(value.requirements),
    rewards: parseRewards(value.rewards)
  };
};

const Achievements = () => {
  const { user } = useAuth();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [playerAchievements, setPlayerAchievements] = useState<PlayerAchievement[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAchievements = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('achievements')
        .select('*')
        .order('category, rarity, name');

      if (error) throw error;
      const rows: unknown[] = Array.isArray(data) ? data : [];
      const parsedAchievements = rows.reduce<Achievement[]>((acc, item) => {
        const achievement = parseAchievementRow(item);
        if (achievement) {
          acc.push(achievement);
        }
        return acc;
      }, []);
      setAchievements(parsedAchievements);
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error loading achievements:', error);
      } else {
        console.error('Error loading achievements:', String(error));
      }
    }
  }, []);

  const loadPlayerAchievements = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('player_achievements')
        .select(`
          *,
          achievements!player_achievements_achievement_id_fkey(*)
        `)
        .eq('user_id', user.id);

      if (error) throw error;
      const rows: unknown[] = Array.isArray(data) ? data : [];
      const parsedPlayerAchievements = rows.reduce<PlayerAchievement[]>((acc, item) => {
        if (!isRecord(item)) {
          return acc;
        }

        const achievement = parseAchievementRow(item.achievements);
        const id = toStringOrEmpty(item.id);
        const achievementId = toStringOrEmpty(item.achievement_id);
        const unlockedAt = toStringOrEmpty(item.unlocked_at);

        if (!achievement || !id || !achievementId) {
          return acc;
        }

        acc.push({
          id,
          achievement_id: achievementId,
          unlocked_at: unlockedAt,
          progress: parseProgress(item.progress),
          achievement
        });
        return acc;
      }, []);
      setPlayerAchievements(parsedPlayerAchievements);
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error loading player achievements:', error);
      } else {
        console.error('Error loading player achievements:', String(error));
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadAchievements();
      loadPlayerAchievements();
    }
  }, [user, loadAchievements, loadPlayerAchievements]);

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "common": return "bg-secondary text-secondary-foreground";
      case "rare": return "bg-primary text-primary-foreground";
      case "epic": return "bg-accent text-accent-foreground";
      case "legendary": return "bg-gradient-primary text-white";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  const getAchievementIcon = (iconName: string) => {
    switch (iconName) {
      case "star": return <Star className="h-8 w-8" />;
      case "trophy": return <Trophy className="h-8 w-8" />;
      case "crown": return <Crown className="h-8 w-8" />;
      case "target": return <Target className="h-8 w-8" />;
      case "trending-up": return <Star className="h-8 w-8" />;
      case "guitar": return <Star className="h-8 w-8" />;
      case "mic": return <Star className="h-8 w-8" />;
      case "shopping-cart": return <Star className="h-8 w-8" />;
      case "dollar-sign": return <Star className="h-8 w-8" />;
      default: return <Trophy className="h-8 w-8" />;
    }
  };

  const isUnlocked = (achievementId: string) => {
    return playerAchievements.some(pa => pa.achievement_id === achievementId);
  };

  const getUnlockedDate = (achievementId: string) => {
    const pa = playerAchievements.find(pa => pa.achievement_id === achievementId);
    if (!pa) {
      return null;
    }

    const unlockedAtDate = new Date(pa.unlocked_at);
    return Number.isNaN(unlockedAtDate.getTime()) ? null : unlockedAtDate.toLocaleDateString();
  };

  const formatRequirements = (requirements: AchievementRequirements) => {
    return Object.entries(requirements).map(([key, value]) => {
      switch (key) {
        case "level":
          return `Reach level ${formatBasicValue(value)}`;
        case "guitar_skill":
          return `Reach ${formatBasicValue(value)} guitar skill`;
        case "vocals_skill":
          return `Reach ${formatBasicValue(value)} vocals skill`;
        case "total_spent":
          return `Spend $${formatCurrencyValue(value)}`;
        case "total_cash":
          return `Accumulate $${formatCurrencyValue(value)}`;
        case "chart_position":
          return `Reach #${formatBasicValue(value)} on charts`;
        case "join":
          return "Join RockMundo";
        default:
          return `${key}: ${formatBasicValue(value)}`;
      }
    }).join(", ");
  };

  const formatRewards = (rewards: AchievementRewards) => {
    return Object.entries(rewards).map(([key, value]) => {
      switch (key) {
        case "experience":
          return `+${formatBasicValue(value)} XP`;
        case "cash":
          return `+$${formatCurrencyValue(value)}`;
        case "fame":
          return `+${formatBasicValue(value)} Fame`;
        default:
          return `${key}: ${formatBasicValue(value)}`;
      }
    }).join(", ");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-stage flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-oswald">Loading achievements...</p>
        </div>
      </div>
    );
  }

  const categories = Array.from(new Set(achievements.map(a => a.category)));
  const unlockedCount = playerAchievements.length;
  const totalCount = achievements.length;
  const completionRate = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Achievements
            </h1>
            <p className="text-muted-foreground">Track your musical accomplishments</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">
              {unlockedCount}/{totalCount}
            </div>
            <div className="text-sm text-muted-foreground">
              {completionRate}% Complete
            </div>
          </div>
        </div>

        {/* Progress Overview */}
        <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Achievement Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {categories.map(category => {
                const categoryAchievements = achievements.filter(a => a.category === category);
                const categoryUnlocked = categoryAchievements.filter(a => isUnlocked(a.id)).length;
                return (
                  <div key={category} className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {categoryUnlocked}/{categoryAchievements.length}
                    </div>
                    <div className="text-sm text-muted-foreground capitalize">
                      {category}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="all" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unlocked">Unlocked</TabsTrigger>
            <TabsTrigger value="locked">Locked</TabsTrigger>
            <TabsTrigger value="rare">Rare+</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <div className="space-y-8">
              {categories.map(category => (
                <div key={category} className="space-y-4">
                  <h2 className="text-xl font-semibold capitalize text-foreground">
                    {category} Achievements
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {achievements
                      .filter(achievement => achievement.category === category)
                      .map((achievement) => {
                        const unlocked = isUnlocked(achievement.id);
                        const unlockedDate = getUnlockedDate(achievement.id);

                        return (
                          <Card 
                            key={achievement.id} 
                            className={`bg-card/80 backdrop-blur-sm border-primary/20 ${
                              unlocked ? '' : 'opacity-75'
                            }`}
                          >
                            <CardHeader>
                              <div className="flex items-start gap-4">
                                <div className={`p-3 rounded-full ${
                                  unlocked ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                                }`}>
                                  {unlocked ? (
                                    <CheckCircle className="h-8 w-8" />
                                  ) : (
                                    <Lock className="h-8 w-8" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <CardTitle className="text-lg">{achievement.name}</CardTitle>
                                    <Badge className={getRarityColor(achievement.rarity)} variant="outline">
                                      {achievement.rarity}
                                    </Badge>
                                  </div>
                                  <CardDescription>{achievement.description}</CardDescription>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div>
                                <div className="text-sm font-medium text-muted-foreground mb-1">
                                  Requirements:
                                </div>
                                <div className="text-sm">
                                  {formatRequirements(achievement.requirements)}
                                </div>
                              </div>
                              
                              <div>
                                <div className="text-sm font-medium text-muted-foreground mb-1">
                                  Rewards:
                                </div>
                                <div className="text-sm text-success">
                                  {formatRewards(achievement.rewards)}
                                </div>
                              </div>

                              {unlocked && unlockedDate && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t border-border/50">
                                  <Clock className="h-4 w-4" />
                                  Unlocked on {unlockedDate}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="unlocked">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {achievements
                .filter(achievement => isUnlocked(achievement.id))
                .map((achievement) => {
                  const unlockedDate = getUnlockedDate(achievement.id);

                  return (
                    <Card key={achievement.id} className="bg-card/80 backdrop-blur-sm border-primary/20">
                      <CardHeader>
                        <div className="flex items-start gap-4">
                          <div className="p-3 rounded-full bg-primary/20 text-primary">
                            <CheckCircle className="h-8 w-8" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <CardTitle className="text-lg">{achievement.name}</CardTitle>
                              <Badge className={getRarityColor(achievement.rarity)} variant="outline">
                                {achievement.rarity}
                              </Badge>
                            </div>
                            <CardDescription>{achievement.description}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <div className="text-sm font-medium text-muted-foreground mb-1">
                            Rewards:
                          </div>
                          <div className="text-sm text-success">
                            {formatRewards(achievement.rewards)}
                          </div>
                        </div>

                        {unlockedDate && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t border-border/50">
                            <Clock className="h-4 w-4" />
                            Unlocked on {unlockedDate}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </TabsContent>

          <TabsContent value="locked">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {achievements
                .filter(achievement => !isUnlocked(achievement.id))
                .map((achievement) => (
                  <Card key={achievement.id} className="bg-card/80 backdrop-blur-sm border-primary/20 opacity-75">
                    <CardHeader>
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-full bg-muted text-muted-foreground">
                          <Lock className="h-8 w-8" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <CardTitle className="text-lg">{achievement.name}</CardTitle>
                            <Badge className={getRarityColor(achievement.rarity)} variant="outline">
                              {achievement.rarity}
                            </Badge>
                          </div>
                          <CardDescription>{achievement.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <div className="text-sm font-medium text-muted-foreground mb-1">
                          Requirements:
                        </div>
                        <div className="text-sm">
                          {formatRequirements(achievement.requirements)}
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-sm font-medium text-muted-foreground mb-1">
                          Rewards:
                        </div>
                        <div className="text-sm text-success">
                          {formatRewards(achievement.rewards)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </TabsContent>

          <TabsContent value="rare">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {achievements
                .filter(achievement => ['rare', 'epic', 'legendary'].includes(achievement.rarity))
                .map((achievement) => {
                  const unlocked = isUnlocked(achievement.id);
                  const unlockedDate = getUnlockedDate(achievement.id);

                  return (
                    <Card 
                      key={achievement.id} 
                      className={`bg-card/80 backdrop-blur-sm border-primary/20 ${
                        unlocked ? '' : 'opacity-75'
                      }`}
                    >
                      <CardHeader>
                        <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-full ${
                            unlocked ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                          }`}>
                            {unlocked ? (
                              <CheckCircle className="h-8 w-8" />
                            ) : (
                              <Lock className="h-8 w-8" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <CardTitle className="text-lg">{achievement.name}</CardTitle>
                              <Badge className={getRarityColor(achievement.rarity)} variant="outline">
                                {achievement.rarity}
                              </Badge>
                            </div>
                            <CardDescription>{achievement.description}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <div className="text-sm font-medium text-muted-foreground mb-1">
                            Requirements:
                          </div>
                          <div className="text-sm">
                            {formatRequirements(achievement.requirements)}
                          </div>
                        </div>
                        
                        <div>
                          <div className="text-sm font-medium text-muted-foreground mb-1">
                            Rewards:
                          </div>
                          <div className="text-sm text-success">
                            {formatRewards(achievement.rewards)}
                          </div>
                        </div>

                        {unlocked && unlockedDate && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t border-border/50">
                            <Clock className="h-4 w-4" />
                            Unlocked on {unlockedDate}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Achievements;