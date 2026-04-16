import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useTourStats } from "@/hooks/useTourStats";
import {
  DollarSign, TrendingUp, Star, Ticket, Music, MapPin,
  Calendar, ShoppingBag, Sparkles, Trophy, AlertTriangle, Loader2,
  Bus, Plane, Train, Ship
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface TourDetailPanelProps {
  tour: {
    id: string;
    name: string;
    status: string;
    start_date: string;
    end_date: string;
    total_revenue: number;
    total_upfront_cost?: number;
    scope?: string | null;
    travel_mode?: string | null;
    stage_setup_tier?: string | null;
    sponsor_cash_value?: number | null;
    merch_boost_multiplier?: number | null;
    support_revenue_share?: number | null;
    band?: {
      id: string;
      name: string;
      fame: number | null;
      genre: string | null;
      total_fans: number | null;
    } | null;
  };
}

const travelIcon = (mode: string | null | undefined) => {
  switch (mode) {
    case "plane": return <Plane className="h-3 w-3" />;
    case "train": return <Train className="h-3 w-3" />;
    case "ship": return <Ship className="h-3 w-3" />;
    default: return <Bus className="h-3 w-3" />;
  }
};

export function TourDetailPanel({ tour }: TourDetailPanelProps) {
  const { data: stats, isLoading } = useTourStats(tour.id);

  const isActive = tour.status === "active" || tour.status === "scheduled";
  const isCompleted = tour.status === "completed";
  const fillPct = stats ? (stats.totalShows > 0 ? (stats.completedShows / stats.totalShows) * 100 : 0) : 0;
  const occupancyPct = stats && stats.totalCapacity > 0
    ? Math.round((stats.totalTicketsSold / stats.totalCapacity) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Header stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Band</p>
          <p className="font-semibold">{tour.band?.name || "Unknown"}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Dates</p>
          <p className="text-sm font-medium">
            {format(new Date(tour.start_date), "MMM d")} – {format(new Date(tour.end_date), "MMM d, yyyy")}
          </p>
        </div>
        {tour.scope && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Scope</p>
            <Badge variant="outline" className="capitalize">{tour.scope}</Badge>
          </div>
        )}
        {tour.travel_mode && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Travel</p>
            <div className="flex items-center gap-1 text-sm">
              {travelIcon(tour.travel_mode)}
              <span className="capitalize">{tour.travel_mode?.replace("_", " ")}</span>
            </div>
          </div>
        )}
        {tour.stage_setup_tier && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Stage Setup</p>
            <Badge variant="secondary" className="capitalize">
              <Sparkles className="h-3 w-3 mr-1" />
              {tour.stage_setup_tier}
            </Badge>
          </div>
        )}
      </div>

      <Separator />

      {/* Financial overview */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : stats ? (
        <>
          {/* Revenue headline */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-4 pb-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
                    <Ticket className="h-3 w-3" /> Ticket Revenue
                  </p>
                  <p className="text-2xl font-black tracking-tight tabular-nums text-green-500">
                    ${stats.totalTicketRevenue.toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
                    <ShoppingBag className="h-3 w-3" /> Merch Revenue
                  </p>
                  <p className="text-2xl font-black tracking-tight tabular-nums text-green-500">
                    ${stats.totalMerchRevenue.toLocaleString()}
                  </p>
                </div>
              </div>
              <Separator className="my-3" />
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Net Profit</p>
                  <p className={cn(
                    "text-xl font-extrabold tracking-tight tabular-nums",
                    stats.totalNetProfit >= 0 ? "text-green-500" : "text-destructive"
                  )}>
                    {stats.totalNetProfit >= 0 ? "+" : ""}${stats.totalNetProfit.toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
                    <TrendingUp className="h-3 w-3" /> Fame Gained
                  </p>
                  <p className="text-xl font-extrabold tracking-tight tabular-nums text-primary">
                    +{stats.totalFameGained.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Upfront cost info */}
          {(tour.total_upfront_cost || 0) > 0 && (
            <div className="flex items-center justify-between text-sm px-1">
              <span className="text-muted-foreground">Upfront Cost Paid</span>
              <span className="font-medium tabular-nums">${(tour.total_upfront_cost || 0).toLocaleString()}</span>
            </div>
          )}
          {(tour.sponsor_cash_value || 0) > 0 && (
            <div className="flex items-center justify-between text-sm px-1">
              <span className="text-muted-foreground">Sponsor Subsidy</span>
              <span className="font-medium tabular-nums text-green-500">-${(tour.sponsor_cash_value || 0).toLocaleString()}</span>
            </div>
          )}

          {/* Shows progress */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Music className="h-4 w-4" />
                Shows Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>{stats.completedShows} / {stats.totalShows} shows completed</span>
                <span className="text-muted-foreground">{Math.round(fillPct)}%</span>
              </div>
              <Progress value={fillPct} className="h-2" />

              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div>
                  <p className="text-lg font-bold tabular-nums">{stats.totalTicketsSold.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">Tickets Sold</p>
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums">{occupancyPct}%</p>
                  <p className="text-[10px] text-muted-foreground">Avg Occupancy</p>
                </div>
                <div>
                  {stats.avgRating !== null ? (
                    <>
                      <p className="text-lg font-bold tabular-nums flex items-center justify-center gap-0.5">
                        <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
                        {stats.avgRating.toFixed(1)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Avg Rating</p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-bold text-muted-foreground">—</p>
                      <p className="text-[10px] text-muted-foreground">No ratings</p>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Best / Worst shows */}
          {(stats.bestShow || stats.worstShow) && stats.completedShows > 1 && (
            <div className="grid grid-cols-2 gap-3">
              {stats.bestShow && (
                <div className="flex items-start gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                  <Trophy className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-green-600 font-medium">Best Show</p>
                    <p className="text-xs font-semibold truncate">{stats.bestShow.venueName}</p>
                    <p className="text-[10px] text-muted-foreground">{stats.bestShow.rating.toFixed(1)}/25</p>
                  </div>
                </div>
              )}
              {stats.worstShow && (
                <div className="flex items-start gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-destructive font-medium">Worst Show</p>
                    <p className="text-xs font-semibold truncate">{stats.worstShow.venueName}</p>
                    <p className="text-[10px] text-muted-foreground">{stats.worstShow.rating.toFixed(1)}/25</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Merch boost badge */}
          {(tour.merch_boost_multiplier || 0) > 1 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
              <ShoppingBag className="h-3 w-3" />
              Merch boost: +{Math.round(((tour.merch_boost_multiplier || 1) - 1) * 100)}%
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">No performance data yet.</p>
      )}
    </div>
  );
}
