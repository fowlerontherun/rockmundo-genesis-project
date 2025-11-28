import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, TrendingUp } from "lucide-react";
import { getAttributeTrainingCost, ATTRIBUTE_MAX_VALUE } from "@/utils/attributeProgression";
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
}

export const AttributeCard = ({
  attributeKey,
  label,
  description,
  currentValue,
  xpBalance,
  affectedSystems,
}: AttributeCardProps) => {
  const queryClient = useQueryClient();
  const cost = getAttributeTrainingCost(currentValue);
  const progress = (currentValue / ATTRIBUTE_MAX_VALUE) * 100;
  const canAfford = xpBalance >= cost;
  const isMaxed = currentValue >= ATTRIBUTE_MAX_VALUE;

  const trainMutation = useMutation({
    mutationFn: () => spendAttributeXp({ attributeKey, amount: cost }),
    onSuccess: () => {
      toast.success(`${label} trained! +10 points`);
      queryClient.invalidateQueries({ queryKey: ["gameData"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to train attribute");
    },
  });

  return (
    <Card className="hover:border-primary/40 transition-colors">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">{label}</h3>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-4 h-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-sm">{description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary">{currentValue}</p>
            <p className="text-xs text-muted-foreground">/ {ATTRIBUTE_MAX_VALUE}</p>
          </div>
        </div>

        <Progress value={progress} className="h-2" />

        <div className="flex flex-wrap gap-1">
          {affectedSystems.map((system) => (
            <Badge key={system} variant="secondary" className="text-xs">
              {system}
            </Badge>
          ))}
        </div>

        <Button
          onClick={() => trainMutation.mutate()}
          disabled={!canAfford || isMaxed || trainMutation.isPending}
          className="w-full"
          size="sm"
        >
          {isMaxed ? (
            "Maxed Out"
          ) : (
            <>
              <TrendingUp className="w-4 h-4 mr-2" />
              Train (+10) - {cost} XP
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
