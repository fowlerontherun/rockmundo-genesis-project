import { useEffect, useRef } from "react";
import type { GigViewerReplay } from "../events/types";
import type { GigExperienceDTO } from "../types";
import type { ReportMetric } from "../types";
import { CrowdTuningPanel, useDemoCrowdTuning } from "./CrowdTuningPanel";
import { GlobalCrowdDefaultsControls } from "./GlobalCrowdDefaultsControls";
import type { DerivedPlaybackState } from "./engine/PlaybackController";
import { CanvasRenderer } from "./engine/CanvasRenderer";
import type { CrowdTuningOptions } from "./engine/CrowdTuning";
import { crowdTuningSignature } from "./engine/CrowdTuning";
import { resolveCrowdTuning } from "./engine/CrowdTuningResolution";
import { useCanvasSize } from "./hooks/useCanvasSize";
import { useGlobalCrowdTuning } from "./hooks/useGlobalCrowdTuning";
import type { GigViewerCameraMode } from "./engine/CameraDirector";
import { buildViewerDiagnostics } from "./engine/ViewerDiagnostics";
import { resolveRenderBudget } from "./engine/PerformanceProfile";

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
  className,
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
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const { container, fit, logical } = useCanvasSize(wrapRef, { fill });
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
  const tuningKey = crowdTuningSignature(resolved.tuning);
  const diagnostics = buildViewerDiagnostics({ replay, experience, cameraMode, reducedMotion });
  const renderBudget = resolveRenderBudget({
    tier: diagnostics.performanceTier,
    displayedCrowd: diagnostics.representativeCrowdCount,
    reducedMotion,
    archetype: diagnostics.venueArchetype,
    devicePixelRatio: typeof window === "undefined" ? 1 : window.devicePixelRatio,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new CanvasRenderer(canvas, replay, experience, reducedMotion, {
      pyrotechnics,
      pyroIntensity,
      crowdTuning: resolved.tuning,
      cameraMode,
      performanceTier: diagnostics.performanceTier,
    });
    rendererRef.current = renderer;
    renderer.resize(logical);
    return () => { renderer.destroy(); rendererRef.current = null; };
  }, [replay.id, reducedMotion, pyrotechnics, pyroIntensity, tuningKey, cameraMode]);

  // Preference changes recreate the renderer; include them here so a paused
  // replay paints its new camera/effects immediately rather than waiting for a tick.
  useEffect(() => { rendererRef.current?.render(playbackState); }, [playbackState, cameraMode, reducedMotion, pyrotechnics, pyroIntensity, tuningKey]);

  const attendance = metricNumber(experience?.headline?.attendance);
  const capacity = experience?.gig?.venue?.capacity ?? 0;

  return (
    <div className={className ?? (fill ? "h-full w-full" : "w-full")} data-crowd-tuning-source={resolved.source}
      data-viewer-camera={diagnostics.cameraMode} data-venue-archetype={diagnostics.venueArchetype}
      data-venue-variation={diagnostics.venueVariation} data-environment-kind={diagnostics.environmentKind}
      data-venue-descriptor-version={diagnostics.descriptorVersion} data-venue-structural-fingerprint={diagnostics.structuralFingerprint}
      data-seed-fingerprint={diagnostics.seedFingerprint} data-representative-crowd-count={diagnostics.representativeCrowdCount}
      data-attendance-state={diagnostics.attendanceState} data-attendance-source={diagnostics.attendanceSource}
      data-activity-evidence-mode={diagnostics.activityEvidenceMode} data-performance-tier={diagnostics.performanceTier}
      data-render-dpr-cap={renderBudget.dprCap} data-crowd-detail={renderBudget.crowdDetail}
      data-degradations={renderBudget.appliedDegradations.join(",")}>
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
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={immersive ? "Song performance stage showing the band and crowd." : "Top-down replay canvas. Use the text timeline for a full accessible description."}
          className={immersive ? "block bg-slate-950" : "block rounded-xl border bg-slate-950"}
          style={{ width: fit.width, height: fit.height, maxWidth: "100%", maxHeight: "100%" }}
          data-logical-width={logical.width}
          data-logical-height={logical.height}
        />
      </div>
    </div>
  );
}

function metricNumber(metric: ReportMetric<number> | undefined) {
  return metric?.status === "available" && typeof metric.value === "number" ? metric.value : 0;
}
