import { useEffect, useState } from "react";
import { buildGigViewerReplay } from "../events/generator";
import type { GigExperienceDTO } from "../types";
import type { GigViewerReplay } from "../events/types";
import { GigViewerShell } from "./GigViewerShell";
import { GigViewerFallback } from "./GigViewerFallback";
import { createGigExperienceLoadError, getGigExperienceErrorDisplay } from "../diagnostics";
import { buildLocalPresentationInput } from "./buildLocalPresentationInput";

/**
 * Presentation-only bridge so live and freshly completed gigs render with the
 * same updated viewer engine as the admin demo. When no stored canonical replay
 * exists yet, a deterministic replay is generated client-side from the gig
 * experience DTO. No game records are read or written here beyond the DTO.
 */
export function LiveGigStageView({
  gigId,
  experience,
  onViewResult,
  onClose,
}: {
  gigId: string;
  experience: GigExperienceDTO;
  onViewResult: () => void;
  onClose: () => void;
}) {
  const [replay, setReplay] = useState<GigViewerReplay | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const resultAvailable = experience.viewer.ready && !!experience.viewer.resultReadyAt;

  useEffect(() => {
    let alive = true;
    setReplay(null);
    setFailure(null);
    buildGigViewerReplay(buildLocalPresentationInput(gigId, experience))
      .then((built) => {
        if (alive) setReplay(built as GigViewerReplay);
      })
      .catch((error) => {
        if (alive) {
          setFailure(createGigExperienceLoadError(gigId, "presentation", "buildGigViewerReplay", error));
        }
      });
    return () => {
      alive = false;
    };
  }, [attempt, gigId, experience, resultAvailable]);

  if (failure) {
    const diagnostic = getGigExperienceErrorDisplay(failure, gigId);
    return (
      <GigViewerFallback
        title="Stage view unavailable"
        body="The presentation sequence could not be prepared. Your saved setlist and authoritative gig data are unchanged."
        diagnosticReference={diagnostic.reference}
        onRetry={() => setAttempt((value) => value + 1)}
        onResult={resultAvailable ? onViewResult : undefined}
        onClose={onClose}
      />
    );
  }

  if (!replay) {
    return (
      <GigViewerFallback
        title="Preparing stage view"
        body="Building a read-only presentation from the saved gig setlist."
        onClose={onClose}
      />
    );
  }

  return (
    <GigViewerShell
      gigId={gigId}
      experience={experience}
      open
      mode="player"
      replayOverride={replay}
      onViewResult={onViewResult}
      onClose={onClose}
    />
  );
}
