import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Bed, CalendarClock, Flame, Moon, PartyPopper, ShieldCheck, type LucideIcon } from "lucide-react";
import type { LifestyleProfile } from "@/lib/wellnessLifestyle";

interface Props { lifestyle: LifestyleProfile | null; fame: number; }
const bandTone = (state?: string) => state === "Unsustainable" || state === "Exhausting" ? "destructive" : state === "Busy" || state === "Unstable" ? "secondary" : "default";
const routineMetrics: Array<[string, keyof LifestyleProfile, LucideIcon]> = [
  ["Sleep consistency", "sleep_consistency", Bed],
  ["Workload balance", "activity_balance", CalendarClock],
  ["Recovery discipline", "recovery_discipline", Moon],
  ["Social activity", "social_activity", PartyPopper],
  ["Burnout pressure", "burnout_pressure", Flame],
  ["Routine stability", "routine_stability", ShieldCheck],
];

export function LifestyleRoutinePanel({ lifestyle, fame }: Props) {
  if (!lifestyle) return null;
  const assistedLocked = fame < 1000;
  const managedLocked = fame < 10000;
  return (
    <section className="space-y-4" aria-labelledby="lifestyle-routine-heading">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Lifestyle & Routine</p>
        <h2 id="lifestyle-routine-heading" className="text-xl font-semibold">Long-term habits</h2>
        <p className="text-sm text-muted-foreground">Server-calculated trends use rolling 24-hour, 7-day and 28-day aggregates so one late night does not define your character.</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" /> {lifestyle.identity}
              <Badge variant={bandTone(lifestyle.state) as any}>{lifestyle.state}</Badge>
              <Badge variant="outline">{lifestyle.burnout_stage}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {routineMetrics.map(([label, key, Icon]) => {
              const value = Number(lifestyle[key] ?? 0);
              return (
              <div key={label} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between gap-2 text-sm"><span className="inline-flex items-center gap-1"><Icon className="h-3.5 w-3.5" />{label}</span><span>{value}/100</span></div>
                <Progress value={value} aria-label={`${label} ${value}/100`} />
              </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Sleep discipline</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Current sleep debt</p><p className="text-2xl font-semibold">{lifestyle.sleep_debt}/100</p><p className="text-xs text-muted-foreground">Recovery is capped per day; one long sleep cannot erase a month of debt.</p></div>
            <Alert><AlertTitle>Primary recommendation</AlertTitle><AlertDescription>{lifestyle.recommendation}</AlertDescription></Alert>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Weekly routine</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Plan sleep, meals, hydration, exercise, social evenings, pre-gig prep and post-gig recovery through existing schedule blocks.</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm">Add routine</Button><Button variant="outline" size="sm">Edit priorities</Button>
              <Button variant="outline" size="sm">Review conflicts</Button><Button variant="outline" size="sm">Expected costs</Button>
            </div>
            <p className="text-xs text-muted-foreground">Guided mode recommends gaps; assisted and managed automation are gated by progression and support staff.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Automation modes</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Badge>Manual</Badge> <Badge variant="secondary">Guided</Badge> <Badge variant={assistedLocked ? "outline" : "secondary"}>Assisted{assistedLocked ? " · Tier 3" : ""}</Badge> <Badge variant={managedLocked ? "outline" : "secondary"}>Managed{managedLocked ? " · Tier 4" : ""}</Badge>
            <p className="text-xs text-muted-foreground">Automation never cancels gigs, rehearsals, recording, travel or band commitments. It skips or reschedules routines and records the reason.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Lifestyle traits</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {lifestyle.traits.slice(0, 4).map((trait) => <div key={trait.slug} className="rounded-md border p-2 text-sm"><div className="flex items-center justify-between"><span className="font-medium">{trait.name}</span><Badge variant={trait.active ? "default" : "outline"}>{trait.progress}%</Badge></div><p className="text-xs text-muted-foreground">Benefit: {trait.benefit} Trade-off: {trait.tradeoff}</p></div>)}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
