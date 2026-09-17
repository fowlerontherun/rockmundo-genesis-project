import type { GigViewerReplay } from "@/features/gig-experience/events/types";
import type { GigExperienceDTO } from "@/features/gig-experience/types";
import type { DerivedPlaybackState } from "@/features/gig-experience/viewer/engine/PlaybackController";
import { GigCanvas } from "@/features/gig-experience/viewer/GigCanvas";
import type { PerformancePreference } from "@/features/gig-experience/viewer/hooks/useGigViewerPreferences";
import type { TotpBroadcastCue } from "./broadcastTimeline";
import { formatTotpChartGraphic } from "./broadcastTimeline";
import { resolveTotpPresenter, totpVariantLabel } from "./presenters";
import { totpAudienceCrowdTuning, totpAudienceReactionLabel } from "./studioAudience";

export interface TotpBroadcastCanvasProps {
  replay: GigViewerReplay;
  experience: GigExperienceDTO | null;
  playbackState: DerivedPlaybackState;
  cue?: TotpBroadcastCue | null;
  audienceReaction?: number | null;
  presenterKey?: string | null;
  showVariant?: string | null;
  reducedMotion?: boolean;
  performancePreference?: PerformancePreference;
  className?: string;
}

/**
 * Broadcast-facing wrapper around the existing 3D Gig Viewer canvas.
 * TOTP owns only presentation direction/graphics; performer models, instruments,
 * playback reconstruction and WebGL rendering remain the shared gig systems.
 */
export function TotpBroadcastCanvas({
  replay,
  experience,
  playbackState,
  cue,
  audienceReaction = 0,
  presenterKey = "alex_rayne",
  showVariant = "regular",
  reducedMotion = false,
  performancePreference = "auto",
  className,
}: TotpBroadcastCanvasProps) {
  const directedShot = reducedMotion ? "studio_master" : cue?.cameraShot ?? "studio_master";
  const directedStage = cue?.stage ?? "main_stage";
  const lowerThird = cue?.type === "graphic" ? cue.graphic : null;
  const presenterText = cue?.type === "presenter" ? cue.presenterText : null;
  const lockedAudienceReaction = Number.isFinite(Number(audienceReaction)) ? Number(audienceReaction) : 0;
  const crowdTuning = totpAudienceCrowdTuning(lockedAudienceReaction);
  const audienceLabel = totpAudienceReactionLabel(lockedAudienceReaction);
  const presenter = resolveTotpPresenter(presenterKey);
  const variantLabel = totpVariantLabel(showVariant);

  return (
    <div
      className={className ?? "relative h-full min-h-[28rem] w-full overflow-hidden bg-slate-950"}
      data-totp-broadcast
      data-totp-cue={cue?.type ?? "performance"}
      data-totp-shot={directedShot}
      data-totp-stage={directedStage}
      data-totp-presenter={presenter.key}
      data-totp-show-variant={showVariant ?? "regular"}
      data-totp-audience-reaction={lockedAudienceReaction}
      data-totp-audience-label={audienceLabel.toLowerCase()}
    >
      <GigCanvas
        replay={replay}
        experience={experience}
        playbackState={playbackState}
        reducedMotion={reducedMotion}
        pyrotechnics
        crowdTuning={crowdTuning}
        fill
        immersive
        cameraMode="auto"
        performancePreference={performancePreference}
        presentationMode="totp"
        totpCameraShot={directedShot}
        totpStage={directedStage}
        totpPresenterKey={presenter.key}
        totpShowVariant={showVariant}
        capability={{ audience: "player", subjectId: `totp:${replay.id}` }}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 text-white" aria-hidden="true">
        <div className="rounded-md bg-fuchsia-700/90 px-3 py-2 text-xs font-black tracking-[0.18em] shadow-lg backdrop-blur">
          TOP OF THE POPS{variantLabel ? ` · ${variantLabel.toUpperCase()}` : ""}
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-black/65 px-3 py-2 text-[11px] font-semibold tracking-wide backdrop-blur">
            {presenter.displayName.toUpperCase()} · ROCKMUNDO TELEVISION
          </div>
          <div className="rounded-md bg-black/65 px-3 py-2 text-[11px] font-semibold tracking-wide backdrop-blur">
            AUDIENCE · {audienceLabel.toUpperCase()}
          </div>
        </div>
      </div>

      {lowerThird && (
        <div className="pointer-events-none absolute bottom-8 left-6 max-w-[min(34rem,75vw)] text-white" role="status" aria-live="polite">
          <div className="border-l-4 border-fuchsia-400 bg-black/80 px-5 py-4 shadow-2xl backdrop-blur-md">
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0">
                <p className="truncate text-xl font-black uppercase tracking-wide sm:text-2xl">{lowerThird.artistName}</p>
                <p className="mt-0.5 truncate text-sm text-white/80 sm:text-base">{lowerThird.songTitle}</p>
              </div>
              <p className="shrink-0 text-lg font-black text-fuchsia-300 sm:text-xl">{formatTotpChartGraphic(lowerThird)}</p>
            </div>
          </div>
        </div>
      )}

      {presenterText && (
        <div className="pointer-events-none absolute bottom-8 left-1/2 w-[min(46rem,86vw)] -translate-x-1/2" role="status" aria-live="polite">
          <div className="rounded-lg border border-white/15 bg-black/75 px-5 py-4 text-center text-sm font-medium leading-relaxed text-white shadow-2xl backdrop-blur-md sm:text-base">
            <span className="mr-2 font-black uppercase tracking-wide text-fuchsia-300">{presenter.displayName}:</span>
            {presenterText}
          </div>
        </div>
      )}
    </div>
  );
}

export default TotpBroadcastCanvas;
