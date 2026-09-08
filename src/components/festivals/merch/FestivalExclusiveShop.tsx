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

type FestivalShopAssignment = {
  id: string;
  band_id: string;
  merchandise_id: string;
  band?: { name?: string | null } | null;
  merchandise?: Record<string, any> | null;
};

export function FestivalExclusiveShop({ festivalId, festivalTitle, location }: FestivalExclusiveShopProps) {
  const { data: assignments = [], isLoading } = useQuery<FestivalShopAssignment[]>({
    queryKey: ["festival-shop", festivalId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("festival_merch_assignments")
        .select(`
          id,
          band_id,
          merchandise_id,
          band:bands(name),
          merchandise:player_merchandise(
            id,
            band_id,
            design_name,
            item_type,
            selling_price,
            stock_quantity,
            design_data,
            artwork_url,
            garment_color,
            design_preview_url,
            is_limited_edition,
            limited_quantity,
            available_until
          )
        `)
        .eq("festival_id", festivalId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).filter((row: FestivalShopAssignment) => row.merchandise);
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
      ) : assignments.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No bands have assigned merchandise to this festival stand yet.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {assignments.map((assignment) => {
            const item = assignment.merchandise!;
            return (
              <Card key={assignment.id} className="overflow-hidden">
                <div className="aspect-square bg-muted/20 p-2">
                  <MerchDesignPreview design={item} className="rounded-md" />
                </div>
                <CardContent className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{item.design_name}</p>
                      <p className="text-xs text-muted-foreground">{assignment.band?.name ?? "Band"} · {item.item_type}</p>
                    </div>
                    <span className="shrink-0 text-sm font-bold">${Number(item.selling_price ?? 0).toFixed(2)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline">{Number(item.stock_quantity ?? 0)} in stock</Badge>
                    {item.is_limited_edition ? <Badge variant="secondary">Limited edition</Badge> : null}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Purchases continue through RockMundo's authoritative merch sales system; this storefront never creates or edits stock directly.
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
