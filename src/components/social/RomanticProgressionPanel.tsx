// Romantic Progression Interface — Stage visualization and romance management
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ScoreGauge } from "./ScoreGauge";
import { motion } from "framer-motion";
import { ROMANCE_STAGES, type RomanceStage, type RomanticRelationship, canAdvanceStage } from "@/types/romance-system";
import {
  Heart, HeartCrack, Crown, Sparkles, Shield, Eye, AlertTriangle,
  ArrowRight, Lock, Check, Flame, TrendingUp,
} from "lucide-react";

interface RomanticProgressionProps {
  romance?: RomanticRelationship | null;
  onAdvanceStage?: () => void;
  onInteraction?: (type: string) => void;
  className?: string;
}

const STAGE_ICONS: Record<RomanceStage, React.ReactNode> = {
  flirting: <span className="text-lg">😏</span>,
  dating: <span className="text-lg">💐</span>,
  exclusive: <span className="text-lg">💕</span>,
  public_relationship: <span className="text-lg">❤️</span>,
  engaged: <span className="text-lg">💍</span>,
  married: <span className="text-lg">💒</span>,
  separated: <span className="text-lg">💔</span>,
  divorced: <span className="text-lg">📝</span>,
  secret_affair: <span className="text-lg">🤫</span>,
};

export function RomanticProgressionPanel({
  romance,
  onAdvanceStage,
  onInteraction,
  className,
}: RomanticProgressionProps) {
  if (!romance) {
    return (
      <Card className={cn("border-border/50", className)}>
        <CardContent className="py-12 text-center">
          <Heart className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <h3 className="text-lg font-semibold mb-1">No Active Romance</h3>
          <p className="text-sm text-muted-foreground">Start flirting with someone to begin a romantic storyline.</p>
        </CardContent>
      </Card>
    );
  }

  const currentStageDef = ROMANCE_STAGES.find(s => s.id === romance.stage);
  const advancement = canAdvanceStage(romance);
  const isPublic = currentStageDef?.isPublic ?? false;
  const isSecretAffair = romance.stage === "secret_affair";

  // Determine card glow based on stage
  const stageGlow = isSecretAffair
    ? "border-social-drama/30 shadow-[0_0_20px_hsl(var(--social-drama)/0.15)]"
    : romance.stage === "married" || romance.stage === "engaged"
    ? "border-social-love/30 shadow-love"
    : romance.stage === "separated" || romance.stage === "divorced"
    ? "border-social-tension/30 shadow-tension-glow"
    : "border-social-attraction/20";

  return (
    <Card className={cn("overflow-hidden transition-all duration-500", stageGlow, className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Heart className="h-5 w-5 text-social-love" />
            Romance with {romance.partner_b_name}
          </CardTitle>
          {isSecretAffair && (
            <Badge className="bg-social-drama/20 text-social-drama border-social-drama/30 animate-pulse text-[10px]">
              SECRET
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Stage Progression Visualization */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Stage Progression</h4>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {ROMANCE_STAGES.filter(s => s.order >= 0).sort((a, b) => a.order - b.order).map((stage, i) => {
              const isCurrent = stage.id === romance.stage;
              const isPast = currentStageDef && stage.order < currentStageDef.order;
              return (
                <div key={stage.id} className="flex items-center">
                  {i > 0 && (
                    <div className={cn(
                      "w-4 h-px mx-0.5",
                      isPast ? "bg-social-love" : "bg-border",
                    )} />
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={cn(
                        "flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 transition-all min-w-[52px]",
                        isCurrent && "bg-social-love/15 ring-1 ring-social-love/40",
                        isPast && "opacity-60",
                        !isCurrent && !isPast && "opacity-30",
                      )}>
                        <span className={cn("text-base", isCurrent && "animate-pulse-slow")}>{stage.emoji}</span>
                        <span className="text-[9px] text-center leading-tight font-medium">{stage.label}</span>
                        {isCurrent && <div className="h-0.5 w-full bg-social-love rounded-full mt-0.5" />}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="font-semibold">{stage.label}</p>
                      <p className="text-xs text-muted-foreground">Unlocks: {stage.unlocks.slice(0, 3).join(", ")}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              );
            })}
          </div>
        </div>

        {/* Core Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <ScoreGauge value={romance.attraction_score} label="Attraction" color="social-attraction" variant="ring" />
          <ScoreGauge value={romance.passion_score} label="Passion" color="social-love" variant="ring" />
          <ScoreGauge value={romance.commitment_score} label="Commitment" color="social-trust" variant="ring" />
          <ScoreGauge value={romance.tension_score} label="Tension" color="social-tension" variant="ring" />
        </div>

        {/* Compatibility & Jealousy */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border/50 p-3 bg-muted/20 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5 text-social-chemistry" />
              Compatibility
            </div>
            <ScoreGauge value={romance.compatibility_score} label="" color="social-chemistry" size="sm" />
          </div>
          <div className="rounded-lg border border-border/50 p-3 bg-muted/20 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Eye className="h-3.5 w-3.5 text-social-jealousy" />
              Affair Suspicion
            </div>
            <ScoreGauge
              value={romance.affair_suspicion}
              label=""
              color={romance.affair_suspicion > 50 ? "social-tension" : "social-jealousy"}
              size="sm"
              glowOnHigh
            />
            {romance.affair_detected && (
              <Badge variant="destructive" className="text-[10px]">DETECTED</Badge>
            )}
          </div>
        </div>

        {/* Advance Stage */}
        {advancement.nextStage && (
          <div className={cn(
            "rounded-lg border p-3",
            advancement.canAdvance
              ? "border-social-love/30 bg-social-love/5"
              : "border-border/50 bg-muted/20",
          )}>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  <ArrowRight className="h-4 w-4" />
                  Next: {ROMANCE_STAGES.find(s => s.id === advancement.nextStage)?.label}
                </p>
                {advancement.missingRequirements.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {advancement.missingRequirements.map((req) => (
                      <Badge key={req} variant="outline" className="text-[10px] text-social-tension border-social-tension/30">
                        <Lock className="h-2.5 w-2.5 mr-0.5" />{req}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <Button
                size="sm"
                disabled={!advancement.canAdvance}
                onClick={onAdvanceStage}
                className={cn(
                  advancement.canAdvance && "bg-social-love hover:bg-social-love/90 text-white",
                )}
              >
                {advancement.canAdvance ? <Check className="h-4 w-4 mr-1" /> : <Lock className="h-4 w-4 mr-1" />}
                Advance
              </Button>
            </div>
          </div>
        )}

        {/* Unlocked Actions */}
        {currentStageDef && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Unlocked</h4>
            <div className="flex flex-wrap gap-1.5">
              {currentStageDef.unlocks.map((unlock) => (
                <Badge key={unlock} variant="secondary" className="text-[10px]">
                  {unlock}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
