import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Music2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type ActiveRehearsalDialogProps = { open: boolean; onOpenChange: (open: boolean) => void; bandId: string; bandName: string };
type HitGrade = "perfect" | "tight" | "recovery" | "lost";
type RehearsalSong = { id: string; title: string | null };
type RehearsalReward = { awarded: boolean; sessions_today?: number; diminishing?: boolean; score?: number; familiarity_minutes_gained?: number; cohesion_gained?: number };
type RpcError = { message?: string };
type RpcClient = { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: RpcError | null }> };
const rpcClient = supabase as unknown as RpcClient;
const TOTAL_BEATS = 12;
const BASE_BEAT_MS = 1150;

export function ActiveRehearsalDialog({ open, onOpenChange, bandId, bandName }: ActiveRehearsalDialogProps) {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();
  const [songId, setSongId] = useState("");
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [beat, setBeat] = useState(0);
  const [position, setPosition] = useState(0);
  const [lastGrade, setLastGrade] = useState<HitGrade | null>(null);
  const [grades, setGrades] = useState<HitGrade[]>([]);
  const [saving, setSaving] = useState(false);
  const startRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const beatRef = useRef(0);

  const { data: songs = [] } = useQuery<RehearsalSong[]>({
    queryKey: ["active-rehearsal-songs", bandId, profileId], enabled: open && !!bandId && !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase.from("songs").select("id,title,band_id,profile_id").or(`band_id.eq.${bandId},profile_id.eq.${profileId}`).or("archived.is.null,archived.eq.false").order("title");
      if (error) throw error;
      return (data || []).map((song) => ({ id: song.id, title: song.title }));
    },
  });

  const counts = useMemo(() => ({ perfect: grades.filter((g) => g === "perfect").length, tight: grades.filter((g) => g === "tight").length, recovery: grades.filter((g) => g === "recovery").length, lost: grades.filter((g) => g === "lost").length }), [grades]);
  const score = useMemo(() => grades.length ? Math.round(grades.reduce((total, grade) => total + ({ perfect: 100, tight: 80, recovery: 55, lost: 20 }[grade]), 0) / grades.length) : 0, [grades]);

  useEffect(() => {
    if (!running) return;
    const tick = (now: number) => {
      const beatMs = Math.max(700, BASE_BEAT_MS - beatRef.current * 35);
      const elapsed = now - startRef.current;
      const phase = (elapsed % beatMs) / beatMs;
      setPosition(phase <= 0.5 ? phase * 2 : (1 - phase) * 2);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [running]);

  const start = () => {
    if (!songId) return;
    setGrades([]); setBeat(0); beatRef.current = 0; setLastGrade(null); setFinished(false); setRunning(true); startRef.current = performance.now();
  };

  const tap = useCallback(() => {
    if (!running) return;
    const distance = Math.abs(position - 1);
    const grade: HitGrade = distance <= 0.06 ? "perfect" : distance <= 0.16 ? "tight" : distance <= 0.34 ? "recovery" : "lost";
    setGrades((current) => [...current, grade]); setLastGrade(grade);
    const nextBeat = beatRef.current + 1; beatRef.current = nextBeat; setBeat(nextBeat); startRef.current = performance.now(); setPosition(0);
    if (nextBeat >= TOTAL_BEATS) { setRunning(false); setFinished(true); }
  }, [position, running]);

  useEffect(() => {
    if (!running) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space" || event.code === "Enter") { event.preventDefault(); tap(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [running, tap]);

  const save = async () => {
    if (!profileId || !songId || grades.length !== TOTAL_BEATS) return;
    setSaving(true);
    try {
      const { data, error } = await rpcClient.rpc("submit_active_rehearsal_session", { p_profile_id: profileId, p_band_id: bandId, p_song_id: songId, p_score: 0, p_perfect_hits: counts.perfect, p_tight_hits: counts.tight, p_recovery_hits: counts.recovery, p_lost_hits: counts.lost });
      if (error) throw new Error(error.message || "Could not save Active Rehearsal");
      const result = data as RehearsalReward;
      if (!result.awarded) toast.error("Daily Active Rehearsal reward cap reached. Booked rehearsals still work normally.");
      else {
        const cohesion = result.cohesion_gained ? `, +${result.cohesion_gained} cohesion` : "";
        const diminishing = result.diminishing ? " (diminishing returns applied)" : "";
        toast.success(`Active Rehearsal: score ${result.score ?? score}, +${result.familiarity_minutes_gained ?? 0} familiarity minutes${cohesion}${diminishing}`);
      }
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["band-song-familiarity"] }), queryClient.invalidateQueries({ queryKey: ["user-bands"] })]);
      onOpenChange(false);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save Active Rehearsal"); }
    finally { setSaving(false); }
  };

  const reset = () => { setRunning(false); setFinished(false); setBeat(0); beatRef.current = 0; setPosition(0); setLastGrade(null); setGrades([]); };
  const feedback = lastGrade ? ({ perfect: "Perfect — locked to the beat!", tight: "Tight — good band timing.", recovery: "Recovered — you pulled it back in.", lost: "Lost the groove — find the centre again." }[lastGrade]) : "Tap when the marker reaches the centre groove.";

  return <Dialog open={open} onOpenChange={(value) => { onOpenChange(value); if (!value) reset(); }}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" />Active Rehearsal</DialogTitle><DialogDescription>Optional groove practice for {bandName}. It adds a small familiarity bonus; normal booked rehearsals remain the main progression route.</DialogDescription></DialogHeader><div className="space-y-5">
    {!running && !finished && <><div className="space-y-2"><label className="text-sm font-medium">Song to rehearse</label><Select value={songId} onValueChange={setSongId}><SelectTrigger><SelectValue placeholder="Choose a song" /></SelectTrigger><SelectContent>{songs.map((song) => <SelectItem key={song.id} value={song.id}>{song.title || "Untitled"}</SelectItem>)}</SelectContent></Select></div><Button className="w-full" onClick={start} disabled={!songId}><Music2 className="h-4 w-4 mr-2" />Start Groove Check</Button></>}
    {running && <div className="space-y-5"><div className="flex justify-between text-sm"><span>Beat {beat + 1} / {TOTAL_BEATS}</span><span>Score {score}</span></div><Progress value={(beat / TOTAL_BEATS) * 100} /><div className="relative h-20 rounded-lg border bg-muted/30 overflow-hidden"><div className="absolute inset-y-0 left-1/2 w-14 -translate-x-1/2 bg-primary/10 border-x border-primary/30" /><div className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 bg-primary" /><div className="absolute top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground shadow-lg" style={{ left: `${position * 100}%` }} /></div><p className="text-center text-sm font-medium min-h-5">{feedback}</p><Button size="lg" className="w-full h-16 text-lg" onPointerDown={tap}>LOCK IN</Button><p className="text-xs text-center text-muted-foreground">Tap, Space or Enter. The groove gradually speeds up across the 12 beats.</p></div>}
    {finished && <div className="space-y-4"><div className="text-center space-y-1"><Sparkles className="h-7 w-7 mx-auto text-primary" /><p className="text-sm text-muted-foreground">Band timing score</p><p className="text-5xl font-black">{score}</p></div><div className="grid grid-cols-4 gap-2 text-center text-xs"><Badge variant="outline" className="justify-center py-2">Perfect {counts.perfect}</Badge><Badge variant="outline" className="justify-center py-2">Tight {counts.tight}</Badge><Badge variant="outline" className="justify-center py-2">Recover {counts.recovery}</Badge><Badge variant="outline" className="justify-center py-2">Lost {counts.lost}</Badge></div><p className="text-xs text-center text-muted-foreground">This completed run is your attempt. Save it to apply any eligible bonus.</p><Button className="w-full" onClick={save} disabled={saving}>{saving ? "Saving…" : "Apply Rehearsal Bonus"}</Button></div>}
  </div></DialogContent></Dialog>;
}
