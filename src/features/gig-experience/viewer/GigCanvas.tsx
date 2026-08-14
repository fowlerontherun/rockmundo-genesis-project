import { useEffect, useRef } from "react";
import type { GigViewerReplay } from "../events/types";
import type { GigExperienceDTO } from "../types";
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new CanvasRenderer(canvas, replay, experience, reducedMotion, {
      pyrotechnics,
      pyroIntensity,
      crowdTuning: resolved.tuning,
      cameraMode,
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
    <div className={className ?? (fill ? "h-full w-full" : "w-full")} data-crowd-tuning-source={resolved.source}>
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

function metricNumber(metric: any) {
  return metric?.status === "available" && typeof metric.value === "number" ? metric.value : 0;
}
