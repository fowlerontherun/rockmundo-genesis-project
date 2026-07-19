import { Landmark } from "lucide-react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";

export default function BankingLoanDetail() {
  const { loanId } = useParams();
  return (
    <FMPageScaffold title="Loan details" subtitle="Schedule, payment history, retry, settlement and partial repayment controls." icon={Landmark} backTo="/finance/banking">
      <Card>
        <CardHeader>
          <CardTitle>Loan lifecycle</CardTitle>
          <CardDescription>Loan {loanId}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>The backing RPC inventory now includes detail, schedule, retry, settlement quote, settlement and partial-principal repayment entry points for this route.</p>
          <p>Provider accounting splits principal, interest and fees so repayment history can reconcile to receivable, interest-income and fee-income accounts.</p>
        </CardContent>
      </Card>
    </FMPageScaffold>
  );
}
