import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  AlertTriangle,
  Clock,
  CheckCircle,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  useCompanyBalance,
  useCompanyTransactions,
  useUserCashBalance,
  useDepositToCompany,
  useWithdrawFromCompany,
} from "@/hooks/useCompanyFinance";

interface CompanyFinanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName: string;
}

const MINIMUM_BALANCE = 10_000;

export function CompanyFinanceDialog({ open, onOpenChange, companyId, companyName }: CompanyFinanceDialogProps) {
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const { data: companyData, isLoading: loadingCompany } = useCompanyBalance(companyId);
  const { data: profileData } = useUserCashBalance();
  const { data: transactions = [] } = useCompanyTransactions(companyId);
  
  const depositMutation = useDepositToCompany();
  const withdrawMutation = useWithdrawFromCompany();

  const balance = Number(companyData?.balance ?? 0);
  const personalBalance = Number(profileData?.cash ?? 0);
  const isNegative = balance < 0;
  const isBankrupt = companyData?.is_bankrupt ?? false;
  const weeklyCosts = Number(companyData?.weekly_operating_costs ?? 0);

  const daysUntilBankruptcy = companyData?.negative_balance_since 
    ? Math.max(0, 7 - Math.floor((Date.now() - new Date(companyData.negative_balance_since).getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  const getBalanceHealth = () => {
    if (isBankrupt) return { color: "text-destructive", bg: "bg-destructive/10", label: "BANKRUPT" };
    if (isNegative) return { color: "text-destructive", bg: "bg-destructive/10", label: "Critical" };
    if (balance < MINIMUM_BALANCE) return { color: "text-amber-500", bg: "bg-amber-500/10", label: "Low" };
    if (balance < 100_000) return { color: "text-yellow-500", bg: "bg-yellow-500/10", label: "Moderate" };
    return { color: "text-emerald-500", bg: "bg-emerald-500/10", label: "Healthy" };
  };

  const health = getBalanceHealth();

  const handleDeposit = async () => {
    const amount = Number(depositAmount);
    if (!amount || amount <= 0) return;
    if (!profileData?.id) return;

    await depositMutation.mutateAsync({ 
      companyId, 
      amount, 
      profileId: profileData.id 
    });
    setDepositAmount("");
  };

  const handleWithdraw = async () => {
    const amount = Number(withdrawAmount);
    if (!amount || amount <= 0) return;
    if (!profileData?.id) return;

    await withdrawMutation.mutateAsync({ 
      companyId, 
      amount, 
      profileId: profileData.id 
    });
    setWithdrawAmount("");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'investment':
        return <ArrowUpCircle className="h-4 w-4 text-emerald-500" />;
      case 'dividend':
        return <ArrowDownCircle className="h-4 w-4 text-amber-500" />;
      case 'income':
        return <TrendingUp className="h-4 w-4 text-emerald-500" />;
      case 'expense':
      case 'salary':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <DollarSign className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const maxWithdraw = Math.max(0, balance - MINIMUM_BALANCE);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            {companyName} - Finances
          </DialogTitle>
          <DialogDescription>
            Manage company funds, view transactions, and monitor financial health
          </DialogDescription>
        </DialogHeader>

        {loadingCompany ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="deposit">Deposit</TabsTrigger>
              <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {/* Balance Card */}
              <Card className={cn("border-2", health.bg, `border-${health.color.replace('text-', '')}`)}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Company Balance</CardTitle>
                    <Badge className={cn(health.bg, health.color)}>{health.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className={cn("text-3xl font-bold", health.color)}>
                    {formatCurrency(balance)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Weekly costs: {formatCurrency(weeklyCosts)}
                  </p>
                  
                  {daysUntilBankruptcy !== null && daysUntilBankruptcy <= 7 && (
                    <Alert variant="destructive" className="mt-3">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        {daysUntilBankruptcy === 0 
                          ? "Company is bankrupt! Inject funds immediately."
                          : `${daysUntilBankruptcy} days until bankruptcy if balance remains negative.`
                        }
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* Personal Balance */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Your Personal Cash</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold text-emerald-500">
                    {formatCurrency(personalBalance)}
                  </p>
                </CardContent>
              </Card>

              {/* Recent Transactions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recent Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    {transactions.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No transactions yet
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {transactions.map((tx) => (
                          <div 
                            key={tx.id} 
                            className="flex items-center justify-between py-2 border-b border-border last:border-0"
                          >
                            <div className="flex items-center gap-3">
                              {getTransactionIcon(tx.transaction_type)}
                              <div>
                                <p className="text-sm font-medium capitalize">
                                  {tx.transaction_type.replace('_', ' ')}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {tx.description || format(new Date(tx.created_at), "MMM d, yyyy")}
                                </p>
                              </div>
                            </div>
                            <p className={cn(
                              "text-sm font-medium",
                              tx.amount >= 0 ? "text-emerald-500" : "text-red-500"
                            )}>
                              {tx.amount >= 0 ? "+" : ""}{formatCurrency(tx.amount)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="deposit" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Deposit Funds</CardTitle>
                  <CardDescription>
                    Transfer money from your personal cash to the company
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="text-sm">Your Cash:</span>
                    <span className="font-medium">{formatCurrency(personalBalance)}</span>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="deposit">Amount to Deposit</Label>
                    <div className="flex gap-2">
                      <Input
                        id="deposit"
                        type="number"
                        placeholder="Enter amount..."
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        min={0}
                        max={personalBalance}
                      />
                      <Button 
                        variant="outline" 
                        onClick={() => setDepositAmount(String(personalBalance))}
                      >
                        Max
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {[10000, 50000, 100000].map((amount) => (
                      <Button
                        key={amount}
                        variant="outline"
                        size="sm"
                        onClick={() => setDepositAmount(String(Math.min(amount, personalBalance)))}
                        disabled={personalBalance < amount}
                      >
                        +{formatCurrency(amount)}
                      </Button>
                    ))}
                  </div>

                  <Button 
                    className="w-full" 
                    onClick={handleDeposit}
                    disabled={
                      depositMutation.isPending || 
                      !depositAmount || 
                      Number(depositAmount) <= 0 ||
                      Number(depositAmount) > personalBalance
                    }
                  >
                    {depositMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <ArrowUpCircle className="h-4 w-4 mr-2" />
                    )}
                    Deposit {depositAmount ? formatCurrency(Number(depositAmount)) : ""}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="withdraw" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Withdraw Funds</CardTitle>
                  <CardDescription>
                    Transfer money from the company to your personal cash
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="text-sm">Company Balance:</span>
                    <span className={cn("font-medium", isNegative && "text-destructive")}>
                      {formatCurrency(balance)}
                    </span>
                  </div>
                  
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Minimum balance of {formatCurrency(MINIMUM_BALANCE)} must remain.
                      Max withdrawal: {formatCurrency(maxWithdraw)}
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label htmlFor="withdraw">Amount to Withdraw</Label>
                    <div className="flex gap-2">
                      <Input
                        id="withdraw"
                        type="number"
                        placeholder="Enter amount..."
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        min={0}
                        max={maxWithdraw}
                      />
                      <Button 
                        variant="outline" 
                        onClick={() => setWithdrawAmount(String(maxWithdraw))}
                        disabled={maxWithdraw <= 0}
                      >
                        Max
                      </Button>
                    </div>
                  </div>

                  <Button 
                    className="w-full" 
                    variant="secondary"
                    onClick={handleWithdraw}
                    disabled={
                      withdrawMutation.isPending || 
                      !withdrawAmount || 
                      Number(withdrawAmount) <= 0 ||
                      Number(withdrawAmount) > maxWithdraw
                    }
                  >
                    {withdrawMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <ArrowDownCircle className="h-4 w-4 mr-2" />
                    )}
                    Withdraw {withdrawAmount ? formatCurrency(Number(withdrawAmount)) : ""}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
