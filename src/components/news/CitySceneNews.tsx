import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Guitar, Music2, Newspaper, Sparkles } from 'lucide-react';
import { useActiveProfile } from '@/hooks/useActiveProfile';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { isScenePulse, type ScenePulseEntry } from '@/features/city-scene-challenges/ScenePulse';
import { citySceneGigBookingHref } from '@/features/city-scene-challenges/sceneCityGigLink';
import type { SceneCadence } from '@/features/city-scene-challenges/sceneRules';

export type SceneNewsCycle = {
  id: string;
  cadence: SceneCadence;
  starts_at: string;
  ends_at: string;
  target_total: number;
  earned_points: number;
  milestones: number[];
};
export type SceneNewsBoard = {
  city_id: string;
  city_name: string;
  cycles: SceneNewsCycle[];
};

const cadences: SceneCadence[] = ['daily', 'weekly', 'monthly'];
const milestoneValues = [25, 50, 75, 100];
const activityLabels: Record<string, string> = {
  'gig:verified_performance': 'live performance',
  'recording:completed': 'studio recording',
  'rehearsal:completed': 'band rehearsal',
  'jam:verified_collaboration': 'collaborative jam',
};

/** Strictly accept city-wide aggregates from the existing authenticated RPC. */
export function isSceneNewsBoard(value: unknown, cityId: string): value is SceneNewsBoard {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const board = value as Partial<SceneNewsBoard>;
  if (board.city_id !== cityId || typeof board.city_name !== 'string' ||
      !Array.isArray(board.cycles) || board.cycles.length > 6) return false;
  return board.cycles.every((cycle) =>
    cycle && typeof cycle.id === 'string' && cadences.includes(cycle.cadence) &&
    typeof cycle.starts_at === 'string' && Number.isFinite(Date.parse(cycle.starts_at)) &&
    typeof cycle.ends_at === 'string' && Number.isFinite(Date.parse(cycle.ends_at)) &&
    Date.parse(cycle.starts_at) < Date.parse(cycle.ends_at) &&
    Number.isSafeInteger(cycle.target_total) && cycle.target_total > 0 &&
    Number.isSafeInteger(cycle.earned_points) && cycle.earned_points >= 0 &&
    Array.isArray(cycle.milestones) &&
    cycle.milestones.every((milestone) => milestoneValues.includes(milestone))
  );
}

/** Stale responses must not continue advertising an expired cycle as active. */
export function activeSceneNewsCycles(board: SceneNewsBoard, nowMs: number): SceneNewsCycle[] {
  if (!Number.isFinite(nowMs)) return [];
  return cadences.flatMap((cadence) => {
    const candidate = board.cycles.find((cycle) =>
      cycle.cadence === cadence &&
      Date.parse(cycle.starts_at) <= nowMs && nowMs < Date.parse(cycle.ends_at));
    return candidate ? [candidate] : [];
  });
}

function storyText(entry: ScenePulseEntry): string | null {
  if (entry.kind === 'milestone' && milestoneValues.includes(entry.milestone_percent ?? -1)) {
    return 'Community milestone reached ' + entry.milestone_percent + '%';
  }
  const label = activityLabels[entry.action_type ?? ''];
  return entry.kind === 'activity' && label && typeof entry.actions === 'number'
    ? entry.actions + ' verified ' + label + ' contributions'
    : null;
}

function formatDay(day: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(day + 'T00:00:00Z'));
}

/**
 * A read-only newspaper summary. Never fetch raw contributions or profiles.
 * News can link to existing activities, but it does not award Scene Points.
 */
export function CitySceneNews() {
  const { profile } = useActiveProfile();
  const cityId = profile?.current_city_id ?? null;
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const update = () => setNowMs(Date.now());
    const timer = window.setInterval(update, 60_000);
    window.addEventListener('focus', update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', update);
    };
  }, []);

  const boardQuery = useQuery({
    queryKey: ['news-city-scene-board', cityId],
    enabled: Boolean(cityId),
    staleTime: 5 * 60_000,
    refetchInterval: 15 * 60_000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_city_scene_board', {
        p_city_id: cityId,
      });
      if (error || !isSceneNewsBoard(data, cityId!)) {
        throw new Error('City Scene bulletin unavailable');
      }
      return data as SceneNewsBoard;
    },
  });

  // Reuse the privacy-preserving, account-thresholded weekly Scene Pulse,
  // not individual events or player identities.
  const pulseQuery = useQuery({
    queryKey: ['news-city-scene-pulse', cityId],
    enabled: Boolean(cityId),
    staleTime: 5 * 60_000,
    refetchInterval: 15 * 60_000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_city_scene_pulse', {
        p_city_id: cityId, p_cadence: 'weekly', p_limit: 6,
      });
      if (error || !isScenePulse(data, cityId!, 'weekly')) {
        throw new Error('City Scene updates unavailable');
      }
      return data.entries as ScenePulseEntry[];
    },
  });

  const board = boardQuery.data;
  const current = board ? activeSceneNewsCycles(board, nowMs) : [];
  const stories = (pulseQuery.data ?? []).map((entry) => ({
    entry, headline: storyText(entry),
  })).filter((item): item is { entry: ScenePulseEntry; headline: string } => Boolean(item.headline)).slice(0, 3);

  return (
    <section aria-label="City Music Scene bulletin" className="space-y-3 rounded-md border border-foreground/40 bg-card/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-serif text-xl font-black">
          <Newspaper className="h-5 w-5" aria-hidden="true" /> City Music Scene
        </h3>
        {board && <span className="text-xs font-semibold text-muted-foreground">{board.city_name}</span>}
      </div>
      {!cityId ? (
        <p className="text-sm text-muted-foreground">Select a character with a current city to read its music scene bulletin.</p>
      ) : boardQuery.isPending ? (
        <p role="status" className="text-sm text-muted-foreground">Checking verified city scene progress…</p>
      ) : boardQuery.isError || !board ? (
        <p role="status" className="text-sm text-muted-foreground">City Scene standings are temporarily unavailable. No progress is assumed.</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Verified community challenges in {board.city_name}. The game confirms progress after completed activities, not bookings or page visits.
          </p>
          {current.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active scene challenge has been confirmed for this city yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {current.map((cycle) => {
                const percent = Math.min(100, Math.floor(cycle.earned_points / cycle.target_total * 100));
                return (
                  <div key={cycle.id} className="space-y-2 rounded-md border border-border/50 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide">{cycle.cadence} challenge</p>
                    <p className="text-sm font-semibold tabular-nums">{cycle.earned_points} / {cycle.target_total} Scene Points</p>
                    <Progress value={percent} aria-label={cycle.cadence + ' verified city scene progress'} />
                    {cycle.cadence === 'monthly' && (
                      <p className="text-xs text-muted-foreground">
                        {cycle.milestones.length ? 'Poster stage confirmed: ' + Math.max(...cycle.milestones) + '%' : 'Poster not yet unlocked'}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {pulseQuery.isPending ? (
            <p role="status" className="text-xs text-muted-foreground">Checking community highlights…</p>
          ) : pulseQuery.isError ? (
            <p role="status" className="text-xs text-muted-foreground">Community highlights are temporarily unavailable.</p>
          ) : stories.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No shareable verified activity highlights yet. Activity categories only appear after at least three different accounts contribute on the same UTC day.
            </p>
          ) : (
            <div className="space-y-2" aria-label="Verified city scene highlights">
              {stories.map(({ entry, headline }, index) => (
                <div key={entry.day_utc + ':' + entry.kind + ':' + index} className="flex items-center gap-2 text-sm">
                  <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="flex-1">{headline}</span>
                  <span className="text-xs text-muted-foreground">{formatDay(entry.day_utc)} UTC</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" asChild><Link to={'/cities/' + board.city_id + '/scene-challenges'}>
              <Music2 className="mr-2 h-4 w-4" aria-hidden="true" /> View city challenges
            </Link></Button>
            <Button size="sm" variant="outline" asChild><Link to={citySceneGigBookingHref(board.city_id)}>
              <Guitar className="mr-2 h-4 w-4" aria-hidden="true" /> Explore city venues
            </Link></Button>
          </div>
        </>
      )}
    </section>
  );
}
