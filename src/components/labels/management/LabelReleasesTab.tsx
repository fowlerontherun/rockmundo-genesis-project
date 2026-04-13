import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Disc, CalendarDays, DollarSign, TrendingUp, Package, Flame,
  Megaphone, BarChart3, Music, Factory, Disc3,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface LabelReleasesTabProps {
  labelId: string;
}

const STATUS_CONFIG: Record<string, { color: string; icon: typeof Disc }> = {
  planning: { color: "bg-amber-500/20 text-amber-500", icon: CalendarDays },
  manufacturing: { color: "bg-blue-500/20 text-blue-500", icon: Factory },
  released: { color: "bg-emerald-500/20 text-emerald-500", icon: Disc },
  cancelled: { color: "bg-destructive/20 text-destructive", icon: Disc },
};

export function LabelReleasesTab({ labelId }: LabelReleasesTabProps) {
  const [viewMode, setViewMode] = useState<"all" | "released" | "pipeline">("all");

  // Query actual releases from releases table via label contracts
  const { data: releases = [], isLoading } = useQuery({
    queryKey: ["label-management-releases", labelId],
    queryFn: async () => {
      // Get contract IDs for this label
      const { data: contracts } = await supabase
        .from("artist_label_contracts")
        .select("id")
        .eq("label_id", labelId)
        .in("status", ["active", "completed"]);

      if (!contracts || contracts.length === 0) return [];
      const contractIds = contracts.map(c => c.id);

      // Get actual releases from releases table
      const { data, error } = await supabase
        .from("releases")
        .select(`
          id, title, release_type, release_status, total_units_sold, total_revenue,
          digital_sales, cd_sales, vinyl_sales, cassette_sales, hype_score,
          label_contract_id, label_revenue_share_pct, scheduled_release_date,
          created_at, updated_at, manufacturing_complete_at,
          bands:band_id(id, name, genre, fame)
        `)
        .in("label_contract_id", contractIds)
        .neq("release_status", "cancelled")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Get chart entries for these releases
  const { data: chartData = [] } = useQuery({
    queryKey: ["label-release-charts", labelId, releases.map(r => r.id)],
    queryFn: async () => {
      if (releases.length === 0) return [];
      const releaseIds = releases.map(r => r.id);
      const { data } = await supabase
        .from("chart_entries")
        .select("release_id, rank, chart_type, country, chart_date")
        .in("release_id", releaseIds)
        .order("chart_date", { ascending: false })
        .limit(100);
      return data || [];
    },
    enabled: releases.length > 0,
  });

  if (isLoading) {
    return <Card><CardContent className="p-6 text-center text-muted-foreground">Loading releases...</CardContent></Card>;
  }

  if (releases.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Disc className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No releases yet</p>
          <p className="text-sm text-muted-foreground">Releases appear here once signed artists release music</p>
        </CardContent>
      </Card>
    );
  }

  const totalRevenue = releases.reduce((sum, r) => sum + (r.total_revenue ?? 0), 0);
  const totalUnits = releases.reduce((sum, r) => sum + (r.total_units_sold ?? 0), 0);
  const releasedReleases = releases.filter(r => r.release_status === "released");
  const pipelineReleases = releases.filter(r => r.release_status !== "released");

  // Best chart position per release
  const bestChartByRelease = new Map<string, number>();
  chartData.forEach(ce => {
    const current = bestChartByRelease.get(ce.release_id!) ?? Infinity;
    if (ce.rank < current) bestChartByRelease.set(ce.release_id!, ce.rank);
  });

  const filteredReleases = viewMode === "released"
    ? releasedReleases
    : viewMode === "pipeline"
    ? pipelineReleases
    : releases;

  const sortedReleases = [...filteredReleases].sort((a, b) => {
    const statusOrder: Record<string, number> = { planning: 0, manufacturing: 1, released: 2 };
    const aOrder = statusOrder[a.release_status ?? "planning"] ?? 0;
    const bOrder = statusOrder[b.release_status ?? "planning"] ?? 0;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Revenue is stored in cents in total_revenue
  const formatRevenue = (cents: number) => `$${Math.round(cents / 100).toLocaleString()}`;

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Card className="bg-card/60">
          <CardContent className="p-2.5 text-center">
            <Package className="h-3.5 w-3.5 mx-auto mb-0.5 text-muted-foreground" />
            <p className="text-sm font-bold">{releases.length}</p>
            <p className="text-[10px] text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="bg-card/60">
          <CardContent className="p-2.5 text-center">
            <Disc className="h-3.5 w-3.5 mx-auto mb-0.5 text-emerald-500" />
            <p className="text-sm font-bold text-emerald-500">{releasedReleases.length}</p>
            <p className="text-[10px] text-muted-foreground">Released</p>
          </CardContent>
        </Card>
        <Card className="bg-card/60">
          <CardContent className="p-2.5 text-center">
            <TrendingUp className="h-3.5 w-3.5 mx-auto mb-0.5 text-muted-foreground" />
            <p className="text-sm font-bold tabular-nums">{totalUnits.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">Units Sold</p>
          </CardContent>
        </Card>
        <Card className="bg-card/60">
          <CardContent className="p-2.5 text-center">
            <DollarSign className="h-3.5 w-3.5 mx-auto mb-0.5 text-emerald-500" />
            <p className="text-sm font-bold tabular-nums text-emerald-500">{formatRevenue(totalRevenue)}</p>
            <p className="text-[10px] text-muted-foreground">Gross Revenue</p>
          </CardContent>
        </Card>
        <Card className="bg-card/60">
          <CardContent className="p-2.5 text-center">
            <Flame className="h-3.5 w-3.5 mx-auto mb-0.5 text-orange-400" />
            <p className="text-sm font-bold tabular-nums">
              {Math.max(...releases.map(r => r.hype_score ?? 0), 0)}
            </p>
            <p className="text-[10px] text-muted-foreground">Peak Hype</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5">
        {[
          { value: "all", label: `All (${releases.length})` },
          { value: "pipeline", label: `Pipeline (${pipelineReleases.length})` },
          { value: "released", label: `Released (${releasedReleases.length})` },
        ].map(tab => (
          <Button
            key={tab.value}
            variant={viewMode === tab.value ? "default" : "outline"}
            size="sm"
            className="text-xs h-7"
            onClick={() => setViewMode(tab.value as any)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Release Cards */}
      <div className="space-y-2">
        {sortedReleases.map((release) => {
          const band = release.bands as any;
          const statusConf = STATUS_CONFIG[release.release_status ?? "planning"] || STATUS_CONFIG.planning;
          const bestChart = bestChartByRelease.get(release.id);

          return (
            <Card key={release.id} className="overflow-hidden">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-sm truncate">{release.title}</p>
                      <Badge variant="outline" className="text-[10px] px-1 h-4 shrink-0 capitalize">{release.release_type || "Single"}</Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                      <Music className="h-3 w-3" />
                      <span>{band?.name || "Unknown"}</span>
                      {release.scheduled_release_date && (
                        <>
                          <span>·</span>
                          <CalendarDays className="h-3 w-3" />
                          <span>{format(new Date(release.scheduled_release_date), "MMM d, yyyy")}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Badge className={cn(statusConf.color, "border-0 text-[10px] h-5 shrink-0 capitalize")}>
                    {release.release_status || "planning"}
                  </Badge>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-5 gap-2 mt-2.5">
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground">Units</p>
                    <p className="text-xs font-bold tabular-nums">{(release.total_units_sold ?? 0).toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground">Revenue</p>
                    <p className="text-xs font-bold tabular-nums text-emerald-500">{formatRevenue(release.total_revenue ?? 0)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground">Label Cut</p>
                    <p className="text-xs font-bold tabular-nums">{release.label_revenue_share_pct ?? 0}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground">Hype</p>
                    <p className="text-xs font-bold tabular-nums flex items-center justify-center gap-0.5">
                      <Flame className="h-3 w-3 text-orange-400" />
                      {release.hype_score ?? 0}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground">Chart</p>
                    <p className="text-xs font-bold tabular-nums">
                      {bestChart ? `#${bestChart}` : "—"}
                    </p>
                  </div>
                </div>

                {/* Sales breakdown */}
                {release.release_status === "released" && (release.total_units_sold ?? 0) > 0 && (
                  <div className="flex gap-2 mt-2 text-[10px]">
                    {(release.digital_sales ?? 0) > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 h-4">
                        Digital: {(release.digital_sales ?? 0).toLocaleString()}
                      </Badge>
                    )}
                    {(release.cd_sales ?? 0) > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 h-4">
                        CD: {(release.cd_sales ?? 0).toLocaleString()}
                      </Badge>
                    )}
                    {(release.vinyl_sales ?? 0) > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 h-4">
                        Vinyl: {(release.vinyl_sales ?? 0).toLocaleString()}
                      </Badge>
                    )}
                    {(release.cassette_sales ?? 0) > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 h-4">
                        Cassette: {(release.cassette_sales ?? 0).toLocaleString()}
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
