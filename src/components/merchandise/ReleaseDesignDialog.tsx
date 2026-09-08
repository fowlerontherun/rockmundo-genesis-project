import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, PackageCheck, ShieldCheck, Zap } from "lucide-react";

interface ReleaseDesignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  designId: string;
  designName: string;
  bandId: string;
  onSuccess?: () => void;
}

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;
const SIZED_PRODUCTS = new Set([
  "Basic Tee",
  "Graphic Tee",
  "Heavyweight Tee",
  "Long Sleeve Tee",
  "Premium Hoodie",
  "Zip Hoodie",
  "Tour Crewneck",
  "Football Shirt",
]);

const getBulkDiscount = (quantity: number) => {
  if (quantity >= 1000) return 0.15;
  if (quantity >= 500) return 0.1;
  if (quantity >= 100) return 0.05;
  return 0;
};

const getSupplierQuality = (tier: string | null, rush: boolean) => {
  const quality = tier === "premium" ? 88 : tier === "standard" ? 74 : tier === "budget" ? 60 : 70;
  return Math.max(1, quality - (rush ? 5 : 0));
};

export const ReleaseDesignDialog = ({
  open,
  onOpenChange,
  designId,
  designName,
  bandId,
  onSuccess,
}: ReleaseDesignDialogProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const [requirementId, setRequirementId] = useState<string | null>(null);
  const [productType, setProductType] = useState("Graphic Tee");
  const [baseCost, setBaseCost] = useState(7);
  const [minOrder, setMinOrder] = useState(10);
  const [leadTime, setLeadTime] = useState(3);
  const [supplierTier, setSupplierTier] = useState<string | null>(null);
  const [recommendedRetailPrice, setRecommendedRetailPrice] = useState(25);
  const [minimumRetailPrice, setMinimumRetailPrice] = useState(10);
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);
  const [designData, setDesignData] = useState<Record<string, unknown> | null>(null);
  const [garmentColor, setGarmentColor] = useState<string | null>(null);
  const [productName, setProductName] = useState(`Custom ${designName}`);
  const [sellingPrice, setSellingPrice] = useState("25");
  const [stockQuantity, setStockQuantity] = useState("10");
  const [selectedSizes, setSelectedSizes] = useState<string[]>(["S", "M", "L", "XL"]);
  const [rushOrder, setRushOrder] = useState(false);

  useEffect(() => {
    setProductName(`Custom ${designName}`);
  }, [designName]);

  useEffect(() => {
    if (!open || !designId) return;
    let cancelled = false;

    const load = async () => {
      setIsLoadingProduct(true);
      try {
        const { data: design, error: designError } = await (supabase as any)
          .from("tshirt_designs")
          .select("product_type, artwork_url, design_data, background_color")
          .eq("id", designId)
          .eq("band_id", bandId)
          .single();
        if (designError) throw designError;

        const nextType = design?.product_type || "Graphic Tee";
        const { data: requirement, error: requirementError } = await (supabase as any)
          .from("merch_item_requirements")
          .select("id, base_cost, min_order_qty, lead_time_days, base_quality_tier, supplier_tier, recommended_retail_price, minimum_retail_price")
          .eq("item_type", nextType)
          .maybeSingle();
        if (requirementError) throw requirementError;
        if (cancelled) return;

        const nextCost = Number(requirement?.base_cost ?? 7);
        const nextMinOrder = Math.max(1, Number(requirement?.min_order_qty ?? 10));
        const nextRecommended = Math.max(nextCost + 1, Number(requirement?.recommended_retail_price ?? Math.round(nextCost * 2.5)));
        const nextMinimumRetail = Math.max(nextCost + 1, Number(requirement?.minimum_retail_price ?? Math.ceil(nextCost * 1.35)));
        setRequirementId(requirement?.id ?? null);
        setProductType(nextType);
        setBaseCost(nextCost);
        setMinOrder(nextMinOrder);
        setLeadTime(Number(requirement?.lead_time_days ?? 0));
        setSupplierTier(requirement?.supplier_tier ?? requirement?.base_quality_tier ?? null);
        setRecommendedRetailPrice(nextRecommended);
        setMinimumRetailPrice(nextMinimumRetail);
        setArtworkUrl(design?.artwork_url ?? null);
        setDesignData(design?.design_data ?? null);
        setGarmentColor(design?.background_color ?? null);
        setStockQuantity(String(nextMinOrder));
        setSellingPrice(String(nextRecommended));
        setRushOrder(false);
      } catch (error) {
        toast({
          title: "Could not load product details",
          description: error instanceof Error ? error.message : "Using standard merchandise defaults.",
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setIsLoadingProduct(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [bandId, designId, open, toast]);

  const hasSizes = SIZED_PRODUCTS.has(productType);
  const quantity = Number(stockQuantity) || 0;
  const price = Number(sellingPrice) || 0;

  // These figures are an estimate for the player. The database trigger recalculates
  // the canonical discount, unit cost, lead time, quality and charge at insertion time.
  const estimatedDiscount = getBulkDiscount(quantity);
  const estimatedRushMultiplier = rushOrder ? 1.25 : 1;
  const estimatedUnitCost = baseCost * (1 - estimatedDiscount) * estimatedRushMultiplier;
  const estimatedProductionTotal = Math.round(estimatedUnitCost * quantity * 100) / 100;
  const effectiveMinimumSellingPrice = Math.max(minimumRetailPrice, Math.ceil(estimatedUnitCost + 1));
  const estimatedProfitPerUnit = Math.max(0, price - estimatedUnitCost);
  const estimatedTotalPotential = estimatedProfitPerUnit * quantity;
  const estimatedLeadTime = leadTime > 0
    ? rushOrder
      ? Math.max(1, Math.ceil(leadTime / 2))
      : leadTime
    : 0;
  const estimatedQuality = getSupplierQuality(supplierTier, rushOrder);
  const sizeSummary = useMemo(() => selectedSizes.join(", "), [selectedSizes]);

  const toggleSize = (size: string) => {
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((item) => item !== size) : [...prev, size],
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (hasSizes && selectedSizes.length === 0) {
      toast({
        title: "Select at least one size",
        description: "Apparel needs at least one offered size.",
        variant: "destructive",
      });
      return;
    }
    if (quantity < minOrder) {
      toast({
        title: "Production run too small",
        description: `${productType} has a minimum run of ${minOrder}.`,
        variant: "destructive",
      });
      return;
    }
    if (price < effectiveMinimumSellingPrice) {
      toast({
        title: "Selling price is too low",
        description: `Set a selling price of at least $${effectiveMinimumSellingPrice}. The catalogue recommendation is $${recommendedRetailPrice}.`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const inventoryDesignData = {
        ...(designData ?? {}),
        sourceDesignId: designId,
        sizes: hasSizes ? selectedSizes : [],
      };

      const { data: created, error } = await (supabase as any)
        .from("player_merchandise")
        .insert({
          band_id: bandId,
          product_requirement_id: requirementId,
          design_name: productName.trim(),
          item_type: productType,
          cost_to_produce: baseCost,
          selling_price: price,
          stock_quantity: quantity,
          custom_design_id: designId,
          sales_boost_pct: 1.0,
          design_data: inventoryDesignData,
          artwork_url: artworkUrl,
          garment_color: garmentColor,
          is_rush_order: rushOrder,
        })
        .select(
          "stock_quantity, pending_quantity, lead_time_days, production_status, production_total_cost, production_discount_pct, cost_to_produce, production_quality",
        )
        .single();
      if (error) throw error;

      const pending = Number(created?.pending_quantity ?? 0);
      const sellable = Number(created?.stock_quantity ?? 0);
      const canonicalLeadTime = Number(created?.lead_time_days ?? 0);
      const canonicalTotal = Number(created?.production_total_cost ?? 0);
      const canonicalDiscount = Number(created?.production_discount_pct ?? 0);

      toast({
        title: pending > 0 ? "Production order placed" : "Product ready",
        description:
          pending > 0
            ? `${pending} ${productType} units are being made${canonicalLeadTime > 0 ? ` (${canonicalLeadTime} day${canonicalLeadTime === 1 ? "" : "s"})` : ""}. ${canonicalDiscount > 0 ? `${Math.round(canonicalDiscount * 100)}% bulk discount applied. ` : ""}$${canonicalTotal.toLocaleString()} charged to the band.`
            : `${sellable} ${productType} units are available to sell.`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast({
        title: "Failed to release merchandise",
        description: error instanceof Error ? error.message : "Unable to create the product run.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5" /> Release Designed Product
          </DialogTitle>
          <DialogDescription>
            Place a supplier production order from this saved design. Manufacturing and payment are validated by the database before the product is created.
          </DialogDescription>
        </DialogHeader>

        {isLoadingProduct ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Product blank</span>
                <span className="font-medium">{productType}</span>
              </div>
              <div className="mt-1 flex justify-between gap-3">
                <span className="text-muted-foreground">Supplier</span>
                <span className="font-medium capitalize">{supplierTier || "standard"}</span>
              </div>
              <div className="mt-1 flex justify-between gap-3">
                <span className="text-muted-foreground">Base unit cost</span>
                <span className="font-medium">${baseCost}</span>
              </div>
              <div className="mt-1 flex justify-between gap-3">
                <span className="text-muted-foreground">Recommended retail</span>
                <span className="font-medium">${recommendedRetailPrice}</span>
              </div>
              <div className="mt-1 flex justify-between gap-3">
                <span className="text-muted-foreground">Minimum retail</span>
                <span className="font-medium">${minimumRetailPrice}</span>
              </div>
              <div className="mt-1 flex justify-between gap-3">
                <span className="text-muted-foreground">Minimum run</span>
                <span className="font-medium">{minOrder}</span>
              </div>
              <div className="mt-1 flex justify-between gap-3">
                <span className="text-muted-foreground">Standard lead time</span>
                <span className="font-medium">{leadTime > 0 ? `${leadTime} days` : "Immediate"}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-name">Product Name</Label>
              <Input
                id="product-name"
                value={productName}
                onChange={(event) => setProductName(event.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="selling-price">Selling Price ($)</Label>
                <Input
                  id="selling-price"
                  type="number"
                  min={effectiveMinimumSellingPrice}
                  step={1}
                  value={sellingPrice}
                  onChange={(event) => setSellingPrice(event.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">Recommended ${recommendedRetailPrice}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock-quantity">Production Run</Label>
                <Input
                  id="stock-quantity"
                  type="number"
                  min={minOrder}
                  step={1}
                  value={stockQuantity}
                  onChange={(event) => setStockQuantity(event.target.value)}
                  required
                />
              </div>
            </div>

            {hasSizes ? (
              <div className="space-y-3">
                <Label>Available Sizes</Label>
                <div className="grid grid-cols-3 gap-3">
                  {SIZES.map((size) => (
                    <div key={size} className="flex items-center space-x-2 rounded-lg border p-3">
                      <Checkbox
                        id={`size-${size}`}
                        checked={selectedSizes.includes(size)}
                        onCheckedChange={() => toggleSize(size)}
                      />
                      <label htmlFor={`size-${size}`} className="flex-1 cursor-pointer text-sm font-medium">
                        {size}
                      </label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Selected: {sizeSummary || "None"}</p>
              </div>
            ) : null}

            {leadTime > 1 ? (
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-1">
                  <Label className="flex items-center gap-2">
                    <Zap className="h-4 w-4" /> Rush production
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Approximately halves lead time, adds 25% to production cost and slightly reduces quality consistency.
                  </p>
                </div>
                <Switch checked={rushOrder} onCheckedChange={setRushOrder} />
              </div>
            ) : null}

            <div className="space-y-2 rounded-lg border bg-muted/30 p-4 text-sm">
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4" /> Estimate only — final manufacturing values are calculated atomically when the order is placed.
              </div>
              {estimatedDiscount > 0 ? (
                <div className="flex justify-between">
                  <span>Estimated bulk discount</span>
                  <span className="font-medium text-primary">-{Math.round(estimatedDiscount * 100)}%</span>
                </div>
              ) : null}
              {rushOrder ? (
                <div className="flex justify-between">
                  <span>Rush surcharge</span>
                  <span className="font-medium">+25%</span>
                </div>
              ) : null}
              <div className="flex justify-between">
                <span>Estimated unit cost</span>
                <span className="font-medium">${estimatedUnitCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Retail recommendation</span>
                <span className="font-medium">${recommendedRetailPrice}</span>
              </div>
              <div className="flex justify-between">
                <span>Estimated production order</span>
                <span className="font-medium">${estimatedProductionTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Estimated lead time</span>
                <span className="font-medium">{estimatedLeadTime > 0 ? `${estimatedLeadTime} days` : "Immediate"}</span>
              </div>
              <div className="flex justify-between">
                <span>Expected quality</span>
                <span className="font-medium">{estimatedQuality}/100</span>
              </div>
              <div className="flex justify-between">
                <span>Profit per unit</span>
                <span className="font-medium text-primary">${estimatedProfitPerUnit.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Potential gross profit</span>
                <span className="font-medium">${Math.round(estimatedTotalPotential).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={isSubmitting || !productName.trim() || price < effectiveMinimumSellingPrice}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Ordering...
                  </>
                ) : (
                  "Place Production Order"
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};