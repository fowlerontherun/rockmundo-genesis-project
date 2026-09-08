import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MerchDesignPreview } from "@/components/merchandise/MerchDesignPreview";

interface BandMerchStoreProps {
  bandId: string;
  bandName: string;
}

type VariantRow = {
  id: string;
  size?: string | null;
  color?: string | null;
  stock_quantity?: number | null;
  selling_price_override?: number | null;
};

type StoreMerchRow = Record<string, any> & {
  id: string;
  design_name: string;
  item_type: string;
  selling_price?: number | null;
  stock_quantity?: number | null;
  is_limited_edition?: boolean | null;
  limited_quantity?: number | null;
  available_until?: string | null;
  variants?: VariantRow[] | null;
};

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function BandMerchStore({ bandId, bandName }: BandMerchStoreProps) {
  const { data: merchandise = [], isLoading, isError } = useQuery<StoreMerchRow[]>({
    queryKey: ["band-public-merch", bandId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_public_band_merch_storefront", { p_band_id: bandId });
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(bandId),
    staleTime: 60_000,
  });

  const products = useMemo(() => merchandise.map((item) => {
    const variants = Array.isArray(item.variants) ? item.variants.filter((variant) => Number(variant.stock_quantity ?? 0) > 0) : [];
    const variantStock = variants.reduce((sum, variant) => sum + Number(variant.stock_quantity ?? 0), 0);
    const totalStock = Number(item.stock_quantity ?? 0) + variantStock;
    return { ...item, variants, totalStock };
  }).filter((item) => item.totalStock > 0), [merchandise]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShoppingBag className="h-5 w-5" /> {bandName} Shop</CardTitle>
        </CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">Loading merchandise...</p></CardContent>
      </Card>
    );
  }

  if (isError || products.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShoppingBag className="h-5 w-5" /> {bandName} Shop</CardTitle>
        <CardDescription>Official merchandise currently in stock. Designs and availability come directly from the band's Merchandise Operations inventory.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((item) => {
            const variantLabels = Array.from(new Set((item.variants ?? []).map((variant) => variant.size || variant.color).filter(Boolean)));
            return (
              <div key={item.id} className="overflow-hidden rounded-xl border bg-card">
                <div className="aspect-square bg-muted/20 p-2">
                  <MerchDesignPreview design={item} className="rounded-lg" />
                </div>
                <div className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{item.design_name}</p>
                      <p className="text-xs text-muted-foreground">{item.item_type}</p>
                    </div>
                    <span className="shrink-0 font-bold">{currency.format(Number(item.selling_price ?? 0))}</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline">{item.totalStock} in stock</Badge>
                    {item.is_limited_edition ? <Badge variant="secondary">Limited edition</Badge> : null}
                  </div>

                  {variantLabels.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {variantLabels.slice(0, 6).map((label) => <Badge key={String(label)} variant="outline" className="text-[10px]">{label}</Badge>)}
                      {variantLabels.length > 6 ? <Badge variant="outline" className="text-[10px]">+{variantLabels.length - 6}</Badge> : null}
                    </div>
                  ) : null}

                  {item.available_until ? <p className="text-[11px] text-muted-foreground">Available until {new Date(item.available_until).toLocaleDateString()}</p> : null}
                  <p className="text-[11px] text-muted-foreground">Purchases are settled by RockMundo's authoritative merchandise sales system.</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
