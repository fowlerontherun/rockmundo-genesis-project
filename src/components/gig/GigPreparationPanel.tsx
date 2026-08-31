import { useEffect, useMemo, useState } from 'react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, GripVertical, Music, Plus, Save, Trash2, Users, Volume2, Wrench } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useSetlists } from '@/hooks/useSetlists';
import { SOUNDCHECK_TYPES, validateSoundcheckPlan, type SoundcheckType } from '@/utils/gigStageProduction';
import { validateGigSetlist } from '@/utils/gigSetlistValidation';

interface DraftItem {
  id: string;
  song_id: string;
  title: string;
  duration_seconds: number | null;
  is_encore: boolean;
  rehearsal_level?: number | null;
}

const fmt = (seconds: number | null | undefined) =>
  seconds ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : 'Missing';

function SortableSong({ item, index, onEncore, onRemove, onMove }: {
  item: DraftItem;
  index: number;
  onEncore: (id: string, value: boolean) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, delta: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="flex flex-col gap-2 rounded-md border bg-card p-3 sm:flex-row sm:items-center">
      <button className="self-start text-muted-foreground" aria-label={`Drag ${item.title}`} {...attributes} {...listeners}><GripVertical className="h-4 w-4" /></button>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{index + 1}. {item.title}</p>
        <p className="text-xs text-muted-foreground">{fmt(item.duration_seconds)} · rehearsal {Math.round(item.rehearsal_level ?? 0)}%</p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => onMove(item.id, -1)} disabled={index === 0}>Up</Button>
        <Button variant="outline" size="sm" onClick={() => onMove(item.id, 1)} disabled={index === Number.MAX_SAFE_INTEGER}>Down</Button>
        <label className="flex items-center gap-2 text-sm"><Switch checked={item.is_encore} onCheckedChange={(v) => onEncore(item.id, v)} /> Encore</label>
        <Button variant="ghost" size="icon" onClick={() => onRemove(item.id)} aria-label={`Remove ${item.title}`}><Trash2 className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

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
  const [draft, setDraft] = useState<DraftItem[]>([]);
  const [selectedSong, setSelectedSong] = useState('');
  const [replacementSetlistId, setReplacementSetlistId] = useState('');
  const [saving, setSaving] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [soundcheckType, setSoundcheckType] = useState<SoundcheckType>('line_check');
  const [savingSoundcheck, setSavingSoundcheck] = useState(false);
  const locked = status === 'completed' || status === 'cancelled';

  const songsQuery = useQuery({
    queryKey: ['gig-prep-songs', bandId],
    enabled: !!bandId,
    queryFn: async () => {
      const { data, error } = await supabase.from('songs').select('id,title,duration_seconds,band_id,status,archived').eq('band_id', bandId).eq('archived', false).order('title');
      if (error) throw error;
      const ids = (data || []).map((s) => s.id);
      const { data: rehearsals } = ids.length
        ? await supabase.from('song_rehearsals').select('song_id,rehearsal_level').eq('band_id', bandId).in('song_id', ids)
        : { data: [] as any[] };
      return (data || []).map((s: any) => ({ ...s, rehearsal_level: rehearsals?.find((r: any) => r.song_id === s.id)?.rehearsal_level ?? 0 }));
    },
  });

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
    enabled: !!gigId,
    queryFn: async () => {
      const { data: gig, error: gigError } = await supabase.from('gigs').select('setlist_id').eq('id', gigId).single();
      if (gigError) throw gigError;

      // Force the server-side reconciliation first. This makes the booked setlist the
      // authoritative source even when the per-gig snapshot was created by an older flow.
      if (gig?.setlist_id) {
        const { error: ensureError } = await (supabase as any).rpc('ensure_gig_preparation_from_booked_setlist', { p_gig_id: gigId });
        if (ensureError) console.warn('Could not reconcile booked gig setlist', ensureError);
      }

      const { data, error } = await (supabase as any)
        .from('gig_setlists')
        .select('id,name,total_duration_seconds,gig_setlist_items(id,song_id,position,is_encore,songs(id,title,duration_seconds))')
        .eq('gig_id', gigId)
        .maybeSingle();
      if (error) throw error;

      if (data?.gig_setlist_items?.length) return data;
      if (!gig?.setlist_id) return data;

      // Final read fallback: show the exact setlist referenced by gigs.setlist_id rather
      // than ever presenting the player with an empty setlist when booking data exists.
      const { data: legacySetlist } = await supabase.from('setlists').select('id,name').eq('id', gig.setlist_id).maybeSingle();
      const { data: legacyItems, error: legacyError } = await supabase
        .from('setlist_songs')
        .select('id,song_id,position,is_encore,songs(id,title,duration_seconds)')
        .eq('setlist_id', gig.setlist_id)
        .order('position');
      if (legacyError) throw legacyError;

      return {
        id: gig.setlist_id,
        name: legacySetlist?.name || 'Booked setlist',
        total_duration_seconds: null,
        gig_setlist_items: (legacyItems || []).map((item: any, index: number) => ({ ...item, position: item.position ?? index + 1 })),
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
    const items = (setlistQuery.data?.gig_setlist_items || []).slice().sort((a: any, b: any) => a.position - b.position).map((item: any) => ({
      id: item.id,
      song_id: item.song_id,
      title: item.songs?.title || 'Unknown song',
      duration_seconds: item.songs?.duration_seconds ?? null,
      is_encore: !!item.is_encore,
      rehearsal_level: songsQuery.data?.find((s: any) => s.id === item.song_id)?.rehearsal_level ?? 0,
    }));
    setDraft(items);
  }, [setlistQuery.data, songsQuery.data]);

  const validation = useMemo(() => validateGigSetlist(
    draft.map((d) => ({ songId: d.song_id, bandId, durationSeconds: d.duration_seconds, isEncore: d.is_encore })),
    bandId,
    slotDurationSeconds,
  ), [draft, bandId, slotDurationSeconds]);

  const soundcheckValidation = useMemo(() => validateSoundcheckPlan(
    { soundcheckType, scheduledStart: soundcheckQuery.data?.scheduled_start },
    { gigStart: scheduledDate || new Date().toISOString(), setupMinutes: 60 },
  ), [soundcheckType, soundcheckQuery.data, scheduledDate]);

  const setlistSaved = draft.length > 0 && validation.valid;
  const soundcheckDone = !!soundcheckQuery.data && soundcheckQuery.data.soundcheck_type !== 'none' && (soundcheckQuery.data.status === 'confirmed' || soundcheckQuery.data.status === 'completed');
  const readyPercent = (setlistSaved ? 50 : 0) + (soundcheckDone ? 50 : 0);
  const available = (songsQuery.data || []).filter((s: any) => !draft.some((d) => d.song_id === s.id));
  const selectableSetlists = (savedSetlists || []).filter((s: any) => s.is_active !== false && (s.song_count ?? 0) > 0);

  const addSong = () => {
    const song: any = available.find((s: any) => s.id === selectedSong);
    if (!song) return;
    setDraft((d) => [...d, { id: `draft-${song.id}`, song_id: song.id, title: song.title, duration_seconds: song.duration_seconds, is_encore: false, rehearsal_level: song.rehearsal_level }]);
    setSelectedSong('');
  };

  const switchSetlist = async () => {
    if (!replacementSetlistId || locked || switching) return;
    setSwitching(true);
    try {
      const replacement = selectableSetlists.find((s: any) => s.id === replacementSetlistId);
      const { data: items, error } = await supabase
        .from('setlist_songs')
        .select('song_id,position,is_encore')
        .eq('setlist_id', replacementSetlistId)
        .order('position');
      if (error) throw error;
      if (!items?.length) throw new Error('That setlist has no songs.');

      const { error: saveError } = await (supabase as any).rpc('save_gig_setlist', {
        p_gig_id: gigId,
        p_name: replacement?.name || 'Gig setlist',
        p_items: items.map((item: any, index: number) => ({ song_id: item.song_id, position: item.position ?? index + 1, is_encore: !!item.is_encore })),
      });
      if (saveError) throw saveError;

      setReplacementSetlistId('');
      await queryClient.invalidateQueries({ queryKey: ['gig-prep-setlist', gigId] });
      await queryClient.invalidateQueries({ queryKey: ['gig-details', gigId] });
      toast({ title: 'Gig setlist changed', description: `${replacement?.name || 'The selected setlist'} will now be used for this gig.` });
    } catch (e: any) {
      toast({ title: 'Could not change setlist', description: e.message, variant: 'destructive' });
    } finally {
      setSwitching(false);
    }
  };

  const save = async () => {
    if (!validation.valid || saving || locked) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any).rpc('save_gig_setlist', {
        p_gig_id: gigId,
        p_name: setlistQuery.data?.name || 'Gig setlist',
        p_items: draft.map((d, i) => ({ song_id: d.song_id, position: i + 1, is_encore: d.is_encore })),
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['gig-prep-setlist', gigId] });
      await queryClient.invalidateQueries({ queryKey: ['gig-details', gigId] });
      toast({ title: 'Setlist saved', description: 'Gig preparation has been updated.' });
    } catch (e: any) {
      toast({ title: 'Could not save setlist', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
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
    } catch (e: any) {
      toast({ title: 'Could not confirm soundcheck', description: e.message, variant: 'destructive' });
    } finally {
      setSavingSoundcheck(false);
    }
  };

  const onDragEnd = (event: DragEndEvent) => {
    if (!event.over || event.active.id === event.over.id) return;
    setDraft((items) => arrayMove(items, items.findIndex((i) => i.id === event.active.id), items.findIndex((i) => i.id === event.over?.id)));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Music className="h-5 w-5" /> Gig preparation</CardTitle>
        <CardDescription>The setlist selected during booking is the active setlist for this gig. You can switch to another saved setlist or customise this gig-specific copy.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Active gig setlist</p>
              <p className="text-lg font-semibold">{setlistQuery.isLoading ? 'Loading booked setlist…' : setlistQuery.data?.name || 'No setlist selected'}</p>
              <p className="text-sm text-muted-foreground">{draft.length} song{draft.length === 1 ? '' : 's'} · {fmt(validation.totalDurationSeconds)}</p>
            </div>
            <Badge variant={draft.length > 0 ? 'default' : 'destructive'}>{draft.length > 0 ? 'Booked' : 'Missing'}</Badge>
          </div>
          {!locked && selectableSetlists.length > 0 && (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Select value={replacementSetlistId} onValueChange={setReplacementSetlistId}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Change to another saved setlist" /></SelectTrigger>
                <SelectContent>{selectableSetlists.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name} · {s.song_count ?? 0} songs</SelectItem>)}</SelectContent>
              </Select>
              <Button variant="outline" onClick={switchSetlist} disabled={!replacementSetlistId || switching}>{switching ? 'Changing…' : 'Change setlist'}</Button>
            </div>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-[160px_1fr]">
          <div><div className="text-3xl font-bold">{readyPercent}%</div><Badge variant={readyPercent === 100 ? 'default' : 'outline'}>{readyPercent === 100 ? 'Show ready' : 'In progress'}</Badge></div>
          <div><Progress value={readyPercent} className="h-3" /><p className="mt-2 text-sm text-muted-foreground">Set duration {fmt(validation.totalDurationSeconds)} / booked {fmt(slotDurationSeconds)}.</p></div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-md border p-2 text-sm"><span>1. Setlist selected</span><Badge variant={setlistSaved ? 'outline' : 'destructive'}>{setlistSaved ? 'done' : 'pending'}</Badge></div>
          <div className="flex items-center justify-between rounded-md border p-2 text-sm"><span>2. Soundcheck completed</span><Badge variant={soundcheckDone ? 'outline' : 'destructive'}>{soundcheckDone ? 'done' : 'pending'}</Badge></div>
        </div>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Wrench className="h-4 w-4" />Live Setup</CardTitle><CardDescription>Shared stage equipment and show crew readiness.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {liveSetupQuery.isLoading ? <p className="text-sm text-muted-foreground">Checking your Live Setup…</p> : liveSetupQuery.isError ? <p className="text-sm text-destructive">Live Setup could not be calculated.</p> : liveSetupQuery.data ? <>
              <div className="flex items-center justify-between"><span className="text-sm">Overall readiness</span><strong>{liveSetupQuery.data.score}/100</strong></div>
              <Progress value={liveSetupQuery.data.score} className="h-2" />
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-md border p-3"><div className="flex items-center justify-between"><span className="flex items-center gap-2 text-sm font-medium"><Volume2 className="h-4 w-4" />Band Equipment</span><span className="font-semibold">{liveSetupQuery.data.equipmentScore}/100</span></div></div>
                <div className="rounded-md border p-3"><div className="flex items-center justify-between"><span className="flex items-center gap-2 text-sm font-medium"><Users className="h-4 w-4" />Show Crew</span><span className="font-semibold">{liveSetupQuery.data.crewScore}/100</span></div></div>
              </div>
            </> : null}
          </CardContent>
        </Card>

        {validation.errors.map((m) => <p key={m} className="flex gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />{m}</p>)}
        {validation.warnings.map((m) => <p key={m} className="flex gap-2 text-sm text-amber-600"><AlertTriangle className="h-4 w-4" />{m}</p>)}
        {validation.valid && <p className="flex gap-2 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" />The booked setlist is valid. Any edits below affect this gig only.</p>}

        {!locked && <div className="flex gap-2">
          <Select value={selectedSong} onValueChange={setSelectedSong}><SelectTrigger><SelectValue placeholder={songsQuery.isLoading ? 'Loading songs...' : 'Add a band song'} /></SelectTrigger><SelectContent>{available.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.title} · {fmt(s.duration_seconds)}</SelectItem>)}</SelectContent></Select>
          <Button onClick={addSong} disabled={!selectedSong}><Plus className="mr-2 h-4 w-4" />Add</Button>
        </div>}

        <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={draft.map((d) => d.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">{draft.length === 0 ? <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No songs could be loaded for this gig setlist.</p> : draft.map((item, index) => <SortableSong key={item.id} item={item} index={index} onEncore={(id, v) => setDraft((d) => d.map((i) => i.id === id ? { ...i, is_encore: v } : i))} onRemove={(id) => setDraft((d) => d.filter((i) => i.id !== id))} onMove={(id, delta) => setDraft((d) => { const from = d.findIndex((i) => i.id === id); const to = Math.max(0, Math.min(d.length - 1, from + delta)); return arrayMove(d, from, to); })} />)}</div>
          </SortableContext>
        </DndContext>

        {!locked && <Button onClick={save} disabled={saving || !validation.valid} className="w-full"><Save className="mr-2 h-4 w-4" />{saving ? 'Saving...' : 'Save changes to this gig setlist'}</Button>}

        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Volume2 className="h-4 w-4" />Soundcheck</CardTitle><CardDescription>{SOUNDCHECK_TYPES[soundcheckType].label} · {soundcheckValidation.durationMinutes}m · ${soundcheckValidation.estimatedCost}</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <Select value={soundcheckType} onValueChange={(v) => setSoundcheckType(v as SoundcheckType)} disabled={locked}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(SOUNDCHECK_TYPES).map(([key, pkg]) => <SelectItem key={key} value={key}>{pkg.label}</SelectItem>)}</SelectContent></Select>
            <p className="text-sm text-muted-foreground">Suggested start {soundcheckValidation.suggestedStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.</p>
            {[...soundcheckValidation.errors, ...soundcheckValidation.warnings].map((m) => <p key={m} className="flex gap-2 text-xs text-amber-600"><AlertTriangle className="h-3 w-3" />{m}</p>)}
            <Button onClick={saveSoundcheck} disabled={savingSoundcheck || locked} variant="outline" className="w-full"><Save className="mr-2 h-4 w-4" />{savingSoundcheck ? 'Saving...' : soundcheckDone ? 'Update soundcheck' : 'Complete soundcheck'}</Button>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}
