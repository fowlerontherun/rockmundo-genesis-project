import type { GigViewerReplay } from "@/features/gig-experience/events/types";
import type { GigExperienceDTO } from "@/features/gig-experience/types";
import type { DerivedPlaybackState } from "@/features/gig-experience/viewer/engine/PlaybackController";
import { GigCanvas } from "@/features/gig-experience/viewer/GigCanvas";
import type { PerformancePreference } from "@/features/gig-experience/viewer/hooks/useGigViewerPreferences";
import type { GigPlayerModelsData } from "@/features/player-model/usePlayerModel";
import type { TotpBroadcastCue } from "./broadcastTimeline";
import { formatTotpChartGraphic } from "./broadcastTimeline";
import { resolveTotpPresenter, totpVariantLabel } from "./presenters";
import { totpAudienceCrowdTuning, totpAudienceReactionLabel } from "./studioAudience";

export interface TotpBroadcastCanvasProps {
  replay: GigViewerReplay; experience: GigExperienceDTO | null; playbackState: DerivedPlaybackState; cue?: TotpBroadcastCue | null;
  audienceReaction?: number | null; presenterKey?: string | null; showVariant?: string | null; reducedMotion?: boolean;
  performancePreference?: PerformancePreference; className?: string; playerModelsSnapshot?: GigPlayerModelsData | null;
}

export function TotpBroadcastCanvas({ replay, experience, playbackState, cue, audienceReaction = 0, presenterKey = "alex_rayne", showVariant = "regular", reducedMotion = false, performancePreference = "auto", className, playerModelsSnapshot = null }: TotpBroadcastCanvasProps) {
  const directedShot = reducedMotion ? "studio_master" : cue?.cameraShot ?? "studio_master";
  const directedStage = cue?.stage ?? "main_stage";
  const lowerThird = cue?.type === "graphic" ? cue.graphic : null;
  const presenterText = cue?.type === "presenter" ? cue.presenterText : null;
  const lockedAudienceReaction = Number.isFinite(Number(audienceReaction)) ? Number(audienceReaction) : 0;
  const crowdTuning = totpAudienceCrowdTuning(lockedAudienceReaction);
  const audienceLabel = totpAudienceReactionLabel(lockedAudienceReaction);
  const presenter = resolveTotpPresenter(presenterKey);
  const variantLabel = totpVariantLabel(showVariant);

  return <div className={className ?? "relative h-full min-h-[28rem] w-full overflow-hidden bg-slate-950"} data-totp-broadcast data-totp-cue={cue?.type ?? "performance"} data-totp-shot={directedShot} data-totp-stage={directedStage} data-totp-presenter={presenter.key} data-totp-show-variant={showVariant ?? "regular"} data-totp-audience-reaction={lockedAudienceReaction} data-totp-audience-label={audienceLabel.toLowerCase()} data-totp-visual-source={playerModelsSnapshot ? "archive" : "live"}>
    <GigCanvas replay={replay} experience={experience} playbackState={playbackState} reducedMotion={reducedMotion} pyrotechnics crowdTuning={crowdTuning} fill immersive cameraMode="auto" performancePreference={performancePreference} presentationMode="totp" totpCameraShot={directedShot} totpStage={directedStage} totpPresenterKey={presenter.key} totpShowVariant={showVariant} totpAudienceReaction={lockedAudienceReaction} playerModelsSnapshot={playerModelsSnapshot} capability={{ audience: "player", subjectId: `totp:${replay.id}` }} />
    <div className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
      <div className="absolute inset-0 opacity-[0.045] mix-blend-screen [background-image:repeating-linear-gradient(0deg,transparent_0,transparent_2px,rgba(255,255,255,.35)_3px)]" />
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 text-white">
        <div className="border-l-4 border-cyan-300 bg-fuchsia-700/90 px-3 py-2 text-xs font-black tracking-[0.18em] shadow-lg backdrop-blur">
          TOP OF THE POPS{variantLabel ? ` · ${variantLabel.toUpperCase()}` : ""}
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-black/70 px-2.5 py-1.5 text-[10px] font-black tracking-[0.16em] backdrop-blur">ROCKMUNDO TV</div>
          <div className="flex items-center gap-1.5 bg-red-700/90 px-2.5 py-1.5 text-[10px] font-black tracking-[0.16em] shadow-lg">
            <span className="h-1.5 w-1.5 rounded-full bg-white" /> LIVE
          </div>
        </div>
      </div>
      <div className="absolute bottom-3 right-3 bg-black/55 px-2 py-1 text-[9px] font-semibold tracking-wide text-white/65">
        {presenter.displayName.toUpperCase()} · AUDIENCE {audienceLabel.toUpperCase()}
      </div>
    </div>
    {lowerThird && <div className="pointer-events-none absolute bottom-10 left-5 z-20 max-w-[min(32rem,78vw)] text-white" role="status" aria-live="polite"><div className="border-l-4 border-cyan-300 bg-gradient-to-r from-fuchsia-800/95 to-slate-950/90 px-4 py-3 shadow-2xl"><div className="flex items-start justify-between gap-5"><div className="min-w-0"><p className="truncate text-lg font-black uppercase tracking-wide sm:text-xl">{lowerThird.artistName}</p><p className="mt-0.5 truncate text-xs font-semibold text-white/80 sm:text-sm">{lowerThird.songTitle}</p></div><p className="shrink-0 bg-white px-2 py-1 text-lg font-black text-slate-950 sm:text-xl">{formatTotpChartGraphic(lowerThird)}</p></div></div></div>}
    {presenterText && <div className="pointer-events-none absolute bottom-9 left-1/2 z-20 w-[min(43rem,88vw)] -translate-x-1/2" role="status" aria-live="polite"><div className="border-t-2 border-fuchsia-400 bg-black/82 px-5 py-3 text-center text-sm font-medium leading-relaxed text-white shadow-2xl backdrop-blur-md sm:text-base"><span className="mr-2 font-black uppercase tracking-wide text-cyan-200">{presenter.displayName}:</span>{presenterText}</div></div>}
  </div>;
}

export default TotpBroadcastCanvas;