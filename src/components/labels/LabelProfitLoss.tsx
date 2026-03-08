import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  TrendingUp, TrendingDown, DollarSign, Users, Disc3, 
  ArrowUpRight, ArrowDownRight, Scale 
} from "lucide-react";

interface LabelProfitLossProps {
  labelId: string;
  labelBalance: number;
}

export function LabelProfitLoss({ labelId, labelBalance }: LabelProfitLossProps) {
  const { data: plData, isLoading } = useQuery({
    queryKey: ["label-profit-loss", labelId],
    queryFn: async () => {
      // Fetch all transactions for this label
      const { data: transactions, error } = await supabase
        .from("label_financial_transactions")
        .select("transaction_type, amount, description, created_at")
        .eq("label_id", labelId)
        .order("created_at", { ascending: false })
        .limit(2000);

      if (error) throw error;

      // Fetch staff costs
      const { data: staff } = await supabase
        .from("label_staff")
        .select("salary_monthly, role")
        .eq("label_id", labelId);

      // Fetch active contracts
      const { data: contracts } = await supabase
        .from("artist_label_contracts")
        .select("id, advance_amount, recouped_amount, royalty_artist_pct, status")
        .eq("label_id", labelId)
        .eq("status", "active");

      // Categorize revenue and expenses
      let royaltyRevenue = 0;
      let salesRevenue = 0;
      let streamingRevenue = 0;
      let manufacturingCosts = 0;
      let advancePaid = 0;
      let marketingCosts = 0;
      let overheadCosts = 0;
      let otherExpenses = 0;
      let otherRevenue = 0;

      for (const tx of transactions || []) {
        const amount = Math.abs(tx.amount || 0);
        const desc = (tx.description || "").toLowerCase();

        if (tx.transaction_type === "revenue" || tx.transaction_type === "royalty_payment") {
          if (desc.includes("stream")) streamingRevenue += amount;
          else if (desc.includes("sale") || desc.includes("sales")) salesRevenue += amount;
          else royaltyRevenue += amount;
        } else if (tx.transaction_type === "expense") {
          if (desc.includes("manufactur")) manufacturingCosts += amount;
          else if (desc.includes("marketing") || desc.includes("promotion")) marketingCosts += amount;
          else overheadCosts += amount;
        } else if (tx.transaction_type === "advance") {
          advancePaid += amount;
        } else if (tx.transaction_type === "marketing") {
          marketingCosts += amount;
        } else if (tx.transaction_type === "overhead") {
          overheadCosts += amount;
        } else if (tx.transaction_type === "distribution") {
          otherExpenses += amount;
        } else {
          if (tx.amount > 0) otherRevenue += amount;
          else otherExpenses += amount;
        }
      }

      const monthlySalaries = (staff || []).reduce((sum, s) => sum + (s.salary_monthly || 0), 0);
      const totalAdvancesOutstanding = (contracts || []).reduce(
        (sum, c) => sum + Math.max(0, (c.advance_amount || 0) - (c.recouped_amount || 0)), 0
      );

      const totalRevenue = royaltyRevenue + salesRevenue + streamingRevenue + otherRevenue;
      const totalExpenses = manufacturingCosts + advancePaid + marketingCosts + overheadCosts + otherExpenses;
      const netProfit = totalRevenue - totalExpenses;

      return {
        royaltyRevenue,
        salesRevenue,
        streamingRevenue,
        otherRevenue,
        totalRevenue,
        manufacturingCosts,
        advancePaid,
        marketingCosts,
        overheadCosts,
        otherExpenses,
        totalExpenses,
        netProfit,
        monthlySalaries,
        totalAdvancesOutstanding,
        activeContracts: contracts?.length || 0,
        staffCount: staff?.length || 0,
      };
    },
    enabled: !!labelId,
  });

  if (isLoading || !plData) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Loading financial summary...
        </CardContent>
      </Card>
    );
  }

  const isProfitable = plData.netProfit >= 0;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <DollarSign className="h-4 w-4 mx-auto text-muted-foreground" />
            <p className="text-lg font-bold">${labelBalance.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">Current Balance</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <TrendingUp className="h-4 w-4 mx-auto text-emerald-500" />
            <p className="text-lg font-bold text-emerald-600">${plData.totalRevenue.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">Total Revenue</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <TrendingDown className="h-4 w-4 mx-auto text-destructive" />
            <p className="text-lg font-bold text-destructive">${plData.totalExpenses.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">Total Expenses</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Scale className="h-4 w-4 mx-auto" />
            <p className={`text-lg font-bold ${isProfitable ? 'text-emerald-600' : 'text-destructive'}`}>
              {isProfitable ? '+' : '-'}${Math.abs(plData.netProfit).toLocaleString()}
            </p>
            <p className="text-[10px] text-muted-foreground">Net Profit</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed P&L */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Scale className="h-4 w-4" />
            Profit & Loss Statement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {/* Revenue */}
          <div>
            <p className="font-semibold text-emerald-600 flex items-center gap-1 mb-2">
              <ArrowUpRight className="h-3.5 w-3.5" /> Revenue
            </p>
            <div className="space-y-1 pl-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Royalty Revenue</span>
                <span>${plData.royaltyRevenue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sales Revenue</span>
                <span>${plData.salesRevenue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Streaming Revenue</span>
                <span>${plData.streamingRevenue.toLocaleString()}</span>
              </div>
              {plData.otherRevenue > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Other Revenue</span>
                  <span>${plData.otherRevenue.toLocaleString()}</span>
                </div>
              )}
              <Separator className="my-1" />
              <div className="flex justify-between font-semibold">
                <span>Total Revenue</span>
                <span className="text-emerald-600">${plData.totalRevenue.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Expenses */}
          <div>
            <p className="font-semibold text-destructive flex items-center gap-1 mb-2">
              <ArrowDownRight className="h-3.5 w-3.5" /> Expenses
            </p>
            <div className="space-y-1 pl-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Artist Advances</span>
                <span>${plData.advancePaid.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Manufacturing</span>
                <span>${plData.manufacturingCosts.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Marketing & Promotion</span>
                <span>${plData.marketingCosts.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Overhead</span>
                <span>${plData.overheadCosts.toLocaleString()}</span>
              </div>
              {plData.otherExpenses > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Other</span>
                  <span>${plData.otherExpenses.toLocaleString()}</span>
                </div>
              )}
              <Separator className="my-1" />
              <div className="flex justify-between font-semibold">
                <span>Total Expenses</span>
                <span className="text-destructive">${plData.totalExpenses.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Bottom Line */}
          <div className="flex justify-between font-bold text-base">
            <span>Net Profit / (Loss)</span>
            <span className={isProfitable ? 'text-emerald-600' : 'text-destructive'}>
              {isProfitable ? '+' : '('}${Math.abs(plData.netProfit).toLocaleString()}{!isProfitable ? ')' : ''}
            </span>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-3 gap-2 pt-2 text-center border-t">
            <div>
              <p className="text-xs text-muted-foreground">Monthly Salaries</p>
              <p className="font-semibold text-sm">${plData.monthlySalaries.toLocaleString()}/mo</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Outstanding Advances</p>
              <p className="font-semibold text-sm">${plData.totalAdvancesOutstanding.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Active Artists</p>
              <p className="font-semibold text-sm">{plData.activeContracts} artists / {plData.staffCount} staff</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
