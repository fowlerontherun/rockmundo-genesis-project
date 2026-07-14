import { AlertTriangle, Bed, Bus, CalendarDays, DollarSign, HeartPulse, MapPinned, Moon, Package, Shirt, Sparkles, Star, Users, Wrench } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { TourHQSummary } from "@/utils/tourOperations";

interface TourHQPanelProps { summary: TourHQSummary; }
const money = (value: number) => `${value < 0 ? "-" : ""}$${Math.abs(Math.round(value)).toLocaleString()}`;

export function TourHQPanel({ summary }: TourHQPanelProps) {
  const issueTone = summary.productionStatus === "blocked" ? "destructive" : summary.productionStatus === "at_risk" ? "secondary" : "default";
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><MapPinned className="h-4 w-4" /> Current city</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{summary.currentCity}</p><p className="text-xs text-muted-foreground">Next: {summary.nextVenue ?? "Tour complete"}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Remaining shows</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{summary.remainingShows}</p><p className="text-xs text-muted-foreground">{summary.mapStops.length} stops routed</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" /> Rolling budget</CardTitle></CardHeader><CardContent><p className={cn("text-xl font-bold", summary.budget.profit >= 0 ? "text-green-500" : "text-destructive")}>{money(summary.budget.rollingBudget)}</p><p className="text-xs text-muted-foreground">Profit {money(summary.budget.profit)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Star className="h-4 w-4" /> Tour momentum</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{Math.round(summary.tourMomentum)}%</p><Progress value={summary.tourMomentum} className="mt-2 h-2" /></CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2"><CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" /> Tour calendar & map</CardTitle></CardHeader><CardContent className="space-y-2">{summary.mapStops.map((stop, index) => (<div key={`${stop.cityName}-${index}`} className="flex items-center justify-between rounded-lg border p-3"><div><p className="font-medium">{stop.cityName}</p><p className="text-sm text-muted-foreground">{stop.venueName}</p></div><Badge variant={stop.status === "completed" ? "default" : stop.status === "next" ? "secondary" : "outline"}>{stop.status}</Badge></div>))}</CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Outstanding issues</CardTitle></CardHeader><CardContent className="space-y-3"><Badge variant={issueTone}>Production {summary.productionStatus.replace("_", " ")}</Badge>{summary.outstandingIssues.length === 0 ? <p className="text-sm text-muted-foreground">No blockers detected. Logistics are ready for the next show.</p> : summary.outstandingIssues.map((issue) => (<div key={`${issue.code}-${issue.stopId ?? "tour"}`} className="rounded-lg border p-2 text-sm"><p className="font-medium capitalize">{issue.severity}: {issue.code.replace("_", " ")}</p><p className="text-muted-foreground">{issue.message}</p></div>))}</CardContent></Card>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><HeartPulse className="h-5 w-5" /> Recovery planning forecast <Badge variant="outline">Estimated</Badge></CardTitle>
          <p className="text-xs text-muted-foreground">Server-side estimates combine route pressure, accommodation quality, transport comfort and planned rest days.</p>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border bg-background/80 p-3"><p className="text-xs text-muted-foreground">Gig readiness</p><p className="text-2xl font-bold">{Math.round(summary.wellnessForecast.estimatedGigReadiness)}%</p><Progress value={summary.wellnessForecast.estimatedGigReadiness} className="mt-2 h-2" /></div>
          <div className="rounded-lg border bg-background/80 p-3"><p className="text-xs text-muted-foreground">Tour load</p><p className="text-lg font-bold capitalize">{summary.wellnessForecast.tourLoadState}</p><p className="text-xs">Score {summary.wellnessForecast.tourLoadScore}/100</p></div>
          <div className="rounded-lg border bg-background/80 p-3"><p className="text-xs text-muted-foreground">Travel fatigue</p><p className="text-lg font-bold">+{summary.wellnessForecast.predictedTravelFatigue}</p><p className="text-xs">Transport recovery {summary.wellnessForecast.transportRecoveryScore}/100</p></div>
          <div className="rounded-lg border bg-background/80 p-3"><p className="text-xs text-muted-foreground">Sleep opportunities</p><p className="text-lg font-bold flex items-center gap-1"><Moon className="h-4 w-4" /> {summary.wellnessForecast.expectedSleepOpportunities}h</p><p className="text-xs">Accommodation recovery {summary.wellnessForecast.accommodationRecoveryScore}/100</p></div>
          <div className="md:col-span-4 space-y-2">
            {summary.wellnessForecast.recommendations.length === 0 ? <p className="text-sm text-muted-foreground">No high-risk recovery adjustments recommended for the current itinerary.</p> : summary.wellnessForecast.recommendations.map((item) => <div key={item} className="rounded-lg border bg-background/80 p-2 text-sm">{item}</div>)}
            {summary.wellnessForecast.highRiskSegments.length > 0 && <p className="text-xs text-amber-600">High-risk segments: {summary.wellnessForecast.highRiskSegments.join(", ")}</p>}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Crew scheduling</CardTitle></CardHeader><CardContent className="space-y-2"><p className="text-2xl font-bold">{summary.crew.total}</p><p className="text-xs text-muted-foreground">{summary.crew.fatigued} fatigued · {money(summary.crew.dailyCost)}/day</p><Progress value={summary.crew.morale} className="h-2" /><p className="text-xs">Morale {Math.round(summary.crew.morale)}%</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Bus className="h-4 w-4" /> Vehicles & fuel</CardTitle></CardHeader><CardContent className="space-y-2"><p className="text-lg font-bold capitalize">{summary.vehicles.tier.split("_").join(" ")}</p><p className="text-xs text-muted-foreground">Capacity {summary.vehicles.capacity} · comfort {summary.vehicles.comfort}/7</p><Progress value={summary.vehicles.fuelLevel} className="h-2" /><p className="text-xs">Fuel {Math.round(summary.vehicles.fuelLevel)}% {summary.vehicles.repairsRequired ? "· repairs required" : ""}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Package className="h-4 w-4" /> Equipment transport</CardTitle></CardHeader><CardContent className="space-y-2"><p className="text-2xl font-bold">{summary.equipment.total}</p><p className="text-xs text-muted-foreground">{summary.equipment.inTransit} in transit · {summary.equipment.spares} spares</p><Badge variant={summary.equipment.capacityOk ? "default" : "destructive"}>{summary.equipment.loadWeight}kg load</Badge>{summary.equipment.needsRepair > 0 && <p className="text-xs text-destructive flex gap-1"><Wrench className="h-3 w-3" /> {summary.equipment.needsRepair} repair checks</p>}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Bed className="h-4 w-4" /> Accommodation</CardTitle></CardHeader><CardContent><p className="text-lg font-bold capitalize">{summary.accommodation.quality}</p><p className="text-xs text-muted-foreground">{summary.accommodation.roomsRequired} rooms · {money(summary.accommodation.nightlyCost)}/room</p><div className="mt-3 flex items-center gap-2 text-sm"><HeartPulse className="h-4 w-4" /> Health {Math.round(summary.health)}%</div></CardContent></Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Shirt className="h-4 w-4" /> Merchandise</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{summary.merchandise.stockRemaining} left</p><p className="text-xs text-muted-foreground">{summary.merchandise.sold} sold · {summary.merchandise.lostSales} lost sales</p><Progress value={summary.merchandise.sellThroughPct} className="mt-2 h-2" /></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4" /> Sponsors</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{summary.sponsorObligations.completed}/{summary.sponsorObligations.total}</p><p className="text-xs text-muted-foreground">{summary.sponsorObligations.ignored} ignored obligations</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Star className="h-4 w-4" /> Reputation & stats</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{Math.round(summary.tourReputation)} rep</p><p className="text-xs text-muted-foreground">{summary.stats.citiesVisited} cities · {summary.stats.distanceTravelledKm}km · {summary.stats.merchandiseSold} merch sold</p></CardContent></Card>
      </div>
    </div>
  );
}
