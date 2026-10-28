import { useCallback, useEffect, useState } from 'react';
import { Guitar, ShieldCheck, Trophy, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { SceneCadence } from './sceneRules';

type BandResult = {
  rank: number;
  band_name: string;
  points: number;
  verified_events: number;
};
type MyBand = { band_id: string; band_name: string; enabled: boolean };
export type SceneBandSupportersResponse = {
  city_id: string;
  cadence: SceneCadence;
  entries: BandResult[];
  my_bands: MyBand[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isSceneBandSupporters(
  value: unknown, cityId: string, cadence: SceneCadence,
): value is SceneBandSupportersResponse {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<SceneBandSupportersResponse>;
  return data.city_id === cityId && data.cadence === cadence &&
    Array.isArray(data.entries) && data.entries.length <= 20 &&
    Array.isArray(data.my_bands) && data.my_bands.length <= 20 &&
    data.entries.every((entry, i) => entry && typeof entry === 'object' &&
      entry.rank === i + 1 && typeof entry.band_name === 'string' &&
      entry.band_name.length > 0 && entry.band_name.length <= 200 &&
      Number.isInteger(entry.points) && entry.points > 0 &&
      Number.isInteger(entry.verified_events) && entry.verified_events > 0) &&
    data.my_bands.every((band) => band && typeof band === 'object' &&
      typeof band.band_id === 'string' && UUID.test(band.band_id) &&
      typeof band.band_name === 'string' && band.band_name.length > 0 &&
      band.band_name.length <= 200 && typeof band.enabled === 'boolean');
}

export function SceneBandSupporters({
  cityId, cadence, refresh,
}: { cityId: string; cadence: SceneCadence; refresh: number }) {
  const [data, setData] = useState<SceneBandSupportersResponse | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [savingBand, setSavingBand] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setData(null);
    setMessage(null);
    (async () => {
      try {
        const result = await (supabase as any).rpc('get_city_scene_band_supporters', {
          p_city_id: cityId, p_cadence: cadence, p_limit: 10,
        });
        if (result.error || !isSceneBandSupporters(result.data, cityId, cadence)) {
          throw new Error('Band supporters unavailable');
        }
        if (!cancelled) {
          setData(result.data);
          setStatus('ready');
        }
      } catch {
        if (!cancelled) setStatus('unavailable');
      }
    })();
    return () => { cancelled = true; };
  }, [cityId, cadence, refresh, revision]);

  const toggleBand = useCallback(async (band: MyBand) => {
    if (savingBand || !data || !data.my_bands.some((item) => item.band_id === band.band_id)) return;
    setSavingBand(band.band_id);
    setMessage(null);
    try {
      const expected = !band.enabled;
      const result = await (supabase as any).rpc('set_my_scene_band_leaderboard_opt_in', {
        p_city_id: cityId, p_band_id: band.band_id, p_enabled: expected,
      });
      if (result.error || result.data !== expected) {
        throw new Error('Unable to save band leaderboard visibility');
      }
      setRevision((n) => n + 1);
    } catch {
      setMessage('Could not update band leaderboard visibility. Check you are still the band leader and retry.');
    } finally {
      setSavingBand(null);
    }
  }, [cityId, data, savingBand]);

  const maxPoints = data?.entries[0]?.points ?? 1;

  return (
    <section aria-label="City Scene band supporters">
      <Card className="overflow-hidden border-fuchsia-500/25">
        <CardHeader className="border-b border-border/50 bg-gradient-to-r from-fuchsia-700/15 to-transparent">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Guitar className="h-5 w-5 text-fuchsia-500" aria-hidden="true" />
            Bands Building the Scene
            <Badge className="ml-auto capitalize" variant="outline">{cadence}</Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Verified band contributions. Only bands whose current leaders opt in appear by name.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          {status === 'loading' ? (
            <p role="status" className="text-sm text-muted-foreground">Loading participating bands…</p>
          ) : status === 'unavailable' || !data ? (
            <p role="status" className="text-sm text-muted-foreground">
              Band rankings are temporarily unavailable. Verified scene points still count.
            </p>
          ) : (
            <>
              {data.entries.length ? (
                <ol className="space-y-3">
                  {data.entries.map((entry) => (
                    <li key={entry.rank} className="rounded-lg border border-border/60 p-3">
                      <div className="mb-2 flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fuchsia-500/10 font-bold text-fuchsia-600">
                          {entry.rank === 1 ? <Trophy className="h-5 w-5" aria-label="Top band" /> : `#${entry.rank}`}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{entry.band_name}</span>
                        <span className="text-sm font-bold tabular-nums">{entry.points} SP</span>
                      </div>
                      <Progress value={Math.min(100, entry.points / maxPoints * 100)} aria-label={`Band rank ${entry.rank} scene points`} />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {entry.verified_events} verified {entry.verified_events === 1 ? 'music event' : 'music events'}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="flex items-start gap-3 rounded-lg border border-dashed p-4">
                  <Users className="h-6 w-6 shrink-0 text-fuchsia-500" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold">Waiting for the first band supporter</p>
                    <p className="text-xs text-muted-foreground">
                      Band leaders can opt in once their band has verified scene activity. Unlisted bands still help the city.
                    </p>
                  </div>
                </div>
              )}
              {data.my_bands.length > 0 && (
                <div className="space-y-3 border-t pt-3">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                    Manage bands you lead
                  </div>
                  {data.my_bands.map((band) => (
                    <div key={band.band_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/30 p-3">
                      <div>
                        <p className="text-sm font-medium">{band.band_name}</p>
                        <p className="text-xs text-muted-foreground">{band.enabled ? 'Publicly ranked while eligible' : 'Not publicly ranked'}</p>
                      </div>
                      <Button size="sm" variant="outline" disabled={savingBand !== null}
                        onClick={() => void toggleBand(band)}>
                        {savingBand === band.band_id ? 'Saving…' : band.enabled ? 'Leave band rankings' : 'Join band rankings'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {message && <p role="alert" className="text-xs text-destructive">{message}</p>}
              <p className="text-xs text-muted-foreground">
                Band totals come from verified contributions, not purchases. Individual band members are never listed here.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
