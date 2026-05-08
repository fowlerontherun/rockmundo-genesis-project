import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Music, Sparkles, Star, Wrench, Zap, Play, Pause, RotateCw, Repeat, Hammer } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RevealResult } from "@/pages/BlindBoxStore";

const TIER_COLORS: Record<string, string> = {
  common: "bg-slate-500/20 text-slate-200 border-slate-500/40",
  rare: "bg-blue-500/20 text-blue-200 border-blue-500/40 shadow-[0_0_30px_rgba(59,130,246,0.4)]",
  epic: "bg-purple-500/20 text-purple-200 border-purple-500/40 shadow-[0_0_40px_rgba(168,85,247,0.5)]",
  legendary:
    "bg-gradient-to-br from-amber-500/30 via-yellow-400/20 to-amber-600/30 text-amber-100 border-amber-400/60 shadow-[0_0_60px_rgba(251,191,36,0.6)]",
};

const TIER_ORDER = ["common", "rare", "epic", "legendary"] as const;

interface Props {
  reveal: RevealResult | null;
  onClose: () => void;
}

type Phase = "rolling" | "tier" | "stats" | "instrument" | "song" | "done";

function useCountUp(target: number, active: boolean, durationMs = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) {
      setValue(0);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, active, durationMs]);
  return value;
}

export function BlindBoxRevealDialog({ reveal, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>("rolling");
  const [rollingTier, setRollingTier] = useState<string>("common");
  const [flipped, setFlipped] = useState(false);
  const [songPlaying, setSongPlaying] = useState(false);

  // Reset and run sequence whenever a new reveal arrives
  useEffect(() => {
    if (!reveal) return;
    setPhase("rolling");
    setFlipped(false);
    setSongPlaying(false);

    // Cycle through tier badges, then settle on actual tier
    let i = 0;
    const cycle = setInterval(() => {
      setRollingTier(TIER_ORDER[i % TIER_ORDER.length]);
      i += 1;
    }, 110);

    const t1 = setTimeout(() => {
      clearInterval(cycle);
      setRollingTier(reveal.tier);
      setPhase("tier");
    }, 1400);
    const t2 = setTimeout(() => setPhase("stats"), 2100);
    const t3 = setTimeout(() => setPhase("instrument"), 3000);
    const t4 = setTimeout(() => setFlipped(true), 3300);
    const t5 = setTimeout(() => setPhase("song"), 4100);
    const t6 = setTimeout(() => setPhase("done"), 4900);

    return () => {
      clearInterval(cycle);
      [t1, t2, t3, t4, t5, t6].forEach(clearTimeout);
    };
  }, [reveal]);

  const xpVal = useCountUp(reveal?.xp ?? 0, phase !== "rolling" && !!reveal);
  const apVal = useCountUp(reveal?.ap ?? 0, phase !== "rolling" && !!reveal, 700);

  if (!reveal) return null;

  const settledTier = phase === "rolling" ? rollingTier : reveal.tier;
  const tierClass = TIER_COLORS[settledTier] ?? TIER_COLORS.common;
  const isLegendary = reveal.tier === "legendary";

  const skipToEnd = () => {
    setPhase("done");
    setFlipped(true);
  };

  return (
    <Dialog open={!!reveal} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md overflow-hidden">
        {/* Legendary aurora background */}
        {isLegendary && phase !== "rolling" && (
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-purple-500/10 animate-pulse" />
            <div className="absolute -top-10 -left-10 h-40 w-40 rounded-full bg-amber-400/30 blur-3xl animate-pulse" />
            <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-purple-400/30 blur-3xl animate-pulse" />
          </div>
        )}

        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles
              className={cn(
                "h-5 w-5 text-primary transition-transform",
                phase === "rolling" && "animate-spin",
              )}
            />
            {phase === "rolling" ? "Rolling…" : "Box opened!"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Tier roll */}
          <div
            className={cn(
              "rounded-lg border p-3 text-center transition-all duration-500",
              tierClass,
              phase === "tier" && "scale-110",
              phase === "rolling" && "animate-pulse",
            )}
          >
            <p className="text-xs uppercase tracking-wider opacity-80">Tier</p>
            <p
              className={cn(
                "text-2xl font-bold capitalize transition-all",
                phase === "rolling" && "blur-[1px]",
              )}
            >
              {settledTier}
            </p>
          </div>

          {/* XP / AP counters */}
          <div
            className={cn(
              "grid grid-cols-2 gap-2 transition-all duration-500",
              phase === "rolling" ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0",
            )}
          >
            <Stat
              icon={Zap}
              label="XP"
              value={`+${xpVal.toLocaleString()}`}
              hint={reveal.skill_slug}
              progress={reveal.xp > 0 ? (xpVal / reveal.xp) * 100 : 0}
            />
            <Stat
              icon={Star}
              label="AP"
              value={`+${apVal}`}
              progress={reveal.ap > 0 ? (apVal / reveal.ap) * 100 : 0}
            />
          </div>

          <Separator />

          {/* Instrument flip card */}
          <div
            className={cn(
              "transition-all duration-500",
              ["rolling", "tier", "stats"].includes(phase)
                ? "opacity-0 translate-y-3"
                : "opacity-100 translate-y-0",
            )}
            style={{ perspective: "1000px" }}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Wrench className="h-3 w-3" /> Instrument
              </div>
              {phase === "done" && (
                <button
                  type="button"
                  onClick={() => setFlipped((f) => !f)}
                  className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <RotateCw className="h-3 w-3" /> flip
                </button>
              )}
            </div>
            <div
              className="relative h-24 transition-transform duration-700"
              style={{
                transformStyle: "preserve-3d",
                transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
              }}
            >
              {/* Back */}
              <div
                className="absolute inset-0 rounded-lg border bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center"
                style={{ backfaceVisibility: "hidden" }}
              >
                <Sparkles className="h-8 w-8 text-primary animate-pulse" />
              </div>
              {/* Front */}
              <div
                className="absolute inset-0 rounded-lg border bg-muted/30 p-3 flex flex-col justify-center"
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                }}
              >
                <p className="font-semibold">{reveal.instrument.name}</p>
                <p className="text-xs text-muted-foreground mb-1">
                  {reveal.instrument.type}
                </p>
                <div className="flex items-center gap-2">
                  <Progress value={reveal.instrument.quality} className="h-1.5 flex-1" />
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {reveal.instrument.quality}/100
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Song preview */}
          <div
            className={cn(
              "rounded-lg border bg-muted/30 p-3 transition-all duration-500",
              phase === "song" || phase === "done"
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-3",
            )}
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Music className="h-3 w-3" /> Song added to catalog
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSongPlaying((p) => !p)}
                className="flex-shrink-0 h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:scale-105 transition-transform"
                aria-label={songPlaying ? "Pause preview" : "Play preview"}
              >
                {songPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{reveal.song.title}</p>
                <div className="flex gap-1 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">
                    {reveal.song.genre}
                  </Badge>
                  <QualityBadge quality={reveal.song.quality} />
                </div>
              </div>
            </div>
            {/* Quality bar */}
            <div className="mt-2 flex items-center gap-2">
              <Progress
                value={reveal.song.quality}
                className={cn(
                  "h-1.5 flex-1",
                  reveal.song.quality >= 80 && "[&>div]:bg-amber-400",
                  reveal.song.quality >= 60 && reveal.song.quality < 80 && "[&>div]:bg-purple-400",
                )}
              />
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {reveal.song.quality}/100
              </span>
            </div>
            {/* Fake audio waveform when "playing" */}
            {songPlaying && (
              <div className="mt-2 flex items-end gap-0.5 h-6">
                {Array.from({ length: 32 }).map((_, i) => (
                  <span
                    key={i}
                    className="flex-1 bg-primary/60 rounded-sm animate-pulse"
                    style={{
                      height: `${20 + Math.abs(Math.sin(i * 0.6)) * 80}%`,
                      animationDelay: `${i * 30}ms`,
                      animationDuration: "600ms",
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <p className="text-center text-xs text-muted-foreground">
            New balance:{" "}
            {reveal.currency === "premium"
              ? `${reveal.new_balance} tokens`
              : `$${reveal.new_balance.toLocaleString()}`}
          </p>
        </div>

        <DialogFooter className="gap-2">
          {phase !== "done" ? (
            <Button variant="ghost" size="sm" onClick={skipToEnd} className="w-full">
              Skip animation
            </Button>
          ) : (
            <Button onClick={onClose} className="w-full">
              Awesome
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  progress,
}: {
  icon: typeof Zap;
  label: string;
  value: string;
  hint?: string;
  progress?: number;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-center">
      <Icon className="mx-auto h-4 w-4 text-primary" />
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-lg font-bold tabular-nums">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground truncate">{hint}</p>}
      {typeof progress === "number" && (
        <Progress value={progress} className="h-1 mt-1" />
      )}
    </div>
  );
}

function QualityBadge({ quality }: { quality: number }) {
  const tier =
    quality >= 80 ? "Legendary" : quality >= 60 ? "Great" : quality >= 40 ? "Solid" : "Rough";
  const cls =
    quality >= 80
      ? "border-amber-400/60 text-amber-200"
      : quality >= 60
      ? "border-purple-400/60 text-purple-200"
      : quality >= 40
      ? "border-blue-400/60 text-blue-200"
      : "border-slate-400/60 text-slate-200";
  return (
    <Badge variant="outline" className={cn("text-[10px]", cls)}>
      {tier} · {quality}
    </Badge>
  );
}
