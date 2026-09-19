import { useEffect, useMemo, useState } from "react";
import { Camera, RadioTower, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { TotpBroadcastReplay } from "./api";
import { formatTotpCountdown, totpCountdownRemainingMs, totpEasedProgress, totpTransitionDipOpacity } from "./broadcastCountdown";

const DURATION_MS = 2_800;

function stageLabel(stage: TotpBroadcastReplay["payload"]["stage"]): string {
  switch (stage) {
    case "stage_b": return "Stage B";
    case "rock_stage": return "Rock Stage";
    case "studio_floor": return "Studio Floor";
    default: return "Main Stage";
  }
}

export function TotpStageTransition({
  from,
  to,
  autoPlay = false,
  onEnded,
}: {
  from: TotpBroadcastReplay;
  to: TotpBroadcastReplay;
  autoPlay?: boolean;
  onEnded?: () => void;
}) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const fromStage = from.payload.stage;
  const toStage = to.payload.stage;
  const sameStage = fromStage === toStage;
  const eased = totpEasedProgress(DURATION_MS, elapsedMs);
  const progress = eased * 100;
  const remainingMs = totpCountdownRemainingMs(DURATION_MS, elapsedMs);
  const dipOpacity = autoPlay ? totpTransitionDipOpacity(DURATION_MS, elapsedMs) : 0;
  const copy = useMemo(() => {
    if (sameStage) {
      return {
        eyebrow: "Studio reset",
        headline: `${stageLabel(toStage)} stays live`,
        body: `Floor crew clear ${from.payload.band.name} while cameras reset for ${to.payload.band.name}.`,
      };
    }
    return {
      eyebrow: "Across the studio",
      headline: `${stageLabel(fromStage)} → ${stageLabel(toStage)}`,
      body: `Cameras swing across the floor while ${to.payload.band.name} are brought onto ${stageLabel(toStage)}.`,
    };
  }, [from.payload.band.name, fromStage, sameStage, to.payload.band.name, toStage]);

  useEffect(() => {
    setElapsedMs(0);
    if (!autoPlay || typeof window === "undefined") return;
    let frame = 0;
    let previous = performance.now();
    let ended = false;
    const tick = (now: number) => {
      if (ended) return;
      const delta = now - previous;
      previous = now;
      setElapsedMs((current) => {
        const next = Math.min(DURATION_MS, current + delta);
        if (next >= DURATION_MS) {
          ended = true;
          queueMicrotask(() => onEnded?.());
        }
        return next;
      });
      if (!ended) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [autoPlay, from.id, onEnded, to.id]);

  return (
    <div className="relative min-h-[24rem] overflow-hidden rounded-xl border bg-slate-950 text-white" data-totp-stage-transition>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(34,211,238,.18),transparent_35%),radial-gradient(circle_at_80%_50%,rgba(244,114,182,.18),transparent_35%)]" />
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/15" />
      <div className="absolute left-[12%] top-[18%] h-40 w-28 rotate-[-8deg] border border-cyan-300/35 bg-cyan-300/10 shadow-[0_0_35px_rgba(34,211,238,.16)]" />
      <div className="absolute right-[12%] top-[18%] h-40 w-28 rotate-[8deg] border border-fuchsia-300/35 bg-fuchsia-300/10 shadow-[0_0_35px_rgba(244,114,182,.16)]" />
      <div className="absolute inset-x-[18%] bottom-[22%] h-px bg-gradient-to-r from-cyan-300/0 via-white/45 to-fuchsia-300/0" />

      <div className="relative z-10 flex min-h-[24rem] flex-col items-center justify-center px-6 text-center">
        <Badge className="mb-4 bg-white/10 text-white hover:bg-white/10">
          <RadioTower className="mr-1.5 h-3.5 w-3.5" /> {copy.eyebrow}
        </Badge>
        <div className="text-3xl font-black tracking-tight sm:text-5xl">TOP OF THE POPS</div>
        <div className="mt-3 text-xl font-semibold sm:text-2xl">{copy.headline}</div>
        <p className="mt-3 max-w-2xl text-sm text-white/70 sm:text-base">{copy.body}</p>

        <div className="mt-7 flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-white/60">
          <Camera className="h-4 w-4" />
          {sameStage ? "Resetting cameras and lights" : "Repositioning cameras and floor crew"}
          <Sparkles className="h-4 w-4" />
        </div>

        <div className="mt-6 w-full max-w-xl">
          <Progress value={progress} className="h-1.5 bg-white/10" />
        </div>
      </div>
    </div>
  );
}

export default TotpStageTransition;
