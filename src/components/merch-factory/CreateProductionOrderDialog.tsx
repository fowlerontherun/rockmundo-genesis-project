import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import {
  useProductCatalog,
  useCreateProductionOrder,
  useFactoryContracts,
  useAllBands,
} from "@/hooks/useMerchFactory";

interface CreateProductionOrderDialogProps {
  factoryId: string;
}

export function CreateProductionOrderDialog({ factoryId }: CreateProductionOrderDialogProps) {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [bandId, setBandId] = useState<string>("none");
  const [quantity, setQuantity] = useState("50");

  const { data: products } = useProductCatalog(factoryId);
  const { data: contracts } = useFactoryContracts(factoryId);
  const { data: bands } = useAllBands();
  const createOrder = useCreateProductionOrder();

  const selectedProduct = useMemo(
    () => products?.find((p) => p.id === productId),
    [products, productId],
  );

  const activeContract = useMemo(() => {
    if (bandId === "none") return null;
    return contracts?.find((c) => c.is_active && c.client_band_id === bandId) ?? null;
  }, [contracts, bandId]);

  const qtyNum = Math.max(0, Number(quantity) || 0);
  const baseUnit = selectedProduct?.base_cost ?? 0;
  const discountPct = activeContract ? Number(activeContract.discount_percentage) : 0;
  const unitCost = +(baseUnit * (1 - discountPct / 100)).toFixed(2);
  const totalCost = +(unitCost * qtyNum).toFixed(2);
  const priority = activeContract?.priority_level ?? 5;

  const canSubmit =
    !!selectedProduct &&
    qtyNum >= (selectedProduct?.min_order_quantity ?? 1) &&
    !createOrder.isPending;

  const reset = () => {
    setProductId("");
    setBandId("none");
    setQuantity("50");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    await createOrder.mutateAsync({
      factory_id: factoryId,
      product_catalog_id: selectedProduct.id,
      quantity: qtyNum,
      unit_cost: unitCost,
      total_cost: totalCost,
      client_band_id: bandId === "none" ? null : bandId,
      priority,
    });
    setOpen(false);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          New Order
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Production Order</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Product</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Select product from catalog" />
              </SelectTrigger>
              <SelectContent>
                {products?.filter((p) => p.is_active).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.product_name} — ${p.base_cost}/unit
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!products?.length && (
              <p className="text-xs text-muted-foreground">Add a product to the catalog first.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Client Band (optional)</Label>
            <Select value={bandId} onValueChange={setBandId}>
              <SelectTrigger>
                <SelectValue placeholder="Direct order" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Direct order (no client)</SelectItem>
                {bands?.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeContract && (
              <p className="text-xs text-primary">
                Active contract: {discountPct}% discount · priority P{priority}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Quantity</Label>
            <Input
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            {selectedProduct && qtyNum < selectedProduct.min_order_quantity && (
              <p className="text-xs text-destructive">
                Minimum order is {selectedProduct.min_order_quantity} units
              </p>
            )}
          </div>

          {selectedProduct && (
            <div className="rounded-md bg-muted/40 p-3 text-sm space-y-1">
              <div className="flex justify-between"><span>Unit cost</span><span>${unitCost.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Quantity</span><span>{qtyNum}</span></div>
              <div className="flex justify-between font-semibold">
                <span>Total</span><span>${totalCost.toFixed(2)}</span>
              </div>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={!canSubmit}>
            {createOrder.isPending ? "Creating..." : "Queue Order"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
