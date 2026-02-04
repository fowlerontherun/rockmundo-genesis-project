import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Factory, ArrowUp, Lock, Zap, Check } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FactoryUpgradesManagerProps {
  factoryId: string;
  companyBalance?: number;
}

interface UpgradeType {
  type: string;
  name: string;
  description: string;
  icon: string;
  maxLevel: number;
  baseCost: number;
  baseEffect: number;
  effectLabel: string;
}

const UPGRADE_TYPES: UpgradeType[] = [
  {
    type: 'print_quality',
    name: 'Print Quality',
    description: 'Higher quality prints and materials',
    icon: '🖨️',
    maxLevel: 5,
    baseCost: 15000,
    baseEffect: 10,
    effectLabel: '% Merchandise Quality',
  },
  {
    type: 'speed_lines',
    name: 'Speed Lines',
    description: 'Faster production capacity',
    icon: '⚡',
    maxLevel: 5,
    baseCost: 30000,
    baseEffect: 25,
    effectLabel: '% Production Speed',
  },
  {
    type: 'custom_packaging',
    name: 'Custom Packaging',
    description: 'Premium packaging options',
    icon: '📦',
    maxLevel: 3,
    baseCost: 20000,
    baseEffect: 5,
    effectLabel: '% Sale Price Bonus',
  },
  {
    type: 'eco_materials',
    name: 'Eco-Friendly Materials',
    description: 'Sustainable production options',
    icon: '🌱',
    maxLevel: 3,
    baseCost: 25000,
    baseEffect: 10,
    effectLabel: '% Eco-Fan Appeal',
  },
  {
    type: 'design_studio',
    name: 'Design Studio',
    description: 'In-house custom design capability',
    icon: '🎨',
    maxLevel: 3,
    baseCost: 40000,
    baseEffect: 15,
    effectLabel: '% Design Options',
  },
];

export function FactoryUpgradesManager({ factoryId, companyBalance = 0 }: FactoryUpgradesManagerProps) {
  const queryClient = useQueryClient();

  const { data: upgrades, isLoading } = useQuery({
    queryKey: ['merch-factory-upgrades', factoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('merch_factory_upgrades')
        .select('*')
        .eq('merch_factory_id', factoryId);

      if (error) throw error;
      return data;
    },
    enabled: !!factoryId,
  });

  const installUpgradeMutation = useMutation({
    mutationFn: async (upgradeType: UpgradeType) => {
      const currentLevel = upgrades?.find(u => u.upgrade_type === upgradeType.type)?.level || 0;
      const newLevel = currentLevel + 1;
      const cost = upgradeType.baseCost * newLevel;
      const effect = upgradeType.baseEffect * newLevel;

      if (currentLevel >= upgradeType.maxLevel) {
        throw new Error('Maximum level reached');
      }

      const { error } = await supabase
        .from('merch_factory_upgrades')
        .upsert({
          merch_factory_id: factoryId,
          upgrade_type: upgradeType.type,
          name: upgradeType.name,
          level: newLevel,
          cost: cost,
          effect_value: effect,
          effect_description: `+${effect}${upgradeType.effectLabel}`,
        }, {
          onConflict: 'merch_factory_id,upgrade_type',
        });

      if (error) throw error;
      return { cost, newLevel };
    },
    onSuccess: (data) => {
      toast.success(`Upgrade installed! Level ${data.newLevel}`);
      queryClient.invalidateQueries({ queryKey: ['merch-factory-upgrades', factoryId] });
      queryClient.invalidateQueries({ queryKey: ['merch-factory-quality-modifier', factoryId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed: ${error.message}`);
    },
  });

  const getUpgradeLevel = (type: string) => {
    return upgrades?.find(u => u.upgrade_type === type)?.level || 0;
  };

  const getUpgradeCost = (upgrade: UpgradeType) => {
    const currentLevel = getUpgradeLevel(upgrade.type);
    return upgrade.baseCost * (currentLevel + 1);
  };

  const canAfford = (upgrade: UpgradeType) => {
    return companyBalance >= getUpgradeCost(upgrade);
  };

  const isMaxLevel = (upgrade: UpgradeType) => {
    return getUpgradeLevel(upgrade.type) >= upgrade.maxLevel;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Factory className="h-5 w-5" />
          Factory Upgrades
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">Loading upgrades...</div>
        ) : (
          <div className="grid gap-3">
            {UPGRADE_TYPES.map((upgrade) => {
              const currentLevel = getUpgradeLevel(upgrade.type);
              const cost = getUpgradeCost(upgrade);
              const affordable = canAfford(upgrade);
              const maxed = isMaxLevel(upgrade);

              return (
                <div
                  key={upgrade.type}
                  className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                    maxed ? 'bg-green-500/10 border-green-500/20' : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{upgrade.icon}</span>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {upgrade.name}
                        {maxed && (
                          <Badge variant="outline" className="text-green-500 border-green-500">
                            <Check className="h-3 w-3 mr-1" />
                            MAX
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">{upgrade.description}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm font-medium">Level {currentLevel}/{upgrade.maxLevel}</div>
                      <Progress value={(currentLevel / upgrade.maxLevel) * 100} className="h-1.5 w-20" />
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          size="sm" 
                          variant={maxed ? "ghost" : "default"}
                          disabled={maxed}
                        >
                          {maxed ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <>
                              <ArrowUp className="h-4 w-4 mr-1" />
                              ${cost.toLocaleString()}
                            </>
                          )}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <span className="text-2xl">{upgrade.icon}</span>
                            Upgrade {upgrade.name}
                          </DialogTitle>
                          <DialogDescription>
                            {upgrade.description}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                            <div>
                              <div className="text-sm text-muted-foreground">Current Level</div>
                              <div className="font-bold text-lg">{currentLevel}</div>
                            </div>
                            <ArrowUp className="h-6 w-6 text-primary" />
                            <div>
                              <div className="text-sm text-muted-foreground">New Level</div>
                              <div className="font-bold text-lg text-primary">{currentLevel + 1}</div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Effect Bonus:</span>
                              <span className="text-green-500">+{upgrade.baseEffect}{upgrade.effectLabel}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Upgrade Cost:</span>
                              <span className="font-bold">${cost.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Company Balance:</span>
                              <span className={affordable ? 'text-green-500' : 'text-destructive'}>
                                ${companyBalance.toLocaleString()}
                              </span>
                            </div>
                          </div>

                          <Button
                            onClick={() => installUpgradeMutation.mutate(upgrade)}
                            disabled={!affordable || installUpgradeMutation.isPending}
                            className="w-full"
                          >
                            {!affordable ? (
                              <>
                                <Lock className="h-4 w-4 mr-2" />
                                Insufficient Funds
                              </>
                            ) : installUpgradeMutation.isPending ? (
                              'Installing...'
                            ) : (
                              <>
                                <Zap className="h-4 w-4 mr-2" />
                                Install Upgrade
                              </>
                            )}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
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
