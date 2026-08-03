import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useGigViewerReplay } from "../hooks";
import type { GigExperienceDTO } from "../types";
import { GigCanvas } from "./GigCanvas";
import { GigCrowdMoodGraph } from "./GigCrowdMoodGraph";
import { GigCurrentSongPanel } from "./GigCurrentSongPanel";
import { GigResultRevealOverlay } from "./GigResultRevealOverlay";
import { GigViewerControls } from "./GigViewerControls";
import { GigViewerErrorBoundary } from "./GigViewerErrorBoundary";
import { GigViewerFallback } from "./GigViewerFallback";
import { GigViewerStatus } from "./GigViewerStatus";
import { GigViewerTimeline } from "./GigViewerTimeline";
import { GigPerformerPanel } from "./GigPerformerPanel";
import { buildStoryModel, deriveStorySnapshot } from "./engine/StoryEngine";
import { useGigReplayPlayback } from "./hooks/useGigReplayPlayback";
import { useGigViewerPreferences } from "./hooks/useGigViewerPreferences";
import { useGigViewerAudio } from "./audio/useGigViewerAudio";
import { useCrowdAmbience } from "./audio/useCrowdAmbience";
import { selectStageType } from "./engine/VenueLayout";
import { StageTypeLabels } from "./engine/StageDecor";
import { GigViewerAudioControls } from "./audio/GigViewerAudioControls";

export function GigViewerShell({ gigId, experience, open, onViewResult, onClose, replayOverride }: { gigId: string; experience?: GigExperienceDTO | null; open: boolean; onViewResult: () => void; onClose: () => void; replayOverride?: import("../events/types").GigViewerReplay | null }) {
  const query = useGigViewerReplay(gigId, open && !replayOverride); const prefs = useGigViewerPreferences();
  if (!open) return null; const cancelled = experience && ["cancelled", "canceled", "abandoned"].includes(experience.gig.status);
  if (cancelled) return <GigViewerFallback title="Gig cancelled" body="This gig did not complete, so no canonical replay can be shown." onResult={onViewResult} onClose={onClose} />;
  if (!replayOverride && query.isLoading) return <GigViewerFallback title="Loading replay" body="Opening the stored read-only replay payload." onResult={onViewResult} onClose={onClose} />;
  if (!replayOverride && query.isError) { const message = String((query.error as any)?.message ?? "Network error"); const accessDenied = /permission|rls|denied|jwt|auth/i.test(message); return <GigViewerFallback title={accessDenied ? "Access denied" : "Network error"} body={accessDenied ? "Your account cannot read this replay. Report access is unchanged if available." : "The replay could not be loaded from storage."} onRetry={() => query.refetch()} onResult={onViewResult} onClose={onClose} />; }
  const result = replayOverride ? { state: "ready" as const, replay: replayOverride } : query.data;
  if (!result || result.state === "unavailable") return <GigViewerFallback title="Replay unavailable" body="No stored canonical replay exists for this legacy or incomplete gig. The result report remains available." onRetry={() => query.refetch()} onResult={onViewResult} onClose={onClose} />;
  if (result.state === "generating") return <GigViewerFallback title="Replay processing" body="The replay row exists but is still generating. Try again shortly; the report remains available." onRetry={() => query.refetch()} onResult={onViewResult} onClose={onClose} />;
  if (result.state === "unsupported_version") return <GigViewerFallback title="Unsupported replay version" body="This stored replay uses a viewer or event-schema version this client does not support. Use the report or text timeline fallback." onResult={onViewResult} onClose={onClose} />;
  if (result.state === "failed") return <GigViewerFallback title={result.reason === "malformed_replay" ? "Malformed replay" : "Replay generation failed"} body="The stored replay cannot be rendered safely. The authoritative result report remains available." onRetry={() => query.refetch()} onResult={onViewResult} onClose={onClose} />;
  if (!result.replay) return <GigViewerFallback title="Malformed replay" body="Replay metadata loaded without a valid payload." onResult={onViewResult} onClose={onClose} />;
  return <ReadyReplay replay={result.replay} experience={experience ?? null} open={open} prefs={prefs} onViewResult={onViewResult} onClose={onClose} />;
}

function ReadyReplay({ replay, experience, open, prefs, onViewResult, onClose }: any) {
  const { reducedMotion, setReducedMotion, pyrotechnics, setPyrotechnics } = prefs;
  const playback = useGigReplayPlayback(replay); const state = playback.state; const story = useMemo(() => buildStoryModel(replay, experience), [replay, experience]); const snapshot = useMemo(() => state ? deriveStorySnapshot(story, state.positionMs, reducedMotion) : null, [story, state?.positionMs, reducedMotion]); const audio = useGigViewerAudio({ experience, snapshot, replaySeed: replay.simulationSeed, isPlaying: !!state?.isPlaying, speed: playback.speed, open });
  const stageType = useMemo(() => selectStageType({ venueName: experience?.gig?.venue?.name ?? null, venueType: (experience?.gig?.venue as any)?.type ?? null, capacity: experience?.gig?.venue?.capacity ?? null }), [experience?.gig?.venue?.name, experience?.gig?.venue?.capacity]);
  useCrowdAmbience({ enabled: !!audio.enabled, muted: !!audio.muted, volume: typeof audio.volume === "number" ? audio.volume : 0.6, isPlaying: !!state?.isPlaying, snapshot, stageType });
  const [fullscreen, setFullscreen] = useState(false);
  const popoutRef = useRef<HTMLDivElement>(null);
  const toggleFullscreen = useCallback(() => {
    setFullscreen((prev) => {
      const next = !prev;
      try {
        if (next) popoutRef.current?.requestFullscreen?.().catch(() => {});
        else if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      } catch { /* fullscreen API unavailable: overlay still applies */ }
      return next;
    });
  }, []);
  useEffect(() => {
    const onChange = () => { if (!document.fullscreenElement) setFullscreen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFullscreen(false); };
    document.addEventListener("fullscreenchange", onChange);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("fullscreenchange", onChange); window.removeEventListener("keydown", onKey); };
  }, []);
  useEffect(() => {
    if (!fullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [fullscreen]);
  if (!state || !snapshot) return null; const empty = playback.events.length === 0;
  const nextSong = story.songs.find((s: any) => s.startMs > state.positionMs); const prevSong = [...story.songs].reverse().find((s: any) => s.startMs < state.positionMs - 1000); const nextHighlight = story.highlights.find((h: any) => h.offsetMs > state.positionMs);
  const controls = <GigViewerControls playing={state.isPlaying} complete={state.isComplete} speed={playback.speed} reducedMotion={reducedMotion} pyrotechnics={pyrotechnics} fullscreen={fullscreen} canPreviousSong={!!prevSong} canNextSong={!!nextSong} canNextHighlight={!!nextHighlight} canResult={story.resultOffsetMs !== null && state.positionMs < story.resultOffsetMs} onPlay={playback.play} onPause={playback.pause} onRestart={playback.restart} onSpeed={playback.setSpeed} onPrevious={playback.previousEvent} onNext={playback.nextEvent} onPreviousSong={() => prevSong && playback.seekMs(prevSong.startMs)} onNextSong={() => nextSong && playback.seekMs(nextSong.startMs)} onNextHighlight={() => nextHighlight && playback.seekMs(nextHighlight.offsetMs)} onSkipResult={() => story.resultOffsetMs !== null && playback.seekMs(story.resultOffsetMs)} onResult={onViewResult} onClose={onClose} onReducedMotion={setReducedMotion} onPyrotechnics={setPyrotechnics} onFullscreen={toggleFullscreen} />;
  const compactControls = <GigViewerControls compact playing={state.isPlaying} complete={state.isComplete} speed={playback.speed} reducedMotion={reducedMotion} pyrotechnics={pyrotechnics} fullscreen={fullscreen} canPreviousSong={!!prevSong} canNextSong={!!nextSong} canNextHighlight={!!nextHighlight} canResult={story.resultOffsetMs !== null && state.positionMs < story.resultOffsetMs} onPlay={playback.play} onPause={playback.pause} onRestart={playback.restart} onSpeed={playback.setSpeed} onPrevious={playback.previousEvent} onNext={playback.nextEvent} onPreviousSong={() => prevSong && playback.seekMs(prevSong.startMs)} onNextSong={() => nextSong && playback.seekMs(nextSong.startMs)} onNextHighlight={() => nextHighlight && playback.seekMs(nextHighlight.offsetMs)} onSkipResult={() => story.resultOffsetMs !== null && playback.seekMs(story.resultOffsetMs)} onResult={onViewResult} onClose={onClose} onReducedMotion={setReducedMotion} onPyrotechnics={setPyrotechnics} onFullscreen={toggleFullscreen} />;
  const canvas = <GigCanvas replay={replay} experience={experience} playbackState={state} reducedMotion={reducedMotion} pyrotechnics={pyrotechnics} fill={fullscreen} className={fullscreen ? "h-full min-h-0 w-full" : "w-full"} />;

  if (fullscreen) {
    return (
      <GigViewerErrorBoundary onResult={onViewResult} onClose={onClose}>
        <div ref={popoutRef} className="fixed inset-0 z-[70] flex h-[100dvh] w-screen flex-col gap-2 overflow-hidden bg-background p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))] sm:gap-3 sm:p-3" role="dialog" aria-modal="true" aria-label="Full screen gig stage view">
          <div className="flex shrink-0 items-center justify-between gap-2 pr-12 sm:pr-0">
            <h2 className="truncate text-sm font-semibold sm:text-lg">{experience?.gig?.venue?.name ?? "Gig replay"} · {StageTypeLabels[stageType]}</h2>
            <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{snapshot.crowdMoodLabel} · energy {Math.round(snapshot.crowdEnergy)}</span>
          </div>
          {/* Always-visible exit affordance: mobile browsers often refuse the Fullscreen API, so the overlay needs its own close button. */}
          <Button variant="secondary" size="icon" onClick={toggleFullscreen} aria-label="Exit full screen stage view" className="absolute right-2 top-[max(0.5rem,env(safe-area-inset-top))] z-10 h-11 w-11 rounded-full shadow-lg">
            <X className="h-5 w-5" />
          </Button>
          <div className="min-h-0 flex-1">{canvas}</div>
          <div className="shrink-0 space-y-2">
            <div className="sm:hidden"><span className="text-xs text-muted-foreground">{snapshot.crowdMoodLabel} · energy {Math.round(snapshot.crowdEnergy)}</span></div>
            <GigCurrentSongPanel snapshot={snapshot} />
            <div className="sm:hidden">{compactControls}</div>
            <div className="hidden sm:block">{controls}</div>
          </div>
        </div>
      </GigViewerErrorBoundary>
    );
  }

  return <GigViewerErrorBoundary onResult={onViewResult} onClose={onClose}><div ref={popoutRef}><Card><CardHeader><CardTitle>Gig Replay · {StageTypeLabels[stageType]}</CardTitle></CardHeader><CardContent className="space-y-3">{controls}<GigViewerAudioControls audio={audio} /><GigViewerStatus state={state} attendance={metricNumber(experience?.headline.attendance)} capacity={experience?.gig.venue.capacity} replay={replay} reducedMotion={reducedMotion} /><GigCurrentSongPanel snapshot={snapshot} />{empty ? <GigViewerFallback title="Empty event sequence" body="The replay payload contains no events. Use the report for the authoritative outcome." onResult={onViewResult} onClose={onClose} /> : <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]"><div className="space-y-4">{canvas}<GigResultRevealOverlay visible={snapshot.resultVisible} experience={experience} story={story} onResult={onViewResult} onRestart={playback.restart} onClose={onClose} /><GigCrowdMoodGraph story={story} positionMs={state.positionMs} onSeek={playback.seekMs} /></div><div className="space-y-4"><GigPerformerPanel replay={replay} experience={experience} playbackState={state} reducedMotion={reducedMotion} /><GigViewerTimeline events={playback.events} activeId={state.activeEvent?.id} completedIds={state.completedEventIds} onSelect={playback.seekToEvent} story={story} /></div></div>}</CardContent></Card></div></GigViewerErrorBoundary>;
}
function metricNumber(metric: any): number | null { return metric?.status === "available" && typeof metric.value === "number" ? metric.value : null; }
