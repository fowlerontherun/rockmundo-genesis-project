import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Bus, CalendarDays, DollarSign, Gauge, Loader2, MapPinned, RefreshCw, Star, Ticket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface LiveTourHQPanelProps {
  tourId: string;
}

type Stop = {
  id: string;
  date: string;
  status: string | null;
  venue_name: string;
  city_name: string;
  tickets_sold: number;
  revenue: number;
  rating: number | null;
};

type Issue = { severity: "critical" | "warning" | "info"; code: string; message: string };

type TourHQProjection = {
  tour: { id: string; name: string; status: string; travel_mode: string | null; vehicle_tier: string | null; production_rating: number | null };
  stops: Stop[];
  current_stop: { venue_name: string; city_name: string; date: string } | null;
  next_stop: { venue_name: string; city_name: string; date: string } | null;
  progress: { total: number; completed: number; cancelled: number; remaining: number };
  finance: {
    realised_revenue: number;
    stored_total_revenue: number;
    upfront_cost: number;
    travel_cost: number;
    accommodation_cost: number;
    stage_setup_cost: number;
    equipment_hauling_cost: number;
    sponsor_cash: number;
  };
  performance: { tickets_sold: number; average_rating: number | null };
  logistics: { log_date?: string; fatigue_level?: number; morale_level?: number; vehicle_condition?: number; daily_costs?: number; notes?: string | null };
  travel: { total_legs?: number; completed_legs?: number; cancelled_legs?: number; total_cost?: number; total_hours?: number; next_leg?: { travel_mode?: string; departure_date?: string; arrival_date?: string; status?: string } | null };
  issues: Issue[];
  generated_at: string;
};

const money = (value: number | null | undefined) => `$${Math.round(Number(value ?? 0)).toLocaleString()}`;
const dateTime = (value?: string | null) => value ? new Date(value).toLocaleString() : "—";

export function LiveTourHQPanel({ tourId }: LiveTourHQPanelProps) {
  const query = useQuery({
    queryKey: ["tour-hq-live", tourId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_tour_hq_live", { p_tour_id: tourId });
      if (error) throw error;
      return data as TourHQProjection;
    },
    enabled: Boolean(tourId),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  if (query.isLoading) {
    return <Card><CardContent className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading live Tour HQ…</CardContent></Card>;
  }

  if (query.isError || !query.data) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Tour HQ could not be loaded</AlertTitle>
        <AlertDescription className="mt-2 flex flex-wrap items-center gap-3">
          <span>{(query.error as Error | undefined)?.message ?? "No live tour data was returned."}</span>
          <Button size="sm" variant="outline" onClick={() => void query.refetch()}>Retry</Button>
        </AlertDescription>
      </Alert>
    );
  }

  const hq = query.data;
  const progressPct = hq.progress.total ? (hq.progress.completed / hq.progress.total) * 100 : 0;
  const totalKnownCosts = Number(hq.finance.upfront_cost || 0) + Number(hq.finance.travel_cost || 0) + Number(hq.finance.accommodation_cost || 0) + Number(hq.finance.stage_setup_cost || 0) + Number(hq.finance.equipment_hauling_cost || 0);
  const operationalBalance = Number(hq.finance.realised_revenue || 0) + Number(hq.finance.sponsor_cash || 0) - totalKnownCosts;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Live Tour HQ</h3>
          <p className="text-xs text-muted-foreground">Projected from the canonical tour, venue, gig, travel and logistics records.</p>
        </div>
        <Button size="sm" variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>
          <RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><MapPinned className="h-4 w-4" /> Current location</CardTitle></CardHeader><CardContent><p className="font-bold">{hq.current_stop?.city_name ?? "Not on route yet"}</p><p className="text-xs text-muted-foreground">{hq.current_stop?.venue_name ?? "No completed/current stop"}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><CalendarDays className="h-4 w-4" /> Next show</CardTitle></CardHeader><CardContent><p className="font-bold">{hq.next_stop?.venue_name ?? "Tour complete"}</p><p className="text-xs text-muted-foreground">{hq.next_stop ? `${hq.next_stop.city_name} · ${dateTime(hq.next_stop.date)}` : "No future stop"}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Ticket className="h-4 w-4" /> Tickets sold</CardTitle></CardHeader><CardContent><p className="text-xl font-bold tabular-nums">{Number(hq.performance.tickets_sold || 0).toLocaleString()}</p><p className="text-xs text-muted-foreground">Across canonical tour gigs</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><DollarSign className="h-4 w-4" /> Operational balance</CardTitle></CardHeader><CardContent><p className={`text-xl font-bold tabular-nums ${operationalBalance < 0 ? "text-destructive" : "text-green-500"}`}>{money(operationalBalance)}</p><p className="text-xs text-muted-foreground">Revenue + sponsor cash − known tour costs</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Route progress</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm"><span>{hq.progress.completed} of {hq.progress.total} shows completed</span><span className="text-muted-foreground">{Math.round(progressPct)}%</span></div>
          <Progress value={progressPct} className="h-2" />
          <div className="space-y-2">
            {hq.stops.length === 0 ? <p className="text-sm text-muted-foreground">No routed stops yet.</p> : hq.stops.map((stop) => (
              <div key={stop.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                <div><p className="text-sm font-medium">{stop.city_name} · {stop.venue_name}</p><p className="text-xs text-muted-foreground">{dateTime(stop.date)} · {Number(stop.tickets_sold || 0).toLocaleString()} tickets · {money(stop.revenue)}</p></div>
                <div className="flex items-center gap-2">{stop.rating != null && <Badge variant="secondary"><Star className="mr-1 h-3 w-3" />{Number(stop.rating).toFixed(1)}</Badge>}<Badge variant="outline">{stop.status ?? "planned"}</Badge></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Gauge className="h-4 w-4" /> Latest logistics</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Fatigue</span><span>{hq.logistics.fatigue_level ?? "—"}%</span></div><div className="flex justify-between"><span className="text-muted-foreground">Morale</span><span>{hq.logistics.morale_level ?? "—"}%</span></div><div className="flex justify-between"><span className="text-muted-foreground">Vehicle</span><span>{hq.logistics.vehicle_condition ?? "—"}%</span></div><div className="flex justify-between"><span className="text-muted-foreground">Daily cost</span><span>{money(hq.logistics.daily_costs)}</span></div>{hq.logistics.notes && <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">{hq.logistics.notes}</p>}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Bus className="h-4 w-4" /> Travel</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Legs</span><span>{hq.travel.completed_legs ?? 0}/{hq.travel.total_legs ?? 0}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Travel hours</span><span>{Math.round(Number(hq.travel.total_hours ?? 0))}h</span></div><div className="flex justify-between"><span className="text-muted-foreground">Travel cost</span><span>{money(hq.travel.total_cost)}</span></div>{hq.travel.next_leg && <p className="rounded-md bg-muted p-2 text-xs">Next {hq.travel.next_leg.travel_mode ?? "travel"}: {dateTime(hq.travel.next_leg.departure_date)}</p>}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><DollarSign className="h-4 w-4" /> Canonical finance</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Realised revenue</span><span>{money(hq.finance.realised_revenue)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Upfront</span><span>{money(hq.finance.upfront_cost)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Travel</span><span>{money(hq.finance.travel_cost)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Accommodation</span><span>{money(hq.finance.accommodation_cost)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Stage/equipment</span><span>{money(Number(hq.finance.stage_setup_cost || 0) + Number(hq.finance.equipment_hauling_cost || 0))}</span></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><AlertTriangle className="h-4 w-4" /> Outstanding issues</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {hq.issues.length === 0 ? <p className="text-sm text-muted-foreground">No canonical route or logistics warnings detected.</p> : hq.issues.map((issue) => <Alert key={`${issue.code}-${issue.message}`} variant={issue.severity === "critical" ? "destructive" : "default"}><AlertTriangle className="h-4 w-4" /><AlertTitle className="capitalize">{issue.severity}: {issue.code.replaceAll("_", " ")}</AlertTitle><AlertDescription>{issue.message}</AlertDescription></Alert>)}
        </CardContent>
      </Card>
    </div>
  );
}
