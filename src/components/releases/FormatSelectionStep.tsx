import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Disc3, Globe, Headphones, Radio } from "lucide-react";

interface FormatSelectionStepProps {
  selectedFormats: any[];
  onFormatsChange: (formats: any[]) => void;
  onBack: () => void;
  onSubmit: () => void;
  isLoading: boolean;
}

export function FormatSelectionStep({
  selectedFormats,
  onFormatsChange,
  onBack,
  onSubmit,
  isLoading
}: FormatSelectionStepProps) {
  const [formatConfigs, setFormatConfigs] = useState<Record<string, any>>({
    digital: { release_date: "", quantity: 0, retail_price: 1000, distribution_fee_percentage: 30 },
    streaming: { release_date: "", quantity: 0, retail_price: 0, distribution_fee_percentage: 30 },
    cd: { release_date: "", quantity: 100, retail_price: 1500, distribution_fee_percentage: 30 },
    vinyl: { release_date: "", quantity: 100, retail_price: 3000, distribution_fee_percentage: 30 }
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
    
    return tier ? tier.cost_per_unit * quantity : 0;
  };

  const formats = [
    { type: "digital", label: "Digital", icon: Globe, description: "Download" },
    { type: "streaming", label: "Streaming", icon: Headphones, description: "Spotify, Apple Music" },
    { type: "cd", label: "CD", icon: Disc3, description: "Physical disc" },
    { type: "vinyl", label: "Vinyl", icon: Radio, description: "Vinyl record" }
  ];

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

  const totalCost = selectedFormats.reduce((sum, f) => sum + f.manufacturing_cost, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {formats.map((format) => {
          const Icon = format.icon;
          const isSelected = selectedFormats.some(f => f.format_type === format.type);
          
          return (
            <Card
              key={format.type}
              className={`p-4 cursor-pointer ${isSelected ? "border-primary" : ""}`}
              onClick={() => toggleFormat(format.type)}
            >
              <div className="flex items-start gap-3">
                <Checkbox checked={isSelected} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-5 w-5" />
                    <div>
                      <div className="font-semibold">{format.label}</div>
                      <div className="text-xs text-muted-foreground">{format.description}</div>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="space-y-2 mt-3" onClick={(e) => e.stopPropagation()}>
                      <div>
                        <Label className="text-xs">Release Date</Label>
                        <Input
                          type="date"
                          value={formatConfigs[format.type].release_date}
                          onChange={(e) => updateFormatConfig(format.type, "release_date", e.target.value)}
                          className="h-8"
                        />
                      </div>

                      {(format.type === "cd" || format.type === "vinyl") && (
                        <div>
                          <Label className="text-xs">Quantity</Label>
                          <Input
                            type="number"
                            value={formatConfigs[format.type].quantity}
                            onChange={(e) => updateFormatConfig(format.type, "quantity", e.target.value)}
                            min="1"
                            className="h-8"
                          />
                        </div>
                      )}

                      <div>
                        <Label className="text-xs">Retail Price ($)</Label>
                        <Input
                          type="number"
                          value={formatConfigs[format.type].retail_price}
                          onChange={(e) => updateFormatConfig(format.type, "retail_price", e.target.value)}
                          min="0"
                          className="h-8"
                        />
                      </div>

                      <div className="text-xs font-medium">
                        Manufacturing Cost: ${selectedFormats.find(f => f.format_type === format.type)?.manufacturing_cost || 0}
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
          <span className="text-2xl font-bold">${totalCost}</span>
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
          {isLoading ? "Creating..." : "Create Release"}
        </Button>
      </div>
    </div>
  );
}
