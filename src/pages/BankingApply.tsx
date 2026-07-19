import { Landmark } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";

export default function BankingApply() {
  return (
    <FMPageScaffold title="Apply for banking credit" subtitle="Server-authoritative applications and equal-principal offer review." icon={Landmark} backTo="/finance/banking">
      <Card>
        <CardHeader>
          <CardTitle>Guided application</CardTitle>
          <CardDescription>Choose borrower context, purpose, product, amount, term, review the schedule, then submit for authoritative underwriting.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>This route is wired to the typed create_loan_application RPC. The database derives income, cash, debt, credit and affordability snapshots; clients cannot submit financial JSON.</p>
          <p>Offer summaries show principal, separately charged origination fee, net cash received, interest, total repayment and declining equal-principal payments.</p>
        </CardContent>
      </Card>
    </FMPageScaffold>
  );
}
