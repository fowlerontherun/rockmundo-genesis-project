import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Settings, DollarSign, Package, Disc3, Disc } from "lucide-react";

export default function ReleaseConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [config, setConfig] = useState({
    single_digital_base_cost: 50,
    single_cd_base_cost: 200,
    single_vinyl_base_cost: 400,
    ep_digital_base_cost: 150,
    ep_cd_base_cost: 500,
    ep_vinyl_base_cost: 1000,
    album_digital_base_cost: 300,
    album_cd_base_cost: 1000,
    album_vinyl_base_cost: 2000,
    streaming_upload_cost: 25,
    manufacturing_time_days: 14,
    digital_price_per_sale: 10,
    cd_price_per_sale: 15,
    vinyl_price_per_sale: 25,
  });

  // For now, just use local state since we don't have a game_config table
  // This will be stored in the database when the table is created

  const saveMutation = useMutation({
    mutationFn: async () => {
      // TODO: Save to database when game_config table is created
      console.log("Saving release config:", config);
      return config;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["release-config"] });
      toast({
        title: "Configuration Saved",
        description: "Release costs have been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save configuration: " + error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    saveMutation.mutate();
  };

  const handleChange = (key: string, value: string) => {
    setConfig(prev => ({
      ...prev,
      [key]: parseInt(value) || 0,
    }));
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Release Configuration</h1>
          <p className="text-muted-foreground">
            Manage costs and pricing for music releases
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Singles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Disc3 className="h-5 w-5" />
              Single Release Costs
            </CardTitle>
            <CardDescription>Base costs for single releases across formats</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="single_digital">Digital Single</Label>
              <Input
                id="single_digital"
                type="number"
                value={config.single_digital_base_cost}
                onChange={(e) => handleChange("single_digital_base_cost", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="single_cd">CD Single</Label>
              <Input
                id="single_cd"
                type="number"
                value={config.single_cd_base_cost}
                onChange={(e) => handleChange("single_cd_base_cost", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="single_vinyl">Vinyl Single</Label>
              <Input
                id="single_vinyl"
                type="number"
                value={config.single_vinyl_base_cost}
                onChange={(e) => handleChange("single_vinyl_base_cost", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* EPs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              EP Release Costs
            </CardTitle>
            <CardDescription>Base costs for EP releases (3-6 tracks)</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="ep_digital">Digital EP</Label>
              <Input
                id="ep_digital"
                type="number"
                value={config.ep_digital_base_cost}
                onChange={(e) => handleChange("ep_digital_base_cost", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="ep_cd">CD EP</Label>
              <Input
                id="ep_cd"
                type="number"
                value={config.ep_cd_base_cost}
                onChange={(e) => handleChange("ep_cd_base_cost", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="ep_vinyl">Vinyl EP</Label>
              <Input
                id="ep_vinyl"
                type="number"
                value={config.ep_vinyl_base_cost}
                onChange={(e) => handleChange("ep_vinyl_base_cost", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Albums */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Disc className="h-5 w-5" />
              Album Release Costs
            </CardTitle>
            <CardDescription>Base costs for full album releases (7+ tracks)</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="album_digital">Digital Album</Label>
              <Input
                id="album_digital"
                type="number"
                value={config.album_digital_base_cost}
                onChange={(e) => handleChange("album_digital_base_cost", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="album_cd">CD Album</Label>
              <Input
                id="album_cd"
                type="number"
                value={config.album_cd_base_cost}
                onChange={(e) => handleChange("album_cd_base_cost", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="album_vinyl">Vinyl Album</Label>
              <Input
                id="album_vinyl"
                type="number"
                value={config.album_vinyl_base_cost}
                onChange={(e) => handleChange("album_vinyl_base_cost", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Sales & Misc */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Sales & Other Costs
            </CardTitle>
            <CardDescription>Pricing per sale and other configuration</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="streaming">Streaming Upload Cost</Label>
              <Input
                id="streaming"
                type="number"
                value={config.streaming_upload_cost}
                onChange={(e) => handleChange("streaming_upload_cost", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="manufacturing">Manufacturing Time (days)</Label>
              <Input
                id="manufacturing"
                type="number"
                value={config.manufacturing_time_days}
                onChange={(e) => handleChange("manufacturing_time_days", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="digital_price">Digital Price Per Sale</Label>
              <Input
                id="digital_price"
                type="number"
                value={config.digital_price_per_sale}
                onChange={(e) => handleChange("digital_price_per_sale", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="cd_price">CD Price Per Sale</Label>
              <Input
                id="cd_price"
                type="number"
                value={config.cd_price_per_sale}
                onChange={(e) => handleChange("cd_price_per_sale", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="vinyl_price">Vinyl Price Per Sale</Label>
              <Input
                id="vinyl_price"
                type="number"
                value={config.vinyl_price_per_sale}
                onChange={(e) => handleChange("vinyl_price_per_sale", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving..." : "Save Configuration"}
        </Button>
      </div>
    </div>
  );
}
