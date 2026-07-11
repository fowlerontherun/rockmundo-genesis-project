import { useEffect, useMemo, useState } from 'react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, GripVertical, Music, Plus, Save, Trash2, Users, Wrench } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { calculateCrewEquipmentReadiness, GIG_CREW_ROLES, EQUIPMENT_ROLE_LABELS, type GigCrewRole, type EquipmentRole } from '@/utils/gigCrewEquipment';
import { validateGigSetlist } from '@/utils/gigSetlistValidation';

interface DraftItem { id: string; song_id: string; title: string; duration_seconds: number | null; is_encore: boolean; rehearsal_level?: number | null }
const fmt = (seconds: number | null | undefined) => seconds ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : 'Missing';

function SortableSong({ item, index, onEncore, onRemove, onMove }: { item: DraftItem; index: number; onEncore: (id: string, value: boolean) => void; onRemove: (id: string) => void; onMove: (id: string, delta: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="flex flex-col gap-2 rounded-md border bg-card p-3 sm:flex-row sm:items-center">
    <button className="self-start text-muted-foreground" aria-label={`Drag ${item.title}`} {...attributes} {...listeners}><GripVertical className="h-4 w-4" /></button>
    <div className="min-w-0 flex-1"><p className="font-medium">{index + 1}. {item.title}</p><p className="text-xs text-muted-foreground">{fmt(item.duration_seconds)} · rehearsal {Math.round(item.rehearsal_level ?? 0)}%</p></div>
    <div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => onMove(item.id, -1)} disabled={index === 0}>Up</Button><Button variant="outline" size="sm" onClick={() => onMove(item.id, 1)}>Down</Button><label className="flex items-center gap-2 text-sm"><Switch checked={item.is_encore} onCheckedChange={(v) => onEncore(item.id, v)} /> Encore</label><Button variant="ghost" size="icon" onClick={() => onRemove(item.id)} aria-label={`Remove ${item.title}`}><Trash2 className="h-4 w-4" /></Button></div>
  </div>;
}

export function GigPreparationPanel({ gigId, bandId, status, scheduledDate, slotDurationSeconds = 7200 }: { gigId: string; bandId: string; status?: string | null; scheduledDate?: string | null; slotDurationSeconds?: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [draft, setDraft] = useState<DraftItem[]>([]);
  const [selectedSong, setSelectedSong] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedCrewRole, setSelectedCrewRole] = useState<GigCrewRole>('sound_engineer');
  const [selectedNpcCrew, setSelectedNpcCrew] = useState('');
  const [selectedEquipmentRole, setSelectedEquipmentRole] = useState<EquipmentRole>('vocals_microphone');
  const [selectedBandEquipment, setSelectedBandEquipment] = useState('');
  const locked = status === 'completed' || status === 'cancelled';

  const songsQuery = useQuery({ queryKey: ['gig-prep-songs', bandId], enabled: !!bandId, queryFn: async () => {
    const { data, error } = await supabase.from('songs').select('id,title,duration_seconds,band_id,status,archived').eq('band_id', bandId).eq('archived', false).order('title');
    if (error) throw error;
    const ids = (data || []).map((s) => s.id);
    const { data: rehearsals } = ids.length ? await supabase.from('song_rehearsals').select('song_id,rehearsal_level').eq('band_id', bandId).in('song_id', ids) : { data: [] as any[] };
    return (data || []).map((s: any) => ({ ...s, rehearsal_level: rehearsals?.find((r: any) => r.song_id === s.id)?.rehearsal_level ?? 0 }));
  }});


  const crewQuery = useQuery({ queryKey: ['gig-prep-crew', gigId], enabled: !!gigId, queryFn: async () => {
    const { data, error } = await (supabase as any).from('gig_crew_assignments').select('*').eq('gig_id', gigId).order('crew_role');
    if (error) throw error;
    return data || [];
  }});

  const npcCrewQuery = useQuery({ queryKey: ['gig-prep-npc-crew', bandId], enabled: !!bandId, queryFn: async () => {
    const { data, error } = await supabase.from('band_crew_members').select('id,name,crew_type,skill_level,salary_per_gig,experience_years').eq('band_id', bandId).order('name');
    if (error) throw error;
    return data || [];
  }});

  const equipmentQuery = useQuery({ queryKey: ['gig-prep-equipment', gigId], enabled: !!gigId, queryFn: async () => {
    const { data, error } = await (supabase as any).from('gig_equipment_loadouts').select('*').eq('gig_id', gigId).order('equipment_role');
    if (error) throw error;
    return data || [];
  }});

  const bandEquipmentQuery = useQuery({ queryKey: ['gig-prep-band-equipment', bandId], enabled: !!bandId, queryFn: async () => {
    const { data, error } = await supabase.from('band_stage_equipment').select('id,equipment_type,equipment_name,quality_rating,condition').eq('band_id', bandId).order('equipment_name');
    if (error) throw error;
    return data || [];
  }});

  const setlistQuery = useQuery({ queryKey: ['gig-prep-setlist', gigId], enabled: !!gigId, queryFn: async () => {
    const { data, error } = await (supabase as any).from('gig_setlists').select('id,name,total_duration_seconds,gig_setlist_items(id,song_id,position,is_encore,songs(id,title,duration_seconds))').eq('gig_id', gigId).maybeSingle();
    if (error) throw error;
    return data;
  }});

  useEffect(() => {
    const items = (setlistQuery.data?.gig_setlist_items || []).slice().sort((a: any, b: any) => a.position - b.position).map((item: any) => ({ id: item.id, song_id: item.song_id, title: item.songs?.title || 'Unknown song', duration_seconds: item.songs?.duration_seconds ?? null, is_encore: !!item.is_encore, rehearsal_level: songsQuery.data?.find((s: any) => s.id === item.song_id)?.rehearsal_level ?? 0 }));
    setDraft(items);
  }, [setlistQuery.data, songsQuery.data]);

  const validation = useMemo(() => validateGigSetlist(draft.map((d) => ({ songId: d.song_id, bandId, durationSeconds: d.duration_seconds, isEncore: d.is_encore })), bandId, slotDurationSeconds), [draft, bandId, slotDurationSeconds]);
  const readiness = useMemo(() => calculateCrewEquipmentReadiness({ baseSongs: draft.map((d) => ({ id: d.song_id, durationSeconds: d.duration_seconds, rehearsalLevel: d.rehearsal_level })), slotDurationSeconds, roles: [], crew: (crewQuery.data || []).map((c: any) => ({ role: c.crew_role, workerType: c.worker_type, status: c.assignment_status, baseAbility: c.effectiveness_score, fee: Number(c.agreed_fee || 0), coveredByEmployment: c.fee_covered_by_employment, attendance: c.attendance_status })), equipment: (equipmentQuery.data || []).map((e: any) => ({ equipmentRole: e.equipment_role, quality: e.quality_score, condition: e.condition_score, isPrimary: e.is_primary, isSpare: e.is_spare, rentalCost: Number(e.rental_cost || 0) })) }), [draft, slotDurationSeconds, crewQuery.data, equipmentQuery.data]);
  const available = (songsQuery.data || []).filter((s: any) => !draft.some((d) => d.song_id === s.id));

  const addSong = () => { const song: any = available.find((s: any) => s.id === selectedSong); if (!song) return; setDraft((d) => [...d, { id: `draft-${song.id}`, song_id: song.id, title: song.title, duration_seconds: song.duration_seconds, is_encore: false, rehearsal_level: song.rehearsal_level }]); setSelectedSong(''); };
  const assignCrew = async () => { if (!selectedNpcCrew || locked) return; try { const { error } = await (supabase as any).rpc('save_gig_crew_assignment', { p_gig_id: gigId, p_crew_role: selectedCrewRole, p_worker_type: 'npc_staff', p_npc_staff_id: selectedNpcCrew, p_assignment_status: 'accepted' }); if (error) throw error; toast({ title: 'Crew assigned', description: 'Gig crew assignment was saved.' }); queryClient.invalidateQueries({ queryKey: ['gig-prep-crew', gigId] }); } catch (e: any) { toast({ title: 'Could not assign crew', description: e.message, variant: 'destructive' }); } };
  const addEquipment = async () => { if (!selectedBandEquipment || locked) return; try { const { error } = await (supabase as any).rpc('save_gig_equipment_loadout', { p_gig_id: gigId, p_equipment_role: selectedEquipmentRole, p_source_type: 'band_owned', p_band_stage_equipment_id: selectedBandEquipment, p_is_primary: true, p_is_spare: false, p_rental_cost: 0 }); if (error) throw error; toast({ title: 'Equipment added', description: 'Gig equipment loadout was saved.' }); queryClient.invalidateQueries({ queryKey: ['gig-prep-equipment', gigId] }); } catch (e: any) { toast({ title: 'Could not add equipment', description: e.message, variant: 'destructive' }); } };
  const save = async () => { if (!validation.valid || saving) return; setSaving(true); try { const { error } = await (supabase as any).rpc('save_gig_setlist', { p_gig_id: gigId, p_name: 'Gig setlist', p_items: draft.map((d, i) => ({ song_id: d.song_id, position: i + 1, is_encore: d.is_encore })) }); if (error) throw error; toast({ title: 'Setlist saved', description: 'Gig preparation has been updated.' }); queryClient.invalidateQueries({ queryKey: ['gig-prep-setlist', gigId] }); queryClient.invalidateQueries({ queryKey: ['gig-details', gigId] }); } catch (e: any) { toast({ title: 'Could not save setlist', description: e.message, variant: 'destructive' }); } finally { setSaving(false); } };
  const onDragEnd = (event: DragEndEvent) => { if (!event.over || event.active.id === event.over.id) return; setDraft((items) => arrayMove(items, items.findIndex((i) => i.id === event.active.id), items.findIndex((i) => i.id === event.over?.id))); };

  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><Music className="h-5 w-5" /> Gig preparation</CardTitle><CardDescription>Manage this gig's setlist and review readiness before showtime{scheduledDate ? ` (${new Date(scheduledDate).toLocaleString()})` : ''}.</CardDescription></CardHeader><CardContent className="space-y-4">
    <div className="grid gap-3 md:grid-cols-[160px_1fr]"><div><div className="text-3xl font-bold">{readiness.score}</div><Badge className="capitalize">{readiness.rating}</Badge></div><div><Progress value={readiness.score} className="h-3" /><p className="mt-2 text-sm text-muted-foreground">Set duration {fmt(validation.totalDurationSeconds)} / booked {fmt(slotDurationSeconds)}.</p></div></div>
    <div className="grid gap-2 md:grid-cols-2">{readiness.factors.slice(0, 6).map((f) => <div key={f.key} className="rounded-md border p-2 text-sm"><div className="flex justify-between"><span>{f.label}</span><Badge variant={f.status === 'critical' ? 'destructive' : 'outline'}>{f.score}</Badge></div><p className="text-xs text-muted-foreground">{f.explanation}</p></div>)}</div>
    {[...validation.errors, ...readiness.blockingIssues].map((m) => <p key={m} className="flex gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />{m}</p>)}
    {[...validation.warnings, ...readiness.warnings].map((m) => <p key={m} className="flex gap-2 text-sm text-amber-600"><AlertTriangle className="h-4 w-4" />{m}</p>)}
    {validation.valid && <p className="flex gap-2 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" />Setlist is valid and ready to save.</p>}
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />Crew</CardTitle><CardDescription>Total crew cost ${readiness.crewCost} · crew readiness is included above.</CardDescription></CardHeader><CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><Select value={selectedCrewRole} onValueChange={(v) => setSelectedCrewRole(v as GigCrewRole)} disabled={locked}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(GIG_CREW_ROLES).map(([key, role]) => <SelectItem key={key} value={key}>{role.label}</SelectItem>)}</SelectContent></Select><Select value={selectedNpcCrew} onValueChange={setSelectedNpcCrew} disabled={locked}><SelectTrigger><SelectValue placeholder={npcCrewQuery.isLoading ? 'Loading crew...' : 'Choose NPC crew'} /></SelectTrigger><SelectContent>{(npcCrewQuery.data || []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name} · {c.crew_type} · ${c.salary_per_gig}</SelectItem>)}</SelectContent></Select><Button onClick={assignCrew} disabled={!selectedNpcCrew || locked}>Assign</Button></div>
        {(crewQuery.data || []).length === 0 ? <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">No crew assigned yet. Sound engineer and stage manager are recommended first.</p> : <div className="space-y-2">{(crewQuery.data || []).map((c: any) => <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm"><span>{GIG_CREW_ROLES[c.crew_role as GigCrewRole]?.label || c.crew_role}</span><span className="text-muted-foreground">{c.worker_type} · effectiveness {c.effectiveness_score} · ${c.fee_covered_by_employment ? 0 : c.agreed_fee}</span><Badge variant={c.attendance_status === 'conflict' ? 'destructive' : 'outline'}>{c.assignment_status}</Badge></div>)}</div>}
      </CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Wrench className="h-4 w-4" />Equipment</CardTitle><CardDescription>Rental cost ${readiness.rentalCost} · failure risk {readiness.failureRisk}%.</CardDescription></CardHeader><CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><Select value={selectedEquipmentRole} onValueChange={(v) => setSelectedEquipmentRole(v as EquipmentRole)} disabled={locked}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(EQUIPMENT_ROLE_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select><Select value={selectedBandEquipment} onValueChange={setSelectedBandEquipment} disabled={locked}><SelectTrigger><SelectValue placeholder={bandEquipmentQuery.isLoading ? 'Loading gear...' : 'Choose band equipment'} /></SelectTrigger><SelectContent>{(bandEquipmentQuery.data || []).map((e: any) => <SelectItem key={e.id} value={e.id}>{e.equipment_name} · q{e.quality_rating} · {e.condition}</SelectItem>)}</SelectContent></Select><Button onClick={addEquipment} disabled={!selectedBandEquipment || locked}>Add</Button></div>
        <div className="grid gap-2 sm:grid-cols-2">{readiness.requirements.filter((r) => r.required).map((r) => { const covered = (equipmentQuery.data || []).some((e: any) => e.equipment_role === r.role && !e.is_spare); return <div key={r.role} className="rounded-md border p-2 text-sm"><div className="flex justify-between"><span>{r.label}</span><Badge variant={covered ? 'outline' : 'destructive'}>{covered ? 'covered' : 'missing'}</Badge></div><p className="text-xs text-muted-foreground">{r.reason}</p></div>; })}</div>
        {(equipmentQuery.data || []).map((e: any) => <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm"><span>{EQUIPMENT_ROLE_LABELS[e.equipment_role as EquipmentRole] || e.equipment_role}</span><span className="text-muted-foreground">quality {e.quality_score} · condition {e.condition_score} · reliability {e.reliability_score}</span><Badge variant={e.condition_score < 40 ? 'destructive' : 'outline'}>{e.is_spare ? 'spare' : 'primary'}</Badge></div>)}
      </CardContent></Card>
    </div>
    <div className="flex gap-2"><Select value={selectedSong} onValueChange={setSelectedSong} disabled={locked}><SelectTrigger><SelectValue placeholder={songsQuery.isLoading ? 'Loading songs...' : 'Add an eligible band song'} /></SelectTrigger><SelectContent>{available.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.title} · {fmt(s.duration_seconds)}</SelectItem>)}</SelectContent></Select><Button onClick={addSong} disabled={!selectedSong || locked}><Plus className="mr-2 h-4 w-4" />Add</Button></div>
    <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}><SortableContext items={draft.map((d) => d.id)} strategy={verticalListSortingStrategy}><div className="space-y-2">{draft.length === 0 ? <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No songs yet. Add songs to prepare the gig.</p> : draft.map((item, index) => <SortableSong key={item.id} item={item} index={index} onEncore={(id, v) => setDraft((d) => d.map((i) => i.id === id ? { ...i, is_encore: v } : i))} onRemove={(id) => setDraft((d) => d.filter((i) => i.id !== id))} onMove={(id, delta) => setDraft((d) => { const from = d.findIndex((i) => i.id === id); const to = Math.max(0, Math.min(d.length - 1, from + delta)); return arrayMove(d, from, to); })} />)}</div></SortableContext></DndContext>
    <Button onClick={save} disabled={saving || locked || !validation.valid} className="w-full"><Save className="mr-2 h-4 w-4" />{saving ? 'Saving...' : 'Save gig setlist'}</Button>
  </CardContent></Card>;
}
