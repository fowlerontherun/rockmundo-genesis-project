import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Coins, Star, Trophy, Sparkles, Gift } from "lucide-react";

interface Rewards {
  xp?: number;
  cash?: number;
  fame?: number;
  unlock_item?: string;
  title?: string;
}

interface RewardsBuilderProps {
  value: Record<string, any>;
  onChange: (value: Record<string, any>) => void;
}

export function RewardsBuilder({ value, onChange }: RewardsBuilderProps) {
  const [rewards, setRewards] = useState<Rewards>({
    xp: value?.xp || 0,
    cash: value?.cash || 0,
    fame: value?.fame || 0,
    unlock_item: value?.unlock_item || "",
    title: value?.title || "",
  });

  useEffect(() => {
    setRewards({
      xp: value?.xp || 0,
      cash: value?.cash || 0,
      fame: value?.fame || 0,
      unlock_item: value?.unlock_item || "",
      title: value?.title || "",
    });
  }, [value]);

  const updateReward = (field: keyof Rewards, val: string | number) => {
    const newRewards = { ...rewards, [field]: val };
    setRewards(newRewards);
    
    // Only include non-zero/non-empty values in output
    const cleanedRewards: Record<string, any> = {};
    if (newRewards.xp && newRewards.xp > 0) cleanedRewards.xp = newRewards.xp;
    if (newRewards.cash && newRewards.cash > 0) cleanedRewards.cash = newRewards.cash;
    if (newRewards.fame && newRewards.fame > 0) cleanedRewards.fame = newRewards.fame;
    if (newRewards.unlock_item) cleanedRewards.unlock_item = newRewards.unlock_item;
    if (newRewards.title) cleanedRewards.title = newRewards.title;
    
    onChange(cleanedRewards);
  };

  return (
    <div className="space-y-3">
      <Label>Rewards</Label>
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-xs flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                XP
              </Label>
              <Input
                type="number"
                min={0}
                value={rewards.xp || ""}
                onChange={(e) => updateReward("xp", parseInt(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1">
                <Coins className="h-3 w-3" />
                Cash
              </Label>
              <Input
                type="number"
                min={0}
                value={rewards.cash || ""}
                onChange={(e) => updateReward("cash", parseInt(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1">
                <Star className="h-3 w-3" />
                Fame
              </Label>
              <Input
                type="number"
                min={0}
                value={rewards.fame || ""}
                onChange={(e) => updateReward("fame", parseInt(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs flex items-center gap-1">
                <Gift className="h-3 w-3" />
                Unlock Item ID
              </Label>
              <Input
                value={rewards.unlock_item || ""}
                onChange={(e) => updateReward("unlock_item", e.target.value)}
                placeholder="Optional item to unlock"
              />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1">
                <Trophy className="h-3 w-3" />
                Title Reward
              </Label>
              <Input
                value={rewards.title || ""}
                onChange={(e) => updateReward("title", e.target.value)}
                placeholder="Optional title"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
