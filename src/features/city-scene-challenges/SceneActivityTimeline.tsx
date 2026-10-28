import { CalendarDays, Disc3, Guitar, Music2, Trophy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { SceneCadence } from './sceneRules';

/** Only fields explicitly disclosed by the owner-scoped activity RPC. */
export type SceneActivityCredit = {
  cycle_id: string;
  cadence: SceneCadence;
  action_type: string;
  points: number;
  completed_at: string;
};

const activityNames: Record<string, { label: string; icon: typeof Music2 }> = {
  'gig:verified_performance': { label: 'Completed live performance', icon: Guitar },
  'recording:completed': { label: 'Completed recording session', icon: Disc3 },
  'rehearsal:completed': { label: 'Completed band rehearsal', icon: Music2 },
  'jam:verified_collaboration': { label: 'Verified collaborative jam', icon: Music2 },
};

export function isSceneActivityCredits(value: unknown): value is SceneActivityCredit[] {
  return Array.isArray(value) && value.every((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const credit = entry as Partial<SceneActivityCredit>;
    return typeof credit.cycle_id === 'string'
      && ['daily', 'weekly', 'monthly'].includes(credit.cadence ?? '')
      && typeof credit.action_type === 'string'
      && typeof credit.completed_at === 'string'
      && typeof credit.points === 'number'
      && Number.isInteger(credit.points) && credit.points >= 1 && credit.points <= 5
      && Number.isFinite(Date.parse(credit.completed_at));
  });
}

function creditTime(date: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date)) + ' UTC';
}

export function SceneActivityTimeline({ credits }: { credits: SceneActivityCredit[] | null }) {
  return (
    <section aria-label="Your verified city scene contributions" className="space-y-3">
      <div>
        <h3 className="text-xl font-bold">Your contribution history</h3>
        <p className="text-sm text-muted-foreground">
          A record of scene points credited from completed, verified activities.
        </p>
      </div>

      {credits === null ? (
        <Card className="border-dashed"><CardContent className="py-5 text-sm text-muted-foreground" role="status">
          Your activity history is temporarily unavailable. Shared city progress is unaffected.
        </CardContent></Card>
      ) : credits.length === 0 ? (
        <Card className="border-dashed"><CardContent className="flex items-start gap-3 py-5">
          <CalendarDays aria-hidden="true" className="h-6 w-6 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-semibold">No verified scene credits yet</p>
            <p className="text-sm text-muted-foreground">
              Finish a qualifying gig, recording or rehearsal. Points appear after the server verifies completion.
            </p>
          </div>
        </CardContent></Card>
      ) : (
        <Card><CardContent className="divide-y divide-border/60 p-0">
          {credits.slice(0, 8).map((credit, index) => {
            const activity = activityNames[credit.action_type];
            const ActivityIcon = activity?.icon ?? Trophy;
            return (
              <div key={`${credit.cycle_id}:${credit.completed_at}:${index}`} className="flex items-center gap-3 p-3 sm:p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ActivityIcon aria-hidden="true" className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{activity?.label ?? 'Verified music activity'}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="capitalize">{credit.cadence}</Badge>
                    <span className="text-xs text-muted-foreground">{creditTime(credit.completed_at)}</span>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-bold tabular-nums text-primary">+{credit.points} SP</span>
              </div>
            );
          })}
        </CardContent></Card>
      )}
      <p className="text-xs text-muted-foreground">
        One verified activity may help multiple daily, weekly and monthly goals. Scene points are community progress, not spendable currency or XP.
      </p>
    </section>
  );
}
