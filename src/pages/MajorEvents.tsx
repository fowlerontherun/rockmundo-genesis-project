import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { usePrimaryBand } from "@/hooks/usePrimaryBand";
import {
  useMajorEvents,
  useMajorEventPerformances,
  useMajorEventHistory,
  useMajorEventApplications,
  useApplyToMajorEvent,
  useAcceptMajorEvent,
  useBandEventCooldowns,
  useBandYearEventCount,
} from "@/hooks/useMajorEvents";
import { useGameCalendar } from "@/hooks/useGameCalendar";
import { MajorEventSongSelector } from "@/components/major-events/MajorEventSongSelector";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
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
  Ban, Guitar, Send, MailCheck, CircleHelp,
} from "lucide-react";

const categoryIcons: Record<string, string> = { sports: '🏟️', music: '🎵', tv: '📺', holiday: '🎆' };
const categoryColors: Record<string, string> = {
  sports: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  music: 'bg-purple-500/10 text-purple-500 border-purple-500/30',
  tv: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  holiday: 'bg-red-500/10 text-red-500 border-red-500/30',
};
const MAX_EVENTS_PER_YEAR = 2;

export default function MajorEvents() {
  const { profileId } = useActiveProfile();
  const { data: primaryBand } = usePrimaryBand();
  const activeBand = primaryBand?.bands ? { id: primaryBand.band_id, ...primaryBand.bands } as any : null;
  const navigate = useNavigate();
  const { data: events = [], isLoading } = useMajorEvents();
  const { data: performances = [] } = useMajorEventPerformances(profileId ?? undefined);
  const { data: historyInstances = [], isLoading: loadingHistory } = useMajorEventHistory();
  const { data: applications = [] } = useMajorEventApplications(activeBand?.id);
  const { data: calendar } = useGameCalendar();
  const applyToEvent = useApplyToMajorEvent();
  const acceptEvent = useAcceptMajorEvent();
  const { data: cooldowns = {} } = useBandEventCooldowns(activeBand?.id);
  const { data: yearCounts = {} } = useBandYearEventCount(activeBand?.id);

  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [selectedEventStart, setSelectedEventStart] = useState('');
  const [selectedEventEnd, setSelectedEventEnd] = useState('');
  const [selectedEventName, setSelectedEventName] = useState('');
  const [songSelectorOpen, setSongSelectorOpen] = useState(false);

  const bandFame = activeBand?.fame || 0;
  const bandGenre = activeBand?.primary_genre || activeBand?.genre || null;

  const applicationsByInstance = useMemo(() => {
    const map: Record<string, typeof applications[number]> = {};
    for (const app of applications) map[app.instance_id] = app;
    return map;
  }, [applications]);

  const performanceByInstance = useMemo(() => {
    const map: Record<string, typeof performances[number]> = {};
    for (const performance of performances) map[performance.instance_id] = performance;
    return map;
  }, [performances]);

  const openSongSelector = (instanceId: string, start: string, end: string, name: string) => {
    setSelectedInstance(instanceId);
    setSelectedEventStart(start);
    setSelectedEventEnd(end);
    setSelectedEventName(name);
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

  const getBlockReason = (instance: typeof events[number]) => {
    const event = instance.event;
    if (!event || !activeBand) return null;
    if (event.genre && event.genre !== bandGenre) return `Genre mismatch — this event is for ${event.genre} bands`;
    if ((yearCounts[instance.year] || 0) >= MAX_EVENTS_PER_YEAR) return `Your band already has ${MAX_EVENTS_PER_YEAR} major events in Year ${instance.year}`;
    const lastPerformed = cooldowns[event.id];
    const cooldownYears = event.cooldown_years || 3;
    if (lastPerformed && instance.year - lastPerformed < cooldownYears) return `Cooldown — your band can return in Year ${lastPerformed + cooldownYears}`;
    return null;
  };

  const eventsByYear = events.reduce((acc, instance) => {
    (acc[instance.year] ||= []).push(instance);
    return acc;
  }, {} as Record<number, typeof events>);
  const sortedYears = Object.keys(eventsByYear).map(Number).sort((a, b) => a - b);

  if (isLoading) {
    return <FMPageScaffold title="Major Events" icon={Trophy} backTo="/hub/events"><div className="flex min-h-[400px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></FMPageScaffold>;
  }

  return (
    <FMPageScaffold title="Major Events" subtitle="Earn invitations or apply for open lineup slots at the world's biggest events." icon={Trophy} backTo="/hub/events">
      {calendar && (
        <Card className="bg-primary/5 border-primary/20"><CardContent className="py-3"><div className="flex items-center gap-3 text-sm"><Calendar className="h-4 w-4 text-primary" /><span>Currently: <strong>{getMonthName(calendar.gameMonth)} {calendar.gameDay}</strong>, Game Year <strong>{calendar.gameYear}</strong></span><Badge variant="outline" className="ml-auto text-xs capitalize">{calendar.seasonEmoji} {calendar.season}</Badge></div></CardContent></Card>
      )}

      {!activeBand ? (
        <Alert><Music className="h-4 w-4" /><AlertDescription>You need an active band to receive invitations or apply for major events.</AlertDescription></Alert>
      ) : (
        <Card className="bg-muted/30"><CardContent className="py-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><Star className="h-5 w-5 text-yellow-500" /><span className="text-sm"><strong>{activeBand.name}</strong> · Fame: <strong>{bandFame.toLocaleString()}</strong>{bandGenre && <> · Genre: <strong>{bandGenre}</strong></>}</span></div><div className="flex flex-wrap gap-2 text-xs"><Badge variant="outline">Top bands receive direct invites</Badge><Badge variant="outline">Other eligible bands can apply</Badge><Badge variant="outline">Max {MAX_EVENTS_PER_YEAR}/year</Badge></div></div></CardContent></Card>
      )}

      <Alert className="border-primary/20 bg-primary/5"><CircleHelp className="h-4 w-4" /><AlertDescription><strong>How it works:</strong> direct invitations go to the highest-fame active bands that match the event genre. Remaining lineup places are open to applications from bands that meet the displayed application fame threshold. An accepted invitation or application still requires three recorded songs before the slot is confirmed.</AlertDescription></Alert>

      <Tabs defaultValue="upcoming">
        <TabsList className="grid w-full grid-cols-3"><TabsTrigger value="upcoming" className="gap-1"><Calendar className="h-4 w-4" /> Opportunities</TabsTrigger><TabsTrigger value="my-performances" className="gap-1"><Play className="h-4 w-4" /> My Performances ({performances.length})</TabsTrigger><TabsTrigger value="history" className="gap-1"><History className="h-4 w-4" /> History</TabsTrigger></TabsList>

        <TabsContent value="upcoming" className="space-y-6">
          {events.length === 0 ? <Card><CardContent className="py-8 text-center text-muted-foreground">No upcoming major events.</CardContent></Card> : sortedYears.map((year) => (
            <div key={year} className="space-y-3">
              <div className="flex items-center gap-2"><h2 className="text-lg font-bold">Game Year {year}</h2>{calendar?.gameYear === year && <Badge>Current Year</Badge>}{activeBand && (yearCounts[year] || 0) > 0 && <Badge variant="secondary">{yearCounts[year]}/{MAX_EVENTS_PER_YEAR} confirmed</Badge>}</div>
              {eventsByYear[year].sort((a, b) => (a.event?.month || 0) - (b.event?.month || 0)).map((instance) => {
                const event = instance.event;
                if (!event) return null;
                const performance = performanceByInstance[instance.id];
                const application = applicationsByInstance[instance.id];
                const invited = !!activeBand && (instance.invited_band_ids || []).includes(activeBand.id);
                const applicationThreshold = Math.ceil(event.min_fame_required * (event.application_fame_ratio ?? 0.75));
                const canApplyByFame = bandFame >= applicationThreshold;
                const blockReason = getBlockReason(instance);
                const start = instance.event_start || instance.event_date || '';
                const end = instance.event_end || instance.event_date || '';
                const past = start ? new Date(start) <= new Date() : false;
                const blocked = blockReason || (past ? 'This event has already started' : null);
                const accessAccepted = invited || application?.status === 'accepted';

                return (
                  <Card key={instance.id} className={blocked ? 'opacity-60' : ''}><CardContent className="pt-6"><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start"><div className="flex-1 space-y-3"><div className="flex items-center gap-3"><span className="text-2xl">{categoryIcons[event.category] || '🎤'}</span><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-bold">{event.name}</h3>{invited && <Badge className="gap-1"><MailCheck className="h-3 w-3" /> Direct invitation</Badge>}{application?.status === 'accepted' && !invited && <Badge className="gap-1 bg-green-600"><CheckCircle className="h-3 w-3" /> Application accepted</Badge>}</div><p className="text-sm text-muted-foreground">{event.description}</p></div></div><div className="flex flex-wrap gap-2"><Badge variant="outline" className={categoryColors[event.category] || categoryColors.sports}>{event.category}</Badge><Badge variant="outline" className="gap-1"><Guitar className="h-3 w-3" /> {event.genre || 'Any genre'}</Badge><Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> {getMonthName(event.month)}, Year {year} · {event.duration_hours || 3}h</Badge><Badge variant="outline" className="gap-1"><Users className="h-3 w-3" /> {event.audience_size.toLocaleString()}</Badge><Badge variant="outline" className="gap-1"><DollarSign className="h-3 w-3" /> ${(event.base_cash_reward / 1000).toFixed(0)}K–${(event.max_cash_reward / 1000).toFixed(0)}K</Badge><Badge variant="outline" className="gap-1"><TrendingUp className="h-3 w-3" /> {event.fame_multiplier}x fame</Badge><Badge variant="outline" className="gap-1"><Star className="h-3 w-3" /> Invite fame {event.min_fame_required.toLocaleString()}</Badge><Badge variant="outline" className="gap-1"><Send className="h-3 w-3" /> Apply from {applicationThreshold.toLocaleString()} fame</Badge><Badge variant="outline" className="gap-1"><Repeat className="h-3 w-3" /> {event.frequency_years === 1 ? 'Annual' : `Every ${event.frequency_years} years`}</Badge></div>{application?.decision_reason && <p className="text-xs text-muted-foreground">{application.decision_reason}</p>}</div>

                    <div className="flex min-w-[180px] flex-col items-stretch gap-2 lg:items-end">
                      {performance ? (
                        performance.status === 'completed' ? <Badge className="bg-green-600"><CheckCircle className="mr-1 h-3 w-3" /> Completed</Badge> : <Button onClick={() => navigate(`/major-events/perform/${performance.id}`)} className="gap-2"><Play className="h-4 w-4" /> {performance.status === 'in_progress' ? 'Watch Live' : 'Perform'}</Button>
                      ) : blocked ? (
                        <TooltipProvider><Tooltip><TooltipTrigger><Badge variant="secondary" className="gap-1"><Ban className="h-3 w-3" /> Blocked</Badge></TooltipTrigger><TooltipContent className="max-w-[260px]">{blocked}</TooltipContent></Tooltip></TooltipProvider>
                      ) : accessAccepted ? (
                        <Button onClick={() => openSongSelector(instance.id, start, end, event.name)} disabled={!activeBand || acceptEvent.isPending} className="gap-2">{acceptEvent.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Confirm place & songs</Button>
                      ) : application?.status === 'rejected' ? (
                        <Badge variant="secondary">Lineup full</Badge>
                      ) : application?.status === 'pending' ? (
                        <Badge variant="secondary">Application pending</Badge>
                      ) : canApplyByFame ? (
                        <Button variant="outline" onClick={() => activeBand && applyToEvent.mutate({ instanceId: instance.id, bandId: activeBand.id })} disabled={!activeBand || applyToEvent.isPending} className="gap-2">{applyToEvent.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Apply for lineup</Button>
                      ) : (
                        <Badge variant="secondary" className="gap-1"><Lock className="h-3 w-3" /> Need {applicationThreshold.toLocaleString()} fame to apply</Badge>
                      )}
                    </div>
                  </div></CardContent></Card>
                );
              })}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="my-performances" className="space-y-4">
          {performances.length === 0 ? <Card><CardContent className="py-8 text-center"><Trophy className="mx-auto mb-2 h-8 w-8 text-muted-foreground" /><p className="text-muted-foreground">No confirmed major event performances yet.</p></CardContent></Card> : performances.map((performance) => <Card key={performance.id}><CardContent className="flex flex-wrap items-center justify-between gap-4 py-5"><div><h3 className="font-semibold">{performance.instance?.event?.name || 'Major Event'}</h3><p className="text-sm text-muted-foreground">Year {performance.instance?.year} · Status: {performance.status.replace('_', ' ')}</p>{performance.status === 'completed' && <p className="mt-1 text-sm">Rating {performance.overall_rating ?? 0} · ${performance.cash_earned.toLocaleString()} · +{performance.fame_gained.toLocaleString()} fame · +{performance.fans_gained.toLocaleString()} fans</p>}</div>{performance.status !== 'completed' && <Button onClick={() => navigate(`/major-events/perform/${performance.id}`)}><Play className="mr-2 h-4 w-4" /> Open performance</Button>}</CardContent></Card>)}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {loadingHistory ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : historyInstances.length === 0 ? <Card><CardContent className="py-8 text-center text-muted-foreground">No historical events yet.</CardContent></Card> : historyInstances.slice(0, 50).map((instance) => <Card key={instance.id}><CardContent className="flex items-center justify-between gap-4 py-4"><div><h3 className="font-semibold">{instance.event?.name || 'Major Event'}</h3><p className="text-sm text-muted-foreground">{instance.event ? getMonthName(instance.event.month) : ''}, Game Year {instance.year}</p></div><Badge variant="outline">{instance.status}</Badge></CardContent></Card>)}
        </TabsContent>
      </Tabs>

      {activeBand && <MajorEventSongSelector open={songSelectorOpen} onOpenChange={setSongSelectorOpen} bandId={activeBand.id} onConfirm={handleSongConfirm} />}
    </FMPageScaffold>
  );
}
