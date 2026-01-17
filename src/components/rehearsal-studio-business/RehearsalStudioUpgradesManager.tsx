import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sparkles, Plus, ArrowUp } from "lucide-react";
import { useRehearsalRoomUpgrades, useInstallRehearsalUpgrade } from "@/hooks/useRehearsalStudioBusiness";
import { UPGRADE_TYPES } from "@/types/rehearsal-studio-business";

interface RehearsalStudioUpgradesManagerProps {
  roomId: string;
}

const UPGRADE_COSTS: Record<string, number[]> = {
  soundproofing: [5000, 10000, 20000, 40000, 80000],
  equipment: [3000, 6000, 12000, 25000, 50000],
  recording_gear: [8000, 15000, 30000, 60000, 120000],
  climate_control: [2000, 4000, 8000, 15000, 30000],
  lounge_area: [2500, 5000, 10000, 20000, 40000],
  storage: [1500, 3000, 6000, 12000, 24000],
  lighting: [3000, 6000, 12000, 25000, 50000],
};

export function RehearsalStudioUpgradesManager({ roomId }: RehearsalStudioUpgradesManagerProps) {
  const { data: upgrades, isLoading } = useRehearsalRoomUpgrades(roomId);
  const installUpgrade = useInstallRehearsalUpgrade();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const getUpgradeLevel = (upgradeType: string) => {
    const existing = upgrades?.filter(u => u.upgrade_type === upgradeType) || [];
    return existing.length > 0 ? Math.max(...existing.map(u => u.level)) : 0;
  };

  const handleInstall = async (upgradeType: string) => {
    const currentLevel = getUpgradeLevel(upgradeType);
    const nextLevel = currentLevel + 1;
    if (nextLevel > 5) return;

    const cost = UPGRADE_COSTS[upgradeType][nextLevel - 1];
    const upgradeInfo = UPGRADE_TYPES.find(t => t.value === upgradeType);

    await installUpgrade.mutateAsync({
      room_id: roomId,
      upgrade_type: upgradeType as any,
      name: `${upgradeInfo?.label} Level ${nextLevel}`,
      level: nextLevel,
      cost,
      effect_value: nextLevel * 10,
      effect_description: `Improves ${upgradeInfo?.label?.toLowerCase()} quality by ${nextLevel * 10}%`,
    });
    setIsDialogOpen(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Studio Upgrades
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
              <div className="grid gap-3 max-h-[60vh] overflow-y-auto">
                {UPGRADE_TYPES.map((type) => {
                  const currentLevel = getUpgradeLevel(type.value);
                  const nextLevel = currentLevel + 1;
                  const isMaxed = nextLevel > 5;
                  const cost = isMaxed ? 0 : UPGRADE_COSTS[type.value][nextLevel - 1];

                  return (
                    <div
                      key={type.value}
                      className={`p-4 border rounded-lg ${isMaxed ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{type.icon}</span>
                          <div>
                            <div className="font-medium">{type.label}</div>
                            <div className="text-sm text-muted-foreground">
                              Current: Level {currentLevel} / {type.maxLevel}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Level indicators */}
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((lvl) => (
                              <div
                                key={lvl}
                                className={`w-2 h-4 rounded-sm ${
                                  lvl <= currentLevel
                                    ? 'bg-primary'
                                    : 'bg-muted'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      {!isMaxed && (
                        <Button
                          className="w-full mt-3"
                          variant="outline"
                          onClick={() => handleInstall(type.value)}
                          disabled={installUpgrade.isPending}
                        >
                          <ArrowUp className="h-4 w-4 mr-2" />
                          Upgrade to Level {nextLevel} - ${cost.toLocaleString()}
                        </Button>
                      )}
                      {isMaxed && (
                        <Badge className="w-full justify-center mt-3" variant="secondary">
                          Max Level Reached
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">Loading upgrades...</div>
        ) : upgrades && upgrades.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {UPGRADE_TYPES.map((type) => {
              const currentLevel = getUpgradeLevel(type.value);
              if (currentLevel === 0) return null;

              return (
                <div
                  key={type.value}
                  className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{type.icon}</span>
                    <div>
                      <div className="font-medium text-sm">{type.label}</div>
                      <div className="text-xs text-muted-foreground">
                        +{currentLevel * 10}% Quality
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline">Lvl {currentLevel}</Badge>
                </div>
              );
            }).filter(Boolean)}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No upgrades installed</p>
            <p className="text-sm">Install upgrades to improve your studio</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
