import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Landmark, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, addWeeks } from "date-fns";
import type { PlayerLoan, LoanOffer } from "@/hooks/useFinances";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

interface LoansTabProps {
  loans: PlayerLoan[];
  loanOffers: LoanOffer[];
  cash: number;
}

export const LoansTab = ({ loans, loanOffers, cash }: LoansTabProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedOffer, setSelectedOffer] = useState<LoanOffer | null>(null);
  const [loanAmount, setLoanAmount] = useState("");
  const [isApplying, setIsApplying] = useState(false);
  const [isPaying, setIsPaying] = useState<string | null>(null);

  const activeLoans = loans.filter((l) => l.status === "active");
  const totalDebt = activeLoans.reduce((sum, l) => sum + l.remaining_balance, 0);
  const weeklyPayments = activeLoans.reduce((sum, l) => sum + l.weekly_payment, 0);

  const handleApplyLoan = async () => {
    if (!user?.id || !selectedOffer) return;
    const amount = parseInt(loanAmount);
    
    if (isNaN(amount) || amount <= 0 || amount > selectedOffer.maxAmount) {
      toast.error(`Amount must be between $1 and ${currencyFormatter.format(selectedOffer.maxAmount)}`);
      return;
    }

    // Check if user already has an active loan
    if (activeLoans.length > 0) {
      toast.error("You already have an active loan. Pay it off before taking another.");
      return;
    }

    setIsApplying(true);
    try {
      // Calculate weekly payment (principal + interest divided by term)
      const totalWithInterest = amount * (1 + selectedOffer.interestRate / 100);
      const weeklyPayment = Math.ceil(totalWithInterest / selectedOffer.termWeeks);

      // Create loan
      const { error: loanError } = await supabase.from("player_loans").insert({
        user_id: user.id,
        loan_name: selectedOffer.name,
        principal: amount,
        interest_rate: selectedOffer.interestRate,
        remaining_balance: Math.ceil(totalWithInterest),
        weekly_payment: weeklyPayment,
        due_date: addWeeks(new Date(), selectedOffer.termWeeks).toISOString(),
      });

      if (loanError) throw loanError;

      // Add funds to player's cash
      const { error: cashError } = await supabase
        .from("profiles")
        .update({ cash: cash + amount })
        .eq("user_id", user.id);

      if (cashError) throw cashError;

      toast.success(`Loan approved! ${currencyFormatter.format(amount)} added to your account`);
      setSelectedOffer(null);
      setLoanAmount("");
      queryClient.invalidateQueries({ queryKey: ["player-loans"] });
      queryClient.invalidateQueries({ queryKey: ["profile-cash"] });
    } catch (error) {
      toast.error("Loan application failed");
      console.error(error);
    } finally {
      setIsApplying(false);
    }
  };

  const handlePayment = async (loan: PlayerLoan, amount: number) => {
    if (!user?.id) return;
    if (amount > cash) {
      toast.error("Insufficient funds");
      return;
    }

    setIsPaying(loan.id);
    try {
      const newBalance = Math.max(0, loan.remaining_balance - amount);
      const newStatus = newBalance === 0 ? "paid_off" : "active";

      const { error: loanError } = await supabase
        .from("player_loans")
        .update({
          remaining_balance: newBalance,
          total_paid: loan.total_paid + amount,
          status: newStatus,
        })
        .eq("id", loan.id);

      if (loanError) throw loanError;

      const { error: cashError } = await supabase
        .from("profiles")
        .update({ cash: cash - amount })
        .eq("user_id", user.id);

      if (cashError) throw cashError;

      if (newStatus === "paid_off") {
        toast.success("Loan fully paid off! 🎉");
      } else {
        toast.success(`Payment of ${currencyFormatter.format(amount)} applied`);
      }
      
      queryClient.invalidateQueries({ queryKey: ["player-loans"] });
      queryClient.invalidateQueries({ queryKey: ["profile-cash"] });
    } catch (error) {
      toast.error("Payment failed");
      console.error(error);
    } finally {
      setIsPaying(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Active Loans */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5" />
            Active Loans
          </CardTitle>
          <CardDescription>
            {activeLoans.length === 0 
              ? "No active loans" 
              : `${currencyFormatter.format(totalDebt)} total debt • ${currencyFormatter.format(weeklyPayments)}/week payments`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeLoans.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              You have no outstanding loans. Explore options below if you need financing.
            </p>
          ) : (
            <div className="space-y-4">
              {activeLoans.map((loan) => {
                const paidPercent = ((loan.principal - loan.remaining_balance + loan.total_paid) / (loan.principal * (1 + loan.interest_rate / 100))) * 100;
                const daysUntilDue = Math.ceil((new Date(loan.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                
                return (
                  <Card key={loan.id} className="overflow-hidden">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{loan.loan_name}</CardTitle>
                          <CardDescription>
                            Started {format(new Date(loan.started_at), "MMM d, yyyy")}
                          </CardDescription>
                        </div>
                        <Badge variant={daysUntilDue < 7 ? "destructive" : "outline"}>
                          {daysUntilDue > 0 ? `${daysUntilDue} days left` : "Overdue"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Principal</p>
                          <p className="font-semibold">{currencyFormatter.format(loan.principal)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Remaining</p>
                          <p className="font-semibold text-destructive">{currencyFormatter.format(loan.remaining_balance)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Weekly Payment</p>
                          <p className="font-semibold">{currencyFormatter.format(loan.weekly_payment)}</p>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>Progress</span>
                          <span>{paidPercent.toFixed(0)}% paid</span>
                        </div>
                        <Progress value={paidPercent} className="h-2" />
                      </div>
                    </CardContent>
                    <CardFooter className="gap-2">
                      <Button
                        size="sm"
                        onClick={() => handlePayment(loan, loan.weekly_payment)}
                        disabled={isPaying === loan.id || cash < loan.weekly_payment}
                      >
                        {isPaying === loan.id ? "Processing..." : `Pay ${currencyFormatter.format(loan.weekly_payment)}`}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePayment(loan, loan.remaining_balance)}
                        disabled={isPaying === loan.id || cash < loan.remaining_balance}
                      >
                        Pay Off ({currencyFormatter.format(loan.remaining_balance)})
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paid Off Loans */}
      {loans.filter((l) => l.status === "paid_off").length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Loan History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loan</TableHead>
                  <TableHead>Principal</TableHead>
                  <TableHead>Total Paid</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.filter((l) => l.status === "paid_off").map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell className="font-medium">{loan.loan_name}</TableCell>
                    <TableCell>{currencyFormatter.format(loan.principal)}</TableCell>
                    <TableCell>{currencyFormatter.format(loan.total_paid)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-emerald-500 border-emerald-500/30">
                        Paid Off
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Loan Offers */}
      <Card>
        <CardHeader>
          <CardTitle>Available Loan Offers</CardTitle>
          <CardDescription>Financing options based on your reputation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {loanOffers.map((offer) => (
              <Card key={offer.id} className="relative overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{offer.name}</CardTitle>
                  <CardDescription>Up to {currencyFormatter.format(offer.maxAmount)}</CardDescription>
                </CardHeader>
                <CardContent className="pb-2">
                  <p className="text-sm text-muted-foreground mb-3">{offer.description}</p>
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="text-muted-foreground">Interest:</span>{" "}
                      <span className="font-medium">{offer.interestRate}% APR</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Term:</span>{" "}
                      <span className="font-medium">{offer.termWeeks} weeks</span>
                    </p>
                  </div>
                  <div className="mt-3 space-y-1">
                    <p className="text-xs text-muted-foreground">Requirements:</p>
                    <ul className="text-xs space-y-0.5">
                      {offer.requirements.map((req, i) => (
                        <li key={i} className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {req}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
                <CardFooter>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        size="sm" 
                        className="w-full"
                        variant="outline"
                        onClick={() => {
                          setSelectedOffer(offer);
                          setLoanAmount(Math.floor(offer.maxAmount / 2).toString());
                        }}
                        disabled={activeLoans.length > 0}
                      >
                        {activeLoans.length > 0 ? "Pay Off Existing Loan First" : "Apply"}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Apply for {selectedOffer?.name}</DialogTitle>
                        <DialogDescription>
                          Choose how much you'd like to borrow. Maximum: {currencyFormatter.format(selectedOffer?.maxAmount || 0)}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="loan-amount">Loan Amount</Label>
                          <Input
                            id="loan-amount"
                            type="number"
                            value={loanAmount}
                            onChange={(e) => setLoanAmount(e.target.value)}
                            min={1}
                            max={selectedOffer?.maxAmount}
                          />
                        </div>
                        {selectedOffer && loanAmount && (
                          <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
                            <p className="flex justify-between">
                              <span className="text-muted-foreground">Principal:</span>
                              <span>{currencyFormatter.format(parseInt(loanAmount) || 0)}</span>
                            </p>
                            <p className="flex justify-between">
                              <span className="text-muted-foreground">Interest ({selectedOffer.interestRate}%):</span>
                              <span>{currencyFormatter.format(Math.ceil((parseInt(loanAmount) || 0) * selectedOffer.interestRate / 100))}</span>
                            </p>
                            <p className="flex justify-between font-semibold border-t pt-1">
                              <span>Total Repayment:</span>
                              <span>{currencyFormatter.format(Math.ceil((parseInt(loanAmount) || 0) * (1 + selectedOffer.interestRate / 100)))}</span>
                            </p>
                            <p className="flex justify-between text-muted-foreground">
                              <span>Weekly Payment:</span>
                              <span>{currencyFormatter.format(Math.ceil((parseInt(loanAmount) || 0) * (1 + selectedOffer.interestRate / 100) / selectedOffer.termWeeks))}/week</span>
                            </p>
                          </div>
                        )}
                        <div className="flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-sm">
                          <AlertCircle className="h-4 w-4 text-warning mt-0.5" />
                          <p className="text-warning">
                            Loans must be repaid. Missing payments may affect your reputation.
                          </p>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedOffer(null)}>
                          Cancel
                        </Button>
                        <Button onClick={handleApplyLoan} disabled={isApplying}>
                          {isApplying ? "Processing..." : "Apply for Loan"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardFooter>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
