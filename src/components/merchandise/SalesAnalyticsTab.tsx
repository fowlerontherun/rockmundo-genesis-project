import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  DollarSign, 
  ShoppingBag, 
  Package, 
  TrendingUp, 
  Globe, 
  Store, 
  Users,
  Calendar,
  MapPin,
  Flame,
} from "lucide-react";
import { useMerchSalesAnalytics, TimeRange } from "@/hooks/useMerchSalesAnalytics";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { format } from "date-fns";

interface SalesAnalyticsTabProps {
  bandId: string | null;
}

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'all', label: 'All Time' },
];

const CHANNEL_COLORS = {
  online: '#3b82f6',
  gig: '#f97316',
  store: '#22c55e',
};

const CUSTOMER_COLORS = ['#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const formatCurrency = (value: number) => 
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

export const SalesAnalyticsTab = ({ bandId }: SalesAnalyticsTabProps) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const { data: analytics, isLoading } = useMerchSalesAnalytics(bandId, timeRange);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!analytics) return null;

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex gap-2 flex-wrap">
        {TIME_RANGES.map(range => (
          <Button
            key={range.value}
            variant={timeRange === range.value ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange(range.value)}
          >
            {range.label}
          </Button>
        ))}
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-full">
              <DollarSign className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatCurrency(analytics.totalRevenue)}</p>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-full">
              <ShoppingBag className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{analytics.totalOrders.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Orders</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-full">
              <Package className="h-6 w-6 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{analytics.totalUnits.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Units Sold</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 rounded-full">
              <TrendingUp className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatCurrency(analytics.avgOrderValue)}</p>
              <p className="text-sm text-muted-foreground">Avg Order</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trend Chart */}
      {analytics.revenueByDay.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Revenue Trend</CardTitle>
            <CardDescription>Daily revenue and order volume</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.revenueByDay}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(d) => format(new Date(d), 'MMM d')}
                    className="text-xs"
                  />
                  <YAxis 
                    yAxisId="left"
                    tickFormatter={(v) => `$${v}`}
                    className="text-xs"
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right"
                    className="text-xs"
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      name === 'revenue' ? formatCurrency(value) : value,
                      name === 'revenue' ? 'Revenue' : 'Orders'
                    ]}
                    labelFormatter={(d) => format(new Date(d), 'MMMM d, yyyy')}
                  />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="orders" 
                    stroke="hsl(var(--muted-foreground))" 
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Sales by Channel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Store className="h-5 w-5" />
              Sales by Channel
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.salesByChannel.length > 0 ? (
              <div className="space-y-3">
                {analytics.salesByChannel.map((channel) => (
                  <div key={channel.channel} className="flex items-center justify-between p-2 rounded bg-muted/30">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: CHANNEL_COLORS[channel.channel as keyof typeof CHANNEL_COLORS] || '#888' }}
                      />
                      <span className="capitalize font-medium">{channel.channel}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(channel.revenue)}</p>
                      <p className="text-xs text-muted-foreground">{channel.count} orders</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-4">No sales data yet</p>
            )}
          </CardContent>
        </Card>

        {/* Sales by Country */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Top Countries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              {analytics.salesByCountry.length > 0 ? (
                <div className="space-y-2">
                  {analytics.salesByCountry.map((country, idx) => (
                    <div key={country.country} className="flex items-center justify-between p-2 rounded bg-muted/30">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium w-5">{idx + 1}.</span>
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{country.country}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-sm">{formatCurrency(country.revenue)}</p>
                        <p className="text-xs text-muted-foreground">{country.percentage.toFixed(1)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-4">No geographic data yet</p>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Customer Types */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Customer Types
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.salesByCustomerType.length > 0 ? (
              <div className="space-y-3">
                {analytics.salesByCustomerType.map((cust, idx) => (
                  <div key={cust.type} className="flex items-center justify-between p-2 rounded bg-muted/30">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: CUSTOMER_COLORS[idx % CUSTOMER_COLORS.length] }}
                      />
                      <span className="capitalize font-medium">{cust.type}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(cust.revenue)}</p>
                      <p className="text-xs text-muted-foreground">{cust.count} orders</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-4">No customer data yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Products */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            Top Selling Products
          </CardTitle>
          <CardDescription>Best performers by units sold</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[250px]">
            {analytics.topProducts.length > 0 ? (
              <div className="space-y-2">
                {analytics.topProducts.map((product, idx) => (
                  <div key={product.id} className="flex items-center justify-between p-3 rounded bg-muted/30">
                    <div className="flex items-center gap-3">
                      <Badge variant={idx < 3 ? "default" : "outline"} className="w-8 justify-center">
                        #{idx + 1}
                      </Badge>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.type}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(product.revenue)}</p>
                      <p className="text-xs text-muted-foreground">{product.units} units</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-8">No product sales yet</p>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Gig Sales */}
      {analytics.gigSales.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Gig Merchandise Sales
            </CardTitle>
            <CardDescription>Revenue from live show merchandise</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.gigSales.map((gig) => (
                <div key={gig.gigId} className="flex items-center justify-between p-3 rounded bg-muted/30">
                  <div>
                    <p className="font-medium">{gig.venue}</p>
                    <p className="text-xs text-muted-foreground">{gig.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(gig.revenue)}</p>
                    <p className="text-xs text-muted-foreground">{gig.units} items</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
