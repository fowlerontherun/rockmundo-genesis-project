import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Package, RefreshCw, Percent } from "lucide-react";
import { addDays, format as formatDate } from "date-fns";

interface ReorderStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  format: any;
  release: any;
}

const MANUFACTURING_DAYS: Record<string, number> = {
  vinyl: 14,
  cd: 7,
  cassette: 5,
};

export function ReorderStockDialog({ open, onOpenChange, format, release }: ReorderStockDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [quantity, setQuantity] = useState(100);
  const [revenueShareEnabled, setRevenueShareEnabled] = useState(false);

  // Fetch manufacturing costs
  const { data: manufacturingCosts } = useQuery({
    queryKey: ["manufacturing-costs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("manufacturing_costs")
        .select("*")
        .order("format_type")
        .order("min_quantity");
      return data || [];
    },
  });

  const calculateManufacturingCost = (formatType: string, qty: number) => {
    const costs = manufacturingCosts?.filter(c => c.format_type === formatType) || [];
    const tier = costs.find(c =>
      qty >= c.min_quantity && (c.max_quantity === null || qty <= c.max_quantity)
    );
    
    let baseCost = tier ? tier.cost_per_unit * qty : 0;
    
    if (revenueShareEnabled) {
      baseCost = Math.round(baseCost * 0.5);
    }
    
    return baseCost;
  };

  const formatType = format?.format_type || "cd";
  const manufacturingCost = calculateManufacturingCost(formatType, quantity);
  const originalCost = calculateManufacturingCost(formatType, quantity) / (revenueShareEnabled ? 0.5 : 1);
  const manufacturingDays = MANUFACTURING_DAYS[formatType] || 7;
  const manufacturingCompleteDate = addDays(new Date(), manufacturingDays);

  const reorderMutation = useMutation({
    mutationFn: async () => {
      if (!format || !release) throw new Error("Missing format or release data");

      // Update the existing format with additional quantity
      const newQuantity = (format.quantity || 0) + quantity;
      const newManufacturingCost = (format.manufacturing_cost || 0) + manufacturingCost;

      const { error: formatError } = await supabase
        .from("release_formats")
        .update({
          quantity: newQuantity,
          manufacturing_cost: newManufacturingCost,
          manufacturing_status: "manufacturing",
          // Update release date to when new batch will be ready
          release_date: formatDate(manufacturingCompleteDate, "yyyy-MM-dd"),
        })
        .eq("id", format.id);

      if (formatError) throw formatError;

      // Update release total cost
      const newTotalCost = (release.total_cost || 0) + manufacturingCost;
      const { error: releaseError } = await supabase
        .from("releases")
        .update({ total_cost: newTotalCost })
        .eq("id", release.id);

      if (releaseError) throw releaseError;

      // Log the activity
      await supabase.from("activity_feed").insert({
        user_id: release.user_id,
        activity_type: "physical_format_reordered",
        message: `Reordered ${quantity} additional ${formatType.toUpperCase()} units for "${release.title}"`,
        metadata: {
          release_id: release.id,
          format_id: format.id,
          format_type: formatType,
          quantity_ordered: quantity,
          manufacturing_cost: manufacturingCost,
        },
      });
    },
    onSuccess: () => {
      toast({
        title: "Reorder placed!",
        description: `${quantity} additional ${formatType.toUpperCase()} units are now being manufactured. Ready by ${formatDate(manufacturingCompleteDate, "MMM d, yyyy")}`,
      });
      queryClient.invalidateQueries({ queryKey: ["releases"] });
      onOpenChange(false);
      setQuantity(100);
      setRevenueShareEnabled(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error placing reorder",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!format) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Reorder {formatType.toUpperCase()} Stock
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Current stock: <span className="font-semibold">{format.quantity || 0} units</span>
            {format.quantity <= 0 && <span className="text-destructive ml-2">(SOLD OUT)</span>}
            {format.quantity > 0 && format.quantity < 50 && <span className="text-warning ml-2">(LOW)</span>}
          </p>

          {/* Quantity */}
          <div className="space-y-2">
            <Label>Quantity to Order</Label>
            <Input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 100)}
              min={1}
            />
          </div>

          {/* Revenue Share Option */}
          <Card className="p-4 border-primary/30 bg-primary/5">
            <div className="flex items-start gap-3">
              <Checkbox
                checked={revenueShareEnabled}
                onCheckedChange={(checked) => setRevenueShareEnabled(!!checked)}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Percent className="h-4 w-4 text-primary" />
                  <span className="font-semibold">Revenue Share Deal</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Reduce manufacturing costs by <strong>50%</strong> by sharing <strong>10%</strong> of sales revenue.
                </p>
              </div>
            </div>
          </Card>

          {/* Cost Summary */}
          <Card className="p-4 bg-muted/50">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Manufacturing Time:</span>
                <span className="font-medium">{manufacturingDays} days</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Ready By:</span>
                <span className="font-medium">{formatDate(manufacturingCompleteDate, "MMM d, yyyy")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>New Total Stock:</span>
                <span className="font-medium">{(format.quantity || 0) + quantity} units</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="font-semibold">Manufacturing Cost:</span>
                <div className="text-right">
                  {revenueShareEnabled && (
                    <span className="text-sm text-muted-foreground line-through mr-2">
                      ${(originalCost / 100).toFixed(2)}
                    </span>
                  )}
                  <span className="text-xl font-bold">${(manufacturingCost / 100).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => reorderMutation.mutate()}
            disabled={reorderMutation.isPending}
          >
            <Package className="h-4 w-4 mr-2" />
            {reorderMutation.isPending ? "Ordering..." : "Place Reorder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
