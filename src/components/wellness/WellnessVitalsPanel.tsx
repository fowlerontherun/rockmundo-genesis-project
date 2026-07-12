import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Heart, Battery, Smile, Activity, Bed, Salad, Dumbbell, Sparkles, Flame, Lock } from "lucide-react";
import type { WellnessVitals as Vitals } from "@/lib/api/wellnessActivities";
import { calculateOverallWellness, getWellnessState, getWellnessWarnings, isWellnessStatUnlocked, WELLNESS_BALANCE, type WellnessCoreValues, type WellnessStatKey } from "@/lib/wellnessSystem";
import { wellnessVitalsToCore } from "@/lib/api/wellnessActivities";

const statMeta: { key: WellnessStatKey; label: string; icon: React.ReactNode; impact: string; invert?: boolean }[] = [
  { key: "energy", label: "Energy", icon: <Battery className="h-4 w-4" />, impact: "Stage energy, travel stamina and session consistency." },
  { key: "physical_health", label: "Physical health", icon: <Heart className="h-4 w-4" />, impact: "Baseline availability and condition recovery." },
  { key: "happiness", label: "Happiness", icon: <Smile className="h-4 w-4" />, impact: "Mood, relationship resilience and motivation." },
  { key: "stress", label: "Stress", icon: <Activity className="h-4 w-4" />, impact: "Mistake risk and burnout pressure.", invert: true },
  { key: "fatigue", label: "Fatigue", icon: <Flame className="h-4 w-4" />, impact: "Long rehearsals, tours and setlist stamina.", invert: true },
  { key: "sleep_quality", label: "Sleep quality", icon: <Bed className="h-4 w-4" />, impact: "Daily recovery and illness progress." },
  { key: "nutrition", label: "Nutrition", icon: <Salad className="h-4 w-4" />, impact: "Energy stability and recovery quality." },
  { key: "fitness", label: "Fitness", icon: <Dumbbell className="h-4 w-4" />, impact: "Tour resilience and demanding performance prep." },
  { key: "motivation", label: "Motivation", icon: <Sparkles className="h-4 w-4" />, impact: "Songwriting, practice focus and studio productivity." },
  { key: "burnout_risk", label: "Burnout risk", icon: <Flame className="h-4 w-4" />, impact: "Long-term availability and demanding activity blocks.", invert: true },
];

const labelForValue = (value: number, invert?: boolean) => {
  const effective = invert ? 100 - value : value;
  return getWellnessState(effective);
};

export const WellnessVitalsPanel = ({ vitals, fame = 0 }: { vitals: Vitals | null; fame?: number }) => {
  const core: WellnessCoreValues = vitals ? wellnessVitalsToCore(vitals) : wellnessVitalsToCore({ health: 80, energy: 80, mood: 72, stress: 28 });
  const overall = vitals?.overall_wellness ?? calculateOverallWellness(core);
  const state = getWellnessState(overall);
  const warnings = getWellnessWarnings(core);
  const warning = warnings[0];

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <CardDescription>Wellness command centre</CardDescription>
              <CardTitle className="mt-1 text-3xl">{overall}/100 · {state}</CardTitle>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                {warning ? warning.impact : "You are ready for rehearsals, recording, gigs and travel. Keep recovery scheduled around demanding work."}
              </p>
            </div>
            <Badge variant={state === "Critical" || state === "Struggling" ? "destructive" : "secondary"} className="w-fit">Recent trend: stable</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={overall} aria-label={`Overall wellness ${overall} out of 100`} />
          <Alert className={warning ? "border-amber-500/40 bg-amber-500/5" : "border-emerald-500/40 bg-emerald-500/5"}>
            <AlertTitle>{warning ? warning.label : "Recommended action: maintain rhythm"}</AlertTitle>
            <AlertDescription>{warning ? `${warning.impact} Suggested action: ${warning.action}` : "Book recovery before intense touring or studio runs to protect performance consistency."}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {statMeta.map((meta) => {
          const unlocked = isWellnessStatUnlocked(meta.key, fame);
          const value = meta.key === "overall_wellness" ? overall : core[meta.key as keyof WellnessCoreValues];
          const tier = WELLNESS_BALANCE.tiers.find((t) => t.stats.includes(meta.key));
          return (
            <Card key={meta.key} className={!unlocked ? "border-dashed opacity-80" : undefined}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-semibold">{meta.icon}{meta.label}</span>
                  {!unlocked ? <Lock className="h-4 w-4 text-muted-foreground" /> : <Badge variant="outline">{labelForValue(value, meta.invert)}</Badge>}
                </div>
                {unlocked ? (
                  <>
                    <div className="text-2xl font-bold tabular-nums">{value}<span className="text-xs text-muted-foreground">/100</span></div>
                    <Progress value={meta.invert ? 100 - value : value} aria-label={`${meta.label} ${value} out of 100`} />
                    <p className="text-xs text-muted-foreground">{meta.impact}</p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Unlocks at {tier?.label ?? "a later tier"}: {tier?.description}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default WellnessVitalsPanel;
