import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Megaphone, DollarSign, TrendingUp, Info, ArrowUpCircle } from "lucide-react";
import { toast } from "sonner";

interface LabelMarketingBudgetCardProps {
  labelId: string;
  labelBalance: number;
}

const MARKETING_LEVELS: Record<number, { multiplier: number; cap: number; upgradeCost: number | null }> = {
  1: { multiplier: 1, cap: 10_000, upgradeCost: 25_000 },
  2: { multiplier: 1.25, cap: 20_000, upgradeCost: 75_000 },
  3: { multiplier: 1.55, cap: 35_000, upgradeCost: 175_000 },
  4: { multiplier: 1.9, cap: 50_000, upgradeCost: 400_000 },
  5: { multiplier: 2.3, cap: 75_000, upgradeCost: null },
};

export function LabelMarketingBudgetCard({ labelId, labelBalance }: LabelMarketingBudgetCardProps) {
  const queryClient = useQueryClient();

  const { data: label } = useQuery({
    queryKey: ["label-marketing-budget", labelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("labels")
        .select("weekly_marketing_budget, marketing_level, balance")
        .eq("id", labelId)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const currentBudget = Number(label?.weekly_marketing_budget ?? 0);
  const currentBalance = Number(label?.balance ?? labelBalance ?? 0);
  const marketingLevel = Math.max(1, Math.min(5, Number(label?.marketing_level ?? 1)));
  const levelConfig = MARKETING_LEVELS[marketingLevel];
  const [budget, setBudget] = useState<number | null>(null);

  const displayBudget = Math.min(budget ?? currentBudget, levelConfig.cap);
  const dailyCost = Math.round((displayBudget / 7) * 100) / 100;
  const monthlyCost = Math.round(dailyCost * 30 * 100) / 100;

  const { data: signedCount = 0 } = useQuery({
    queryKey: ["label-signed-count", labelId],
    queryFn: async () => {
      const { count } = await supabase
        .from("artist_label_contracts")
        .select("*", { count: "exact", head: true })
        .eq("label_id", labelId)
        .eq("status", "active");
      return count || 0;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (newBudget: number) => {
      const { error } = await (supabase as any).rpc("set_label_marketing_budget", {
        p_label_id: labelId,
        p_weekly_budget: newBudget,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["label-marketing-budget", labelId] });
      queryClient.invalidateQueries({ queryKey: ["label-management"] });
      toast.success("Marketing budget updated");
      setBudget(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const upgradeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc("upgrade_label_marketing", {
        p_label_id: labelId,
      });
      if (error) throw error;
      return Array.isArray(data) ? data[0] : data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["label-marketing-budget", labelId] });
      queryClient.invalidateQueries({ queryKey: ["label-management"] });
      queryClient.invalidateQueries({ queryKey: ["label-finances"] });
      toast.success(`Marketing department upgraded to level ${result?.new_level ?? marketingLevel + 1}`);
      setBudget(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const hasChanged = budget !== null && displayBudget !== currentBudget;
  const canAffordMonthly = currentBalance >= monthlyCost;
  const canAffordUpgrade = levelConfig.upgradeCost == null || currentBalance >= levelConfig.upgradeCost;

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Label Marketing Department</h3>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary">Level {marketingLevel}/5</Badge>
            <Badge variant="outline" className="gap-1">
              <DollarSign className="h-3 w-3" />
              {currentBudget.toLocaleString()}/week
            </Badge>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-3 text-sm flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <p className="text-muted-foreground">
            Marketing is charged to the label every day and builds hype on upcoming and recent releases from your {signedCount} signed artist{signedCount !== 1 ? "s" : ""}. Hype feeds directly into record sales and streaming demand. Department upgrades make every marketing dollar more effective and unlock larger budgets.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-center">
          <div className="bg-muted/30 rounded p-2">
            <p className="text-xs text-muted-foreground">Effectiveness</p>
            <p className="font-semibold text-sm flex items-center justify-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {levelConfig.multiplier.toFixed(2)}×
            </p>
          </div>
          <div className="bg-muted/30 rounded p-2">
            <p className="text-xs text-muted-foreground">Budget cap</p>
            <p className="font-semibold text-sm">${levelConfig.cap.toLocaleString()}/wk</p>
          </div>
          <div className="bg-muted/30 rounded p-2">
            <p className="text-xs text-muted-foreground">Daily spend</p>
            <p className="font-semibold text-sm">${dailyCost.toLocaleString()}</p>
          </div>
          <div className="bg-muted/30 rounded p-2">
            <p className="text-xs text-muted-foreground">Monthly est.</p>
            <p className="font-semibold text-sm">${monthlyCost.toLocaleString()}</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Weekly budget: ${displayBudget.toLocaleString()}</Label>
          <Slider
            value={[displayBudget]}
            onValueChange={([v]) => setBudget(v)}
            min={0}
            max={levelConfig.cap}
            step={500}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>$0</span>
            <span>${levelConfig.cap.toLocaleString()} unlocked</span>
          </div>
        </div>

        {!canAffordMonthly && displayBudget > 0 && (
          <p className="text-xs text-destructive">
            Your balance (${currentBalance.toLocaleString()}) may not sustain the estimated monthly spend (${monthlyCost.toLocaleString()}). Marketing pauses automatically when the label cannot afford the daily charge.
          </p>
        )}

        {hasChanged && (
          <Button
            onClick={() => updateMutation.mutate(displayBudget)}
            disabled={updateMutation.isPending}
            className="w-full"
          >
            {updateMutation.isPending ? "Saving..." : "Update Marketing Budget"}
          </Button>
        )}

        {levelConfig.upgradeCost !== null ? (
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-sm">Upgrade to Level {marketingLevel + 1}</p>
                <p className="text-xs text-muted-foreground">
                  {MARKETING_LEVELS[marketingLevel + 1].multiplier.toFixed(2)}× effectiveness · ${MARKETING_LEVELS[marketingLevel + 1].cap.toLocaleString()}/week cap
                </p>
              </div>
              <Badge variant="outline">${levelConfig.upgradeCost.toLocaleString()}</Badge>
            </div>
            <Button
              variant="secondary"
              className="w-full gap-2"
              onClick={() => upgradeMutation.mutate()}
              disabled={upgradeMutation.isPending || !canAffordUpgrade}
            >
              <ArrowUpCircle className="h-4 w-4" />
              {upgradeMutation.isPending ? "Upgrading..." : canAffordUpgrade ? "Upgrade Marketing Department" : "Insufficient Label Funds"}
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border bg-muted/30 p-3 text-center text-sm font-medium">
            Marketing department fully upgraded — maximum effectiveness and budget unlocked.
          </div>
        )}
      </CardContent>
    </Card>
  );
}