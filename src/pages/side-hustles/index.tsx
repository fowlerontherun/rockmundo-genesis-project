import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Gamepad2,
  Loader2,
  Sparkles,
  Trophy,
  Wand2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useGameData } from "@/hooks/useGameData";
import {
  calculateProgressUpgrade,
  fetchSideHustleProgress,
  fetchSideHustleProgressByActivity,
  getDifficultyDescriptor,
  getNextLevelThreshold,
  recordMinigameAttempt,
  simulateMinigameAttempt,
  type MinigameAttemptResult,
  type MinigameType,
  upsertSideHustleProgress,
} from "@/lib/minigames";
import type { SideHustleProgressRow } from "@/lib/minigames/progress";

interface SideHustleActivity {
  id: string;
  name: string;
  description: string;
  minigameType: MinigameType;
  difficulty: number;
  focus: string;
  rewardPreview: string;
  tags: string[];
}

const SIDE_HUSTLE_ACTIVITIES: SideHustleActivity[] = [
  {
    id: "brand-promo-beats",
    name: "Brand Promo Beats",
    description:
      "Craft punchy loops and hooky riffs for agencies prepping social campaigns.",
    minigameType: "rhythm",
    difficulty: 4,
    focus: "Timing precision & creativity",
    rewardPreview: "Mixed cash tips and rhythm XP",
    tags: ["Studio", "Collaboration"],
  },
  {
    id: "late-night-lyric-lab",
    name: "Late-Night Lyric Lab",
    description:
      "Freelance lyric rewrites for vocalists chasing poetic midnight vibes.",
    minigameType: "lyric",
    difficulty: 5,
    focus: "Wordplay agility",
    rewardPreview: "Strong XP bursts and fan buzz",
    tags: ["Remote", "Solo"],
  },
  {
    id: "underground-mix-clinic",
    name: "Underground Mix Clinic",
    description:
      "Dial in soundchecks for indie acts sprinting between micro-venues downtown.",
    minigameType: "soundcheck",
    difficulty: 6,
    focus: "Critical listening",
    rewardPreview: "Reliable cash with skill growth",
    tags: ["Live", "Technical"],
  },
  {
    id: "street-cypher-coaching",
    name: "Street Cypher Coaching",
    description:
      "Coach park cyphers through hooks, harmonies, and hype-building chants.",
    minigameType: "rhythm",
    difficulty: 3,
    focus: "Crowd engagement",
    rewardPreview: "Energy boosts and tip jars",
    tags: ["Community", "Improvisation"],
  },
];

const buildProgressMap = (rows: SideHustleProgressRow[] | undefined) => {
  const map = new Map<string, SideHustleProgressRow>();
  rows?.forEach((row) => {
    map.set(row.activity_id, row);
  });
  return map;
};

const formatPercentage = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const getDefaultProgress = () => ({ level: 1, experience: 0 });

const SideHustlesPage = () => {
  const { profile, user } = useGameData();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [recentResults, setRecentResults] = useState<
    Record<string, MinigameAttemptResult | null>
  >({});

  const progressQuery = useQuery({
    queryKey: ["side-hustle-progress", profile?.id],
    queryFn: async () => {
      if (!profile?.id) {
        return [] as SideHustleProgressRow[];
      }

      return fetchSideHustleProgress(profile.id);
    },
    enabled: Boolean(profile?.id),
  });

  const progressMap = useMemo(
    () => buildProgressMap(progressQuery.data),
    [progressQuery.data],
  );

  const attemptMutation = useMutation({
    mutationFn: async (activity: SideHustleActivity) => {
      if (!profile?.id || !user?.id) {
        throw new Error("You need a profile to run side hustles.");
      }

      const cachedProgress = progressMap.get(activity.id);
      const latestProgress = await fetchSideHustleProgressByActivity(
        profile.id,
        activity.id,
      );
      const activityProgress = latestProgress ?? cachedProgress;
      const skillLevel = Math.min(
        12,
        Math.max(1, (profile.level ?? 1) + (activityProgress?.level ?? 0)),
      );
      const focusLevel = Math.min(
        12,
        Math.max(2, Math.round((profile.energy ?? 50) / 10)),
      );

      const result = simulateMinigameAttempt(activity.minigameType, {
        difficulty: activity.difficulty,
        skillLevel,
        focus: focusLevel,
      });

      const progression = calculateProgressUpgrade(
        activityProgress?.level ?? 1,
        activityProgress?.experience ?? 0,
        result.xpGained,
      );

      await recordMinigameAttempt({
        profile_id: profile.id,
        activity_id: activity.id,
        minigame_type: activity.minigameType,
        score: result.score,
        accuracy: result.accuracy,
        xp_earned: result.xpGained,
        cash_reward: result.cashReward,
        duration_seconds: result.durationSeconds,
        difficulty: activity.difficulty,
        success: result.success,
        metadata: result.details,
      });

      const updatedProgress = await upsertSideHustleProgress({
        profile_id: profile.id,
        activity_id: activity.id,
        minigame_type: activity.minigameType,
        level: progression.level,
        experience: progression.experience,
        best_score: Math.max(activityProgress?.best_score ?? 0, result.score),
        total_attempts: (activityProgress?.total_attempts ?? 0) + 1,
        last_result: result.success ? "success" : "retry",
        last_played_at: new Date().toISOString(),
      });

      return { result, updatedProgress };
    },
    onSuccess: ({ result }, activity) => {
      setRecentResults((previous) => ({
        ...previous,
        [activity.id]: result,
      }));

      void queryClient.invalidateQueries({
        queryKey: ["side-hustle-progress", profile?.id],
      });

      toast({
        title: result.success ? "Side hustle scored!" : "Keep the hustle going",
        description: result.success
          ? `You nailed ${activity.name} with a ${result.score} score.`
          : `Almost there! ${activity.name} needs another pass.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Unable to run mini-game",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const renderProgress = (activity: SideHustleActivity) => {
    const progress = progressMap.get(activity.id);
    const level = progress?.level ?? getDefaultProgress().level;
    const experience = progress?.experience ?? getDefaultProgress().experience;
    const threshold = getNextLevelThreshold(level);
    const percent =
      threshold === 0 ? 0 : formatPercentage((experience / threshold) * 100);

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-muted-foreground">Level {level}</span>
          <span className="text-muted-foreground">
            {experience} / {threshold} XP
          </span>
        </div>
        <Progress value={percent} aria-label={`${activity.name} progress`} />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          <span>{getDifficultyDescriptor(activity.difficulty)} difficulty</span>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Wand2 className="h-4 w-4" />
          <span>Side Hustles</span>
        </div>
        <h1 className="text-3xl font-bold">City-wide Gig Grind</h1>
        <p className="max-w-2xl text-muted-foreground">
          Pick up quick freelance runs, sharpen your craft with targeted mini-games,
          and stash extra cash while your main storyline cools down.
        </p>
      </header>

      {progressQuery.isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Syncing your hustle board…
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {SIDE_HUSTLE_ACTIVITIES.map((activity) => {
            const latestResult = recentResults[activity.id];
            const progress = progressMap.get(activity.id);
            return (
              <Card key={activity.id} className="flex h-full flex-col justify-between">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CardTitle>{activity.name}</CardTitle>
                    <Badge variant="secondary">{activity.focus}</Badge>
                  </div>
                  <CardDescription>{activity.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {activity.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="rounded-lg border bg-muted/40 p-4 text-sm">
                    <div className="flex items-center justify-between font-semibold">
                      <span>Expected rewards</span>
                      <Trophy className="h-4 w-4" />
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      {activity.rewardPreview}
                    </p>
                  </div>
                  {renderProgress(activity)}
                  {latestResult ? (
                    <div className="rounded-lg border bg-background p-4 text-sm shadow-sm">
                      <div className="flex items-center justify-between font-semibold">
                        <span>Last attempt</span>
                        <Gamepad2 className="h-4 w-4" />
                      </div>
                      <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <dt className="text-muted-foreground">Score</dt>
                          <dd className="font-medium">{latestResult.score}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Accuracy</dt>
                          <dd className="font-medium">{(latestResult.accuracy * 100).toFixed(0)}%</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Combo</dt>
                          <dd className="font-medium">{latestResult.combo}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">XP gained</dt>
                          <dd className="font-medium">{latestResult.xpGained}</dd>
                        </div>
                      </dl>
                    </div>
                  ) : progress ? (
                    <div className="rounded-lg border bg-background p-4 text-sm shadow-sm">
                      <div className="flex items-center justify-between font-semibold">
                        <span>Best score</span>
                        <Trophy className="h-4 w-4" />
                      </div>
                      <p className="mt-2 text-muted-foreground">
                        {progress.best_score
                          ? `Your record score is ${progress.best_score}.`
                          : "Play once to set your first record."}
                      </p>
                    </div>
                  ) : null}
                  <Button
                    className="w-full"
                    onClick={() => attemptMutation.mutate(activity)}
                    disabled={attemptMutation.isLoading || !profile?.id}
                  >
                    {attemptMutation.isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Running mini-game…
                      </>
                    ) : (
                      <>
                        <Gamepad2 className="mr-2 h-4 w-4" />
                        Launch mini-game
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SideHustlesPage;
