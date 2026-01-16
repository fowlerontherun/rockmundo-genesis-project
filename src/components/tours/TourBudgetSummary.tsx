import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { TourCostEstimate, TOUR_MERCH_BOOST, STAGE_SETUP_TIERS, StageSetupTier } from '@/lib/tourTypes';
import { DollarSign, TrendingUp, TrendingDown, ShoppingBag, Ticket, Bus, Sparkles, Users, HandCoins } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TourBudgetSummaryProps {
  estimate: TourCostEstimate;
  stageSetupTier: StageSetupTier;
  supportBandName: string | null;
  supportRevenueShare: number;
  sponsorName: string | null;
  sponsorCash: number;
  bandBalance: number;
}

export function TourBudgetSummary({
  estimate,
  stageSetupTier,
  supportBandName,
  supportRevenueShare,
  sponsorName,
  sponsorCash,
  bandBalance,
}: TourBudgetSummaryProps) {
  const canAfford = bandBalance >= estimate.netUpfrontCost;
  const tier = STAGE_SETUP_TIERS[stageSetupTier];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Expenses Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-red-500" />
            Expenses
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Booking Fees</span>
            <span>${estimate.bookingFees.toLocaleString()}</span>
          </div>
          
          {estimate.stageSetupCosts > 0 && (
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                Stage Setup ({tier.label})
              </span>
              <span>${estimate.stageSetupCosts.toLocaleString()}</span>
            </div>
          )}
          
          {estimate.tourBusCosts > 0 && (
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Bus className="h-3 w-3" />
                Tour Bus
              </span>
              <span>${estimate.tourBusCosts.toLocaleString()}</span>
            </div>
          )}
          
          {estimate.travelCosts > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Travel Costs</span>
              <span>${estimate.travelCosts.toLocaleString()}</span>
            </div>
          )}
          
          <Separator />
          
          <div className="flex justify-between font-medium">
            <span>Total Expenses</span>
            <span>${estimate.totalUpfrontCost.toLocaleString()}</span>
          </div>
          
          {sponsorCash > 0 && (
            <>
              <div className="flex justify-between text-sm text-green-600">
                <span className="flex items-center gap-1">
                  <HandCoins className="h-3 w-3" />
                  Sponsor: {sponsorName}
                </span>
                <span>-${sponsorCash.toLocaleString()}</span>
              </div>
              
              <Separator />
              
              <div className="flex justify-between font-bold text-lg">
                <span>Net Upfront Cost</span>
                <span>${estimate.netUpfrontCost.toLocaleString()}</span>
              </div>
            </>
          )}
          
          {!sponsorCash && (
            <div className="flex justify-between font-bold text-lg">
              <span>Net Upfront Cost</span>
              <span>${estimate.netUpfrontCost.toLocaleString()}</span>
            </div>
          )}
          
          <div className={cn(
            "flex justify-between text-sm p-2 rounded",
            canAfford ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"
          )}>
            <span>Band Balance</span>
            <span>${bandBalance.toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>
      
      {/* Revenue Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            Projected Revenue
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Ticket className="h-3 w-3" />
              Ticket Sales
            </span>
            <span className="text-green-600">${estimate.estimatedTicketRevenue.toLocaleString()}</span>
          </div>
          
          {supportBandName && estimate.supportArtistShare > 0 && (
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Users className="h-3 w-3" />
                Support: {supportBandName} ({Math.round(supportRevenueShare * 100)}%)
              </span>
              <span className="text-red-500">-${estimate.supportArtistShare.toLocaleString()}</span>
            </div>
          )}
          
          <div className="flex justify-between text-sm">
            <span className="flex items-center gap-1 text-muted-foreground">
              <ShoppingBag className="h-3 w-3" />
              Merch Sales
              <Badge variant="outline" className="text-xs ml-1">
                +{Math.round((TOUR_MERCH_BOOST - 1) * 100)}% tour boost
              </Badge>
            </span>
            <span className="text-green-600">${estimate.estimatedMerchRevenue.toLocaleString()}</span>
          </div>
          
          {tier.merchBoost > 1 && (
            <p className="text-xs text-muted-foreground pl-4">
              +{Math.round((tier.merchBoost - 1) * 100)}% from {tier.label} stage
            </p>
          )}
          
          <Separator />
          
          <div className="flex justify-between font-medium text-green-600">
            <span>Total Revenue</span>
            <span>${estimate.estimatedRevenue.toLocaleString()}</span>
          </div>
          
          <Separator />
          
          <div className={cn(
            "flex justify-between font-bold text-lg p-2 rounded",
            estimate.estimatedProfit >= 0 ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"
          )}>
            <span>Estimated Profit</span>
            <span>
              {estimate.estimatedProfit >= 0 ? '+' : ''}
              ${estimate.estimatedProfit.toLocaleString()}
            </span>
          </div>
          
          <p className="text-xs text-muted-foreground text-center">
            {estimate.showCount} shows • Revenue depends on ticket sales
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
