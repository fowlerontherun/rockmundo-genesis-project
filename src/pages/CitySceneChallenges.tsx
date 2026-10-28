import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarDays, Clock3, Disc3, Music2, RefreshCw, Trophy, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { FMPageScaffold } from '@/components/fm/FMPageScaffold';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScenePoster } from '@/features/city-scene-challenges/ScenePoster';
import { ScenePosterArchive } from '@/features/city-scene-challenges/ScenePosterArchive';
import { SceneLegacy } from '@/features/city-scene-challenges/SceneLegacy';
import { SceneMonthlyActions } from '@/features/city-scene-challenges/SceneMonthlyActions';
import { SceneCycleCountdown, findNextSceneCycleExpiry } from '@/features/city-scene-challenges/SceneCycleCountdown';
import { ScenePulse } from '@/features/city-scene-challenges/ScenePulse';
import { SceneLeaderboard } from '@/features/city-scene-challenges/SceneLeaderboard';
import { SceneBandSupporters } from '@/features/city-scene-challenges/SceneBandSupporters';
import { SceneActivityTimeline, isSceneActivityCredits } from '@/features/city-scene-challenges/SceneActivityTimeline';
import type { SceneActivityCredit } from '@/features/city-scene-challenges/SceneActivityTimeline';
import type { SceneCadence } from '@/features/city-scene-challenges/sceneRules';

type SceneObjective = {
  id: string;
  title: string;
  description: string;
  action_type: string;
  target_points: number;
  earned_points: number;
  status: string;
};
type SceneCycle = {
  id: string;
  cadence: SceneCadence;
  starts_at: string;
  ends_at: string;
  target_total: number;
  earned_points: number;
  milestones: number[];
  objectives: SceneObjective[];
};
type SceneBoard = {
  city_id: string;
  city_name: string;
  cycles: SceneCycle[];
};

type PersonalCycle = {
  cycle_id: string;
  cadence: SceneCadence;
  earned_points: number;
  verified_actions: number;
};
type PersonalSceneProgress = {
  city_id: string;
  cycles: PersonalCycle[];
};

type SceneReward = {
  cycle_id: string;
  cadence: SceneCadence;
  reward_key: string;
  reward_kind: 'xp';
  reward_amount: number;
  status: 'pending' | 'processing' | 'granted' | 'retry_required' | 'expired';
  entitled_at: string;
  expires_at: string | null;
  granted_at: string | null;
};

function validSceneRewards(value: unknown): value is SceneReward[] {
  return Array.isArray(value) && value.every((entry) =>
    entry && typeof entry === 'object' &&
    typeof entry.reward_key === 'string' &&
    typeof entry.reward_amount === 'number' &&
    typeof entry.status === 'string'
  );
}


function validPersonalProgress(value: unknown): value is PersonalSceneProgress {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<PersonalSceneProgress>;
  return typeof data.city_id === 'string' && Array.isArray(data.cycles);
}

const cadences: { key: SceneCadence; title: string; description: string }[] = [
  { key: 'daily', title: 'Daily', description: 'Quick ways to support your local scene' },
  { key: 'weekly', title: 'Weekly', description: 'Band cooperation and shared effort' },
  { key: 'monthly', title: 'Monthly', description: 'Build a lasting music legacy together' },
];

const sceneActions: Record<string, { destination: string; buttonText: string; label: string; tint: string; icon: typeof Music2 }> = {
  'jam:verified_collaboration': {
    destination: '/jam-sessions', buttonText: 'Find a jam session', label: 'COLLABORATE',
    tint: 'from-fuchsia-700 via-purple-700 to-indigo-900', icon: Music2,
  },
  'rehearsal:completed': {
    destination: '/rehearsals', buttonText: 'Book a band rehearsal', label: 'REHEARSAL ROOM',
    tint: 'from-emerald-800 via-teal-800 to-slate-950', icon: Music2,
  },
  'recording:completed': {
    destination: '/recording-studio', buttonText: 'Visit recording studios', label: 'IN THE STUDIO',
    tint: 'from-amber-600 via-orange-700 to-red-950', icon: Disc3,
  },
  'gig:verified_performance': {
    destination: '/gig-booking', buttonText: 'Book a gig', label: 'LIVE ON STAGE',
    tint: 'from-sky-700 via-blue-800 to-slate-950', icon: Trophy,
  },
};

function percent(earned: number, target: number): number {
  return target > 0 ? Math.max(0, Math.min(100, Math.floor(earned / target * 100))) : 0;
}

function validBoard(value: unknown): value is SceneBoard {
  if (!value || typeof value !== 'object') return false;
  const board = value as Partial<SceneBoard>;
  return typeof board.city_id === 'string' && typeof board.city_name === 'string'
    && Array.isArray(board.cycles);
}

function formatEnd(value: string): string {
  const instant = new Date(value);
  return Number.isNaN(instant.getTime())
    ? 'Time not available'
    : `Ends ${new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(instant)} UTC`;
}

export default function CitySceneChallenges() {
  const { cityId } = useParams<{ cityId: string }>();
  const [board, setBoard] = useState<SceneBoard | null>(null);
  const [personal, setPersonal] = useState<PersonalSceneProgress | null>(null);
  const [myRewards, setMyRewards] = useState<SceneReward[] | null>(null);
  const [credits, setCredits] = useState<SceneActivityCredit[] | null>(null);
  const [active, setActive] = useState<SceneCadence>('daily');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const handledCycleIds = useRef(new Set<string>());
  const lastLoadedCity = useRef<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [clockNow, setClockNow] = useState(() => Date.now());

  // A failed rollover refresh must not leave yesterday's objectives looking
  // earnable. Keep this clock independent of the network and worker cadence.
  useEffect(() => {
    const tick = () => setClockNow(Date.now());
    const timer = window.setInterval(tick, 30_000);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const initialCityLoad = lastLoadedCity.current !== cityId;
    // Refresh in place: do not remove the community board when a rollover or
    // scheduled refresh fetches new data. Owner details fail closed instead.
    if (initialCityLoad) {
      setLoading(true);
      setBoard(null);
    } else {
      setRefreshing(true);
    }
    setError(null);
    setRefreshError(false);
    setPersonal(null);
    setMyRewards(null);
    setCredits(null);
    if (!cityId || !/^[0-9a-fA-F-]{36}$/.test(cityId)) {
      setError('Choose a valid city to view its challenges.');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        // This RPC exposes only city-level aggregates, never raw private
        // contribution events, profile IDs, or reward-grant information.
        const { data, error: rpcError } = await (supabase as any).rpc('get_city_scene_board', { p_city_id: cityId });
        if (rpcError) throw rpcError;
        if (!validBoard(data)) throw new Error('The city challenge board is not yet available.');
        if (!cancelled) {
          setBoard(data);
          lastLoadedCity.current = cityId;
        }

        // Optional owner-only totals. A failing personal RPC must not
        // prevent an otherwise healthy community board from rendering.
        try {
          const mine = await (supabase as any).rpc('get_my_city_scene_progress', { p_city_id: cityId });
          if (!cancelled && !mine.error && validPersonalProgress(mine.data)) {
            setPersonal(mine.data);
          }
        } catch {
          // Personal progress is unavailable, not silently reported as zero.
        }
        // Owner-only verified activity history. No raw source event IDs,
        // actor IDs, band IDs or other players' activity is returned.
        try {
          const activity = await (supabase as any).rpc('get_my_city_scene_activity', {
            p_city_id: cityId,
            p_limit: 60,
          });
          if (!cancelled && !activity.error && isSceneActivityCredits(activity.data)) {
            setCredits(activity.data);
          }
        } catch {
          // Unavailable history is never represented as zero contributions.
        }
        // Separate owner-only reward query: never expose claim IDs, profile
        // identifiers or private XP ledger rows on the shared board.
        try {
          const rewards = await (supabase as any).rpc('get_my_scene_reward_history', {
            p_city_id: cityId,
            p_limit: 20,
          });
          if (!cancelled && !rewards.error && validSceneRewards(rewards.data)) {
            setMyRewards(rewards.data);
          }
        } catch {
          // Reward display is optional during gradual database rollout.
        }
      } catch {
        if (!cancelled) {
          if (initialCityLoad) {
            setError('City Scene Challenges are not available yet. Please try again later.');
          } else {
            setRefreshError(true);
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [cityId, refresh]);

  // A quiet, low-frequency refetch lets a new monthly cycle appear after the
  // 15-minute verified-worker tick even when the board stayed open at midnight.
  // Hidden tabs do not poll; returning to a long-idle tab refreshes once.
  useEffect(() => {
    if (!cityId) return;
    let lastRefreshAt = Date.now();
    const refreshIfStale = () => {
      if (document.visibilityState === 'hidden') return;
      const now = Date.now();
      if (now - lastRefreshAt < 15 * 60_000) return;
      lastRefreshAt = now;
      setRefresh((n) => n + 1);
    };
    const timer = window.setInterval(refreshIfStale, 60_000);
    window.addEventListener('focus', refreshIfStale);
    document.addEventListener('visibilitychange', refreshIfStale);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshIfStale);
      document.removeEventListener('visibilitychange', refreshIfStale);
    };
  }, [cityId]);

  // UTC cycle boundaries are authoritative on the server. When the earliest
  // displayed cycle expires, re-fetch once and let the periodic worker create
  // the next cycle. Track handled IDs to prevent loops during cron delay or
  // when the device clock differs from server time.
  useEffect(() => {
    if (!board || board.city_id !== cityId) return;
    const next = findNextSceneCycleExpiry(board.cycles, handledCycleIds.current);
    if (!next) return;
    let timeout: number | undefined;
    const checkDeadline = () => {
      const wait = next.endsAtMs - Date.now() + 1_500;
      if (wait > 0) {
        timeout = window.setTimeout(checkDeadline, Math.min(wait, 60 * 60 * 1_000));
      } else {
        handledCycleIds.current.add(next.id);
        setRefresh((n) => n + 1);
      }
    };
    checkDeadline();
    return () => { if (timeout !== undefined) window.clearTimeout(timeout); };
  }, [board, cityId]);

  const current = board?.cycles.find((cycle) => cycle.cadence === active);
  const monthly = board?.cycles.find((cycle) => cycle.cadence === 'monthly');
  const myCurrent = personal?.cycles.find((cycle) => cycle.cycle_id === current?.id);
  const currentExpired = current ? Number.isFinite(Date.parse(current.ends_at)) && clockNow >= Date.parse(current.ends_at) : false;

  return (
    <FMPageScaffold
      title="City Scene Challenges"
      subtitle="Make music, support other artists and build the scene together."
      icon={Music2}
      backTo={cityId ? `/cities/${cityId}` : '/cities'}
      headerActions={
        <Button variant="outline" size="sm" disabled={loading || refreshing} onClick={() => setRefresh((n) => n + 1)}>
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      }
    >
      {loading ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground" role="status">
          Loading the city music scene…
        </CardContent></Card>
      ) : error ? (
        <Card><CardContent className="py-8 text-center">
          <p role="alert" className="text-muted-foreground">{error}</p>
          <Button asChild variant="outline" className="mt-4"><Link to="/cities">Browse cities</Link></Button>
        </CardContent></Card>
      ) : board ? (
        <div className="space-y-5">
          {refreshError && (
            <p role="status" className="rounded-lg border border-amber-500/30 p-3 text-sm text-muted-foreground">
              We couldn't refresh the scene yet. Showing the last confirmed city progress; try Refresh again.
            </p>
          )}
          <div className="relative overflow-hidden rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-950 via-slate-900 to-slate-950 px-5 py-6 text-white sm:px-8">
            <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-purple-400/25" aria-hidden="true">
              <Music2 className="h-24 w-24 sm:h-32 sm:w-32" />
            </div>
            <div className="relative">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-purple-200">RockMundo • Local Music Scene</p>
              <h2 className="mt-1 text-2xl font-black uppercase tracking-tight sm:text-4xl">{board.city_name}</h2>
              <p className="mt-2 max-w-xl text-sm text-purple-100">
                Every verified contribution helps your city. Explore daily, weekly and monthly community goals.
              </p>
            </div>
          </div>

          {monthly ? (
            <ScenePoster
              cityName={board.city_name}
              campaignTitle="Live Music Revival"
              monthLabel={new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(monthly.starts_at))}
              earnedPoints={monthly.earned_points}
              targetPoints={monthly.target_total}
              unlockedMilestones={monthly.milestones ?? []}
            />
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex items-center gap-3 py-6">
                <Music2 className="h-10 w-10 shrink-0 text-purple-500" />
                <div>
                  <p className="font-semibold">The monthly scene mural is being prepared</p>
                  <p className="text-sm text-muted-foreground">
                    {Date.now() < Date.parse('2026-11-01T00:00:00Z')
                      ? 'The first full monthly mural is scheduled from 1 November 2026 UTC. Daily and weekly challenges are already live.'
                      : 'The monthly mural starts when this city receives its verified monthly challenge. Daily and weekly contributions remain available.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <ScenePosterArchive cityId={board.city_id} cityName={board.city_name} refresh={refresh} />
          <SceneLegacy cityId={board.city_id} cityName={board.city_name} refresh={refresh} />

          {monthly && (
            <section aria-label="City scene poster milestones" className="grid grid-cols-4 gap-2">
              {[25, 50, 75, 100].map((threshold) => {
                const unlocked = monthly.milestones?.includes(threshold) ?? false;
                return (
                  <div key={threshold} className={`rounded-lg border px-2 py-3 text-center transition-colors ${unlocked ? 'border-amber-400/70 bg-amber-400/10 text-foreground' : 'border-border/60 bg-muted/20 text-muted-foreground'}`}>
                    <p className="text-base font-black tabular-nums sm:text-lg">{threshold}%</p>
                    <p className="text-[11px] font-semibold">{unlocked ? 'Unlocked' : 'Locked'}</p>
                  </div>
                );
              })}
            </section>
          )}

          <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Challenge period">
            {cadences.map((cadence) => {
              const cycle = board.cycles.find((item) => item.cadence === cadence.key);
              return (
                <button
                  key={cadence.key}
                  role="tab"
                  aria-selected={active === cadence.key}
                  type="button"
                  onClick={() => setActive(cadence.key)}
                  className={`rounded-lg border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${active === cadence.key ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50'}`}
                >
                  <span className="block text-sm font-semibold sm:text-base">{cadence.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {cycle ? `${percent(cycle.earned_points, cycle.target_total)}% complete` : 'Coming soon'}
                  </span>
                </button>
              );
            })}
          </div>

          <section aria-label={`${active} challenges`} role="tabpanel" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="text-xl font-bold">{cadences.find((entry) => entry.key === active)?.title} scene challenges</h3>
                <p className="text-sm text-muted-foreground">{cadences.find((entry) => entry.key === active)?.description}</p>
              </div>
              {current && <div className="flex flex-wrap items-center gap-2">
                <SceneCycleCountdown endsAt={current.ends_at} />
                <Badge variant="outline" className="gap-1">
                  <Clock3 className="h-3 w-3" /> {formatEnd(current.ends_at)}
                </Badge>
              </div>}
            </div>

            {!current ? (
              <Card><CardContent className="flex items-start gap-3 py-8">
                <CalendarDays className="h-6 w-6 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-semibold">No active {active} challenge yet</p>
                  <p className="text-sm text-muted-foreground">The next verified community cycle has not started. No progress is being counted for this period.</p>
                </div>
              </CardContent></Card>
            ) : (
              <>
                {currentExpired && (
                  <p role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                    This {active} challenge period has ended. These are the last confirmed results; new activities cannot earn points for it. The next period will appear after the server creates it.
                  </p>
                )}
                <Card><CardContent className="space-y-3 py-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-semibold"><Users className="h-5 w-5 text-primary" /> Shared city progress</div>
                    <span className="text-sm tabular-nums">{current.earned_points} / {current.target_total} points</span>
                  </div>
                  <Progress value={percent(current.earned_points, current.target_total)} aria-label="City community progress" />
                </CardContent></Card>
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div>
                      <p className="text-sm font-semibold">Your impact on the city</p>
                      <p className="text-xs text-muted-foreground">Only verified completed activities count towards these totals.</p>
                    </div>
                    {myCurrent ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge variant="outline">{myCurrent.verified_actions} verified {myCurrent.verified_actions === 1 ? 'activity' : 'activities'}</Badge>
                        <Badge variant="secondary">{myCurrent.earned_points} scene {myCurrent.earned_points === 1 ? 'point' : 'points'}</Badge>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Personal progress unavailable</span>
                    )}
                  </CardContent>
                </Card>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {current.objectives.map((objective) => {
                    const action = sceneActions[objective.action_type];
                    const ActionIcon = action?.icon ?? Music2;
                    return (
                      <Card key={objective.id} className="group overflow-hidden transition-colors hover:border-primary/40">
                        <div className={`relative isolate h-24 overflow-hidden bg-gradient-to-br text-white ${action?.tint ?? 'from-violet-800 via-fuchsia-900 to-slate-950'}`}>
                          <div aria-hidden="true" className="absolute -right-4 -top-5 rotate-12 opacity-25 transition-transform duration-300 group-hover:rotate-6 motion-reduce:transition-none">
                            <ActionIcon className="h-36 w-36" strokeWidth={1} />
                          </div>
                          <span className="absolute left-4 top-3 rounded bg-black/30 px-2 py-1 text-[10px] font-bold tracking-[.2em]">
                            {action?.label ?? 'CITY SCENE'}
                          </span>
                          <ActionIcon aria-hidden="true" className="absolute bottom-4 left-4 h-7 w-7 text-white" />
                        </div>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">{objective.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="min-h-10 text-sm text-muted-foreground">{objective.description}</p>
                          <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                            <span>{objective.status === 'completed' ? 'Completed' : currentExpired ? 'Period ended' : 'Community progress'}</span>
                            <span className="tabular-nums">{objective.earned_points} / {objective.target_points}</span>
                          </div>
                          <Progress value={percent(objective.earned_points, objective.target_points)} />
                          {action && !currentExpired && (
                            <Button asChild variant="outline" size="sm" className="w-full">
                              <Link to={action.destination}>{action.buttonText}</Link>
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                {active === 'monthly' && <SceneMonthlyActions />}
              </>
            )}
          </section>
          <ScenePulse cityId={board.city_id} cadence={active} refresh={refresh} />
          <SceneLeaderboard cityId={board.city_id} cadence={active} refresh={refresh} />
          <SceneBandSupporters cityId={board.city_id} cadence={active} refresh={refresh} />
          <SceneActivityTimeline credits={credits} />
          {myRewards && myRewards.length > 0 && (
            <section aria-label="Your City Scene XP rewards" className="space-y-3">
              <div>
                <h3 className="text-xl font-bold">Your City Scene rewards</h3>
                <p className="text-sm text-muted-foreground">
                  Verified community XP awards are added to your character wallet after processing.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {myRewards.map((reward) => (
                  <Card key={`${reward.cycle_id}:${reward.reward_key}`}
                    className="overflow-hidden border-amber-500/20">
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
                        <Trophy className="h-6 w-6" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-semibold capitalize">
                          {reward.cadence.replace(/_/g, ' ')} scene reward
                        </p>
                        <p className="font-bold tabular-nums text-amber-500">
                          +{reward.reward_amount.toLocaleString()} XP
                        </p>
                        <Badge variant={reward.status === 'granted' ? 'secondary' : 'outline'}
                          className="capitalize">
                          {reward.status === 'granted'
                            ? 'Awarded'
                            : reward.status === 'pending'
                              ? 'Awaiting processing'
                              : reward.status.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}
          <p className="text-xs text-muted-foreground">
            Contributions count only after trusted game events are verified. Creating bookings, sending invites or repeatedly clicking does not earn scene points.
          </p>
        </div>
      ) : null}
    </FMPageScaffold>
  );
}
