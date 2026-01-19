import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Wallet, TrendingUp } from "lucide-react";
import { format } from "date-fns";

export const EarningsNews = () => {
  const { user } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");

  // Get user's bands
  const { data: userBands } = useQuery({
    queryKey: ["user-bands-earnings", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("band_members")
        .select("band_id, bands(id, name)")
        .eq("user_id", user.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const bandIds = userBands?.map((b) => b.band_id) || [];

  // Get today's earnings
  const { data: earnings } = useQuery({
    queryKey: ["news-earnings", bandIds, today],
    queryFn: async () => {
      if (bandIds.length === 0) return [];
      const { data, error } = await supabase
        .from("band_earnings")
        .select("amount, source, description, created_at, band_id")
        .in("band_id", bandIds)
        .gte("created_at", `${today}T00:00:00`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: bandIds.length > 0,
  });

  // Group by source
  const sourceStats = new Map<string, number>();
  let totalEarnings = 0;

  earnings?.forEach((e) => {
    sourceStats.set(e.source, (sourceStats.get(e.source) || 0) + e.amount);
    totalEarnings += e.amount;
  });

  const sortedSources = Array.from(sourceStats.entries()).sort((a, b) => b[1] - a[1]);

  if (totalEarnings === 0) {
    return null;
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);

  const getSourceIcon = (source: string) => {
    switch (source) {
      case "gig": return "🎤";
      case "merchandise": return "👕";
      case "streaming": return "🎵";
      case "royalties": return "💿";
      case "sponsorship": return "🤝";
      default: return "💰";
    }
  };

  return (
    <Card className="border-emerald-500/20 bg-emerald-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Wallet className="h-5 w-5 text-emerald-500" />
          Today's Earnings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-500" />
            <span className="font-medium">Total Earned</span>
          </div>
          <span className="text-xl font-bold text-emerald-500">
            {formatCurrency(totalEarnings)}
          </span>
        </div>

        {/* Breakdown by source */}
        <div className="space-y-2">
          {sortedSources.map(([source, amount]) => (
            <div
              key={source}
              className="flex items-center justify-between text-sm"
            >
              <span className="flex items-center gap-2">
                <span>{getSourceIcon(source)}</span>
                <span className="capitalize">{source}</span>
              </span>
              <Badge variant="outline">{formatCurrency(amount)}</Badge>
            </div>
          ))}
        </div>

        {/* Recent transactions */}
        {earnings && earnings.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">Recent</p>
            <div className="space-y-1">
              {earnings.slice(0, 3).map((e, idx) => (
                <div key={idx} className="text-xs flex justify-between">
                  <span className="truncate max-w-[200px] text-muted-foreground">
                    {e.description || e.source}
                  </span>
                  <span className="font-medium text-emerald-500">
                    +{formatCurrency(e.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};