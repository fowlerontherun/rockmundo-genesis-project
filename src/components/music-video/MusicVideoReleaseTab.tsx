import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MusicVideoConfigurator, MusicVideoConfiguratorResult } from "./MusicVideoConfigurator";
import { MusicVideoSummaryCard, type MusicVideoConfigWithRelations } from "./MusicVideoSummaryCard";
import type { Database } from "@/integrations/supabase/types";
import { buildPlanFromRow, derivePlanMetadata } from "@/lib/musicVideoMetrics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lightbulb, Video, Youtube, Tv, KanbanSquare, List } from "lucide-react";

interface MusicVideoReleaseTabProps {
  userId: string;
}

export function MusicVideoReleaseTab({ userId }: MusicVideoReleaseTabProps) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "board">("list");
  const [searchTerm, setSearchTerm] = useState("");

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
        status: payload.status,
        target_release_date: payload.targetReleaseDate ?? null,
        shoot_start_date: payload.shootStartDate ?? null,
        shoot_end_date: payload.shootEndDate ?? null,
        primary_platform: payload.primaryPlatform ?? null,
        sync_strategy: payload.syncStrategy,
        kpi_view_target: payload.kpiViewTarget ?? null,
        kpi_chart_target: payload.kpiChartTarget ?? null,
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

  const updateMusicVideo = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Database["public"]["Tables"]["music_video_configs"]["Update"];
    }) => {
      const { data, error } = await supabase
        .from("music_video_configs")
        .update(updates)
        .eq("id", id)
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
        title: "Music video updated",
        description: "Workflow settings have been saved.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
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
            platform: config.primary_platform ?? "youtube",
            views_target: config.kpi_view_target ?? null,
            chart_target: config.kpi_chart_target ?? null,
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

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      planned: 0,
      in_production: 0,
      post_production: 0,
      released: 0,
      draft: 0,
      archived: 0,
    };

    configs.forEach((config) => {
      counts[config.status] = (counts[config.status] ?? 0) + 1;
    });

    return counts;
  }, [configs]);

  const filteredConfigs = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return configs.filter((config) => {
      if (statusFilter !== "all" && config.status !== statusFilter) return false;

      if (!query) return true;

      const haystack = [
        config.theme,
        config.art_style,
        config.primary_platform,
        config.production_notes,
        config.releases?.title,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [configs, statusFilter, searchTerm]);

  const boardColumns = [
    { key: "draft", title: "Draft", description: "Early concept development" },
    { key: "planned", title: "Planned", description: "Awaiting production kickoff" },
    { key: "in_production", title: "In Production", description: "Filming underway" },
    { key: "post_production", title: "Post", description: "Editing & finishing" },
    { key: "released", title: "Released", description: "Live for fans" },
    { key: "archived", title: "Archived", description: "Stored for reference" },
  ];

  const handleStatusChange = (config: MusicVideoConfigWithRelations, status: string) => {
    if (config.status === status) return;
    updateMusicVideo.mutate({ id: config.id, updates: { status } });
  };

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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Planned</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{statusCounts.planned ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">In Production</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{statusCounts.in_production ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Post Production</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{statusCounts.post_production ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Released</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{statusCounts.released ?? 0}</CardContent>
        </Card>
      </div>

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
            <Badge variant="secondary">{filteredConfigs.length} visible</Badge>
            {averageChart && <Badge variant="outline">Avg chart #{averageChart}</Badge>}
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {["all", "draft", "planned", "in_production", "post_production", "released", "archived"].map((status) => (
              <Button
                key={status}
                size="sm"
                variant={statusFilter === status ? "default" : "outline"}
                onClick={() => setStatusFilter(status)}
              >
                {status === "all" ? "All" : status.replace(/_/g, " ")}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search campaigns"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full sm:w-60"
            />
            <div className="flex items-center gap-1">
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="gap-1"
              >
                <List className="h-4 w-4" />
                List
              </Button>
              <Button
                variant={viewMode === "board" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("board")}
                className="gap-1"
              >
                <KanbanSquare className="h-4 w-4" />
                Board
              </Button>
            </div>
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
        ) : viewMode === "board" ? (
          <div className="grid gap-4 xl:grid-cols-5 lg:grid-cols-3">
            {boardColumns.map((column) => {
              const columnConfigs = filteredConfigs.filter((config) => config.status === column.key);
              return (
                <Card key={column.key} className="border-dashed">
                  <CardHeader className="space-y-1">
                    <CardTitle className="text-sm font-semibold">{column.title}</CardTitle>
                    <p className="text-xs text-muted-foreground">{column.description}</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {columnConfigs.length === 0 ? (
                      <div className="text-xs text-muted-foreground text-center py-6">No campaigns</div>
                    ) : (
                      columnConfigs.map((config) => (
                        <MusicVideoSummaryCard
                          key={config.id}
                          config={config}
                          syncing={syncMetrics.isPending && syncMetrics.variables?.id === config.id}
                          onSyncMetrics={() => syncMetrics.mutate(config)}
                          onStatusChange={(status) => handleStatusChange(config, status)}
                          variant="compact"
                        />
                      ))
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredConfigs.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  No campaigns match your filters.
                </CardContent>
              </Card>
            ) : (
              filteredConfigs.map((config) => (
                <MusicVideoSummaryCard
                  key={config.id}
                  config={config}
                  syncing={syncMetrics.isPending && syncMetrics.variables?.id === config.id}
                  onSyncMetrics={() => syncMetrics.mutate(config)}
                  onStatusChange={(status) => handleStatusChange(config, status)}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
