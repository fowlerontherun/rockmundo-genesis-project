import { useEffect, useState } from 'react';
import { CalendarDays, Images, Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScenePoster } from './ScenePoster';

type ArchivedPoster = {
  cycle_id: string;
  month_start: string;
  art_version: number;
  theme_slug: string | null;
  target_total: number;
  earned_points: number;
  milestones: number[];
};
export type CityScenePosterArchive = {
  city_id: string;
  posters: ArchivedPoster[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STAGES = [25, 50, 75, 100];
export function isCityScenePosterArchive(value: unknown, cityId: string): value is CityScenePosterArchive {
  if (!value || typeof value !== 'object') return false;
  const response = value as Partial<CityScenePosterArchive>;
  return response.city_id === cityId && Array.isArray(response.posters) &&
    response.posters.length <= 24 && response.posters.every((poster) => {
      if (!poster || typeof poster !== 'object') return false;
      const date = Date.parse(poster.month_start);
      return typeof poster.cycle_id === 'string' && UUID.test(poster.cycle_id) &&
        typeof poster.month_start === 'string' && Number.isFinite(date) &&
        new Date(date).getUTCDate() === 1 &&
        (poster.theme_slug === null || typeof poster.theme_slug === 'string') &&
        Number.isInteger(poster.art_version) && poster.art_version >= 1 &&
        Number.isInteger(poster.target_total) && poster.target_total > 0 &&
        Number.isInteger(poster.earned_points) && poster.earned_points >= 0 &&
        Array.isArray(poster.milestones) &&
        poster.milestones.every((percent) => STAGES.includes(percent)) &&
        new Set(poster.milestones).size === poster.milestones.length;
    });
}

const monthLabel = (value: string): string =>
  new Intl.DateTimeFormat('en-GB', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(value));

/**
 * Historic poster wall: only server-persisted, non-revoked mural milestone
 * stages appear. Empty history is not a claim of poor community participation.
 */
export function ScenePosterArchive({
  cityId, cityName, refresh,
}: { cityId: string; cityName: string; refresh: number }) {
  const [archive, setArchive] = useState<CityScenePosterArchive | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  useEffect(() => {
    let cancelled = false;
    setArchive(null);
    setState('loading');
    (async () => {
      try {
        const result = await (supabase as any).rpc('get_city_scene_poster_archive', {
          p_city_id: cityId, p_limit: 12,
        });
        if (result.error || !isCityScenePosterArchive(result.data, cityId)) {
          throw new Error('Poster archive unavailable');
        }
        if (!cancelled) {
          setArchive(result.data);
          setState('ready');
        }
      } catch {
        if (!cancelled) setState('unavailable');
      }
    })();
    return () => { cancelled = true; };
  }, [cityId, refresh]);

  return (
    <section aria-label="Monthly City Scene poster archive">
      <Card className="overflow-hidden border-violet-500/25">
        <CardContent className="p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500">
              <Images className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-bold">City Scene Poster Wall</h3>
              <p className="text-xs text-muted-foreground">
                Previous months become part of {cityName}'s permanent music history.
              </p>
            </div>
            {archive && <Badge variant="outline">{archive.posters.length} archived</Badge>}
          </div>

          {state === 'loading' ? (
            <p role="status" className="text-sm text-muted-foreground">Loading the poster wall…</p>
          ) : state === 'unavailable' ? (
            <p role="status" className="text-sm text-muted-foreground">
              Historic posters are temporarily unavailable. Current challenges still work.
            </p>
          ) : archive && archive.posters.length > 0 ? (
            <details className="group">
              <summary className="cursor-pointer select-none rounded-lg border bg-muted/20 px-3 py-3 text-sm font-semibold hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                Explore {archive.posters.length} {archive.posters.length === 1 ? 'archived community poster' : 'archived community posters'}
                <span className="ml-2 text-xs text-muted-foreground">(expand gallery)</span>
              </summary>
              <div className="mt-4 grid gap-5 lg:grid-cols-2">
                {archive.posters.map((poster) => {
                  const completed = poster.milestones.includes(100);
                  return (
                    <div key={poster.cycle_id} className="min-w-0 space-y-2">
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                          {monthLabel(poster.month_start)}
                        </span>
                        {completed ? (
                          <Badge variant="secondary"><Trophy className="mr-1 h-3 w-3" /> Full reveal</Badge>
                        ) : <Badge variant="outline">Archived</Badge>}
                      </div>
                      <ScenePoster
                        cityName={cityName}
                        campaignTitle="Live Music Revival"
                        monthLabel={monthLabel(poster.month_start)}
                        earnedPoints={poster.earned_points}
                        targetPoints={poster.target_total}
                        unlockedMilestones={poster.milestones}
                        archived
                      />
                    </div>
                  );
                })}
              </div>
            </details>
          ) : (
            <div className="flex items-start gap-3 rounded-lg border border-dashed p-4">
              <CalendarDays className="h-6 w-6 shrink-0 text-violet-500" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">The poster wall is ready for its first chapter</p>
                <p className="text-xs text-muted-foreground">
                  Once the first full monthly campaign ends, its confirmed mural stages will be saved here. Monthly challenges begin in November 2026.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
