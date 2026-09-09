import { CompletedGigStageViewer } from "@/features/gig-experience/viewer/CompletedGigStageViewer";

/** Compatibility entry point. This loader also resolves ongoing gig presentations. */
export function RealtimeGigViewer({ gigId, onComplete }: { gigId: string; onComplete: () => void }) {
  return <CompletedGigStageViewer gigId={gigId} onClose={onComplete} onViewResult={onComplete} />;
}
