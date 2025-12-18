import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, TrendingUp } from "lucide-react";
import { ATTRIBUTE_MAX_VALUE } from "@/utils/attributeProgression";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { spendAttributeXp } from "@/utils/progression";
import { toast } from "sonner";

interface AttributeCardProps {
  attributeKey: string;
  label: string;
  description: string;
  currentValue: number;
  xpBalance: number;
  affectedSystems: string[];
  onXpSpent?: () => void;
}

export const AttributeCard = ({
  attributeKey,
  label,
  description,
  currentValue,
  xpBalance,
  affectedSystems,
  onXpSpent
}: AttributeCardProps) => {
  const queryClient = useQueryClient();
  const standardCost = 10;
  // Allow spending whatever XP they have left if less than standard cost
  const cost = xpBalance > 0 && xpBalance < standardCost ? xpBalance : standardCost;
  const progress = currentValue / ATTRIBUTE_MAX_VALUE * 100;
  const canAfford = xpBalance > 0;
  const isMaxed = currentValue >= ATTRIBUTE_MAX_VALUE;

  const trainMutation = useMutation({
    mutationFn: () => spendAttributeXp({
      attributeKey,
      amount: cost
    }),
    onSuccess: () => {
      toast.success(`${label} trained! +10 points`);
      queryClient.invalidateQueries({ queryKey: ["gameData"] });
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

        <Progress value={progress} className="h-1.5" />

        <Button 
          onClick={() => trainMutation.mutate()} 
          disabled={!canAfford || isMaxed || trainMutation.isPending} 
          className="w-full h-7 text-xs" 
          size="sm"
        >
          {isMaxed ? "Maxed" : (
            <>
              <TrendingUp className="w-3 h-3 mr-1" />
              Train - {cost} XP
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
