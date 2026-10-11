import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, BarChart3 } from "lucide-react";

export function ChartMoversSection() {
  const { data: movers, isPending, isError, refetch } = useQuery({
    queryKey: ["chart-movers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_entries")
        .select(`
          rank,
          trend,
          trend_change,
          weeks_on_chart,
          songs!inner(id, title, band_id, bands(name))
        `)
        .eq("chart_type", "top40")
        .not("trend", "is", null)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      // Get biggest movers (up or down)
      const sorted = (data || [])
        .filter((entry: any) => entry.trend_change && entry.trend_change > 0)
        .sort((a: any, b: any) => (b.trend_change || 0) - (a.trend_change || 0))
        .slice(0, 5);

      return sorted;
    },
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart3 className="h-5 w-5" />
          Chart Movers
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isPending ? (
          <p role="status" className="text-sm text-muted-foreground py-2">Loading chart movement…</p>
        ) : isError ? (
          <div role="alert" className="flex items-center justify-between gap-2 py-2">
            <p className="text-sm text-destructive">Chart movement is unavailable right now.</p>
            <button type="button" className="text-sm underline" onClick={() => void refetch()}>Retry</button>
          </div>
        ) : movers && movers.length > 0 ? (
          movers.map((entry: any) => (
            <div key={entry.songs.id} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                {entry.trend === "up" ? (
                  <ArrowUp className="h-4 w-4 text-green-500" />
                ) : (
                  <ArrowDown className="h-4 w-4 text-red-500" />
                )}
                <div>
                  <p className="font-medium text-sm">{entry.songs.title}</p>
                  <p className="text-xs text-muted-foreground">{entry.songs.bands?.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={entry.trend === "up" ? "default" : "destructive"}>
                  {entry.trend === "up" ? "+" : "-"}{entry.trend_change}
                </Badge>
                <span className="text-sm text-muted-foreground">#{entry.rank}</span>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground py-2">No chart movement today</p>
        )}
      </CardContent>
    </Card>
  );
}
