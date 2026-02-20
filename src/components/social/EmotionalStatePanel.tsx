// Emotional State Panel — Embeddable widget showing 6 emotional metrics
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ScoreGauge } from "./ScoreGauge";
import { useEmotionalState } from "@/hooks/useEmotionalEngine";
import { EMOTION_DISPLAY, getModifierLabel, getEmotionIntensity } from "@/types/emotional-engine";
import type { CharacterEmotionalState } from "@/types/emotional-engine";
import {
  Smile, Frown, UserX, Lightbulb, Eye, Flame, Target,
  TrendingUp, TrendingDown, Minus, Music, Mic, MessageSquare,
} from "lucide-react";

const EMOTION_ICONS: Record<string, React.ReactNode> = {
  happiness: <Smile className="h-4 w-4" />,
  loneliness: <UserX className="h-4 w-4" />,
  inspiration: <Lightbulb className="h-4 w-4" />,
  jealousy: <Eye className="h-4 w-4" />,
  resentment: <Flame className="h-4 w-4" />,
  obsession: <Target className="h-4 w-4" />,
};

const EMOTION_COLORS: Record<string, string> = {
  happiness: "social-warm",
  loneliness: "social-cold",
  inspiration: "social-chemistry",
  jealousy: "social-jealousy",
  resentment: "social-tension",
  obsession: "social-attraction",
};

interface EmotionalStatePanelProps {
  compact?: boolean;
  className?: string;
}

function getTrendIcon(value: number) {
  if (value >= 60) return <TrendingUp className="h-3 w-3 text-social-warm" />;
  if (value <= 30) return <TrendingDown className="h-3 w-3 text-social-tension" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

function ModifierBadge({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  const { label: modLabel, sentiment } = getModifierLabel(value);
  const colorMap = {
    positive: "text-success border-success/30 bg-success/10",
    neutral: "text-muted-foreground border-border bg-muted/30",
    negative: "text-social-tension border-social-tension/30 bg-social-tension/10",
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn(
          "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all",
          colorMap[sentiment],
        )}>
          {icon}
          <span>{label}</span>
          <span className="font-oswald font-bold">{(value * 100).toFixed(0)}%</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{modLabel} — {label} modifier</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function EmotionalStatePanel({ compact = false, className }: EmotionalStatePanelProps) {
  const { data: emotionalState, isLoading } = useEmotionalState();

  if (isLoading || !emotionalState) {
    return (
      <Card className={cn("border-border/50", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Smile className="h-4 w-4 text-social-warm" />
            Emotional State
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 rounded-lg bg-muted/30 animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const state = emotionalState as CharacterEmotionalState;

  // Determine emotional instability — triggers flicker animation
  const avgNegative = ((state.jealousy + state.resentment + state.obsession) / 3);
  const isUnstable = avgNegative > 60;

  if (compact) {
    return (
      <Card className={cn(
        "border-border/50 transition-all duration-500",
        isUnstable && "animate-emotional-flicker border-social-tension/30",
        className,
      )}>
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold flex items-center gap-1.5">
              {EMOTION_ICONS.happiness}
              Emotional State
            </span>
            {isUnstable && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Unstable</Badge>
            )}
          </div>
          <div className="grid grid-cols-6 gap-1">
            {EMOTION_DISPLAY.map((emotion) => (
              <ScoreGauge
                key={emotion.key}
                value={state[emotion.key]}
                label={emotion.key.slice(0, 3).toUpperCase()}
                color={EMOTION_COLORS[emotion.key]}
                size="sm"
                variant="ring"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      "border-border/50 transition-all duration-500",
      isUnstable && "animate-emotional-flicker border-social-tension/30",
      className,
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Smile className="h-4 w-4 text-social-warm" />
            Emotional State
          </CardTitle>
          {isUnstable && (
            <Badge variant="destructive" className="text-[10px]">⚠ Unstable</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Emotion Gauges */}
        <div className="grid grid-cols-3 gap-3">
          {EMOTION_DISPLAY.map((emotion) => {
            const val = state[emotion.key];
            const intensity = getEmotionIntensity(val);
            return (
              <Tooltip key={emotion.key}>
                <TooltipTrigger asChild>
                  <div className={cn(
                    "rounded-lg border border-border/50 p-2.5 space-y-1 bg-muted/20 transition-all hover:bg-muted/40",
                    val >= 80 && "border-social-tension/30",
                  )}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-medium">
                        {EMOTION_ICONS[emotion.key]}
                        {emotion.label}
                      </div>
                      {getTrendIcon(val)}
                    </div>
                    <ScoreGauge
                      value={val}
                      label=""
                      color={EMOTION_COLORS[emotion.key]}
                      size="sm"
                      showValue={false}
                    />
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{val >= 50 ? emotion.highLabel : emotion.lowLabel}</span>
                      <span className="font-oswald">{val}</span>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-semibold">{emotion.label}: {intensity}</p>
                  <p className="text-xs text-muted-foreground">{emotion.lowLabel} → {emotion.highLabel}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Gameplay Modifiers */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Active Modifiers
          </span>
          <div className="flex flex-wrap gap-2">
            <ModifierBadge
              label="Songwriting"
              value={state.songwriting_modifier}
              icon={<Music className="h-3 w-3" />}
            />
            <ModifierBadge
              label="Performance"
              value={state.performance_modifier}
              icon={<Mic className="h-3 w-3" />}
            />
            <ModifierBadge
              label="Social"
              value={state.interaction_modifier}
              icon={<MessageSquare className="h-3 w-3" />}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
