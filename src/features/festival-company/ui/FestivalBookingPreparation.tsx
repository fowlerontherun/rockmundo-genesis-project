import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDown, ArrowUp, X } from "lucide-react";

const schema = z.object({ bookingId: z.string(), version: z.number(), setMinutes: z.number(), preparation: z.object({ songIds: z.array(z.string()).optional(), backstageChoice: z.string().optional() }), songs: z.array(z.object({ id: z.string(), title: z.string(), durationSeconds: z.number() })) });
export function FestivalBookingPreparation({ bookingId }: { bookingId: string }) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<string[] | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["festival-booking-preparation", bookingId], enabled: open, retry: false, queryFn: async () => {
    const { data, error } = await supabase.rpc("festival_booking_preparation", { p_booking_id: bookingId });
    if (error) throw error;
    return schema.parse(data);
  } });
  const save = useMutation({ mutationFn: async () => {
    if (!query.data) throw new Error("Preparation unavailable");
    const { data, error } = await supabase.rpc("festival_booking_preparation", { p_booking_id: bookingId, p_expected_version: query.data.version, p_song_ids: selection ?? query.data.preparation.songIds ?? [], p_backstage_choice: choice ?? query.data.preparation.backstageChoice });
    if (error) throw error;
    return schema.parse(data);
  }, onSuccess: data => { client.setQueryData(["festival-booking-preparation", bookingId], data); setSelection(null); setChoice(null); void client.invalidateQueries({ queryKey: ["festival-artist-opportunities"] }); } });
  const ids = selection ?? query.data?.preparation.songIds ?? [];
  const duration = ids.reduce((sum, id) => sum + (query.data?.songs.find(song => song.id === id)?.durationSeconds ?? 0), 0);
  const move = (index: number, direction: number) => { const next = [...ids]; const other = index + direction; if (other < 0 || other >= next.length) return; [next[index], next[other]] = [next[other], next[index]]; setSelection(next); };
  return <div className="mt-3 space-y-3">
    <Button size="sm" variant="outline" onClick={() => setOpen(!open)}>{open ? "Close preparation" : "Setlist & backstage"}</Button>
    {open && query.isPending ? <p role="status">Loading preparation…</p> : null}
    {open && query.isError ? <div role="alert">Preparation could not be verified.<Button size="sm" variant="outline" onClick={() => void query.refetch()}>Retry preparation</Button></div> : null}
    {open && query.data && !query.isError ? <div className="space-y-3 border-t pt-3">
      <h3 className="font-semibold">Setlist · {Math.ceil(duration / 60)}/{query.data.setMinutes} min</h3>
      <Select value="" onValueChange={id => setSelection([...ids, id])} disabled={save.isPending}><SelectTrigger><SelectValue placeholder="Add a band song" /></SelectTrigger><SelectContent>{query.data.songs.filter(song => !ids.includes(song.id)).map(song => <SelectItem key={song.id} value={song.id}>{song.title}</SelectItem>)}</SelectContent></Select>
      <ol className="space-y-1">{ids.map((id, index) => <li key={id} className="flex items-center gap-2 text-sm"><span className="min-w-0 flex-1">{index + 1}. {query.data?.songs.find(song => song.id === id)?.title ?? "Song unavailable"}</span><Button size="icon" variant="ghost" aria-label="Move song up" disabled={index === 0 || save.isPending} onClick={() => move(index, -1)}><ArrowUp className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label="Move song down" disabled={index === ids.length - 1 || save.isPending} onClick={() => move(index, 1)}><ArrowDown className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label="Remove song" disabled={save.isPending} onClick={() => setSelection(ids.filter(value => value !== id))}><X className="h-4 w-4" /></Button></li>)}</ol>
      <h3 className="font-semibold">Before the show</h3>
      <p className="text-sm text-muted-foreground">A journalist wants an interview while your band prepares. What matters most?</p>
      <p className="text-xs text-muted-foreground">Preparation is saved with your booking; live performance effects are not yet available.</p>
      <Select value={choice ?? query.data.preparation.backstageChoice ?? ""} onValueChange={setChoice} disabled={save.isPending}><SelectTrigger><SelectValue placeholder="Choose your backstage approach" /></SelectTrigger><SelectContent><SelectItem value="focus_on_show">Focus on the show</SelectItem><SelectItem value="meet_the_press">Meet the press</SelectItem><SelectItem value="support_the_band">Support the band</SelectItem></SelectContent></Select>
      <Button disabled={save.isPending || ids.length === 0 || duration > query.data.setMinutes * 60} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save preparation"}</Button>
      {save.isError ? <p role="alert" className="text-sm text-destructive">Preparation could not be saved. Refresh the booking; edits close when the festival starts.</p> : null}
      {save.isSuccess ? <p role="status" className="text-sm">Preparation saved. No payment or bonus has been awarded.</p> : null}
    </div> : null}
  </div>;
}