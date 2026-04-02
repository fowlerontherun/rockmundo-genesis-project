import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, AlertTriangle, Sparkles, Star, Zap, DollarSign, Users, Lightbulb } from "lucide-react";
import {
  STANCE_CONFIGS,
  getStanceRiskColor,
  getOutcomeVariant,
  type NightlifeStance,
  type NightlifeOutcomeDetail,
} from "@/utils/nightlifeRiskLayer";

interface NightlifeStanceSelectorProps {
  clubName: string;
  onSelectStance: (stance: NightlifeStance) => void;
  isProcessing: boolean;
  outcome: NightlifeOutcomeDetail | null;
  onDismissOutcome: () => void;
  addictionWarning?: string | null;
}

export const NightlifeStanceSelector = ({
  clubName,
  onSelectStance,
  isProcessing,
  outcome,
  onDismissOutcome,
  addictionWarning,
}: NightlifeStanceSelectorProps) => {
  const [selectedStance, setSelectedStance] = useState<NightlifeStance | null>(null);
  const [confirming, setConfirming] = useState(false);

  const handleSelect = (stance: NightlifeStance) => {
    setSelectedStance(stance);
    setConfirming(true);
  };

  const handleConfirm = () => {
    if (!selectedStance) return;
    setConfirming(false);
    onSelectStance(selectedStance);
  };

  const stances = Object.values(STANCE_CONFIGS);
  const selectedConfig = selectedStance ? STANCE_CONFIGS[selectedStance] : null;

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" />
          Choose Your Approach
        </div>
        <p className="text-xs text-muted-foreground">
          How do you want to spend the night at {clubName}? Each stance carries different risks and rewards.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {stances.map((config) => (
            <Card
              key={config.id}
              className="cursor-pointer border-border/60 transition-all hover:border-primary/50 hover:shadow-sm"
              onClick={() => !isProcessing && handleSelect(config.id)}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{config.emoji}</span>
                    <span className="font-medium text-sm">{config.label}</span>
                  </div>
                  <Badge
                    variant={config.riskLevel === "high" ? "destructive" : config.riskLevel === "moderate" ? "secondary" : "outline"}
                    className="text-[10px]"
                  >
                    {config.riskLevel} risk
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{config.description}</p>
                <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                  <span className={getStanceRiskColor(config.riskLevel)}>
                    Fame ×{config.fameMultiplier}
                  </span>
                  <span>Energy ×{config.energyCostMultiplier}</span>
                  <span>Cost ×{config.cashMultiplier}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-xl">{selectedConfig?.emoji}</span>
              {selectedConfig?.label}
            </DialogTitle>
            <DialogDescription>{selectedConfig?.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md border border-border p-2 text-center">
                <div className="font-semibold">Fame</div>
                <div className="text-muted-foreground">×{selectedConfig?.fameMultiplier}</div>
              </div>
              <div className="rounded-md border border-border p-2 text-center">
                <div className="font-semibold">Energy</div>
                <div className="text-muted-foreground">×{selectedConfig?.energyCostMultiplier}</div>
              </div>
              <div className="rounded-md border border-border p-2 text-center">
                <div className="font-semibold">Cost</div>
                <div className="text-muted-foreground">×{selectedConfig?.cashMultiplier}</div>
              </div>
              <div className="rounded-md border border-border p-2 text-center">
                <div className="font-semibold">Scandal</div>
                <div className="text-muted-foreground">{Math.round((selectedConfig?.scandalChance ?? 0) * 100)}%</div>
              </div>
            </div>
            {selectedConfig?.addictionRiskMultiplier && selectedConfig.addictionRiskMultiplier > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>Addiction risk multiplier: ×{selectedConfig.addictionRiskMultiplier}</span>
              </div>
            )}
            <Button className="w-full" onClick={handleConfirm} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Commit to {selectedConfig?.label}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Outcome Dialog */}
      <Dialog open={!!outcome} onOpenChange={(open) => !open && onDismissOutcome()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">{outcome?.emoji}</span>
              {outcome?.label}
            </DialogTitle>
            <DialogDescription>Your night at {clubName}</DialogDescription>
          </DialogHeader>
          {outcome && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-sm text-muted-foreground">{outcome.description}</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="flex items-center gap-2 rounded-md border border-border p-2">
                  <Star className="h-4 w-4 text-yellow-400" />
                  <div>
                    <div className={`text-sm font-medium ${outcome.fameChange >= 0 ? "" : "text-destructive"}`}>
                      {outcome.fameChange >= 0 ? "+" : ""}{outcome.fameChange}
                    </div>
                    <div className="text-[10px] text-muted-foreground">Fame</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-md border border-border p-2">
                  <Zap className="h-4 w-4 text-purple-400" />
                  <div>
                    <div className="text-sm font-medium text-destructive">{outcome.energyChange}</div>
                    <div className="text-[10px] text-muted-foreground">Energy</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-md border border-border p-2">
                  <DollarSign className="h-4 w-4 text-green-400" />
                  <div>
                    <div className="text-sm font-medium text-destructive">{outcome.cashChange}</div>
                    <div className="text-[10px] text-muted-foreground">Cash</div>
                  </div>
                </div>
              </div>

              {/* Special outcome badges */}
              <div className="flex flex-wrap gap-2">
                {outcome.inspirationGained && (
                  <Badge variant="default" className="gap-1">
                    <Lightbulb className="h-3 w-3" /> Inspiration gained
                  </Badge>
                )}
                {outcome.contactGained && (
                  <Badge variant="default" className="gap-1">
                    <Users className="h-3 w-3" /> New contact
                  </Badge>
                )}
                {outcome.scandalTriggered && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" /> Scandal
                  </Badge>
                )}
              </div>

              {addictionWarning && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  ⚠️ {addictionWarning}
                </div>
              )}

              <Button className="w-full" onClick={onDismissOutcome}>
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
