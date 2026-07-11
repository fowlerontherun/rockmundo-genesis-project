import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGigViewerReplay } from "../hooks";
import type { GigExperienceDTO } from "../types";
import { GigCanvas } from "./GigCanvas";
import { GigViewerControls } from "./GigViewerControls";
import { GigViewerErrorBoundary } from "./GigViewerErrorBoundary";
import { GigViewerFallback } from "./GigViewerFallback";
import { GigViewerStatus } from "./GigViewerStatus";
import { GigViewerTimeline } from "./GigViewerTimeline";
import { GigPerformerPanel } from "./GigPerformerPanel";
import { useGigReplayPlayback } from "./hooks/useGigReplayPlayback";
import { useGigViewerPreferences } from "./hooks/useGigViewerPreferences";

export function GigViewerShell({ gigId, experience, open, onViewResult, onClose }: { gigId: string; experience?: GigExperienceDTO | null; open: boolean; onViewResult: () => void; onClose: () => void }) {
  const query = useGigViewerReplay(gigId, open);
  const { reducedMotion, setReducedMotion } = useGigViewerPreferences();
  if (!open) return null;
  const cancelled = experience && ["cancelled", "canceled", "abandoned"].includes(experience.gig.status);
  if (cancelled) return <GigViewerFallback title="Gig cancelled" body="This gig did not complete, so no canonical replay can be shown." onResult={onViewResult} onClose={onClose} />;
  if (query.isLoading) return <GigViewerFallback title="Loading replay" body="Opening the stored read-only replay payload." onResult={onViewResult} onClose={onClose} />;
  if (query.isError) { const message = String((query.error as any)?.message ?? "Network error"); const accessDenied = /permission|rls|denied|jwt|auth/i.test(message); return <GigViewerFallback title={accessDenied ? "Access denied" : "Network error"} body={accessDenied ? "Your account cannot read this replay. Report access is unchanged if available." : "The replay could not be loaded from storage."} onRetry={() => query.refetch()} onResult={onViewResult} onClose={onClose} />; }
  const result = query.data;
  if (!result || result.state === "unavailable") return <GigViewerFallback title="Replay unavailable" body="No stored canonical replay exists for this legacy or incomplete gig. The result report remains available." onRetry={() => query.refetch()} onResult={onViewResult} onClose={onClose} />;
  if (result.state === "generating") return <GigViewerFallback title="Replay processing" body="The replay row exists but is still generating. Try again shortly; the report remains available." onRetry={() => query.refetch()} onResult={onViewResult} onClose={onClose} />;
  if (result.state === "unsupported_version") return <GigViewerFallback title="Unsupported replay version" body="This stored replay uses a viewer or event-schema version this client does not support. Use the report or text timeline fallback." onResult={onViewResult} onClose={onClose} />;
  if (result.state === "failed") return <GigViewerFallback title={result.reason === "malformed_replay" ? "Malformed replay" : "Replay generation failed"} body="The stored replay cannot be rendered safely. The authoritative result report remains available." onRetry={() => query.refetch()} onResult={onViewResult} onClose={onClose} />;
  if (!result.replay) return <GigViewerFallback title="Malformed replay" body="Replay metadata loaded without a valid payload." onResult={onViewResult} onClose={onClose} />;
  return <ReadyReplay replay={result.replay} experience={experience ?? null} reducedMotion={reducedMotion} setReducedMotion={setReducedMotion} onViewResult={onViewResult} onClose={onClose} />;
}

function ReadyReplay({ replay, experience, reducedMotion, setReducedMotion, onViewResult, onClose }: any) {
  const playback = useGigReplayPlayback(replay);
  const state = playback.state;
  if (!state) return null;
  const empty = playback.events.length === 0;
  return <GigViewerErrorBoundary onResult={onViewResult} onClose={onClose}><Card><CardHeader><CardTitle>Gig Replay</CardTitle></CardHeader><CardContent className="space-y-3"><GigViewerControls playing={state.isPlaying} complete={state.isComplete} speed={playback.speed} reducedMotion={reducedMotion} onPlay={playback.play} onPause={playback.pause} onRestart={playback.restart} onSpeed={playback.setSpeed} onPrevious={playback.previousEvent} onNext={playback.nextEvent} onResult={onViewResult} onClose={onClose} onReducedMotion={setReducedMotion} /><GigViewerStatus state={state} attendance={metricNumber(experience?.headline.attendance)} capacity={experience?.gig.venue.capacity} replay={replay} reducedMotion={reducedMotion} />{empty ? <GigViewerFallback title="Empty event sequence" body="The replay payload contains no events. Use the report for the authoritative outcome." onResult={onViewResult} onClose={onClose} /> : <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]"><GigCanvas replay={replay} experience={experience} playbackState={state} reducedMotion={reducedMotion} /><div className="space-y-4"><GigPerformerPanel replay={replay} experience={experience} playbackState={state} reducedMotion={reducedMotion} /><GigViewerTimeline events={playback.events} activeId={state.activeEvent?.id} completedIds={state.completedEventIds} onSelect={playback.seekToEvent} /></div></div>}</CardContent></Card></GigViewerErrorBoundary>;
}
function metricNumber(metric: any): number | null { return metric?.status === "available" && typeof metric.value === "number" ? metric.value : null; }
