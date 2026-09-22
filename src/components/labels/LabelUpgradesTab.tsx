import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Users,
  Star,
  CheckCircle,
  Lock
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LabelUpgradesTabProps {
  labelId: string;
  labelBalance: number;
}

interface Upgrade {
  id: string;
  type: string;
  name: string;
  description: string;
  cost: number;
  maxLevel: number;
  icon: React.ReactNode;
  effect: string;
}

const AVAILABLE_UPGRADES: Upgrade[] = [
  {
    id: "roster_expansion",
    type: "roster_expansion",
    name: "Roster Expansion",
    description: "Increase your label's roster capacity",
    cost: 250_000,
    maxLevel: 10,
    icon: <Users className="h-5 w-5" />,
    effect: "+3 roster slots per level",
  },
  {
    id: "reputation_boost",
    type: "reputation_boost",
    name: "Reputation Builder",
    description: "Increase your label's reputation score",
    cost: 200_000,
    maxLevel: 10,
    icon: <Star className="h-5 w-5" />,
    effect: "+3 reputation points per level",
  },
];

export function LabelUpgradesTab({ labelId, labelBalance }: LabelUpgradesTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: upgradeState, isLoading } = useQuery({
    queryKey: ["label-upgrade-state", labelId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_label_upgrade_state", {
        p_label_id: labelId,
      });
      if (error) throw error;
      return data as any;
    },
    refetchInterval: 60_000,
  });

  const getUpgradeLevel = (type: string): number =>
    Number(upgradeState?.generic?.[type]?.level ?? 0);

  const getCooldown = (type: string) => {
    const raw = upgradeState?.generic?.[type]?.cooldown_until;
    if (!raw) return { onCooldown: false, label: null as string | null, until: null as Date | null };
    const until = new Date(raw);
    const remaining = Math.max(0, until.getTime() - Date.now());
    if (remaining <= 0) return { onCooldown: false, label: null as string | null, until };
    const days = Math.floor(remaining / 86_400_000);
    const hours = Math.ceil((remaining % 86_400_000) / 3_600_000);
    return { onCooldown: true, label: `${days}d ${hours}h`, until };
  };

  const handlePurchaseUpgrade = async (upgrade: Upgrade) => {
    const currentLevel = getUpgradeLevel(upgrade.type);
    const nextLevel = currentLevel + 1;
    const cost = Math.round(upgrade.cost * (1 + (nextLevel - 1) * 0.65));

    if (labelBalance < cost) {
      toast({
        title: "Insufficient funds",
        description: `This upgrade costs $${cost.toLocaleString()}`,
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await (supabase as any).rpc("purchase_label_upgrade", {
        p_label_id: labelId,
        p_upgrade_type: upgrade.type,
      });
      if (error) throw error;

      toast({
        title: "Upgrade purchased!",
        description: `${upgrade.name} is now level ${data?.new_level ?? nextLevel}`,
      });

      queryClient.invalidateQueries({ queryKey: ["label-upgrade-state", labelId] });
      queryClient.invalidateQueries({ queryKey: ["label-management"] });
      queryClient.invalidateQueries({ queryKey: ["label-finance", labelId] });
      queryClient.invalidateQueries({ queryKey: ["label-transactions", labelId] });
      queryClient.invalidateQueries({ queryKey: ["label-financials", labelId] });
      queryClient.invalidateQueries({ queryKey: ["labels-directory"] });
      queryClient.invalidateQueries({ queryKey: ["my-labels"] });
    } catch (error: any) {
      console.error(error);
      toast({
        title: "Purchase failed",
        description: error?.message || "Could not complete the upgrade purchase",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading upgrades...</div>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {AVAILABLE_UPGRADES.map((upgrade) => {
        const currentLevel = getUpgradeLevel(upgrade.type);
        const isMaxLevel = currentLevel >= upgrade.maxLevel;
        const nextCost = Math.round(upgrade.cost * (1 + currentLevel * 0.65));
        const canAfford = labelBalance >= nextCost;
        const cooldown = getCooldown(upgrade.type);

        return (
          <Card key={upgrade.id} className={cn(isMaxLevel && "opacity-75")}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    {upgrade.icon}
                  </div>
                  <div>
                    <CardTitle className="text-base">{upgrade.name}</CardTitle>
                    <CardDescription className="text-xs">{upgrade.description}</CardDescription>
                  </div>
                </div>
                <Badge variant={isMaxLevel ? "secondary" : "outline"}>
                  {isMaxLevel ? "MAX" : `Lv ${currentLevel}`}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{upgrade.effect}</p>
              
              {/* Progress indicator */}
              <div className="flex gap-1">
                {Array.from({ length: upgrade.maxLevel }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-2 flex-1 rounded-full",
                      i < currentLevel ? "bg-primary" : "bg-muted"
                    )}
                  />
                ))}
              </div>

              {cooldown.onCooldown && !isMaxLevel && (
                <p className="text-xs text-muted-foreground">
                  3-day cooldown active · next upgrade {cooldown.until?.toLocaleString()}
                </p>
              )}

              {isMaxLevel ? (
                <div className="flex items-center gap-2 text-sm text-emerald-500">
                  <CheckCircle className="h-4 w-4" />
                  <span>Fully upgraded</span>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    ${nextCost.toLocaleString()}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => handlePurchaseUpgrade(upgrade)}
                    disabled={!canAfford || cooldown.onCooldown}
                  >
                    {cooldown.onCooldown ? (
                      <>Available in {cooldown.label}</>
                    ) : canAfford ? (
                      "Purchase"
                    ) : (
                      <>
                        <Lock className="h-3 w-3 mr-1" />
                        Insufficient
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}