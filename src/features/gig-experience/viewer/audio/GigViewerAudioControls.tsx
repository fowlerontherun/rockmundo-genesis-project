import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
export function GigViewerAudioControls({ audio }: { audio: ReturnType<typeof import("./useGigViewerAudio").useGigViewerAudio> }) {
  const label = audio.source.available ? `${audio.source.title} (${audio.source.sourceType})` : "Audio unavailable";
  return <section className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm" aria-label="Setlist audio controls">
    <Button type="button" variant={audio.enabled ? "secondary" : "outline"} aria-pressed={audio.enabled} onClick={audio.enabled ? audio.disable : audio.enable}>{audio.enabled ? "Disable Audio" : "Enable Audio"}</Button>
    <Button type="button" variant="outline" aria-pressed={audio.muted} onClick={() => audio.setMuted(!audio.muted)}>{audio.muted ? "Unmute" : "Mute"}</Button>
    <label className="flex min-w-40 items-center gap-2">Volume <Slider aria-label="Gig audio volume" className="w-28" min={0} max={1} step={0.05} value={[audio.volume]} onValueChange={(v) => audio.setVolume(v[0] ?? 0)} /></label>
    <span aria-live="polite" className="text-muted-foreground">{label} · {audio.silentForSpeed ? "Audio is available at normal speed" : audio.status}{audio.error ? ` · ${audio.error}` : ""}</span>
  </section>;
}
