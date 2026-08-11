import type { ReactNode } from "react";
import { Progress } from "@/components/ui/progress";
import type { StorySnapshot } from "./engine/StoryEngine";
import { formatTime } from "./GigViewerTimeline";

interface PlayerGigStageSurfaceProps {
  canvas: ReactNode;
  controls: ReactNode;
  snapshot: StorySnapshot;
  songCount: number;
}

export function PlayerGigStageSurface({
  canvas,
  controls,
  snapshot,
  songCount,
}: PlayerGigStageSurfaceProps) {
  const song = snapshot.song;
  const songDuration = song ? song.elapsedMs + song.remainingMs : 0;
  const progress = song ? Math.min(100, Math.round((song.elapsedMs / Math.max(1, songDuration)) * 100)) : 0;

  return (
    <div
      className="fixed inset-0 z-[80] h-[100dvh] w-screen overflow-hidden bg-slate-950 text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Player gig stage view"
      data-player-stage-view
    >
      <div className="absolute inset-0">{canvas}</div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black via-black/80 to-transparent px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-24 sm:px-5 sm:pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-7xl">
          <div className="mb-3 min-w-0" aria-live="polite">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold drop-shadow sm:text-2xl">
                  {song?.title ?? "The band is taking the stage"}
                </p>
                <p className="text-xs text-white/75 sm:text-sm">
                  {song ? `Song ${song.position} of ${songCount}` : "Live stage performance"}
                </p>
              </div>
              <p className="shrink-0 text-sm font-medium tabular-nums text-white/85 sm:text-base">
                {formatTime(song?.elapsedMs ?? 0)} / {formatTime(songDuration)}
              </p>
            </div>
            <Progress
              value={progress}
              aria-label="Current song progress"
              className="mt-2 h-1.5 bg-white/20 sm:h-2"
            />
          </div>

          <div className="pointer-events-auto max-h-[30dvh] overflow-y-auto rounded-lg bg-background/95 text-foreground shadow-2xl backdrop-blur">
            {controls}
          </div>
        </div>
      </div>
    </div>
  );
}
