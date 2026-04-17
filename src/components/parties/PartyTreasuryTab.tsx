import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Wallet, HandCoins, History } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { PoliticalParty } from "@/types/political-party";
import { useDonateToParty, usePartyDonations } from "@/hooks/usePartyDonations";
import { useMyParty } from "@/hooks/useParties";
import { useActiveProfile } from "@/hooks/useActiveProfile";

export function PartyTreasuryTab({ party }: { party: PoliticalParty }) {
  const { profile } = useActiveProfile();
  const { data: myParty } = useMyParty();
  const donate = useDonateToParty();
  const { data: donations } = usePartyDonations(party.id);

  const [amount, setAmount] = useState("100");
  const [note, setNote] = useState("");

  const isMember = myParty?.party_id === party.id;
  const myCash = profile?.cash ?? 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="h-5 w-5" />
            Party Treasury
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-baseline justify-between p-3 rounded-md bg-muted/40">
            <span className="text-sm text-muted-foreground">Current Balance</span>
            <span className="text-2xl font-bold">
              ${(party.treasury_balance / 100).toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Treasury funds back member campaigns. Members can request funding from founders/officers
            during election seasons.
          </p>
        </CardContent>
      </Card>

      {isMember && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <HandCoins className="h-4 w-4" /> Donate to Treasury
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Your wallet: ${myCash.toLocaleString()}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="donation-amount">Amount ($)</Label>
              <Input
                id="donation-amount"
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="donation-note">Note (optional)</Label>
              <Textarea
                id="donation-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Why you're donating…"
              />
            </div>
            <Button
              disabled={donate.isPending}
              onClick={() => {
                const dollars = parseFloat(amount);
                if (!Number.isFinite(dollars) || dollars <= 0) return;
                const cents = Math.round(dollars * 100);
                if (cents > myCash * 100) return;
                donate.mutate(
                  { party_id: party.id, amount_cents: cents, note: note.trim() || undefined },
                  { onSuccess: () => setNote("") },
                );
              }}
            >
              {donate.isPending ? "Sending…" : `Donate $${amount || 0}`}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" /> Recent Donations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!donations || donations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No donations yet.</p>
          ) : (
            <ul className="space-y-2">
              {donations.map((d: any) => (
                <li
                  key={d.id}
                  className="flex items-start justify-between gap-3 p-2 rounded-md border border-border"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {d.donor?.display_name ?? d.donor?.username ?? "Anonymous"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
                    </p>
                    {d.note && (
                      <p className="text-xs italic mt-1 line-clamp-2">"{d.note}"</p>
                    )}
                  </div>
                  <span className="text-sm font-semibold whitespace-nowrap text-success">
                    +${(d.amount / 100).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
