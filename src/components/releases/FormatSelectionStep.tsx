import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Disc3, Globe, Headphones, Radio, Music, Percent, AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDays, format as formatDate, isBefore } from "date-fns";

interface FormatSelectionStepProps {
  selectedFormats: any[];
  onFormatsChange: (formats: any[]) => void;
  onBack: () => void;
  onSubmit: () => void;
  isLoading: boolean;
  revenueShareEnabled?: boolean;
  onRevenueShareChange?: (enabled: boolean) => void;
  scheduledReleaseDate?: Date | null;
}

// Manufacturing days by format type
const MANUFACTURING_DAYS: Record<string, number> = {
  vinyl: 14,
  cd: 7,
  cassette: 5,
  digital: 2,
  streaming: 2,
};

export function FormatSelectionStep({
  selectedFormats,
  onFormatsChange,
  onBack,
  onSubmit,
  isLoading,
  revenueShareEnabled = false,
  onRevenueShareChange,
  scheduledReleaseDate,
}: FormatSelectionStepProps) {
  const [formatConfigs, setFormatConfigs] = useState<Record<string, any>>({
    digital: { release_date: "", quantity: 0, retail_price: 1000, distribution_fee_percentage: 30 },
    streaming: { release_date: "", quantity: 0, retail_price: 0, distribution_fee_percentage: 30 },
    cd: { release_date: "", quantity: 100, retail_price: 1500, distribution_fee_percentage: 30 },
    vinyl: { release_date: "", quantity: 100, retail_price: 3000, distribution_fee_percentage: 30, vinyl_color: "black", is_limited_edition: false },
    cassette: { release_date: "", quantity: 100, retail_price: 800, distribution_fee_percentage: 30 }
  });

  const { data: manufacturingCosts } = useQuery({
    queryKey: ["manufacturing-costs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("manufacturing_costs")
        .select("*")
        .order("format_type")
        .order("min_quantity");
      return data || [];
    }
  });

  const calculateManufacturingCost = (formatType: string, quantity: number) => {
    if (formatType === "digital" || formatType === "streaming") return 500; // Setup fee
    
    const costs = manufacturingCosts?.filter(c => c.format_type === formatType) || [];
    const tier = costs.find(c => 
      quantity >= c.min_quantity && (c.max_quantity === null || quantity <= c.max_quantity)
    );
    
    let baseCost = tier ? tier.cost_per_unit * quantity : 0;
    
    // Apply 50% discount if revenue share is enabled
    if (revenueShareEnabled) {
      baseCost = Math.round(baseCost * 0.5);
    }
    
    return baseCost;
  };

  // Calculate manufacturing completion date
  const getManufacturingCompleteDate = () => {
    if (selectedFormats.length === 0) return addDays(new Date(), 2);
    const maxDays = Math.max(
      ...selectedFormats.map(f => MANUFACTURING_DAYS[f.format_type] || 2)
    );
    return addDays(new Date(), maxDays);
  };

  const manufacturingCompleteDate = getManufacturingCompleteDate();
  const isScheduledTooEarly = scheduledReleaseDate && isBefore(scheduledReleaseDate, manufacturingCompleteDate);

  const formats = [
    { type: "digital", label: "Digital", icon: Globe, description: "Download" },
    { type: "streaming", label: "Streaming", icon: Headphones, description: "Spotify, Apple Music" },
    { type: "cd", label: "CD", icon: Disc3, description: "Physical disc" },
    { type: "vinyl", label: "Vinyl", icon: Radio, description: "Vinyl record" },
    { type: "cassette", label: "Cassette", icon: Music, description: "Cassette tape" }
  ];

  const vinylColors = ["black", "red", "blue", "green", "white", "clear", "picture-disc"];

  const toggleFormat = (formatType: string) => {
    const isSelected = selectedFormats.some(f => f.format_type === formatType);
    
    if (isSelected) {
      onFormatsChange(selectedFormats.filter(f => f.format_type !== formatType));
    } else {
      const config = formatConfigs[formatType];
      const manufacturingCost = calculateManufacturingCost(formatType, config.quantity);
      
      onFormatsChange([
        ...selectedFormats,
        {
          format_type: formatType,
          ...config,
          manufacturing_cost: manufacturingCost
        }
      ]);
    }
  };

  const updateFormatConfig = (formatType: string, field: string, value: any) => {
    const newConfig = { ...formatConfigs[formatType], [field]: value };
    setFormatConfigs({ ...formatConfigs, [formatType]: newConfig });

    const manufacturingCost = calculateManufacturingCost(
      formatType,
      field === "quantity" ? parseInt(value) || 0 : newConfig.quantity
    );

    const updatedFormats = selectedFormats.map(f =>
      f.format_type === formatType
        ? { ...f, [field]: value, manufacturing_cost: manufacturingCost }
        : f
    );
    onFormatsChange(updatedFormats);
  };

  // Recalculate costs when revenue share changes
  const handleRevenueShareToggle = (checked: boolean) => {
    onRevenueShareChange?.(checked);
    
    // Recalculate all manufacturing costs
    const updatedFormats = selectedFormats.map(f => ({
      ...f,
      manufacturing_cost: calculateManufacturingCostWithShare(f.format_type, f.quantity || 0, checked)
    }));
    onFormatsChange(updatedFormats);
  };

  const calculateManufacturingCostWithShare = (formatType: string, quantity: number, shareEnabled: boolean) => {
    if (formatType === "digital" || formatType === "streaming") return 500;
    
    const costs = manufacturingCosts?.filter(c => c.format_type === formatType) || [];
    const tier = costs.find(c => 
      quantity >= c.min_quantity && (c.max_quantity === null || quantity <= c.max_quantity)
    );
    
    let baseCost = tier ? tier.cost_per_unit * quantity : 0;
    if (shareEnabled) {
      baseCost = Math.round(baseCost * 0.5);
    }
    return baseCost;
  };

  const totalCost = selectedFormats.reduce((sum, f) => sum + f.manufacturing_cost, 0);
  const originalCost = selectedFormats.reduce((sum, f) => {
    const baseCost = calculateManufacturingCostWithShare(f.format_type, f.quantity || 0, false);
    return sum + baseCost;
  }, 0);

  return (
    <div className="space-y-4">
      {/* Revenue Share Option */}
      {onRevenueShareChange && (
        <Card className="p-4 border-primary/30 bg-primary/5">
          <div className="flex items-start gap-3">
            <Checkbox 
              checked={revenueShareEnabled}
              onCheckedChange={(checked) => handleRevenueShareToggle(!!checked)}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Percent className="h-4 w-4 text-primary" />
                <span className="font-semibold">Revenue Share Deal</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Reduce manufacturing costs by <strong>50%</strong> by sharing <strong>10%</strong> of sales revenue with manufacturers.
              </p>
              {revenueShareEnabled && (
                <p className="text-xs text-primary mt-2">
                  Manufacturing partners will receive 10% of all physical sales revenue.
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Manufacturing Timeline Warning */}
      {selectedFormats.length > 0 && (
        <Alert className="bg-muted/50">
          <AlertDescription className="text-sm">
            Manufacturing will complete by <strong>{formatDate(manufacturingCompleteDate, "MMM d, yyyy")}</strong>
            {selectedFormats.some(f => f.format_type === "vinyl") && (
              <span className="text-muted-foreground"> (vinyl takes 14 days)</span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {isScheduledTooEarly && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Your scheduled release date is before manufacturing completes. Consider pushing back to after {formatDate(manufacturingCompleteDate, "MMM d, yyyy")}.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4">
        {formats.map((fmt) => {
          const Icon = fmt.icon;
          const isSelected = selectedFormats.some(f => f.format_type === fmt.type);
          
          return (
            <Card
              key={fmt.type}
              className={`p-4 cursor-pointer ${isSelected ? "border-primary" : ""}`}
              onClick={() => toggleFormat(fmt.type)}
            >
              <div className="flex items-start gap-3">
                <Checkbox checked={isSelected} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-5 w-5" />
                    <div>
                      <div className="font-semibold">{fmt.label}</div>
                      <div className="text-xs text-muted-foreground">{fmt.description}</div>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="space-y-2 mt-3" onClick={(e) => e.stopPropagation()}>
                      <div>
                        <Label className="text-xs">Release Date</Label>
                        <Input
                          type="date"
                          value={formatConfigs[fmt.type].release_date}
                          onChange={(e) => updateFormatConfig(fmt.type, "release_date", e.target.value)}
                          className="h-8"
                          min={formatDate(manufacturingCompleteDate, "yyyy-MM-dd")}
                        />
                      </div>

                      {(fmt.type === "cd" || fmt.type === "vinyl" || fmt.type === "cassette") && (
                        <div>
                          <Label className="text-xs">Quantity</Label>
                          <Input
                            type="number"
                            value={formatConfigs[fmt.type].quantity}
                            onChange={(e) => updateFormatConfig(fmt.type, "quantity", e.target.value)}
                            min="1"
                            className="h-8"
                          />
                        </div>
                      )}

                      {fmt.type === "vinyl" && (
                        <>
                          <div>
                            <Label className="text-xs">Vinyl Color</Label>
                            <Select 
                              value={formatConfigs.vinyl.vinyl_color}
                              onValueChange={(value) => updateFormatConfig("vinyl", "vinyl_color", value)}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {vinylColors.map(color => (
                                  <SelectItem key={color} value={color} className="capitalize">
                                    {color}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox 
                              checked={formatConfigs.vinyl.is_limited_edition}
                              onCheckedChange={(checked) => updateFormatConfig("vinyl", "is_limited_edition", checked)}
                            />
                            <Label className="text-xs">Limited Edition</Label>
                          </div>
                          {formatConfigs.vinyl.is_limited_edition && (
                            <div>
                              <Label className="text-xs">Edition Quantity</Label>
                              <Input
                                type="number"
                                value={formatConfigs.vinyl.edition_quantity || formatConfigs.vinyl.quantity}
                                onChange={(e) => updateFormatConfig("vinyl", "edition_quantity", e.target.value)}
                                min="1"
                                max={formatConfigs.vinyl.quantity}
                                className="h-8"
                              />
                            </div>
                          )}
                        </>
                      )}

                      <div>
                        <Label className="text-xs">Retail Price ($)</Label>
                        <Input
                          type="number"
                          value={formatConfigs[fmt.type].retail_price}
                          onChange={(e) => updateFormatConfig(fmt.type, "retail_price", e.target.value)}
                          min="0"
                          className="h-8"
                        />
                      </div>

                      <div className="text-xs font-medium">
                        Manufacturing Cost: ${selectedFormats.find(f => f.format_type === fmt.type)?.manufacturing_cost || 0}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-4 bg-primary/5">
        <div className="flex justify-between items-center">
          <span className="font-semibold">Total Manufacturing Cost:</span>
          <div className="text-right">
            {revenueShareEnabled && originalCost !== totalCost && (
              <span className="text-sm text-muted-foreground line-through mr-2">
                ${originalCost}
              </span>
            )}
            <span className="text-2xl font-bold">${totalCost}</span>
            {revenueShareEnabled && (
              <p className="text-xs text-primary">50% discount applied + 10% revenue share</p>
            )}
          </div>
        </div>
      </Card>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button
          onClick={onSubmit}
          disabled={selectedFormats.length === 0 || isLoading}
          className="flex-1"
        >
          Next: Streaming Distribution
        </Button>
      </div>
    </div>
  );
}
