import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminRoute } from "@/components/AdminRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  DollarSign, Disc, Music, Globe, Save, RotateCcw, 
  TrendingUp, Calculator, Sparkles, Circle 
} from "lucide-react";

interface SalesConfig {
  digital_base_sales_min: number;
  digital_base_sales_max: number;
  cd_base_sales_min: number;
  cd_base_sales_max: number;
  vinyl_base_sales_min: number;
  vinyl_base_sales_max: number;
  cassette_base_sales_min: number;
  cassette_base_sales_max: number;
  fame_multiplier_divisor: number;
  regional_fame_weight: number;
  market_scarcity_min_bands: number;
  market_scarcity_max_multiplier: number;
  performed_country_bonus: number;
  unvisited_fame_cap: number;
  spillover_rate: number;
}

const defaultConfig: SalesConfig = {
  digital_base_sales_min: 5,
  digital_base_sales_max: 25,
  cd_base_sales_min: 2,
  cd_base_sales_max: 10,
  vinyl_base_sales_min: 1,
  vinyl_base_sales_max: 6,
  cassette_base_sales_min: 1,
  cassette_base_sales_max: 4,
  fame_multiplier_divisor: 10000,
  regional_fame_weight: 1.0,
  market_scarcity_min_bands: 20,
  market_scarcity_max_multiplier: 5,
  performed_country_bonus: 1.2,
  unvisited_fame_cap: 100,
  spillover_rate: 0.2,
};

const SalesBalanceAdmin = () => {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<SalesConfig>(defaultConfig);
  const [previewFame, setPreviewFame] = useState(50000);
  const [previewRegionalFame, setPreviewRegionalFame] = useState(10000);

  // Fetch existing config
  const { data: savedConfig, isLoading } = useQuery({
    queryKey: ["sales-balance-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_balance_config")
        .select("key, value")
        .eq("category", "sales");
      if (error) throw error;
      
      const configMap: Partial<SalesConfig> = {};
      (data || []).forEach((item) => {
        configMap[item.key as keyof SalesConfig] = item.value as number;
      });
      return { ...defaultConfig, ...configMap };
    },
  });

  useEffect(() => {
    if (savedConfig) {
      setConfig(savedConfig);
    }
  }, [savedConfig]);

  // Save config mutation
  const saveMutation = useMutation({
    mutationFn: async (newConfig: SalesConfig) => {
      const entries = Object.entries(newConfig);
      for (const [key, value] of entries) {
        const { error } = await supabase
          .from("game_balance_config")
          .upsert(
            { 
              category: "sales", 
              key, 
              value,
              description: getConfigDescription(key),
              min_value: getConfigMin(key),
              max_value: getConfigMax(key),
              unit: getConfigUnit(key),
            },
            { onConflict: "category,key" }
          );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Sales config saved successfully");
      queryClient.invalidateQueries({ queryKey: ["sales-balance-config"] });
    },
    onError: (err) => {
      toast.error("Failed to save config: " + (err as Error).message);
    },
  });

  const getConfigDescription = (key: string): string => {
    const descriptions: Record<string, string> = {
      digital_base_sales_min: "Minimum base digital sales per day",
      digital_base_sales_max: "Maximum base digital sales per day",
      cd_base_sales_min: "Minimum base CD sales per day",
      cd_base_sales_max: "Maximum base CD sales per day",
      vinyl_base_sales_min: "Minimum base vinyl sales per day",
      vinyl_base_sales_max: "Maximum base vinyl sales per day",
      cassette_base_sales_min: "Minimum base cassette sales per day",
      cassette_base_sales_max: "Maximum base cassette sales per day",
      fame_multiplier_divisor: "Fame value to divide by for multiplier",
      regional_fame_weight: "Weight of regional fame on sales",
      market_scarcity_min_bands: "Bands threshold for max scarcity bonus",
      market_scarcity_max_multiplier: "Maximum market scarcity multiplier",
      performed_country_bonus: "Bonus multiplier for performed countries",
      unvisited_fame_cap: "Fame cap for unvisited countries",
      spillover_rate: "Fame spillover rate to neighbors",
    };
    return descriptions[key] || key;
  };

  const getConfigMin = (key: string): number => {
    const mins: Record<string, number> = {
      digital_base_sales_min: 0, digital_base_sales_max: 10,
      cd_base_sales_min: 0, cd_base_sales_max: 5,
      vinyl_base_sales_min: 0, vinyl_base_sales_max: 2,
      cassette_base_sales_min: 0, cassette_base_sales_max: 1,
      fame_multiplier_divisor: 1000, regional_fame_weight: 0.1,
      market_scarcity_min_bands: 5, market_scarcity_max_multiplier: 1,
      performed_country_bonus: 1.0, unvisited_fame_cap: 50, spillover_rate: 0,
    };
    return mins[key] || 0;
  };

  const getConfigMax = (key: string): number => {
    const maxs: Record<string, number> = {
      digital_base_sales_min: 50, digital_base_sales_max: 100,
      cd_base_sales_min: 20, cd_base_sales_max: 50,
      vinyl_base_sales_min: 10, vinyl_base_sales_max: 25,
      cassette_base_sales_min: 5, cassette_base_sales_max: 15,
      fame_multiplier_divisor: 100000, regional_fame_weight: 3.0,
      market_scarcity_min_bands: 100, market_scarcity_max_multiplier: 10,
      performed_country_bonus: 2.0, unvisited_fame_cap: 500, spillover_rate: 0.5,
    };
    return maxs[key] || 100;
  };

  const getConfigUnit = (key: string): string => {
    if (key.includes("sales")) return "sales";
    if (key.includes("fame") && !key.includes("weight")) return "fame";
    if (key.includes("multiplier") || key.includes("bonus") || key.includes("weight")) return "x";
    if (key.includes("rate")) return "%";
    if (key.includes("bands")) return "bands";
    return "";
  };

  // Preview calculation
  const calculatePreviewSales = () => {
    const fameMultiplier = 1 + previewFame / config.fame_multiplier_divisor;
    const regionalMultiplier = 0.5 + (previewRegionalFame / 10000) * config.regional_fame_weight;
    
    return {
      digital: Math.round(((config.digital_base_sales_min + config.digital_base_sales_max) / 2) * fameMultiplier * regionalMultiplier),
      cd: Math.round(((config.cd_base_sales_min + config.cd_base_sales_max) / 2) * fameMultiplier * regionalMultiplier),
      vinyl: Math.round(((config.vinyl_base_sales_min + config.vinyl_base_sales_max) / 2) * fameMultiplier * regionalMultiplier),
      cassette: Math.round(((config.cassette_base_sales_min + config.cassette_base_sales_max) / 2) * fameMultiplier * regionalMultiplier),
    };
  };

  const preview = calculatePreviewSales();

  const updateConfig = (key: keyof SalesConfig, value: number) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const SliderControl = ({ 
    label, 
    configKey, 
    min, 
    max, 
    step = 1,
    suffix = "" 
  }: { 
    label: string; 
    configKey: keyof SalesConfig; 
    min: number; 
    max: number; 
    step?: number;
    suffix?: string;
  }) => (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <Label className="text-sm">{label}</Label>
        <Badge variant="secondary">{config[configKey]}{suffix}</Badge>
      </div>
      <Slider
        value={[config[configKey] as number]}
        onValueChange={([v]) => updateConfig(configKey, v)}
        min={min}
        max={max}
        step={step}
        className="w-full"
      />
    </div>
  );

  if (isLoading) {
    return (
      <AdminRoute>
        <div className="container mx-auto p-6">
          <p className="text-muted-foreground">Loading config...</p>
        </div>
      </AdminRoute>
    );
  }

  return (
    <AdminRoute>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <DollarSign className="h-8 w-8 text-primary" />
              Sales Balance Admin
            </h1>
            <p className="text-muted-foreground">
              Configure physical and digital record sales parameters
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setConfig(defaultConfig)}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button 
              onClick={() => saveMutation.mutate(config)}
              disabled={saveMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              Save All
            </Button>
          </div>
        </div>

        {/* Live Preview */}
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Live Sales Preview
            </CardTitle>
            <CardDescription>
              Estimated daily sales based on current settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 mb-4">
              <div className="space-y-2">
                <Label>Sample Band Fame</Label>
                <Input
                  type="number"
                  value={previewFame}
                  onChange={(e) => setPreviewFame(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Sample Regional Fame</Label>
                <Input
                  type="number"
                  value={previewRegionalFame}
                  onChange={(e) => setPreviewRegionalFame(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div className="p-3 bg-background rounded-lg">
                <Music className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                <p className="text-2xl font-bold">{preview.digital}</p>
                <p className="text-xs text-muted-foreground">Digital</p>
              </div>
              <div className="p-3 bg-background rounded-lg">
                <Disc className="h-5 w-5 mx-auto mb-1 text-orange-500" />
                <p className="text-2xl font-bold">{preview.cd}</p>
                <p className="text-xs text-muted-foreground">CD</p>
              </div>
              <div className="p-3 bg-background rounded-lg">
                <Circle className="h-5 w-5 mx-auto mb-1 text-purple-500" />
                <p className="text-2xl font-bold">{preview.vinyl}</p>
                <p className="text-xs text-muted-foreground">Vinyl</p>
              </div>
              <div className="p-3 bg-background rounded-lg">
                <Sparkles className="h-5 w-5 mx-auto mb-1 text-pink-500" />
                <p className="text-2xl font-bold">{preview.cassette}</p>
                <p className="text-xs text-muted-foreground">Cassette</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="base-sales" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="base-sales" className="flex items-center gap-1">
              <Disc className="h-4 w-4" />
              Base Sales
            </TabsTrigger>
            <TabsTrigger value="multipliers" className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              Multipliers
            </TabsTrigger>
            <TabsTrigger value="regional" className="flex items-center gap-1">
              <Globe className="h-4 w-4" />
              Regional
            </TabsTrigger>
          </TabsList>

          <TabsContent value="base-sales">
            <Card>
              <CardHeader>
                <CardTitle>Base Sales Ranges</CardTitle>
                <CardDescription>
                  Configure the random base sales range for each format type (per day per release)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <Music className="h-4 w-4 text-blue-500" />
                    Digital Sales
                  </h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <SliderControl label="Minimum" configKey="digital_base_sales_min" min={0} max={50} />
                    <SliderControl label="Maximum" configKey="digital_base_sales_max" min={10} max={100} />
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <Disc className="h-4 w-4 text-orange-500" />
                    CD Sales
                  </h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <SliderControl label="Minimum" configKey="cd_base_sales_min" min={0} max={20} />
                    <SliderControl label="Maximum" configKey="cd_base_sales_max" min={5} max={50} />
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <Circle className="h-4 w-4 text-purple-500" />
                    Vinyl Sales
                  </h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <SliderControl label="Minimum" configKey="vinyl_base_sales_min" min={0} max={10} />
                    <SliderControl label="Maximum" configKey="vinyl_base_sales_max" min={2} max={25} />
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-pink-500" />
                    Cassette Sales
                  </h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <SliderControl label="Minimum" configKey="cassette_base_sales_min" min={0} max={5} />
                    <SliderControl label="Maximum" configKey="cassette_base_sales_max" min={1} max={15} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="multipliers">
            <Card>
              <CardHeader>
                <CardTitle>Fame & Market Multipliers</CardTitle>
                <CardDescription>
                  Configure how fame and market conditions affect sales
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Fame Multiplier</h4>
                  <p className="text-sm text-muted-foreground">
                    Formula: 1 + (fame / divisor). Lower divisor = fame has bigger impact.
                  </p>
                  <SliderControl 
                    label="Fame Divisor" 
                    configKey="fame_multiplier_divisor" 
                    min={1000} 
                    max={100000} 
                    step={1000}
                  />
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h4 className="font-medium">Market Scarcity</h4>
                  <p className="text-sm text-muted-foreground">
                    Fewer active bands = more sales per release (less competition)
                  </p>
                  <SliderControl 
                    label="Band Threshold" 
                    configKey="market_scarcity_min_bands" 
                    min={5} 
                    max={100}
                    suffix=" bands"
                  />
                  <SliderControl 
                    label="Max Scarcity Multiplier" 
                    configKey="market_scarcity_max_multiplier" 
                    min={1} 
                    max={10}
                    suffix="x"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="regional">
            <Card>
              <CardHeader>
                <CardTitle>Regional Fame Settings</CardTitle>
                <CardDescription>
                  Configure how regional fame affects sales and spreads between countries
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Regional Fame Weight</h4>
                  <p className="text-sm text-muted-foreground">
                    How much regional fame impacts sales (higher = bigger regional effects)
                  </p>
                  <SliderControl 
                    label="Weight" 
                    configKey="regional_fame_weight" 
                    min={0.1} 
                    max={3.0}
                    step={0.1}
                    suffix="x"
                  />
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h4 className="font-medium">Performed Country Bonus</h4>
                  <p className="text-sm text-muted-foreground">
                    Multiplier bonus for countries where the band has performed live
                  </p>
                  <SliderControl 
                    label="Bonus" 
                    configKey="performed_country_bonus" 
                    min={1.0} 
                    max={2.0}
                    step={0.1}
                    suffix="x"
                  />
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h4 className="font-medium">Unvisited Country Fame Cap</h4>
                  <p className="text-sm text-muted-foreground">
                    Maximum fame in countries where the band has never performed
                  </p>
                  <SliderControl 
                    label="Fame Cap" 
                    configKey="unvisited_fame_cap" 
                    min={50} 
                    max={500}
                    step={10}
                  />
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h4 className="font-medium">Fame Spillover Rate</h4>
                  <p className="text-sm text-muted-foreground">
                    Percentage of fame that spreads to neighboring countries
                  </p>
                  <SliderControl 
                    label="Spillover Rate" 
                    configKey="spillover_rate" 
                    min={0} 
                    max={0.5}
                    step={0.05}
                    suffix=""
                  />
                  <p className="text-xs text-muted-foreground">
                    Current: {Math.round(config.spillover_rate * 100)}% of fame spreads to neighbors
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminRoute>
  );
};

export default SalesBalanceAdmin;
