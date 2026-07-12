import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, TrendingUp } from "lucide-react";
import { ATTRIBUTE_MAX_VALUE } from "@/utils/attributeProgression";
import { clampProgressPercent } from "@/utils/skillProgressDisplay";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { spendAttributeXp } from "@/utils/progression";
import { toast } from "sonner";

interface AttributeCardProps {
  attributeKey: string;
  label: string;
  description: string;
  currentValue: number;
  xpBalance: number; // This is now Attribute Points (AP)
  affectedSystems: string[];
  onXpSpent?: () => void;
}

export const AttributeCard = ({
  attributeKey,
  label,
  description,
  currentValue,
  xpBalance, // AP balance
  affectedSystems,
  onXpSpent
}: AttributeCardProps) => {
  const queryClient = useQueryClient();
  const standardCost = 5; // Attributes now cost 5 AP
  const cost = xpBalance > 0 && xpBalance < standardCost ? xpBalance : standardCost;
  const progress = clampProgressPercent((currentValue / ATTRIBUTE_MAX_VALUE) * 100);
  const canAfford = xpBalance >= cost;
  const isMaxed = currentValue >= ATTRIBUTE_MAX_VALUE;

  const trainMutation = useMutation({
    mutationFn: () => spendAttributeXp({
      attributeKey,
      amount: cost
    }),
    onSuccess: () => {
      toast.success(`${label} trained! +${cost} points`);
      queryClient.invalidateQueries({ queryKey: ["gameData"] });
      queryClient.invalidateQueries({ queryKey: ["player-attributes"] });
      onXpSpent?.();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to train attribute");
    }
  });

  return (
    <Card className="hover:border-primary/40 transition-colors">
      <CardContent className="pt-3 pb-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-1">
            <h3 className="font-medium text-sm">{label}</h3>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-3 h-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">{description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <span className="text-xs text-muted-foreground">{currentValue}</span>
        </div>

        <Progress value={progress} className="h-1.5" aria-label={`${label} attribute value ${currentValue} of ${ATTRIBUTE_MAX_VALUE}`} />

        <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Current effects</p>
          <p>{affectedSystems.length ? affectedSystems.join(", ") : "General progression"}</p>
          <p className="mt-1">Upgrade preview: {currentValue} → {Math.min(ATTRIBUTE_MAX_VALUE, currentValue + cost)} for {cost} AP. Estimated contribution only; outcomes are not guaranteed.</p>
        </div>

        {!canAfford && !isMaxed && (
          <p className="text-xs text-muted-foreground" role="status">You need more Attribute Points for this upgrade.</p>
        )}

        <Button 
          aria-label={`Train ${label} for ${cost} AP`}
          onClick={() => trainMutation.mutate()} 
          disabled={!canAfford || isMaxed || trainMutation.isPending} 
          className="w-full h-7 text-xs" 
          size="sm"
        >
          {isMaxed ? "Maxed" : (
            <>
              <TrendingUp className="w-3 h-3 mr-1" />
              Train - {cost} AP
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
