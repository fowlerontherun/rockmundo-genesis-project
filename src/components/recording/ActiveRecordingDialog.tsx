import { useEffect, useMemo, useRef, useState } from "react";
import { Disc3, RotateCcw, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

type TakeGrade = "perfect" | "good" | "rough";
type ActiveRecordingDialogProps = { open: boolean; onOpenChange: (open: boolean) => void; recordingSessionId: string; songTitle: string; onSaved?: () => void };
type RecordingReward = { awarded: boolean; score: number; quality_bonus: number; final_master_quality: number; difficulty_level: number };
type RpcError = { message?: string };
type RpcClient = { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: RpcError | null }> };
type Difficulty = { level: number; name: string; speed: number; sweetSpot: number; falloff: number; maxBonus: number; description: string };

const rpcClient = supabase as unknown as RpcClient;
const SECTIONS = ["Intro", "Verse", "Chorus", "Bridge", "Final Chorus"];
const MAX_RETAKES = 2;
const DIFFICULTIES: Difficulty[] = [
  { level: 1, name: "Warm-up", speed: 0.075, sweetSpot: 22, falloff: 1.55, maxBonus: 1, description: "Slower meter and a forgiving capture window." },
  { level: 2, name: "Studio", speed: 0.095, sweetSpot: 16, falloff: 1.75, maxBonus: 2, description: "The standard studio challenge and reward." },
  { level: 3, name: "Pro", speed: 0.12, sweetSpot: 12, falloff: 2.05, maxBonus: 3, description: "Faster movement with a tighter clean-take window." },
  { level: 4, name: "Expert", speed: 0.15, sweetSpot: 9, falloff: 2.4, maxBonus: 4, description: "Fast input levels and very little room for error." },
  { level: 5, name: "Master", speed: 0.185, sweetSpot: 6, falloff: 2.8, maxBonus: 5, description: "The fastest meter, smallest sweet spot and best reward." },
];

export function ActiveRecordingDialog({ open, onOpenChange, recordingSessionId, songTitle, onSaved }: ActiveRecordingDialogProps) {
  const { profileId } = useActiveProfile();
  const [section, setSection] = useState(0);
  const [meter, setMeter] = useState(0);
  const [direction, setDirection] = useState(1);
  const [difficultyLevel, setDifficultyLevel] = useState(2);
  const [started, setStarted] = useState(false);
  const [captured, setCaptured] = useState<{ grade: TakeGrade; score: number } | null>(null);
  const [kept, setKept] = useState<Array<{ grade: TakeGrade; score: number }>>([]);
  const [retakesLeft, setRetakesLeft] = useState(MAX_RETAKES);
  const [saving, setSaving] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const difficulty = DIFFICULTIES[difficultyLevel - 1];

  useEffect(() => {
    if (!open || !started || captured || kept.length >= SECTIONS.length) return;
    const tick = (now: number) => {
      const dt = lastRef.current ? Math.min(40, now - lastRef.current) : 16;
      lastRef.current = now;
      setMeter((value) => {
        let next = value + direction * dt * difficulty.speed;
        if (next >= 100) { next = 100; setDirection(-1); }
        else if (next <= 0) { next = 0; setDirection(1); }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); lastRef.current = 0; };
  }, [open, started, captured, kept.length, direction, difficulty.speed]);

  const gradeCounts = useMemo(() => ({ perfect: kept.filter((take) => take.grade === "perfect").length, good: kept.filter((take) => take.grade === "good").length, rough: kept.filter((take) => take.grade === "rough").length }), [kept]);
  const rewardScore = useMemo(() => kept.length ? Math.round((gradeCounts.perfect * 100 + gradeCounts.good * 80 + gradeCounts.rough * 40) / kept.length) : 0, [gradeCounts, kept.length]);

  const captureTake = () => {
    const distance = Math.abs(meter - 50);
    const score = Math.max(20, Math.round(100 - distance * difficulty.falloff));
    const grade: TakeGrade = score >= 90 ? "perfect" : score >= 70 ? "good" : "rough";
    setCaptured({ grade, score });
  };
  const keepTake = () => { if (!captured) return; setKept((current) => [...current, captured]); setCaptured(null); setSection((current) => current + 1); setMeter(Math.random() * 20); setDirection(1); };
  const retake = () => { if (!captured || retakesLeft <= 0) return; setCaptured(null); setRetakesLeft((value) => value - 1); setMeter(Math.random() * 20); setDirection(1); };

  const save = async () => {
    if (!profileId || kept.length !== SECTIONS.length) return;
    setSaving(true);
    try {
      const { data, error } = await rpcClient.rpc("submit_active_recording_session", {
        p_profile_id: profileId,
        p_recording_session_id: recordingSessionId,
        p_score: rewardScore,
        p_perfect_takes: gradeCounts.perfect,
        p_good_takes: gradeCounts.good,
        p_rough_takes: gradeCounts.rough,
        p_difficulty_level: difficultyLevel,
      });
      if (error) throw new Error(error.message || "Could not save Active Recording result");
      const result = data as RecordingReward;
      toast.success(result.quality_bonus > 0 ? `Active Recording complete: score ${result.score}, +${result.quality_bonus} final master quality` : `Active Recording complete: score ${result.score}. The takes did not improve this master.`);
      onSaved?.(); onOpenChange(false);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save Active Recording result"); }
    finally { setSaving(false); }
  };

  const reset = () => { setSection(0); setMeter(0); setDirection(1); setDifficultyLevel(2); setStarted(false); setCaptured(null); setKept([]); setRetakesLeft(MAX_RETAKES); };
  const finished = kept.length === SECTIONS.length;
  const currentSection = SECTIONS[Math.min(section, SECTIONS.length - 1)];
  const sweetSpotLeft = 50 - difficulty.sweetSpot / 2;
  const sweetSpotRight = 50 - difficulty.sweetSpot / 2;

  return <Dialog open={open} onOpenChange={(value) => { onOpenChange(value); if (!value) reset(); }}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle className="flex items-center gap-2"><Disc3 className="h-5 w-5 text-primary" />Active Recording</DialogTitle><DialogDescription>Capture five keeper takes for {songTitle}. Higher difficulties move faster, tighten the sweet spot and can add more final master quality.</DialogDescription></DialogHeader><div className="space-y-5">
    {!started && <div className="space-y-3"><div className="grid grid-cols-5 gap-2">{DIFFICULTIES.map((option) => <Button key={option.level} type="button" variant={difficultyLevel === option.level ? "default" : "outline"} className="h-auto flex-col gap-1 px-1 py-2" onClick={() => setDifficultyLevel(option.level)}><span className="text-xs">Lv {option.level}</span><span className="text-[10px] truncate w-full">{option.name}</span></Button>)}</div><div className="rounded-lg border p-3"><div className="flex items-center justify-between"><p className="font-semibold">Level {difficulty.level}: {difficulty.name}</p><Badge variant="secondary">Up to +{difficulty.maxBonus}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{difficulty.description}</p></div><Button size="lg" className="w-full" onClick={() => { setStarted(true); setMeter(Math.random() * 20); }}>Start Active Recording</Button></div>}
    {started && <><div className="flex items-center justify-between text-sm"><span>{finished ? "Session complete" : currentSection}</span><span>Level {difficulty.level} · Retakes: {retakesLeft}</span></div><Progress value={(kept.length / SECTIONS.length) * 100} />
    {!finished && !captured && <div className="space-y-4"><div className="relative h-20 rounded-lg border bg-muted/30 overflow-hidden"><div className="absolute inset-y-0 bg-green-500/15 border-x border-green-500/40" style={{ left: `${sweetSpotLeft}%`, right: `${sweetSpotRight}%` }} /><div className="absolute inset-y-0 left-1/2 w-0.5 bg-green-500" /><div className="absolute top-1/2 h-12 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground shadow-lg" style={{ left: `${meter}%` }} /></div><p className="text-center text-sm text-muted-foreground">Capture as close to the centre as possible. The window gets tighter and the meter faster at higher levels.</p><Button size="lg" className="w-full h-14" onClick={captureTake}>CAPTURE TAKE</Button></div>}
    {captured && !finished && <div className="space-y-4 rounded-lg border p-4 text-center"><p className="text-sm text-muted-foreground">Captured take</p><p className="text-4xl font-black">{captured.score}</p><Badge variant={captured.grade === "rough" ? "outline" : "secondary"}>{captured.grade === "perfect" ? "Perfect Take" : captured.grade === "good" ? "Good Take" : "Rough Take"}</Badge><div className="grid grid-cols-2 gap-2"><Button onClick={keepTake}>Keep Take</Button><Button variant="outline" onClick={retake} disabled={retakesLeft <= 0}><RotateCcw className="h-4 w-4 mr-2" />Retake</Button></div></div>}
    {finished && <div className="space-y-4"><div className="text-center space-y-1"><Sparkles className="h-7 w-7 mx-auto text-primary" /><p className="text-sm text-muted-foreground">Keeper-take grade score</p><p className="text-5xl font-black">{rewardScore}</p><p className="text-sm text-muted-foreground">Level {difficulty.level} can award up to +{difficulty.maxBonus} final master quality. The server recalculates your score from the five kept take grades before applying it.</p></div><div className="grid grid-cols-5 gap-1">{kept.map((take, index) => <div key={`${SECTIONS[index]}-${index}`} className="rounded border p-2 text-center"><p className="text-[10px] text-muted-foreground truncate">{SECTIONS[index]}</p><p className="font-semibold text-sm">{take.score}</p></div>)}</div><Button className="w-full" onClick={save} disabled={saving}>{saving ? "Saving…" : "Apply Take Polish"}</Button></div>}</>}
  </div></DialogContent></Dialog>;
}
