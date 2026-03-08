import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Heart, Stethoscope, Brain, Pill, Bed, Clock } from "lucide-react";
import { useConditions } from "@/hooks/useConditions";
import {
  getConditionDefinition,
  getConditionTypeInfo,
  getConditionSeverityLabel,
  type TreatmentType,
} from "@/utils/conditionSystem";
import { formatDistanceToNow } from "date-fns";

const TREATMENT_ICONS: Record<string, React.ReactNode> = {
  hospital: <Stethoscope className="h-3 w-3" />,
  therapy: <Brain className="h-3 w-3" />,
  medication: <Pill className="h-3 w-3" />,
  rest: <Bed className="h-3 w-3" />,
};

const TREATMENT_LABELS: Record<string, string> = {
  hospital: "Hospital",
  therapy: "Therapy",
  medication: "Medication",
  rest: "Rest (Free)",
};

export function ConditionsPanel() {
  const { conditions, aggregatedEffects, treatCondition, isTreating, checkRecovery } = useConditions();

  // Auto-check recovery on mount
  useEffect(() => {
    checkRecovery();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (conditions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Heart className="h-5 w-5" /> No Active Conditions</CardTitle>
          <CardDescription>You're in good shape! Stay healthy out there.</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              Injuries can happen during travel or gigs. Mental health conditions can develop from overwork and lifestyle choices.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Show aggregated effects summary
  const effectSummary: string[] = [];
  if (aggregatedEffects.blocks_gigs) effectSummary.push("🚫 Gigs blocked");
  if (aggregatedEffects.blocks_singing) effectSummary.push("🎤 Singing blocked");
  if (aggregatedEffects.blocks_guitar_gigs) effectSummary.push("🎸 Guitar blocked");
  if (aggregatedEffects.blocks_travel) effectSummary.push("✈️ Travel blocked");
  if (aggregatedEffects.xp_penalty) effectSummary.push(`📉 -${Math.round(aggregatedEffects.xp_penalty)}% XP`);
  if (aggregatedEffects.energy_cap && aggregatedEffects.energy_cap < 100) effectSummary.push(`⚡ Energy capped at ${aggregatedEffects.energy_cap}%`);
  if (aggregatedEffects.songwriting_quality && aggregatedEffects.songwriting_quality > 0) effectSummary.push(`✍️ +${aggregatedEffects.songwriting_quality}% songwriting`);

  return (
    <div className="space-y-4">
      {effectSummary.length > 0 && (
        <Alert>
          <AlertDescription className="flex flex-wrap gap-2">
            {effectSummary.map((s, i) => (
              <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {conditions.map((condition) => {
        const def = getConditionDefinition(condition.condition_name);
        const typeInfo = getConditionTypeInfo(condition.condition_type as any);
        const severityInfo = getConditionSeverityLabel(condition.severity);
        const isTreating_ = condition.status === "treating";

        return (
          <Card key={condition.id} className="border-muted">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <span className="text-lg">{def?.icon || typeInfo.icon}</span>
                  {def?.label || condition.condition_name}
                </span>
                <div className="flex gap-2">
                  <Badge variant="outline" className={typeInfo.color}>{typeInfo.label}</Badge>
                  <Badge variant={isTreating_ ? "secondary" : "destructive"}>
                    {isTreating_ ? "Treating" : "Active"}
                  </Badge>
                </div>
              </CardTitle>
              {def?.description && (
                <CardDescription>{def.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Severity</span>
                  <span className={`font-bold ${severityInfo.color}`}>
                    {severityInfo.label} ({condition.severity}/100)
                  </span>
                </div>
                <Progress value={condition.severity} className="h-2" />
              </div>

              {condition.cause && (
                <p className="text-xs text-muted-foreground">
                  Cause: <span className="capitalize">{condition.cause.replace(/_/g, " ")}</span>
                </p>
              )}

              {isTreating_ && condition.estimated_recovery_at && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>
                    Recovery {new Date(condition.estimated_recovery_at) > new Date()
                      ? `in ${formatDistanceToNow(new Date(condition.estimated_recovery_at))}`
                      : "complete — refreshing..."
                    }
                  </span>
                  {condition.treatment_type && (
                    <Badge variant="outline" className="text-xs">
                      via {TREATMENT_LABELS[condition.treatment_type] || condition.treatment_type}
                    </Badge>
                  )}
                </div>
              )}

              {!isTreating_ && def && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Treatment Options:</p>
                  <div className="flex flex-wrap gap-2">
                    {def.treatmentOptions.map((treatment) => {
                      const cost = def.treatmentCosts[treatment] || 0;
                      return (
                        <Button
                          key={treatment}
                          size="sm"
                          variant="outline"
                          disabled={isTreating}
                          onClick={() => treatCondition({ conditionId: condition.id, treatmentType: treatment as TreatmentType })}
                          className="gap-1"
                        >
                          {TREATMENT_ICONS[treatment]}
                          {TREATMENT_LABELS[treatment]}
                          {cost > 0 && ` ($${cost})`}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
