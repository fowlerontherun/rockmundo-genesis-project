import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
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
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useGameData, type PlayerAttributes, type PlayerSkills } from "@/hooks/useGameData";
import { supabase } from "@/integrations/supabase/client";

const genderLabels: Record<string, string> = {
  female: "Female",
  male: "Male",
  non_binary: "Non-binary",
  other: "Other",
  prefer_not_to_say: "Prefer not to say",
};

const Dashboard = () => {
  const navigate = useNavigate();
  const {
    profile,
    skills,
    attributes,
    activities,
    experienceLedger,
    loading,
    error,
    freshWeeklyBonusAvailable
  } = useGameData();
  const [birthCityLabel, setBirthCityLabel] = useState<string | null>(null);

  const instrumentSkillKeys: (keyof PlayerSkills)[] = [
    "vocals",
    "guitar",
    "bass",
    "drums",
    "songwriting",
    "performance",
    "composition"
  ];
  const attributeKeys: (keyof PlayerAttributes)[] = [
    "creativity",
    "business",
    "marketing",
    "technical"
  ];

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

  const formatLedgerReason = (reason: string) => {
    if (!reason) {
      return "XP adjustment";
    }

    if (reason === "weekly_bonus") {
      return "Weekly bonus";
    }

    return reason
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

    if (profile?.city_of_birth) {
      void loadCity(profile.city_of_birth);
    } else {
      setBirthCityLabel(null);
    }

    return () => {
      isMounted = false;
    };
  }, [profile?.city_of_birth]);

  const profileGenderLabel = useMemo(() => {
    if (!profile?.gender) return genderLabels.prefer_not_to_say;
    return genderLabels[profile.gender] ?? genderLabels.prefer_not_to_say;
  }, [profile?.gender]);


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

  if (!profile || !skills) {
    return null;
  }

  const parseDate = (value?: string | null) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const experienceProgress = profile.experience % 1000;
  const latestWeeklyBonus = experienceLedger.find(entry => entry.reason === "weekly_bonus");
  const latestWeeklyMetadata = (latestWeeklyBonus?.metadata as Record<string, unknown> | null) ?? null;
  const weeklyBonusAmount = latestWeeklyBonus
    ? toNumber(latestWeeklyMetadata?.bonus_awarded ?? latestWeeklyBonus.amount ?? 0, 0)
    : 0;
  const weeklyBonusSourceXp = latestWeeklyMetadata ? toNumber(latestWeeklyMetadata?.experience_gained, 0) : 0;
  const weeklyBonusStreak = latestWeeklyBonus ? Math.max(toNumber(latestWeeklyMetadata?.streak, 1), 1) : 0;
  const weeklyBonusRecorded = parseDate(latestWeeklyBonus?.recorded_at ?? null);
  const formattedWeeklyBonusRecorded = weeklyBonusRecorded
    ? new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).format(weeklyBonusRecorded)
    : null;
  const recentLedgerEntries = experienceLedger.slice(0, 5);

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
                Age {profile.age ?? 16}
              </Badge>
              <Badge variant="outline" className="border-border text-foreground/80">
                {profileGenderLabel}
              </Badge>
              <Badge variant="outline" className="border-border text-foreground/80">
                {profile.city_of_birth
                  ? birthCityLabel ?? "Loading birth city..."
                  : "Birth city not set"}
              </Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => navigate("/band")}
              className="bg-gradient-primary hover:shadow-electric"
            >
              <Users className="h-4 w-4 mr-2" />
              Band Manager
            </Button>
            <Button
              onClick={() => navigate("/gigs")}
              variant="outline"
              className="border-primary/20 hover:bg-primary/10"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Book Gigs
            </Button>
            <Button
              onClick={() => navigate("/busking")}
              variant="outline"
              className="border-primary/20 hover:bg-primary/10"
            >
              <Mic className="h-4 w-4 mr-2" />
              Street Busking
            </Button>
          </div>
        </div>

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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Skills */}
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Guitar className="h-5 w-5 text-primary" />
                Musical Skills
              </CardTitle>
              <CardDescription>Your musical abilities</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {instrumentSkillKeys.map(skillKey => {
                const value = Number(skills?.[skillKey] ?? 0);
                const percent = Math.min(100, (value / 1000) * 100);
                return (
                  <div key={skillKey} className="space-y-2">
                    <span className="capitalize font-medium text-sm">{skillKey}</span>
                    <Progress
                      value={percent}
                      className="h-2"
                      aria-label={`${skillKey} skill level ${value} out of 1000`}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Professional Attributes
              </CardTitle>
              <CardDescription>Business and creative prowess</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {attributeKeys.map(attributeKey => {
                const value = Number(attributes?.[attributeKey] ?? 0);
                const percent = Math.min(100, (value / 1000) * 100);
                return (
                  <div key={attributeKey} className="space-y-2">
                    <span className="capitalize font-medium text-sm">{attributeKey}</span>
                    <Progress
                      value={percent}
                      className="h-2"
                      aria-label={`${attributeKey} attribute score ${value} out of 1000`}
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
                  const recordedAt = parseDate(entry.recorded_at);
                  const recordedLabel = recordedAt
                    ? new Intl.DateTimeFormat(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      }).format(recordedAt)
                    : new Date(entry.recorded_at).toLocaleString();
                  const isGain = entry.amount >= 0;
                  const badgeVariant = isGain ? "secondary" : "outline";
                  const badgeClasses = isGain
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-destructive/30 text-destructive";

                  return (
                    <div key={entry.id} className="flex items-start justify-between gap-3 rounded-lg border border-primary/10 bg-secondary/20 p-3">
                      <div>
                        <p className="text-sm font-medium">{formatLedgerReason(entry.reason)}</p>
                        <p className="text-xs text-muted-foreground">{recordedLabel} UTC</p>
                        {entry.reason === "weekly_bonus" && sourceXp > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Based on {sourceXp} XP earned{streak > 1 ? ` • ${streak}-week streak` : ""}
                          </p>
                        )}
                      </div>
                      <Badge variant={badgeVariant} className={badgeClasses}>
                        {entry.amount >= 0 ? "+" : ""}{entry.amount} XP
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