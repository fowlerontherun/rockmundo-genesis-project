import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MusicVideoConfigurator, MusicVideoConfiguratorResult } from "./MusicVideoConfigurator";
import { MusicVideoSummaryCard, type MusicVideoConfigWithRelations } from "./MusicVideoSummaryCard";
import { buildPlanFromRow, derivePlanMetadata } from "@/lib/musicVideoMetrics";
import { Lightbulb, Video, Youtube, Tv } from "lucide-react";

interface MusicVideoReleaseTabProps {
  userId: string;
}

export function MusicVideoReleaseTab({ userId }: MusicVideoReleaseTabProps) {
  const queryClient = useQueryClient();

  const { data: bandMemberships, isLoading: bandLoading } = useQuery({
    queryKey: ["music-video-band-memberships", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("user_id", userId);

      if (error) throw error;
      return data?.map((record) => record.band_id) ?? [];
    },
  });

  const bandIds = bandMemberships ?? [];
  const bandFilterReady = bandMemberships !== undefined;

  const { data: releases = [], isLoading: releasesLoading } = useQuery({
    queryKey: ["music-video-release-options", userId, bandIds.join(",")],
    enabled: !!userId && bandFilterReady,
    queryFn: async () => {
      let query = supabase
        .from("releases")
        .select("id, title, artist_name, release_type, release_status, band_id")
        .order("created_at", { ascending: false });

      if (bandIds.length > 0) {
        query = query.or(`user_id.eq.${userId},band_id.in.(${bandIds.join(",")})`);
      } else {
        query = query.eq("user_id", userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: configs = [], isLoading: configsLoading } = useQuery({
    queryKey: ["music-video-configs", userId, bandIds.join(",")],
    enabled: !!userId && bandFilterReady,
    queryFn: async () => {
      let query = supabase
        .from("music_video_configs")
        .select(`
          *,
          releases:releases(id, title, release_type, artist_name),
          music_video_metrics(*)
        `)
        .order("created_at", { ascending: false });

      if (bandIds.length > 0) {
        query = query.or(`user_id.eq.${userId},band_id.in.(${bandIds.join(",")})`);
      } else {
        query = query.eq("user_id", userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as MusicVideoConfigWithRelations[]) ?? [];
    },
  });

  const createMusicVideo = useMutation({
    mutationFn: async (payload: MusicVideoConfiguratorResult) => {
      const linkedRelease = payload.releaseId
        ? releases.find((release) => release.id === payload.releaseId)
        : null;

      const insertPayload = {
        release_id: payload.releaseId,
        user_id: userId,
        band_id: linkedRelease?.band_id ?? bandIds[0] ?? null,
        theme: payload.theme,
        art_style: payload.artStyle,
        budget_tier: payload.budgetTier,
        budget_amount: payload.budgetAmount,
        image_quality: payload.imageQuality,
        cast_option: payload.castOption,
        cast_quality: payload.castQuality ?? null,
        location_style: payload.locationStyle ?? null,
        production_notes: payload.productionNotes ?? null,
        youtube_video_url: payload.youtubeUrl ?? null,
      };

      const { data, error } = await supabase
        .from("music_video_configs")
        .insert(insertPayload)
        .select(`
          *,
          releases:releases(id, title, release_type, artist_name),
          music_video_metrics(*)
        `)
        .single();

      if (error) throw error;
      return data as MusicVideoConfigWithRelations;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["music-video-configs", userId] });
      toast({
        title: "Music video plan created",
        description: "Your visual release has been added to the campaign tracker.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Unable to create plan",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const syncMetrics = useMutation({
    mutationFn: async (config: MusicVideoConfigWithRelations) => {
      const { plan, chartName, mtvProgram, youtubeVideoId } = derivePlanMetadata(config);
      const { data, error } = await supabase
        .from("music_video_metrics")
        .upsert(
          {
            music_video_id: config.id,
            youtube_video_id: youtubeVideoId,
            youtube_views: plan.youtubeViews,
            chart_name: chartName,
            chart_position: plan.chartPosition,
            chart_velocity: plan.chartVelocity,
            mtv_program: mtvProgram,
            mtv_spins: plan.mtvSpins,
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: "music_video_id" }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["music-video-configs", userId] });
      toast({
        title: "Metrics synced",
        description: "YouTube, chart, and MTV projections have been refreshed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const summary = useMemo(() => {
    if (!configs || configs.length === 0) return null;

    return configs.reduce(
      (acc, config) => {
        const plan = buildPlanFromRow(config);
        const views = config.music_video_metrics?.youtube_views ?? plan.youtubeViews;
        const chartPosition = config.music_video_metrics?.chart_position ?? plan.chartPosition;
        const mtvSpins = config.music_video_metrics?.mtv_spins ?? plan.mtvSpins;

        acc.totalViews += views;
        acc.totalBudget += config.budget_amount;
        acc.totalMtvSpins += mtvSpins;
        acc.chartPositions.push(chartPosition);
        return acc;
      },
      {
        totalViews: 0,
        totalBudget: 0,
        totalMtvSpins: 0,
        chartPositions: [] as number[],
      }
    );
  }, [configs]);

  const averageChart =
    summary && summary.chartPositions.length > 0
      ? Math.round(
          summary.chartPositions.reduce((sum, position) => sum + position, 0) /
            summary.chartPositions.length
        )
      : null;

  const isLoading = bandLoading || releasesLoading || configsLoading;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">Music Video Campaigns</h2>
        <p className="text-muted-foreground">
          Design music video releases, align them with upcoming drops, and monitor their performance across
          YouTube, charts, and MTV rotations.
        </p>
      </div>

      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Video className="h-4 w-4" />
                Active Visuals
              </div>
              <div className="text-2xl font-semibold">{configs.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lightbulb className="h-4 w-4" />
                Combined Budget
              </div>
              <div className="text-2xl font-semibold">${summary.totalBudget.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Youtube className="h-4 w-4" />
                Projected Views
              </div>
              <div className="text-2xl font-semibold">{summary.totalViews.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Across all planned video drops</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Tv className="h-4 w-4" />
                Broadcast & Charts
              </div>
              <div className="text-2xl font-semibold">{summary.totalMtvSpins.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Estimated MTV spins • Avg chart #{averageChart ?? "--"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <MusicVideoConfigurator
        releases={releases}
        onCreate={(result) => createMusicVideo.mutate(result)}
        isSaving={createMusicVideo.isPending}
      />

      <Separator />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">Video Rollout Tracker</h3>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{configs.length} planned</Badge>
            {averageChart && <Badge variant="outline">Avg chart #{averageChart}</Badge>}
          </div>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Loading music video campaigns...
            </CardContent>
          </Card>
        ) : configs.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center space-y-2">
              <Video className="h-10 w-10 mx-auto text-muted-foreground" />
              <div className="text-lg font-semibold">No music video plans yet</div>
              <p className="text-sm text-muted-foreground">
                Craft your first visual release to unlock projections and performance tracking.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {configs.map((config) => (
              <MusicVideoSummaryCard
                key={config.id}
                config={config}
                syncing={syncMetrics.isPending && syncMetrics.variables?.id === config.id}
                onSyncMetrics={() => syncMetrics.mutate(config)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
