import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminRoute } from "@/components/AdminRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, TrendingUp, Globe, Award, BarChart, Save, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const ChartsAdmin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Ranking weights
  const [streamsWeight, setStreamsWeight] = useState(40);
  const [salesWeight, setSalesWeight] = useState(30);
  const [radioPlaysWeight, setRadioPlaysWeight] = useState(20);
  const [socialEngagementWeight, setSocialEngagementWeight] = useState(10);

  // Chart rewards
  const [top1Fame, setTop1Fame] = useState(500);
  const [top10Fame, setTop10Fame] = useState(100);
  const [top40Fame, setTop40Fame] = useState(25);
  const [top1Cash, setTop1Cash] = useState(5000);
  const [top10Cash, setTop10Cash] = useState(1000);
  const [chartEntryXp, setChartEntryXp] = useState(50);

  // Chart mechanics
  const [chartUpdateFrequency, setChartUpdateFrequency] = useState(24);
  const [weeksOnChartMax, setWeeksOnChartMax] = useState(52);
  const [newEntryBoost, setNewEntryBoost] = useState(15);
  const [decayRate, setDecayRate] = useState(5);

  const { data: config, isLoading } = useQuery({
    queryKey: ["chart-balance-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_balance_config")
        .select("*")
        .like("key", "chart_%");
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (config) {
      const getVal = (key: string, defaultVal: number) => {
        const item = config.find((c: any) => c.key === key);
        return item ? Number(item.value) : defaultVal;
      };
      setStreamsWeight(getVal("chart_streams_weight", 40));
      setSalesWeight(getVal("chart_sales_weight", 30));
      setRadioPlaysWeight(getVal("chart_radio_weight", 20));
      setSocialEngagementWeight(getVal("chart_social_weight", 10));
      setTop1Fame(getVal("chart_top1_fame", 500));
      setTop10Fame(getVal("chart_top10_fame", 100));
      setTop40Fame(getVal("chart_top40_fame", 25));
      setTop1Cash(getVal("chart_top1_cash", 5000));
      setTop10Cash(getVal("chart_top10_cash", 1000));
      setChartEntryXp(getVal("chart_entry_xp", 50));
      setChartUpdateFrequency(getVal("chart_update_hours", 24));
      setWeeksOnChartMax(getVal("chart_max_weeks", 52));
      setNewEntryBoost(getVal("chart_new_entry_boost", 15));
      setDecayRate(getVal("chart_decay_rate", 5));
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async (configs: { key: string; value: number; category: string; description: string }[]) => {
      for (const cfg of configs) {
        const { error } = await supabase
          .from("game_balance_config")
          .upsert({ key: cfg.key, value: cfg.value, category: cfg.category, description: cfg.description }, { onConflict: "key" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chart-balance-config"] });
      toast({ title: "Chart settings saved successfully" });
    },
    onError: () => {
      toast({ title: "Failed to save settings", variant: "destructive" });
    },
  });

  const saveAllSettings = () => {
    saveMutation.mutate([
      { key: "chart_streams_weight", value: streamsWeight, category: "chart_ranking", description: "Weight of streams in ranking" },
      { key: "chart_sales_weight", value: salesWeight, category: "chart_ranking", description: "Weight of sales in ranking" },
      { key: "chart_radio_weight", value: radioPlaysWeight, category: "chart_ranking", description: "Weight of radio plays in ranking" },
      { key: "chart_social_weight", value: socialEngagementWeight, category: "chart_ranking", description: "Weight of social engagement" },
      { key: "chart_top1_fame", value: top1Fame, category: "chart_rewards", description: "Fame for #1 position" },
      { key: "chart_top10_fame", value: top10Fame, category: "chart_rewards", description: "Fame for top 10 position" },
      { key: "chart_top40_fame", value: top40Fame, category: "chart_rewards", description: "Fame for top 40 position" },
      { key: "chart_top1_cash", value: top1Cash, category: "chart_rewards", description: "Cash bonus for #1" },
      { key: "chart_top10_cash", value: top10Cash, category: "chart_rewards", description: "Cash bonus for top 10" },
      { key: "chart_entry_xp", value: chartEntryXp, category: "chart_rewards", description: "XP for chart entry" },
      { key: "chart_update_hours", value: chartUpdateFrequency, category: "chart_mechanics", description: "Hours between chart updates" },
      { key: "chart_max_weeks", value: weeksOnChartMax, category: "chart_mechanics", description: "Max weeks a song can chart" },
      { key: "chart_new_entry_boost", value: newEntryBoost, category: "chart_mechanics", description: "% boost for new entries" },
      { key: "chart_decay_rate", value: decayRate, category: "chart_mechanics", description: "% decay per week for aging songs" },
    ]);
  };

  if (isLoading) {
    return (
      <AdminRoute>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AdminRoute>
    );
  }

  return (
    <AdminRoute>
      <div className="container mx-auto py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Charts Administration</h1>
              <p className="text-muted-foreground">Manage music charts, rankings, and trending algorithms</p>
            </div>
          </div>
          <Button onClick={saveAllSettings} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save All Settings
          </Button>
        </div>

        <Tabs defaultValue="ranking" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ranking" className="flex items-center gap-2">
              <BarChart className="h-4 w-4" />
              <span className="hidden sm:inline">Ranking</span>
            </TabsTrigger>
            <TabsTrigger value="rewards" className="flex items-center gap-2">
              <Award className="h-4 w-4" />
              <span className="hidden sm:inline">Rewards</span>
            </TabsTrigger>
            <TabsTrigger value="mechanics" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Mechanics</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ranking">
            <Card>
              <CardHeader>
                <CardTitle>Ranking Algorithm Weights</CardTitle>
                <CardDescription>How different metrics contribute to chart position (should total 100%)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Streams Weight: {streamsWeight}%</Label>
                    <Slider value={[streamsWeight]} onValueChange={([v]) => setStreamsWeight(v)} min={0} max={100} step={5} />
                    <p className="text-xs text-muted-foreground">Influence of streaming numbers</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Sales Weight: {salesWeight}%</Label>
                    <Slider value={[salesWeight]} onValueChange={([v]) => setSalesWeight(v)} min={0} max={100} step={5} />
                    <p className="text-xs text-muted-foreground">Influence of digital/physical sales</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Radio Plays Weight: {radioPlaysWeight}%</Label>
                    <Slider value={[radioPlaysWeight]} onValueChange={([v]) => setRadioPlaysWeight(v)} min={0} max={100} step={5} />
                    <p className="text-xs text-muted-foreground">Influence of radio airplay</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Social Engagement Weight: {socialEngagementWeight}%</Label>
                    <Slider value={[socialEngagementWeight]} onValueChange={([v]) => setSocialEngagementWeight(v)} min={0} max={100} step={5} />
                    <p className="text-xs text-muted-foreground">Influence of Twaater/social activity</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Current total: {streamsWeight + salesWeight + radioPlaysWeight + socialEngagementWeight}%
                  {streamsWeight + salesWeight + radioPlaysWeight + socialEngagementWeight !== 100 && (
                    <span className="text-destructive ml-2">(Should be 100%)</span>
                  )}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rewards">
            <Card>
              <CardHeader>
                <CardTitle>Chart Position Rewards</CardTitle>
                <CardDescription>Fame, cash, and XP rewards for charting</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label>#1 Position Fame</Label>
                    <Input type="number" value={top1Fame} onChange={(e) => setTop1Fame(Number(e.target.value))} min={0} />
                    <p className="text-xs text-muted-foreground">Fame for reaching #1</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Top 10 Fame</Label>
                    <Input type="number" value={top10Fame} onChange={(e) => setTop10Fame(Number(e.target.value))} min={0} />
                    <p className="text-xs text-muted-foreground">Fame for top 10 position</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Top 40 Fame</Label>
                    <Input type="number" value={top40Fame} onChange={(e) => setTop40Fame(Number(e.target.value))} min={0} />
                    <p className="text-xs text-muted-foreground">Fame for chart entry</p>
                  </div>
                  <div className="space-y-2">
                    <Label>#1 Cash Bonus ($)</Label>
                    <Input type="number" value={top1Cash} onChange={(e) => setTop1Cash(Number(e.target.value))} min={0} />
                    <p className="text-xs text-muted-foreground">Cash reward for #1</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Top 10 Cash Bonus ($)</Label>
                    <Input type="number" value={top10Cash} onChange={(e) => setTop10Cash(Number(e.target.value))} min={0} />
                    <p className="text-xs text-muted-foreground">Cash for top 10</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Chart Entry XP</Label>
                    <Input type="number" value={chartEntryXp} onChange={(e) => setChartEntryXp(Number(e.target.value))} min={0} />
                    <p className="text-xs text-muted-foreground">XP for any chart entry</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mechanics">
            <Card>
              <CardHeader>
                <CardTitle>Chart Mechanics</CardTitle>
                <CardDescription>Update frequency, decay, and longevity settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Update Frequency (hours)</Label>
                    <Input type="number" value={chartUpdateFrequency} onChange={(e) => setChartUpdateFrequency(Number(e.target.value))} min={1} max={168} />
                    <p className="text-xs text-muted-foreground">How often charts are recalculated</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Max Weeks on Chart</Label>
                    <Input type="number" value={weeksOnChartMax} onChange={(e) => setWeeksOnChartMax(Number(e.target.value))} min={1} max={104} />
                    <p className="text-xs text-muted-foreground">Maximum charting duration</p>
                  </div>
                  <div className="space-y-2">
                    <Label>New Entry Boost: {newEntryBoost}%</Label>
                    <Slider value={[newEntryBoost]} onValueChange={([v]) => setNewEntryBoost(v)} min={0} max={50} step={1} />
                    <p className="text-xs text-muted-foreground">Boost for newly charting songs</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Weekly Decay Rate: {decayRate}%</Label>
                    <Slider value={[decayRate]} onValueChange={([v]) => setDecayRate(v)} min={0} max={20} step={1} />
                    <p className="text-xs text-muted-foreground">How fast old songs drop</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminRoute>
  );
};

export default ChartsAdmin;
