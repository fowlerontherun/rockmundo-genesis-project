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

type ActiveRecordingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordingSessionId: string;
  songTitle: string;
  onSaved?: () => void;
};

const SECTIONS = ["Intro", "Verse", "Chorus", "Bridge", "Final Chorus"];
const MAX_RETAKES = 2;

export function ActiveRecordingDialog({
  open,
  onOpenChange,
  recordingSessionId,
  songTitle,
  onSaved,
}: ActiveRecordingDialogProps) {
  const { profileId } = useActiveProfile();
  const [section, setSection] = useState(0);
  const [meter, setMeter] = useState(0);
  const [direction, setDirection] = useState(1);
  const [captured, setCaptured] = useState<{ grade: TakeGrade; score: number } | null>(null);
  const [kept, setKept] = useState<Array<{ grade: TakeGrade; score: number }>>([]);
  const [retakesLeft, setRetakesLeft] = useState(MAX_RETAKES);
  const [saving, setSaving] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);

  useEffect(() => {
    if (!open || captured || kept.length >= SECTIONS.length) return;
    const tick = (now: number) => {
      const dt = lastRef.current ? Math.min(40, now - lastRef.current) : 16;
      lastRef.current = now;
      setMeter((value) => {
        let next = value + direction * dt * 0.095;
        if (next >= 100) {
          next = 100;
          setDirection(-1);
        } else if (next <= 0) {
          next = 0;
          setDirection(1);
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastRef.current = 0;
    };
  }, [open, captured, kept.length, direction]);

  const finalScore = useMemo(() => {
    if (!kept.length) return 0;
    return Math.round(kept.reduce((sum, take) => sum + take.score, 0) / kept.length);
  }, [kept]);

  const captureTake = () => {
    const distance = Math.abs(meter - 50);
    const score = Math.max(20, Math.round(100 - distance * 1.6));
    const grade: TakeGrade = score >= 90 ? "perfect" : score >= 70 ? "good" : "rough";
    setCaptured({ grade, score });
  };

  const keepTake = () => {
    if (!captured) return;
    setKept((current) => [...current, captured]);
    setCaptured(null);
    setSection((current) => current + 1);
    setMeter(Math.random() * 20);
    setDirection(1);
  };

  const retake = () => {
    if (!captured || retakesLeft <= 0) return;
    setCaptured(null);
    setRetakesLeft((value) => value - 1);
    setMeter(Math.random() * 20);
    setDirection(1);
  };

  const save = async () => {
    if (!profileId || kept.length !== SECTIONS.length) return;
    setSaving(true);
    try {
      const perfect = kept.filter((take) => take.grade === "perfect").length;
      const good = kept.filter((take) => take.grade === "good").length;
      const rough = kept.filter((take) => take.grade === "rough").length;
      const { data, error } = await (supabase as any).rpc("submit_active_recording_session", {
        p_profile_id: profileId,
        p_recording_session_id: recordingSessionId,
        p_score: finalScore,
        p_perfect_takes: perfect,
        p_good_takes: good,
        p_rough_takes: rough,
      });
      if (error) throw error;
      const bonus = data?.quality_bonus ?? 0;
      toast.success(
        bonus > 0
          ? `Active Recording complete: +${bonus} final master quality`
          : "Active Recording complete. The takes did not improve the final master this time.",
      );
      onSaved?.();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || "Could not save Active Recording result");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setSection(0);
    setMeter(0);
    setDirection(1);
    setCaptured(null);
    setKept([]);
    setRetakesLeft(MAX_RETAKES);
  };

  const finished = kept.length === SECTIONS.length;
  const currentSection = SECTIONS[Math.min(section, SECTIONS.length - 1)];

  return (
    <Dialog open={open} onOpenChange={(value) => { onOpenChange(value); if (!value) reset(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Disc3 className="h-5 w-5 text-primary" />
            Active Recording
          </DialogTitle>
          <DialogDescription>
            Capture five keeper takes for {songTitle}. This is optional and can add at most +2 to a completed standard recording.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-center justify-between text-sm">
            <span>{finished ? "Session complete" : currentSection}</span>
            <span>Retakes: {retakesLeft}</span>
          </div>
          <Progress value={(kept.length / SECTIONS.length) * 100} />

          {!finished && !captured && (
            <div className="space-y-4">
              <div className="relative h-20 rounded-lg border bg-muted/30 overflow-hidden">
                <div className="absolute inset-y-0 left-[42%] right-[42%] bg-green-500/15 border-x border-green-500/40" />
                <div className="absolute inset-y-0 left-1/2 w-0.5 bg-green-500" />
                <div
                  className="absolute top-1/2 h-12 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground shadow-lg"
                  style={{ left: `${meter}%` }}
                />
              </div>
              <p className="text-center text-sm text-muted-foreground">
                Watch the input level and capture when the signal sits cleanly in the centre sweet spot.
              </p>
              <Button size="lg" className="w-full h-14" onClick={captureTake}>CAPTURE TAKE</Button>
            </div>
          )}

          {captured && !finished && (
            <div className="space-y-4 rounded-lg border p-4 text-center">
              <p className="text-sm text-muted-foreground">Captured take</p>
              <p className="text-4xl font-black">{captured.score}</p>
              <Badge variant={captured.grade === "rough" ? "outline" : "secondary"}>
                {captured.grade === "perfect" ? "Perfect Take" : captured.grade === "good" ? "Good Take" : "Rough Take"}
              </Badge>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={keepTake}>Keep Take</Button>
                <Button variant="outline" onClick={retake} disabled={retakesLeft <= 0}>
                  <RotateCcw className="h-4 w-4 mr-2" />Retake
                </Button>
              </div>
            </div>
          )}

          {finished && (
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <Sparkles className="h-7 w-7 mx-auto text-primary" />
                <p className="text-sm text-muted-foreground">Kept take average</p>
                <p className="text-5xl font-black">{finalScore}</p>
                <p className="text-sm text-muted-foreground">
                  90+ = +2 quality · 70+ = +1 · below 70 = no quality bonus
                </p>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {kept.map((take, index) => (
                  <div key={`${SECTIONS[index]}-${index}`} className="rounded border p-2 text-center">
                    <p className="text-[10px] text-muted-foreground truncate">{SECTIONS[index]}</p>
                    <p className="font-semibold text-sm">{take.score}</p>
                  </div>
                ))}
              </div>
              <Button className="w-full" onClick={save} disabled={saving}>{saving ? "Saving…" : "Apply Take Polish"}</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
