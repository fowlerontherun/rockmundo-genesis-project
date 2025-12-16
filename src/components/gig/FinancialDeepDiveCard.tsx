import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Ticket, 
  ShoppingBag, 
  Users, 
  Wrench,
  Building,
  Percent
} from "lucide-react";

interface FinancialDeepDiveCardProps {
  ticketRevenue: number;
  merchRevenue: number;
  totalRevenue: number;
  crewCosts: number;
  equipmentWearCost: number;
  netProfit: number;
  actualAttendance: number;
  ticketPrice: number;
  merchItemsSold: number;
}

export const FinancialDeepDiveCard = ({
  ticketRevenue,
  merchRevenue,
  totalRevenue,
  crewCosts,
  equipmentWearCost,
  netProfit,
  actualAttendance,
  ticketPrice,
  merchItemsSold,
}: FinancialDeepDiveCardProps) => {
  const totalCosts = crewCosts + equipmentWearCost;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const revenuePerHead = actualAttendance > 0 ? totalRevenue / actualAttendance : 0;
  const ticketRevenuePercent = totalRevenue > 0 ? (ticketRevenue / totalRevenue) * 100 : 0;
  const merchRevenuePercent = totalRevenue > 0 ? (merchRevenue / totalRevenue) * 100 : 0;
  const avgMerchPerAttendee = actualAttendance > 0 ? merchRevenue / actualAttendance : 0;

  const getProfitabilityStatus = () => {
    if (profitMargin >= 50) return { label: 'Highly Profitable', color: 'text-green-500', bg: 'bg-green-500/20' };
    if (profitMargin >= 30) return { label: 'Profitable', color: 'text-green-400', bg: 'bg-green-500/10' };
    if (profitMargin >= 10) return { label: 'Modest Profit', color: 'text-yellow-500', bg: 'bg-yellow-500/10' };
    if (profitMargin >= 0) return { label: 'Break Even', color: 'text-orange-500', bg: 'bg-orange-500/10' };
    return { label: 'Loss', color: 'text-red-500', bg: 'bg-red-500/10' };
  };

  const profitStatus = getProfitabilityStatus();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Financial Deep Dive
          </div>
          <Badge className={profitStatus.bg + ' ' + profitStatus.color}>
            {profitStatus.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Revenue Breakdown */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            Revenue Sources
          </h4>
          
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-blue-500" />
                  <span>Ticket Sales (Band Share)</span>
                </div>
                <span className="font-semibold">{formatCurrency(ticketRevenue)}</span>
              </div>
              <Progress value={ticketRevenuePercent} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{actualAttendance} × ${ticketPrice} × 50%</span>
                <span>{ticketRevenuePercent.toFixed(1)}% of revenue</span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-purple-500" />
                  <span>Merchandise Sales</span>
                </div>
                <span className="font-semibold">{formatCurrency(merchRevenue)}</span>
              </div>
              <Progress value={merchRevenuePercent} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{merchItemsSold} items sold</span>
                <span>{merchRevenuePercent.toFixed(1)}% of revenue</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-border/50">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Total Revenue</span>
              <span className="text-lg font-bold text-green-500">{formatCurrency(totalRevenue)}</span>
            </div>
          </div>
        </div>

        {/* Costs Breakdown */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-red-500" />
            Costs & Expenses
          </h4>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-orange-500" />
                <span>Crew Costs</span>
              </div>
              <span className="text-red-500">-{formatCurrency(crewCosts)}</span>
            </div>
            
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-gray-500" />
                <span>Equipment Wear</span>
              </div>
              <span className="text-red-500">-{formatCurrency(equipmentWearCost)}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-border/50">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Total Costs</span>
              <span className="text-lg font-bold text-red-500">-{formatCurrency(totalCosts)}</span>
            </div>
          </div>
        </div>

        {/* Net Profit */}
        <div className="p-4 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">Net Profit</p>
              <p className={`text-3xl font-bold ${netProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {formatCurrency(netProfit)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Profit Margin</p>
              <p className={`text-2xl font-bold ${profitMargin >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {profitMargin.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        {/* Per-Attendee Metrics */}
        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border/50">
          <div className="text-center space-y-1">
            <div className="flex items-center justify-center gap-1">
              <Percent className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-lg font-bold">{formatCurrency(revenuePerHead)}</p>
            <p className="text-xs text-muted-foreground">Revenue per Head</p>
          </div>
          <div className="text-center space-y-1">
            <div className="flex items-center justify-center gap-1">
              <ShoppingBag className="w-4 h-4 text-purple-500" />
            </div>
            <p className="text-lg font-bold">{formatCurrency(avgMerchPerAttendee)}</p>
            <p className="text-xs text-muted-foreground">Merch per Attendee</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
