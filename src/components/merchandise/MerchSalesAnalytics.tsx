import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DollarSign, ShoppingBag, TrendingUp, Package, Store, Calendar, Users } from "lucide-react";
import { useMerchSales } from "@/hooks/useMerchSales";
import { formatDistanceToNow } from "date-fns";

interface MerchSalesAnalyticsProps {
  bandId: string | null;
}

export const MerchSalesAnalytics = ({ bandId }: MerchSalesAnalyticsProps) => {
  const { analytics, isLoading } = useMerchSales(bandId);

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

      <div className="grid gap-4 md:grid-cols-2">
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

        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              {analytics.recentOrders.length > 0 ? (
                <div className="space-y-3">
                  {analytics.recentOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <div>
                        <p className="font-medium text-sm">{order.merchandise?.design_name || "Unknown"}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>x{order.quantity}</span>
                          <Badge variant="outline" className="text-xs">
                            {order.order_type}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            <Users className="h-3 w-3 mr-1" />
                            {order.customer_type}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
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
      </div>

      {/* Top Product */}
      {analytics.topProduct && (
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-yellow-500/20 p-3 rounded-full">
              <TrendingUp className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Best Seller</p>
              <p className="text-lg font-bold">{analytics.topProduct}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
