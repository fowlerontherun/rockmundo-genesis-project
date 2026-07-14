import { CalendarDays, Gauge, Plane, RotateCcw, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { WellnessVitals } from "@/lib/api/wellnessActivities";
import { buildRecommendedItinerary, calculateCareerMomentum, calculateCareerSustainability, forecastTimeAway, TIME_AWAY_TYPES } from "@/lib/timeAwayWellness";

const money = (cents: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);

export function TimeAwayLongevityPanel({ vitals, fame = 0 }: { vitals: WellnessVitals | null; fame?: number }) {
  const core = vitals ?? { energy: 72, physical_health: 75, happiness: 68, stress: 34, fatigue: 38, sleep_quality: 70, nutrition: 65, fitness: 55, motivation: 70, burnout_risk: 22 };
  const staycation = forecastTimeAway({ type: "staycation", startDate: "2026-07-13", endDate: "2026-07-16", focus: "sleep_reset", vitals: core, fame, accommodation: { kind: "home", tier: "standard", isHomeCity: true, upgrades: ["routine"] } });
  const retreat = forecastTimeAway({ type: "wellness_retreat", startDate: "2026-07-20", endDate: "2026-07-24", focus: "burnout_recovery", vitals: core, fame: Math.max(fame, 1000), accommodation: { kind: "hotel", tier: "specialist", quality: 78, pricePerNightCents: 14000, upgrades: ["wellness_facilities", "included_meals"] } });
  const momentum = calculateCareerMomentum({ recentGigs: 3, recentReleases: 1, mediaActivity: 2, fanEngagement: fame / 20, tourDays: 4, inactivityDays: staycation.days });
  const sustainability = calculateCareerSustainability({ gigs: 7, tourDays: 12, travelHours: 32, recordingHours: 18, rehearsalHours: 22, practiceHours: 20, restDays: 4, holidays: 2, activeConditionDays: 1, burnoutDays: core.burnout_risk > 70 ? 8 : 1, averageSleep: (core.sleep_quality ?? 70) / 10, averageRecoveryQuality: 62, windowDays: 90 });
  const itinerary = buildRecommendedItinerary("staycation", "sleep_reset", 3);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4 text-primary" /> Time Away & Longevity
          <Badge variant="outline">Server forecast model</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">Holidays, retreats, career breaks and sabbaticals trade short-term activity for capped recovery and long-term consistency.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border p-3">
            <p className="flex items-center gap-1 text-xs text-muted-foreground"><ShieldCheck className="h-3 w-3" /> Affordable path</p>
            <p className="font-semibold">{TIME_AWAY_TYPES.staycation.label}</p>
            <p className="text-sm">{money(staycation.totalCostCents)} · burnout {staycation.wellness.burnout_risk}/100 · readiness {staycation.returnReadiness.score}%</p>
            <p className="text-xs text-muted-foreground">Home recovery stays competitive for sleep and stress without travel fatigue.</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="flex items-center gap-1 text-xs text-muted-foreground"><Plane className="h-3 w-3" /> Premium structured path</p>
            <p className="font-semibold">{TIME_AWAY_TYPES.wellness_retreat.label}</p>
            <p className="text-sm">{money(retreat.totalCostCents)} · stress {retreat.wellness.stress}/100 · capped support</p>
            <p className="text-xs text-muted-foreground">Retreats optimise recovery modestly; severe burnout still needs sustained low workload.</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="flex items-center gap-1 text-xs text-muted-foreground"><Gauge className="h-3 w-3" /> Career sustainability</p>
            <p className="font-semibold capitalize">{sustainability.state.split("_").join(" ")}</p>
            <p className="text-sm">Score {sustainability.score}/100 · risk: {sustainability.mainRiskFactor}</p>
            <p className="text-xs text-muted-foreground">Protective factor: {sustainability.mainProtectiveFactor}; missing history is legacy-safe.</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="flex items-center gap-1 text-xs text-muted-foreground"><RotateCcw className="h-3 w-3" /> Return plan</p>
            <p className="font-semibold capitalize">{staycation.returnReadiness.state.split("_").join(" ")}</p>
            <p className="text-sm">Momentum {momentum.state} · fame protected</p>
            <p className="text-xs text-muted-foreground">{staycation.returnReadiness.recommendation}</p>
          </div>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-sm font-medium">Recommended recovery itinerary preview</p>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            {itinerary.map((day) => (
              <div key={day.day} className="rounded-md bg-muted/50 p-2 text-xs">
                <span className="font-medium">Day {day.day}</span>: {day.activities.join(" · ")}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Itineraries schedule eligible activities through the scheduler; they do not directly grant duplicate rewards.</p>
        </div>
      </CardContent>
    </Card>
  );
}
