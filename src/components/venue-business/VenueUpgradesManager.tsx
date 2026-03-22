import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Wrench, Plus, ArrowUp, Check } from "lucide-react";
import { useVenueUpgrades, useInstallVenueUpgrade } from "@/hooks/useVenueBusiness";
import { VENUE_UPGRADE_TYPES } from "@/types/venue-business";
import { formatDistanceToNow } from "date-fns";

interface VenueUpgradesManagerProps {
  venueId: string;
}

function getUpgradeCost(baseCost: number, level: number): number {
  return Math.round(baseCost * Math.pow(1.5, level - 1));
}

export function VenueUpgradesManager({ venueId }: VenueUpgradesManagerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const { data: upgrades, isLoading } = useVenueUpgrades(venueId);
  const installUpgrade = useInstallVenueUpgrade();
  
  const getUpgradeLevel = (upgradeType: string) => {
    const matching = upgrades?.filter(u => u.upgrade_type === upgradeType) || [];
    return matching.length > 0 ? Math.max(...matching.map(u => u.upgrade_level)) : 0;
  };
  
  const handleInstall = async (upgradeType: string, baseCost: number, maxLevel: number) => {
    const currentLevel = getUpgradeLevel(upgradeType);
    const nextLevel = currentLevel + 1;
    if (nextLevel > maxLevel) return;
    
    const cost = getUpgradeCost(baseCost, nextLevel);
    await installUpgrade.mutateAsync({
      venue_id: venueId,
      upgrade_type: upgradeType,
      upgrade_level: nextLevel,
      cost: cost,
    });
    setDialogOpen(false);
  };
  
  if (isLoading) {
    return <div className="text-center py-4">Loading upgrades...</div>;
  }
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          Venue Upgrades
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Install Upgrade
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Available Upgrades</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {VENUE_UPGRADE_TYPES.map((upgrade) => {
                const currentLevel = getUpgradeLevel(upgrade.value);
                const nextLevel = currentLevel + 1;
                const isMaxed = nextLevel > upgrade.maxLevel;
                const cost = isMaxed ? 0 : getUpgradeCost(upgrade.baseCost, nextLevel);
                return (
                  <div 
                    key={upgrade.value}
                    className={`p-3 rounded-lg border ${isMaxed ? 'bg-muted/50 opacity-50' : 'hover:border-primary/50'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{upgrade.label}</span>
                          {isMaxed && (
                            <Badge variant="default" className="text-xs">
                              <Check className="h-3 w-3 mr-1" />
                              MAX
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{upgrade.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">Level {currentLevel}/{upgrade.maxLevel}</p>
                      </div>
                      <div className="text-right">
                        {!isMaxed && (
                          <>
                            <p className="font-bold text-warning">${cost.toLocaleString()}</p>
                            <Button 
                              size="sm" 
                              className="mt-1"
                              onClick={() => handleInstall(upgrade.value, upgrade.baseCost, upgrade.maxLevel)}
                              disabled={installUpgrade.isPending}
                            >
                              <ArrowUp className="h-4 w-4 mr-1" />
                              Lvl {nextLevel}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {upgrades?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Wrench className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No upgrades installed</p>
            <p className="text-sm">Improve your venue to attract better acts</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {VENUE_UPGRADE_TYPES.map((upgradeType) => {
              const currentLevel = getUpgradeLevel(upgradeType.value);
              if (currentLevel === 0) return null;
              return (
                <div 
                  key={upgradeType.value}
                  className="p-3 rounded-lg border bg-primary/5 border-primary/20"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{upgradeType.label}</p>
                      <p className="text-xs text-muted-foreground">
                        +{currentLevel * 5}% Quality
                      </p>
                    </div>
                    <Badge>Level {currentLevel}</Badge>
                  </div>
                </div>
              );
            }).filter(Boolean)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
