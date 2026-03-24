import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowUpCircle,
  ArrowDownCircle,
  AlertTriangle,
  Clock,
  Users,
  BarChart3,
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

interface UnifiedTransaction {
  id: string;
  amount: number;
  description: string | null;
  transaction_type: string;
  created_at: string;
  source: "deposit_withdrawal" | "revenue";
}

export function LabelFinanceTab({ labelId, labelBalance, isBankrupt, balanceWentNegativeAt }: LabelFinanceTabProps) {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: profileData } = useQuery({
    queryKey: ["user-balance", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      if (!profileId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, cash")
        .eq("id", profileId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Deposit/withdrawal transactions
  const { data: depositTransactions = [] } = useQuery({
    queryKey: ["label-transactions", labelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("label_transactions")
        .select("*")
        .eq("label_id", labelId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  // Revenue/expense transactions from label_financial_transactions
  const { data: financialTransactions = [] } = useQuery({
    queryKey: ["label-financials", labelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("label_financial_transactions")
        .select("*")
        .eq("label_id", labelId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  // Per-artist revenue breakdown: contracts + band names
  const { data: artistBreakdown = [] } = useQuery({
    queryKey: ["label-artist-breakdown", labelId],
    queryFn: async () => {
      // Get all contracts for this label
      const { data: contracts, error: cErr } = await supabase
        .from("artist_label_contracts")
        .select("id, band_id, royalty_artist_pct, royalty_label_pct, advance_amount, recouped_amount, status")
        .eq("label_id", labelId);
      if (cErr) throw cErr;
      if (!contracts?.length) return [];

      // Get band names
      const bandIds = [...new Set(contracts.map(c => c.band_id).filter(Boolean))];
      const { data: bands } = await supabase
        .from("bands")
        .select("id, name")
        .in("id", bandIds);
      const bandMap = new Map((bands || []).map(b => [b.id, b.name]));

      // Get revenue per contract
      const contractIds = contracts.map(c => c.id);
      const { data: revTx } = await supabase
        .from("label_financial_transactions")
        .select("related_contract_id, transaction_type, amount")
        .eq("label_id", labelId)
        .in("related_contract_id", contractIds);

      // Aggregate per contract
      const contractRevMap = new Map<string, { revenue: number; marketing: number; expenses: number }>();
      (revTx || []).forEach(tx => {
        const cid = tx.related_contract_id;
        if (!cid) return;
        if (!contractRevMap.has(cid)) contractRevMap.set(cid, { revenue: 0, marketing: 0, expenses: 0 });
        const entry = contractRevMap.get(cid)!;
        if (tx.transaction_type === "revenue") entry.revenue += tx.amount;
        else if (tx.transaction_type === "marketing") entry.marketing += Math.abs(tx.amount);
        else entry.expenses += Math.abs(tx.amount);
      });

      return contracts.map(c => ({
        contractId: c.id,
        bandName: bandMap.get(c.band_id!) || "Unknown Artist",
        status: c.status || "active",
        royaltyArtistPct: c.royalty_artist_pct,
        royaltyLabelPct: c.royalty_label_pct,
        advanceAmount: c.advance_amount || 0,
        recoupedAmount: c.recouped_amount || 0,
        totalRevenue: contractRevMap.get(c.id)?.revenue || 0,
        totalMarketing: contractRevMap.get(c.id)?.marketing || 0,
        totalExpenses: contractRevMap.get(c.id)?.expenses || 0,
      }));
    },
  });

  // Merge transactions into unified timeline
  const unifiedTransactions = useMemo<UnifiedTransaction[]>(() => {
    const merged: UnifiedTransaction[] = [];
    depositTransactions.forEach((tx: any) => {
      merged.push({
        id: tx.id,
        amount: tx.amount,
        description: tx.description,
        transaction_type: tx.transaction_type,
        created_at: tx.created_at,
        source: "deposit_withdrawal",
      });
    });
    financialTransactions.forEach((tx: any) => {
      merged.push({
        id: tx.id,
        amount: tx.amount,
        description: tx.description,
        transaction_type: tx.transaction_type,
        created_at: tx.created_at,
        source: "revenue",
      });
    });
    merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return merged.slice(0, 100);
  }, [depositTransactions, financialTransactions]);

  // Summary stats from financial transactions
  const summaryStats = useMemo(() => {
    let totalRevenue = 0;
    let totalMarketing = 0;
    let totalExpenses = 0;
    financialTransactions.forEach((tx: any) => {
      if (tx.transaction_type === "revenue") totalRevenue += tx.amount;
      else if (tx.transaction_type === "marketing") totalMarketing += Math.abs(tx.amount);
      else if (["expense", "overhead", "advance", "royalty_payment"].includes(tx.transaction_type)) {
        totalExpenses += Math.abs(tx.amount);
      }
    });
    return { totalRevenue, totalMarketing, totalExpenses, netPL: totalRevenue - totalMarketing - totalExpenses };
  }, [financialTransactions]);

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
    queryClient.invalidateQueries({ queryKey: ["user-balance", profileId] });
    queryClient.invalidateQueries({ queryKey: ["label-transactions", labelId] });
    queryClient.invalidateQueries({ queryKey: ["label-financials", labelId] });
    queryClient.invalidateQueries({ queryKey: ["label-artist-breakdown", labelId] });
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

  const getTxColor = (type: string, amount: number) => {
    if (type === "revenue") return "text-emerald-500";
    if (type === "deposit") return "text-emerald-500";
    if (type === "marketing") return "text-purple-500";
    if (type === "transfer" && amount > 0) return "text-emerald-500";
    if (amount > 0) return "text-emerald-500";
    return "text-destructive";
  };

  const getTxIcon = (type: string, amount: number) => {
    if (type === "revenue" || type === "deposit" || amount > 0) {
      return <ArrowUpCircle className="h-4 w-4 text-emerald-500" />;
    }
    return <ArrowDownCircle className="h-4 w-4 text-destructive" />;
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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="artists">Artists</TabsTrigger>
          <TabsTrigger value="transfer">Deposit / Withdraw</TabsTrigger>
          <TabsTrigger value="upgrades">Upgrades</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Summary cards */}
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2 p-3">
                <CardDescription className="text-xs">Label Balance</CardDescription>
                <CardTitle className={cn("text-lg md:text-2xl", health.color)}>${balance.toLocaleString()}</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <Badge className={cn(health.bg, health.color, "border-0 text-xs")}>{health.label}</Badge>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 p-3">
                <CardDescription className="text-xs flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Total Revenue</CardDescription>
                <CardTitle className="text-lg md:text-2xl text-emerald-500">${summaryStats.totalRevenue.toLocaleString()}</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <p className="text-xs text-muted-foreground">From signed artists</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 p-3">
                <CardDescription className="text-xs flex items-center gap-1"><BarChart3 className="h-3 w-3" /> Marketing Spend</CardDescription>
                <CardTitle className="text-lg md:text-2xl text-purple-500">${summaryStats.totalMarketing.toLocaleString()}</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <p className="text-xs text-muted-foreground">Campaigns & promos</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 p-3">
                <CardDescription className="text-xs">Net P&L</CardDescription>
                <CardTitle className={cn("text-lg md:text-2xl", summaryStats.netPL >= 0 ? "text-emerald-500" : "text-destructive")}>
                  {summaryStats.netPL >= 0 ? "+" : ""}${summaryStats.netPL.toLocaleString()}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <p className="text-xs text-muted-foreground">Revenue − expenses</p>
              </CardContent>
            </Card>
          </div>

          {/* Personal balance */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Your Personal Balance</CardDescription>
              <CardTitle className="text-xl">${personalBalance.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>

          {/* Unified transaction feed */}
          <Card>
            <CardHeader><CardTitle className="text-lg">All Transactions</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                {unifiedTransactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No transactions yet</p>
                ) : (
                  <div className="space-y-2">
                    {unifiedTransactions.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="flex items-center gap-2">
                          {getTxIcon(tx.transaction_type, tx.amount)}
                          <div>
                            <p className="text-sm font-medium capitalize">{tx.transaction_type.replace(/_/g, " ")}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">{tx.description}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={cn("text-sm font-medium", getTxColor(tx.transaction_type, tx.amount))}>
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

        {/* Per-Artist Breakdown Tab */}
        <TabsContent value="artists" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5" /> Signed Artist Revenue Breakdown
              </CardTitle>
              <CardDescription>Revenue, advances, and recoupment per signed artist</CardDescription>
            </CardHeader>
            <CardContent>
              {artistBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No signed artists yet</p>
              ) : (
                <ResponsiveTable>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Artist</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Label Rev</TableHead>
                        <TableHead className="text-right">Marketing</TableHead>
                        <TableHead className="text-right">Advance</TableHead>
                        <TableHead className="text-right">Recouped</TableHead>
                        <TableHead className="text-right">Net</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {artistBreakdown.map((artist) => {
                        const outstanding = Math.max(0, artist.advanceAmount - artist.recoupedAmount);
                        const net = artist.totalRevenue - artist.totalMarketing - artist.totalExpenses;
                        return (
                          <TableRow key={artist.contractId}>
                            <TableCell className="font-medium">{artist.bandName}</TableCell>
                            <TableCell>
                              <Badge variant={artist.status === "active" ? "default" : "secondary"} className="text-xs capitalize">
                                {artist.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-emerald-500">${artist.totalRevenue.toLocaleString()}</TableCell>
                            <TableCell className="text-right text-purple-500">${artist.totalMarketing.toLocaleString()}</TableCell>
                            <TableCell className="text-right">${artist.advanceAmount.toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                              <span className={outstanding > 0 ? "text-amber-500" : "text-emerald-500"}>
                                ${artist.recoupedAmount.toLocaleString()}
                                {outstanding > 0 && (
                                  <span className="text-xs text-muted-foreground ml-1">(-${outstanding.toLocaleString()})</span>
                                )}
                              </span>
                            </TableCell>
                            <TableCell className={cn("text-right font-medium", net >= 0 ? "text-emerald-500" : "text-destructive")}>
                              {net >= 0 ? "+" : ""}${net.toLocaleString()}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {/* Totals row */}
                      <TableRow className="font-bold border-t-2">
                        <TableCell>Total</TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right text-emerald-500">
                          ${artistBreakdown.reduce((s, a) => s + a.totalRevenue, 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-purple-500">
                          ${artistBreakdown.reduce((s, a) => s + a.totalMarketing, 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          ${artistBreakdown.reduce((s, a) => s + a.advanceAmount, 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          ${artistBreakdown.reduce((s, a) => s + a.recoupedAmount, 0).toLocaleString()}
                        </TableCell>
                        <TableCell className={cn("text-right", summaryStats.netPL >= 0 ? "text-emerald-500" : "text-destructive")}>
                          {summaryStats.netPL >= 0 ? "+" : ""}${summaryStats.netPL.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </ResponsiveTable>
              )}
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
