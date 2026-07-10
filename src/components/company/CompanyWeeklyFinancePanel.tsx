import { AlertTriangle, Receipt, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CompanyWeeklyFinancePanelProps {
  companyId: string;
}

const money = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);

export function CompanyWeeklyFinancePanel({ companyId }: CompanyWeeklyFinancePanelProps) {
  const { data: records = [], isLoading } = useQuery({
    queryKey: ["company-weekly-finance-records", companyId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("company_weekly_finance_records") as any)
        .select("*")
        .eq("company_id", companyId)
        .order("week_start", { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!companyId,
  });

  const latest = records[0];
  const modifiers = latest?.performance_modifiers ?? {};

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Weekly Performance Estimate</CardTitle>
          <CardDescription>Last processed weekly result plus the transparent modifiers used by the finance engine. Estimates are capped and include diminishing staff returns.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading weekly finances...</p> : !latest ? (
            <p className="text-sm text-muted-foreground">No weekly finance run has been recorded yet. The Sunday processor will create the first record.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Gross revenue</p><p className="text-xl font-semibold text-emerald-500">{money(Number(latest.gross_revenue))}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Total costs</p><p className="text-xl font-semibold text-amber-500">{money(Number(latest.total_costs))}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Net profit / loss</p><p className={`text-xl font-semibold ${Number(latest.net_profit) >= 0 ? "text-emerald-500" : "text-destructive"}`}>{money(Number(latest.net_profit))}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Balance after</p><p className="text-xl font-semibold">{money(Number(latest.balance_after))}</p></div>
            </div>
          )}
          {latest?.unpaid_amount > 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive" />
              <p><strong>Financial warning:</strong> {money(Number(latest.unpaid_amount))} could not be covered. Wages are suspended and performance penalties apply until funded.</p>
            </div>
          )}
          {latest && (
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(modifiers).map(([key, value]) => <Badge key={key} variant="outline">{key}: {Number(value).toFixed(2)}</Badge>)}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> Weekly Finance History</CardTitle>
          <CardDescription>Revenue, costs, profit/loss, and balance movement are retained for auditability.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {records.map((record) => (
            <div key={record.id} className="grid gap-2 rounded-lg border p-3 text-sm md:grid-cols-6">
              <span>{record.week_start} → {record.week_end}</span>
              <span>Revenue {money(Number(record.gross_revenue))}</span>
              <span>Wages {money(Number(record.staff_wage_costs))}</span>
              <span>Costs {money(Number(record.total_costs))}</span>
              <span className={Number(record.net_profit) >= 0 ? "text-emerald-500" : "text-destructive"}>{money(Number(record.net_profit))}</span>
              <Badge variant={record.processing_status === "processed" ? "secondary" : "destructive"}>{record.processing_status}</Badge>
            </div>
          ))}
          {records.length === 0 && <p className="text-sm text-muted-foreground">No weekly records yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
