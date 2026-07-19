import { useEffect, useState } from "react";
import { Landmark } from "lucide-react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { formatCurrencyMinor, getLoanDetails, getLoanSchedule, listLoanPaymentAttempts, retryLoanPayment, type LoanDetail, type LoanScheduleLine } from "@/services/banking/bankingService";

export default function BankingLoanDetail() {
  const { loanId } = useParams();
  const [detail, setDetail] = useState<LoanDetail | null>(null);
  const [schedule, setSchedule] = useState<LoanScheduleLine[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    if (!loanId) return;
    void Promise.all([getLoanDetails(loanId), getLoanSchedule(loanId), listLoanPaymentAttempts(loanId)]).then(([loan, lines, paymentAttempts]) => { setDetail(loan); setSchedule(lines); setAttempts(paymentAttempts); }).catch((error) => setMessage(error.message));
  }, [loanId]);

  async function retry(lineId: string) {
    if (!loanId) return;
    const result = await retryLoanPayment({ loanContractId: loanId, scheduleLineId: lineId, idempotencyKey: `retry-${crypto.randomUUID()}` });
    setMessage(`Payment ${result.status}`);
    setSchedule(await getLoanSchedule(loanId));
    setAttempts(await listLoanPaymentAttempts(loanId));
  }

  return (
    <FMPageScaffold title="Loan details" subtitle="Real schedule, payment history and retry controls." icon={Landmark} backTo="/finance/banking">
      <Card>
        <CardHeader><CardTitle>{detail?.providerName ?? "Loan"}</CardTitle><CardDescription>{loanId}</CardDescription></CardHeader>
        <CardContent className="space-y-4 text-sm">
          {detail && <div className="grid gap-2 md:grid-cols-3"><p>Status: {detail.status}</p><p>Principal: {formatCurrencyMinor(detail.principalMinor, detail.currencyCode)}</p><p>Outstanding: {formatCurrencyMinor(detail.outstandingPrincipalMinor, detail.currencyCode)}</p><p>Rate: {detail.interestRateBps / 100}%</p><p>Fee: {formatCurrencyMinor(detail.originationFeeMinor, detail.currencyCode)}</p><p>Next exact payment: {formatCurrencyMinor(detail.nextPaymentMinor, detail.currencyCode)} on {detail.nextPaymentDate ?? "—"}</p></div>}
          <div><h3 className="font-semibold">Schedule</h3>{schedule.map((line) => <div key={line.id} className="flex items-center justify-between border-b py-2"><span>#{line.instalmentNumber} {line.dueDate} · {line.status}</span><span>{formatCurrencyMinor(line.totalDueMinor - line.amountPaidMinor, detail?.currencyCode ?? "USD")}</span>{line.status !== "paid" && <Button size="sm" variant="outline" onClick={() => retry(line.id)}>Retry</Button>}</div>)}</div>
          <div><h3 className="font-semibold">Payment attempts</h3>{attempts.map((attempt) => <p key={attempt.id}>{attempt.createdAt}: {formatCurrencyMinor(attempt.amountMinor, detail?.currencyCode ?? "USD")} ({attempt.paymentType})</p>)}</div>
          {message && <p className="text-muted-foreground">{message}</p>}
        </CardContent>
      </Card>
    </FMPageScaffold>
  );
}
