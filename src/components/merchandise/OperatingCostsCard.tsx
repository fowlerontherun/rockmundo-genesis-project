import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Warehouse, Truck, Receipt, Calculator } from "lucide-react";

interface OperatingCostsCardProps {
  totalStock: number;
  storageCostDaily: number;
  logisticsRate: number;
  taxRate: number;
  totalRevenue: number;
}

const fmt = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

export const OperatingCostsCard = ({
  totalStock,
  storageCostDaily,
  logisticsRate,
  taxRate,
  totalRevenue,
}: OperatingCostsCardProps) => {
  const dailyStorage = totalStock * storageCostDaily;
  const monthlyStorage = dailyStorage * 30;
  const estimatedLogistics = totalRevenue * logisticsRate;
  const estimatedTax = totalRevenue * taxRate;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          Operating Costs
        </CardTitle>
        <CardDescription className="text-xs">Estimated monthly expenses</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Warehouse className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Storage</span>
          </div>
          <div className="text-right">
            <p className="font-medium">{fmt(monthlyStorage)}/mo</p>
            <p className="text-xs text-muted-foreground">${storageCostDaily}/unit/day × {totalStock} units</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Truck className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Logistics</span>
          </div>
          <div className="text-right">
            <p className="font-medium">{fmt(estimatedLogistics)}</p>
            <p className="text-xs text-muted-foreground">{(logisticsRate * 100).toFixed(0)}% of revenue</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Tax</span>
          </div>
          <div className="text-right">
            <p className="font-medium">{fmt(estimatedTax)}</p>
            <p className="text-xs text-muted-foreground">{(taxRate * 100).toFixed(0)}% of revenue</p>
          </div>
        </div>

        <div className="border-t pt-2 flex items-center justify-between text-sm font-semibold">
          <span>Total Est. Monthly</span>
          <span className="text-destructive">{fmt(monthlyStorage + estimatedLogistics + estimatedTax)}</span>
        </div>
      </CardContent>
    </Card>
  );
};
