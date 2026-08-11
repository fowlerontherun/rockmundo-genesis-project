import type { ReactNode } from "react";
import { Progress } from "@/components/ui/progress";
import type { StorySnapshot } from "./engine/StoryEngine";
import { formatTime } from "./GigViewerTimeline";

interface PlayerGigStageSurfaceProps {
  canvas: ReactNode;
  controls: ReactNode;
  snapshot: StorySnapshot;
  songCount: number;
  fullscreen: boolean;
}

export function PlayerGigStageSurface({
  canvas,
  controls,
  snapshot,
  songCount,
  fullscreen,
}: PlayerGigStageSurfaceProps) {
  const song = snapshot.song;
  const songDuration = song ? song.elapsedMs + song.remainingMs : 0;
  const progress = song ? Math.min(100, Math.round((song.elapsedMs / Math.max(1, songDuration)) * 100)) : 0;

  return (
    <div
      className={fullscreen
        ? "flex h-full w-full flex-col overflow-hidden bg-slate-950 text-white"
        : "flex h-[min(48rem,80dvh)] min-h-[28rem] w-full flex-col overflow-hidden rounded-xl border border-white/10 bg-slate-950 text-white shadow-2xl"}
      role={fullscreen ? "dialog" : "region"}
      aria-modal={fullscreen || undefined}
      aria-label="Player gig stage view"
      data-player-stage-view
      data-fullscreen={fullscreen}
    >
      <div className="relative min-h-0 flex-1 overflow-hidden" data-player-stage-viewport>
        {canvas}
      </div>

      <div className="shrink-0 border-t border-white/10 bg-slate-950/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-5 sm:pb-[max(1rem,env(safe-area-inset-bottom))] sm:pt-4">
        <div className="mx-auto max-w-7xl">
          <div className="min-w-0" aria-live="polite">
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

          <div className="mt-3 max-h-[32dvh] overflow-y-auto rounded-lg bg-background text-foreground">
            {controls}
          </div>
        </div>
      </div>
    </div>
  );
}
