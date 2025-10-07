import React from 'react';
import { Loader2, History, Music, Coins } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useGameData } from '@/hooks/useGameData';
import type { Database, Tables } from '@/lib/supabase-types';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const SESSION_LENGTHS = [30, 60, 120] as const;

type SessionLength = (typeof SESSION_LENGTHS)[number];

type SessionReward = {
  experience: number;
  cash: number;
};

type BuskingLocation = {
  id: string;
  name: string;
  neighborhood: string;
  description: string;
  vibe: string;
  tip: string;
  rewards: Record<SessionLength, SessionReward>;
};

type ProfileActivityStatus = Database['public']['Tables']['profile_activity_statuses']['Row'];

type BuskingResult = {
  locationName: string;
  duration: SessionLength;
  xpGained: number;
  cashEarned: number;
  startedAt: string;
  endsAt: string;
  performanceDescriptor: string;
};

const buskingLocations: BuskingLocation[] = [
  {
    id: 'market-square',
    name: 'Market Square',
    neighborhood: 'Old Town',
    description: 'Bustling stalls and coffee carts keep lunchtime crowds lingering.',
    vibe: 'Midday bustle',
    tip: 'Great spot for upbeat covers that catch shoppers on the move.',
    rewards: {
      30: { experience: 45, cash: 32 },
      60: { experience: 90, cash: 74 },
      120: { experience: 180, cash: 150 },
    },
  },
  {
    id: 'river-promenade',
    name: 'River Promenade',
    neighborhood: 'Harborfront',
    description: 'Evening strollers and bus tours bring a steady flow of tipsy tippers.',
    vibe: 'Sunset rush',
    tip: 'Lean into soulful ballads as the lights bounce off the water.',
    rewards: {
      30: { experience: 55, cash: 40 },
      60: { experience: 110, cash: 92 },
      120: { experience: 210, cash: 175 },
    },
  },
  {
    id: 'night-market',
    name: 'Neon Night Market',
    neighborhood: 'Arts District',
    description: 'Street food, neon booths, and late-night creatives pack the walkways.',
    vibe: 'After-dark energy',
    tip: 'Long-form jams thrive as the crowd settles in for the night.',
    rewards: {
      30: { experience: 70, cash: 52 },
      60: { experience: 135, cash: 108 },
      120: { experience: 260, cash: 210 },
    },
  },
];

const sessionOptions: { value: SessionLength; label: string; description: string }[] = [
  { value: 30, label: '30 minutes', description: 'Quick warm-up set.' },
  { value: 60, label: '1 hour', description: 'Prime-time showcase.' },
  { value: 120, label: '2 hours', description: 'Full evening takeover.' },
];

const getStatusEndDate = (status: ProfileActivityStatus | null): Date | null => {
  if (!status) {
    return null;
  }

  if (status.ends_at) {
    const ends = new Date(status.ends_at);
    if (!Number.isNaN(ends.getTime())) {
      return ends;
    }
  }

  if (!status.started_at || typeof status.duration_minutes !== 'number') {
    return null;
  }

  const start = new Date(status.started_at);
  if (Number.isNaN(start.getTime())) {
    return null;
  }

  return new Date(start.getTime() + status.duration_minutes * 60_000);
};

const describePerformance = (roll: number): string => {
  if (roll >= 1.25) {
    return 'Electric crowd surge';
  }

  if (roll >= 1.1) {
    return 'Strong engagement and steady tips';
  }

  if (roll >= 0.95) {
    return 'Solid flow with a supportive audience';
  }

  return 'Tough crowd — every coin counted';
};

const formatSessionWindow = (startIso: string, endIso: string): string => {
  const start = new Date(startIso);
  const end = new Date(endIso);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startIso} – ${endIso}`;
  }

  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  return `${formatter.format(start)} – ${formatter.format(end)}`;
};

export default function Busking() {
  const {
    profile,
    updateProfile,
    addActivity,
    awardActionXp,
    activityStatus,
    refreshActivityStatus,
    startActivity,
    user,
  } = useGameData();
  const { toast } = useToast();

  const [selectedLocationId, setSelectedLocationId] = React.useState(buskingLocations[0]?.id ?? '');
  const [showHistory, setShowHistory] = React.useState(false);
  
  const { data: buskingHistory } = useQuery({
    queryKey: ["busking-history", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("activity_feed")
        .select("*")
        .eq("user_id", user.id)
        .eq("activity_type", "busking_session")
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data as Tables<"activity_feed">[];
    },
    enabled: !!user && showHistory,
  });
  const [selectedLength, setSelectedLength] = React.useState<SessionLength>(SESSION_LENGTHS[0]);
  const [statusLoading, setStatusLoading] = React.useState(false);
  const [isStartingSession, setIsStartingSession] = React.useState(false);
  const [lastResult, setLastResult] = React.useState<BuskingResult | null>(null);

  const activeLocation = React.useMemo(() => {
    return buskingLocations.find((location) => location.id === selectedLocationId) ?? buskingLocations[0];
  }, [selectedLocationId]);

  const activeReward = activeLocation.rewards[selectedLength];

  const statusEndsAt = React.useMemo(() => getStatusEndDate(activityStatus), [activityStatus]);

  const isBusy = React.useMemo(() => {
    if (!activityStatus) {
      return false;
    }

    if (activityStatus.duration_minutes === null || activityStatus.duration_minutes === undefined) {
      return activityStatus.status !== 'idle';
    }

    if (!statusEndsAt) {
      return false;
    }

    return statusEndsAt.getTime() > Date.now();
  }, [activityStatus, statusEndsAt]);

  const timeRemainingLabel = React.useMemo(() => {
    if (!isBusy || !statusEndsAt) {
      return null;
    }

    try {
      return formatDistanceToNowStrict(statusEndsAt, { addSuffix: true });
    } catch (error) {
      console.error('Failed to format status countdown', error);
      return null;
    }
  }, [isBusy, statusEndsAt]);

  const loadActivityStatus = React.useCallback(async () => {
    setStatusLoading(true);
    try {
      await refreshActivityStatus();
    } catch (error) {
      console.error('Failed to load activity status', error);
    } finally {
      setStatusLoading(false);
    }
  }, [refreshActivityStatus]);

  React.useEffect(() => {
    void loadActivityStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStartBusking = React.useCallback(async () => {
    if (!profile) {
      toast({
        title: 'Create your artist first',
        description: 'Set up your performer profile before starting a busking session.',
        variant: 'destructive',
      });
      return;
    }

    setIsStartingSession(true);

    const now = new Date();
    const sessionEnds = new Date(now.getTime() + selectedLength * 60_000);
    const performanceRoll = 0.85 + Math.random() * 0.35;
    const xpGained = Math.max(5, Math.round(activeReward.experience * performanceRoll));
    const cashEarned = Math.max(5, Math.round(activeReward.cash * performanceRoll));
    const performanceDescriptor = describePerformance(performanceRoll);

    try {
      const normalizedStatus = await refreshActivityStatus();
      const normalizedEndsAt = getStatusEndDate(normalizedStatus);
      const normalizedBusy = normalizedStatus
        ? normalizedStatus.duration_minutes === null || normalizedStatus.duration_minutes === undefined
          ? normalizedStatus.status !== 'idle'
          : !!normalizedEndsAt && normalizedEndsAt.getTime() > now.getTime()
        : false;

      if (normalizedBusy) {
        let availabilityLabel = 'after you wrap up your current activity';
        if (normalizedEndsAt) {
          try {
            availabilityLabel = formatDistanceToNowStrict(normalizedEndsAt, { addSuffix: true });
          } catch (formatError) {
            console.error('Failed to format availability window', formatError);
          }
        }

        toast({
          title: 'Already busy',
          description: `You're currently ${normalizedStatus.status.replace(/_/g, ' ')}. Try again ${availabilityLabel}.`,
          variant: 'destructive',
        });
        return;
      }

      const metadata = {
        location_id: activeLocation.id,
        location_name: activeLocation.name,
        duration_minutes: selectedLength,
      };

      const updatedStatus = await startActivity({
        status: 'busking_session',
        durationMinutes: selectedLength,
        metadata,
      });

      if (xpGained > 0) {
        await awardActionXp({
          amount: xpGained,
          category: 'performance',
          actionKey: 'busking_session',
          metadata: {
            location_id: activeLocation.id,
            location_name: activeLocation.name,
            duration_minutes: selectedLength,
            cash_earned: cashEarned,
            performance_roll: performanceRoll,
          },
        });
      }

      const currentCash = typeof profile.cash === 'number' ? profile.cash : 0;
      await updateProfile({ cash: currentCash + cashEarned });

      await addActivity(
        'busking_session',
        `Played a ${selectedLength}-minute busking set at ${activeLocation.name}`,
        cashEarned,
        {
          location_id: activeLocation.id,
          location_name: activeLocation.name,
          duration_minutes: selectedLength,
          xp_gained: xpGained,
          performance_roll: performanceRoll,
          performance_descriptor: performanceDescriptor,
        },
        {
          status: updatedStatus?.status ?? 'busking_session',
          durationMinutes: updatedStatus?.duration_minutes ?? selectedLength,
          statusId: updatedStatus?.id ?? null,
        }
      );

      setLastResult({
        locationName: activeLocation.name,
        duration: selectedLength,
        xpGained,
        cashEarned,
        startedAt: now.toISOString(),
        endsAt: sessionEnds.toISOString(),
        performanceDescriptor,
      });

      toast({
        title: 'Busking session complete',
        description: `You earned ${xpGained} XP and $${cashEarned.toLocaleString()} in tips.`,
      });
    } catch (error) {
      console.error('Failed to start busking session', error);
      toast({
        title: 'Unable to start busking',
        description:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred while starting your busking run.',
        variant: 'destructive',
      });
    } finally {
      setIsStartingSession(false);
      void loadActivityStatus();
    }
  }, [
    profile,
    toast,
    selectedLength,
    activeReward.experience,
    activeReward.cash,
    awardActionXp,
    activeLocation.id,
    activeLocation.name,
    updateProfile,
    addActivity,
    loadActivityStatus,
    refreshActivityStatus,
    startActivity,
  ]);

  const buttonDisabled = !profile || isStartingSession || statusLoading || isBusy;
  const selectedLengthLabel = sessionOptions.find((option) => option.value === selectedLength)?.label;
  const busyStatusLabel = activityStatus?.status.replace(/_/g, ' ');

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Busking</CardTitle>
          <CardDescription>
            Pick a spot, choose how long to play, and book the time to earn real experience and tips.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Choose a location</h3>
            <div className="mt-3 grid gap-4 md:grid-cols-3">
              {buskingLocations.map((location) => {
                const isSelected = location.id === activeLocation.id;
                return (
                  <button
                    key={location.id}
                    type="button"
                    onClick={() => setSelectedLocationId(location.id)}
                    className={cn(
                      'flex h-full flex-col justify-between rounded-lg border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-md'
                        : 'border-border bg-background hover:border-primary/40 hover:shadow-sm',
                    )}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-lg font-semibold leading-tight">{location.name}</h4>
                          <p className="text-sm text-muted-foreground">{location.description}</p>
                        </div>
                        <Badge variant="outline" className="whitespace-nowrap text-xs font-medium">
                          {location.vibe}
                        </Badge>
                      </div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {location.neighborhood}
                      </p>
                    </div>
                    <p className="mt-4 text-sm text-muted-foreground">{location.tip}</p>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Set your session length</h3>
            <div className="mt-3 grid gap-4 md:grid-cols-3">
              {sessionOptions.map((option) => {
                const reward = activeLocation.rewards[option.value];
                const isSelected = option.value === selectedLength;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSelectedLength(option.value)}
                    className={cn(
                      'rounded-lg border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-md'
                        : 'border-border bg-background hover:border-primary/40 hover:shadow-sm',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold leading-tight">{option.label}</p>
                        <p className="text-xs text-muted-foreground">{option.description}</p>
                      </div>
                      <Badge variant={isSelected ? 'default' : 'outline'} className="text-xs">
                        {isSelected ? 'Selected' : 'Preview'}
                      </Badge>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-muted-foreground">XP</dt>
                        <dd className="text-lg font-semibold text-primary">{reward.experience}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-muted-foreground">Cash</dt>
                        <dd className="text-lg font-semibold text-emerald-600">${reward.cash}</dd>
                      </div>
                    </dl>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <div className="space-y-4 rounded-lg border bg-muted/40 p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Ready to take the stage?</p>
                  <p className="mt-2 text-lg font-semibold">
                    {activeLocation.name} · {selectedLengthLabel}
                  </p>
                </div>
                <Button onClick={handleStartBusking} disabled={buttonDisabled} size="lg">
                  {isStartingSession ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting...
                    </>
                  ) : statusLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Checking availability...
                    </>
                  ) : isBusy ? (
                    'Time already committed'
                  ) : !profile ? (
                    'Create your artist to begin'
                  ) : (
                    'Start busking session'
                  )}
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-md border border-primary/40 bg-background p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Projected XP</p>
                  <p className="mt-1 text-2xl font-bold text-primary">{activeReward.experience}</p>
                </div>
                <div className="rounded-md border border-emerald-400/40 bg-background p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Expected Cash</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-600">${activeReward.cash}</p>
                </div>
              </div>
              {isBusy ? (
                <div className="rounded-md border border-amber-300/60 bg-amber-100/40 p-4 text-sm text-amber-900">
                  <p className="font-medium">
                    You're currently {busyStatusLabel}.
                  </p>
                  {timeRemainingLabel && (
                    <p className="mt-1 text-amber-900/80">
                      You can start another timed activity {timeRemainingLabel}.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Reserving {selectedLength} in-game minutes will block other timed activities until this session finishes.
                </p>
              )}
              {lastResult && (
                <div className="rounded-md border border-border bg-background p-4 text-sm">
                  <p className="font-semibold">Last session summary</p>
                  <ul className="mt-2 space-y-1 text-muted-foreground">
                    <li>
                      <span className="font-medium text-foreground">Location:</span> {lastResult.locationName}
                    </li>
                    <li>
                      <span className="font-medium text-foreground">Outcome:</span> {lastResult.performanceDescriptor}
                    </li>
                    <li>
                      <span className="font-medium text-foreground">Rewards:</span> {lastResult.xpGained} XP · ${lastResult.cashEarned.toLocaleString()}
                    </li>
                    <li>
                      <span className="font-medium text-foreground">Time committed:</span>{' '}
                      {lastResult.duration} minutes ({formatSessionWindow(lastResult.startedAt, lastResult.endsAt)})
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </section>

          {showHistory && (
            <section className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <History className="h-5 w-5" />
                Busking History
              </h3>
              {buskingHistory && buskingHistory.length > 0 ? (
                <div className="space-y-3">
                  {buskingHistory.map((session) => {
                    const metadata = session.metadata as any || {};
                    return (
                      <Card key={session.id} className="p-4 bg-muted/30">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Music className="h-4 w-4 text-primary" />
                              <span className="font-medium">
                                {metadata.location_name || "Unknown Location"}
                              </span>
                              <Badge variant="outline">
                                {metadata.duration_minutes || 0} min
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {new Date(session.created_at).toLocaleString()}
                            </p>
                            {metadata.performance_descriptor && (
                              <p className="text-sm italic text-muted-foreground">
                                "{metadata.performance_descriptor}"
                              </p>
                            )}
                          </div>
                          <div className="text-right space-y-1">
                            <div className="flex items-center gap-1 text-sm font-semibold text-green-600">
                              <Coins className="h-4 w-4" />
                              ${session.earnings || 0}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              +{metadata.xp_gained || 0} XP
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="p-6 bg-muted/20">
                  <p className="text-sm text-muted-foreground text-center">
                    No busking sessions yet. Get out there and perform!
                  </p>
                </Card>
              )}
            </section>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
