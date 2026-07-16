import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { BookingSide } from "../bookingTypes";
import type { FestivalContractRecord } from "../domainTypes";
import { formatBookingDateTime } from "../formatting";
import { CanonicalBookingProgress } from "./CanonicalBookingProgress";
import { ContractSignaturePanel } from "./ContractSignaturePanel";
import { OfferTermsSummary } from "./OfferTermsSummary";
export function ContractWorkspace({
  contract,
  authoritySide = "band",
}: {
  contract: FestivalContractRecord;
  authoritySide?: BookingSide;
}) {
  const terms = contract.terms_snapshot ?? {};
  const signatures = contract.festival_contract_signatures ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Contract {contract.status}</CardTitle>
        <CardDescription>
          Version {contract.current_version ?? 1} · accepted offer revision{" "}
          {contract.accepted_offer_revision ?? "—"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <CanonicalBookingProgress
          contract={contract}
          setlist={contract.current_setlist ?? contract.setlist ?? undefined}
        />
        <OfferTermsSummary terms={terms} />
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <span>
            Signature state: band{" "}
            {signatures.some((s) => s.signing_side === "band")
              ? "signed"
              : "pending"}
            , organiser{" "}
            {signatures.some((s) => s.signing_side === "organiser")
              ? "signed"
              : "pending"}
          </span>
          <span>
            Schedule: {contract.schedule_state ?? "awaiting activation result"}
          </span>
        </div>
        {contract.schedule_blocks?.length ? (
          <div className="space-y-2">
            <h4 className="font-medium">Schedule blocks</h4>
            {contract.schedule_blocks.map((b) => (
              <div key={b.id} className="rounded border p-2 text-sm">
                {b.block_type ?? "block"} · {b.stage_name ?? "stage TBA"} ·{" "}
                {formatBookingDateTime(b.start_at)}–
                {formatBookingDateTime(b.end_at)}
                {b.conflict_summary ? (
                  <p className="text-destructive">{b.conflict_summary}</p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
        {contract.status !== "active" ? (
          <ContractSignaturePanel
            contract={contract}
            authoritySide={authoritySide}
          />
        ) : (
          <Badge className="bg-emerald-500/20 text-emerald-600">
            Active; schedule must be read from canonical blocks.
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
