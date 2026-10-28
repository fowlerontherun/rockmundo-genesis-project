import { useEffect, useState } from 'react';
import { CalendarDays, History, Medal, Music2, ShieldCheck, Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

type LegacyCadence = 'daily' | 'weekly';
export type LegacyCycle = {
  cycle_id: string;
  starts_at: string;
  ends_at: string;
  target_total: number;
  earned_points: number;
  milestones: number[];
};
export type SceneLegacyResponse = {
  city_id: string;
  cadence: LegacyCadence;
  cycles: LegacyCycle[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const milestoneValues = [25, 50, 75, 100];
const isValidInstant = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));

export function isSceneLegacyResponse(
  value: unknown, cityId: string, cadence: LegacyCadence,
): value is SceneLegacyResponse {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<SceneLegacyResponse>;
  return data.city_id === cityId && data.cadence === cadence &&
    Array.isArray(data.cycles) && data.cycles.length <= 24 &&
    data.cycles.every((cycle) =>
      cycle && typeof cycle === 'object' &&
      typeof cycle.cycle_id === 'string' && UUID.test(cycle.cycle_id) &&
      isValidInstant(cycle.starts_at) && isValidInstant(cycle.ends_at) &&
      Date.parse(cycle.starts_at) < Date.parse(cycle.ends_at) &&
      Number.isInteger(cycle.target_total) && cycle.target_total > 0 &&
      Number.isInteger(cycle.earned_points) && cycle.earned_points >= 0 &&
      Array.isArray(cycle.milestones) &&
      cycle.milestones.every((n) => typeof n === 'number' && milestoneValues.includes(n)) &&
      new Set(cycle.milestones).size === cycle.milestones.length
    );
}

function cycleDate(value: string, cadence: LegacyCadence): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC', day: 'numeric', month: 'short',
    ...(cadence === 'weekly' ? { year: 'numeric' } : {}),
  }).format(date);
}

export function SceneLegacy({
  cityId, cityName, refresh,
}: {
  cityId: string; cityName: string; refresh: number;
}) {
  const [cadence, setCadence] = useState<LegacyCadence>('weekly');
  const [cycles, setCycles] = useState<LegacyCycle[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  useEffect(() => {
    let cancelled = false;
    setCycles([]);
    setStatus('loading');
    (async () => {
      try {
        const { data, error } = await (supabase as any).rpc('get_city_scene_legacy', {
          p_city_id: cityId, p_cadence: cadence, p_limit: 8,
        });
        if (error || !isSceneLegacyResponse(data, cityId, cadence)) {
          throw new Error('Scene history not available');
        }
        if (!cancelled) {
          setCycles(data.cycles);
          setStatus('ready');
        }
      } catch {
        if (!cancelled) setStatus('unavailable');
      }
    })();
    return () => { cancelled = true; };
  }, [cityId, cadence, refresh]);

  return (
    <section aria-label="Daily and weekly city scene history">
      <Card className="overflow-hidden border-sky-500/25">
        <CardHeader className="space-y-3 bg-gradient-to-br from-sky-500/10 via-violet-500/5 to-transparent">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/15 text-sky-500">
              <History className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-lg">Scene Legacy</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                A record of {cityName}'s verified daily and weekly community achievements.
              </p>
            </div>
          </div>
          <div role="group" aria-label="Choose scene history">
            <div className="inline-flex gap-1 rounded-lg border bg-background/60 p-1">
              {(['weekly', 'daily'] as const).map((value) => (
                <Button key={value} type="button" size="sm"
                  variant={cadence === value ? 'default' : 'ghost'}
                  aria-pressed={cadence === value}
                  onClick={() => setCadence(value)}
                  className="min-w-20 capitalize">
                  {value}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          {status === 'loading' ? (
            <p role="status" className="py-4 text-sm text-muted-foreground">
              Loading confirmed {cadence} scene history…
            </p>
          ) : status === 'unavailable' ? (
            <p role="status" className="py-4 text-sm text-muted-foreground">
              Historic challenge results are temporarily unavailable. Current scene goals still work.
            </p>
          ) : cycles.length === 0 ? (
            <div className="flex items-start gap-3 rounded-lg border border-dashed p-4">
              <CalendarDays className="h-6 w-6 shrink-0 text-sky-500" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">No finished {cadence} challenges to show yet</p>
                <p className="text-xs text-muted-foreground">
                  This archive fills automatically after completed challenges are verified by the game.
                  Nothing is counted here until the cycle is finalised.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {cycles.map((cycle) => {
                const complete = cycle.milestones.includes(100);
                const confirmed = Math.max(0, ...cycle.milestones);
                const progress = Math.min(100, Math.floor(cycle.earned_points / cycle.target_total * 100));
                return (
                  <article key={cycle.cycle_id} className="relative overflow-hidden rounded-xl border bg-card p-4">
                    <div className="absolute right-0 top-0 h-20 w-20 rounded-bl-[90px] bg-gradient-to-br from-sky-500/10 to-violet-500/10" aria-hidden="true" />
                    <div className="relative space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                            {cycleDate(cycle.starts_at, cadence)}
                            {cadence === 'weekly' ? ` – ${cycleDate(new Date(Date.parse(cycle.ends_at) - 1).toISOString(), cadence)}` : ''}
                          </p>
                          <h4 className="mt-1 text-sm font-bold">
                            {cadence === 'weekly' ? 'Community week' : 'Daily scene session'}
                          </h4>
                        </div>
                        {complete ? (
                          <Badge className="gap-1" variant="secondary">
                            <Trophy className="h-3.5 w-3.5" aria-hidden="true" /> Goal reached
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1">
                            <Medal className="h-3.5 w-3.5" aria-hidden="true" /> Archived
                          </Badge>
                        )}
                      </div>
                      <div>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Music2 className="h-3.5 w-3.5" aria-hidden="true" /> Verified scene points
                          </span>
                          <span className="text-sm font-bold tabular-nums">
                            {cycle.earned_points.toLocaleString()} / {cycle.target_total.toLocaleString()} SP
                          </span>
                        </div>
                        <Progress value={progress} aria-label="Archived scene challenge points" />
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <ShieldCheck className="h-3.5 w-3.5 text-sky-500" aria-hidden="true" />
                          Confirmed milestone: {confirmed}%
                        </span>
                        <span>UTC · {cadence}</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Results are city-wide aggregates. Corrected or revoked activity is reflected automatically;
            no individual players or source events are disclosed.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
