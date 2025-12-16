import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminRoute } from "@/components/AdminRoute";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Settings, Zap, DollarSign, Star, TrendingUp, Users, Save, RotateCcw } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface BalanceConfig {
  id: string;
  category: string;
  key: string;
  value: number;
  description: string | null;
  min_value: number | null;
  max_value: number | null;
  unit: string | null;
}

const categoryIcons: Record<string, React.ElementType> = {
  xp: Zap,
  economy: DollarSign,
  fame: Star,
  performance: TrendingUp,
  social: Users,
};

const categoryLabels: Record<string, string> = {
  xp: "XP & Progression",
  economy: "Economy",
  fame: "Fame & Popularity",
  performance: "Performance",
  social: "Social",
};

const GameBalanceAdmin = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editedValues, setEditedValues] = useState<Record<string, number>>({});

  const { data: configs, isLoading } = useQuery({
    queryKey: ["game-balance-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_balance_config")
        .select("*")
        .order("category", { ascending: true });
      if (error) throw error;
      return data as BalanceConfig[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: number }) => {
      const { error } = await supabase
        .from("game_balance_config")
        .update({ value })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["game-balance-config"] });
      toast({ title: "Value updated", description: "Balance config saved successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const saveAllMutation = useMutation({
    mutationFn: async () => {
      const updates = Object.entries(editedValues).map(([id, value]) => 
        supabase.from("game_balance_config").update({ value }).eq("id", id)
      );
      await Promise.all(updates);
    },
    onSuccess: () => {
      setEditedValues({});
      queryClient.invalidateQueries({ queryKey: ["game-balance-config"] });
      toast({ title: "All changes saved", description: "Balance config updated successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleValueChange = (config: BalanceConfig, newValue: number) => {
    setEditedValues(prev => ({
      ...prev,
      [config.id]: newValue,
    }));
  };

  const resetChanges = () => {
    setEditedValues({});
  };

  const categories = configs 
    ? [...new Set(configs.map(c => c.category))]
    : [];

  const getConfigsByCategory = (category: string) => 
    configs?.filter(c => c.category === category) || [];

  const hasChanges = Object.keys(editedValues).length > 0;

  return (
    <AdminRoute>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-primary/10">
              <Settings className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Game Balance</h1>
              <p className="text-muted-foreground">Tune XP rates, economy, and progression values</p>
            </div>
          </div>
          {hasChanges && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetChanges}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
              <Button onClick={() => saveAllMutation.mutate()} disabled={saveAllMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Save All ({Object.keys(editedValues).length})
              </Button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading balance config...</div>
        ) : (
          <Tabs defaultValue={categories[0]} className="w-full">
            <TabsList className="flex flex-wrap h-auto gap-2 bg-transparent p-0 mb-6">
              {categories.map((category) => {
                const Icon = categoryIcons[category] || Settings;
                return (
                  <TabsTrigger
                    key={category}
                    value={category}
                    className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <Icon className="h-4 w-4" />
                    {categoryLabels[category] || category}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {categories.map((category) => (
              <TabsContent key={category} value={category}>
                <Card>
                  <CardHeader>
                    <CardTitle>{categoryLabels[category] || category}</CardTitle>
                    <CardDescription>
                      Adjust {categoryLabels[category]?.toLowerCase() || category} values
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {getConfigsByCategory(category).map((config) => {
                        const currentValue = editedValues[config.id] ?? config.value;
                        const hasMinMax = config.min_value !== null && config.max_value !== null;
                        
                        return (
                          <div key={config.id} className="space-y-3 pb-4 border-b last:border-0">
                            <div className="flex items-center justify-between">
                              <div>
                                <Label className="text-base font-medium">
                                  {config.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </Label>
                                {config.description && (
                                  <p className="text-sm text-muted-foreground">{config.description}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  value={currentValue}
                                  onChange={(e) => handleValueChange(config, parseFloat(e.target.value) || 0)}
                                  className="w-24 text-right"
                                  min={config.min_value ?? undefined}
                                  max={config.max_value ?? undefined}
                                />
                                {config.unit && (
                                  <Badge variant="outline">{config.unit}</Badge>
                                )}
                              </div>
                            </div>
                            {hasMinMax && (
                              <div className="flex items-center gap-4">
                                <span className="text-xs text-muted-foreground w-12">
                                  {config.min_value}
                                </span>
                                <Slider
                                  value={[currentValue]}
                                  onValueChange={([val]) => handleValueChange(config, val)}
                                  min={config.min_value!}
                                  max={config.max_value!}
                                  step={config.max_value! > 10 ? 1 : 0.01}
                                  className="flex-1"
                                />
                                <span className="text-xs text-muted-foreground w-12 text-right">
                                  {config.max_value}
                                </span>
                              </div>
                            )}
                            {editedValues[config.id] !== undefined && (
                              <Badge variant="secondary" className="text-xs">
                                Changed from {config.value}
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </AdminRoute>
  );
};

export default GameBalanceAdmin;