// @ts-nocheck
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Award, Crown, Flame, History, RefreshCw, Sparkles } from "lucide-react";

import { useOptionalGameData } from "@/hooks/useGameData";
import { MilestoneTimeline } from "@/components/legacy/MilestoneTimeline";
import { fetchLegacyMilestones } from "@/lib/api/legacy";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

const LegacyLoadingState = () => (
  <div className="space-y-6">
    <Skeleton className="h-36 w-full" />
    <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
      <Skeleton className="h-96 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  </div>
);

const LegacyPage = () => {
  const gameData = useOptionalGameData();
  const profile = gameData?.profile ?? null;
  const profileId = profile?.id ?? null;
  const profileName = profile?.stage_name || profile?.name || "Your band";

  const {
    data: milestones = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["legacy-milestones", profileId ?? "public"],
    queryFn: () => fetchLegacyMilestones(profileId),
    enabled: gameData !== undefined,
    staleTime: 1000 * 60 * 10,
  });

  const achievedCount = useMemo(
    () => milestones.filter((milestone) => milestone.isAchieved).length,
    [milestones]
  );
  const upcomingCount = useMemo(
    () => milestones.filter((milestone) => !milestone.isAchieved).length,
    [milestones]
  );
  const nextMilestone = useMemo(
    () => milestones.find((milestone) => !milestone.isAchieved) ?? null,
    [milestones]
  );
  const latestMilestone = useMemo(() => {
    const completed = milestones.filter((milestone) => milestone.isAchieved);
    return completed.length ? completed[completed.length - 1] : null;
  }, [milestones]);

  if (gameData === undefined || isLoading) {
    return <LegacyLoadingState />;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Card className="bg-gradient-to-r from-primary/15 via-primary/10 to-primary/5">
          <CardHeader className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Crown className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-2xl">{profileName}&apos;s Legacy</CardTitle>
                <CardDescription>
                  Track defining milestones, celebrate achievements, and spotlight what&apos;s next in your story.
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="h-3.5 w-3.5" />
                {achievedCount} milestones unlocked
              </Badge>
              <Badge variant="outline" className="gap-1">
                <History className="h-3.5 w-3.5" />
                {milestones.length} total milestones tracked
              </Badge>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-lg">
              Momentum Overview
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                className="gap-2"
              >
                <RefreshCw className={isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                Refresh
              </Button>
            </CardTitle>
            <CardDescription>
              Snapshot of progress across your legacy goals.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-semibold">{achievedCount}</p>
            </div>
            <div className="rounded-lg border bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground">In progress</p>
              <p className="text-2xl font-semibold">{upcomingCount}</p>
            </div>
            <div className="rounded-lg border bg-muted/40 p-4 sm:col-span-2">
              <p className="text-sm text-muted-foreground">Highlights</p>
              <p className="text-sm">
                {nextMilestone
                  ? `Next milestone: ${nextMilestone.title}`
                  : "All milestones completed—time to plan the next era."}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {isError ? (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Flame className="h-5 w-5" />
              We couldn&apos;t load your milestones
            </CardTitle>
            <CardDescription className="text-destructive">
              {(error as Error)?.message ?? "Try refreshing to attempt again."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => refetch()} variant="destructive" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <History className="h-5 w-5" />
                Milestone Timeline
              </CardTitle>
              <CardDescription>
                A chronological view of the achievements that define your trajectory.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <MilestoneTimeline milestones={milestones} />
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-5 w-5" />
                  Spotlight Moments
                </CardTitle>
                <CardDescription>Quick highlights from your biggest wins.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {latestMilestone ? (
                  <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Award className="h-4 w-4" />
                      {latestMilestone.title}
                    </div>
                    <Separator />
                    <p className="text-sm text-muted-foreground">
                      {latestMilestone.highlight ?? latestMilestone.description}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Complete milestones to unlock spotlight stories.
                  </p>
                )}

                {nextMilestone && (
                  <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 text-sm">
                    <p className="font-semibold text-primary">Up next: {nextMilestone.title}</p>
                    <p className="text-muted-foreground">
                      {nextMilestone.description}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Crown className="h-5 w-5" />
                  Legacy Tips
                </CardTitle>
                <CardDescription>
                  Keep momentum with consistent storytelling and fan engagement.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>• Capture behind-the-scenes moments after each milestone to deepen fan connection.</p>
                <p>• Align upcoming releases with milestone celebrations for maximum impact.</p>
                <p>• Celebrate community initiatives to showcase your broader influence.</p>
              </CardContent>
            </Card>
          </div>
        </section>
      )}
    </div>
  );
};

export default LegacyPage;
