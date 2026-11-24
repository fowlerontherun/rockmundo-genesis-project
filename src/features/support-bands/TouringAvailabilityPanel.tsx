import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { playTogetherRpc } from './completionApi';
type Scope = { availability_scope: string; touring_countries: string[]; touring_from: string | null; touring_until: string | null; travel_enabled: boolean; max_travel_minutes: number | null };
export function TouringAvailabilityPanel({ bandId, countries, onSaved, disabled = false, onSavingChange }: { bandId: string; countries: string[]; onSaved?: () => Promise<void>; disabled?: boolean; onSavingChange?: (saving: boolean) => void }) {
  const [draft, setDraft] = useState<Scope | null>(null);
  const saved = useQuery({ queryKey: ['support-touring-scope', bandId], queryFn: async () => {
    const { data, error } = await supabase.from('band_support_preferences').select('*').eq('band_id', bandId).maybeSingle();
    if (error) throw error;
    return (data ?? { availability_scope: 'declared', touring_countries: [], touring_from: null, touring_until: null, travel_enabled: true, max_travel_minutes: null }) as unknown as Scope;
  } });
  const value = draft ?? saved.data;
  const save = useMutation({ onMutate: () => onSavingChange?.(true), onSettled: () => onSavingChange?.(false), mutationFn: () => playTogetherRpc<void>('set_support_touring_scope', { p_band_id: bandId, p_scope: value!.availability_scope, p_countries: value!.touring_countries, p_from: value!.touring_from, p_until: value!.touring_until, p_travel: value!.travel_enabled, p_max_minutes: value!.max_travel_minutes }), onSuccess: async () => { await saved.refetch(); setDraft(null); await onSaved?.(); } });
  if (saved.isPending) return <p>Loading touring area…</p>;
  if (saved.isError || !value) return <p role="alert">Touring area could not be loaded. <Button onClick={() => void saved.refetch()}>Retry touring area</Button></p>;
  const update = (patch: Partial<Scope>) => setDraft({ ...value, ...patch });
  return <>{disabled && <p className="text-sm text-muted-foreground">Save your preference changes above before editing the touring area.</p>}<fieldset disabled={save.isPending || disabled} className="space-y-3 rounded-lg border p-4">
    <legend className="px-1 font-semibold">Where would you tour?</legend>
    <p className="text-sm text-muted-foreground">Enable touring in your support preferences, then choose a touring area. Countries and worldwide need no individual city adverts. Single gigs still use the city/date adverts below.</p>
    <label className="block text-sm">Touring area<select aria-label="Touring area" className="ml-2 rounded border bg-background p-2" value={value.availability_scope} onChange={e => update({ availability_scope: e.target.value })}><option value="declared">Only advertised cities and dates</option><option value="countries">Selected countries</option><option value="worldwide">Worldwide</option></select></label>
    {value.availability_scope === 'countries' && <div className="flex max-h-48 flex-wrap gap-2 overflow-auto">{countries.map(country => <label key={country} className="flex gap-1 text-sm"><input type="checkbox" checked={value.touring_countries.includes(country)} onChange={e => update({ touring_countries: e.target.checked ? [...value.touring_countries, country] : value.touring_countries.filter(c => c !== country) })} />{country}</label>)}</div>}
    {value.availability_scope !== 'declared' && <div className="flex flex-wrap gap-3"><label className="text-sm">From (optional)<Input aria-label="Touring from" type="date" value={value.touring_from ?? ''} onChange={e => update({ touring_from: e.target.value || null })} /></label><label className="text-sm">Until (optional)<Input aria-label="Touring until" type="date" value={value.touring_until ?? ''} onChange={e => update({ touring_until: e.target.value || null })} /></label></div>}
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={value.travel_enabled} onChange={e => update({ travel_enabled: e.target.checked })} />Willing to travel between cities</label>
    <label className="block text-sm">Maximum minutes per journey (optional)<Input aria-label="Maximum travel minutes" type="number" min={0} value={value.max_travel_minutes ?? ''} onChange={e => update({ max_travel_minutes: e.target.value === '' ? null : Number(e.target.value) })} /></label>
    <Button onClick={() => save.mutate()} disabled={value.availability_scope === 'countries' && !value.touring_countries.length}>Save touring area</Button>
    {save.isSuccess && <p role="status">Touring area saved.</p>}{save.isError && <p role="alert">Could not save touring area. Check the dates and journey limit.</p>}
  </fieldset></>;
}
