import { useMemo } from "react";
import { AlertTriangle, Calculator, DollarSign, Gauge } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import type { PricingStrategyState, TicketTier } from "./types";

interface EventPricingStrategyProps {
  strategy: PricingStrategyState;
  onStrategyChange: (strategy: PricingStrategyState) => void;
  ticketTiers: TicketTier[];
  sponsorSupport: number;
  lineupEnergyScore: number;
}

export const EventPricingStrategy = ({
  strategy,
  onStrategyChange,
  ticketTiers,
  sponsorSupport,
  lineupEnergyScore,
}: EventPricingStrategyProps) => {
  const totalCapacity = useMemo(() => ticketTiers.reduce((total, tier) => total + (tier.quantity || 0), 0), [ticketTiers]);
  const projectedRevenue = useMemo(
    () => ticketTiers.reduce((total, tier) => total + tier.price * (tier.quantity || 0), 0),
    [ticketTiers],
  );
  const soldRevenue = useMemo(
    () => ticketTiers.reduce((total, tier) => total + tier.price * (tier.tickets_sold || 0), 0),
    [ticketTiers],
  );

  const recommendedBasePrice = useMemo(() => {
    if (totalCapacity === 0) {
      return strategy.basePrice;
    }

    const breakEvenPerSeat = (strategy.breakEvenCost - sponsorSupport) / Math.max(totalCapacity, 1);
    const demandMultiplier = 1 + Math.min(lineupEnergyScore / 150, 0.35);

    return Math.max(5, Number((breakEvenPerSeat * demandMultiplier).toFixed(2)));
  }, [lineupEnergyScore, sponsorSupport, strategy.basePrice, strategy.breakEvenCost, totalCapacity]);

  const marginProjection = useMemo(() => {
    const totalCosts = strategy.breakEvenCost + strategy.marketingBudget;
    return projectedRevenue + sponsorSupport - totalCosts;
  }, [projectedRevenue, sponsorSupport, strategy.breakEvenCost, strategy.marketingBudget]);

  const handleNumberChange = (key: keyof PricingStrategyState, value: number) => {
    onStrategyChange({ ...strategy, [key]: value });
  };

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl">Pricing Intelligence</CardTitle>
            <CardDescription>
              Balance audience access, premium tiers, and profitability targets with dynamic pricing controls.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-sm">
            <Calculator className="mr-1 h-4 w-4" /> {totalCapacity.toLocaleString()} seat capacity modelled
          </Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase text-muted-foreground">Projected ticket revenue</p>
            <p className="text-lg font-semibold">${projectedRevenue.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase text-muted-foreground">Confirmed sales</p>
            <p className="text-lg font-semibold">${soldRevenue.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase text-muted-foreground">Margin outlook</p>
            <p className={`text-lg font-semibold ${marginProjection >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {marginProjection >= 0 ? "+" : "-"}${Math.abs(marginProjection).toLocaleString()}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-4 rounded-lg border p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="base-price">Base ticket price</Label>
                <Input
                  id="base-price"
                  type="number"
                  min={0}
                  value={strategy.basePrice}
                  onChange={(event) => handleNumberChange("basePrice", Number.parseFloat(event.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="break-even">Break-even cost</Label>
                <Input
                  id="break-even"
                  type="number"
                  min={0}
                  value={strategy.breakEvenCost}
                  onChange={(event) => handleNumberChange("breakEvenCost", Number.parseFloat(event.target.value) || 0)}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="marketing">Marketing budget</Label>
                <Input
                  id="marketing"
                  type="number"
                  min={0}
                  value={strategy.marketingBudget}
                  onChange={(event) => handleNumberChange("marketingBudget", Number.parseFloat(event.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="demand-score">Demand score</Label>
                <Input
                  id="demand-score"
                  type="number"
                  min={0}
                  max={100}
                  value={strategy.demandScore}
                  onChange={(event) => handleNumberChange("demandScore", Number.parseFloat(event.target.value) || 0)}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">Dynamic pricing enabled</p>
                <p className="text-sm text-muted-foreground">
                  React to demand patterns and pacing by adjusting inventory each hour.
                </p>
              </div>
              <Switch
                checked={strategy.dynamicPricing}
                onCheckedChange={(checked) => onStrategyChange({ ...strategy, dynamicPricing: checked })}
              />
            </div>
            <Button
              variant="outline"
              onClick={() =>
                onStrategyChange({
                  ...strategy,
                  basePrice: recommendedBasePrice,
                  lastReviewNote: (
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Gauge className="h-4 w-4" />
                      Adjusted to reflect demand score of {lineupEnergyScore} and sponsor offsets.
                    </span>
                  ),
                })
              }
            >
              Align to recommended base of ${recommendedBasePrice.toLocaleString()}
            </Button>
          </div>
          <div className="space-y-4">
            <div className="rounded-lg border p-4">
              <p className="text-xs uppercase text-muted-foreground">Demand signals</p>
              <p className="text-sm text-muted-foreground">
                Lineup energy score of <span className="font-semibold">{lineupEnergyScore}</span> suggests a
                {" "}
                {lineupEnergyScore >= 75 ? "premium" : lineupEnergyScore >= 50 ? "balanced" : "value-driven"} pricing window.
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs uppercase text-muted-foreground">Sponsor leverage</p>
              <p className="text-sm text-muted-foreground">
                {sponsorSupport > 0
                  ? `Sponsor commitments offset ${(sponsorSupport / Math.max(strategy.breakEvenCost, 1) * 100).toFixed(1)}% of costs.`
                  : "Secure at least one supporting sponsor to reduce base price pressure."}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs uppercase text-muted-foreground">Risk alerts</p>
              <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                {marginProjection < 0 && (
                  <p className="flex items-center gap-2 text-rose-600">
                    <AlertTriangle className="h-4 w-4" /> Pricing plan is {Math.abs(marginProjection).toLocaleString()} below
                    target margin.
                  </p>
                )}
                {strategy.lastReviewNote && <div>{strategy.lastReviewNote}</div>}
                {marginProjection >= 0 && !strategy.lastReviewNote && (
                  <p className="flex items-center gap-2 text-emerald-600">
                    <DollarSign className="h-4 w-4" /> Plan clears margin expectations with current mix.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
