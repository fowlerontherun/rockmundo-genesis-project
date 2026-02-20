// Band Chemistry Dashboard — 4-axis chemistry visualization with drama risk
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ScoreGauge } from "./ScoreGauge";
import { motion } from "framer-motion";
import {
  calculateBandChemistryModifiers,
  type BandChemistryState,
  type BandDramaEvent,
} from "@/types/band-chemistry-engine";
import {
  Zap, Music, Heart, Swords, AlertTriangle, TrendingUp, TrendingDown,
  Mic, PenTool, Users, Shield, Flame, Activity, Theater, Check,
} from "lucide-react";
import { format } from "date-fns";

interface BandChemistryDashboardProps {
  bandName: string;
  chemistry: BandChemistryState;
  dramaEvents?: BandDramaEvent[];
  memberCount?: number;
  className?: string;
}

function ModifierRow({ label, value, icon, format: fmt = "multiplier" }: {
  label: string; value: number; icon: React.ReactNode; format?: "multiplier" | "percent" | "points";
}) {
  const isGood = fmt === "percent" ? value < 30 : value >= 1.0;
  const displayValue = fmt === "multiplier"
    ? `${value.toFixed(2)}x`
    : fmt === "percent"
    ? `${Math.round(value)}%`
    : `${value > 0 ? "+" : ""}${Math.round(value)}`;

  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2 text-sm">
        {icon}
        <span>{label}</span>
      </div>
      <span className={cn(
        "font-oswald font-bold text-sm",
        isGood ? "text-success" : "text-social-tension",
      )}>
        {displayValue}
      </span>
    </div>
  );
}

function ChemistryOrb({ value, label, color, glow }: {
  value: number; label: string; color: string; glow?: string;
}) {
  const size = 90;
  const isHigh = value >= 70;
  const isDanger = color.includes("tension") && value >= 50;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn(
          "relative flex flex-col items-center gap-1",
          isDanger && "animate-pulse-tension",
          isHigh && !isDanger && glow,
        )}>
          <ScoreGauge
            value={value}
            label={label}
            color={color}
            variant="ring"
            size="lg"
          />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-semibold">{label}: {value}/100</p>
        <p className="text-xs text-muted-foreground">
          {value >= 70 ? "High" : value >= 40 ? "Moderate" : "Low"}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

export function BandChemistryDashboard({
  bandName,
  chemistry,
  dramaEvents = [],
  memberCount = 4,
  className,
}: BandChemistryDashboardProps) {
  const modifiers = calculateBandChemistryModifiers(chemistry);

  // Drama risk assessment
  const dramaRisk = modifiers.dramaEventChance;
  const leaveRisk = modifiers.memberLeaveRisk;
  const riskLevel = dramaRisk >= 40 ? "critical" : dramaRisk >= 20 ? "high" : dramaRisk >= 10 ? "moderate" : "low";
  const riskColors = {
    critical: "text-social-tension border-social-tension/30 bg-social-tension/10",
    high: "text-social-drama border-social-drama/30 bg-social-drama/10",
    moderate: "text-social-jealousy border-social-jealousy/30 bg-social-jealousy/10",
    low: "text-success border-success/30 bg-success/10",
  };

  // Overall health indicator
  const overallHealth = chemistry.chemistry_level >= 60 && chemistry.conflict_index < 30 ? "healthy" :
    chemistry.conflict_index >= 60 ? "critical" : "mixed";

  return (
    <div className={cn("space-y-4", className)}>
      {/* Main Chemistry Card */}
      <Card className={cn(
        "border-border/50 overflow-hidden transition-all duration-500",
        overallHealth === "healthy" && "animate-pulse-chemistry",
        overallHealth === "critical" && "border-social-tension/30",
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-social-chemistry" />
              {bandName} — Chemistry
            </CardTitle>
            <Badge variant="outline" className={cn("text-[10px]", riskColors[riskLevel])}>
              {riskLevel === "critical" && <AlertTriangle className="h-3 w-3 mr-0.5" />}
              Drama Risk: {riskLevel.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* 4-Axis Visualization */}
          <div className="grid grid-cols-4 gap-4 place-items-center">
            <ChemistryOrb value={chemistry.chemistry_level} label="Chemistry" color="social-chemistry" glow="animate-pulse-chemistry" />
            <ChemistryOrb value={chemistry.creative_alignment} label="Creative" color="social-trust" />
            <ChemistryOrb value={chemistry.romantic_tension} label="Tension" color="social-love" />
            <ChemistryOrb value={chemistry.conflict_index} label="Conflict" color="social-tension" />
          </div>

          {/* Gameplay Modifiers */}
          <Card className="border-border/40 bg-muted/10">
            <CardContent className="p-3 divide-y divide-border/30">
              <ModifierRow label="Song Quality" value={modifiers.songQualityModifier} icon={<PenTool className="h-4 w-4 text-social-chemistry" />} />
              <ModifierRow label="Live Performance" value={modifiers.performanceRatingModifier} icon={<Mic className="h-4 w-4 text-social-warm" />} />
              <ModifierRow label="Rehearsal Efficiency" value={modifiers.rehearsalEfficiency} icon={<Music className="h-4 w-4 text-primary" />} />
              <ModifierRow label="Fan Perception" value={modifiers.fanPerception} icon={<Users className="h-4 w-4 text-social-loyalty" />} format="points" />
              <ModifierRow label="Member Leave Risk" value={modifiers.memberLeaveRisk} icon={<AlertTriangle className="h-4 w-4 text-social-tension" />} format="percent" />
              <ModifierRow label="Drama Chance" value={modifiers.dramaEventChance} icon={<Theater className="h-4 w-4 text-social-drama" />} format="percent" />
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      {/* Drama Event Log */}
      {dramaEvents.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Flame className="h-4 w-4 text-social-drama" />
              Recent Drama
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {dramaEvents.slice(0, 15).map((event, i) => {
                  const severityColors = {
                    minor: "border-l-muted-foreground",
                    moderate: "border-l-social-jealousy",
                    major: "border-l-social-drama",
                    critical: "border-l-social-tension",
                  };
                  return (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={cn(
                        "border-l-2 pl-3 py-1.5 rounded-r-md bg-muted/10",
                        severityColors[event.severity as keyof typeof severityColors] ?? "border-l-border",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium capitalize">
                          {event.drama_type.replace(/_/g, " ")}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[9px] px-1 py-0 capitalize">
                            {event.severity}
                          </Badge>
                          {event.resolved && <Check className="h-3 w-3 text-success" />}
                        </div>
                      </div>
                      {event.description && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{event.description}</p>
                      )}
                      <div className="flex gap-2 mt-1 text-[10px] font-oswald">
                        <span className={cn(event.chemistry_change >= 0 ? "text-success" : "text-social-tension")}>
                          ⚡{event.chemistry_change > 0 ? "+" : ""}{event.chemistry_change}
                        </span>
                        {event.conflict_index_change !== 0 && (
                          <span className={cn(event.conflict_index_change <= 0 ? "text-success" : "text-social-tension")}>
                            ⚔️{event.conflict_index_change > 0 ? "+" : ""}{event.conflict_index_change}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Missing import
import { Check } from "lucide-react";
