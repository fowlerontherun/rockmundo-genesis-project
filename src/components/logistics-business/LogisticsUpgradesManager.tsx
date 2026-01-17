import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, Check, Lock } from "lucide-react";
import { useLogisticsUpgrades, usePurchaseLogisticsUpgrade } from "@/hooks/useLogisticsBusiness";
import { LOGISTICS_UPGRADE_TYPES } from "@/types/logistics-business";
import { toast } from "sonner";

interface LogisticsUpgradesManagerProps {
  logisticsCompanyId: string;
}

export function LogisticsUpgradesManager({ logisticsCompanyId }: LogisticsUpgradesManagerProps) {
  const { data: upgrades = [], isLoading } = useLogisticsUpgrades(logisticsCompanyId);
  const purchaseUpgrade = usePurchaseLogisticsUpgrade();

  const purchasedUpgradeTypes = new Set(upgrades.filter(u => u.active).map(u => u.upgrade_type));

  const handlePurchaseUpgrade = async (upgradeType: string, cost: number) => {
    try {
      await purchaseUpgrade.mutateAsync({
        logistics_company_id: logisticsCompanyId,
        upgrade_type: upgradeType as any,
        upgrade_level: 1,
        cost,
        active: true,
      });
      toast.success("Upgrade purchased!");
    } catch (error) {
      toast.error("Failed to purchase upgrade");
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading upgrades...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Company Upgrades
        </CardTitle>
        <CardDescription>
          Enhance your logistics capabilities
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {LOGISTICS_UPGRADE_TYPES.map((upgrade) => {
            const isPurchased = purchasedUpgradeTypes.has(upgrade.value);
            return (
              <div
                key={upgrade.value}
                className={`p-4 rounded-lg border ${
                  isPurchased 
                    ? 'bg-success/5 border-success/30' 
                    : 'bg-card hover:border-primary/50'
                } transition-colors`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-medium flex items-center gap-2">
                      {upgrade.label}
                      {isPurchased && (
                        <Check className="h-4 w-4 text-success" />
                      )}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {upgrade.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-sm font-semibold">
                    ${upgrade.baseCost.toLocaleString()}
                  </span>
                  {isPurchased ? (
                    <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                      <Check className="h-3 w-3 mr-1" />
                      Owned
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePurchaseUpgrade(upgrade.value, upgrade.baseCost)}
                      disabled={purchaseUpgrade.isPending}
                    >
                      Purchase
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
