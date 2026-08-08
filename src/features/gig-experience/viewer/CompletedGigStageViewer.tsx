import { Card, CardContent } from "@/components/ui/card";
import { useGigExperience } from "../hooks";
import { GigViewerShell } from "./GigViewerShell";
import { LiveGigStageView } from "./LiveGigStageView";

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
  const { data: experience, isLoading, isError } = useGigExperience(gigId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">Loading stage view…</CardContent>
      </Card>
    );
  }

  if (isError || !experience) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          The stage view is not available for this performance.
        </CardContent>
      </Card>
    );
  }

  const noop = () => {};

  if (experience.viewer.replayAvailable) {
    return (
      <GigViewerShell
        gigId={gigId}
        experience={experience}
        open
        onViewResult={onViewResult ?? noop}
        onClose={onClose ?? noop}
      />
    );
  }

  if (experience.songs.length > 0) {
    return (
      <LiveGigStageView
        gigId={gigId}
        experience={experience}
        onViewResult={onViewResult ?? noop}
        onClose={onClose ?? noop}
      />
    );
  }

  return (
    <Card>
      <CardContent className="p-4 text-sm text-muted-foreground">
        No setlist data was stored for this gig, so the stage view can't be rebuilt.
      </CardContent>
    </Card>
  );
}
