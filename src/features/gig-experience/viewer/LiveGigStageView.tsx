import { useEffect, useRef, useState } from "react";
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
  const fullscreenHostRef = useRef<HTMLDivElement>(null);
  const ownsNativeFullscreenRef = useRef(false);
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

  // Live player viewing is always presented as a viewport-filling experience.
  // Native browser fullscreen is requested too when the browser permits an
  // automatic request from the user action that opened the live viewer. Browsers
  // that require another explicit gesture still receive the full-window overlay.
  useEffect(() => {
    if (!replay) return;
    const host = fullscreenHostRef.current;
    if (!host) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    if (!document.fullscreenElement && host.requestFullscreen) {
      try {
        void host.requestFullscreen()
          .then(() => {
            ownsNativeFullscreenRef.current = document.fullscreenElement === host;
          })
          .catch(() => {
            ownsNativeFullscreenRef.current = false;
          });
      } catch {
        ownsNativeFullscreenRef.current = false;
      }
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      if (ownsNativeFullscreenRef.current && document.fullscreenElement === host) {
        try {
          void document.exitFullscreen?.().catch(() => undefined);
        } catch {
          // The live viewer still closes normally if the browser rejects exit.
        }
      }
      ownsNativeFullscreenRef.current = false;
    };
  }, [replay]);

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
    <div ref={fullscreenHostRef} className="fixed inset-0 z-[100] h-dvh w-screen overflow-hidden bg-black">
      <GigViewerShell
        gigId={gigId}
        experience={experience}
        open
        mode="player"
        replayOverride={replay}
        onViewResult={onViewResult}
        onClose={onClose}
      />
    </div>
  );
}
