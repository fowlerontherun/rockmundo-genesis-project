import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { GigViewerAudioControls } from "./audio/GigViewerAudioControls";

export function GigViewerShell({ gigId, experience, open, onViewResult, onClose, replayOverride }: { gigId: string; experience?: GigExperienceDTO | null; open: boolean; onViewResult: () => void; onClose: () => void; replayOverride?: import("../events/types").GigViewerReplay | null }) {
  const query = useGigViewerReplay(gigId, open && !replayOverride); const { reducedMotion, setReducedMotion } = useGigViewerPreferences();
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
  return <ReadyReplay replay={result.replay} experience={experience ?? null} open={open} reducedMotion={reducedMotion} setReducedMotion={setReducedMotion} onViewResult={onViewResult} onClose={onClose} />;
}

function ReadyReplay({ replay, experience, open, reducedMotion, setReducedMotion, onViewResult, onClose }: any) {
  const playback = useGigReplayPlayback(replay); const state = playback.state; const story = useMemo(() => buildStoryModel(replay, experience), [replay, experience]); const snapshot = useMemo(() => state ? deriveStorySnapshot(story, state.positionMs, reducedMotion) : null, [story, state?.positionMs, reducedMotion]); const audio = useGigViewerAudio({ experience, snapshot, replaySeed: replay.simulationSeed, isPlaying: !!state?.isPlaying, speed: playback.speed, open });
  const stageType = useMemo(() => selectStageType({ venueName: experience?.gig?.venue?.name ?? null, venueType: (experience?.gig?.venue as any)?.type ?? null, capacity: experience?.gig?.venue?.capacity ?? null }), [experience?.gig?.venue?.name, experience?.gig?.venue?.capacity]);
  useCrowdAmbience({ enabled: !!audio.enabled, muted: !!audio.muted, volume: typeof audio.volume === "number" ? audio.volume : 0.6, isPlaying: !!state?.isPlaying, snapshot, stageType });
  if (!state || !snapshot) return null; const empty = playback.events.length === 0;
  const nextSong = story.songs.find((s) => s.startMs > state.positionMs); const prevSong = [...story.songs].reverse().find((s) => s.startMs < state.positionMs - 1000); const nextHighlight = story.highlights.find((h) => h.offsetMs > state.positionMs);
  return <GigViewerErrorBoundary onResult={onViewResult} onClose={onClose}><Card><CardHeader><CardTitle>Gig Replay</CardTitle></CardHeader><CardContent className="space-y-3"><GigViewerControls playing={state.isPlaying} complete={state.isComplete} speed={playback.speed} reducedMotion={reducedMotion} canPreviousSong={!!prevSong} canNextSong={!!nextSong} canNextHighlight={!!nextHighlight} canResult={story.resultOffsetMs !== null && state.positionMs < story.resultOffsetMs} onPlay={playback.play} onPause={playback.pause} onRestart={playback.restart} onSpeed={playback.setSpeed} onPrevious={playback.previousEvent} onNext={playback.nextEvent} onPreviousSong={() => prevSong && playback.seekMs(prevSong.startMs)} onNextSong={() => nextSong && playback.seekMs(nextSong.startMs)} onNextHighlight={() => nextHighlight && playback.seekMs(nextHighlight.offsetMs)} onSkipResult={() => story.resultOffsetMs !== null && playback.seekMs(story.resultOffsetMs)} onResult={onViewResult} onClose={onClose} onReducedMotion={setReducedMotion} /><GigViewerAudioControls audio={audio} /><GigViewerStatus state={state} attendance={metricNumber(experience?.headline.attendance)} capacity={experience?.gig.venue.capacity} replay={replay} reducedMotion={reducedMotion} /><GigCurrentSongPanel snapshot={snapshot} />{empty ? <GigViewerFallback title="Empty event sequence" body="The replay payload contains no events. Use the report for the authoritative outcome." onResult={onViewResult} onClose={onClose} /> : <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]"><div className="space-y-4"><GigCanvas replay={replay} experience={experience} playbackState={state} reducedMotion={reducedMotion} /><GigResultRevealOverlay visible={snapshot.resultVisible} experience={experience} story={story} onResult={onViewResult} onRestart={playback.restart} onClose={onClose} /><GigCrowdMoodGraph story={story} positionMs={state.positionMs} onSeek={playback.seekMs} /></div><div className="space-y-4"><GigPerformerPanel replay={replay} experience={experience} playbackState={state} reducedMotion={reducedMotion} /><GigViewerTimeline events={playback.events} activeId={state.activeEvent?.id} completedIds={state.completedEventIds} onSelect={playback.seekToEvent} story={story} /></div></div>}</CardContent></Card></GigViewerErrorBoundary>;
}
function metricNumber(metric: any): number | null { return metric?.status === "available" && typeof metric.value === "number" ? metric.value : null; }
