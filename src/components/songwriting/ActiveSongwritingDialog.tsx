import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Brain, Music2, PenLine, Puzzle, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import type { SongwritingProject } from "@/hooks/useSongwritingData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

type PuzzleType = "lyrics" | "chords" | "melody" | "arrangement";

type ActiveSongwritingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: SongwritingProject;
};

const PUZZLES: Record<PuzzleType, { title: string; prompt: string; options: string[]; answer: number; icon: typeof PenLine }> = {
  lyrics: {
    title: "Lyric Builder",
    prompt: "Choose the line that best completes the rhyme and keeps a natural eight-beat lyric flow: ‘Streetlights fade, but I’m still awake / Chasing the sound of every…’",
    options: ["turn I take", "window pane", "quiet day", "empty road"],
    answer: 0,
    icon: PenLine,
  },
  chords: {
    title: "Chord Puzzle",
    prompt: "Complete this familiar pop/rock movement: G → D → Em → ?",
    options: ["C", "F#", "Bb", "Ab"],
    answer: 0,
    icon: Music2,
  },
  melody: {
    title: "Melody Memory",
    prompt: "A phrase rises 1 → 3 → 5, then resolves. Which ending feels most naturally resolved?",
    options: ["1", "7", "#4", "6"],
    answer: 0,
    icon: Brain,
  },
  arrangement: {
    title: "Arrangement Puzzle",
    prompt: "Your second chorus needs more impact. Which change is most likely to create contrast without rewriting the song?",
    options: ["Drop instruments before the chorus, then bring the full band back", "Repeat the verse unchanged", "Remove the chorus hook", "Slow the entire song by half"],
    answer: 0,
    icon: Puzzle,
  },
};

export function ActiveSongwritingDialog({ open, onOpenChange, project }: ActiveSongwritingDialogProps) {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();
  const [type, setType] = useState<PuzzleType>("lyrics");
  const [selected, setSelected] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [saving, setSaving] = useState(false);
  const [finished, setFinished] = useState(false);
  const puzzle = PUZZLES[type];
  const score = useMemo(() => attempts === 0 ? 0 : Math.round((correct / attempts) * 100), [attempts, correct]);

  const choose = (index: number) => {
    if (selected !== null || finished) return;
    setSelected(index);
    const isCorrect = index === puzzle.answer;
    setAttempts((value) => value + 1);
    if (isCorrect) setCorrect((value) => value + 1);
  };

  const nextPuzzle = () => {
    if (attempts >= 4) {
      setFinished(true);
      return;
    }
    const order: PuzzleType[] = ["lyrics", "chords", "melody", "arrangement"];
    const next = order[(order.indexOf(type) + 1) % order.length];
    setType(next);
    setSelected(null);
  };

  const submit = async () => {
    if (!profileId || attempts === 0) return;
    setSaving(true);
    try {
      const { data, error } = await (supabase as any).rpc("submit_active_songwriting_session", {
        p_profile_id: profileId,
        p_project_id: project.id,
        p_puzzle_type: type,
        p_score: score,
      });
      if (error) throw error;
      if (data?.awarded === false) {
        toast.error("Daily Active Writing reward cap reached. You can still use normal songwriting sessions.");
      } else {
        toast.success(`Active Writing complete: +${data?.music_progress_gained ?? 0} music, +${data?.lyrics_progress_gained ?? 0} lyrics progress`);
      }
      await queryClient.invalidateQueries({ queryKey: ["songwriting-projects"] });
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || "Could not save Active Writing session");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setType("lyrics");
    setSelected(null);
    setAttempts(0);
    setCorrect(0);
    setFinished(false);
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { onOpenChange(value); if (!value) reset(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Active Writing</DialogTitle>
          <DialogDescription>
            Optional short puzzles that add a small bonus to {project.title}. Normal songwriting sessions remain unchanged.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Badge variant="secondary">{puzzle.title}</Badge>
            <span className="text-xs text-muted-foreground">{Math.min(attempts + 1, 4)} / 4</span>
          </div>
          <Progress value={(attempts / 4) * 100} className="h-2" />
          <p className="font-medium leading-relaxed">{puzzle.prompt}</p>

          <div className="grid gap-2">
            {puzzle.options.map((option, index) => {
              const answered = selected !== null;
              const isCorrect = index === puzzle.answer;
              const isSelected = selected === index;
              return (
                <Button
                  key={option}
                  variant={isSelected ? "default" : "outline"}
                  className={`justify-start h-auto whitespace-normal text-left ${answered && isCorrect ? "border-green-500" : ""}`}
                  onClick={() => choose(index)}
                  disabled={answered || finished}
                >
                  {option}
                </Button>
              );
            })}
          </div>

          {selected !== null && !finished && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p className="font-medium">{selected === puzzle.answer ? "Great musical choice." : "That works less naturally here."}</p>
              <p className="text-muted-foreground mt-1">The game rewards musical judgement, but your character’s normal songwriting progression remains the main route.</p>
            </div>
          )}

          {finished && (
            <div className="rounded-md border p-4 text-center space-y-2">
              <p className="text-sm text-muted-foreground">Session score</p>
              <p className="text-4xl font-black">{score}%</p>
              <p className="text-sm">{correct} correct from {attempts} puzzles</p>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            {!finished && selected !== null && <Button onClick={nextPuzzle}>{attempts >= 4 ? "See Result" : "Next Puzzle"}</Button>}
            {finished && <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Apply Small Bonus"}</Button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
