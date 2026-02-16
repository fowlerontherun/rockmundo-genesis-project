import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth-context";
import { usePrimaryBand } from "@/hooks/usePrimaryBand";
import { 
  useMajorEvents, useMajorEventPerformances, useMajorEventHistory, 
  useAcceptMajorEvent, useBandEventCooldowns, useBandYearEventCount 
} from "@/hooks/useMajorEvents";
import { useGameCalendar } from "@/hooks/useGameCalendar";
import { MajorEventSongSelector } from "@/components/major-events/MajorEventSongSelector";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getMonthName } from "@/utils/gameCalendar";
import { 
  Trophy, Users, Star, DollarSign, TrendingUp, Loader2, Play,
  CheckCircle, Lock, Sparkles, Music, History, Calendar, Clock, Repeat,
  Ban, Guitar
} from "lucide-react";

const categoryIcons: Record<string, string> = {
  sports: '🏟️',
  music: '🎵',
  tv: '📺',
  holiday: '🎆',
};

const categoryColors: Record<string, string> = {
  sports: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  music: 'bg-purple-500/10 text-purple-500 border-purple-500/30',
  tv: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  holiday: 'bg-red-500/10 text-red-500 border-red-500/30',
};

const MAX_EVENTS_PER_YEAR = 2;
const COOLDOWN_YEARS = 3;

export default function MajorEvents() {
  const { user } = useAuth();
  const { data: primaryBand } = usePrimaryBand();
  const activeBand = primaryBand?.bands ? { id: primaryBand.band_id, ...primaryBand.bands } as any : null;
  const navigate = useNavigate();
  const { data: events = [], isLoading } = useMajorEvents();
  const { data: performances = [] } = useMajorEventPerformances(user?.id);
  const { data: historyInstances = [], isLoading: loadingHistory } = useMajorEventHistory();
  const { data: calendar } = useGameCalendar();
  const acceptEvent = useAcceptMajorEvent();
  const { data: cooldowns = {} } = useBandEventCooldowns(activeBand?.id);
  const { data: yearCounts = {} } = useBandYearEventCount(activeBand?.id);

  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [selectedEventStart, setSelectedEventStart] = useState<string>('');
  const [selectedEventEnd, setSelectedEventEnd] = useState<string>('');
  const [selectedEventName, setSelectedEventName] = useState<string>('');
  const [songSelectorOpen, setSongSelectorOpen] = useState(false);

  const bandFame = activeBand?.fame || 0;
  const bandGenre = activeBand?.genre || null;

  const handleAcceptInvitation = (instanceId: string, eventStart: string, eventEnd: string, eventName: string) => {
    setSelectedInstance(instanceId);
    setSelectedEventStart(eventStart);
    setSelectedEventEnd(eventEnd);
    setSelectedEventName(eventName);
    setSongSelectorOpen(true);
  };

  const handleSongConfirm = (song1Id: string, song2Id: string, song3Id: string) => {
    if (!selectedInstance || !activeBand) return;
    acceptEvent.mutate({
      instanceId: selectedInstance,
      bandId: activeBand.id,
      song1Id,
      song2Id,
      song3Id,
      eventStart: selectedEventStart,
      eventEnd: selectedEventEnd,
      eventName: selectedEventName,
    });
  };

  const getPerformanceForInstance = (instanceId: string) => {
    return performances.find(p => p.instance_id === instanceId);
  };

  /**
   * Check if band can accept this event
   */
  const getBlockReason = (instance: typeof events[0]): string | null => {
    const event = instance.event;
    if (!event || !activeBand) return null;

    // Genre check: if event has a genre, band must match
    if (event.genre && bandGenre && event.genre !== bandGenre) {
      return `Genre mismatch — this event is for ${event.genre} bands`;
    }

    // 2 events per year cap
    const yearCount = yearCounts[instance.year] || 0;
    if (yearCount >= MAX_EVENTS_PER_YEAR) {
      return `Your band already has ${MAX_EVENTS_PER_YEAR} events in Year ${instance.year}`;
    }

    // 3-year cooldown
    const lastPerformed = cooldowns[event.id];
    if (lastPerformed && (instance.year - lastPerformed) < COOLDOWN_YEARS) {
      const canAgainYear = lastPerformed + COOLDOWN_YEARS;
      return `Cooldown — can perform at this event again in Year ${canAgainYear}`;
    }

    return null;
  };

  const completedPerformances = performances.filter(p => p.status === 'completed');

  const eventsByYear = events.reduce((acc, instance) => {
    const yr = instance.year;
    if (!acc[yr]) acc[yr] = [];
    acc[yr].push(instance);
    return acc;
  }, {} as Record<number, typeof events>);

  const sortedYears = Object.keys(eventsByYear).map(Number).sort((a, b) => a - b);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Trophy className="h-8 w-8 text-primary" />
          Major Events
        </h1>
        <p className="text-muted-foreground mt-1">
          Perform at the world's biggest events for massive cash, fame, and fans.
        </p>
      </div>

      {calendar && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-3">
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="h-4 w-4 text-primary" />
              <span>
                Currently: <strong>{getMonthName(calendar.gameMonth)} {calendar.gameDay}</strong>, Game Year <strong>{calendar.gameYear}</strong>
              </span>
              <Badge variant="outline" className="ml-auto text-xs capitalize">
                {calendar.seasonEmoji} {calendar.season}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {!activeBand && (
        <Alert>
          <Music className="h-4 w-4" />
          <AlertDescription>
            You need a band to perform at major events. Create or join a band first!
          </AlertDescription>
        </Alert>
      )}

      {activeBand && (
        <Card className="bg-muted/30">
          <CardContent className="py-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <Star className="h-5 w-5 text-yellow-500" />
                <span className="text-sm">
                  <strong>{activeBand.name}</strong> · Fame: <strong>{bandFame.toLocaleString()}</strong>
                  {bandGenre && <> · Genre: <strong>{bandGenre}</strong></>}
                </span>
              </div>
              <div className="flex gap-2 text-xs">
                <Badge variant="outline">Max {MAX_EVENTS_PER_YEAR} events/year</Badge>
                <Badge variant="outline">{COOLDOWN_YEARS}yr cooldown after performing</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="upcoming">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upcoming" className="gap-1">
            <Calendar className="h-4 w-4" /> Upcoming
          </TabsTrigger>
          <TabsTrigger value="my-performances" className="gap-1">
            <Play className="h-4 w-4" /> My Performances ({completedPerformances.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1">
            <History className="h-4 w-4" /> Event History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-6">
          {events.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No upcoming events at this time.</p>
              </CardContent>
            </Card>
          ) : (
            sortedYears.map((yr) => (
              <div key={yr} className="space-y-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground">Game Year {yr}</h2>
                  {calendar && yr === calendar.gameYear && (
                    <Badge variant="default" className="text-xs">Current Year</Badge>
                  )}
                  {activeBand && (yearCounts[yr] || 0) > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {yearCounts[yr]}/{MAX_EVENTS_PER_YEAR} slots used
                    </Badge>
                  )}
                </div>
                {eventsByYear[yr]
                  .sort((a, b) => (a.event?.month || 0) - (b.event?.month || 0))
                  .map((instance) => {
                    const event = instance.event;
                    if (!event) return null;

                    const qualified = bandFame >= event.min_fame_required;
                    const existingPerformance = getPerformanceForInstance(instance.id);
                    const catColor = categoryColors[event.category] || categoryColors.sports;
                    const isCurrentYear = calendar && yr === calendar.gameYear;
                    const isPastInCurrentYear = isCurrentYear && event.month < (calendar?.gameMonth || 0);
                    const blockReason = getBlockReason(instance);

                    return (
                      <Card key={instance.id} className={`transition-all ${(!qualified || blockReason) ? 'opacity-60' : ''} ${isPastInCurrentYear ? 'opacity-50' : ''}`}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-3">
                              <div className="flex items-center gap-3">
                                <span className="text-2xl">{categoryIcons[event.category] || '🎤'}</span>
                                <div>
                                  <h3 className="text-lg font-bold">{event.name}</h3>
                                  <p className="text-sm text-muted-foreground">{event.description}</p>
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <Badge variant="outline" className={catColor}>
                                  {event.category.charAt(0).toUpperCase() + event.category.slice(1)}
                                </Badge>
                                {(event as any).genre && (
                                  <Badge variant="outline" className="gap-1 bg-accent/30">
                                    <Guitar className="h-3 w-3" />
                                    {(event as any).genre}
                                  </Badge>
                                )}
                                {!(event as any).genre && (
                                  <Badge variant="outline" className="gap-1 text-muted-foreground">
                                    <Guitar className="h-3 w-3" />
                                    Any Genre
                                  </Badge>
                                )}
                                <Badge variant="outline" className="gap-1">
                                  <Clock className="h-3 w-3" />
                                  {getMonthName(event.month)}, Year {yr} · {(event as any).duration_hours || 3}h
                                </Badge>
                                <Badge variant="outline" className="gap-1">
                                  <Repeat className="h-3 w-3" />
                                  {(event as any).frequency_years === 1 ? 'Annual' : `Every ${(event as any).frequency_years} years`}
                                </Badge>
                                <Badge variant="outline" className="gap-1">
                                  <Users className="h-3 w-3" />
                                  {event.audience_size.toLocaleString()}
                                </Badge>
                                <Badge variant="outline" className="gap-1">
                                  <DollarSign className="h-3 w-3" />
                                  ${(event.base_cash_reward / 1000).toFixed(0)}K - ${(event.max_cash_reward / 1000).toFixed(0)}K
                                </Badge>
                                <Badge variant="outline" className="gap-1">
                                  <TrendingUp className="h-3 w-3" />
                                  {event.fame_multiplier}x fame
                                </Badge>
                                <Badge variant="outline" className="gap-1">
                                  <Star className="h-3 w-3" />
                                  Min Fame: {event.min_fame_required.toLocaleString()}
                                </Badge>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-2 shrink-0">
                              {existingPerformance ? (
                                existingPerformance.status === 'completed' ? (
                                  <Badge className="bg-green-500">
                                    <CheckCircle className="h-3 w-3 mr-1" /> Completed
                                  </Badge>
                                ) : (
                                  <Button 
                                    onClick={() => navigate(`/major-events/perform/${existingPerformance.id}`)}
                                    className="gap-2"
                                  >
                                    <Play className="h-4 w-4" />
                                    {existingPerformance.status === 'in_progress' ? 'Watch Live' : 'Perform Now'}
                                  </Button>
                                )
                              ) : blockReason ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Badge variant="secondary" className="gap-1">
                                        <Ban className="h-3 w-3" /> Blocked
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-[250px]">
                                      <p>{blockReason}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : qualified ? (
                                <Button
                                  onClick={() => handleAcceptInvitation(
                                    instance.id,
                                    instance.event_start || instance.event_date || '',
                                    instance.event_end || instance.event_date || '',
                                    event.name,
                                  )}
                                  disabled={!activeBand || acceptEvent.isPending}
                                  className="gap-2"
                                >
                                  {acceptEvent.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Sparkles className="h-4 w-4" />
                                  )}
                                  Accept Invitation
                                </Button>
                              ) : (
                                <Badge variant="secondary" className="gap-1">
                                  <Lock className="h-3 w-3" /> Need {event.min_fame_required} Fame
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="my-performances" className="space-y-4">
          {completedPerformances.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Trophy className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No completed performances yet. Accept an invitation to get started!</p>
              </CardContent>
            </Card>
          ) : (
            completedPerformances.map(p => (
              <Card key={p.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">
                        {categoryIcons[p.instance?.event?.category || 'sports'] || '🎤'}
                      </span>
                      <div>
                        <p className="font-bold">{p.instance?.event?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Game Year {p.instance?.year} · {getMonthName(p.instance?.event?.month || 1)} · Rating: {(p.overall_rating || 0).toFixed(1)}%
                        </p>
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="text-green-500 font-medium">${(p.cash_earned || 0).toLocaleString()}</span>
                          <span className="text-yellow-500 font-medium">+{(p.fame_gained || 0).toLocaleString()} fame</span>
                          <span className="text-pink-500 font-medium">+{(p.fans_gained || 0).toLocaleString()} fans</span>
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => navigate(`/major-events/perform/${p.id}`)}>
                      View Report
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {loadingHistory ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : historyInstances.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <History className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No past event instances yet.</p>
              </CardContent>
            </Card>
          ) : (
            historyInstances.map(instance => {
              const event = instance.event;
              if (!event) return null;
              const playerPerf = performances.find(p => p.instance_id === instance.id && p.status === 'completed');
              const catColor = categoryColors[event.category] || categoryColors.sports;

              return (
                <Card key={instance.id} className={playerPerf ? 'border-primary/30' : ''}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{categoryIcons[event.category] || '🎤'}</span>
                        <div>
                          <h3 className="font-bold">{event.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            Game Year {instance.year} · {getMonthName(event.month)} · {event.audience_size.toLocaleString()} audience
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="outline" className={catColor}>
                          {event.category.charAt(0).toUpperCase() + event.category.slice(1)}
                        </Badge>
                        {playerPerf ? (
                          <div className="text-right">
                            <Badge className="bg-green-500/80 text-xs">
                              Performed — {(playerPerf.overall_rating || 0).toFixed(0)}%
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs mt-1"
                              onClick={() => navigate(`/major-events/perform/${playerPerf.id}`)}
                            >
                              View Report
                            </Button>
                          </div>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Not Performed</Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      <MajorEventSongSelector
        open={songSelectorOpen}
        onOpenChange={setSongSelectorOpen}
        onConfirm={handleSongConfirm}
        bandId={activeBand?.id}
      />
    </div>
  );
}
