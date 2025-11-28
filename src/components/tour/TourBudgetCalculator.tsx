import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, TrendingDown, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TourBudgetCalculatorProps {
  travelCosts: number;
  accommodationCosts: number;
  crewCosts: number;
  estimatedRevenue: number;
  numberOfGigs: number;
}

export const TourBudgetCalculator = ({
  travelCosts,
  accommodationCosts,
  crewCosts,
  estimatedRevenue,
  numberOfGigs,
}: TourBudgetCalculatorProps) => {
  const totalCosts = travelCosts + accommodationCosts + crewCosts;
  const projectedProfit = estimatedRevenue - totalCosts;
  const profitMargin = estimatedRevenue > 0 ? (projectedProfit / estimatedRevenue) * 100 : 0;
  const isProfitable = projectedProfit > 0;

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Tour Budget Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Revenue */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm text-muted-foreground">Expected Revenue</h4>
          <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Total from {numberOfGigs} gigs</span>
              <span className="text-2xl font-bold text-green-600">
                ${estimatedRevenue.toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Average per gig: ${(estimatedRevenue / numberOfGigs).toFixed(0)}
            </p>
          </div>
        </div>

        {/* Costs Breakdown */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm text-muted-foreground">Total Costs</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
              <span>Travel & Transport</span>
              <span className="font-semibold">${travelCosts.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
              <span>Accommodation</span>
              <span className="font-semibold">${accommodationCosts.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
              <span>Crew Costs</span>
              <span className="font-semibold">${crewCosts.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm p-3 rounded border border-red-500/20 bg-red-500/5 font-semibold">
              <span>Total Costs</span>
              <span className="text-red-600">${totalCosts.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Profit/Loss */}
        <div className={`rounded-lg border p-4 ${
          isProfitable 
            ? 'border-green-500/20 bg-green-500/5'
            : 'border-red-500/20 bg-red-500/5'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Projected Profit/Loss</span>
            {isProfitable ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold ${
              isProfitable ? 'text-green-600' : 'text-red-600'
            }`}>
              {isProfitable ? '+' : '-'}${Math.abs(projectedProfit).toLocaleString()}
            </span>
            <Badge variant={isProfitable ? 'default' : 'destructive'}>
              {profitMargin.toFixed(1)}% margin
            </Badge>
          </div>
        </div>

        {/* Advisory */}
        {!isProfitable && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              This tour is currently projected to lose money. Consider booking more gigs, 
              adjusting ticket prices, or reducing travel costs.
            </AlertDescription>
          </Alert>
        )}

        {isProfitable && profitMargin < 20 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Profit margin is slim. Tour success depends on good performance and strong attendance.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
