import { useEffect, useRef } from "react";
import type { GigViewerReplay } from "../events/types";
import type { GigExperienceDTO } from "../types";
import type { DerivedPlaybackState } from "./engine/PlaybackController";
import { CanvasRenderer } from "./engine/CanvasRenderer";
import { useCanvasSize } from "./hooks/useCanvasSize";

export function GigCanvas({ replay, experience, playbackState, reducedMotion = false, pyrotechnics = true, pyroIntensity = 1, className }: { replay: GigViewerReplay; experience: GigExperienceDTO | null; playbackState: DerivedPlaybackState; reducedMotion?: boolean; pyrotechnics?: boolean; pyroIntensity?: number; className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const size = useCanvasSize(wrapRef);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new CanvasRenderer(canvas, replay, experience, reducedMotion, { pyrotechnics, pyroIntensity });
    rendererRef.current = renderer;
    renderer.resize(size);
    return () => { renderer.destroy(); rendererRef.current = null; };
  }, [replay.id, reducedMotion, pyrotechnics, pyroIntensity]);
  useEffect(() => { rendererRef.current?.resize(size); }, [size]);
  useEffect(() => { rendererRef.current?.render(playbackState); }, [playbackState, size]);
  return (
    <div ref={wrapRef} className={className ?? "w-full"}>
      <canvas ref={canvasRef} role="img" aria-label="Top-down replay canvas. Use the text timeline for a full accessible description." className="w-full rounded-xl border bg-slate-950" />
    </div>
  );
}
