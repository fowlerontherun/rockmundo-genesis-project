import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Clock3, Factory, PackageCheck, RefreshCw, Truck } from "lucide-react";

type InventoryProduct = {
  id: string;
  design_name: string | null;
  item_type: string | null;
  stock_quantity: number | null;
  pending_quantity?: number | null;
  cost_to_produce: number | null;
  production_status?: string | null;
  production_ready_at?: string | null;
  production_ordered_at?: string | null;
  production_total_cost?: number | null;
  production_discount_pct?: number | null;
  is_rush_order?: boolean | null;
  lead_time_days?: number | null;
  supplier_tier?: string | null;
};

interface MerchInventoryProductionPanelProps {
  product: InventoryProduct;
  bandId: string;
}

const formatRemaining = (readyAt?: string | null) => {
  if (!readyAt) return "No active production";
  const diff = new Date(readyAt).getTime() - Date.now();
  if (diff <= 0) return "Completing shortly";
  const hours = Math.ceil(diff / 3_600_000);
  if (hours < 24) return `${hours}h remaining`;
  const days = Math.floor(hours / 24);
  const remainder = hours % 24;
  return remainder ? `${days}d ${remainder}h remaining` : `${days}d remaining`;
};

const bulkDiscount = (qty: number) => {
  if (qty >= 1000) return 0.15;
  if (qty >= 500) return 0.1;
  if (qty >= 100) return 0.05;
  return 0;
};

export const MerchInventoryProductionPanel = ({ product, bandId }: MerchInventoryProductionPanelProps) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [quantity, setQuantity] = useState("50");
  const available = Math.max(0, Number(product.stock_quantity ?? 0));
  const pending = Math.max(0, Number(product.pending_quantity ?? 0));
  const qty = Math.max(0, Math.floor(Number(quantity) || 0));
  const discount = bulkDiscount(qty);
  const unitCost = Math.max(0, Number(product.cost_to_produce ?? 0));
  const effectiveUnitCost = unitCost * (1 - discount);
  const estimatedCost = effectiveUnitCost * qty;
  const hasProduction = pending > 0;

  const progress = useMemo(() => {
    if (!hasProduction || !product.production_ordered_at || !product.production_ready_at) return 0;
    const ordered = new Date(product.production_ordered_at).getTime();
    const ready = new Date(product.production_ready_at).getTime();
    const span = Math.max(1, ready - ordered);
    return Math.min(100, Math.max(0, ((Date.now() - ordered) / span) * 100));
  }, [hasProduction, product.production_ordered_at, product.production_ready_at]);

  const orderMutation = useMutation({
    mutationFn: async () => {
      if (qty < 1) throw new Error("Enter a production quantity");
      if (hasProduction) throw new Error("This product already has stock in production");
      const { error } = await supabase
        .from("player_merchandise")
        .update({ stock_quantity: available + qty })
        .eq("id", product.id);
      if (error) throw error;
      return qty;
    },
    onSuccess: (orderedQty) => {
      toast({
        title: "Production order placed",
        description: `${orderedQty.toLocaleString()} units have been sent to the supplier. They will become sellable when production completes.`,
      });
      queryClient.invalidateQueries({ queryKey: ["player-merchandise", bandId] });
    },
    onError: (error: Error) => {
      toast({ title: "Production order failed", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><Factory className="h-5 w-5" /> Stock & production</CardTitle>
        <CardDescription>Sellable stock is read-only. New units must be ordered from the supplier and remain unavailable until manufacturing completes.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Sellable now</p>
            <p className="text-2xl font-semibold">{available.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">units</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">In production</p>
            <p className="text-2xl font-semibold">{pending.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">units</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Supplier</p>
            <p className="text-lg font-semibold capitalize">{product.supplier_tier ?? "standard"}</p>
            <p className="text-xs text-muted-foreground">{product.lead_time_days ?? 0} day lead time</p>
          </div>
        </div>

        {hasProduction ? (
          <div className="space-y-3 rounded-xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">Production run active</p>
                <p className="text-sm text-muted-foreground">{pending.toLocaleString()} units · {formatRemaining(product.production_ready_at)}</p>
              </div>
              <div className="flex gap-2">
                {product.is_rush_order ? <Badge>Rush</Badge> : null}
                {Number(product.production_discount_pct ?? 0) > 0 ? <Badge variant="secondary">{Math.round(Number(product.production_discount_pct) * 100)}% bulk discount</Badge> : null}
              </div>
            </div>
            <Progress value={progress} />
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-muted-foreground" /><span>{product.production_ready_at ? new Date(product.production_ready_at).toLocaleString() : "Pending"}</span></div>
              <div className="flex items-center gap-2"><Truck className="h-4 w-4 text-muted-foreground" /><span className="capitalize">{product.production_status ?? "ordered"}</span></div>
              <div className="flex items-center gap-2"><PackageCheck className="h-4 w-4 text-muted-foreground" /><span>${Number(product.production_total_cost ?? 0).toLocaleString()} paid</span></div>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 rounded-xl border p-4 md:grid-cols-[1fr_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor={`restock-${product.id}`}>Order more stock</Label>
              <Input id={`restock-${product.id}`} type="number" min={1} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Base ${unitCost.toFixed(2)}/unit</span>
                {discount > 0 ? <span>{Math.round(discount * 100)}% bulk discount · ${effectiveUnitCost.toFixed(2)}/unit</span> : null}
                <span>Estimated order ${estimatedCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </div>
            </div>
            <Button onClick={() => orderMutation.mutate()} disabled={orderMutation.isPending || qty < 1}>
              <RefreshCw className={`mr-2 h-4 w-4 ${orderMutation.isPending ? "animate-spin" : ""}`} />
              {orderMutation.isPending ? "Ordering..." : "Place supplier order"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
