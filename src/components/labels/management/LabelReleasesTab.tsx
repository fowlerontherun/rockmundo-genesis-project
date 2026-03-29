import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Disc, CalendarDays, DollarSign, TrendingUp, Package, Flame,
  Megaphone, BarChart3, Eye, Music, ArrowUpRight, Factory,
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
};

export function LabelReleasesTab({ labelId }: LabelReleasesTabProps) {
  const [viewMode, setViewMode] = useState<"all" | "released" | "pipeline">("all");

  const { data: releases = [], isLoading } = useQuery({
    queryKey: ["label-management-releases", labelId],
    queryFn: async () => {
      const { data: contracts } = await supabase
        .from("artist_label_contracts")
        .select("id")
        .eq("label_id", labelId);

      if (!contracts || contracts.length === 0) return [];
      const contractIds = contracts.map(c => c.id);

      const { data, error } = await supabase
        .from("label_releases")
        .select(`
          *,
          contract:artist_label_contracts(
            id, band_id, artist_profile_id,
            bands:band_id(name, genre, fame)
          ),
          label_promotion_campaigns(id, campaign_type, budget, effectiveness)
        `)
        .in("contract_id", contractIds)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
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
          <p className="text-sm text-muted-foreground">Releases appear here once artists start delivering</p>
        </CardContent>
      </Card>
    );
  }

  const totalRevenue = releases.reduce((sum, r) => sum + (r.revenue_generated ?? 0), 0);
  const totalUnits = releases.reduce((sum, r) => sum + (r.units_sold ?? 0), 0);
  const totalPromoBudget = releases.reduce((sum, r) => sum + (r.promotion_budget ?? 0), 0);
  const releasedReleases = releases.filter(r => r.status === "released");
  const pipelineReleases = releases.filter(r => r.status !== "released");
  const totalEffectiveness = releases.reduce((sum, r) => {
    const cs = r.label_promotion_campaigns || [];
    return sum + cs.reduce((s: number, c: any) => s + (c.effectiveness ?? 0), 0);
  }, 0);

  const filteredReleases = viewMode === "released"
    ? releasedReleases
    : viewMode === "pipeline"
    ? pipelineReleases
    : releases;

  // Sort: pipeline first (planning, manufacturing), then released by date
  const sortedReleases = [...filteredReleases].sort((a, b) => {
    const statusOrder: Record<string, number> = { planning: 0, manufacturing: 1, released: 2 };
    const aOrder = statusOrder[a.status ?? "planning"] ?? 0;
    const bOrder = statusOrder[b.status ?? "planning"] ?? 0;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

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
            <p className="text-sm font-bold tabular-nums text-emerald-500">${totalRevenue.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">Revenue</p>
          </CardContent>
        </Card>
        <Card className="bg-card/60">
          <CardContent className="p-2.5 text-center">
            <Megaphone className="h-3.5 w-3.5 mx-auto mb-0.5 text-purple-400" />
            <p className="text-sm font-bold tabular-nums">${totalCampaignSpend.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">Campaign Spend</p>
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
          const contract = release.contract as any;
          const band = contract?.bands;
          const campaigns = release.label_promotion_campaigns || [];
          const statusConf = STATUS_CONFIG[release.status ?? "planning"] || STATUS_CONFIG.planning;
          const releaseCampaignBudget = campaigns.reduce((s: number, c: any) => s + (c.budget ?? 0), 0);

          return (
            <Card key={release.id} className="overflow-hidden">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-sm truncate">{release.title}</p>
                      <Badge variant="outline" className="text-[10px] px-1 h-4 shrink-0">{release.release_type || "Single"}</Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                      <Music className="h-3 w-3" />
                      <span>{band?.name || "Unknown"}</span>
                      {release.release_date && (
                        <>
                          <span>·</span>
                          <CalendarDays className="h-3 w-3" />
                          <span>{format(new Date(release.release_date), "MMM d, yyyy")}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Badge className={cn(statusConf.color, "border-0 text-[10px] h-5 shrink-0")}>
                    {release.status || "planning"}
                  </Badge>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-2 mt-2.5">
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground">Units</p>
                    <p className="text-xs font-bold tabular-nums">{(release.units_sold ?? 0).toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground">Revenue</p>
                    <p className="text-xs font-bold tabular-nums text-emerald-500">${(release.revenue_generated ?? 0).toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground">Promo</p>
                    <p className="text-xs font-bold tabular-nums">${(release.promotion_budget ?? 0).toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground">Campaigns</p>
                    <p className="text-xs font-bold tabular-nums flex items-center justify-center gap-0.5">
                      <Megaphone className="h-3 w-3 text-purple-400" />
                      {campaigns.length}
                    </p>
                  </div>
                </div>

                {/* Active campaigns */}
                {campaigns.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {campaigns.map((c: any) => (
                      <Badge
                        key={c.id}
                        variant="secondary"
                        className={cn("text-[10px] px-1.5 h-4", {
                          "bg-purple-500/15 text-purple-400": c.status === "active",
                        })}
                      >
                        <Megaphone className="h-2.5 w-2.5 mr-0.5" />
                        {c.campaign_type} ${c.budget?.toLocaleString()}
                      </Badge>
                    ))}
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
