import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Maximize2, Minimize2 } from "lucide-react";
import type { PlaybackSpeed } from "./engine/PlaybackController";

export function GigViewerControls({ playing, complete, speed, reducedMotion, pyrotechnics, fullscreen, canPreviousSong, canNextSong, canNextHighlight, canResult, onPlay, onPause, onRestart, onSpeed, onPrevious, onNext, onPreviousSong, onNextSong, onNextHighlight, onSkipResult, onResult, onClose, onReducedMotion, onPyrotechnics, onFullscreen }: { playing: boolean; complete: boolean; speed: PlaybackSpeed; reducedMotion: boolean; pyrotechnics?: boolean; fullscreen?: boolean; canPreviousSong?: boolean; canNextSong?: boolean; canNextHighlight?: boolean; canResult?: boolean; onPlay: () => void; onPause: () => void; onRestart: () => void; onSpeed: (speed: PlaybackSpeed) => void; onPrevious: () => void; onNext: () => void; onPreviousSong?: () => void; onNextSong?: () => void; onNextHighlight?: () => void; onSkipResult?: () => void; onResult: () => void; onClose: () => void; onReducedMotion: (v: boolean) => void; onPyrotechnics?: (v: boolean) => void; onFullscreen?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3" aria-label="Replay controls">
      <Button onClick={playing ? onPause : onPlay} aria-pressed={playing}>{playing ? "Pause" : complete ? "Play again" : "Play"}</Button>
      <Button variant="outline" onClick={onRestart}>Restart</Button>
      <Button variant="outline" onClick={onPrevious}>Previous event</Button>
      <Button variant="outline" onClick={onNext}>Next event</Button>
      <Button variant="outline" disabled={!canPreviousSong} onClick={onPreviousSong} aria-label="Skip to previous song">Previous song</Button>
      <Button variant="outline" disabled={!canNextSong} onClick={onNextSong} aria-label="Skip to next song">Next song</Button>
      <Button variant="outline" disabled={!canNextHighlight} onClick={onNextHighlight} aria-label="Skip to next highlight">Next highlight</Button>
      <Button variant="outline" disabled={!canResult} onClick={onSkipResult} aria-label="Skip to result reveal">Skip to result</Button>
      <div className="flex rounded-md border p-1" role="group" aria-label="Playback speed">
        {([1, 2, 4] as PlaybackSpeed[]).map((s) => <Button key={s} size="sm" variant={speed === s ? "default" : "ghost"} aria-pressed={speed === s} onClick={() => onSpeed(s)}>{s === 4 ? "Fast" : `${s}×`}</Button>)}
      </div>
      <label className="flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm"><Switch checked={reducedMotion} onCheckedChange={onReducedMotion} aria-label="Reduced motion" />Reduced motion</label>
      {onPyrotechnics ? <label className="flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm"><Switch checked={!!pyrotechnics} onCheckedChange={onPyrotechnics} aria-label="Pyrotechnics and fireworks" />Pyrotechnics</label> : null}
      {onFullscreen ? <Button variant="outline" onClick={onFullscreen} aria-pressed={!!fullscreen} aria-label={fullscreen ? "Exit full screen stage view" : "Pop out full screen stage view"}>{fullscreen ? <Minimize2 className="mr-1 h-4 w-4" /> : <Maximize2 className="mr-1 h-4 w-4" />}{fullscreen ? "Exit full screen" : "Pop out"}</Button> : null}
      <Button variant="secondary" onClick={onResult}>View Result</Button>
      <Button variant="ghost" onClick={onClose}>Close Viewer</Button>
    </div>
  );
}
