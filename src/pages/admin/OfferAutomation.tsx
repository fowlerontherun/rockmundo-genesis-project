import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  PauseCircle,
  PlayCircle,
  Save,
  Settings,
  Sparkles,
  Timer,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

interface FameTier {
  name: string;
  min: number;
  max: number;
  offerMultiplier: number;
}

interface OfferStats {
  label: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
}

const DEFAULT_CONFIG = {
  globalPause: false,
  offerFrequencyMinutes: 45,
  cooldownHours: 24,
  brandCooldownDays: 3,
  payoutVariance: 15,
  fameTiers: [
    { name: "Street", min: 0, max: 499, offerMultiplier: 0.8 },
    { name: "Rising", min: 500, max: 1999, offerMultiplier: 1 },
    { name: "Regional", min: 2000, max: 4999, offerMultiplier: 1.25 },
    { name: "National", min: 5000, max: 9999, offerMultiplier: 1.5 },
    { name: "Global", min: 10000, max: 25000, offerMultiplier: 2 },
  ],
};

export default function OfferAutomation() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [globalPause, setGlobalPause] = useState(DEFAULT_CONFIG.globalPause);
  const [offerFrequencyMinutes, setOfferFrequencyMinutes] = useState(DEFAULT_CONFIG.offerFrequencyMinutes);
  const [cooldownHours, setCooldownHours] = useState(DEFAULT_CONFIG.cooldownHours);
  const [brandCooldownDays, setBrandCooldownDays] = useState(DEFAULT_CONFIG.brandCooldownDays);
  const [payoutVariance, setPayoutVariance] = useState(DEFAULT_CONFIG.payoutVariance);
  const [fameTiers, setFameTiers] = useState<FameTier[]>(DEFAULT_CONFIG.fameTiers);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Fetch config from database
  const { data: configData, isLoading } = useQuery({
    queryKey: ["offer-automation-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_balance_config")
        .select("*")
        .eq("category", "offer_automation");
      if (error) throw error;
      return data || [];
    },
  });

  // Load config into state
  useEffect(() => {
    if (configData && configData.length > 0) {
      const getConfig = (key: string, defaultValue: any) => {
        const item = configData.find((c) => c.key === key);
        return item ? item.value : defaultValue;
      };

      setGlobalPause(getConfig("global_pause", DEFAULT_CONFIG.globalPause) === 1);
      setOfferFrequencyMinutes(getConfig("offer_frequency_minutes", DEFAULT_CONFIG.offerFrequencyMinutes));
      setCooldownHours(getConfig("cooldown_hours", DEFAULT_CONFIG.cooldownHours));
      setBrandCooldownDays(getConfig("brand_cooldown_days", DEFAULT_CONFIG.brandCooldownDays));
      setPayoutVariance(getConfig("payout_variance", DEFAULT_CONFIG.payoutVariance));
      setHasUnsavedChanges(false);
    }
  }, [configData]);

  // Save config mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const configs = [
        { category: "offer_automation", key: "global_pause", value: globalPause ? 1 : 0, description: "Global Pause" },
        { category: "offer_automation", key: "offer_frequency_minutes", value: offerFrequencyMinutes, description: "Offer Frequency (minutes)" },
        { category: "offer_automation", key: "cooldown_hours", value: cooldownHours, description: "Cooldown Duration (hours)" },
        { category: "offer_automation", key: "brand_cooldown_days", value: brandCooldownDays, description: "Brand Cooldown (days)" },
        { category: "offer_automation", key: "payout_variance", value: payoutVariance, description: "Payout Variance (%)" },
      ];

      for (const config of configs) {
        const { error } = await supabase
          .from("game_balance_config")
          .upsert(config, { onConflict: "category,key" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offer-automation-config"] });
      toast({ title: "Configuration saved successfully" });
      setHasUnsavedChanges(false);
    },
    onError: (error) => {
      toast({ title: "Failed to save configuration", description: String(error), variant: "destructive" });
    },
  });

  const handleChange = () => {
    setHasUnsavedChanges(true);
  };

  const offerStats: OfferStats[] = useMemo(
    () => [
      {
        label: "Offers Generated (24h)",
        value: "—",
        helper: "Includes all bands and brands with cooldown applied",
        icon: <Activity className="h-4 w-4" />,
      },
      {
        label: "Average Queue Latency",
        value: "—",
        helper: "Time between cron start and first insert",
        icon: <Clock className="h-4 w-4" />,
      },
      {
        label: "Error Rate",
        value: "—",
        helper: "Failures recorded by job logger in the last day",
        icon: <AlertTriangle className="h-4 w-4 text-amber-600" />,
      },
      {
        label: "Cooldown Skips Prevented",
        value: "—",
        helper: "Bands skipped because cooldowns are still active",
        icon: <Timer className="h-4 w-4" />,
      },
    ],
    [],
  );

  const handleFameTierChange = (index: number, field: keyof FameTier, value: number) => {
    setFameTiers((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value } as FameTier;
      return updated;
    });
    handleChange();
  };

  const toggleGlobalPause = (paused: boolean) => {
    setGlobalPause(paused);
    handleChange();
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Offer Automation Controls</h1>
          <p className="text-muted-foreground">
            Tune generation frequency, cooldown policies, payout variance, and fame tier thresholds.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            onClick={() => saveMutation.mutate()} 
            disabled={!hasUnsavedChanges || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Changes
          </Button>
          <div className="flex items-center gap-2">
            <Switch id="global-pause" checked={globalPause} onCheckedChange={toggleGlobalPause} />
            <Label htmlFor="global-pause" className="flex items-center gap-2">
              Global Auto-Offers
              <Badge variant={globalPause ? "destructive" : "secondary"}>
                {globalPause ? "Paused" : "Active"}
              </Badge>
            </Label>
          </div>
        </div>
      </div>

      {hasUnsavedChanges && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2 text-sm text-amber-600 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          You have unsaved changes
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {offerStats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{stat.label}</span>
                {stat.icon}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.helper}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Offer Generation Configuration</CardTitle>
              <CardDescription>
                Control how frequently offers are generated, cooldown durations, and payout variance.
              </CardDescription>
            </div>
            <Settings className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="frequency">Offer Frequency (minutes)</Label>
              <Input
                id="frequency"
                type="number"
                min={5}
                value={offerFrequencyMinutes}
                onChange={(e) => {
                  setOfferFrequencyMinutes(Number(e.target.value));
                  handleChange();
                }}
              />
              <p className="text-xs text-muted-foreground">
                Controls how often the engine schedules new offers per brand.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cooldown">Cooldown Duration (hours)</Label>
              <Input
                id="cooldown"
                type="number"
                min={1}
                value={cooldownHours}
                onChange={(e) => {
                  setCooldownHours(Number(e.target.value));
                  handleChange();
                }}
              />
              <p className="text-xs text-muted-foreground">
                Prevents duplicate outreach to bands that recently received offers.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand-cooldown">Brand Cooldown (days)</Label>
              <Input
                id="brand-cooldown"
                type="number"
                min={1}
                value={brandCooldownDays}
                onChange={(e) => {
                  setBrandCooldownDays(Number(e.target.value));
                  handleChange();
                }}
              />
              <p className="text-xs text-muted-foreground">
                Controls how often a brand can send repeat offers to the same band.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="variance">Payout Variance (%)</Label>
              <Input
                id="variance"
                type="number"
                min={0}
                max={50}
                value={payoutVariance}
                onChange={(e) => {
                  setPayoutVariance(Number(e.target.value));
                  handleChange();
                }}
              />
              <p className="text-xs text-muted-foreground">
                Adds controlled randomness to base payouts to avoid monotony.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>Current automation status and quick actions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Automation Status</p>
                <p className="text-xs text-muted-foreground">Controls whether offers are generated automatically</p>
              </div>
              <div className="flex items-center gap-2">
                {globalPause ? (
                  <PauseCircle className="h-4 w-4 text-destructive" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                )}
                <span className="text-lg font-semibold">{globalPause ? "Paused" : "Active"}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1" 
                onClick={() => toggleGlobalPause(false)}
                disabled={!globalPause}
              >
                <PlayCircle className="mr-1 h-4 w-4" /> Resume
              </Button>
              <Button 
                variant="outline" 
                className="flex-1" 
                onClick={() => toggleGlobalPause(true)}
                disabled={globalPause}
              >
                <PauseCircle className="mr-1 h-4 w-4" /> Pause
              </Button>
            </div>

            <div className="rounded-lg border p-3 bg-muted/30">
              <p className="text-sm font-medium mb-2">Quick Reference</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Offers generated every {offerFrequencyMinutes} minutes</li>
                <li>• Band cooldown: {cooldownHours} hours between offers</li>
                <li>• Brand cooldown: {brandCooldownDays} days for same band</li>
                <li>• Payout variance: ±{payoutVariance}%</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Fame Tier Thresholds</CardTitle>
            <CardDescription>Control when bands graduate into higher-paying offer pools.</CardDescription>
          </div>
          <Sparkles className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tier</TableHead>
                <TableHead>Min Fame</TableHead>
                <TableHead>Max Fame</TableHead>
                <TableHead>Payout Multiplier</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fameTiers.map((tier, index) => (
                <TableRow key={tier.name}>
                  <TableCell className="font-medium">{tier.name}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      value={tier.min}
                      onChange={(e) => handleFameTierChange(index, "min", Number(e.target.value))}
                      className="w-24"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      value={tier.max}
                      onChange={(e) => handleFameTierChange(index, "max", Number(e.target.value))}
                      className="w-24"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={tier.offerMultiplier}
                      onChange={(e) => handleFameTierChange(index, "offerMultiplier", Number(e.target.value))}
                      className="w-24"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
