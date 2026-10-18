import { useEffect, useRef, useState } from "react";
import { Landmark } from "lucide-react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import {
  formatCurrencyMinor, getLoanDetails, getLoanSchedule, listLoanPaymentAttempts,
  retryLoanPayment, type LoanDetail, type LoanScheduleLine,
} from "@/services/banking/bankingService";

type PaymentAttempt = { key: string; contractId: string; lineId: string };

export default function BankingLoanDetail() {
  const { loanId } = useParams();
  const { profileId, userId } = useActiveProfile();
  const scope = `${userId ?? ""}:${profileId ?? ""}:${loanId ?? ""}`;
  const activeScopeRef = useRef(scope);
  activeScopeRef.current = scope;
  const pendingRequest = useRef<string | null>(null);
  const keysByLine = useRef<Map<string, PaymentAttempt>>(new Map());
  const [detail, setDetail] = useState<LoanDetail | null>(null);
  const [schedule, setSchedule] = useState<LoanScheduleLine[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [retryingLineId, setRetryingLineId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    keysByLine.current.clear();
    pendingRequest.current = null;
    setDetail(null);
    setSchedule([]);
    setAttempts([]);
    setError(undefined);
    setMessage(undefined);
    setRetryingLineId(null);
    setLoading(true);
    if (!loanId || !profileId || !userId) {
      setLoading(false);
      return () => { cancelled = true; };
    }
    void Promise.all([getLoanDetails(loanId), getLoanSchedule(loanId), listLoanPaymentAttempts(loanId)])
      .then(([loan, lines, paymentAttempts]) => {
        if (cancelled) return;
        if (!loan) throw new Error("Loan not found or access denied.");
        setDetail(loan);
        setSchedule(lines);
        setAttempts(paymentAttempts);
      })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Loan data could not be loaded."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [loanId, profileId, userId]);

  async function retry(lineId: string) {
    if (!loanId || !profileId || !userId || loading || !detail || pendingRequest.current) return;
    const line = schedule.find((item) => item.id === lineId);
    if (!line || line.status === "paid" || line.totalDueMinor <= line.amountPaidMinor) return;
    const startingScope = scope;
    const attempt: PaymentAttempt = keysByLine.current.get(lineId) ??
      { key: `retry-${crypto.randomUUID()}`, contractId: loanId, lineId };
    keysByLine.current.set(lineId, attempt);
    pendingRequest.current = startingScope;
    setRetryingLineId(lineId);
    setError(undefined);
    setMessage(undefined);
    try {
      // Retries after timeouts use the original key; never issue two independent
      // payment attempts from a double click.
      await retryLoanPayment({
        loanContractId: attempt.contractId, scheduleLineId: attempt.lineId,
        idempotencyKey: attempt.key,
      });
      const [verifiedLoan, verifiedSchedule, verifiedAttempts] = await Promise.all([
        getLoanDetails(loanId), getLoanSchedule(loanId), listLoanPaymentAttempts(loanId),
      ]);
      if (!verifiedLoan || verifiedLoan.id !== loanId) {
        throw new Error("Payment status could not be verified. Retry to check it.");
      }
      const verifiedLine = verifiedSchedule.find((item) => item.id === lineId);
      if (!verifiedLine) throw new Error("Repayment schedule could not be verified. Retry to check it.");
      if (activeScopeRef.current !== startingScope) return;
      setDetail(verifiedLoan);
      setSchedule(verifiedSchedule);
      setAttempts(verifiedAttempts);
      setMessage(verifiedLine.status === "paid"
        ? "Payment confirmed by the bank."
        : `Payment request processed; instalment is ${verifiedLine.status}. Check the schedule before trying again.`);
      if (verifiedLine.status === "paid") keysByLine.current.delete(lineId);
    } catch (err) {
      if (activeScopeRef.current === startingScope) {
        setError(err instanceof Error ? err.message : "Payment status is unknown. Retry to verify using the same request.");
      }
    } finally {
      if (pendingRequest.current === startingScope) pendingRequest.current = null;
      if (activeScopeRef.current === startingScope) setRetryingLineId(null);
    }
  }

  return (
    <FMPageScaffold title="Loan details" subtitle="Real schedule, payment history and retry controls." icon={Landmark} backTo="/finance/banking">
      <Card>
        <CardHeader><CardTitle>{detail?.providerName ?? "Loan"}</CardTitle><CardDescription>{loanId}</CardDescription></CardHeader>
        <CardContent className="space-y-4 text-sm">
          {loading && <p role="status">Loading loan details...</p>}
          {error && <p role="alert" className="text-destructive">{error}</p>}
          {!loading && !profileId && <p role="status">Select an active character to view a loan.</p>}
          {detail && <div className="grid gap-2 md:grid-cols-3"><p>Status: {detail.status}</p><p>Principal: {formatCurrencyMinor(detail.principalMinor, detail.currencyCode)}</p><p>Outstanding: {formatCurrencyMinor(detail.outstandingPrincipalMinor, detail.currencyCode)}</p><p>Rate: {detail.interestRateBps / 100}%</p><p>Fee: {formatCurrencyMinor(detail.originationFeeMinor, detail.currencyCode)}</p><p>Next exact payment: {formatCurrencyMinor(detail.nextPaymentMinor, detail.currencyCode)} on {detail.nextPaymentDate ?? "—"}</p></div>}
          <div><h3 className="font-semibold">Schedule</h3>{schedule.map((line) => (
            <div key={line.id} className="flex items-center justify-between border-b py-2">
              <span>#{line.instalmentNumber} {line.dueDate} · {line.status}</span>
              <span>{formatCurrencyMinor(line.totalDueMinor - line.amountPaidMinor, detail?.currencyCode ?? "USD")}</span>
              {line.status !== "paid" && line.totalDueMinor > line.amountPaidMinor &&
                <Button size="sm" variant="outline"
                  disabled={!detail || loading || retryingLineId !== null}
                  onClick={() => { void retry(line.id); }}>
                  {retryingLineId === line.id ? "Checking..." : "Retry"}
                </Button>}
            </div>
          ))}</div>
          <div><h3 className="font-semibold">Payment attempts</h3>{attempts.map((attempt) => <p key={attempt.id}>{attempt.createdAt}: {formatCurrencyMinor(attempt.amountMinor, detail?.currencyCode ?? "USD")} ({attempt.paymentType})</p>)}</div>
          {message && <p role="status" className="text-muted-foreground">{message}</p>}
        </CardContent>
      </Card>
    </FMPageScaffold>
  );
}
