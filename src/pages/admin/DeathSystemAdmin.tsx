import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminRoute } from "@/components/AdminRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Save, Loader2, Skull, Heart, Users, Shield, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

const DeathSystemAdmin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [healthDrainPerDay, setHealthDrainPerDay] = useState(5);
  const [daysUntilDeath, setDaysUntilDeath] = useState(10);
  const [resurrectionLivesDefault, setResurrectionLivesDefault] = useState(3);
  const [resurrectHealth, setResurrectHealth] = useState(50);
  const [resurrectEnergy, setResurrectEnergy] = useState(50);
  const [relativeSkillInheritPct, setRelativeSkillInheritPct] = useState(10);
  const [relativeCashInheritPct, setRelativeCashInheritPct] = useState(50);
  const [staleThresholdHours, setStaleThresholdHours] = useState(24);

  const { data: config, isLoading } = useQuery({
    queryKey: ["death-system-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_balance_config")
        .select("*")
        .eq("category", "death_system");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (config) {
      const getVal = (key: string, fallback: number) => {
        const item = config.find((c: any) => c.key === key);
        return item ? Number(item.value) : fallback;
      };
      setHealthDrainPerDay(getVal("death_health_drain_per_day", 5));
      setDaysUntilDeath(getVal("death_days_until_death", 10));
      setResurrectionLivesDefault(getVal("death_resurrection_lives_default", 3));
      setResurrectHealth(getVal("death_resurrect_health", 50));
      setResurrectEnergy(getVal("death_resurrect_energy", 50));
      setRelativeSkillInheritPct(getVal("death_relative_skill_inherit_pct", 10));
      setRelativeCashInheritPct(getVal("death_relative_cash_inherit_pct", 50));
      setStaleThresholdHours(getVal("death_stale_threshold_hours", 24));
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const configs = [
        { key: "death_health_drain_per_day", value: healthDrainPerDay, category: "death_system", description: "Health points drained per day of inactivity" },
        { key: "death_days_until_death", value: daysUntilDeath, category: "death_system", description: "Days offline at 0 health before character dies" },
        { key: "death_resurrection_lives_default", value: resurrectionLivesDefault, category: "death_system", description: "Default resurrection lives for new characters" },
        { key: "death_resurrect_health", value: resurrectHealth, category: "death_system", description: "Health restored on resurrection" },
        { key: "death_resurrect_energy", value: resurrectEnergy, category: "death_system", description: "Energy restored on resurrection" },
        { key: "death_relative_skill_inherit_pct", value: relativeSkillInheritPct, category: "death_system", description: "Percent of skills inherited by relative" },
        { key: "death_relative_cash_inherit_pct", value: relativeCashInheritPct, category: "death_system", description: "Percent of cash inherited by relative" },
        { key: "death_stale_threshold_hours", value: staleThresholdHours, category: "death_system", description: "Hours since last login before health drain starts" },
      ];
      for (const cfg of configs) {
        const { error } = await supabase
          .from("game_balance_config")
          .upsert({ key: cfg.key, value: cfg.value, category: cfg.category, description: cfg.description }, { onConflict: "key" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["death-system-config"] });
      toast({ title: "Saved", description: "Death system settings updated." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const { data: deathStats } = useQuery({
    queryKey: ["death-stats"],
    queryFn: async () => {
      const { count: deadCount } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .not("died_at", "is", null);

      const { count: livingCount } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .is("died_at", null)
        .eq("is_active", true);

      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: staleCount } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .is("died_at", null)
        .eq("is_active", true)
        .lt("last_login_at", oneDayAgo);

      return {
        dead: deadCount ?? 0,
        living: livingCount ?? 0,
        stale: staleCount ?? 0,
      };
    },
  });

  return (
    <AdminRoute>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Death & Resurrection System</h1>
            <p className="text-sm text-muted-foreground">Configure permadeath, health decay, and character recovery</p>
          </div>
        </div>

        {/* Stats overview */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Heart className="h-4 w-4 text-emerald-500" /> Living Characters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{deathStats?.living ?? "—"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Skull className="h-4 w-4 text-destructive" /> Dead Characters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{deathStats?.dead ?? "—"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" /> At Risk (Stale 24h+)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{deathStats?.stale ?? "—"}</p>
            </CardContent>
          </Card>
        </div>

        <Alert className="bg-muted/60">
          <AlertDescription>
            These settings control the edge function <code>check-character-health-decay</code>. 
            After saving, the cron job will use these values on its next run. 
            Note: the edge function must be updated to read from <code>game_balance_config</code> for changes to take effect dynamically.
          </AlertDescription>
        </Alert>

        {/* Health Decay */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Skull className="h-5 w-5 text-destructive" />
              Health Decay & Death
            </CardTitle>
            <CardDescription>How quickly inactive players lose health and when death triggers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Stale Threshold: {staleThresholdHours} hours</Label>
              <Slider value={[staleThresholdHours]} onValueChange={([v]) => setStaleThresholdHours(v)} min={12} max={72} step={1} />
              <p className="text-xs text-muted-foreground">Hours since last login before health drain begins</p>
            </div>
            <div className="space-y-2">
              <Label>Health Drain Per Day: {healthDrainPerDay} HP</Label>
              <Slider value={[healthDrainPerDay]} onValueChange={([v]) => setHealthDrainPerDay(v)} min={1} max={25} step={1} />
              <p className="text-xs text-muted-foreground">Health points lost per day of inactivity</p>
            </div>
            <div className="space-y-2">
              <Label>Days at 0 HP Until Death: {daysUntilDeath} days</Label>
              <Slider value={[daysUntilDeath]} onValueChange={([v]) => setDaysUntilDeath(v)} min={3} max={30} step={1} />
              <p className="text-xs text-muted-foreground">How many days a character can survive at 0 health before permadeath</p>
            </div>
          </CardContent>
        </Card>

        {/* Resurrection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Resurrection
            </CardTitle>
            <CardDescription>Settings for bringing characters back from the dead</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Default Resurrection Lives: {resurrectionLivesDefault}</Label>
              <Slider value={[resurrectionLivesDefault]} onValueChange={([v]) => setResurrectionLivesDefault(v)} min={0} max={10} step={1} />
              <p className="text-xs text-muted-foreground">Lives granted to new characters (each allows one resurrection)</p>
            </div>
            <div className="space-y-2">
              <Label>Health After Resurrection: {resurrectHealth}%</Label>
              <Slider value={[resurrectHealth]} onValueChange={([v]) => setResurrectHealth(v)} min={10} max={100} step={5} />
              <p className="text-xs text-muted-foreground">Health restored when a character is resurrected</p>
            </div>
            <div className="space-y-2">
              <Label>Energy After Resurrection: {resurrectEnergy}%</Label>
              <Slider value={[resurrectEnergy]} onValueChange={([v]) => setResurrectEnergy(v)} min={10} max={100} step={5} />
              <p className="text-xs text-muted-foreground">Energy restored when a character is resurrected</p>
            </div>
          </CardContent>
        </Card>

        {/* Start as Relative */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Start as Relative (Legacy)
            </CardTitle>
            <CardDescription>Inheritance settings when a player starts a new character as a family member</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Skill Inheritance: {relativeSkillInheritPct}%</Label>
              <Slider value={[relativeSkillInheritPct]} onValueChange={([v]) => setRelativeSkillInheritPct(v)} min={0} max={50} step={1} />
              <p className="text-xs text-muted-foreground">Percentage of previous character's skills carried over</p>
            </div>
            <div className="space-y-2">
              <Label>Cash Inheritance: {relativeCashInheritPct}%</Label>
              <Slider value={[relativeCashInheritPct]} onValueChange={([v]) => setRelativeCashInheritPct(v)} min={0} max={100} step={5} />
              <p className="text-xs text-muted-foreground">Percentage of previous character's cash carried over</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save All Settings
          </Button>
        </div>
      </div>
    </AdminRoute>
  );
};

export default DeathSystemAdmin;
