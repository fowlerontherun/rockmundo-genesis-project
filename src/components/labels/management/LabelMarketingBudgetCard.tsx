import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Megaphone, DollarSign, TrendingUp, Info } from "lucide-react";
import { toast } from "sonner";

interface LabelMarketingBudgetCardProps {
  labelId: string;
  labelBalance: number;
}

export function LabelMarketingBudgetCard({ labelId, labelBalance }: LabelMarketingBudgetCardProps) {
  const queryClient = useQueryClient();

  const { data: label } = useQuery({
    queryKey: ["label-marketing-budget", labelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("labels")
        .select("weekly_marketing_budget, balance")
        .eq("id", labelId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const currentBudget = (label as any)?.weekly_marketing_budget ?? 0;
  const currentBalance = label?.balance ?? labelBalance ?? 0;
  const [budget, setBudget] = useState<number | null>(null);

  const displayBudget = budget ?? currentBudget;
  const dailyCost = Math.round(displayBudget / 7);
  const monthlyCost = dailyCost * 30;

  // Fetch signed artist count
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
      const { error } = await supabase
        .from("labels")
        .update({ weekly_marketing_budget: newBudget } as any)
        .eq("id", labelId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["label-marketing-budget", labelId] });
      queryClient.invalidateQueries({ queryKey: ["label-management"] });
      toast.success("Marketing budget updated!");
      setBudget(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const hasChanged = budget !== null && budget !== currentBudget;
  const canAffordMonthly = currentBalance >= monthlyCost;

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Weekly Marketing Budget</h3>
          </div>
          <Badge variant="outline" className="gap-1">
            <DollarSign className="h-3 w-3" />
            {currentBudget.toLocaleString()}/week
          </Badge>
        </div>

        <div className="bg-muted/50 rounded-lg p-3 text-sm flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <p className="text-muted-foreground">
            Your marketing budget is spent daily to promote upcoming and recent releases from your {signedCount} signed artist{signedCount !== 1 ? "s" : ""}. 
            It builds hype which directly boosts sales and streaming numbers.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Weekly budget: ${displayBudget.toLocaleString()}</Label>
          <Slider
            value={[displayBudget]}
            onValueChange={([v]) => setBudget(v)}
            min={0}
            max={50000}
            step={500}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>$0</span>
            <span>$50,000</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-muted/30 rounded p-2">
            <p className="text-xs text-muted-foreground">Daily spend</p>
            <p className="font-semibold text-sm">${dailyCost.toLocaleString()}</p>
          </div>
          <div className="bg-muted/30 rounded p-2">
            <p className="text-xs text-muted-foreground">Monthly est.</p>
            <p className="font-semibold text-sm">${monthlyCost.toLocaleString()}</p>
          </div>
          <div className="bg-muted/30 rounded p-2">
            <p className="text-xs text-muted-foreground">Hype/day/artist</p>
            <p className="font-semibold text-sm flex items-center justify-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              +{signedCount > 0 ? Math.round((dailyCost / signedCount) / 100) : 0}
            </p>
          </div>
        </div>

        {!canAffordMonthly && displayBudget > 0 && (
          <p className="text-xs text-destructive">
            ⚠️ Your balance (${currentBalance.toLocaleString()}) may not sustain this monthly spend (${monthlyCost.toLocaleString()})
          </p>
        )}

        {hasChanged && (
          <Button
            onClick={() => updateMutation.mutate(budget!)}
            disabled={updateMutation.isPending}
            className="w-full"
          >
            {updateMutation.isPending ? "Saving..." : "Update Marketing Budget"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
