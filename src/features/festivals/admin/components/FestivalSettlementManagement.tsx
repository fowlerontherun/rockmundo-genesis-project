import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useFestivalEditionSettlementReconciliation,
  useFestivalSettlementReadiness,
  useFestivalSettlementReport,
  useSettleFestivalEdition,
} from "@/features/festivals/settlement/hooks";
import { asArray, asObject, money, text, WorkflowState } from "./workflowUtils";

export function FestivalSettlementManagement({ editionId }: { editionId: string }) {
  const { data: readinessData, isLoading, error } = useFestivalSettlementReadiness(editionId);
  const reconciliationQuery = useFestivalEditionSettlementReconciliation(editionId);
  const settle = useSettleFestivalEdition(editionId);

  if (isLoading) return <WorkflowState title="Loading settlement" message="Loading canonical settlement readiness hash…" />;
  if (error) return <WorkflowState title="Settlement unavailable" message={String(error)} variant="destructive" />;

  const readiness = asObject(readinessData);
  const reconciliationPayload = asObject(reconciliationQuery.data);
  const reconciliation = asObject(reconciliationPayload.reconciliation);
  const settlement = asObject(reconciliationPayload.settlement);
  const settlementId = text(settlement.id, "");
  const report = useFestivalSettlementReport(settlementId);
  const reportData = report.data;
  const ready = Boolean(readiness.ready_for_settlement ?? readiness.is_eligible ?? readiness.ready);
  const readinessHash = text(readiness.readiness_hash, "");
  const completed = text(settlement.status) === "completed";
  const discrepancies = asArray(reconciliation.discrepancies);
  const totals = asObject(reconciliation.totals);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Settlement readiness
            <Badge variant={completed ? "default" : "secondary"}>
              {completed ? "completed" : text(readiness.current_phase ?? readiness.phase, ready ? "ready" : "not eligible")}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>Readiness hash: {readinessHash || "Not available"}</p>
          <p>Blocked items: {text(readiness.blocked_items ?? readiness.blockers, "none")}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!ready || settle.isPending || completed}
              onClick={() => settle.mutate({
                expectedReadinessHash: readinessHash || null,
                idempotencyKey: `edition-settlement:${editionId}`,
              })}
            >
              {settle.isPending ? "Settling…" : completed ? "Settlement complete" : "Settle edition"}
            </Button>
            <Button variant="outline" onClick={() => void reconciliationQuery.refetch()} disabled={reconciliationQuery.isFetching}>
              {reconciliationQuery.isFetching ? "Reconciling…" : "Refresh reconciliation"}
            </Button>
          </div>
          {settle.error && <p className="text-destructive">{String(settle.error)}</p>}
          {!ready && !completed && (
            <p className="text-muted-foreground">Settlement stays unavailable until the lifecycle/readiness authority reports the edition as eligible.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Edition reconciliation</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {reconciliationQuery.isLoading ? (
            <p>Loading reconciliation…</p>
          ) : !settlementId ? (
            <p>No canonical settlement has been prepared for this edition yet.</p>
          ) : (
            <>
              <p>Settlement: <strong>{text(settlement.status, "unknown")}</strong></p>
              <p>
                Artist payouts: {money(totals.artist_payout_cents)} · Deposit returns: {money(totals.deposit_refund_cents)} · Artist merch shares: {money(totals.merch_share_cents)}
              </p>
              <p>
                Reconciliation: <strong>{Boolean(reconciliation.reconciled) ? "balanced" : "attention required"}</strong>
              </p>
              {discrepancies.length > 0 ? (
                <div className="space-y-1 rounded-md border p-3">
                  {discrepancies.map((item, index) => {
                    const discrepancy = asObject(item);
                    return <p key={`${text(discrepancy.code, "discrepancy")}-${index}`}>{text(discrepancy.code, "Unknown discrepancy")}</p>;
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground">No settlement discrepancies recorded.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Settlement audit trail</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {!settlementId ? <p>No settlement audit trail yet.</p> : report.isLoading ? <p>Loading audit trail…</p> : report.error ? <p className="text-destructive">{String(report.error)}</p> : !reportData ? <p>No settlement report available.</p> : (
            <>
              <p>Career effects: {reportData.effects.length}</p>
              <p>Contract instructions: {reportData.contracts.length}</p>
              <p>Financial result: {money(reportData.financialResult?.net_profit_cents)}</p>
              <p>Settlement events: {reportData.events.length}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
