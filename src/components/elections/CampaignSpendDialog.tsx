import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Wallet, Landmark } from "lucide-react";
import { useLogCampaignSpend, useCampaignExpenditures } from "@/hooks/useElectionCampaign";
import { useMyParty } from "@/hooks/useParties";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { CAMPAIGN_CATEGORY_LABELS, type CampaignCategory } from "@/types/political-party";

export function CampaignSpendDialog({ candidateId }: { candidateId: string }) {
  const log = useLogCampaignSpend();
  const { data: history } = useCampaignExpenditures(candidateId);
  const { data: myParty } = useMyParty();
  const { profile } = useActiveProfile();

  const [amount, setAmount] = useState("100");
  const [category, setCategory] = useState<CampaignCategory>("ads");
  const [fundedFrom, setFundedFrom] = useState<"personal" | "party">("personal");

  const total = (history ?? []).reduce((s, e) => s + e.amount, 0);

  // Only founders/officers may draw from party treasury
  const canUseParty =
    !!myParty?.party_id && (myParty.role === "founder" || myParty.role === "officer");
  const partyBalanceCents = myParty?.party?.treasury_balance ?? 0;
  const myCashDollars = profile?.cash ?? 0;

  const dollars = parseFloat(amount);
  const cents = Number.isFinite(dollars) && dollars > 0 ? Math.round(dollars * 100) : 0;
  const personalShortfall = fundedFrom === "personal" && cents > Math.round(myCashDollars * 100);
  const partyShortfall = fundedFrom === "party" && cents > partyBalanceCents;
  const disabled = log.isPending || cents <= 0 || personalShortfall || partyShortfall;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign className="h-5 w-5" /> Campaign Spending
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Total spent: ${(total / 100).toLocaleString()}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>Funding source</Label>
          <Select
            value={fundedFrom}
            onValueChange={(v) => setFundedFrom(v as "personal" | "party")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="personal">
                <span className="inline-flex items-center gap-2">
                  <Wallet className="h-3.5 w-3.5" /> Personal — ${myCashDollars.toLocaleString()}
                </span>
              </SelectItem>
              {canUseParty && (
                <SelectItem value="party">
                  <span className="inline-flex items-center gap-2">
                    <Landmark className="h-3.5 w-3.5" />
                    {myParty!.party.name} treasury — $
                    {(partyBalanceCents / 100).toLocaleString()}
                  </span>
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          {!canUseParty && myParty?.party_id && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Only party founders or officers can draw from the treasury.
            </p>
          )}
        </div>

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
          <Input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {personalShortfall && (
            <p className="text-[11px] text-destructive mt-1">Insufficient personal funds.</p>
          )}
          {partyShortfall && (
            <p className="text-[11px] text-destructive mt-1">Insufficient party treasury funds.</p>
          )}
        </div>

        <Button
          disabled={disabled}
          onClick={() =>
            log.mutate({
              candidate_id: candidateId,
              category,
              amount: cents,
              funded_from: fundedFrom,
              party_id: fundedFrom === "party" ? myParty?.party_id ?? null : null,
            })
          }
        >
          {log.isPending ? "Logging…" : `Log Spend ($${amount || 0})`}
        </Button>

        {history && history.length > 0 && (
          <div className="text-xs text-muted-foreground space-y-1 pt-2">
            <p className="font-semibold">Recent:</p>
            {history.slice(0, 5).map((e) => (
              <div key={e.id} className="flex justify-between">
                <span>
                  {CAMPAIGN_CATEGORY_LABELS[e.category]}
                  <span className="ml-1 opacity-70">
                    ({e.funded_from === "party" ? "party" : "personal"})
                  </span>
                </span>
                <span>${(e.amount / 100).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
