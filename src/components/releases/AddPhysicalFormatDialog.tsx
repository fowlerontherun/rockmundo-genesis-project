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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Disc3, Radio, Music, Percent, Package } from "lucide-react";
import { addDays, format as formatDate } from "date-fns";

interface AddPhysicalFormatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  release: any;
}

const MANUFACTURING_DAYS: Record<string, number> = {
  vinyl: 14,
  cd: 7,
  cassette: 5,
};

const PHYSICAL_FORMATS = [
  { type: "cd", label: "CD", icon: Disc3, description: "Physical disc", days: 7 },
  { type: "vinyl", label: "Vinyl", icon: Radio, description: "Vinyl record", days: 14 },
  { type: "cassette", label: "Cassette", icon: Music, description: "Cassette tape", days: 5 },
];

const VINYL_COLORS = ["black", "red", "blue", "green", "white", "clear", "picture-disc"];

export function AddPhysicalFormatDialog({ open, onOpenChange, release }: AddPhysicalFormatDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(100);
  const [retailPrice, setRetailPrice] = useState(1500);
  const [vinylColor, setVinylColor] = useState("black");
  const [isLimitedEdition, setIsLimitedEdition] = useState(false);
  const [revenueShareEnabled, setRevenueShareEnabled] = useState(false);

  // Get existing format types to exclude already-added ones
  const existingFormats = release?.release_formats?.map((f: any) => f.format_type) || [];
  const availableFormats = PHYSICAL_FORMATS.filter(f => !existingFormats.includes(f.type));

  // Fetch manufacturing costs
  const { data: manufacturingCosts, isLoading: costsLoading, error: costsError } = useQuery({
    queryKey: ["manufacturing-costs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manufacturing_costs")
        .select("*")
        .order("format_type")
        .order("min_quantity");
      if (error) {
        console.error("Error fetching manufacturing costs:", error);
        throw error;
      }
      return data || [];
    },
    enabled: open, // Only fetch when dialog is open
  });

  const calculateManufacturingCost = (formatType: string, qty: number) => {
    if (!manufacturingCosts || manufacturingCosts.length === 0) {
      console.warn("No manufacturing costs data available");
      // Use fallback costs
      const fallbackCosts: Record<string, number> = { cd: 20, vinyl: 80, cassette: 15 };
      return (fallbackCosts[formatType] || 20) * qty;
    }
    
    const costs = manufacturingCosts.filter(c => c.format_type === formatType);
    const tier = costs.find(c =>
      qty >= c.min_quantity && (c.max_quantity === null || qty <= c.max_quantity)
    );
    
    let baseCost = tier ? tier.cost_per_unit * qty : 0;
    
    // If no tier found, use the highest tier (lowest per-unit cost)
    if (baseCost === 0 && costs.length > 0) {
      const highestTier = costs[costs.length - 1];
      baseCost = highestTier.cost_per_unit * qty;
    }
    
    if (revenueShareEnabled) {
      baseCost = Math.round(baseCost * 0.5);
    }
    
    return baseCost;
  };

  const manufacturingCost = selectedFormat ? calculateManufacturingCost(selectedFormat, quantity) : 0;
  const originalCost = selectedFormat ? calculateManufacturingCost(selectedFormat, quantity) / (revenueShareEnabled ? 0.5 : 1) : 0;
  const manufacturingDays = selectedFormat ? MANUFACTURING_DAYS[selectedFormat] || 7 : 0;
  const manufacturingCompleteDate = addDays(new Date(), manufacturingDays);

  const addFormatMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFormat || !release) throw new Error("No format selected");

      // Insert the new format
      const formatData: any = {
        release_id: release.id,
        format_type: selectedFormat,
        quantity,
        retail_price: retailPrice,
        manufacturing_cost: manufacturingCost,
        manufacturing_status: "manufacturing",
        release_date: formatDate(manufacturingCompleteDate, "yyyy-MM-dd"),
      };

      if (selectedFormat === "vinyl") {
        formatData.vinyl_color = vinylColor;
        formatData.is_limited_edition = isLimitedEdition;
      }

      const { error: formatError } = await supabase
        .from("release_formats")
        .insert(formatData);

      if (formatError) throw formatError;

      // Update release total cost
      const newTotalCost = (release.total_cost || 0) + manufacturingCost;
      const { error: releaseError } = await supabase
        .from("releases")
        .update({
          total_cost: newTotalCost,
          // If release was already released, the physical format goes into manufacturing
          // We keep the release_status as "released" since digital is already out
        })
        .eq("id", release.id);

      if (releaseError) throw releaseError;

      // Log the activity
      await supabase.from("activity_feed").insert({
        user_id: release.user_id,
        activity_type: "physical_format_added",
        message: `Added ${selectedFormat} format to "${release.title}"`,
        metadata: {
          release_id: release.id,
          format_type: selectedFormat,
          quantity,
          manufacturing_cost: manufacturingCost,
        },
      });
    },
    onSuccess: () => {
      toast({
        title: "Physical format added!",
        description: `${selectedFormat?.toUpperCase()} manufacturing has started. Expected completion: ${formatDate(manufacturingCompleteDate, "MMM d, yyyy")}`,
      });
      queryClient.invalidateQueries({ queryKey: ["releases"] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error adding format",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSelectedFormat(null);
    setQuantity(100);
    setRetailPrice(1500);
    setVinylColor("black");
    setIsLimitedEdition(false);
    setRevenueShareEnabled(false);
  };

  if (availableFormats.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Physical Format</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            All physical formats have already been added to this release.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Add Physical Format to "{release?.title}"
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Release physical versions of your already-released digital/streaming music.
          </p>

          {/* Format Selection */}
          <div className="space-y-2">
            <Label>Select Format</Label>
            <div className="grid grid-cols-3 gap-2">
              {availableFormats.map((fmt) => {
                const Icon = fmt.icon;
                const isSelected = selectedFormat === fmt.type;
                return (
                  <Card
                    key={fmt.type}
                    className={`p-3 cursor-pointer transition-colors ${
                      isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                    onClick={() => {
                      setSelectedFormat(fmt.type);
                      setRetailPrice(fmt.type === "vinyl" ? 3000 : fmt.type === "cd" ? 1500 : 800);
                    }}
                  >
                    <div className="flex flex-col items-center text-center gap-1">
                      <Icon className="h-6 w-6" />
                      <span className="font-medium text-sm">{fmt.label}</span>
                      <span className="text-xs text-muted-foreground">{fmt.days} days</span>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {selectedFormat && (
            <>
              {/* Quantity */}
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 100)}
                  min={1}
                />
              </div>

              {/* Retail Price */}
              <div className="space-y-2">
                <Label>Retail Price (cents)</Label>
                <Input
                  type="number"
                  value={retailPrice}
                  onChange={(e) => setRetailPrice(parseInt(e.target.value) || 0)}
                  min={0}
                />
                <p className="text-xs text-muted-foreground">
                  ${(retailPrice / 100).toFixed(2)} per unit
                </p>
              </div>

              {/* Vinyl-specific options */}
              {selectedFormat === "vinyl" && (
                <>
                  <div className="space-y-2">
                    <Label>Vinyl Color</Label>
                    <Select value={vinylColor} onValueChange={setVinylColor}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VINYL_COLORS.map((color) => (
                          <SelectItem key={color} value={color} className="capitalize">
                            {color}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={isLimitedEdition}
                      onCheckedChange={(checked) => setIsLimitedEdition(!!checked)}
                    />
                    <Label>Limited Edition</Label>
                  </div>
                </>
              )}

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
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => addFormatMutation.mutate()}
            disabled={!selectedFormat || addFormatMutation.isPending}
          >
            {addFormatMutation.isPending ? "Adding..." : "Add Physical Format"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
