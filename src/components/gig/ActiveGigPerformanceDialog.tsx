import { useEffect, useMemo, useState } from "react";
import { Eye, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

type StageZone = "LEFT" | "CENTRE" | "RIGHT" | "FRONT";

type ActiveGigPerformanceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gigId: string;
  bandName?: string;
  onSaved?: () => void;
};

const ZONES: StageZone[] = ["LEFT", "CENTRE", "RIGHT", "FRONT"];
const ROUND_LENGTHS = [2, 3, 3, 4, 5];

function makeSequence(length: number): StageZone[] {
  const sequence: StageZone[] = [];
  for (let index = 0; index < length; index += 1) {
    const previous = sequence[index - 1];
    const choices = ZONES.filter((zone) => zone !== previous);
    sequence.push(choices[Math.floor(Math.random() * choices.length)]);
  }
  return sequence;
}

export function ActiveGigPerformanceDialog({
  open,
  onOpenChange,
  gigId,
  bandName,
  onSaved,
}: ActiveGigPerformanceDialogProps) {
  const { profileId } = useActiveProfile();
  const [round, setRound] = useState(0);
  const [showPattern, setShowPattern] = useState(true);
  const [inputIndex, setInputIndex] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const patterns = useMemo(
    () => ROUND_LENGTHS.map((length) => makeSequence(length)),
    // A fresh challenge is generated each time the dialog is mounted.
    [],
  );

  const finished = scores.length === ROUND_LENGTHS.length;
  const pattern = patterns[Math.min(round, patterns.length - 1)];
  const average = scores.length
    ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
    : 0;

  useEffect(() => {
    if (!open || finished) return;
    setShowPattern(true);
    setInputIndex(0);
    setMistakes(0);
    const timeout = window.setTimeout(() => setShowPattern(false), 1400 + pattern.length * 250);
    return () => window.clearTimeout(timeout);
  }, [open, round, finished, pattern.length]);

  const reset = () => {
    setRound(0);
    setShowPattern(true);
    setInputIndex(0);
    setMistakes(0);
    setScores([]);
    setSaving(false);
  };

  const pressZone = (zone: StageZone) => {
    if (showPattern || finished) return;
    const expected = pattern[inputIndex];
    if (zone !== expected) {
      setMistakes((value) => value + 1);
      return;
    }

    const nextIndex = inputIndex + 1;
    if (nextIndex < pattern.length) {
      setInputIndex(nextIndex);
      return;
    }

    const roundScore = Math.max(20, 100 - mistakes * 20);
    setScores((current) => [...current, roundScore]);
    setInputIndex(0);
    if (round < ROUND_LENGTHS.length - 1) {
      setRound((value) => value + 1);
    }
  };

  const save = async () => {
    if (!profileId || scores.length !== ROUND_LENGTHS.length) return;
    setSaving(true);
    try {
      const { data, error } = await (supabase as any).rpc("submit_active_gig_performance", {
        p_profile_id: profileId,
        p_gig_id: gigId,
        p_cue_scores: scores,
      });
      if (error) throw error;

      const multiplier = Number(data?.rating_multiplier || 0);
      const percent = (multiplier * 100).toFixed(1);
      toast.success(
        multiplier > 0
          ? `Active Performance complete: ${percent}% live rating boost earned if this is the band's best result.`
          : "Active Performance complete. No live rating boost this time.",
      );
      onSaved?.();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || "Could not save Active Performance result");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        onOpenChange(value);
        if (!value) reset();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Active Performance
          </DialogTitle>
          <DialogDescription>
            Read the crowd, remember the stage pattern, then reproduce it. Every member can play once; only {bandName || "the band's"} best result counts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-center justify-between text-sm">
            <span>{finished ? "Challenge complete" : `Crowd cue ${round + 1} of 5`}</span>
            <span>{scores.length}/5 locked</span>
          </div>
          <Progress value={(scores.length / 5) * 100} />

          {!finished && (
            <div className="space-y-4">
              {showPattern ? (
                <div className="rounded-lg border bg-primary/5 p-5 text-center space-y-4">
                  <div className="flex items-center justify-center gap-2 text-sm font-medium">
                    <Eye className="h-4 w-4" /> Watch the crowd pattern
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {pattern.map((zone, index) => (
                      <Badge key={`${zone}-${index}`} variant="secondary" className="px-3 py-1.5 text-sm">
                        {index + 1}. {zone}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-lg border bg-muted/30 p-4 text-center">
                    <p className="text-sm text-muted-foreground">Repeat the pattern from memory</p>
                    <p className="mt-1 text-lg font-semibold">Step {inputIndex + 1} of {pattern.length}</p>
                    {mistakes > 0 && <p className="text-xs text-destructive mt-1">Mistakes this cue: {mistakes}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {ZONES.map((zone) => (
                      <Button key={zone} size="lg" variant="outline" className="h-14" onClick={() => pressZone(zone)}>
                        {zone}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {finished && (
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <p className="text-sm text-muted-foreground">Stage-presence score</p>
                <p className="text-5xl font-black">{average}</p>
                <p className="text-sm text-muted-foreground">
                  90+ = 1.5% · 75+ = 1.0% · 60+ = 0.5% · below 60 = no rating bonus
                </p>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {scores.map((score, index) => (
                  <div key={`cue-${index}`} className="rounded border p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">Cue {index + 1}</p>
                    <p className="font-semibold text-sm">{score}</p>
                  </div>
                ))}
              </div>
              <Button className="w-full" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Lock In Performance"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
