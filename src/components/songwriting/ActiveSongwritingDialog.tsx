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
type PuzzleDefinition = { id: string; title: string; prompt: string; options: string[]; answer: string; icon: typeof PenLine };
type ActiveSongwritingDialogProps = { open: boolean; onOpenChange: (open: boolean) => void; project: SongwritingProject };
type RpcError = { message?: string };
type SongwritingReward = { awarded: boolean; sessions_today?: number; diminishing?: boolean; overall_score?: number; music_progress_gained?: number; lyrics_progress_gained?: number };
type RpcClient = { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: RpcError | null }> };
const rpcClient = supabase as unknown as RpcClient;

const PUZZLE_ORDER: PuzzleType[] = ["lyrics", "chords", "melody", "arrangement"];
const PUZZLE_BANK: Record<PuzzleType, PuzzleDefinition[]> = {
  lyrics: [
    { id: "lyrics-1", title: "Lyric Builder", prompt: "Choose the original line that best completes the rhyme and keeps a natural lyric flow: ‘Streetlights fade, but I’m still awake / Chasing the sound of every…’", options: ["turn I take", "window pane", "quiet day", "empty road"], answer: "turn I take", icon: PenLine },
    { id: "lyrics-2", title: "Lyric Builder", prompt: "Finish this original couplet with the clearest rhyme: ‘We missed the train and walked through rain / You laughed and called my…’", options: ["name again", "old blue coat", "empty room", "morning sun"], answer: "name again", icon: PenLine },
    { id: "lyrics-3", title: "Lyric Builder", prompt: "Which original line best matches a restless late-night theme?", options: ["The ceiling counts the hours I can't spend", "Summer fields are warm at noon", "Breakfast waits beside the door", "The garden sleeps beneath the sun"], answer: "The ceiling counts the hours I can't spend", icon: PenLine },
  ],
  chords: [
    { id: "chords-1", title: "Chord Puzzle", prompt: "Complete this common pop/rock movement: G → D → Em → ?", options: ["C", "F#", "Bb", "Ab"], answer: "C", icon: Music2 },
    { id: "chords-2", title: "Chord Puzzle", prompt: "In C major, which chord most naturally follows G when you want a strong resolution?", options: ["C", "F#", "Eb", "Ab"], answer: "C", icon: Music2 },
    { id: "chords-3", title: "Chord Puzzle", prompt: "Which chord keeps this progression inside A minor's basic diatonic palette: Am → F → C → ?", options: ["G", "C#", "Bb", "F#"], answer: "G", icon: Music2 },
  ],
  melody: [
    { id: "melody-1", title: "Melody Memory", prompt: "A phrase rises 1 → 3 → 5, then wants a settled ending. Which scale degree gives the strongest resolution?", options: ["1", "7", "#4", "6"], answer: "1", icon: Brain },
    { id: "melody-2", title: "Melody Memory", prompt: "A hook repeats 5 → 5 → 6 → 5. Which next note gives a simple downward release?", options: ["3", "#4", "7", "#1"], answer: "3", icon: Brain },
    { id: "melody-3", title: "Melody Memory", prompt: "Which melodic change is most likely to make a chorus feel bigger than a low, narrow verse?", options: ["Move the melody higher and widen the intervals", "Repeat one low note throughout", "Remove the melody", "Use only rests"], answer: "Move the melody higher and widen the intervals", icon: Brain },
  ],
  arrangement: [
    { id: "arrangement-1", title: "Arrangement Puzzle", prompt: "Your second chorus needs more impact. Which change creates contrast without rewriting the song?", options: ["Drop instruments before the chorus, then bring the full band back", "Repeat the verse unchanged", "Remove the chorus hook", "Slow the entire song by half"], answer: "Drop instruments before the chorus, then bring the full band back", icon: Puzzle },
    { id: "arrangement-2", title: "Arrangement Puzzle", prompt: "The final chorus feels identical to the first. Which arrangement choice adds lift while preserving the song?", options: ["Add harmonies and an extra guitar/keyboard layer", "Mute every instrument", "Delete the chorus", "Replace it with another verse"], answer: "Add harmonies and an extra guitar/keyboard layer", icon: Puzzle },
    { id: "arrangement-3", title: "Arrangement Puzzle", prompt: "A dense verse leaves no space for the vocal. Which adjustment is the strongest first move?", options: ["Thin out competing parts around the vocal", "Add three more lead parts", "Double every instrument", "Make every section louder"], answer: "Thin out competing parts around the vocal", icon: Puzzle },
  ],
};

const shuffle = <T,>(items: T[]) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const buildSessionPuzzles = (): Record<PuzzleType, PuzzleDefinition> =>
  PUZZLE_ORDER.reduce((result, type) => {
    const bank = PUZZLE_BANK[type];
    const source = bank[Math.floor(Math.random() * bank.length)];
    result[type] = { ...source, options: shuffle(source.options) };
    return result;
  }, {} as Record<PuzzleType, PuzzleDefinition>);

export function ActiveSongwritingDialog({ open, onOpenChange, project }: ActiveSongwritingDialogProps) {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();
  const [typeIndex, setTypeIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<PuzzleType, string>>({ lyrics: "", chords: "", melody: "", arrangement: "" });
  const [scores, setScores] = useState<Record<PuzzleType, number>>({ lyrics: 0, chords: 0, melody: 0, arrangement: 0 });
  const [saving, setSaving] = useState(false);
  const [finished, setFinished] = useState(false);
  const [sessionPuzzles, setSessionPuzzles] = useState(buildSessionPuzzles);

  const type = PUZZLE_ORDER[typeIndex];
  const puzzle = sessionPuzzles[type];
  const completedCount = typeIndex + (selected !== null ? 1 : 0);
  const overallScore = useMemo(() => Math.round(PUZZLE_ORDER.reduce((total, key) => total + scores[key], 0) / PUZZLE_ORDER.length), [scores]);

  const choose = (option: string) => {
    if (selected !== null || finished) return;
    setSelected(option);
    setAnswers((current) => ({ ...current, [type]: option }));
    setScores((current) => ({ ...current, [type]: option === puzzle.answer ? 100 : 0 }));
  };

  const nextPuzzle = () => {
    if (selected === null) return;
    if (typeIndex >= PUZZLE_ORDER.length - 1) {
      setFinished(true);
      return;
    }
    setTypeIndex((value) => value + 1);
    setSelected(null);
  };

  const submit = async () => {
    if (!profileId || !finished) return;
    setSaving(true);
    try {
      const payload = PUZZLE_ORDER.reduce<Record<string, { id: string; answer: string }>>((result, key) => {
        result[key] = { id: sessionPuzzles[key].id, answer: answers[key] };
        return result;
      }, {});
      const { data, error } = await rpcClient.rpc("submit_active_songwriting_answers", {
        p_profile_id: profileId,
        p_project_id: project.id,
        p_answers: payload,
      });
      if (error) throw new Error(error.message || "Could not save Active Writing session");
      const result = data as SongwritingReward;
      if (result.awarded === false) {
        toast.error("Daily Active Writing reward cap reached. Normal songwriting sessions are still available.");
      } else {
        const diminishingText = result.diminishing ? " (diminishing returns applied)" : "";
        toast.success(`Active Writing: +${result.music_progress_gained ?? 0} music, +${result.lyrics_progress_gained ?? 0} lyrics${diminishingText}`);
      }
      await queryClient.invalidateQueries({ queryKey: ["songwriting-projects"] });
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save Active Writing session");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setTypeIndex(0);
    setSelected(null);
    setAnswers({ lyrics: "", chords: "", melody: "", arrangement: "" });
    setScores({ lyrics: 0, chords: 0, melody: 0, arrangement: 0 });
    setFinished(false);
    setSessionPuzzles(buildSessionPuzzles());
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { onOpenChange(value); if (!value) reset(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Active Writing</DialogTitle>
          <DialogDescription>Optional short puzzles that add a small bonus to {project.title}. Normal songwriting sessions remain unchanged.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3"><Badge variant="secondary">{puzzle.title}</Badge><span className="text-xs text-muted-foreground">{Math.min(typeIndex + 1, 4)} / 4</span></div>
          <Progress value={(Math.min(completedCount, 4) / 4) * 100} className="h-2" />
          <p className="font-medium leading-relaxed">{puzzle.prompt}</p>
          <div className="grid gap-2">
            {puzzle.options.map((option) => {
              const answered = selected !== null;
              const isCorrect = option === puzzle.answer;
              const isSelected = selected === option;
              return <Button key={option} variant={isSelected ? "default" : "outline"} className={`justify-start h-auto whitespace-normal text-left ${answered && isCorrect ? "border-green-500" : ""}`} onClick={() => choose(option)} disabled={answered || finished}>{option}</Button>;
            })}
          </div>
          {selected !== null && !finished && <div className="rounded-md border bg-muted/30 p-3 text-sm"><p className="font-medium">{selected === puzzle.answer ? "Great musical choice." : "That works less naturally here."}</p><p className="text-muted-foreground mt-1">Your answer is checked again by the game server when the session is saved.</p></div>}
          {finished && <div className="rounded-md border p-4 text-center space-y-2"><p className="text-sm text-muted-foreground">Session score</p><p className="text-4xl font-black">{overallScore}%</p><p className="text-sm">{PUZZLE_ORDER.filter((key) => scores[key] === 100).length} correct from 4 different music puzzles</p></div>}
          <div className="flex gap-2 justify-end">{!finished && selected !== null && <Button onClick={nextPuzzle}>{typeIndex === 3 ? "See Result" : "Next Puzzle"}</Button>}{finished && <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Apply Small Bonus"}</Button>}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
