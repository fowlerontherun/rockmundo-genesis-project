import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock3, Loader2, Sparkles, Trophy } from "lucide-react";
import type { SongwritingProject } from "@/hooks/useSongwritingData";

interface CompleteSongDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: SongwritingProject;
  onStartPolish: () => Promise<void>;
  onKeepAsIs: () => Promise<void>;
  onFinish: () => Promise<void>;
}

const getDisplayedQuality = (project: SongwritingProject) => {
  if (typeof project.writing_quality_score === "number") {
    return project.writing_quality_score;
  }
  if (typeof project.song_rating === "number") {
    return project.song_rating;
  }
  if (typeof project.quality_score === "number") {
    return project.quality_score <= 100
      ? Math.round(project.quality_score * 10)
      : project.quality_score;
  }
  return 0;
};

const getTimeSummary = (project: SongwritingProject) => {
  const sessions = (project.songwriting_sessions ?? []).filter(
    (session) => Boolean(session.completed_at),
  );
  const byType = new Map<string, { sessions: number; hours: number }>();

  sessions.forEach((session) => {
    const type = session.session_type || "balanced";
    const entry = byType.get(type) ?? { sessions: 0, hours: 0 };
    entry.sessions += 1;
    entry.hours += session.effort_hours ?? 1;
    byType.set(type, entry);
  });

  const totalHours = Array.from(byType.values()).reduce(
    (sum, entry) => sum + entry.hours,
    0,
  );

  const breakdown = Array.from(byType.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, entry]) => ({
      type,
      label: type.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
      ...entry,
    }));

  return {
    totalHours,
    totalSessions: sessions.length,
    breakdown,
  };
};

export const CompleteSongDialog = ({
  open,
  onOpenChange,
  project,
  onStartPolish,
  onKeepAsIs,
  onFinish,
}: CompleteSongDialogProps) => {
  const [working, setWorking] = useState<"polish" | "keep" | "finish" | null>(
    null,
  );
  const quality = getDisplayedQuality(project);
  const time = useMemo(() => getTimeSummary(project), [project]);
  const chance = project.polish_success_chance ?? 0;
  const polishInProgress =
    Boolean(project.polish_attempted) && !project.polish_resolved_at;
  const polishResolved = Boolean(project.polish_resolved_at);
  const canChoosePolish =
    !project.polish_attempted &&
    !project.polish_skipped &&
    !project.polish_resolved_at;

  const run = async (
    action: "polish" | "keep" | "finish",
    callback: () => Promise<void>,
    closeAfter = false,
  ) => {
    setWorking(action);
    try {
      await callback();
      if (closeAfter) onOpenChange(false);
    } catch {
      // Action callbacks surface their own player-facing error message.
    } finally {
      setWorking(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Songwriting complete
          </DialogTitle>
          <DialogDescription>
            "{project.title}" has finished the writing stage. Review the result
            before creating the song.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border bg-primary/5 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Trophy className="h-4 w-4" />
                Song quality
              </div>
              <p className="mt-1 text-3xl font-bold">{quality}/1000</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock3 className="h-4 w-4" />
                Writing time
              </div>
              <p className="mt-1 text-3xl font-bold">{time.totalHours}h</p>
              <p className="text-xs text-muted-foreground">
                {time.totalSessions} completed session
                {time.totalSessions === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          {time.breakdown.length > 0 && (
            <div className="rounded-lg border p-3">
              <p className="mb-2 text-sm font-medium">Time breakdown</p>
              <div className="flex flex-wrap gap-2">
                {time.breakdown.map((entry) => (
                  <Badge key={entry.type} variant="secondary">
                    {entry.label}: {entry.hours}h ({entry.sessions})
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {canChoosePolish && (
            <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold">One final polish session</p>
                  <p className="text-sm text-muted-foreground">
                    You can spend one more 1-hour writing session polishing the
                    finished song. This attempt has a{" "}
                    <strong className="text-foreground">{chance}% chance</strong>{" "}
                    of improving the song. A failed attempt never lowers its
                    quality.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  disabled={working !== null}
                  onClick={() => void run("keep", onKeepAsIs, true)}
                >
                  {working === "keep" && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Keep as-is & finish
                </Button>
                <Button
                  disabled={working !== null}
                  onClick={() => void run("polish", onStartPolish, true)}
                >
                  {working === "polish" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Final polish ({chance}%)
                </Button>
              </div>
            </div>
          )}

          {polishInProgress && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
              <p className="font-semibold">Final polish in progress</p>
              <p className="text-sm">
                Your one-hour polish session is underway. It will resolve
                automatically when the session ends.
              </p>
              {project.locked_until && (
                <p className="mt-1 text-xs">
                  Scheduled to finish{" "}
                  {new Date(project.locked_until).toLocaleString()}.
                </p>
              )}
            </div>
          )}

          {polishResolved && (
            <div className="space-y-3 rounded-lg border p-4">
              <p className="font-semibold">
                {project.polish_skipped
                  ? "Final polish skipped"
                  : project.polish_succeeded
                    ? "Final polish worked"
                    : "Final polish did not improve the song"}
              </p>
              <p className="text-sm text-muted-foreground">
                {project.polish_skipped
                  ? "The song remains at " + quality + "/1000."
                  : project.polish_succeeded
                    ? "The writing quality is now " + quality + "/1000."
                    : "The attempt is complete and quality remains " + quality + "/1000."}
              </p>
              <div className="flex justify-end">
                <Button
                  disabled={working !== null}
                  onClick={() => void run("finish", onFinish, true)}
                >
                  {working === "finish" && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Finish song
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
