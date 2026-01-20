import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useChartHistory, ChartType } from "@/hooks/useCountryCharts";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { TrendingUp } from "lucide-react";

interface ChartHistoryDialogProps {
  songId: string;
  chartType: ChartType;
  isOpen: boolean;
  onClose: () => void;
}

export function ChartHistoryDialog({ songId, chartType, isOpen, onClose }: ChartHistoryDialogProps) {
  const { data: history = [], isLoading } = useChartHistory(songId, chartType);

  // Invert rank for display (lower rank = higher on chart = higher line)
  const chartData = history.map(point => ({
    ...point,
    displayRank: 51 - point.rank, // Invert so #1 is at top
    formattedDate: format(new Date(point.date), "MMM d"),
  }));

  const highestRank = history.length > 0 ? Math.min(...history.map(h => h.rank)) : 0;
  const weeksOnChart = history.length;
  const currentRank = history.length > 0 ? history[history.length - 1].rank : 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Chart History
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : history.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            No chart history available for this song
          </div>
        ) : (
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-accent/50 rounded-lg p-3">
                <div className="text-2xl font-bold text-primary">#{highestRank}</div>
                <div className="text-xs text-muted-foreground">Peak Position</div>
              </div>
              <div className="bg-accent/50 rounded-lg p-3">
                <div className="text-2xl font-bold">#{currentRank}</div>
                <div className="text-xs text-muted-foreground">Current Position</div>
              </div>
              <div className="bg-accent/50 rounded-lg p-3">
                <div className="text-2xl font-bold">{weeksOnChart}</div>
                <div className="text-xs text-muted-foreground">Days on Chart</div>
              </div>
            </div>

            {/* Chart */}
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="formattedDate" 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis 
                    domain={[0, 50]}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `#${51 - value}`}
                    className="text-muted-foreground"
                  />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-popover border rounded-lg p-2 shadow-md">
                          <p className="text-sm font-medium">{data.formattedDate}</p>
                          <p className="text-sm text-primary">Position: #{data.rank}</p>
                          <p className="text-xs text-muted-foreground">
                            {data.plays_count.toLocaleString()} plays
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="displayRank" 
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))", strokeWidth: 0, r: 3 }}
                    activeDot={{ r: 5, fill: "hsl(var(--primary))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
