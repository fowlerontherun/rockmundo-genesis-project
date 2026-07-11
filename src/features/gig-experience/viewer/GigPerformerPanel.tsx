import { useMemo } from "react";
import type { GigViewerReplay } from "../events/types";
import type { GigExperienceDTO } from "../types";
import type { DerivedPlaybackState } from "./engine/PlaybackController";
import { buildPerformerPlan, reconstructPerformerState } from "./engine/PerformerLifecycle";

export function GigPerformerPanel({ replay, experience, playbackState, reducedMotion }: { replay: GigViewerReplay; experience: GigExperienceDTO | null; playbackState: DerivedPlaybackState; reducedMotion: boolean }) {
  const performers = useMemo(() => {
    const plan = buildPerformerPlan({ replay, experience, size: { width: 800, height: 450 } });
    return reconstructPerformerState(plan, replay, playbackState.positionMs, { reducedMotion });
  }, [replay, experience, playbackState.positionMs, reducedMotion]);
  if (!performers.length) return <section className="rounded-lg border bg-muted/20 p-3" aria-labelledby="gig-performers-title"><h3 id="gig-performers-title" className="font-semibold">Performers</h3><p className="text-sm text-muted-foreground">No authoritative performer lineup is available for this replay.</p></section>;
  return <section className="rounded-lg border bg-muted/20 p-3" aria-labelledby="gig-performers-title">
    <h3 id="gig-performers-title" className="font-semibold">Performers</h3>
    <ul className="mt-2 space-y-2 text-sm">
      {performers.map((p) => {
        const focused = playbackState.performerFocusId === p.id || p.activeMoveEventId === playbackState.activeEvent?.id;
        return <li key={p.id} className="rounded border bg-background/70 p-2" aria-current={focused ? "true" : undefined}>
          <span className="font-medium">{p.displayName}</span>
          <span className="text-muted-foreground"> — {p.roleLabel}{p.instrument && p.instrument !== p.roleLabel ? ` (${p.instrument})` : ""} — {stateText(p.lifecycleState, p.stageDescription)}{focused ? " Current focus." : ""}</span>
        </li>;
      })}
    </ul>
  </section>;
}
function stateText(state: string, stageDescription: string) {
  if (state === "waiting_backstage") return "Waiting backstage.";
  if (state === "entering") return "Entering the stage.";
  if (state === "taking_position") return `Taking position, ${stageDescription}.`;
  if (state === "performing") return `Performing, ${stageDescription}.`;
  if (state === "exiting") return "Leaving the stage.";
  return "Offstage.";
}
