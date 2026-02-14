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
  bandId?: string;
  songCount?: number;
}

// Manufacturing days by format type - digital/streaming are instant
const MANUFACTURING_DAYS: Record<string, number> = {
  vinyl: 14,
  cd: 7,
  cassette: 5,
  digital: 0,
  streaming: 0,
};

// Digital distribution costs (in cents)
const DIGITAL_FIRST_RELEASE_FEE = 500; // $5.00 first time setup
const DIGITAL_SUBSEQUENT_FEE = 50;     // $0.50 per release after first

// Realistic default retail prices in dollars (not cents)
const DEFAULT_RETAIL_PRICES: Record<string, number> = {
  digital: 9.99,
  streaming: 0,
  cd: 14.99,
  vinyl: 29.99,
  cassette: 12.99,
};

// Currency conversion rates (approximate)
const CURRENCY_RATES = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
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
  bandId,
  songCount = 1,
}: FormatSelectionStepProps) {
  const [formatConfigs, setFormatConfigs] = useState<Record<string, any>>({
    digital: { release_date: "", quantity: 0, retail_price: DEFAULT_RETAIL_PRICES.digital, distribution_fee_percentage: 30 },
    streaming: { release_date: "", quantity: 0, retail_price: DEFAULT_RETAIL_PRICES.streaming, distribution_fee_percentage: 30 },
    cd: { release_date: "", quantity: 100, retail_price: DEFAULT_RETAIL_PRICES.cd, distribution_fee_percentage: 30 },
    vinyl: { release_date: "", quantity: 100, retail_price: DEFAULT_RETAIL_PRICES.vinyl, distribution_fee_percentage: 30, vinyl_color: "black", is_limited_edition: false },
    cassette: { release_date: "", quantity: 100, retail_price: DEFAULT_RETAIL_PRICES.cassette, distribution_fee_percentage: 30 }
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

  // Check if band has previous releases (for digital/streaming pricing)
  const { data: existingReleasesCount } = useQuery({
    queryKey: ["band-releases-count", bandId],
    queryFn: async () => {
      if (!bandId) return 0;
      const { count } = await supabase
        .from("releases")
        .select("*", { count: "exact", head: true })
        .eq("band_id", bandId);
      return count || 0;
    },
    enabled: !!bandId,
  });

  const isFirstRelease = (existingReleasesCount ?? 0) === 0;

  const calculateManufacturingCost = (formatType: string, quantity: number) => {
    // Digital/streaming: first release has setup fee, subsequent releases are minimal
    if (formatType === "digital" || formatType === "streaming") {
      return isFirstRelease ? DIGITAL_FIRST_RELEASE_FEE : DIGITAL_SUBSEQUENT_FEE;
    }
    
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

  // Get volume discount info for a format
  const getVolumeDiscountInfo = (formatType: string, quantity: number) => {
    if (formatType === "digital" || formatType === "streaming") return null;
    
    const costs = manufacturingCosts?.filter(c => c.format_type === formatType).sort((a, b) => a.min_quantity - b.min_quantity) || [];
    if (costs.length === 0) return null;
    
    const baseTier = costs[0];
    const currentTier = costs.find(c => 
      quantity >= c.min_quantity && (c.max_quantity === null || quantity <= c.max_quantity)
    );
    
    if (!currentTier || !baseTier) return null;
    
    const discountPercent = Math.round((1 - currentTier.cost_per_unit / baseTier.cost_per_unit) * 100);
    const nextTier = costs.find(c => c.min_quantity > quantity);
    
    return {
      unitPrice: currentTier.cost_per_unit,
      discountPercent,
      nextTierQty: nextTier?.min_quantity,
      nextTierPrice: nextTier?.cost_per_unit,
    };
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
    if (formatType === "digital" || formatType === "streaming") {
      return isFirstRelease ? DIGITAL_FIRST_RELEASE_FEE : DIGITAL_SUBSEQUENT_FEE;
    }
    
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
                        <Label className="text-xs">Retail Price</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            value={formatConfigs[fmt.type].retail_price}
                            onChange={(e) => updateFormatConfig(fmt.type, "retail_price", parseFloat(e.target.value) || 0)}
                            min="0"
                            className="h-8"
                          />
                        </div>
                        {formatConfigs[fmt.type].retail_price > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            €{(formatConfigs[fmt.type].retail_price * CURRENCY_RATES.EUR).toFixed(2)} | 
                            £{(formatConfigs[fmt.type].retail_price * CURRENCY_RATES.GBP).toFixed(2)}
                          </div>
                        )}
                      </div>

                      <div className="text-xs space-y-1">
                        {(() => {
                          const discountInfo = getVolumeDiscountInfo(fmt.type, formatConfigs[fmt.type].quantity);
                          const cost = selectedFormats.find(f => f.format_type === fmt.type)?.manufacturing_cost || 0;
                          return (
                            <>
                              <div className="font-medium">
                                Manufacturing: ${(cost / 100).toFixed(2)}
                                {discountInfo && discountInfo.discountPercent > 0 && (
                                  <span className="text-primary ml-1">({discountInfo.discountPercent}% volume discount)</span>
                                )}
                              </div>
                              {discountInfo && (
                                <div className="text-muted-foreground">
                                  ${(discountInfo.unitPrice / 100).toFixed(2)}/unit
                                  {discountInfo.nextTierQty && (
                                    <span className="ml-1">
                                      • Order {discountInfo.nextTierQty}+ for ${(discountInfo.nextTierPrice! / 100).toFixed(2)}/unit
                                    </span>
                                  )}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-4 bg-primary/5 space-y-3">
        <div className="flex justify-between items-center">
          <span className="font-semibold">Total Manufacturing Cost:</span>
          <div className="text-right">
            {revenueShareEnabled && originalCost !== totalCost && (
              <span className="text-sm text-muted-foreground line-through mr-2">
                ${(originalCost / 100).toFixed(2)}
              </span>
            )}
            <span className="text-2xl font-bold">${(totalCost / 100).toFixed(2)}</span>
            {revenueShareEnabled && (
              <p className="text-xs text-primary">50% discount applied + 10% revenue share</p>
            )}
          </div>
        </div>

        {/* Per-format cost breakdown */}
        {selectedFormats.length > 0 && (
          <div className="border-t border-border pt-3 space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cost Breakdown</p>
            {selectedFormats.map((f) => (
              <div key={f.format_type} className="flex justify-between text-sm">
                <span className="capitalize text-muted-foreground">{f.format_type}{f.quantity ? ` (×${f.quantity})` : ''}</span>
                <span>${(f.manufacturing_cost / 100).toFixed(2)}</span>
              </div>
            ))}
            {songCount > 0 && totalCost > 0 && (
              <div className="flex justify-between text-sm border-t border-border/50 pt-1.5 mt-1.5">
                <span className="text-muted-foreground">Cost per track ({songCount} song{songCount !== 1 ? 's' : ''})</span>
                <span className="font-medium">${(totalCost / 100 / songCount).toFixed(2)}</span>
              </div>
            )}
          </div>
        )}
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
