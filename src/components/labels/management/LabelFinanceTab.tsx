import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowUpCircle,
  ArrowDownCircle,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { LabelUpgradesTab } from "../LabelUpgradesTab";

interface LabelFinanceTabProps {
  labelId: string;
  labelBalance: number;
  isBankrupt: boolean;
  balanceWentNegativeAt: string | null;
}

const MINIMUM_BALANCE = 100_000;

export function LabelFinanceTab({ labelId, labelBalance, isBankrupt, balanceWentNegativeAt }: LabelFinanceTabProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: profileData } = useQuery({
    queryKey: ["user-balance", user?.id],
    enabled: !!user?.id,
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

  const { data: transactions = [] } = useQuery({
    queryKey: ["label-transactions", labelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("label_transactions")
        .select("*")
        .eq("label_id", labelId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const personalBalance = Number(profileData?.cash ?? 0);
  const balance = labelBalance;
  const isNegative = balance < 0;

  const daysUntilBankruptcy = balanceWentNegativeAt
    ? Math.max(0, 5 - Math.floor((Date.now() - new Date(balanceWentNegativeAt).getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  const getHealth = () => {
    if (isBankrupt) return { color: "text-destructive", bg: "bg-destructive/10", label: "BANKRUPT" };
    if (isNegative) return { color: "text-destructive", bg: "bg-destructive/10", label: "Critical" };
    if (balance < MINIMUM_BALANCE) return { color: "text-amber-500", bg: "bg-amber-500/10", label: "Low" };
    if (balance < 500_000) return { color: "text-yellow-500", bg: "bg-yellow-500/10", label: "Moderate" };
    return { color: "text-emerald-500", bg: "bg-emerald-500/10", label: "Healthy" };
  };
  const health = getHealth();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["label-finance", labelId] });
    queryClient.invalidateQueries({ queryKey: ["label-management", labelId] });
    queryClient.invalidateQueries({ queryKey: ["user-balance", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["label-transactions", labelId] });
    queryClient.invalidateQueries({ queryKey: ["my-labels"] });
  };

  const handleDeposit = async () => {
    const amount = Number(depositAmount);
    if (!amount || amount <= 0 || amount > personalBalance) {
      toast.error(amount > personalBalance ? "Insufficient personal funds" : "Invalid amount");
      return;
    }
    setIsProcessing(true);
    try {
      await supabase.from("profiles").update({ cash: personalBalance - amount }).eq("id", profileData!.id);
      const newBalance = balance + amount;
      await supabase.from("labels").update({
        balance: newBalance,
        balance_went_negative_at: newBalance >= 0 ? null : balanceWentNegativeAt,
        is_bankrupt: newBalance >= MINIMUM_BALANCE ? false : isBankrupt,
      }).eq("id", labelId);
      await supabase.from("label_transactions").insert({
        label_id: labelId, transaction_type: "deposit", amount, description: "Owner deposit", initiated_by: profileData!.id,
      });
      toast.success(`$${amount.toLocaleString()} deposited`);
      setDepositAmount("");
      invalidateAll();
    } catch { toast.error("Deposit failed"); }
    finally { setIsProcessing(false); }
  };

  const maxWithdraw = Math.max(0, balance - MINIMUM_BALANCE);

  const handleWithdraw = async () => {
    const amount = Number(withdrawAmount);
    if (!amount || amount <= 0 || amount > maxWithdraw) {
      toast.error("Invalid amount or exceeds max withdrawal");
      return;
    }
    setIsProcessing(true);
    try {
      await supabase.from("profiles").update({ cash: personalBalance + amount }).eq("id", profileData!.id);
      await supabase.from("labels").update({ balance: balance - amount }).eq("id", labelId);
      await supabase.from("label_transactions").insert({
        label_id: labelId, transaction_type: "withdrawal", amount: -amount, description: "Owner withdrawal", initiated_by: profileData!.id,
      });
      toast.success(`$${amount.toLocaleString()} withdrawn`);
      setWithdrawAmount("");
      invalidateAll();
    } catch { toast.error("Withdrawal failed"); }
    finally { setIsProcessing(false); }
  };

  return (
    <div className="space-y-4">
      {isBankrupt && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>BANKRUPT — Deposit at least ${MINIMUM_BALANCE.toLocaleString()} to restore operations.</AlertDescription>
        </Alert>
      )}
      {isNegative && !isBankrupt && daysUntilBankruptcy !== null && (
        <Alert variant="destructive">
          <Clock className="h-4 w-4" />
          <AlertDescription>{daysUntilBankruptcy} days until bankruptcy! Deposit funds immediately.</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview">
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
                <CardTitle className={cn("text-2xl", health.color)}>${balance.toLocaleString()}</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge className={cn(health.bg, health.color, "border-0")}>{health.label}</Badge>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Your Personal Balance</CardDescription>
                <CardTitle className="text-2xl">${personalBalance.toLocaleString()}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Available for deposit</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-lg">Recent Transactions</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-48">
                {transactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No transactions yet</p>
                ) : (
                  <div className="space-y-2">
                    {transactions.map((tx: any) => (
                      <div key={tx.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="flex items-center gap-2">
                          {tx.amount > 0 ? <ArrowUpCircle className="h-4 w-4 text-emerald-500" /> : <ArrowDownCircle className="h-4 w-4 text-destructive" />}
                          <div>
                            <p className="text-sm font-medium capitalize">{tx.transaction_type.replace(/_/g, " ")}</p>
                            <p className="text-xs text-muted-foreground">{tx.description}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cn("text-sm font-medium", tx.amount > 0 ? "text-emerald-500" : "text-destructive")}>
                            {tx.amount > 0 ? "+" : ""}${Math.abs(tx.amount).toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}</p>
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
                  <TrendingUp className="h-5 w-5 text-emerald-500" /> Deposit
                </CardTitle>
                <CardDescription>Transfer from personal funds to label</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="0" className="pl-8" min={0} max={personalBalance} />
                  </div>
                  <p className="text-xs text-muted-foreground">Available: ${personalBalance.toLocaleString()}</p>
                </div>
                <Button onClick={handleDeposit} disabled={isProcessing || !depositAmount || Number(depositAmount) <= 0} className="w-full">
                  {isProcessing ? "Processing..." : "Deposit"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingDown className="h-5 w-5 text-amber-500" /> Withdraw
                </CardTitle>
                <CardDescription>Transfer from label to personal funds</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="0" className="pl-8" min={0} max={maxWithdraw} />
                  </div>
                  <p className="text-xs text-muted-foreground">Max: ${maxWithdraw.toLocaleString()} (min balance: ${MINIMUM_BALANCE.toLocaleString()})</p>
                </div>
                <Button onClick={handleWithdraw} disabled={isProcessing || !withdrawAmount || Number(withdrawAmount) <= 0 || Number(withdrawAmount) > maxWithdraw} variant="outline" className="w-full">
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
    </div>
  );
}
