import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Megaphone, TrendingUp, Clock, Zap, AlertTriangle } from "lucide-react";
import { getMediaCycleState, type MediaCycleState } from "@/utils/mediaCycle";

interface MediaCycleWidgetProps {
  intensity: number;
  fatigue: number;
  compact?: boolean;
}

const PHASE_EMOJI: Record<MediaCycleState["phase"], string> = {
  dormant: "💤",
  building: "📈",
  peak: "🔥",
  declining: "📉",
  oversaturated: "🤯",
};

const PHASE_COLORS: Record<MediaCycleState["phase"], string> = {
  dormant: "bg-muted/40 border-border text-muted-foreground",
  building: "bg-primary/20 border-primary/30 text-primary",
  peak: "bg-warning/20 border-warning/30 text-warning",
  declining: "bg-orange-500/20 border-orange-500/30 text-orange-400",
  oversaturated: "bg-destructive/20 border-destructive/30 text-destructive",
};

export const MediaCycleBadge = ({ intensity, fatigue }: { intensity: number; fatigue: number }) => {
  const state = getMediaCycleState(intensity, fatigue);
  return (
    <Badge variant="outline" className={`text-[10px] ${PHASE_COLORS[state.phase]}`}>
      {PHASE_EMOJI[state.phase]} {state.phase.charAt(0).toUpperCase() + state.phase.slice(1)}
    </Badge>
  );
};

export const MediaCycleWidget = ({ intensity, fatigue, compact = false }: MediaCycleWidgetProps) => {
  const state = getMediaCycleState(intensity, fatigue);

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm">{PHASE_EMOJI[state.phase]}</span>
        <Progress value={state.intensity} className="h-1.5 flex-1" />
        <span className="text-[10px] font-mono text-muted-foreground">{state.coverageMultiplier}x</span>
      </div>
    );
  }

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-xs font-oswald flex items-center gap-2">
          <Megaphone className="h-3.5 w-3.5 text-primary" />
          Media Cycle
          <MediaCycleBadge intensity={intensity} fatigue={fatigue} />
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-2">
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Media Intensity</span>
            <span className="font-mono">{state.intensity}/100</span>
          </div>
          <Progress value={state.intensity} className="h-1.5" />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Media Fatigue</span>
            <span className="font-mono">{state.fatigueLevel}/100</span>
          </div>
          <Progress value={state.fatigueLevel} className="h-1.5" />
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-primary" />
            <span className="text-muted-foreground">Coverage:</span>
            <span className="font-mono">{state.coverageMultiplier}x</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-warning" />
            <span className="text-muted-foreground">Phase shift:</span>
            <span className="font-mono">~{state.nextPhaseIn}d</span>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground/80 italic">{state.description}</p>

        {state.phase === "oversaturated" && (
          <div className="flex items-center gap-1.5 p-1.5 rounded bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="h-3 w-3 text-destructive" />
            <span className="text-[10px] text-destructive">
              Lay low — media coverage effectiveness is severely reduced
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
