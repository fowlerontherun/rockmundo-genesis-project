import { CompletedGigStageViewer } from "@/features/gig-experience/viewer/CompletedGigStageViewer";

/** Compatibility entry point for saved links/imports. Uses the shared 3D player. */
export function TopDownGigViewer({ gigId, onComplete }: { gigId: string; onComplete?: () => void }) {
  return <CompletedGigStageViewer gigId={gigId} onClose={onComplete} onViewResult={onComplete} />;
}
