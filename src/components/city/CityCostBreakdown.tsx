import { DollarSign, Home, Utensils, Car, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface CityCostBreakdownProps {
  costOfLiving: number;
  cityName: string;
}

const getCostLabel = (cost: number) => {
  if (cost >= 90) return "Extremely Expensive";
  if (cost >= 75) return "Very Expensive";
  if (cost >= 60) return "Moderately Expensive";
  if (cost >= 40) return "Affordable";
  if (cost >= 20) return "Budget-Friendly";
  return "Very Cheap";
};

const getCostColor = (cost: number) => {
  if (cost >= 75) return "text-red-600";
  if (cost >= 50) return "text-yellow-600";
  return "text-green-600";
};

// Estimate breakdown based on overall cost
const getBreakdown = (cost: number) => {
  const baseRent = 500 + (cost / 100) * 2500; // $500-$3000
  const baseFood = 200 + (cost / 100) * 600; // $200-$800/month
  const baseTransport = 50 + (cost / 100) * 200; // $50-$250/month

  return {
    rent: Math.round(baseRent),
    food: Math.round(baseFood),
    transport: Math.round(baseTransport),
  };
};

export const CityCostBreakdown = ({ costOfLiving, cityName }: CityCostBreakdownProps) => {
  const breakdown = getBreakdown(costOfLiving);
  const TrendIcon = costOfLiving >= 50 ? TrendingUp : TrendingDown;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          Cost of Living
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Overall Index</span>
            <div className="flex items-center gap-1">
              <TrendIcon className={`h-4 w-4 ${getCostColor(costOfLiving)}`} />
              <span className={`font-bold text-lg ${getCostColor(costOfLiving)}`}>
                {costOfLiving}%
              </span>
            </div>
          </div>
          <Progress value={costOfLiving} className="h-2" />
          <p className="text-xs text-muted-foreground">{getCostLabel(costOfLiving)}</p>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Estimated Monthly Costs
          </p>

          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-2">
              <div className="flex items-center gap-2">
                <Home className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Rent (studio apt)</span>
              </div>
              <span className="font-medium">${breakdown.rent.toLocaleString()}</span>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/60 p-2">
              <div className="flex items-center gap-2">
                <Utensils className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Food & Dining</span>
              </div>
              <span className="font-medium">${breakdown.food.toLocaleString()}</span>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/60 p-2">
              <div className="flex items-center gap-2">
                <Car className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Transport</span>
              </div>
              <span className="font-medium">${breakdown.transport.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border/60">
            <span className="text-sm font-medium">Total Estimate</span>
            <span className="font-bold text-primary">
              ${(breakdown.rent + breakdown.food + breakdown.transport).toLocaleString()}/mo
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
