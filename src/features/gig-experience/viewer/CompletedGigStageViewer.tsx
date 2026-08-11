import { useGigExperience } from "../hooks";
import { GigViewerShell } from "./GigViewerShell";
import { LiveGigStageView } from "./LiveGigStageView";
import { GigViewerFallback } from "./GigViewerFallback";

/**
 * Presentation-only entry point for rewatching a completed gig. Loads the gig
 * experience DTO and renders the stored canonical replay when available,
 * otherwise falls back to a deterministic client-built replay.
 */
export function CompletedGigStageViewer({
  gigId,
  onViewResult,
  onClose,
}: {
  gigId: string;
  onViewResult?: () => void;
  onClose?: () => void;
}) {
  const { data: experience, isLoading, isError, refetch } = useGigExperience(gigId);
  const noop = () => {};
  const close = onClose ?? noop;

  if (isLoading) {
    return (
      <GigViewerFallback
        title="Loading stage view"
        body="Loading the saved gig and its presentation data."
        onClose={onClose}
      />
    );
  }

  if (isError || !experience) {
    return (
      <GigViewerFallback
        title="Stage view unavailable"
        body="The gig data could not be loaded. Retry without changing the saved performance."
        onRetry={() => void refetch()}
        onClose={onClose}
      />
    );
  }

  if (experience.viewer.replayAvailable) {
    return (
      <GigViewerShell
        gigId={gigId}
        experience={experience}
        open
        onViewResult={onViewResult ?? noop}
        onClose={close}
      />
    );
  }

  if (experience.songs.length > 0) {
    return (
      <LiveGigStageView
        gigId={gigId}
        experience={experience}
        onViewResult={onViewResult ?? noop}
        onClose={close}
      />
    );
  }

  return (
    <GigViewerFallback
      title="Stage view unavailable"
      body="No setlist was stored for this gig, so a presentation cannot be rebuilt."
      onResult={experience.viewer.ready ? onViewResult : undefined}
      onClose={onClose}
    />
  );
}
