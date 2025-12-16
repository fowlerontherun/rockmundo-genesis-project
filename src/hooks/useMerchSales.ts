import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export interface MerchOrder {
  id: string;
  band_id: string;
  merchandise_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  order_type: string;
  gig_id?: string;
  customer_type: string;
  created_at: string;
  merchandise?: {
    design_name: string;
    item_type: string;
  };
}

export interface SalesAnalytics {
  totalRevenue: number;
  totalOrders: number;
  totalUnitsSold: number;
  avgOrderValue: number;
  topProduct: string | null;
  salesByType: Record<string, number>;
  recentOrders: MerchOrder[];
}

export const useMerchSales = (bandId: string | null) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch orders - use type assertion since table is new
  const { data: orders, isLoading } = useQuery({
    queryKey: ["merch-orders", bandId],
    queryFn: async () => {
      if (!bandId) return [];
      
      const { data, error } = await (supabase as any)
        .from("merch_orders")
        .select(`
          *,
          merchandise:player_merchandise(design_name, item_type)
        `)
        .eq("band_id", bandId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []) as MerchOrder[];
    },
    enabled: !!bandId,
  });

  // Calculate analytics
  const analytics: SalesAnalytics = {
    totalRevenue: orders?.reduce((sum, o) => sum + o.total_price, 0) || 0,
    totalOrders: orders?.length || 0,
    totalUnitsSold: orders?.reduce((sum, o) => sum + o.quantity, 0) || 0,
    avgOrderValue: orders?.length ? (orders.reduce((sum, o) => sum + o.total_price, 0) / orders.length) : 0,
    topProduct: null,
    salesByType: {},
    recentOrders: orders?.slice(0, 10) || [],
  };

  // Calculate top product
  if (orders?.length) {
    const productSales = new Map<string, number>();
    orders.forEach(o => {
      const name = o.merchandise?.design_name || "Unknown";
      productSales.set(name, (productSales.get(name) || 0) + o.quantity);
    });
    let maxSales = 0;
    productSales.forEach((sales, name) => {
      if (sales > maxSales) {
        maxSales = sales;
        analytics.topProduct = name;
      }
    });

    // Sales by type
    orders.forEach(o => {
      analytics.salesByType[o.order_type] = (analytics.salesByType[o.order_type] || 0) + o.total_price;
    });
  }

  // Simulate sales mutation (for testing/demo)
  const simulateSaleMutation = useMutation({
    mutationFn: async ({ merchandiseId, quantity, unitPrice, orderType }: {
      merchandiseId: string;
      quantity: number;
      unitPrice: number;
      orderType: string;
    }) => {
      if (!bandId) throw new Error("No band selected");

      const { error } = await (supabase as any)
        .from("merch_orders")
        .insert({
          band_id: bandId,
          merchandise_id: merchandiseId,
          quantity,
          unit_price: unitPrice,
          total_price: quantity * unitPrice,
          order_type: orderType,
          customer_type: Math.random() > 0.7 ? "collector" : "fan",
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merch-orders", bandId] });
      queryClient.invalidateQueries({ queryKey: ["player-merchandise", bandId] });
      toast({ title: "Sale recorded!" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to record sale", description: error.message, variant: "destructive" });
    },
  });

  return {
    orders,
    analytics,
    isLoading,
    simulateSale: simulateSaleMutation.mutate,
    isSimulating: simulateSaleMutation.isPending,
  };
};
