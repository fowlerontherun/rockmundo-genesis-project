import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, ListMusic, Music, Users, Volume2, Wrench } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useSetlists } from '@/hooks/useSetlists';
import { SOUNDCHECK_TYPES, validateSoundcheckPlan, type SoundcheckType } from '@/utils/gigStageProduction';
import { validateGigSetlist } from '@/utils/gigSetlistValidation';

interface GigSetlistItem {
  id: string;
  song_id: string;
  position: number;
  is_encore: boolean;
  songs?: {
    id: string;
    title: string | null;
    duration_seconds: number | null;
  } | null;
}

const fmt = (seconds: number | null | undefined) => {
  if (seconds == null) return 'Missing';
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

export function GigPreparationPanel({ gigId, bandId, status, scheduledDate, slotDurationSeconds = 7200 }: {
  gigId: string;
  bandId: string;
  status?: string | null;
  scheduledDate?: string | null;
  slotDurationSeconds?: number;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: savedSetlists } = useSetlists(bandId);
  const [replacementSetlistId, setReplacementSetlistId] = useState('');
  const [switching, setSwitching] = useState(false);
  const [soundcheckType, setSoundcheckType] = useState<SoundcheckType>('line_check');
  const [savingSoundcheck, setSavingSoundcheck] = useState(false);
  const locked = ['completed', 'cancelled', 'failed', 'in_progress', 'ready_for_completion', 'processing_outcome', 'live'].includes(status || '');

  const soundcheckQuery = useQuery({
    queryKey: ['gig-prep-soundcheck', gigId],
    enabled: !!gigId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('gig_soundcheck_plans').select('*').eq('gig_id', gigId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const setlistQuery = useQuery({
    queryKey: ['gig-prep-setlist', gigId],
    enabled: !!gigId && !!bandId,
    queryFn: async () => {
      const { data: gig, error: gigError } = await supabase
        .from('gigs')
        .select('setlist_id')
        .eq('id', gigId)
        .single();
      if (gigError) throw gigError;

      if (!gig?.setlist_id) {
        return {
          id: null as string | null,
          name: null as string | null,
          items: [] as GigSetlistItem[],
        };
      }

      const { data: setlist, error: setlistError } = await supabase
        .from('setlists')
        .select('id,name,band_id,is_active')
        .eq('id', gig.setlist_id)
        .maybeSingle();
      if (setlistError) throw setlistError;

      if (!setlist || setlist.band_id !== bandId) {
        return {
          id: null as string | null,
          name: null as string | null,
          items: [] as GigSetlistItem[],
        };
      }

      const { data: rawItems, error: itemsError } = await supabase
        .from('setlist_songs')
        .select('id,song_id,position,is_encore,songs(id,title,duration_seconds)')
        .eq('setlist_id', setlist.id)
        .order('position');
      if (itemsError) throw itemsError;

      const items = (rawItems || [])
        .filter((item: any) => !!item.song_id)
        .map((item: any) => ({
          id: item.id,
          song_id: item.song_id,
          position: item.position,
          is_encore: !!item.is_encore,
          songs: item.songs,
        })) as GigSetlistItem[];

      return {
        id: setlist.id,
        name: setlist.name,
        items,
      };
    },
  });

  const liveSetupQuery = useQuery({
    queryKey: ['gig-live-setup', gigId],
    enabled: !!gigId && !!bandId,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('preview-live-setup', { body: { gigId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
  });

  useEffect(() => {
    if (soundcheckQuery.data?.soundcheck_type) setSoundcheckType(soundcheckQuery.data.soundcheck_type);
  }, [soundcheckQuery.data]);

  useEffect(() => {
    setReplacementSetlistId(setlistQuery.data?.id || '');
  }, [setlistQuery.data?.id]);

  const currentItems = setlistQuery.data?.items || [];

  const validation = useMemo(() => validateGigSetlist(
    currentItems.map((item) => ({
      songId: item.song_id,
      bandId,
      durationSeconds: item.songs?.duration_seconds ?? null,
      isEncore: item.is_encore,
    })),
    bandId,
    slotDurationSeconds,
  ), [currentItems, bandId, slotDurationSeconds]);

  const soundcheckValidation = useMemo(() => validateSoundcheckPlan(
    { soundcheckType, scheduledStart: soundcheckQuery.data?.scheduled_start },
    { gigStart: scheduledDate || new Date().toISOString(), setupMinutes: 60 },
  ), [soundcheckType, soundcheckQuery.data, scheduledDate]);

  const setlistSaved = !!setlistQuery.data?.id && currentItems.length > 0 && validation.valid;
  const soundcheckDone = !!soundcheckQuery.data
    && soundcheckQuery.data.soundcheck_type !== 'none'
    && (soundcheckQuery.data.status === 'confirmed' || soundcheckQuery.data.status === 'completed');
  const readyPercent = (setlistSaved ? 50 : 0) + (soundcheckDone ? 50 : 0);
  const selectableSetlists = (savedSetlists || []).filter((setlist: any) => setlist.is_active !== false && (setlist.song_count ?? 0) >= 6);
  const selectionChanged = !!replacementSetlistId && replacementSetlistId !== setlistQuery.data?.id;

  const switchSetlist = async () => {
    if (!replacementSetlistId || locked || switching || !selectionChanged && !!setlistQuery.data?.id) return;
    setSwitching(true);
    try {
      const replacement = selectableSetlists.find((setlist: any) => setlist.id === replacementSetlistId);
      const { error } = await (supabase as any).rpc('select_gig_setlist', {
        p_gig_id: gigId,
        p_setlist_id: replacementSetlistId,
      });
      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['gig-prep-setlist', gigId] });
      await queryClient.invalidateQueries({ queryKey: ['gig-details', gigId] });
      await queryClient.invalidateQueries({ queryKey: ['gig-experience', gigId] });
      toast({
        title: setlistQuery.data?.id ? 'Gig setlist changed' : 'Gig setlist selected',
        description: `${replacement?.name || 'The selected setlist'} is now locked in for this gig.`,
      });
    } catch (error: any) {
      toast({
        title: 'Could not update setlist',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSwitching(false);
    }
  };

  const saveSoundcheck = async () => {
    if (savingSoundcheck || locked) return;
    setSavingSoundcheck(true);
    try {
      const { error } = await (supabase as any).rpc('save_gig_soundcheck_plan', {
        p_gig_id: gigId,
        p_soundcheck_type: soundcheckType,
        p_scheduled_start: soundcheckValidation.suggestedStart.toISOString(),
        p_status: 'confirmed',
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['gig-prep-soundcheck', gigId] });
      toast({ title: 'Soundcheck confirmed', description: `${SOUNDCHECK_TYPES[soundcheckType].label} booked for this gig.` });
    } catch (error: any) {
      toast({ title: 'Could not confirm soundcheck', description: error.message, variant: 'destructive' });
    } finally {
      setSavingSoundcheck(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Music className="h-5 w-5" /> Gig preparation</CardTitle>
        <CardDescription>
          This gig uses one of your saved setlists. Change the selected setlist here; edit the songs themselves from your normal Setlists screen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Setlist selected for this gig</p>
              <p className="text-lg font-semibold">
                {setlistQuery.isLoading ? 'Loading selected setlist…' : setlistQuery.data?.name || 'No saved setlist selected'}
              </p>
              <p className="text-sm text-muted-foreground">
                {currentItems.length} song{currentItems.length === 1 ? '' : 's'} · {fmt(validation.totalDurationSeconds)}
              </p>
            </div>
            <Badge variant={setlistQuery.data?.id ? 'default' : 'destructive'}>
              {setlistQuery.data?.id ? (locked ? 'Locked for performance' : 'Locked in') : 'Missing'}
            </Badge>
          </div>

          {!locked && (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Select value={replacementSetlistId} onValueChange={setReplacementSetlistId} disabled={selectableSetlists.length === 0}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={selectableSetlists.length ? 'Choose a saved setlist' : 'No eligible saved setlists'} />
                </SelectTrigger>
                <SelectContent>
                  {selectableSetlists.map((setlist: any) => (
                    <SelectItem key={setlist.id} value={setlist.id}>
                      {setlist.name} · {setlist.song_count ?? 0} items
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={switchSetlist}
                disabled={!replacementSetlistId || switching || (!!setlistQuery.data?.id && !selectionChanged)}
              >
                {switching
                  ? 'Updating…'
                  : !setlistQuery.data?.id
                    ? 'Use setlist'
                    : selectionChanged
                      ? 'Change setlist'
                      : 'Setlist locked in'}
              </Button>
            </div>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-[160px_1fr]">
          <div>
            <div className="text-3xl font-bold">{readyPercent}%</div>
            <Badge variant={readyPercent === 100 ? 'default' : 'outline'}>{readyPercent === 100 ? 'Show ready' : 'In progress'}</Badge>
          </div>
          <div>
            <Progress value={readyPercent} className="h-3" />
            <p className="mt-2 text-sm text-muted-foreground">Set duration {fmt(validation.totalDurationSeconds)} / booked {fmt(slotDurationSeconds)}.</p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-md border p-2 text-sm">
            <span>1. Setlist selected</span>
            <Badge variant={setlistSaved ? 'outline' : 'destructive'}>{setlistSaved ? 'done' : 'pending'}</Badge>
          </div>
          <div className="flex items-center justify-between rounded-md border p-2 text-sm">
            <span>2. Soundcheck completed</span>
            <Badge variant={soundcheckDone ? 'outline' : 'destructive'}>{soundcheckDone ? 'done' : 'pending'}</Badge>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><Wrench className="h-4 w-4" />Live Setup</CardTitle>
            <CardDescription>Shared stage equipment and show crew readiness.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {liveSetupQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Checking your Live Setup…</p>
            ) : liveSetupQuery.isError ? (
              <p className="text-sm text-destructive">Live Setup could not be calculated.</p>
            ) : liveSetupQuery.data ? (
              <>
                <div className="flex items-center justify-between"><span className="text-sm">Overall readiness</span><strong>{liveSetupQuery.data.score}/100</strong></div>
                <Progress value={liveSetupQuery.data.score} className="h-2" />
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm font-medium"><Volume2 className="h-4 w-4" />Band Equipment</span>
                      <span className="font-semibold">{liveSetupQuery.data.equipmentScore}/100</span>
                    </div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm font-medium"><Users className="h-4 w-4" />Show Crew</span>
                      <span className="font-semibold">{liveSetupQuery.data.crewScore}/100</span>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        {validation.errors.map((message) => (
          <p key={message} className="flex gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />{message}</p>
        ))}
        {validation.warnings.map((message) => (
          <p key={message} className="flex gap-2 text-sm text-amber-600"><AlertTriangle className="h-4 w-4" />{message}</p>
        ))}
        {validation.valid && setlistQuery.data?.id && (
          <p className="flex gap-2 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" />The selected saved setlist is valid for this gig.</p>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><ListMusic className="h-4 w-4" />Selected setlist</CardTitle>
            <CardDescription>Read-only here. Any song changes should be made to the saved setlist itself.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {setlistQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading songs…</p>
            ) : currentItems.length === 0 ? (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Choose a saved setlist for this gig.</p>
            ) : (
              currentItems.map((item, index) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{index + 1}. {item.songs?.title || 'Unknown song'}</p>
                    <p className="text-xs text-muted-foreground">{fmt(item.songs?.duration_seconds)}</p>
                  </div>
                  {item.is_encore && <Badge variant="outline">Encore</Badge>}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><Volume2 className="h-4 w-4" />Soundcheck</CardTitle>
            <CardDescription>{SOUNDCHECK_TYPES[soundcheckType].label} · {soundcheckValidation.durationMinutes}m · ${soundcheckValidation.estimatedCost}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={soundcheckType} onValueChange={(value) => setSoundcheckType(value as SoundcheckType)} disabled={locked}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(SOUNDCHECK_TYPES).map(([key, pkg]) => <SelectItem key={key} value={key}>{pkg.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">Suggested start {soundcheckValidation.suggestedStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.</p>
            {[...soundcheckValidation.errors, ...soundcheckValidation.warnings].map((message) => (
              <p key={message} className="flex gap-2 text-xs text-amber-600"><AlertTriangle className="h-3 w-3" />{message}</p>
            ))}
            <Button onClick={saveSoundcheck} disabled={savingSoundcheck || locked} variant="outline" className="w-full">
              {savingSoundcheck ? 'Saving…' : soundcheckDone ? 'Update soundcheck' : 'Complete soundcheck'}
            </Button>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}
