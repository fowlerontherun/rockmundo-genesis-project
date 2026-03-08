import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, TrendingUp, TrendingDown, DollarSign,
  Shield, Factory, Truck, Music, Home, Disc
} from "lucide-react";

interface EmpireDashboardProps {
  companyId: string;
  companyBalance: number;
}

interface SubsidiaryRevenue {
  type: string;
  name: string;
  revenue: number;
  expenses: number;
  net: number;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  security: <Shield className="h-4 w-4" />,
  factory: <Factory className="h-4 w-4" />,
  logistics: <Truck className="h-4 w-4" />,
  venue: <Music className="h-4 w-4" />,
  rehearsal: <Home className="h-4 w-4" />,
  recording_studio: <Disc className="h-4 w-4" />,
  label: <Building2 className="h-4 w-4" />,
};

export function EmpireDashboard({ companyId, companyBalance }: EmpireDashboardProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["empire-dashboard", companyId],
    queryFn: async () => {
      // Fetch recent transactions for this company
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data: transactions } = await supabase
        .from("company_transactions")
        .select("transaction_type, amount, description, category, created_at")
        .eq("company_id", companyId)
        .gte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: false })
        .limit(2000);

      // Categorize by subsidiary type from description
      const subsidiaryData = new Map<string, SubsidiaryRevenue>();

      for (const tx of transactions || []) {
        const desc = (tx.description || "").toLowerCase();
        let type = "other";
        let name = "Company Operations";

        if (desc.includes("security firm")) { type = "security"; name = extractName(tx.description); }
        else if (desc.includes("factory")) { type = "factory"; name = extractName(tx.description); }
        else if (desc.includes("logistics")) { type = "logistics"; name = extractName(tx.description); }
        else if (desc.includes("venue")) { type = "venue"; name = extractName(tx.description); }
        else if (desc.includes("rehearsal")) { type = "rehearsal"; name = extractName(tx.description); }
        else if (desc.includes("recording studio")) { type = "recording_studio"; name = extractName(tx.description); }
        else if (tx.category === "operations" || tx.category === "payroll" || tx.category === "tax") {
          type = "overhead"; name = "Corporate Overhead";
        }

        const key = `${type}:${name}`;
        const existing = subsidiaryData.get(key) || { type, name, revenue: 0, expenses: 0, net: 0 };
        
        if (tx.amount > 0) {
          existing.revenue += tx.amount;
        } else {
          existing.expenses += Math.abs(tx.amount);
        }
        existing.net = existing.revenue - existing.expenses;
        subsidiaryData.set(key, existing);
      }

      const subsidiaries = Array.from(subsidiaryData.values()).sort((a, b) => b.net - a.net);
      
      const totalRevenue = subsidiaries.reduce((sum, s) => sum + s.revenue, 0);
      const totalExpenses = subsidiaries.reduce((sum, s) => sum + s.expenses, 0);
      const totalNet = totalRevenue - totalExpenses;

      // Fetch label-specific revenue
      const { data: labels } = await supabase
        .from("labels")
        .select("id, name, balance")
        .eq("company_id", companyId);

      let labelTotalBalance = 0;
      for (const label of labels || []) {
        labelTotalBalance += label.balance || 0;
      }

      return {
        subsidiaries,
        totalRevenue,
        totalExpenses,
        totalNet,
        labels: labels || [],
        labelTotalBalance,
        transactionCount: transactions?.length || 0,
      };
    },
    enabled: !!companyId,
  });

  if (isLoading || !data) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Loading empire overview...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Aggregate Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <Building2 className="h-4 w-4 mx-auto text-muted-foreground" />
            <p className="text-lg font-bold">${companyBalance.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">Company Balance</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <TrendingUp className="h-4 w-4 mx-auto text-emerald-500" />
            <p className="text-lg font-bold text-emerald-600">${Math.round(data.totalRevenue).toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">30-Day Revenue</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <TrendingDown className="h-4 w-4 mx-auto text-destructive" />
            <p className="text-lg font-bold text-destructive">${Math.round(data.totalExpenses).toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">30-Day Expenses</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <DollarSign className="h-4 w-4 mx-auto" />
            <p className={`text-lg font-bold ${data.totalNet >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
              {data.totalNet >= 0 ? '+' : ''}${Math.round(data.totalNet).toLocaleString()}
            </p>
            <p className="text-[10px] text-muted-foreground">30-Day Net P&L</p>
          </CardContent>
        </Card>
      </div>

      {/* Label Subsidiaries */}
      {data.labels.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Disc className="h-4 w-4" /> Record Labels
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.labels.map((label) => (
                <div key={label.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <span className="text-sm font-medium">{label.name}</span>
                  <span className={`text-sm font-medium ${(label.balance || 0) >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                    ${(label.balance || 0).toLocaleString()}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 font-semibold text-sm border-t">
                <span>Total Label Assets</span>
                <span className={data.labelTotalBalance >= 0 ? 'text-emerald-600' : 'text-destructive'}>
                  ${data.labelTotalBalance.toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subsidiary Performance Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Subsidiary Performance (30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {data.subsidiaries.length === 0 ? (
            <p className="text-center py-4 text-sm text-muted-foreground">No transactions in the last 30 days</p>
          ) : (
            <div className="space-y-2">
              {data.subsidiaries.map((sub, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{TYPE_ICONS[sub.type] || <Building2 className="h-4 w-4" />}</span>
                    <span className="text-sm">{sub.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-emerald-600">+${Math.round(sub.revenue).toLocaleString()}</span>
                    <span className="text-destructive">-${Math.round(sub.expenses).toLocaleString()}</span>
                    <Badge variant={sub.net >= 0 ? "default" : "destructive"} className="text-[10px]">
                      {sub.net >= 0 ? '+' : ''}${Math.round(sub.net).toLocaleString()}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function extractName(description: string | null): string {
  if (!description) return "Unknown";
  // Extract name from patterns like: Security Firm "Name" — ...
  const match = description.match(/"([^"]+)"/);
  return match ? match[1] : "Unknown";
}
