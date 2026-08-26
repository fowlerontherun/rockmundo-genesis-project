import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useMyMusicCollaborationContracts,
  useRespondToMusicCollaborationContract,
  useSettleMusicCollaborationContract,
} from "@/hooks/useMusicCollaborationContracts";

const labels: Record<string, string> = {
  guest_feature: "Guest feature",
  co_writing: "Co-writing",
  production_credit: "Production credit",
  session_musician: "Session musician",
  tour_participation: "Tour participation",
  live_guest: "Live guest",
};

const money = (minor: number, code = "USD") => `${code} ${(minor / 100).toFixed(2)}`;

export default function CharacterAgreementsPage() {
  const query = useMyMusicCollaborationContracts();
  const respond = useRespondToMusicCollaborationContract();
  const settle = useSettleMusicCollaborationContract();

  if (query.isLoading) return <main className="mx-auto max-w-5xl p-4 md:p-6">Loading agreements…</main>;
  if (query.isError) return <main className="mx-auto max-w-5xl p-4 md:p-6"><p className="text-destructive">{(query.error as Error).message}</p><Button className="mt-3" onClick={() => query.refetch()}>Retry</Button></main>;

  const profileId = query.data?.profileId;
  const contracts = query.data?.contracts ?? [];

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-5 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">My agreements</h1>
        <p className="text-muted-foreground">Review music collaborations, exact obligations, credits, royalty splits and escrowed fixed fees before accepting.</p>
      </div>

      {contracts.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">No music collaboration agreements yet.</CardContent></Card>
      ) : contracts.map((contract) => {
        const myParty = contract.parties.find((party) => party.partyType === "profile" && party.partyId === profileId);
        const myCredit = contract.credits.find((credit) => credit.profileId === profileId);
        const myEscrow = contract.escrows.find((escrow) => escrow.payeeProfileId === profileId);
        const awaiting = contract.status === "offered" && myParty?.status === "invited";

        return (
          <Card key={contract.id}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                <span>{contract.title}</span>
                <span className="flex gap-2"><Badge variant="secondary">{labels[contract.collaborationType] ?? contract.collaborationType}</Badge><Badge>{contract.status}</Badge></span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm">
              <p className="text-muted-foreground">{contract.summary}</p>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-md border p-3">
                  <div className="font-medium">Your obligations</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">{(myParty?.obligations ?? myCredit?.obligations ?? []).map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
                <div className="rounded-md border p-3">
                  <div className="font-medium">Band obligations</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">{(contract.terms.bandObligations ?? []).map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
              </div>

              <div className="grid gap-2 rounded-md bg-muted p-3 md:grid-cols-3">
                <div><div className="text-muted-foreground">Credit</div><strong>{myCredit?.creditRole ?? myParty?.role ?? "Participant"}</strong></div>
                <div><div className="text-muted-foreground">Royalty</div><strong>{((myCredit?.royaltyBasisPoints ?? myParty?.paymentTerms.royaltyBasisPoints ?? 0) / 100).toFixed(2)}%</strong></div>
                <div><div className="text-muted-foreground">Fixed fee</div><strong>{money(myCredit?.fixedFeeMinor ?? myParty?.paymentTerms.fixedFeeMinor ?? 0, myEscrow?.currencyCode ?? "USD")}</strong>{myEscrow && <div className="text-xs text-muted-foreground">Escrow: {myEscrow.status}</div>}</div>
              </div>

              <div>
                <div className="font-medium">Deliverables</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">{contract.deliverables.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>

              {awaiting && <div className="rounded-md border p-3"><p className="mb-3 font-medium">Accepting confirms the obligations, credit, fixed fee and royalty split shown above.</p><div className="flex gap-2"><Button disabled={respond.isPending} onClick={() => respond.mutate({ contractId: contract.id, accept: true })}>Accept obligations and split</Button><Button variant="outline" disabled={respond.isPending} onClick={() => respond.mutate({ contractId: contract.id, accept: false })}>Decline</Button></div></div>}

              {contract.status === "active" && myParty?.status === "accepted" && <div className="flex flex-wrap items-center gap-3"><span className="text-muted-foreground">Settlement only succeeds after the linked music activity is complete.</span><Button variant="outline" disabled={settle.isPending} onClick={() => settle.mutate(contract.id)}>Check and settle</Button></div>}
            </CardContent>
          </Card>
        );
      })}
    </main>
  );
}
