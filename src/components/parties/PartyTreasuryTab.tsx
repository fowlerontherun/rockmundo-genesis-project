import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet } from "lucide-react";
import type { PoliticalParty } from "@/types/political-party";

export function PartyTreasuryTab({ party }: { party: PoliticalParty }) {
  return (
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
          <span className="text-2xl font-bold">${(party.treasury_balance / 100).toLocaleString()}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Treasury funds are used to back member campaigns. Members can request funding from
          founders/officers during election seasons.
        </p>
      </CardContent>
    </Card>
  );
}
