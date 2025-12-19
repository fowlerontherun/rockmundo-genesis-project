import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { 
  Users, 
  Megaphone, 
  Star, 
  Music, 
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
    maxLevel: 5,
    icon: <Users className="h-5 w-5" />,
    effect: "+5 roster slots per level",
  },
  {
    id: "marketing_boost",
    type: "marketing_boost",
    name: "Marketing Power",
    description: "Boost your marketing campaign effectiveness",
    cost: 150_000,
    maxLevel: 5,
    icon: <Megaphone className="h-5 w-5" />,
    effect: "+10% marketing effectiveness per level",
  },
  {
    id: "reputation_boost",
    type: "reputation_boost",
    name: "Reputation Builder",
    description: "Increase your label's reputation score",
    cost: 200_000,
    maxLevel: 5,
    icon: <Star className="h-5 w-5" />,
    effect: "+5 reputation points per level",
  },
  {
    id: "studio_discount",
    type: "studio_discount",
    name: "Studio Partnership",
    description: "Get discounts on recording sessions",
    cost: 500_000,
    maxLevel: 3,
    icon: <Music className="h-5 w-5" />,
    effect: "10% recording cost reduction per level",
  },
];

export function LabelUpgradesTab({ labelId, labelBalance }: LabelUpgradesTabProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch current upgrades
  const { data: upgrades = [], isLoading } = useQuery({
    queryKey: ["label-upgrades", labelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("label_upgrades")
        .select("*")
        .eq("label_id", labelId);

      if (error) throw error;
      return data;
    },
  });

  // Fetch profile ID
  const { data: profile } = useQuery({
    queryKey: ["profile-id", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user!.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const getUpgradeLevel = (type: string): number => {
    const upgrade = upgrades.find((u) => u.upgrade_type === type);
    return upgrade?.upgrade_level ?? 0;
  };

  const handlePurchaseUpgrade = async (upgrade: Upgrade) => {
    const currentLevel = getUpgradeLevel(upgrade.type);
    const cost = upgrade.cost * (currentLevel + 1); // Cost increases with level

    if (labelBalance < cost) {
      toast({
        title: "Insufficient funds",
        description: `This upgrade costs $${cost.toLocaleString()}`,
        variant: "destructive",
      });
      return;
    }

    try {
      // Deduct cost from label balance
      const { error: balanceError } = await supabase
        .from("labels")
        .update({ balance: labelBalance - cost })
        .eq("id", labelId);

      if (balanceError) throw balanceError;

      // Add or update upgrade
      if (currentLevel === 0) {
        const { error: upgradeError } = await supabase
          .from("label_upgrades")
          .insert({
            label_id: labelId,
            upgrade_type: upgrade.type,
            upgrade_level: 1,
          });

        if (upgradeError) throw upgradeError;
      } else {
        const existingUpgrade = upgrades.find((u) => u.upgrade_type === upgrade.type);
        const { error: upgradeError } = await supabase
          .from("label_upgrades")
          .update({ upgrade_level: currentLevel + 1 })
          .eq("id", existingUpgrade!.id);

        if (upgradeError) throw upgradeError;
      }

      // Record transaction
      await supabase.from("label_transactions").insert({
        label_id: labelId,
        transaction_type: "upgrade",
        amount: -cost,
        description: `${upgrade.name} (Level ${currentLevel + 1})`,
        initiated_by: profile?.id,
      });

      // Apply upgrade effects
      if (upgrade.type === "roster_expansion") {
        const { data: labelData } = await supabase
          .from("labels")
          .select("roster_slot_capacity")
          .eq("id", labelId)
          .single();

        if (labelData) {
          await supabase
            .from("labels")
            .update({ roster_slot_capacity: (labelData.roster_slot_capacity ?? 5) + 5 })
            .eq("id", labelId);
        }
      } else if (upgrade.type === "reputation_boost") {
        const { data: labelData } = await supabase
          .from("labels")
          .select("reputation_score")
          .eq("id", labelId)
          .single();

        if (labelData) {
          await supabase
            .from("labels")
            .update({ reputation_score: (labelData.reputation_score ?? 0) + 5 })
            .eq("id", labelId);
        }
      }

      toast({
        title: "Upgrade purchased!",
        description: `${upgrade.name} is now level ${currentLevel + 1}`,
      });

      queryClient.invalidateQueries({ queryKey: ["label-upgrades", labelId] });
      queryClient.invalidateQueries({ queryKey: ["label-finance", labelId] });
      queryClient.invalidateQueries({ queryKey: ["label-transactions", labelId] });
      queryClient.invalidateQueries({ queryKey: ["labels-directory"] });
      queryClient.invalidateQueries({ queryKey: ["my-labels"] });
    } catch (error) {
      console.error(error);
      toast({
        title: "Purchase failed",
        description: "Could not complete the upgrade purchase",
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
        const nextCost = upgrade.cost * (currentLevel + 1);
        const canAfford = labelBalance >= nextCost;

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
                    disabled={!canAfford}
                  >
                    {canAfford ? (
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