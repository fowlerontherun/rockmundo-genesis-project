import { useEffect, useMemo, useState } from "react";
import { Camera, RadioTower, Sparkles, Users, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { TotpBroadcastReplay } from "./api";
import { formatTotpCountdown, totpCountdownRemainingMs, totpEasedProgress, totpTransitionDipOpacity } from "./broadcastCountdown";

const DURATION_MS = 3_200;

type TransitionStyle = "camera_sweep" | "neon_wipe" | "audience_cutaway" | "spotlight_reset";

function stableIndex(value: string, length: number): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % length;
}

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
  const styles: TransitionStyle[] = ["camera_sweep", "neon_wipe", "audience_cutaway", "spotlight_reset"];
  const transitionStyle = styles[stableIndex(`${from.id}:${to.id}:${fromStage}:${toStage}`, styles.length)];
  const eased = totpEasedProgress(DURATION_MS, elapsedMs);
  const progress = eased * 100;
  const remainingMs = totpCountdownRemainingMs(DURATION_MS, elapsedMs);
  const dipOpacity = autoPlay ? totpTransitionDipOpacity(DURATION_MS, elapsedMs) : 0;
  const copy = useMemo(() => {
    const next = to.payload.band.name;
    if (transitionStyle === "audience_cutaway") {
      return {
        eyebrow: "Studio audience",
        headline: "Make some noise",
        body: `A quick audience cutaway while ${next} take their marks on ${stageLabel(toStage)}.`,
      };
    }
    if (transitionStyle === "spotlight_reset") {
      return {
        eyebrow: "Lighting reset",
        headline: sameStage ? `${stageLabel(toStage)} changes look` : `${stageLabel(toStage)} lights up`,
        body: `The previous look drops to black while the lighting crew reveal ${next}.`,
      };
    }
    if (transitionStyle === "neon_wipe") {
      return {
        eyebrow: "Top of the Pops",
        headline: sameStage ? "Next act incoming" : `${stageLabel(fromStage)} → ${stageLabel(toStage)}`,
        body: `A fast graphic wipe takes us into ${next}.`,
      };
    }
    return sameStage
      ? {
          eyebrow: "Studio reset",
          headline: `${stageLabel(toStage)} stays live`,
          body: `Floor crew clear ${from.payload.band.name} while cameras reset for ${next}.`,
        }
      : {
          eyebrow: "Across the studio",
          headline: `${stageLabel(fromStage)} → ${stageLabel(toStage)}`,
          body: `The main camera sweeps across the studio as ${next} are brought onto ${stageLabel(toStage)}.`,
        };
  }, [from.payload.band.name, fromStage, sameStage, to.payload.band.name, toStage, transitionStyle]);

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

  const icon = transitionStyle === "audience_cutaway"
    ? <Users className="mr-1.5 h-3.5 w-3.5" />
    : transitionStyle === "spotlight_reset"
      ? <Zap className="mr-1.5 h-3.5 w-3.5" />
      : transitionStyle === "neon_wipe"
        ? <Sparkles className="mr-1.5 h-3.5 w-3.5" />
        : <RadioTower className="mr-1.5 h-3.5 w-3.5" />;

  return (
    <div className="relative min-h-[24rem] overflow-hidden rounded-xl border bg-slate-950 text-white" data-totp-stage-transition data-transition-style={transitionStyle}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(34,211,238,.18),transparent_35%),radial-gradient(circle_at_80%_50%,rgba(244,114,182,.18),transparent_35%)]" />
      {transitionStyle === "camera_sweep" ? (
        <>
          <div className="absolute inset-y-0 left-[-20%] w-[45%] -skew-x-12 bg-gradient-to-r from-transparent via-cyan-200/15 to-white/25" style={{ transform: `translateX(${progress * 2.8}%) skewX(-12deg)` }} />
          <Camera className="absolute bottom-[24%] left-[12%] h-12 w-12 text-cyan-200/45" />
        </>
      ) : null}
      {transitionStyle === "neon_wipe" ? (
        <>
          <div className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-fuchsia-500/10 via-white/35 to-cyan-400/10 blur-xl" style={{ left: `${-35 + progress * 1.35}%` }} />
          <div className="absolute inset-x-[12%] top-[30%] h-px bg-gradient-to-r from-transparent via-white/65 to-transparent" />
        </>
      ) : null}
      {transitionStyle === "audience_cutaway" ? (
        <div className="absolute inset-x-[8%] bottom-[14%] flex justify-around opacity-45">
          {Array.from({ length: 14 }).map((_, index) => (
            <div key={index} className="h-12 w-6 rounded-t-full bg-white/25" style={{ transform: `translateY(${Math.sin(index + elapsedMs / 250) * 7}px)` }} />
          ))}
        </div>
      ) : null}
      {transitionStyle === "spotlight_reset" ? (
        <>
          <div className="absolute left-[18%] top-[-20%] h-[80%] w-[22%] rotate-[18deg] bg-gradient-to-b from-amber-200/30 to-transparent blur-md" />
          <div className="absolute right-[18%] top-[-20%] h-[80%] w-[22%] rotate-[-18deg] bg-gradient-to-b from-cyan-200/25 to-transparent blur-md" />
        </>
      ) : null}

      <div className="relative z-10 flex min-h-[24rem] flex-col items-center justify-center px-6 text-center">
        <Badge className="mb-4 bg-white/10 text-white hover:bg-white/10">
          {icon} {copy.eyebrow}
        </Badge>
        <div className="text-3xl font-black tracking-tight sm:text-5xl">TOP OF THE POPS</div>
        <div className="mt-3 text-xl font-semibold sm:text-2xl">{copy.headline}</div>
        <p className="mt-2 max-w-2xl text-sm text-white/65">{copy.body}</p>

        <div className="mt-6 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/55">
          <Camera className="h-4 w-4" />
          {sameStage ? "Resetting cameras and floor marks" : "Changing stages"}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 border-t border-white/10 bg-black/45 px-4 py-3">
        <div className="mb-2 flex items-center justify-between text-xs text-white/55">
          <span>{transitionStyle.replaceAll("_", " ")}</span>
          <span>{autoPlay ? formatTotpCountdown(remainingMs) : "ready"}</span>
        </div>
        <Progress value={autoPlay ? progress : 100} className="h-1.5 bg-white/10" />
      </div>

      <div className="pointer-events-none absolute inset-0 bg-black transition-opacity duration-100" style={{ opacity: dipOpacity }} />
    </div>
  );
}

export default TotpStageTransition;
