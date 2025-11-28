import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { TrendingUp, Ticket } from "lucide-react";
import { format, parseISO } from "date-fns";

interface TicketSalesChartProps {
  salesData: Array<{
    sale_date: string;
    tickets_sold: number;
    revenue: number;
  }>;
  venueCapacity: number;
  currentlySold: number;
}

export const TicketSalesChart = ({ salesData, venueCapacity, currentlySold }: TicketSalesChartProps) => {
  const chartData = salesData.map((sale) => ({
    date: format(parseISO(sale.sale_date), 'MMM dd'),
    sold: sale.tickets_sold,
    revenue: sale.revenue,
  }));

  const selloutPercentage = ((currentlySold / venueCapacity) * 100).toFixed(1);

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            Ticket Sales Tracking
          </span>
          <div className="text-right">
            <div className="text-2xl font-bold">{currentlySold}</div>
            <div className="text-xs text-muted-foreground">
              {selloutPercentage}% of capacity
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {chartData.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-md">
                          <p className="text-sm font-medium">{payload[0].payload.date}</p>
                          <p className="text-sm text-primary">
                            Tickets: {payload[0].value}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Revenue: ${payload[0].payload.revenue}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="sold"
                  stroke="hsl(var(--primary))"
                  fill="url(#salesGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <p className="text-muted-foreground">Total Revenue (Pre-sales)</p>
                <p className="text-xl font-bold text-green-600">
                  ${salesData.reduce((sum, s) => sum + s.revenue, 0).toLocaleString()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Remaining Tickets</p>
                <p className="text-xl font-bold">
                  {venueCapacity - currentlySold}
                </p>
              </div>
            </div>

            {currentlySold / venueCapacity >= 0.9 && (
              <div className="flex items-center gap-2 rounded-lg bg-primary/10 p-3 text-sm">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="font-medium text-primary">
                  Nearly sold out! This is going to be a packed show!
                </span>
              </div>
            )}
          </>
        ) : (
          <p className="text-center text-sm text-muted-foreground py-8">
            Ticket sales will be tracked as the gig date approaches
          </p>
        )}
      </CardContent>
    </Card>
  );
};
