import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ShoppingBag, Calendar, DollarSign, Wrench, TrendingDown } from "lucide-react";
import { useGearMarketplace } from "@/hooks/useGearMarketplace";
import { useGameData } from "@/hooks/useGameData";
import { cn } from "@/lib/utils";

const rarityColors: Record<string, string> = {
  common: "bg-slate-500",
  uncommon: "bg-emerald-500",
  rare: "bg-blue-500",
  epic: "bg-purple-500",
  legendary: "bg-amber-500",
};

export const GearMarketplacePurchases = () => {
  const { profile } = useGameData();
  const userId = profile?.user_id;
  const { myPurchases, isLoading } = useGearMarketplace(userId);

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Loading purchase history...
        </CardContent>
      </Card>
    );
  }

  if (myPurchases.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No purchases yet</p>
          <p className="text-sm">Browse the marketplace to find great deals on used gear!</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate stats
  const totalSpent = myPurchases.reduce((sum, p) => sum + (p.sale_price || 0), 0);
  const totalSaved = myPurchases.reduce((sum, p) => {
    const original = p.listing?.equipment?.base_price || 0;
    return sum + (original - (p.sale_price || 0));
  }, 0);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Total Purchases</span>
            </div>
            <p className="text-2xl font-bold mt-1">{myPurchases.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Total Spent</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(totalSpent)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-emerald-500" />
              <span className="text-sm text-muted-foreground">Total Saved</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-emerald-500">{formatCurrency(totalSaved)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Purchase History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Purchase History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {myPurchases.map((purchase: any) => {
              const equipment = purchase.listing?.equipment;
              const originalPrice = equipment?.base_price || 0;
              const savings = originalPrice - purchase.sale_price;
              const savingsPercent = Math.round((savings / originalPrice) * 100);

              return (
                <div 
                  key={purchase.id}
                  className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{equipment?.name || "Unknown"}</span>
                      <Badge className={cn("text-[10px]", rarityColors[equipment?.rarity?.toLowerCase() || "common"])}>
                        {equipment?.rarity}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(purchase.transaction_date).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Wrench className="h-3 w-3" />
                        {purchase.condition_at_sale}% condition
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(purchase.sale_price)}</p>
                    {savings > 0 && (
                      <p className="text-xs text-emerald-500">
                        Saved {formatCurrency(savings)} ({savingsPercent}%)
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
