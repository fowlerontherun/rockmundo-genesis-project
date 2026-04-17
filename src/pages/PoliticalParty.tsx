import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Flag, Users, LogOut } from "lucide-react";
import { useMyParty, useParties, useLeaveParty } from "@/hooks/useParties";
import { PartyCreateWizard } from "@/components/parties/PartyCreateWizard";
import { PartyMembersTab } from "@/components/parties/PartyMembersTab";
import { PartyTreasuryTab } from "@/components/parties/PartyTreasuryTab";
import { JoinPartyDialog } from "@/components/parties/JoinPartyDialog";
import type { PoliticalParty } from "@/types/political-party";

export default function PoliticalPartyPage() {
  const { data: my } = useMyParty();
  const { data: parties } = useParties();
  const leave = useLeaveParty();
  const [joinTarget, setJoinTarget] = useState<PoliticalParty | null>(null);

  if (my?.party) {
    const party = my.party;
    return (
      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-block h-6 w-6 rounded-full" style={{ backgroundColor: party.colour_hex }} />
            <div>
              <h1 className="text-3xl font-bold">{party.name}</h1>
              <p className="text-sm text-muted-foreground">{party.description}</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => leave.mutate()} disabled={leave.isPending}>
            <LogOut className="h-4 w-4 mr-1" /> Leave Party
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Core Beliefs</CardTitle></CardHeader>
          <CardContent>
            <ul className="text-sm list-disc pl-5 space-y-1">
              {[party.belief_1, party.belief_2, party.belief_3, party.belief_4, party.belief_5]
                .filter(Boolean)
                .map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Members</p><p className="text-2xl font-bold">{party.member_count}</p></CardContent></Card>
          <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Mayors held</p><p className="text-2xl font-bold">{party.mayor_count}</p></CardContent></Card>
          <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Strength</p><p className="text-2xl font-bold">{party.total_strength}</p></CardContent></Card>
        </div>

        <Tabs defaultValue="members">
          <TabsList>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="treasury">Treasury</TabsTrigger>
          </TabsList>
          <TabsContent value="members"><PartyMembersTab partyId={party.id} /></TabsContent>
          <TabsContent value="treasury"><PartyTreasuryTab party={party} /></TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Flag className="h-8 w-8 text-primary" />
          Political Parties
        </h1>
        <p className="text-sm text-muted-foreground">Found a new party or join an existing movement.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PartyCreateWizard />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" /> Existing Parties ({parties?.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(parties ?? []).map((p) => (
              <div key={p.id} className="flex items-center justify-between p-2 rounded-md border border-border">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="inline-block h-4 w-4 rounded-full flex-shrink-0" style={{ backgroundColor: p.colour_hex }} />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{p.member_count} members</Badge>
                  <Button size="sm" onClick={() => setJoinTarget(p)}>Join</Button>
                </div>
              </div>
            ))}
            {(parties ?? []).length === 0 && <p className="text-sm text-muted-foreground">No parties yet — be the first.</p>}
          </CardContent>
        </Card>
      </div>

      <JoinPartyDialog party={joinTarget} open={!!joinTarget} onOpenChange={(v) => !v && setJoinTarget(null)} />
    </div>
  );
}
