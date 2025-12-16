import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { DollarSign, TrendingUp, TrendingDown, Wallet } from "lucide-react";

const COLORS = ["hsl(var(--primary))", "hsl(142.1 76.2% 36.3%)", "hsl(262.1 83.3% 57.8%)", "hsl(24.6 95% 53.1%)", "hsl(173.4 80.4% 40%)"];

export function FinancialStats() {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["financial-stats", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Get current cash
      const { data: profile } = await supabase
        .from("profiles")
        .select("cash")
        .eq("user_id", user.id)
        .single();

      // Get earnings by source
      const { data: earnings } = await supabase
        .from("band_earnings")
        .select("source, amount")
        .eq("earned_by_user_id", user.id);

      const earningsBySource: Record<string, number> = {};
      earnings?.forEach((e) => {
        earningsBySource[e.source] = (earningsBySource[e.source] || 0) + e.amount;
      });

      const totalEarnings = Object.values(earningsBySource).reduce((sum, v) => sum + v, 0);

      // Get expenses (from experience_ledger where earnings is negative or specific activity types)
      const { data: expenses } = await supabase
        .from("experience_ledger")
        .select("activity_type, metadata")
        .eq("user_id", user.id)
        .in("activity_type", ["therapy", "nutrition", "travel", "equipment_purchase"]);

      let totalExpenses = 0;
      expenses?.forEach((e) => {
        const cost = (e.metadata as any)?.cost || 0;
        totalExpenses += cost;
      });

      // Format for pie chart
      const incomeData = Object.entries(earningsBySource)
        .map(([name, value]) => ({
          name: name.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
          value,
        }))
        .filter(d => d.value > 0)
        .sort((a, b) => b.value - a.value);

      return {
        currentCash: profile?.cash || 0,
        totalEarnings,
        totalExpenses,
        netProfit: totalEarnings - totalExpenses,
        incomeData,
      };
    },
    enabled: !!user?.id,
  });

  if (!stats) return <div>Loading financial stats...</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              Current Cash
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${stats.currentCash.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Total Earnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">${stats.totalEarnings.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Total Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">${stats.totalExpenses.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              Net Profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${stats.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
              ${stats.netProfit.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Income Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.incomeData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.incomeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {stats.incomeData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`$${value.toLocaleString()}`, "Amount"]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No income data yet. Start playing gigs and releasing music!
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
