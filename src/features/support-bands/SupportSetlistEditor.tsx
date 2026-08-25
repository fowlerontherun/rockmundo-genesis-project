import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, Loader2, Music2, Save, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type Song = {
  id: string;
  title: string;
  duration_seconds: number | null;
  quality_score: number | null;
  genre: string | null;
};

type SavedSupportSetlist = {
  id: string;
  supportSlotId: string;
  gigId: string;
  supportBandId: string;
  name: string;
  totalDurationSeconds: number;
  songs: Array<{ id: string; position: number }>;
};

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export function SupportSetlistEditor({ supportSlotId, bandId, onSaved }: { supportSlotId: string; bandId: string; onSaved?: () => void }) {
  const { toast } = useToast();
  const [songs, setSongs] = useState<Song[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      setLoading(true);
      const [songsResult, setlistResult] = await Promise.all([
        (supabase as any)
          .from('songs')
          .select('id,title,duration_seconds,quality_score,genre')
          .eq('band_id', bandId)
          .neq('archived', true)
          .order('quality_score', { ascending: false }),
        (supabase as any).rpc('get_support_band_setlist', { p_support_slot_id: supportSlotId }),
      ]);
      if (!mounted) return;
      if (songsResult.error) {
        toast({ title: 'Could not load songs', description: songsResult.error.message, variant: 'destructive' });
        setSongs([]);
      } else {
        setSongs((songsResult.data ?? []) as Song[]);
      }
      if (!setlistResult.error && setlistResult.data) {
        const saved = setlistResult.data as SavedSupportSetlist;
        setSelected((saved.songs ?? []).sort((a, b) => a.position - b.position).map((song) => song.id));
      }
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [bandId, supportSlotId, toast]);

  const totalSeconds = useMemo(
    () => selected.reduce((sum, id) => sum + Number(songs.find((song) => song.id === id)?.duration_seconds ?? 0), 0),
    [selected, songs],
  );

  const toggle = (id: string) => {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((songId) => songId !== id);
      if (current.length >= 6) return current;
      const duration = Number(songs.find((song) => song.id === id)?.duration_seconds ?? 0);
      if (totalSeconds + duration > 1800) {
        toast({ title: 'Support set is too long', description: 'Support sets are limited to 30 minutes.' });
        return current;
      }
      return [...current, id];
    });
  };

  const move = (index: number, direction: -1 | 1) => {
    setSelected((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const save = async () => {
    if (selected.length === 0) return;
    setSaving(true);
    const { error } = await (supabase as any).rpc('save_support_band_setlist', {
      p_support_slot_id: supportSlotId,
      p_name: 'Support set',
      p_song_ids: selected,
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Could not save support setlist', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Support setlist saved', description: `${selected.length} song${selected.length === 1 ? '' : 's'} · ${formatDuration(totalSeconds)}` });
    onSaved?.();
  };

  if (loading) return <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading your songs…</div>;

  return <Card className="border-dashed">
    <CardHeader className="pb-3">
      <CardTitle className="flex items-center gap-2 text-base"><Music2 className="h-4 w-4" />Support setlist</CardTitle>
      <CardDescription>Choose 1–6 of your band's songs, up to 30 minutes total. The order here is the performance order.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {selected.length > 0 && <div className="space-y-2">
        {selected.map((id, index) => {
          const song = songs.find((item) => item.id === id);
          if (!song) return null;
          return <div key={id} className="flex items-center gap-2 rounded-md border bg-muted/30 p-2">
            <Badge variant="outline">{index + 1}</Badge>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{song.title}</p><p className="text-xs text-muted-foreground">{formatDuration(Number(song.duration_seconds ?? 0))}</p></div>
            <Button size="icon" variant="ghost" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Move song up"><ChevronUp className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" disabled={index === selected.length - 1} onClick={() => move(index, 1)} aria-label="Move song down"><ChevronDown className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => toggle(id)} aria-label="Remove song"><X className="h-4 w-4" /></Button>
          </div>;
        })}
      </div>}

      <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
        {songs.length === 0 ? <p className="p-2 text-sm text-muted-foreground">Your band has no eligible songs yet.</p> : songs.map((song) => {
          const checked = selected.includes(song.id);
          const disabled = !checked && selected.length >= 6;
          return <label key={song.id} className={`flex cursor-pointer items-center gap-3 rounded p-2 hover:bg-muted/50 ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
            <Checkbox checked={checked} disabled={disabled} onCheckedChange={() => toggle(song.id)} />
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{song.title}</p><p className="text-xs text-muted-foreground">{song.genre ?? 'Unknown genre'} · quality {Math.round(Number(song.quality_score ?? 0))}</p></div>
            <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{formatDuration(Number(song.duration_seconds ?? 0))}</span>
          </label>;
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <p className="text-sm text-muted-foreground">{selected.length}/6 songs · {formatDuration(totalSeconds)} / 30:00</p>
        <Button size="sm" disabled={selected.length === 0 || saving || totalSeconds > 1800} onClick={save}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save support set</Button>
      </div>
    </CardContent>
  </Card>;
}
