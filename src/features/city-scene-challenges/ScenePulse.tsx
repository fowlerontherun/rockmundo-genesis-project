import { useEffect, useState } from 'react';
import { Disc3, Guitar, Megaphone, Music2, Sparkles, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SceneCadence } from './sceneRules';

export type ScenePulseEntry = {
  day_utc: string;
  kind: 'activity' | 'milestone';
  action_type: string | null;
  actions: number | null;
  milestone_percent: number | null;
};
export type ScenePulseResponse = {
  city_id: string;
  cadence: SceneCadence;
  entries: ScenePulseEntry[];
};

const sourceLabels: Record<string, { label: string; icon: typeof Music2 }> = {
  'gig:verified_performance': { label: 'live performance', icon: Guitar },
  'recording:completed': { label: 'studio recording', icon: Disc3 },
  'rehearsal:completed': { label: 'band rehearsal', icon: Music2 },
  'jam:verified_collaboration': { label: 'collaborative jam', icon: Users },
};
const milestoneValues = [25, 50, 75, 100];

export function isScenePulse(value: unknown, cityId: string, cadence: SceneCadence): value is ScenePulseResponse {
  if (!value || typeof value !== 'object') return false;
  const response = value as Partial<ScenePulseResponse>;
  if (response.city_id !== cityId || response.cadence !== cadence || !Array.isArray(response.entries)) {
    return false;
  }
  return response.entries.length <= 20 && response.entries.every((entry) => {
    if (!entry || typeof entry !== 'object' ||
        typeof entry.day_utc !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(entry.day_utc) ||
        !Number.isFinite(Date.parse(entry.day_utc + 'T00:00:00Z'))) {
      return false;
    }
    if (entry.kind === 'milestone') {
      return entry.action_type === null && entry.actions === null &&
        milestoneValues.includes(entry.milestone_percent ?? -1);
    }
    return entry.kind === 'activity' &&
      typeof entry.action_type === 'string' &&
      Object.prototype.hasOwnProperty.call(sourceLabels, entry.action_type) &&
      Number.isInteger(entry.actions) && (entry.actions ?? 0) >= 3 &&
      entry.milestone_percent === null;
  });
}

function shortDate(day: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC', day: 'numeric', month: 'short',
  }).format(new Date(day + 'T00:00:00Z'));
}

/**
 * A read-only view of server-confirmed, city-level activity.
 * No individual contributor names, avatars, source IDs or exact event times.
 */
export function ScenePulse({
  cityId, cadence, refresh,
}: {
  cityId: string;
  cadence: SceneCadence;
  refresh: number;
}) {
  const [entries, setEntries] = useState<ScenePulseEntry[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  useEffect(() => {
    let cancelled = false;
    setEntries([]);
    setState('loading');
    (async () => {
      try {
        const response = await (supabase as any).rpc('get_city_scene_pulse', {
          p_city_id: cityId,
          p_cadence: cadence,
          p_limit: 12,
        });
        if (response.error || !isScenePulse(response.data, cityId, cadence)) {
          throw new Error('City Scene Pulse unavailable');
        }
        if (!cancelled) {
          setEntries(response.data.entries);
          setState('ready');
        }
      } catch {
        if (!cancelled) setState('unavailable');
      }
    })();
    return () => { cancelled = true; };
  }, [cityId, cadence, refresh]);

  return (
    <section aria-label="Verified city music scene updates">
      <Card className="overflow-hidden border-purple-500/25">
        <CardHeader className="border-b border-border/50 bg-gradient-to-r from-purple-950/30 to-transparent">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Megaphone aria-hidden="true" className="h-5 w-5 text-purple-500" />
            Scene Pulse
            <Badge variant="outline" className="ml-auto capitalize">{cadence}</Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Real community activity, verified by the game. Updates are shared without naming individual players.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {state === 'loading' ? (
            <p role="status" className="px-4 py-6 text-sm text-muted-foreground">Checking verified scene updates…</p>
          ) : state === 'unavailable' ? (
            <p role="status" className="px-4 py-6 text-sm text-muted-foreground">
              Community updates are temporarily unavailable. Challenge progress remains visible above.
            </p>
          ) : entries.length === 0 ? (
            <div className="flex items-start gap-3 px-4 py-6">
              <Music2 aria-hidden="true" className="h-6 w-6 shrink-0 text-purple-500" />
              <div>
                <p className="text-sm font-semibold">The scene is warming up</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Milestones appear once unlocked. Activity updates appear only when at least three separate accounts contribute to the same music activity on a UTC day.
                </p>
              </div>
            </div>
          ) : (
            <ol className="divide-y divide-border/50">
              {entries.map((entry, index) => {
                const milestone = entry.kind === 'milestone';
                const source = sourceLabels[entry.action_type ?? ''];
                const EntryIcon = milestone ? Sparkles : (source?.icon ?? Music2);
                return (
                  <li key={`${entry.day_utc}:${entry.kind}:${entry.action_type ?? entry.milestone_percent}:${index}`}
                    className="flex items-center gap-3 px-4 py-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${milestone ? 'bg-amber-500/15 text-amber-500' : 'bg-purple-500/10 text-purple-500'}`}>
                      <EntryIcon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">
                        {milestone
                          ? `City poster reached ${entry.milestone_percent}%`
                          : `${entry.actions} verified ${source?.label ?? 'music activity'} contributions`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {milestone ? 'Community milestone unlocked' : 'Contributions from multiple local musicians'}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {shortDate(entry.day_utc)}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
