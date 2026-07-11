import { useMemo } from "react";
import type { GigViewerReplay } from "../events/types";
import { buildCrowdPlan, reconstructCrowdState } from "./engine/CrowdLifecycle";
import type { DerivedPlaybackState } from "./engine/PlaybackController";
import { formatTime } from "./GigViewerTimeline";
export function GigViewerStatus({ state, attendance, capacity, replay, reducedMotion = false }: { state: DerivedPlaybackState; attendance?: number | null; capacity?: number | null; replay?: GigViewerReplay; reducedMotion?: boolean }) {
  const crowd = useMemo(() => replay ? reconstructCrowdState(buildCrowdPlan({ replay, attendance: attendance ?? 0, capacity: capacity ?? 0, size: { width: 800, height: 450 }, reducedMotion }), state.positionMs, reducedMotion) : null, [replay, attendance, capacity, state.positionMs, reducedMotion]);
  const pct = capacity && attendance != null ? Math.round(Math.min(100, Math.max(0, attendance / capacity * 100))) : null;
  return <div className="rounded-lg border bg-muted/30 p-3" aria-live="polite"><p className="font-semibold">{state.activePhase.replace(/_/g, " ")}{state.currentSongTitle ? ` · ${state.currentSongTitle}` : ""}</p><p className="text-sm text-muted-foreground">{formatTime(state.positionMs)} / {formatTime(state.durationMs)} · Attendance {attendance ?? "unknown"}{capacity ? ` / ${capacity}` : ""}{pct != null ? ` (${pct}%)` : ""}{state.crowdEnergy != null ? ` · Crowd energy ${Math.round(state.crowdEnergy)}` : ""}</p>{crowd ? <p className="mt-1 text-sm text-muted-foreground">Crowd phase: {crowd.phaseLabel} Fill {Math.round(crowd.fillProgress * 100)}%. {crowd.occupiedZones.length ? `Occupied zones: ${crowd.occupiedZones.join(", ")}.` : "No occupied zones yet."}</p> : null}</div>;
}
