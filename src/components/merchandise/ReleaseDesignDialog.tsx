import { useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Shirt } from "lucide-react";

interface ReleaseDesignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  designId: string;
  designName: string;
  bandId: string;
  onSuccess?: () => void;
}

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;
const BASE_COST = 7; // Graphic Tee base cost

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
  const [productName, setProductName] = useState(`Custom ${designName}`);
  const [sellingPrice, setSellingPrice] = useState("35");
  const [stockQuantity, setStockQuantity] = useState("50");
  const [selectedSizes, setSelectedSizes] = useState<string[]>(["S", "M", "L", "XL"]);

  const toggleSize = (size: string) => {
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedSizes.length === 0) {
      toast({
        title: "Select at least one size",
        description: "You must offer at least one size option.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("player_merchandise").insert({
        band_id: bandId,
        design_name: productName.trim(),
        item_type: "Graphic Tee",
        cost_to_produce: BASE_COST,
        selling_price: Number(sellingPrice),
        stock_quantity: Number(stockQuantity),
        custom_design_id: designId,
        sales_boost_pct: 1.0, // 1% sales boost for custom designs
      });

      if (error) throw error;

      toast({
        title: "Merch released!",
        description: `"${productName}" is now available in your inventory with a +1% sales boost.`,
      });

      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error: any) {
      toast({
        title: "Failed to release merchandise",
        description: error.message,
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
            <Shirt className="h-5 w-5" />
            Release Custom T-Shirt
          </DialogTitle>
          <DialogDescription>
            Configure your custom t-shirt design as merchandise. Custom designs get a +1% sales boost!
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="product-name">Product Name</Label>
            <Input
              id="product-name"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g. Custom Band Logo Tee"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Base Cost (Fixed)</Label>
              <Input value={`$${BASE_COST}`} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">
                Standard graphic tee production cost
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="selling-price">Selling Price ($)</Label>
              <Input
                id="selling-price"
                type="number"
                min={BASE_COST + 1}
                step={1}
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stock-quantity">Initial Stock Quantity</Label>
            <Input
              id="stock-quantity"
              type="number"
              min={1}
              step={1}
              value={stockQuantity}
              onChange={(e) => setStockQuantity(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Number of units to produce initially
            </p>
          </div>

          <div className="space-y-3">
            <Label>Available Sizes</Label>
            <div className="grid grid-cols-3 gap-3">
              {SIZES.map((size) => (
                <div
                  key={size}
                  className="flex items-center space-x-2 rounded-lg border p-3"
                >
                  <Checkbox
                    id={`size-${size}`}
                    checked={selectedSizes.includes(size)}
                    onCheckedChange={() => toggleSize(size)}
                  />
                  <label
                    htmlFor={`size-${size}`}
                    className="flex-1 cursor-pointer text-sm font-medium"
                  >
                    {size}
                  </label>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Selected: {selectedSizes.length > 0 ? selectedSizes.join(", ") : "None"}
            </p>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <h4 className="font-semibold text-sm">Profit Breakdown</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">Selling Price:</div>
              <div className="text-right font-medium">${sellingPrice}</div>
              <div className="text-muted-foreground">Production Cost:</div>
              <div className="text-right font-medium">-${BASE_COST}</div>
              <div className="text-muted-foreground font-semibold">Profit per Unit:</div>
              <div className="text-right font-semibold text-primary">
                ${Math.max(0, Number(sellingPrice) - BASE_COST)}
              </div>
              <div className="text-muted-foreground">Total Potential:</div>
              <div className="text-right font-medium">
                ${Math.max(0, (Number(sellingPrice) - BASE_COST) * Number(stockQuantity))}
              </div>
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
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Releasing...
                </>
              ) : (
                "Release Merch"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
