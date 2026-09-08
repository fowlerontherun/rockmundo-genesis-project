import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MerchDesignPreview } from "@/components/merchandise/MerchDesignPreview";

interface FestivalExclusiveShopProps {
  festivalId: string;
  festivalTitle: string;
  location: string | null;
}

type FestivalShopRow = Record<string, any> & {
  assignment_id: string;
  band_id: string;
  band_name: string;
  merchandise_id: string;
  design_name: string;
  item_type: string;
  selling_price?: number | null;
  stock_quantity?: number | null;
  is_limited_edition?: boolean | null;
  variants?: Array<{ stock_quantity?: number | null }> | null;
};

export function FestivalExclusiveShop({ festivalId, festivalTitle, location }: FestivalExclusiveShopProps) {
  const { data: products = [], isLoading } = useQuery<FestivalShopRow[]>({
    queryKey: ["festival-shop", festivalId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_festival_merch_storefront", { p_festival_id: festivalId });
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(festivalId),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <ShoppingCart className="h-4 w-4" />
            Festival Merch Shop
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Real merchandise brought by bands appearing at {festivalTitle}{location ? ` in ${location}` : ""}.
          </p>
        </div>
        <Badge variant="outline" className="text-xs">Live inventory</Badge>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Loading festival merchandise...</div>
      ) : products.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No bands have assigned currently sellable merchandise to this festival stand yet.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((item) => {
            const variantStock = Array.isArray(item.variants)
              ? item.variants.reduce((sum, variant) => sum + Number(variant.stock_quantity ?? 0), 0)
              : 0;
            const totalStock = Number(item.stock_quantity ?? 0) + variantStock;
            return (
              <Card key={item.assignment_id} className="overflow-hidden">
                <div className="aspect-square bg-muted/20 p-2">
                  <MerchDesignPreview design={{ ...item, id: item.merchandise_id }} className="rounded-md" />
                </div>
                <CardContent className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{item.design_name}</p>
                      <p className="text-xs text-muted-foreground">{item.band_name || "Band"} · {item.item_type}</p>
                    </div>
                    <span className="shrink-0 text-sm font-bold">${Number(item.selling_price ?? 0).toFixed(2)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline">{totalStock} in stock</Badge>
                    {item.is_limited_edition ? <Badge variant="secondary">Limited edition</Badge> : null}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Purchases continue through RockMundo's authoritative merchandise sales system; this storefront never creates or edits stock directly.
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
