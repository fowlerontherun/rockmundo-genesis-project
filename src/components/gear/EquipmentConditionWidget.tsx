import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Wrench, AlertTriangle, Shield, Zap } from "lucide-react";
import { getEquipmentCondition, type DegradationState } from "@/utils/equipmentDegradation";

interface EquipmentConditionWidgetProps {
  condition: number;
  itemName: string;
  category?: string;
  originalPrice?: number;
  compact?: boolean;
}

const CONDITION_COLORS: Record<DegradationState["conditionLabel"], string> = {
  pristine: "text-emerald-400",
  good: "text-primary",
  worn: "text-warning",
  damaged: "text-orange-500",
  broken: "text-destructive",
};

const CONDITION_BG: Record<DegradationState["conditionLabel"], string> = {
  pristine: "bg-emerald-500/20 border-emerald-500/30 text-emerald-400",
  good: "bg-primary/20 border-primary/30 text-primary",
  worn: "bg-warning/20 border-warning/30 text-warning",
  damaged: "bg-orange-500/20 border-orange-500/30 text-orange-400",
  broken: "bg-destructive/20 border-destructive/30 text-destructive",
};

export const EquipmentConditionBadge = ({ condition }: { condition: number }) => {
  const state = getEquipmentCondition(condition);
  return (
    <Badge variant="outline" className={`text-[10px] ${CONDITION_BG[state.conditionLabel]}`}>
      {state.conditionLabel.charAt(0).toUpperCase() + state.conditionLabel.slice(1)} ({state.condition}%)
    </Badge>
  );
};

export const EquipmentConditionWidget = ({
  condition,
  itemName,
  category,
  originalPrice,
  compact = false,
}: EquipmentConditionWidgetProps) => {
  const state = getEquipmentCondition(condition);

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Progress value={state.condition} className="h-1.5 flex-1" />
        <span className={`text-[10px] font-mono ${CONDITION_COLORS[state.conditionLabel]}`}>
          {state.condition}%
        </span>
      </div>
    );
  }

  const repairCostDollars = originalPrice ? Math.round(originalPrice * state.repairCost) : null;

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-xs font-oswald flex items-center gap-2">
          <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
          {itemName}
          <EquipmentConditionBadge condition={condition} />
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-2">
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Condition</span>
            <span className={CONDITION_COLORS[state.conditionLabel]}>{state.condition}%</span>
          </div>
          <Progress value={state.condition} className="h-1.5" />
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-primary" />
            <span className="text-muted-foreground">Performance:</span>
            <span className="font-mono">{Math.round(state.performanceModifier * 100)}%</span>
          </div>
          <div className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-warning" />
            <span className="text-muted-foreground">Breakdown:</span>
            <span className="font-mono">{(state.breakdownChance * 100).toFixed(1)}%</span>
          </div>
        </div>

        {state.needsRepair && (
          <div className="flex items-center gap-1.5 p-1.5 rounded bg-destructive/10 border border-destructive/20">
            <Shield className="h-3 w-3 text-destructive" />
            <span className="text-[10px] text-destructive">
              Needs repair{repairCostDollars != null ? ` — est. $${repairCostDollars.toLocaleString()}` : ""}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
