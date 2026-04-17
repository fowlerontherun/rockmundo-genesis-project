import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign } from "lucide-react";
import { useLogCampaignSpend, useCampaignExpenditures } from "@/hooks/useElectionCampaign";
import { CAMPAIGN_CATEGORY_LABELS, type CampaignCategory } from "@/types/political-party";

export function CampaignSpendDialog({ candidateId }: { candidateId: string }) {
  const log = useLogCampaignSpend();
  const { data: history } = useCampaignExpenditures(candidateId);
  const [amount, setAmount] = useState("100");
  const [category, setCategory] = useState<CampaignCategory>("ads");

  const total = (history ?? []).reduce((s, e) => s + e.amount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign className="h-5 w-5" /> Campaign Spending
        </CardTitle>
        <p className="text-xs text-muted-foreground">Total spent: ${(total / 100).toLocaleString()}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>Category</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as CampaignCategory)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(CAMPAIGN_CATEGORY_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Amount ($)</Label>
          <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <Button
          disabled={log.isPending}
          onClick={() =>
            log.mutate({
              candidate_id: candidateId,
              category,
              amount: Math.round(parseFloat(amount) * 100),
            })
          }
        >
          {log.isPending ? "Logging…" : "Log Spend"}
        </Button>
        {history && history.length > 0 && (
          <div className="text-xs text-muted-foreground space-y-1 pt-2">
            <p className="font-semibold">Recent:</p>
            {history.slice(0, 5).map((e) => (
              <div key={e.id} className="flex justify-between">
                <span>{CAMPAIGN_CATEGORY_LABELS[e.category]}</span>
                <span>${(e.amount / 100).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
