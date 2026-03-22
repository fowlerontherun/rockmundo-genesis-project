import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, Check, ArrowUp } from "lucide-react";
import { useLogisticsUpgrades, usePurchaseLogisticsUpgrade } from "@/hooks/useLogisticsBusiness";
import { LOGISTICS_UPGRADE_TYPES } from "@/types/logistics-business";
import { toast } from "sonner";

interface LogisticsUpgradesManagerProps {
  logisticsCompanyId: string;
}

const MAX_LEVEL = 20;

function getUpgradeCost(baseCost: number, level: number): number {
  return Math.round(baseCost * Math.pow(1.5, level - 1));
}

export function LogisticsUpgradesManager({ logisticsCompanyId }: LogisticsUpgradesManagerProps) {
  const { data: upgrades = [], isLoading } = useLogisticsUpgrades(logisticsCompanyId);
  const purchaseUpgrade = usePurchaseLogisticsUpgrade();

  const getUpgradeLevel = (upgradeType: string) => {
    const matching = upgrades.filter(u => u.upgrade_type === upgradeType && u.active);
    return matching.length > 0 ? Math.max(...matching.map(u => u.upgrade_level || 1)) : 0;
  };

  const handlePurchaseUpgrade = async (upgradeType: string, baseCost: number) => {
    const currentLevel = getUpgradeLevel(upgradeType);
    const nextLevel = currentLevel + 1;
    if (nextLevel > MAX_LEVEL) return;
    
    const cost = getUpgradeCost(baseCost, nextLevel);
    try {
      await purchaseUpgrade.mutateAsync({
        logistics_company_id: logisticsCompanyId,
        upgrade_type: upgradeType as any,
        upgrade_level: nextLevel,
        cost,
        active: true,
      });
      toast.success(`Upgrade to level ${nextLevel}!`);
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
          Enhance your logistics capabilities (up to level {MAX_LEVEL})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {LOGISTICS_UPGRADE_TYPES.map((upgrade) => {
            const currentLevel = getUpgradeLevel(upgrade.value);
            const isMaxed = currentLevel >= MAX_LEVEL;
            const nextCost = isMaxed ? 0 : getUpgradeCost(upgrade.baseCost, currentLevel + 1);
            return (
              <div
                key={upgrade.value}
                className={`p-4 rounded-lg border ${
                  isMaxed 
                    ? 'bg-success/5 border-success/30' 
                    : currentLevel > 0
                      ? 'bg-primary/5 border-primary/30'
                      : 'bg-card hover:border-primary/50'
                } transition-colors`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-medium flex items-center gap-2">
                      {upgrade.label}
                      {isMaxed && (
                        <Check className="h-4 w-4 text-success" />
                      )}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {upgrade.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <Badge variant="outline">
                    Level {currentLevel}/{MAX_LEVEL}
                  </Badge>
                  {isMaxed ? (
                    <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                      <Check className="h-3 w-3 mr-1" />
                      MAX
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePurchaseUpgrade(upgrade.value, upgrade.baseCost)}
                      disabled={purchaseUpgrade.isPending}
                    >
                      <ArrowUp className="h-4 w-4 mr-1" />
                      ${nextCost.toLocaleString()}
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
