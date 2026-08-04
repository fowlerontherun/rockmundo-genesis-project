import { useEffect, useRef } from "react";
import type { GigViewerReplay } from "../events/types";
import type { GigExperienceDTO } from "../types";
import { CrowdTuningPanel, useDemoCrowdTuning } from "./CrowdTuningPanel";
import type { DerivedPlaybackState } from "./engine/PlaybackController";
import { CanvasRenderer } from "./engine/CanvasRenderer";
import type { CrowdTuningOptions } from "./engine/CrowdTuning";
import { crowdTuningSignature } from "./engine/CrowdTuning";
import { useCanvasSize } from "./hooks/useCanvasSize";

export function GigCanvas({
  replay,
  experience,
  playbackState,
  reducedMotion = false,
  pyrotechnics = true,
  pyroIntensity = 1,
  crowdTuning,
  fill = false,
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
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const size = useCanvasSize(wrapRef, { fill });
  const demoTuning = useDemoCrowdTuning();
  const resolvedCrowdTuning = crowdTuning ?? (demoTuning.demoMode ? demoTuning.value : null);
  const tuningKey = crowdTuningSignature(resolvedCrowdTuning);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new CanvasRenderer(canvas, replay, experience, reducedMotion, {
      pyrotechnics,
      pyroIntensity,
      crowdTuning: resolvedCrowdTuning,
    });
    rendererRef.current = renderer;
    renderer.resize(size);
    return () => { renderer.destroy(); rendererRef.current = null; };
  }, [replay.id, reducedMotion, pyrotechnics, pyroIntensity, tuningKey]);

  useEffect(() => { rendererRef.current?.resize(size); }, [size]);
  useEffect(() => { rendererRef.current?.render(playbackState); }, [playbackState, size]);

  const attendance = metricNumber(experience?.headline?.attendance);
  const capacity = experience?.gig?.venue?.capacity ?? 0;

  return (
    <div className={className ?? (fill ? "h-full w-full" : "w-full")}>
      {demoTuning.demoMode && !fill ? (
        <CrowdTuningPanel
          value={demoTuning.value}
          onChange={demoTuning.setValue}
          attendance={attendance}
          capacity={capacity}
        />
      ) : null}
      <div ref={wrapRef} className={fill ? "h-full w-full" : "w-full"}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Top-down replay canvas. Use the text timeline for a full accessible description."
          className="w-full rounded-xl border bg-slate-950"
        />
      </div>
    </div>
  );
}

function metricNumber(metric: any) {
  return metric?.status === "available" && typeof metric.value === "number" ? metric.value : 0;
}
