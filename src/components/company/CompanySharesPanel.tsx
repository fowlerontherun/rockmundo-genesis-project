import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCompanyShareholders, useDistributeAnnualProfit, useIssueCompanyShares } from "@/hooks/useCompanyShares";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface CompanySharesPanelProps {
  companyId: string;
  isMajorityOwner: boolean;
}

export function CompanySharesPanel({ companyId, isMajorityOwner }: CompanySharesPanelProps) {
  const { data: shareholders = [] } = useCompanyShareholders(companyId);
  const issueShares = useIssueCompanyShares();
  const distributeProfit = useDistributeAnnualProfit();

  const [recipientQuery, setRecipientQuery] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [shares, setShares] = useState("10");
  const [pricePerShare, setPricePerShare] = useState("0");

  const { data: profiles = [] } = useQuery({
    queryKey: ["share-recipient-profiles", recipientQuery],
    queryFn: async () => {
      if (!recipientQuery || recipientQuery.length < 2) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, stage_name, username")
        .or(`stage_name.ilike.%${recipientQuery}%,username.ilike.%${recipientQuery}%`)
        .limit(8);
      return data || [];
    },
    enabled: recipientQuery.length >= 2,
  });

  const totalShares = useMemo(
    () => shareholders.reduce((sum, sh) => sum + Number(sh.shares || 0), 0),
    [shareholders],
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Shareholders</CardTitle>
          <CardDescription>
            Ownership is determined by who owns the most shares.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {shareholders.map((holder) => {
            const pct = totalShares > 0 ? (Number(holder.shares) / totalShares) * 100 : 0;
            return (
              <div key={holder.id} className="flex items-center justify-between rounded border p-3">
                <div>
                  <p className="font-medium">{holder.profile?.stage_name || holder.profile?.username || "Unknown player"}</p>
                  <p className="text-xs text-muted-foreground">{holder.shares} shares</p>
                </div>
                <p className="text-sm font-semibold">{pct.toFixed(1)}%</p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create and Transfer Shares</CardTitle>
          <CardDescription>Issue new shares and either sell or gift them to a player.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!isMajorityOwner ? (
            <p className="text-sm text-muted-foreground">Only the majority shareholder can issue shares.</p>
          ) : (
            <>
              <div>
                <Label>Find player</Label>
                <Input value={recipientQuery} onChange={(e) => setRecipientQuery(e.target.value)} placeholder="Search by stage name or username" />
                {profiles.length > 0 && (
                  <div className="mt-2 space-y-1 rounded border p-2">
                    {profiles.map((p: any) => (
                      <button
                        key={p.id}
                        className={`w-full rounded px-2 py-1 text-left text-sm hover:bg-accent ${recipientId === p.id ? "bg-accent" : ""}`}
                        onClick={() => setRecipientId(p.id)}
                        type="button"
                      >
                        {p.stage_name || p.username}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Shares</Label>
                  <Input type="number" min={1} value={shares} onChange={(e) => setShares(e.target.value)} />
                </div>
                <div>
                  <Label>Price per share (0 = gift)</Label>
                  <Input type="number" min={0} value={pricePerShare} onChange={(e) => setPricePerShare(e.target.value)} />
                </div>
              </div>

              <Button
                onClick={() =>
                  issueShares.mutate({
                    companyId,
                    recipientProfileId: recipientId,
                    shares: Number(shares),
                    pricePerShare: Number(pricePerShare),
                  })
                }
                disabled={!recipientId || Number(shares) <= 0 || Number(pricePerShare) < 0 || issueShares.isPending}
              >
                {Number(pricePerShare) > 0 ? "Sell shares" : "Gift shares"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Annual Profit Sharing</CardTitle>
          <CardDescription>Distribute company profits to shareholders once per in-game year.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => distributeProfit.mutate({ companyId })} disabled={!isMajorityOwner || distributeProfit.isPending}>
            Distribute annual profit
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
