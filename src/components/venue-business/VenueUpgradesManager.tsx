import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Wrench, Plus, Check } from "lucide-react";
import { useVenueUpgrades, useInstallVenueUpgrade } from "@/hooks/useVenueBusiness";
import { VENUE_UPGRADE_TYPES } from "@/types/venue-business";
import { formatDistanceToNow } from "date-fns";

interface VenueUpgradesManagerProps {
  venueId: string;
}

export function VenueUpgradesManager({ venueId }: VenueUpgradesManagerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const { data: upgrades, isLoading } = useVenueUpgrades(venueId);
  const installUpgrade = useInstallVenueUpgrade();
  
  const installedTypes = upgrades?.map(u => u.upgrade_type) || [];
  
  const handleInstall = async (upgradeType: string, cost: number) => {
    await installUpgrade.mutateAsync({
      venue_id: venueId,
      upgrade_type: upgradeType,
      upgrade_level: 1,
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
                const isInstalled = installedTypes.includes(upgrade.value);
                return (
                  <div 
                    key={upgrade.value}
                    className={`p-3 rounded-lg border ${isInstalled ? 'bg-muted/50 border-primary/50' : 'hover:border-primary/50'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{upgrade.label}</span>
                          {isInstalled && (
                            <Badge variant="default" className="text-xs">
                              <Check className="h-3 w-3 mr-1" />
                              Installed
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{upgrade.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-warning">${upgrade.baseCost.toLocaleString()}</p>
                        {!isInstalled && (
                          <Button 
                            size="sm" 
                            className="mt-1"
                            onClick={() => handleInstall(upgrade.value, upgrade.baseCost)}
                            disabled={installUpgrade.isPending}
                          >
                            Install
                          </Button>
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
            {upgrades?.map((upgrade) => {
              const typeInfo = VENUE_UPGRADE_TYPES.find(t => t.value === upgrade.upgrade_type);
              return (
                <div 
                  key={upgrade.id}
                  className="p-3 rounded-lg border bg-primary/5 border-primary/20"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{typeInfo?.label || upgrade.upgrade_type}</p>
                      <p className="text-xs text-muted-foreground">
                        Installed {formatDistanceToNow(new Date(upgrade.installed_at), { addSuffix: true })}
                      </p>
                    </div>
                    <Badge>Level {upgrade.upgrade_level}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
