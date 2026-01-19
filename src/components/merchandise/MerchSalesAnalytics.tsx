import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DollarSign, ShoppingBag, TrendingUp, Package, Store, Calendar, Users, Globe, Flame, MapPin } from "lucide-react";
import { useMerchSales } from "@/hooks/useMerchSales";
import { formatDistanceToNow } from "date-fns";

interface MerchSalesAnalyticsProps {
  bandId: string | null;
}

export const MerchSalesAnalytics = ({ bandId }: MerchSalesAnalyticsProps) => {
  const { orders, analytics, isLoading } = useMerchSales(bandId);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="animate-pulse h-16 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

  // Calculate sales by country
  const countrySales = new Map<string, { revenue: number; orders: number }>();
  orders?.forEach((order: any) => {
    if (order.country) {
      const existing = countrySales.get(order.country) || { revenue: 0, orders: 0 };
      countrySales.set(order.country, {
        revenue: existing.revenue + order.total_price,
        orders: existing.orders + 1,
      });
    }
  });
  const sortedCountries = Array.from(countrySales.entries())
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 8);

  // Calculate sales by product
  const productSales = new Map<string, { revenue: number; quantity: number; type: string }>();
  orders?.forEach((order: any) => {
    const name = order.merchandise?.design_name || "Unknown";
    const type = order.merchandise?.item_type || "Unknown";
    const existing = productSales.get(name) || { revenue: 0, quantity: 0, type };
    productSales.set(name, {
      revenue: existing.revenue + order.total_price,
      quantity: existing.quantity + order.quantity,
      type,
    });
  });
  const sortedProducts = Array.from(productSales.entries())
    .sort((a, b) => b[1].quantity - a[1].quantity);

  // Calculate hot products (most sales in last 24 hours)
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const recentProductSales = new Map<string, number>();
  orders?.forEach((order: any) => {
    const orderDate = new Date(order.created_at);
    if (orderDate >= dayAgo) {
      const name = order.merchandise?.design_name || "Unknown";
      recentProductSales.set(name, (recentProductSales.get(name) || 0) + order.quantity);
    }
  });
  const hotProducts = Array.from(recentProductSales.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{formatCurrency(analytics.totalRevenue)}</p>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <ShoppingBag className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{analytics.totalOrders}</p>
              <p className="text-sm text-muted-foreground">Orders</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-2xl font-bold">{analytics.totalUnitsSold}</p>
              <p className="text-sm text-muted-foreground">Units Sold</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-2xl font-bold">{formatCurrency(analytics.avgOrderValue)}</p>
              <p className="text-sm text-muted-foreground">Avg Order</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hot Products Banner */}
      {hotProducts.length > 0 && (
        <Card className="border-orange-500/30 bg-gradient-to-r from-orange-500/10 to-yellow-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/20 rounded-full">
                <Flame className="h-6 w-6 text-orange-500" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-orange-500">🔥 Hot Right Now</p>
                <p className="text-sm text-muted-foreground">Trending in the last 24 hours</p>
              </div>
              <div className="flex gap-2 flex-wrap justify-end">
                {hotProducts.map(([name, qty], idx) => (
                  <Badge 
                    key={name} 
                    variant={idx === 0 ? "default" : "secondary"}
                    className={idx === 0 ? "bg-orange-500" : ""}
                  >
                    {name}: {qty} sold
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Sales by Channel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sales by Channel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(analytics.salesByType).length > 0 ? (
              Object.entries(analytics.salesByType).map(([type, revenue]) => (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {type === "gig" && <Calendar className="h-4 w-4 text-orange-500" />}
                    {type === "online" && <Store className="h-4 w-4 text-blue-500" />}
                    {type === "store" && <Store className="h-4 w-4 text-green-500" />}
                    <span className="capitalize">{type}</span>
                  </div>
                  <span className="font-medium">{formatCurrency(revenue)}</span>
                </div>
              ))
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
              Sales by Country
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              {sortedCountries.length > 0 ? (
                <div className="space-y-2">
                  {sortedCountries.map(([country, stats], idx) => (
                    <div key={country} className="flex items-center justify-between p-2 rounded bg-muted/30">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium w-5">{idx + 1}.</span>
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{country}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-sm">{formatCurrency(stats.revenue)}</p>
                        <p className="text-xs text-muted-foreground">{stats.orders} orders</p>
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

        {/* Product Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5" />
              Product Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              {sortedProducts.length > 0 ? (
                <div className="space-y-2">
                  {sortedProducts.slice(0, 10).map(([name, stats], idx) => (
                    <div key={name} className="flex items-center justify-between p-2 rounded bg-muted/30">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {idx < 3 && <Badge variant="outline" className="text-xs shrink-0">#{idx + 1}</Badge>}
                          <p className="font-medium text-sm truncate">{name}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">{stats.type}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-medium text-sm">{formatCurrency(stats.revenue)}</p>
                        <p className="text-xs text-muted-foreground">{stats.quantity} sold</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-4">No product data yet</p>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[250px]">
            {analytics.recentOrders.length > 0 ? (
              <div className="space-y-3">
                {analytics.recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{order.merchandise?.design_name || "Unknown"}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <span>x{order.quantity}</span>
                        <Badge variant="outline" className="text-xs">
                          {order.order_type}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          <Users className="h-3 w-3 mr-1" />
                          {order.customer_type}
                        </Badge>
                        {(order as any).country && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {(order as any).country}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-medium">{formatCurrency(order.total_price)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-4">No orders yet</p>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Top Product Card */}
      {analytics.topProduct && (
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-yellow-500/20 p-3 rounded-full">
              <TrendingUp className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Best Seller (All Time)</p>
              <p className="text-lg font-bold">{analytics.topProduct}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};