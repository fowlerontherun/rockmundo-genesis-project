import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
}

export function MusicVideoSummaryCard({ config, onSyncMetrics, syncing }: MusicVideoSummaryCardProps) {
  const plan = buildPlanFromRow(config);
  const { chartName, mtvProgram, youtubeVideoId } = derivePlanMetadata(config);
  const metrics = config.music_video_metrics;

  const actualViews = metrics?.youtube_views ?? plan.youtubeViews;
  const actualChartPosition = metrics?.chart_position ?? plan.chartPosition;
  const actualChartVelocity = metrics?.chart_velocity ?? plan.chartVelocity;
  const actualMtvSpins = metrics?.mtv_spins ?? plan.mtvSpins;

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
          <Badge variant="secondary">${config.budget_amount.toLocaleString()}</Badge>
        </div>

        {config.releases && (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Link className="h-4 w-4" />
            Linked to {config.releases.title} ({config.releases.release_type})
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
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

        <Separator />

        <div className="grid gap-3 sm:grid-cols-2">
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
          </div>
        </div>

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

        {config.production_notes && (
          <div className="rounded-lg border bg-muted/30 p-4 text-sm">
            <div className="font-semibold mb-1">Production Notes</div>
            <p className="text-muted-foreground whitespace-pre-line">{config.production_notes}</p>
          </div>
        )}

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
      </CardContent>
    </Card>
  );
}
