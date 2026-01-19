import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, DollarSign, TrendingUp, Globe } from "lucide-react";
import { format } from "date-fns";

export const MerchSalesNews = () => {
  const { user } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");

  // Get user's bands
  const { data: userBands } = useQuery({
    queryKey: ["user-bands-merch", user?.id],
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

  // Get today's merch orders
  const { data: todaysOrders } = useQuery({
    queryKey: ["news-merch-orders", bandIds, today],
    queryFn: async () => {
      if (bandIds.length === 0) return [];
      const { data, error } = await (supabase as any)
        .from("merch_orders")
        .select(`
          id, quantity, total_price, order_type, customer_type, country, created_at,
          merchandise:player_merchandise(design_name, item_type)
        `)
        .in("band_id", bandIds)
        .gte("created_at", `${today}T00:00:00`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: bandIds.length > 0,
  });

  // Calculate stats
  const totalRevenue = todaysOrders?.reduce((sum: number, o: any) => sum + (o.total_price || 0), 0) || 0;
  const totalOrders = todaysOrders?.length || 0;
  const totalUnits = todaysOrders?.reduce((sum: number, o: any) => sum + (o.quantity || 0), 0) || 0;

  // Top countries
  const countryStats = new Map<string, number>();
  todaysOrders?.forEach((o: any) => {
    if (o.country) {
      countryStats.set(o.country, (countryStats.get(o.country) || 0) + o.total_price);
    }
  });
  const topCountries = Array.from(countryStats.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // Top products
  const productStats = new Map<string, number>();
  todaysOrders?.forEach((o: any) => {
    const name = o.merchandise?.design_name || "Unknown";
    productStats.set(name, (productStats.get(name) || 0) + o.quantity);
  });
  const topProducts = Array.from(productStats.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (totalOrders === 0) {
    return null;
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);

  return (
    <Card className="border-green-500/20 bg-green-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShoppingBag className="h-5 w-5 text-green-500" />
          Merchandise Sales Today
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-muted/50">
            <DollarSign className="h-4 w-4 mx-auto text-green-500 mb-1" />
            <p className="font-bold text-lg">{formatCurrency(totalRevenue)}</p>
            <p className="text-xs text-muted-foreground">Revenue</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <ShoppingBag className="h-4 w-4 mx-auto text-blue-500 mb-1" />
            <p className="font-bold text-lg">{totalOrders}</p>
            <p className="text-xs text-muted-foreground">Orders</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <TrendingUp className="h-4 w-4 mx-auto text-purple-500 mb-1" />
            <p className="font-bold text-lg">{totalUnits}</p>
            <p className="text-xs text-muted-foreground">Units</p>
          </div>
        </div>

        {/* Top products */}
        {topProducts.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Top Selling</p>
            <div className="space-y-1">
              {topProducts.map(([name, qty], index) => (
                <div key={name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    {index === 0 && <Badge className="text-xs bg-yellow-500">🔥 Hot</Badge>}
                    <span className="truncate max-w-[150px]">{name}</span>
                  </span>
                  <Badge variant="outline">{qty} sold</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top countries */}
        {topCountries.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2 flex items-center gap-1">
              <Globe className="h-4 w-4" />
              Top Markets
            </p>
            <div className="flex flex-wrap gap-2">
              {topCountries.map(([country, revenue]) => (
                <Badge key={country} variant="secondary" className="text-xs">
                  {country}: {formatCurrency(revenue)}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};