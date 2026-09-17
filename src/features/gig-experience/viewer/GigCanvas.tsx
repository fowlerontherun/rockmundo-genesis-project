import { lazy, Suspense, useRef } from "react";
const GigStage3D = lazy(() => import("./three/GigStage3D"));
import type { GigViewerReplay } from "../events/types";
import type { GigExperienceDTO } from "../types";
import type { ReportMetric } from "../types";
import type { TotpCameraShot, TotpStageKey } from "@/features/top-of-the-pops/broadcastProfile";
import { CrowdTuningPanel, useDemoCrowdTuning } from "./CrowdTuningPanel";
import { GlobalCrowdDefaultsControls } from "./GlobalCrowdDefaultsControls";
import type { DerivedPlaybackState } from "./engine/PlaybackController";
import { normalizeCrowdTuning } from "./engine/CrowdTuning";
import type { CrowdTuningOptions } from "./engine/CrowdTuning";
import { resolveCrowdTuning } from "./engine/CrowdTuningResolution";
import { useCanvasSize } from "./hooks/useCanvasSize";
import { useGlobalCrowdTuning } from "./hooks/useGlobalCrowdTuning";
import type { GigViewerCameraMode } from "./engine/CameraDirector";
import { buildViewerDiagnostics } from "./engine/ViewerDiagnostics";
import { resolveRenderBudget } from "./engine/PerformanceProfile";
import type { PerformancePreference } from "./hooks/useGigViewerPreferences";
import { resolveViewerCapabilities, type ViewerCapabilityContext } from "./config/viewerCapabilityFlags";
import type { ConcertPresentationMode } from "./three/presentation";

export function GigCanvas({
  replay,
  experience,
  playbackState,
  reducedMotion = false,
  pyrotechnics = true,
  pyroIntensity = 1,
  crowdTuning,
  fill = false,
  immersive = false,
  cameraMode = "venue_wide",
  performancePreference = "auto",
  capability,
  className,
  presentationMode = "gig",
  totpCameraShot,
  totpStage = "main_stage",
  totpPresenterKey = "alex_rayne",
  totpShowVariant = "regular",
}: {
  replay: GigViewerReplay;
  experience: GigExperienceDTO | null;
  playbackState: DerivedPlaybackState;
  reducedMotion?: boolean;
  pyrotechnics?: boolean;
  pyroIntensity?: number;
  crowdTuning?: Partial<CrowdTuningOptions> | null;
  fill?: boolean;
  immersive?: boolean;
  cameraMode?: GigViewerCameraMode;
  performancePreference?: PerformancePreference;
  /** Staged-rollout context; defaults to a player audience bucketed on the gig id. */
  capability?: Partial<ViewerCapabilityContext>;
  className?: string;
  /** Reuses the same 3D gig renderer with a television-studio presentation profile. */
  presentationMode?: ConcertPresentationMode;
  /** Directed TOTP shot. Normal gigs continue to use cameraMode unchanged. */
  totpCameraShot?: TotpCameraShot | null;
  /** Physical TOTP performance zone selected by the locked running order. */
  totpStage?: TotpStageKey;
  /** Locked episode presenter; ignored by normal gig scenes. */
  totpPresenterKey?: string | null;
  /** Locked episode visual/script variant; ignored by normal gig scenes. */
  totpShowVariant?: string | null;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const { container, fit } = useCanvasSize(wrapRef, { fill });
  const demoTuning = useDemoCrowdTuning();
  const replayTuning = replay.crowdTuning ?? null;
  const shouldLoadGlobal = !crowdTuning && !demoTuning.demoMode && !replayTuning;
  const globalTuning = useGlobalCrowdTuning(shouldLoadGlobal);
  const resolved = resolveCrowdTuning({
    explicit: crowdTuning,
    demoMode: demoTuning.demoMode,
    demo: demoTuning.value,
    replay: replayTuning,
    global: globalTuning.data?.settings,
  });
  const capabilities = resolveViewerCapabilities({
    audience: capability?.audience ?? "player",
    subjectId: capability?.subjectId ?? replay.gigId ?? replay.id,
    stage: capability?.stage ?? null,
    percentage: capability?.percentage ?? null,
    legacyFallbackAvailable: capability?.legacyFallbackAvailable ?? null,
  });
  const diagnostics = buildViewerDiagnostics({ replay, experience, cameraMode, reducedMotion, performancePreference: performancePreference === "auto" ? null : performancePreference });
  const renderBudget = resolveRenderBudget({
    tier: diagnostics.performanceTier,
    displayedCrowd: diagnostics.representativeCrowdCount,
    reducedMotion,
    archetype: presentationMode === "totp" ? "tv_studio" : diagnostics.venueArchetype,
    devicePixelRatio: typeof window === "undefined" ? 1 : window.devicePixelRatio,
  });

  const attendance = metricNumber(experience?.headline?.attendance);
  const capacity = experience?.gig?.venue?.capacity ?? 0;

  return (
    <div className={className ?? (fill ? "h-full w-full" : "w-full")} data-crowd-tuning-source={resolved.source}
      data-viewer-camera={presentationMode === "totp" ? totpCameraShot ?? "studio_master" : diagnostics.cameraMode} data-venue-archetype={presentationMode === "totp" ? "tv_studio" : diagnostics.venueArchetype}
      data-venue-variation={diagnostics.venueVariation} data-environment-kind={diagnostics.environmentKind}
      data-venue-descriptor-version={diagnostics.descriptorVersion} data-venue-structural-fingerprint={diagnostics.structuralFingerprint}
      data-seed-fingerprint={diagnostics.seedFingerprint} data-representative-crowd-count={diagnostics.representativeCrowdCount}
      data-attendance-state={diagnostics.attendanceState} data-attendance-source={diagnostics.attendanceSource}
      data-activity-evidence-mode={diagnostics.activityEvidenceMode} data-performance-tier={diagnostics.performanceTier}
      data-render-dpr-cap={diagnostics.performanceTier === "high" ? 1.75 : diagnostics.performanceTier === "low" ? .9 : 1.15} data-crowd-detail={renderBudget.crowdDetail}
      data-degradations={renderBudget.appliedDegradations.join(",")}
      data-living-venue="3d"
      data-presentation-mode={presentationMode}
      data-totp-stage={presentationMode === "totp" ? totpStage : undefined}
      data-totp-presenter={presentationMode === "totp" ? totpPresenterKey ?? "alex_rayne" : undefined}
      data-totp-show-variant={presentationMode === "totp" ? totpShowVariant ?? "regular" : undefined}
      data-viewer-rollout-stage={capabilities.stage} data-viewer-rollout-reason={capabilities.reason}
      data-viewer-rollout-bucket={capabilities.bucket}
      data-legacy-fallback-available={capabilities.legacyFallbackAvailable ? "true" : "false"}>
      {demoTuning.demoMode && !fill ? (
        <>
          <GlobalCrowdDefaultsControls value={demoTuning.value} onLoad={demoTuning.setValue} />
          <CrowdTuningPanel
            value={demoTuning.value}
            onChange={demoTuning.setValue}
            attendance={attendance}
            capacity={capacity}
          />
        </>
      ) : null}
      <div
        ref={wrapRef}
        className={`${fill ? "h-full" : ""} relative flex w-full items-center justify-center overflow-hidden bg-slate-950`}
        style={{ minHeight: fill ? 0 : container.height, height: fill ? undefined : container.height }}
        data-scene-viewport
        data-scene-scale={fit.scale.toFixed(4)}
      >
        <Suspense fallback={<div role="status" className="p-8 text-slate-200">Loading 3D stage…</div>}>
          <GigStage3D replay={replay} experience={experience} playbackState={playbackState}
            reducedMotion={reducedMotion} cameraMode={cameraMode} tier={diagnostics.performanceTier}
            archetype={presentationMode === "totp" ? "tv_studio" : diagnostics.venueArchetype} tuning={normalizeCrowdTuning(resolved.tuning)}
            pyrotechnics={pyrotechnics} pyroIntensity={pyroIntensity}
            presentationMode={presentationMode} totpCameraShot={totpCameraShot} totpStage={totpStage}
            totpPresenterKey={totpPresenterKey} totpShowVariant={totpShowVariant} />
        </Suspense>
      </div>
    </div>
  );
}

function metricNumber(metric: ReportMetric<number> | undefined) {
  return metric?.status === "available" && typeof metric.value === "number" ? metric.value : 0;
}
