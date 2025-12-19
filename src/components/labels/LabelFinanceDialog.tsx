import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  AlertTriangle,
  Clock,
  CheckCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LabelUpgradesTab } from "./LabelUpgradesTab";

interface LabelFinanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labelId: string;
  labelName: string;
}

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  description: string | null;
  created_at: string;
}

export function LabelFinanceDialog({ open, onOpenChange, labelId, labelName }: LabelFinanceDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const MINIMUM_BALANCE = 100_000;

  // Fetch label balance and details
  const { data: labelData, isLoading: loadingLabel } = useQuery({
    queryKey: ["label-finance", labelId],
    enabled: open && !!labelId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("labels")
        .select("id, name, balance, balance_went_negative_at, is_bankrupt")
        .eq("id", labelId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Fetch user's personal balance
  const { data: profileData } = useQuery({
    queryKey: ["user-balance", user?.id],
    enabled: open && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, cash")
        .eq("user_id", user!.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Fetch transactions
  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ["label-transactions", labelId],
    enabled: open && !!labelId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("label_transactions")
        .select("*")
        .eq("label_id", labelId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Transaction[];
    },
  });

  const balance = Number(labelData?.balance ?? 0);
  const personalBalance = Number(profileData?.cash ?? 0);
  const isNegative = balance < 0;
  const isBankrupt = labelData?.is_bankrupt ?? false;

  // Calculate days until bankruptcy
  const daysUntilBankruptcy = labelData?.balance_went_negative_at 
    ? Math.max(0, 5 - Math.floor((Date.now() - new Date(labelData.balance_went_negative_at).getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  const getBalanceHealth = () => {
    if (isBankrupt) return { color: "text-destructive", bg: "bg-destructive/10", label: "BANKRUPT" };
    if (isNegative) return { color: "text-destructive", bg: "bg-destructive/10", label: "Critical" };
    if (balance < MINIMUM_BALANCE) return { color: "text-amber-500", bg: "bg-amber-500/10", label: "Low" };
    if (balance < 500_000) return { color: "text-yellow-500", bg: "bg-yellow-500/10", label: "Moderate" };
    return { color: "text-emerald-500", bg: "bg-emerald-500/10", label: "Healthy" };
  };

  const health = getBalanceHealth();

  const handleDeposit = async () => {
    const amount = Number(depositAmount);
    if (!amount || amount <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    if (amount > personalBalance) {
      toast({ title: "Insufficient personal funds", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    try {
      // Deduct from personal balance
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ cash: personalBalance - amount })
        .eq("id", profileData!.id);

      if (profileError) throw profileError;

      // Add to label balance
      const newBalance = balance + amount;
      const { error: labelError } = await supabase
        .from("labels")
        .update({ 
          balance: newBalance,
          balance_went_negative_at: newBalance >= 0 ? null : labelData?.balance_went_negative_at,
          is_bankrupt: newBalance >= MINIMUM_BALANCE ? false : labelData?.is_bankrupt
        })
        .eq("id", labelId);

      if (labelError) throw labelError;

      // Record transaction
      await supabase.from("label_transactions").insert({
        label_id: labelId,
        transaction_type: "deposit",
        amount: amount,
        description: "Owner deposit",
        initiated_by: profileData!.id,
      });

      toast({ title: "Deposit successful", description: `$${amount.toLocaleString()} deposited to label` });
      setDepositAmount("");
      queryClient.invalidateQueries({ queryKey: ["label-finance", labelId] });
      queryClient.invalidateQueries({ queryKey: ["user-balance", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["label-transactions", labelId] });
      queryClient.invalidateQueries({ queryKey: ["my-labels"] });
    } catch (error) {
      console.error(error);
      toast({ title: "Deposit failed", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = Number(withdrawAmount);
    if (!amount || amount <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    if (balance - amount < MINIMUM_BALANCE) {
      toast({ 
        title: "Minimum balance required", 
        description: `Label must maintain at least $${MINIMUM_BALANCE.toLocaleString()} balance`,
        variant: "destructive" 
      });
      return;
    }

    setIsProcessing(true);
    try {
      // Add to personal balance
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ cash: personalBalance + amount })
        .eq("id", profileData!.id);

      if (profileError) throw profileError;

      // Deduct from label balance
      const { error: labelError } = await supabase
        .from("labels")
        .update({ balance: balance - amount })
        .eq("id", labelId);

      if (labelError) throw labelError;

      // Record transaction
      await supabase.from("label_transactions").insert({
        label_id: labelId,
        transaction_type: "withdrawal",
        amount: -amount,
        description: "Owner withdrawal",
        initiated_by: profileData!.id,
      });

      toast({ title: "Withdrawal successful", description: `$${amount.toLocaleString()} withdrawn to personal account` });
      setWithdrawAmount("");
      queryClient.invalidateQueries({ queryKey: ["label-finance", labelId] });
      queryClient.invalidateQueries({ queryKey: ["user-balance", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["label-transactions", labelId] });
      queryClient.invalidateQueries({ queryKey: ["my-labels"] });
    } catch (error) {
      console.error(error);
      toast({ title: "Withdrawal failed", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const getTransactionIcon = (type: string, amount: number) => {
    if (amount > 0) return <ArrowUpCircle className="h-4 w-4 text-emerald-500" />;
    return <ArrowDownCircle className="h-4 w-4 text-destructive" />;
  };

  const maxWithdraw = Math.max(0, balance - MINIMUM_BALANCE);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Label Finances: {labelName}</DialogTitle>
          <DialogDescription>
            Manage your label's financial operations, deposits, withdrawals, and upgrades.
          </DialogDescription>
        </DialogHeader>

        {isBankrupt && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This label is BANKRUPT. Deposit at least ${MINIMUM_BALANCE.toLocaleString()} to restore operations.
            </AlertDescription>
          </Alert>
        )}

        {isNegative && !isBankrupt && daysUntilBankruptcy !== null && (
          <Alert variant="destructive">
            <Clock className="h-4 w-4" />
            <AlertDescription>
              Warning: {daysUntilBankruptcy} days until bankruptcy! Deposit funds immediately.
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="transfer">Deposit / Withdraw</TabsTrigger>
            <TabsTrigger value="upgrades">Upgrades</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Label Balance</CardDescription>
                  <CardTitle className={cn("text-2xl", health.color)}>
                    ${balance.toLocaleString()}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge className={cn(health.bg, health.color, "border-0")}>
                    {health.label}
                  </Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Your Personal Balance</CardDescription>
                  <CardTitle className="text-2xl">
                    ${personalBalance.toLocaleString()}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Available for deposit</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  {transactions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No transactions yet</p>
                  ) : (
                    <div className="space-y-2">
                      {transactions.map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div className="flex items-center gap-2">
                            {getTransactionIcon(tx.transaction_type, tx.amount)}
                            <div>
                              <p className="text-sm font-medium capitalize">{tx.transaction_type.replace(/_/g, " ")}</p>
                              <p className="text-xs text-muted-foreground">{tx.description}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={cn("text-sm font-medium", tx.amount > 0 ? "text-emerald-500" : "text-destructive")}>
                              {tx.amount > 0 ? "+" : ""}${Math.abs(tx.amount).toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(tx.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transfer" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                    Deposit
                  </CardTitle>
                  <CardDescription>Transfer from personal funds to label</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                          placeholder="0"
                          className="pl-8"
                          min={0}
                          max={personalBalance}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Available: ${personalBalance.toLocaleString()}
                    </p>
                  </div>
                  <Button 
                    onClick={handleDeposit} 
                    disabled={isProcessing || !depositAmount || Number(depositAmount) <= 0}
                    className="w-full"
                  >
                    {isProcessing ? "Processing..." : "Deposit"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TrendingDown className="h-5 w-5 text-amber-500" />
                    Withdraw
                  </CardTitle>
                  <CardDescription>Transfer from label to personal funds</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          value={withdrawAmount}
                          onChange={(e) => setWithdrawAmount(e.target.value)}
                          placeholder="0"
                          className="pl-8"
                          min={0}
                          max={maxWithdraw}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Max withdraw: ${maxWithdraw.toLocaleString()} (min balance: ${MINIMUM_BALANCE.toLocaleString()})
                    </p>
                  </div>
                  <Button 
                    onClick={handleWithdraw} 
                    disabled={isProcessing || !withdrawAmount || Number(withdrawAmount) <= 0 || Number(withdrawAmount) > maxWithdraw}
                    variant="outline"
                    className="w-full"
                  >
                    {isProcessing ? "Processing..." : "Withdraw"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="upgrades">
            <LabelUpgradesTab labelId={labelId} labelBalance={balance} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}