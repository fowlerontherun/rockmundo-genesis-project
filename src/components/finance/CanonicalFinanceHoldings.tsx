import { Link } from "react-router-dom";
import { AlertTriangle, Landmark, PiggyBank, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { OtherCurrencyBalance } from "@/lib/api/financeCommandCenter";
import { formatMinorMoney, formatMoney } from "@/lib/financeFormatting";
import type { PlayerInvestment, PlayerLoan } from "@/hooks/useFinances";

export const CanonicalInvestmentsPanel = ({
  investments,
  currencyCode,
}: {
  investments: PlayerInvestment[];
  currencyCode: string;
}) => {
  const totalInvested = investments.reduce((sum, item) => sum + item.invested_amount, 0);
  const currentValue = investments.reduce((sum, item) => sum + item.current_value, 0);

  return (
    <div className="space-y-4">
      <LegacyMutationNotice
        title="Investment trading is temporarily read-only"
        body="The old buy and withdraw buttons edited compatibility cash directly. They are disabled until ledger-backed investment transactions are available."
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><PiggyBank className="h-5 w-5" /> Investment portfolio</CardTitle>
          <CardDescription>
            {formatMoney(currentValue, currencyCode)} current value from {formatMoney(totalInvested, currencyCode)} invested
          </CardDescription>
        </CardHeader>
        <CardContent>
          {investments.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No canonical investment positions are recorded.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Investment</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Invested</TableHead><TableHead className="text-right">Current value</TableHead><TableHead className="text-right">Return</TableHead></TableRow></TableHeader>
              <TableBody>
                {investments.map((investment) => {
                  const gain = investment.current_value - investment.invested_amount;
                  return (
                    <TableRow key={investment.id}>
                      <TableCell className="font-medium">{investment.investment_name}</TableCell>
                      <TableCell><Badge variant="outline">{investment.category}</Badge></TableCell>
                      <TableCell className="text-right">{formatMoney(investment.invested_amount, investment.currencyCode)}</TableCell>
                      <TableCell className="text-right">{formatMoney(investment.current_value, investment.currencyCode)}</TableCell>
                      <TableCell className={`text-right font-medium ${gain >= 0 ? "text-fm-good" : "text-fm-bad"}`}>
                        {gain >= 0 ? "+" : ""}{formatMoney(gain, investment.currencyCode)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export const CanonicalLoansPanel = ({ loans }: { loans: PlayerLoan[] }) => {
  const activeLoans = loans.filter((loan) => !["paid_off", "written_off", "cancelled"].includes(loan.status));

  return (
    <div className="space-y-4">
      <LegacyMutationNotice
        title="Loan actions are managed by the banking system"
        body="Legacy borrowing and repayment buttons edited old loan rows and compatibility cash. This view now shows canonical loan contracts only."
        showBankingLink
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Landmark className="h-5 w-5" /> Canonical loan contracts</CardTitle>
          <CardDescription>{activeLoans.length} active agreement{activeLoans.length === 1 ? "" : "s"}</CardDescription>
        </CardHeader>
        <CardContent>
          {activeLoans.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No active canonical loans.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Lender and purpose</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Principal</TableHead><TableHead className="text-right">Outstanding</TableHead><TableHead className="text-right">Scheduled payment</TableHead><TableHead>Maturity</TableHead></TableRow></TableHeader>
              <TableBody>
                {activeLoans.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell className="font-medium capitalize">{loan.loan_name}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{loan.status.replaceAll("_", " ")}</Badge></TableCell>
                    <TableCell className="text-right">{formatMoney(loan.principal, loan.currencyCode)}</TableCell>
                    <TableCell className="text-right text-fm-bad">{formatMoney(loan.remaining_balance, loan.currencyCode)}</TableCell>
                    <TableCell className="text-right">{formatMoney(loan.weekly_payment, loan.currencyCode)}</TableCell>
                    <TableCell>{new Date(loan.due_date).toLocaleDateString("en-GB")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export const OtherCurrencyBalancesPanel = ({
  balances,
}: {
  balances: OtherCurrencyBalance[];
}) => {
  if (!balances.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><WalletCards className="h-5 w-5" /> Other currency holdings</CardTitle>
        <CardDescription>Shown separately because no exchange rate is being assumed.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {balances.map((balance) => (
          <div key={balance.currencyCode} className="rounded-lg border p-3">
            <p className="text-xs font-medium text-muted-foreground">{balance.currencyCode}</p>
            <p className="text-xl font-semibold">{formatMinorMoney(balance.balanceMinor, balance.currencyCode)}</p>
            <p className="text-xs text-muted-foreground">Available {formatMinorMoney(balance.availableBalanceMinor, balance.currencyCode)}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export const LegacyMutationNotice = ({
  title,
  body,
  showBankingLink = false,
}: {
  title: string;
  body: string;
  showBankingLink?: boolean;
}) => (
  <Card className="border-amber-500/40">
    <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <div><p className="font-medium">{title}</p><p className="text-sm text-muted-foreground">{body}</p></div>
      </div>
      {showBankingLink && <Button asChild size="sm" variant="outline"><Link to="/finance/banking">Open Banking</Link></Button>}
    </CardContent>
  </Card>
);
