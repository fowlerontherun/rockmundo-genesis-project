import { AlertTriangle, Check, FileSignature, Loader2, ShieldCheck, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useCancelSocialContract,
  useMySocialContracts,
  useOfferSocialContract,
  useOpenSocialContractDispute,
  useRespondToSocialContract,
  type SocialContractSummary,
} from "@/hooks/useSocialContracts";

function statusVariant(status: SocialContractSummary["status"]): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active" || status === "completed") return "default";
  if (status === "cancelled" || status === "disputed") return "destructive";
  if (status === "offered") return "secondary";
  return "outline";
}

function ContractCard({ contract }: { contract: SocialContractSummary }) {
  const respond = useRespondToSocialContract();
  const offer = useOfferSocialContract();
  const cancel = useCancelSocialContract();
  const dispute = useOpenSocialContractDispute();
  const busy = respond.isPending || offer.isPending || cancel.isPending || dispute.isPending;
  const deadline = contract.deadline_at ? new Date(contract.deadline_at).toLocaleString() : null;

  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSignature className="h-4 w-4" />
              {contract.title}
            </CardTitle>
            <CardDescription>{contract.contract_type.replaceAll("_", " ")} · Your role: {contract.my_role}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge variant={statusVariant(contract.status)}>{contract.status}</Badge>
            <Badge variant="outline">{contract.my_party_status}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <span>Version {contract.version}</span>
          <span>{deadline ? `Deadline ${deadline}` : "No deadline"}</span>
        </div>

        {contract.status === "offered" && contract.my_party_status === "invited" ? (
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => respond.mutate({ contractId: contract.contract_id, accept: true })}>
              {respond.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Accept obligations
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => respond.mutate({ contractId: contract.contract_id, accept: false })}>
              <X className="mr-2 h-4 w-4" />Decline
            </Button>
          </div>
        ) : null}

        {contract.status === "draft" && contract.my_role === "creator" ? (
          <Button disabled={busy} onClick={() => offer.mutate(contract.contract_id)}>
            <FileSignature className="mr-2 h-4 w-4" />Offer contract
          </Button>
        ) : null}

        {contract.status === "active" ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy} onClick={() => dispute.mutate({ contractId: contract.contract_id, reasonCode: "breach" })}>
              <AlertTriangle className="mr-2 h-4 w-4" />Open dispute
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => cancel.mutate({ contractId: contract.contract_id })}>
              Cancel contract
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function SocialContractsPanel() {
  const contracts = useMySocialContracts();

  if (contracts.isLoading) {
    return <div className="flex h-40 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading contracts…</div>;
  }

  if (contracts.isError) {
    return (
      <Card>
        <CardHeader><CardTitle>Contracts unavailable</CardTitle><CardDescription>{contracts.error instanceof Error ? contracts.error.message : "The contract service could not be loaded."}</CardDescription></CardHeader>
        <CardContent><Button variant="outline" onClick={() => contracts.refetch()}>Retry</Button></CardContent>
      </Card>
    );
  }

  const rows = contracts.data ?? [];
  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />No social contracts yet</CardTitle>
          <CardDescription>Collaboration, employment and other social systems will use this shared contract lifecycle. Offers that need your approval will appear here.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Contracts</CardTitle>
          <CardDescription>Explicit obligations, accepted terms, escrow status and disputes are enforced by the server. Completed contracts feed verified trust signals.</CardDescription>
        </CardHeader>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">{rows.map((contract) => <ContractCard key={contract.contract_id} contract={contract} />)}</div>
    </div>
  );
}
