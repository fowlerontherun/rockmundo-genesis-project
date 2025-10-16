import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, Package } from "lucide-react";

interface ReleaseSalesTabProps {
  userId: string;
}

export function ReleaseSalesTab({ userId }: ReleaseSalesTabProps) {
  const { data: salesData, isLoading } = useQuery({
    queryKey: ["release-sales", userId],
    queryFn: async () => {
      // Get user's band IDs
      const { data: bandMembers } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("user_id", userId);
      const bandIds = bandMembers?.map(bm => bm.band_id) || [];

      // Get releases
      const releaseQuery = supabase
        .from("releases")
        .select("id");
      
      if (bandIds.length > 0) {
        releaseQuery.or(`user_id.eq.${userId},band_id.in.(${bandIds.join(",")})`);
      } else {
        releaseQuery.eq("user_id", userId);
      }

      const { data: releases } = await releaseQuery;
      const releaseIds = releases?.map(r => r.id) || [];

      if (releaseIds.length === 0) return { sales: [], totalRevenue: 0, totalUnits: 0 };

      // Get sales
      const { data: sales } = await supabase
        .from("release_sales")
        .select(`
          *,
          release_format:release_formats(
            format_type,
            release:releases(title, artist_name)
          )
        `)
        .in("release_format_id", 
          await supabase.from("release_formats")
            .select("id")
            .in("release_id", releaseIds)
            .then(res => res.data?.map(rf => rf.id) || [])
        )
        .order("sale_date", { ascending: false });

      const totalRevenue = sales?.reduce((sum, sale) => sum + sale.total_amount, 0) || 0;
      const totalUnits = sales?.reduce((sum, sale) => sum + sale.quantity_sold, 0) || 0;

      return { sales: sales || [], totalRevenue, totalUnits };
    }
  });

  if (isLoading) {
    return <div>Loading sales data...</div>;
  }

  const { sales = [], totalRevenue = 0, totalUnits = 0 } = salesData || {};

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">${totalRevenue}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Units Sold</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{totalUnits}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Price</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">
                ${totalUnits > 0 ? Math.round(totalRevenue / totalUnits) : 0}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {sales.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <DollarSign className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Sales Yet</h3>
            <p className="text-muted-foreground">
              Sales data will appear here once your releases start selling.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Recent Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sales.map((sale: any) => (
                <div key={sale.id} className="flex justify-between items-center py-2 border-b last:border-0">
                  <div>
                    <div className="font-medium">{sale.release_format?.release?.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {sale.release_format?.format_type} • {new Date(sale.sale_date).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">${sale.total_amount}</div>
                    <div className="text-sm text-muted-foreground">{sale.quantity_sold} units</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
