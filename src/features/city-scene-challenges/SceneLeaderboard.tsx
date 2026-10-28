import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, ShieldCheck, Trophy, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { SceneCadence } from './sceneRules';

export type SceneLeaderboardEntry = {
  rank: number;
  display_name: string;
  points: number;
  verified_actions: number;
  is_me: boolean;
};
export type SceneLeaderboardData = {
  city_id: string;
  cadence: SceneCadence;
  my_opted_in: boolean;
  entries: SceneLeaderboardEntry[];
};

export function isSceneLeaderboard(
  value: unknown, cityId: string, cadence: SceneCadence,
): value is SceneLeaderboardData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<SceneLeaderboardData>;
  return data.city_id === cityId && data.cadence === cadence &&
    typeof data.my_opted_in === 'boolean' && Array.isArray(data.entries) &&
    data.entries.length <= 20 && data.entries.every((entry, index) =>
      entry && typeof entry === 'object' &&
      Number.isInteger(entry.rank) && entry.rank === index + 1 &&
      typeof entry.display_name === 'string' && entry.display_name.length <= 200 &&
      Number.isInteger(entry.points) && entry.points > 0 &&
      Number.isInteger(entry.verified_actions) && entry.verified_actions > 0 &&
      typeof entry.is_me === 'boolean'
    );
}

export function SceneLeaderboard({
  cityId, cadence, refresh,
}: {
  cityId: string; cadence: SceneCadence; refresh: number;
}) {
  const [data, setData] = useState<SceneLeaderboardData | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setData(null);
    setMessage(null);
    (async () => {
      try {
        const result = await (supabase as any).rpc('get_city_scene_leaderboard', {
          p_city_id: cityId, p_cadence: cadence, p_limit: 10,
        });
        if (result.error || !isSceneLeaderboard(result.data, cityId, cadence)) {
          throw new Error('Leaderboard unavailable');
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

  const updateVisibility = useCallback(async () => {
    if (!data || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = await (supabase as any).rpc('set_my_scene_leaderboard_opt_in', {
        p_city_id: cityId, p_enabled: !data.my_opted_in,
      });
      if (result.error || typeof result.data !== 'boolean' || result.data === data.my_opted_in) {
        throw new Error('Could not save leaderboard visibility');
      }
      setRevision((n) => n + 1);
    } catch {
      setMessage(data.my_opted_in
        ? 'Could not leave the leaderboard. Please retry.'
        : 'To join, finish a verified scene activity and set Profile highlight reel and Current activity to Public in Social Privacy Settings.');
    } finally {
      setSaving(false);
    }
  }, [cityId, data, saving]);

  const maxPoints = data?.entries[0]?.points ?? 1;

  return (
    <section aria-label="City Music Scene contributor leaderboard" className="space-y-2">
      <Card className="overflow-hidden border-amber-500/25">
        <CardHeader className="border-b border-border/50 bg-gradient-to-r from-amber-500/10 via-purple-500/5 to-transparent">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trophy aria-hidden="true" className="h-5 w-5 text-amber-500" />
            Scene Supporters
            <Badge className="ml-auto capitalize" variant="outline">{cadence}</Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Recognition for verified contributions. Musicians must choose to appear; private profiles and blocked accounts stay hidden.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          {status === 'loading' ? (
            <p role="status" className="text-sm text-muted-foreground">Loading consenting contributors…</p>
          ) : status === 'unavailable' || !data ? (
            <p role="status" className="text-sm text-muted-foreground">
              The leaderboard is temporarily unavailable. City progress is unaffected.
            </p>
          ) : (
            <>
              {data.entries.length === 0 ? (
                <div className="flex items-center gap-3 rounded-lg border border-dashed p-4">
                  <Users aria-hidden="true" className="h-7 w-7 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-semibold">No public scene supporters yet</p>
                    <p className="text-xs text-muted-foreground">
                      Private contributions still count towards the city's goals. Players appear here only after they opt in.
                    </p>
                  </div>
                </div>
              ) : (
                <ol className="space-y-3">
                  {data.entries.map((entry) => (
                    <li key={entry.rank} className={`rounded-lg border p-3 ${entry.is_me ? 'border-primary/50 bg-primary/5' : 'border-border/60'}`}>
                      <div className="mb-2 flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/10 font-black text-amber-600">
                          {entry.rank === 1 ? <Crown className="h-5 w-5" aria-label="Top supporter" /> : `#${entry.rank}`}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                          {entry.display_name}{entry.is_me ? ' (you)' : ''}
                        </span>
                        <span className="shrink-0 text-sm font-bold tabular-nums">{entry.points} SP</span>
                      </div>
                      <Progress value={Math.min(100, entry.points / maxPoints * 100)} aria-label={`Rank ${entry.rank} scene points`} />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {entry.verified_actions} verified {entry.verified_actions === 1 ? 'activity' : 'activities'}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck aria-hidden="true" className="h-4 w-4" />
                  <span>{data.my_opted_in ? 'You have opted in. Profile privacy settings still apply.' : 'Your identity is not listed unless you opt in.'}</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => void updateVisibility()} disabled={saving}>
                  {saving ? 'Saving…' : data.my_opted_in ? 'Leave leaderboard' : 'Join leaderboard'}
                </Button>
              </div>
              {message && <p role="alert" className="text-xs text-destructive">{message} <Link className="underline" to="/relationships">Social Privacy Settings</Link></p>}
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
