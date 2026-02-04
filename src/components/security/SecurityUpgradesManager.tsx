import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Shield, ArrowUp, DollarSign, Zap, Lock, Check } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SecurityUpgradesManagerProps {
  firmId: string;
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
    type: 'basic_training',
    name: 'Basic Training',
    description: 'Improve overall guard effectiveness',
    icon: '🎓',
    maxLevel: 5,
    baseCost: 10000,
    baseEffect: 5,
    effectLabel: '% Guard Effectiveness',
  },
  {
    type: 'crowd_control',
    name: 'Crowd Control',
    description: 'Better handling of large venue crowds',
    icon: '👥',
    maxLevel: 5,
    baseCost: 25000,
    baseEffect: 10,
    effectLabel: '% Large Venue Capability',
  },
  {
    type: 'vip_protection',
    name: 'VIP Protection',
    description: 'Unlock celebrity and artist protection contracts',
    icon: '⭐',
    maxLevel: 3,
    baseCost: 50000,
    baseEffect: 15,
    effectLabel: '% VIP Protection Quality',
  },
  {
    type: 'emergency_response',
    name: 'Emergency Response',
    description: 'Reduce incident penalties and response time',
    icon: '🚨',
    maxLevel: 5,
    baseCost: 35000,
    baseEffect: 5,
    effectLabel: '% Incident Penalty Reduction',
  },
  {
    type: 'equipment',
    name: 'Equipment Upgrade',
    description: 'Better radios, protective gear, and tools',
    icon: '🛡️',
    maxLevel: 5,
    baseCost: 20000,
    baseEffect: 4,
    effectLabel: '% Equipment Quality',
  },
];

export function SecurityUpgradesManager({ firmId, companyBalance = 0 }: SecurityUpgradesManagerProps) {
  const [selectedUpgrade, setSelectedUpgrade] = useState<UpgradeType | null>(null);
  const queryClient = useQueryClient();

  const { data: upgrades, isLoading } = useQuery({
    queryKey: ['security-firm-upgrades', firmId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('security_firm_upgrades')
        .select('*')
        .eq('security_firm_id', firmId);

      if (error) throw error;
      return data;
    },
    enabled: !!firmId,
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

      // Insert or update upgrade
      const { error } = await supabase
        .from('security_firm_upgrades')
        .upsert({
          security_firm_id: firmId,
          upgrade_type: upgradeType.type,
          name: upgradeType.name,
          level: newLevel,
          cost: cost,
          effect_value: effect,
          effect_description: `+${effect}${upgradeType.effectLabel}`,
        }, {
          onConflict: 'security_firm_id,upgrade_type',
        });

      if (error) throw error;
      return { cost, newLevel };
    },
    onSuccess: (data) => {
      toast.success(`Upgrade installed! Level ${data.newLevel}`);
      queryClient.invalidateQueries({ queryKey: ['security-firm-upgrades', firmId] });
      queryClient.invalidateQueries({ queryKey: ['security-firm-quality-modifier', firmId] });
      setSelectedUpgrade(null);
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
          <Shield className="h-5 w-5" />
          Firm Upgrades
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
                          onClick={() => setSelectedUpgrade(upgrade)}
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
                            onClick={() => upgrade && installUpgradeMutation.mutate(upgrade)}
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
