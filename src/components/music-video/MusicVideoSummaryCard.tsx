import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildPlanFromRow,
  derivePlanMetadata,
} from "@/lib/musicVideoMetrics";
import {
  Camera,
  Clapperboard,
  Palette,
  DollarSign,
  Users,
  Youtube,
  BarChart3,
  Tv,
  Link,
  MapPin,
  Sparkles,
  CalendarClock,
  Workflow,
  Radio,
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

export type MusicVideoConfigWithRelations =
  Database["public"]["Tables"]["music_video_configs"]["Row"] & {
    releases?: {
      id: string;
      title: string;
      release_type: string;
      artist_name: string | null;
    } | null;
    music_video_metrics?: Database["public"]["Tables"]["music_video_metrics"]["Row"] | null;
  };

interface MusicVideoSummaryCardProps {
  config: MusicVideoConfigWithRelations;
  onSyncMetrics: () => void;
  syncing: boolean;
  onStatusChange: (status: string) => void;
  variant?: "full" | "compact";
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  planned: "Planned",
  in_production: "In Production",
  post_production: "Post Production",
  released: "Released",
  archived: "Archived",
};

export function MusicVideoSummaryCard({
  config,
  onSyncMetrics,
  syncing,
  onStatusChange,
  variant = "full",
}: MusicVideoSummaryCardProps) {
  const plan = buildPlanFromRow(config);
  const { chartName, mtvProgram, youtubeVideoId } = derivePlanMetadata(config);
  const metrics = config.music_video_metrics;

  const actualViews = metrics?.youtube_views ?? plan.youtubeViews;
  const actualChartPosition = metrics?.chart_position ?? plan.chartPosition;
  const actualChartVelocity = metrics?.chart_velocity ?? plan.chartVelocity;
  const actualMtvSpins = metrics?.mtv_spins ?? plan.mtvSpins;
  const statusLabel = STATUS_LABELS[config.status] ?? config.status;

  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <Clapperboard className="h-5 w-5" />
              {config.theme.replace(/_/g, " ")}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Palette className="h-4 w-4" />
                {config.art_style.replace(/_/g, " ")}
              </span>
              <Separator orientation="vertical" className="h-4" />
              <span className="flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                {config.budget_tier.toUpperCase()}
              </span>
              <Separator orientation="vertical" className="h-4" />
              <span className="flex items-center gap-1">
                <Camera className="h-4 w-4" />
                {config.image_quality.toUpperCase()}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant="secondary">${config.budget_amount.toLocaleString()}</Badge>
            <Select value={config.status} onValueChange={onStatusChange}>
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue placeholder="Set status" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {config.releases && (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Link className="h-4 w-4" />
            Linked to {config.releases.title} ({config.releases.release_type})
          </div>
        )}
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Workflow className="h-3 w-3" />
          <span className="font-medium text-foreground">{statusLabel}</span>
          {config.primary_platform && (
            <>
              <Separator orientation="vertical" className="h-3" />
              <span className="flex items-center gap-1">
                <Radio className="h-3 w-3" />
                {config.primary_platform.replace(/_/g, " ")}
              </span>
            </>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className={`grid gap-3 ${variant === "full" ? "sm:grid-cols-2" : ""}`}>
          <div className="rounded-lg border bg-muted/40 p-3 space-y-1">
            <span className="text-xs text-muted-foreground">Cast</span>
            <div className="flex items-center gap-2 font-semibold">
              <Users className="h-4 w-4" />
              {config.cast_option.replace(/_/g, " ")}
            </div>
            {config.cast_quality && (
              <Badge variant="outline" className="text-xs capitalize">
                {config.cast_quality.replace(/_/g, " ")}
              </Badge>
            )}
          </div>

          <div className="rounded-lg border bg-muted/40 p-3 space-y-1">
            <span className="text-xs text-muted-foreground">Location</span>
            <div className="flex items-center gap-2 font-semibold">
              <MapPin className="h-4 w-4" />
              {config.location_style ? config.location_style.replace(/_/g, " ") : "Not set"}
            </div>
          </div>
        </div>

        {variant === "full" && <Separator />}

        <div className={`grid gap-3 ${variant === "full" ? "sm:grid-cols-2" : ""}`}>
          <div className="rounded-lg border bg-background p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>YouTube Views</span>
              {youtubeVideoId && (
                <a
                  href={`https://youtu.be/${youtubeVideoId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  Watch
                </a>
              )}
            </div>
            <div className="flex items-center gap-2 text-lg font-semibold">
              <Youtube className="h-5 w-5 text-red-500" />
              {actualViews.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics ? "Latest synced audience reach" : "Projected reach based on configuration"}
            </p>
            {(config.kpi_view_target || metrics?.views_target) && (
              <p className="text-xs text-muted-foreground">
                Target: {(metrics?.views_target ?? config.kpi_view_target)?.toLocaleString()}
              </p>
            )}
          </div>

          <div className="rounded-lg border bg-background p-4 space-y-2">
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span>{metrics?.chart_name ?? chartName}</span>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-lg">
                #{actualChartPosition}
              </Badge>
              <Badge variant="outline" className="text-xs">
                Velocity {actualChartVelocity}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics?.chart_position ? "Live chart placement" : "Projected chart entry"}
            </p>
            {(config.kpi_chart_target || metrics?.chart_target) && (
              <p className="text-xs text-muted-foreground">
                Goal: {metrics?.chart_target ?? config.kpi_chart_target?.replace(/_/g, " ")}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border bg-background p-4 space-y-2">
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <Tv className="h-4 w-4" />
              <span>{metrics?.mtv_program ?? mtvProgram}</span>
            </div>
            <div className="flex items-center gap-2 text-lg font-semibold">
              <Sparkles className="h-5 w-5" />
              {actualMtvSpins} spins
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics?.mtv_spins ? "Confirmed airplay" : "Estimated rotation for this tier"}
            </p>
          </div>

          {variant === "full" && (
            <div className="rounded-lg border bg-background p-4 space-y-2">
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <CalendarClock className="h-4 w-4" />
                <span>Schedule</span>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>
                  Shoot: {config.shoot_start_date ? new Date(config.shoot_start_date).toLocaleDateString() : "TBD"} -
                  {" "}
                  {config.shoot_end_date ? new Date(config.shoot_end_date).toLocaleDateString() : "TBD"}
                </p>
                <p>
                  Release: {config.target_release_date ? new Date(config.target_release_date).toLocaleDateString() : "Not set"}
                </p>
                <p>Sync: {config.sync_strategy?.replace(/_/g, " ") ?? "Manual"}</p>
              </div>
            </div>
          )}
        </div>

        {config.production_notes && (
          <div className="rounded-lg border bg-muted/30 p-4 text-sm">
            <div className="font-semibold mb-1">Production Notes</div>
            <p className="text-muted-foreground whitespace-pre-line">{config.production_notes}</p>
          </div>
        )}

        {variant === "full" && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-muted-foreground">
              Last updated {new Date(config.updated_at).toLocaleString()}
              {metrics?.last_synced_at && (
                <span className="block sm:inline sm:ml-2">
                  Metrics synced {new Date(metrics.last_synced_at).toLocaleString()}
                </span>
              )}
            </div>
            <Button onClick={onSyncMetrics} disabled={syncing} variant="outline" size="sm">
              {syncing ? "Syncing metrics..." : "Sync Latest Metrics"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
