import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useCompanyShareholders, useDistributeAnnualProfit } from "@/hooks/useCompanyShares";
import {
  useCompanyShareOffers,
  useIssueCompanyShares,
  useRespondToCompanyShareOffer,
} from "@/hooks/useCompanyShareOffers";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface CompanySharesPanelProps {
  companyId: string;
  isMajorityOwner: boolean;
}

const formatGBP = (amount: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);

export function CompanySharesPanel({ companyId, isMajorityOwner }: CompanySharesPanelProps) {
  const { profileId } = useActiveProfile();
  const { data: shareholders = [] } = useCompanyShareholders(companyId);
  const { data: incomingOffers = [] } = useCompanyShareOffers(companyId, profileId);
  const issueShares = useIssueCompanyShares();
  const respondToOffer = useRespondToCompanyShareOffer();
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
    () => shareholders.reduce((sum, shareholder) => sum + Number(shareholder.shares || 0), 0),
    [shareholders],
  );

  return (
    <div className="space-y-4">
      {incomingOffers.length > 0 && (
        <Card className="border-primary/30">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Incoming Share Offers</CardTitle>
                <CardDescription>
                  Paid offers only move money and issue shares after you accept them.
                </CardDescription>
              </div>
              <Badge>{incomingOffers.length} pending</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {incomingOffers.map((offer) => (
              <div key={offer.id} className="rounded-lg border p-4">
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                  <div>
                    <p className="font-medium">
                      {offer.shares.toLocaleString("en-GB")} shares for {formatGBP(offer.total_price)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Offered by {offer.issuerProfile?.stage_name || offer.issuerProfile?.username || "Company owner"}
                      {" · "}{formatGBP(offer.price_per_share)} per share
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Expires {new Date(offer.expires_at).toLocaleString("en-GB")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      disabled={respondToOffer.isPending}
                      onClick={() => respondToOffer.mutate({ offerId: offer.id, accept: false })}
                    >
                      Decline
                    </Button>
                    <Button
                      disabled={respondToOffer.isPending}
                      onClick={() => respondToOffer.mutate({ offerId: offer.id, accept: true })}
                    >
                      Accept for {formatGBP(offer.total_price)}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Shareholders</CardTitle>
          <CardDescription>
            Ownership is determined by who owns the most shares.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {shareholders.map((holder) => {
            const percentage = totalShares > 0 ? (Number(holder.shares) / totalShares) * 100 : 0;
            return (
              <div key={holder.id} className="flex items-center justify-between rounded border p-3">
                <div>
                  <p className="font-medium">{holder.profile?.stage_name || holder.profile?.username || "Unknown player"}</p>
                  <p className="text-xs text-muted-foreground">{holder.shares} shares</p>
                </div>
                <p className="text-sm font-semibold">{percentage.toFixed(1)}%</p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create and Transfer Shares</CardTitle>
          <CardDescription>
            Gifts are issued immediately. Paid sales send a seven-day offer that the buyer must accept.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!isMajorityOwner ? (
            <p className="text-sm text-muted-foreground">Only the majority shareholder can issue shares.</p>
          ) : (
            <>
              <div>
                <Label>Find player</Label>
                <Input value={recipientQuery} onChange={(event) => setRecipientQuery(event.target.value)} placeholder="Search by stage name or username" />
                {profiles.length > 0 && (
                  <div className="mt-2 space-y-1 rounded border p-2">
                    {profiles.map((profile: any) => (
                      <button
                        key={profile.id}
                        className={`w-full rounded px-2 py-1 text-left text-sm hover:bg-accent ${recipientId === profile.id ? "bg-accent" : ""}`}
                        onClick={() => setRecipientId(profile.id)}
                        type="button"
                      >
                        {profile.stage_name || profile.username}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Shares</Label>
                  <Input type="number" min={1} value={shares} onChange={(event) => setShares(event.target.value)} />
                </div>
                <div>
                  <Label>Price per share (£0 = gift)</Label>
                  <Input type="number" min={0} value={pricePerShare} onChange={(event) => setPricePerShare(event.target.value)} />
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
                {Number(pricePerShare) > 0 ? "Send paid offer" : "Gift shares"}
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
