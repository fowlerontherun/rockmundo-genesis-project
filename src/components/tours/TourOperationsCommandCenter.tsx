import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BedDouble,
  Bus,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Gauge,
  MapPin,
  PackageCheck,
  RefreshCw,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  getTourOperationsWorkspace,
  TOUR_OPERATIONS_QUERY_KEY,
  tourOperationsErrorMessage,
} from "@/lib/api/tourOperations";

interface TourOperationsCommandCenterProps {
  tourId: string;
}

type ReadinessTone = "ready" | "warning" | "blocked";

interface ReadinessFlag {
  tone: ReadinessTone;
  title: string;
  detail: string;
}

const money = (value: number) => `£${Math.round(value || 0).toLocaleString()}`;

const formatDateTime = (value?: string | null) => {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

const asString = (value: unknown): string | null => typeof value === "string" && value.length > 0 ? value : null;

const readinessBadge = (tone: ReadinessTone) => {
  if (tone === "blocked") return <Badge variant="destructive">Blocked</Badge>;
  if (tone === "warning") return <Badge variant="secondary">Attention</Badge>;
  return <Badge variant="default">Ready</Badge>;
};

export function TourOperationsCommandCenter({ tourId }: TourOperationsCommandCenterProps) {
  const workspaceQuery = useQuery({
    queryKey: [TOUR_OPERATIONS_QUERY_KEY, tourId],
    queryFn: () => getTourOperationsWorkspace(tourId),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  });

  const workspace = workspaceQuery.data;

  const metrics = useMemo(() => {
    if (!workspace) return null;

    const completed = workspace.live.progress.completed;
    const total = workspace.live.progress.total;
    const remaining = workspace.live.progress.remaining;
    const realisedRevenue = workspace.live.finance.realised_revenue || 0;
    const avgRevenuePerCompletedShow = completed > 0 ? realisedRevenue / completed : 0;
    const projectedRevenue = completed > 0
      ? realisedRevenue + avgRevenuePerCompletedShow * remaining
      : realisedRevenue;
    const upfrontCost = workspace.live.finance.upfront_cost || 0;
    const sponsorCash = workspace.live.finance.sponsor_cash || 0;
    const projectedPosition = projectedRevenue + sponsorCash - upfrontCost;
    const currentPosition = realisedRevenue + sponsorCash - upfrontCost;

    const crewCount = workspace.crew.length;
    const averageCrewFatigue = crewCount > 0
      ? workspace.crew.reduce((totalFatigue, member) => totalFatigue + (member.fatigue_score || 0), 0) / crewCount
      : Number(workspace.state.fatigue_score || workspace.live.logistics.fatigue_level || 0);
    const averageCrewMorale = crewCount > 0
      ? workspace.crew.reduce((totalMorale, member) => totalMorale + (member.morale_score || 0), 0) / crewCount
      : Number(workspace.state.crew_morale || workspace.live.logistics.morale_level || 70);
    const accommodationReady = workspace.crew.filter((member) =>
      ["booked", "confirmed", "ready", "with_band"].includes((member.accommodation_status || "").toLowerCase()),
    ).length;
    const transportReady = workspace.crew.filter((member) =>
      ["booked", "confirmed", "ready", "with_band", "assigned"].includes((member.transport_status || "").toLowerCase()),
    ).length;

    const equipmentCount = workspace.equipment.length;
    const repairItems = workspace.equipment.filter((item) => item.needs_repair || item.condition_snapshot < 40);
    const transitItems = workspace.equipment.filter((item) => item.in_transit);
    const averageEquipmentCondition = equipmentCount > 0
      ? workspace.equipment.reduce((sum, item) => sum + (item.condition_snapshot || 0), 0) / equipmentCount
      : 100;

    const unresolvedEvents = workspace.events.filter((event) => !event.resolved);
    const criticalEvents = unresolvedEvents.filter((event) => event.severity === "critical");
    const nextLeg = workspace.live.travel.next_leg ?? null;
    const nextDeparture = nextLeg ? asString(nextLeg.departure_date) : null;
    const nextArrival = nextLeg ? asString(nextLeg.arrival_date) : null;
    const nextTravelMode = nextLeg ? asString(nextLeg.travel_mode) : null;

    const flags: ReadinessFlag[] = [];

    if (workspace.live.next_stop) {
      if (criticalEvents.length > 0) {
        flags.push({ tone: "blocked", title: "Critical operations event", detail: `${criticalEvents.length} critical issue${criticalEvents.length === 1 ? "" : "s"} must be resolved.` });
      }
      if (workspace.state.production_status === "blocked") {
        flags.push({ tone: "blocked", title: "Production blocked", detail: "The saved production state is marked as blocked for the next show." });
      } else if (workspace.state.production_status === "at_risk") {
        flags.push({ tone: "warning", title: "Production at risk", detail: "Production needs attention before the next performance." });
      }
      if (repairItems.length > 0) {
        flags.push({ tone: repairItems.length > 1 ? "blocked" : "warning", title: "Equipment condition", detail: `${repairItems.length} item${repairItems.length === 1 ? "" : "s"} need repair or are below 40% condition.` });
      }
      if (transitItems.length > 0) {
        flags.push({ tone: "warning", title: "Equipment still travelling", detail: `${transitItems.length} item${transitItems.length === 1 ? "" : "s"} are marked in transit.` });
      }
      if (crewCount > 0 && accommodationReady < crewCount) {
        flags.push({ tone: "warning", title: "Accommodation incomplete", detail: `${crewCount - accommodationReady} crew member${crewCount - accommodationReady === 1 ? "" : "s"} do not have confirmed accommodation.` });
      }
      if (crewCount > 0 && transportReady < crewCount) {
        flags.push({ tone: "warning", title: "Crew transport incomplete", detail: `${crewCount - transportReady} crew member${crewCount - transportReady === 1 ? "" : "s"} do not have confirmed transport.` });
      }
      if (averageCrewFatigue >= 75) {
        flags.push({ tone: "warning", title: "High crew fatigue", detail: `Average fatigue is ${Math.round(averageCrewFatigue)}%. Rest should be prioritised before the next show.` });
      }
      if ((workspace.live.issues || []).some((issue) => issue.severity === "critical")) {
        flags.push({ tone: "blocked", title: "Route problem", detail: "The canonical tour route contains a critical issue." });
      }
      if ((workspace.live.issues || []).some((issue) => issue.code === "missing_travel_legs")) {
        flags.push({ tone: "warning", title: "Travel leg missing", detail: "At least one transition between tour stops has no travel leg." });
      }
    }

    if (flags.length === 0 && workspace.live.next_stop) {
      flags.push({ tone: "ready", title: "Next show ready", detail: "No current operational blockers were detected from live tour data." });
    }

    const blocked = flags.some((flag) => flag.tone === "blocked");
    const warning = flags.some((flag) => flag.tone === "warning");
    const readinessTone: ReadinessTone = blocked ? "blocked" : warning ? "warning" : "ready";
    const readinessScore = Math.max(0, Math.min(100,
      100
      - criticalEvents.length * 30
      - repairItems.length * 12
      - transitItems.length * 5
      - Math.max(0, crewCount - accommodationReady) * 4
      - Math.max(0, crewCount - transportReady) * 4
      - Math.max(0, averageCrewFatigue - 60) * 0.8
      - (workspace.state.production_status === "blocked" ? 35 : workspace.state.production_status === "at_risk" ? 15 : 0),
    ));

    return {
      completed,
      total,
      currentPosition,
      projectedRevenue,
      projectedPosition,
      averageCrewFatigue,
      averageCrewMorale,
      accommodationReady,
      transportReady,
      crewCount,
      equipmentCount,
      repairItems,
      transitItems,
      averageEquipmentCondition,
      unresolvedEvents,
      nextDeparture,
      nextArrival,
      nextTravelMode,
      flags,
      readinessTone,
      readinessScore,
    };
  }, [workspace]);

  if (workspaceQuery.isLoading) {
    return (
      <Card className="border-primary/20">
        <CardContent className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" /> Building live operations picture…
        </CardContent>
      </Card>
    );
  }

  if (workspaceQuery.isError || !workspace || !metrics) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Live operations data unavailable</AlertTitle>
        <AlertDescription>{tourOperationsErrorMessage(workspaceQuery.error)}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="border-primary/30 bg-primary/[0.02]">
      <CardHeader className="space-y-2 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Gauge className="h-4 w-4" /> Automatic Tour Operations
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Live from gigs, travel, crew, equipment and tour finances · auto-refreshes every 30 seconds
            </p>
          </div>
          <div className="flex items-center gap-2">
            {readinessBadge(metrics.readinessTone)}
            <Badge variant="outline">Readiness {Math.round(metrics.readinessScore)}%</Badge>
          </div>
        </div>
        <Progress value={metrics.readinessScore} className="h-2" />
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border bg-background/60 p-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><CircleDollarSign className="h-3.5 w-3.5" /> Current tour position</p>
            <p className={cn("mt-1 text-xl font-bold", metrics.currentPosition >= 0 ? "text-green-500" : "text-destructive")}>{money(metrics.currentPosition)}</p>
            <p className="text-[11px] text-muted-foreground">Realised revenue + sponsor cash − upfront cost</p>
          </div>
          <div className="rounded-lg border bg-background/60 p-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><TrendingUp className="h-3.5 w-3.5" /> Projected final position</p>
            <p className={cn("mt-1 text-xl font-bold", metrics.projectedPosition >= 0 ? "text-green-500" : "text-destructive")}>{money(metrics.projectedPosition)}</p>
            <p className="text-[11px] text-muted-foreground">Projected revenue {money(metrics.projectedRevenue)} at current show pace</p>
          </div>
          <div className="rounded-lg border bg-background/60 p-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" /> Crew condition</p>
            <p className="mt-1 text-xl font-bold">{Math.round(metrics.averageCrewMorale)}% morale</p>
            <p className="text-[11px] text-muted-foreground">{Math.round(metrics.averageCrewFatigue)}% fatigue · {metrics.crewCount} crew</p>
          </div>
          <div className="rounded-lg border bg-background/60 p-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><PackageCheck className="h-3.5 w-3.5" /> Equipment health</p>
            <p className="mt-1 text-xl font-bold">{Math.round(metrics.averageEquipmentCondition)}%</p>
            <p className="text-[11px] text-muted-foreground">{metrics.equipmentCount} items · {metrics.repairItems.length} repair · {metrics.transitItems.length} in transit</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-lg border bg-background/60 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">Next show readiness</p>
              {readinessBadge(metrics.readinessTone)}
            </div>
            {workspace.live.next_stop ? (
              <>
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="flex items-center gap-2 font-medium"><MapPin className="h-4 w-4" /> {workspace.live.next_stop.city_name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{workspace.live.next_stop.venue_name} · {formatDateTime(workspace.live.next_stop.date)}</p>
                </div>
                <div className="space-y-2">
                  {metrics.flags.map((flag, index) => (
                    <div key={`${flag.title}-${index}`} className="flex items-start gap-2 text-sm">
                      {flag.tone === "ready" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" /> : flag.tone === "blocked" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />}
                      <div><p className="font-medium">{flag.title}</p><p className="text-xs text-muted-foreground">{flag.detail}</p></div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-green-500" /> No remaining shows.</div>
            )}
          </div>

          <div className="space-y-3 rounded-lg border bg-background/60 p-4">
            <p className="font-semibold">Logistics snapshot</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-md border p-3">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Bus className="h-3.5 w-3.5" /> Next travel</p>
                <p className="mt-1 text-sm font-medium capitalize">{metrics.nextTravelMode?.replaceAll("_", " ") ?? "No pending leg"}</p>
                {metrics.nextDeparture && <p className="text-[11px] text-muted-foreground">Depart {formatDateTime(metrics.nextDeparture)}</p>}
                {metrics.nextArrival && <p className="text-[11px] text-muted-foreground">Arrive {formatDateTime(metrics.nextArrival)}</p>}
              </div>
              <div className="rounded-md border p-3">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><BedDouble className="h-3.5 w-3.5" /> Accommodation</p>
                <p className="mt-1 text-sm font-medium">{metrics.accommodationReady}/{metrics.crewCount || 0} crew confirmed</p>
                <p className="text-[11px] text-muted-foreground">Pulled from the live crew roster</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Wrench className="h-3.5 w-3.5" /> Production</p>
                <p className="mt-1 text-sm font-medium capitalize">{workspace.state.production_status.replaceAll("_", " ")}</p>
                <p className="text-[11px] text-muted-foreground">{metrics.transportReady}/{metrics.crewCount || 0} crew transport ready</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> Live exceptions</p>
                <p className="mt-1 text-sm font-medium">{metrics.unresolvedEvents.length} unresolved</p>
                <p className="text-[11px] text-muted-foreground">{workspace.live.travel.completed_legs}/{workspace.live.travel.total_legs} travel legs completed</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
