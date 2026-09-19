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
import { useTotpAudienceAudio } from "./useTotpAudienceAudio";
import { activeTotpCaption, type TotpCaptionCue } from "./broadcastCaptions";
import { totpSafeAreaStyle } from "./broadcastSafeArea";


export interface TotpBroadcastCanvasProps {
  replay: GigViewerReplay; experience: GigExperienceDTO | null; playbackState: DerivedPlaybackState; cue?: TotpBroadcastCue | null;
  audienceReaction?: number | null; presenterKey?: string | null; showVariant?: string | null; reducedMotion?: boolean;
  performancePreference?: PerformancePreference; className?: string; playerModelsSnapshot?: GigPlayerModelsData | null;
  captions?: TotpCaptionCue[]; showCaptions?: boolean; showSafeAreaGuides?: boolean;
}

export function TotpBroadcastCanvas({ replay, experience, playbackState, cue, audienceReaction = 0, presenterKey = "alex_rayne", showVariant = "regular", reducedMotion = false, performancePreference = "auto", className, playerModelsSnapshot = null, captions, showCaptions = false, showSafeAreaGuides = false }: TotpBroadcastCanvasProps) {
  const directedShot = reducedMotion ? "studio_master" : cue?.cameraShot ?? "studio_master";
  const directedStage = cue?.stage ?? "main_stage";
  const lowerThird = cue?.type === "graphic" ? cue.graphic : null;
  const presenterText = cue?.type === "presenter" ? cue.presenterText : null;
  const cueProgress = cue ? Math.max(0, Math.min(1, (playbackState.positionMs - cue.offsetMs) / Math.max(1, cue.durationMs))) : 0;
  const stageLabel = directedStage === "stage_b"
    ? "STAGE B"
    : directedStage === "rock_stage"
      ? "ROCK STAGE"
      : directedStage === "studio_floor"
        ? "STUDIO FLOOR"
        : "MAIN STAGE";
  const showStageSting = cue?.type === "performance" && cue.id === "performance-1" && cueProgress < .62;
  const lockedAudienceReaction = Number.isFinite(Number(audienceReaction)) ? Number(audienceReaction) : 0;
  const crowdTuning = totpAudienceCrowdTuning(lockedAudienceReaction);
  const audienceLabel = totpAudienceReactionLabel(lockedAudienceReaction);
  const presenter = resolveTotpPresenter(presenterKey);
  const variantLabel = totpVariantLabel(showVariant);
  const monitorPrimary = cue?.type === "graphic" && cue.graphic
    ? `#${cue.graphic.chartRank} · ${cue.graphic.artistName}`
    : cue?.type === "presenter"
      ? presenter.displayName
      : cue?.type === "audience"
        ? "STUDIO AUDIENCE"
        : stageLabel;
  const monitorSecondary = cue?.type === "graphic" && cue.graphic
    ? cue.graphic.songTitle
    : cue?.type === "presenter"
      ? "LIVE FROM LONDON"
      : cue?.type === "audience"
        ? "MAKE SOME NOISE"
        : "LIVE PERFORMANCE";
  useTotpAudienceAudio({ playbackState, cue, audienceReaction: lockedAudienceReaction });
  const activeCaption = showCaptions && captions?.length ? activeTotpCaption(captions, playbackState.positionMs) : null;

  return <div className={className ?? "relative h-full min-h-[28rem] w-full overflow-hidden bg-slate-950"} data-totp-broadcast data-totp-cue={cue?.type ?? "performance"} data-totp-shot={directedShot} data-totp-stage={directedStage} data-totp-presenter={presenter.key} data-totp-show-variant={showVariant ?? "regular"} data-totp-audience-reaction={lockedAudienceReaction} data-totp-audience-label={audienceLabel.toLowerCase()} data-totp-visual-source={playerModelsSnapshot ? "archive" : "live"}>
    <GigCanvas replay={replay} experience={experience} playbackState={playbackState} reducedMotion={reducedMotion} pyrotechnics crowdTuning={crowdTuning} fill immersive cameraMode="auto" performancePreference={performancePreference} presentationMode="totp" totpCameraShot={directedShot} totpStage={directedStage} totpPresenterKey={presenter.key} totpShowVariant={showVariant} totpAudienceReaction={lockedAudienceReaction} totpCueType={cue?.type ?? "performance"} totpMonitorPrimary={monitorPrimary} totpMonitorSecondary={monitorSecondary} playerModelsSnapshot={playerModelsSnapshot} capability={{ audience: "player", subjectId: `totp:${replay.id}` }} />
    <div key={cue?.id ?? "default"} className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
      <div className="absolute inset-0 animate-in fade-in duration-150 bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,.10),transparent_42%)]" />
      {cue?.type === "audience" ? <div className="absolute inset-0 animate-in fade-in duration-300 bg-[radial-gradient(circle_at_50%_65%,rgba(244,114,182,.16),transparent_48%)]" /> : null}
      {cue?.type === "performance" && cue.id === "performance-1" ? <div className="absolute inset-x-0 top-0 h-1 animate-pulse bg-gradient-to-r from-cyan-300 via-white to-fuchsia-400" /> : null}
      <div className="absolute inset-0 opacity-[0.045] mix-blend-screen [background-image:repeating-linear-gradient(0deg,transparent_0,transparent_2px,rgba(255,255,255,.35)_3px)]" />
      {showSafeAreaGuides ? (
        <>
          <div className="absolute border border-dashed border-cyan-300/40" style={totpSafeAreaStyle("action")} data-totp-safe-area="action" />
          <div className="absolute border border-dashed border-fuchsia-300/40" style={totpSafeAreaStyle("title")} data-totp-safe-area="title" />
        </>
      ) : null}
      <div className="absolute flex items-start justify-between gap-3 text-white" style={{ ...totpSafeAreaStyle("title"), bottom: "auto" }} data-totp-branding>
        <div className="border-l-4 border-cyan-300 bg-fuchsia-700/90 px-3 py-2 text-xs font-black tracking-[0.18em] shadow-lg backdrop-blur">
          TOP OF THE POPS{variantLabel ? ` · ${variantLabel.toUpperCase()}` : ""}
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden bg-black/65 px-2.5 py-1.5 text-[10px] font-black tracking-[0.16em] backdrop-blur sm:block">ROCKMUNDO TV · LONDON</div>
          <div className="flex items-center gap-1.5 bg-red-700/90 px-2.5 py-1.5 text-[10px] font-black tracking-[0.16em] shadow-lg">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> LIVE
          </div>
        </div>
      </div>
      {showStageSting ? (
        <div className="absolute right-4 top-16 animate-in fade-in slide-in-from-right-3 duration-300">
          <div className="border-r-4 border-fuchsia-300 bg-black/75 px-3 py-2 text-right shadow-lg backdrop-blur">
            <div className="text-[9px] font-bold tracking-[0.18em] text-cyan-200">LIVE FROM</div>
            <div className="mt-0.5 text-xs font-black tracking-[0.16em] text-white">{stageLabel}</div>
          </div>
        </div>
      ) : null}
    </div>
    {lowerThird && (
      <div
        key={`lower-third:${cue?.id ?? "graphic"}`}
        className="pointer-events-none absolute bottom-8 left-4 z-20 w-[min(36rem,86vw)] animate-in fade-in slide-in-from-left-8 duration-300 text-white"
        role="status"
        aria-live="polite"
      >
        <div className="relative overflow-hidden border-l-4 border-cyan-300 bg-gradient-to-r from-fuchsia-800/95 via-slate-950/94 to-slate-950/80 shadow-2xl backdrop-blur-sm">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-cyan-300 via-white/70 to-fuchsia-300/0" />
          <div className="grid grid-cols-[auto_1fr_auto] items-stretch">
            <div className="flex min-w-16 flex-col items-center justify-center bg-white px-3 py-2 text-slate-950">
              <span className="text-[9px] font-black tracking-[0.14em]">UK</span>
              <span className="text-2xl font-black leading-none">#{lowerThird.chartRank}</span>
            </div>
            <div className="min-w-0 px-4 py-2.5">
              <p className="truncate text-base font-black uppercase tracking-[0.06em] sm:text-lg">{lowerThird.artistName}</p>
              <p className="mt-0.5 truncate text-xs font-semibold text-white/78 sm:text-sm">{lowerThird.songTitle}</p>
            </div>
            <div className="flex items-center px-3 text-xs font-black tracking-[0.12em] text-cyan-200">
              {formatTotpChartGraphic(lowerThird).replace(`#${lowerThird.chartRank} `, "")}
            </div>
          </div>
        </div>
      </div>
    )}
    {presenterText && <div className="pointer-events-none absolute bottom-8 left-1/2 z-20 w-[min(43rem,88vw)] -translate-x-1/2 animate-in fade-in slide-in-from-bottom-3 duration-300" role="status" aria-live="polite"><div className="border-t-2 border-fuchsia-400 bg-black/82 px-5 py-3 text-center text-sm font-medium leading-relaxed text-white shadow-2xl backdrop-blur-md sm:text-base"><span className="mr-2 font-black uppercase tracking-wide text-cyan-200">{presenter.displayName}:</span>{presenterText}</div></div>}
  </div>;
}

export default TotpBroadcastCanvas;