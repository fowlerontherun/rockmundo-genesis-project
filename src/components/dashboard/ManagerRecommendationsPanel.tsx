import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, ClipboardList, Lightbulb } from "lucide-react";
import { addDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageEmptyState, PageErrorState, PageLoadingState } from "@/components/ui/page-state";
import { supabase } from "@/integrations/supabase/client";
import { buildManagerRecommendations, type ManagerRecommendationPriority } from "@/lib/managerRecommendations";
import { cn } from "@/lib/utils";

interface ManagerRecommendationsPanelProps {
  profile: any;
  userId?: string;
}

const priorityLabels: Record<ManagerRecommendationPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const priorityStyles: Record<ManagerRecommendationPriority, string> = {
  high: "border-destructive/30 bg-destructive/10 text-destructive",
  medium: "border-warning/30 bg-warning/10 text-warning",
  low: "border-primary/30 bg-primary/10 text-primary",
};

const todayIso = () => new Date().toISOString();
export function ManagerRecommendationsPanel({ profile, userId }: ManagerRecommendationsPanelProps) {
  const profileId = profile?.id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["manager-recommendations", userId, profileId],
    enabled: !!userId && !!profileId,
    staleTime: 60_000,
    queryFn: async () => {
      const now = new Date();
      const inSevenDays = addDays(now, 7);

      const bandIdsResult = await supabase
        .from("band_members")
        .select("band_id")
        .eq("profile_id", profileId)
        .eq("member_status", "active");
      if (bandIdsResult.error) throw bandIdsResult.error;
      const bandIds = (bandIdsResult.data ?? []).map((row: any) => row.band_id).filter(Boolean);

      const [completedSongsResult, recordingsResult, messagesResult, activitiesResult, rehearsalsResult, totalSongsResult] = await Promise.all([
        supabase
          .from("songs")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "completed")
          .or("archived.is.null,archived.eq.false"),
        supabase
          .from("songs")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "recorded")
          .or("archived.is.null,archived.eq.false"),
        supabase
          .from("player_inbox")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("is_read", false)
          .eq("is_archived", false)
          .in("priority", ["high", "urgent"]),
        supabase
          .from("player_scheduled_activities")
          .select("id, title, activity_type, scheduled_start")
          .eq("profile_id", profileId)
          .gte("scheduled_start", todayIso())
          .lte("scheduled_start", inSevenDays.toISOString())
          .order("scheduled_start", { ascending: true })
          .limit(3),
        bandIds.length > 0
          ? supabase
              .from("band_rehearsals")
              .select("id", { count: "exact", head: true })
              .in("band_id", bandIds)
              .eq("status", "scheduled")
              .gte("scheduled_start", todayIso())
              .lte("scheduled_start", addDays(now, 14).toISOString())
          : Promise.resolve({ data: [], count: 0, error: null }),
        supabase
          .from("songs")
          .select("id", { count: "exact", head: true })
          .eq("profile_id", profileId)
          .or("archived.is.null,archived.eq.false"),
      ]);

      const failed = [completedSongsResult, recordingsResult, messagesResult, activitiesResult, rehearsalsResult, totalSongsResult].find((result: any) => result.error);
      if (failed?.error) throw failed.error;

      return {
        songsReadyToRecord: completedSongsResult.count ?? 0,
        recordingsReadyToRelease: recordingsResult.count ?? 0,
        unreadImportantMessages: messagesResult.count ?? 0,
        upcomingActivities: activitiesResult.data ?? [],
        upcomingActivitiesCount: activitiesResult.count ?? activitiesResult.data?.length ?? 0,
        totalSongs: totalSongsResult.count ?? 0,
        needsBandRehearsal: bandIds.length > 0 && (rehearsalsResult.count ?? 0) === 0,
      };
    },
  });

  const recommendations = useMemo(() => buildManagerRecommendations({ profile, ...data }), [data, profile]);

  if (isLoading) {
    return <PageLoadingState title="Loading manager recommendations" description="Reviewing your vitals, songs, recordings, inbox, rehearsals, and schedule..." />;
  }

  if (error) {
    return <PageErrorState title="Manager recommendations could not be loaded" description="Your dashboard is still available, but recommendations could not be refreshed." onRetry={() => void refetch()} />;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-4 w-4 text-primary" />
              Manager Recommendations
            </CardTitle>
            <CardDescription>Rules-based next actions from your current career data.</CardDescription>
          </div>
          {recommendations.length > 0 ? <Badge variant="secondary">{recommendations.length}</Badge> : null}
        </div>
      </CardHeader>
      <CardContent>
        {recommendations.length === 0 ? (
          <PageEmptyState title="No recommendations right now" description="Your manager has no urgent next actions. Keep writing, recording, rehearsing, and booking activities." />
        ) : (
          <div className="space-y-3">
            {recommendations.map((recommendation) => {
              const content = (
                <div className="flex h-full items-start gap-3 rounded-lg border bg-card/50 p-3 transition-colors hover:bg-accent/40">
                  <ClipboardList className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold leading-tight">{recommendation.title}</p>
                      <Badge variant="outline" className={cn("text-[10px]", priorityStyles[recommendation.priority])}>
                        {priorityLabels[recommendation.priority]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{recommendation.reason}</p>
                    <p className="text-xs font-medium">{recommendation.suggestedAction}</p>
                  </div>
                  {recommendation.priority === "high" ? <AlertTriangle className="h-4 w-4 text-destructive" /> : null}
                  {recommendation.href ? <ArrowRight className="h-4 w-4 text-muted-foreground" /> : null}
                </div>
              );

              return recommendation.href ? <Link key={recommendation.id} to={recommendation.href}>{content}</Link> : <div key={recommendation.id}>{content}</div>;
            })}
          </div>
        )}
        {recommendations.length > 0 ? (
          <div className="mt-3 flex justify-end">
            <Button asChild size="sm" variant="outline"><Link to="/schedule">Review schedule</Link></Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
