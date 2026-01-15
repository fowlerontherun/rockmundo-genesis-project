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
import { ArrowLeft, Users, Heart, Shield, TrendingUp, Save, Loader2, Sprout } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface BalanceConfig {
  key: string;
  value: number;
  description: string;
}

const BandAdmin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Chemistry settings
  const [chemistryGainPerRehearsal, setChemistryGainPerRehearsal] = useState(5);
  const [chemistryGainPerGig, setChemistryGainPerGig] = useState(10);
  const [chemistryDecayPerWeek, setChemistryDecayPerWeek] = useState(2);
  const [maxChemistry, setMaxChemistry] = useState(100);

  // Band limits
  const [maxBandMembers, setMaxBandMembers] = useState(6);
  const [maxTouringMembers, setMaxTouringMembers] = useState(3);
  const [minMembersForGig, setMinMembersForGig] = useState(2);

  // Leadership
  const [votingFrequencyDays, setVotingFrequencyDays] = useState(30);
  const [leaderDecisionWeight, setLeaderDecisionWeight] = useState(2);

  // Bonuses
  const [songwritingChemistryBonus, setSongwritingChemistryBonus] = useState(20);
  const [performanceChemistryBonus, setPerformanceChemistryBonus] = useState(25);
  const [rehearsalChemistryBonus, setRehearsalChemistryBonus] = useState(15);

  // Growth settings (NEW)
  const [dailyFameMin, setDailyFameMin] = useState(5);
  const [dailyFameMax, setDailyFameMax] = useState(15);
  const [dailyFansMin, setDailyFansMin] = useState(5);
  const [dailyFansMax, setDailyFansMax] = useState(20);
  const [fameToFansRate, setFameToFansRate] = useState(0.5);
  const [playerFameShare, setPlayerFameShare] = useState(92);
  const [playerFansShare, setPlayerFansShare] = useState(92);

  // Fetch existing config
  const { data: config, isLoading } = useQuery({
    queryKey: ["band-balance-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_balance_config")
        .select("*")
        .like("key", "band_%");
      if (error) throw error;
      return data || [];
    },
  });

  // Load config into state
  useEffect(() => {
    if (config) {
      const getVal = (key: string, defaultVal: number) => {
        const item = config.find((c: any) => c.key === key);
        return item ? Number(item.value) : defaultVal;
      };
      // Chemistry
      setChemistryGainPerRehearsal(getVal("band_chemistry_gain_rehearsal", 5));
      setChemistryGainPerGig(getVal("band_chemistry_gain_gig", 10));
      setChemistryDecayPerWeek(getVal("band_chemistry_decay_week", 2));
      setMaxChemistry(getVal("band_max_chemistry", 100));
      // Limits
      setMaxBandMembers(getVal("band_max_members", 6));
      setMaxTouringMembers(getVal("band_max_touring_members", 3));
      setMinMembersForGig(getVal("band_min_members_gig", 2));
      // Leadership
      setVotingFrequencyDays(getVal("band_voting_frequency_days", 30));
      setLeaderDecisionWeight(getVal("band_leader_decision_weight", 2));
      // Bonuses
      setSongwritingChemistryBonus(getVal("band_songwriting_chemistry_bonus", 20));
      setPerformanceChemistryBonus(getVal("band_performance_chemistry_bonus", 25));
      setRehearsalChemistryBonus(getVal("band_rehearsal_chemistry_bonus", 15));
      // Growth (NEW)
      setDailyFameMin(getVal("band_daily_fame_min", 5));
      setDailyFameMax(getVal("band_daily_fame_max", 15));
      setDailyFansMin(getVal("band_daily_fans_min", 5));
      setDailyFansMax(getVal("band_daily_fans_max", 20));
      setFameToFansRate(getVal("band_fame_to_fans_rate", 0.5));
      setPlayerFameShare(getVal("band_player_fame_share", 92));
      setPlayerFansShare(getVal("band_player_fans_share", 92));
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async (configs: { key: string; value: number; category: string; description: string }[]) => {
      for (const cfg of configs) {
        const { error } = await supabase
          .from("game_balance_config")
          .upsert({
            key: cfg.key,
            value: cfg.value,
            category: cfg.category,
            description: cfg.description,
          }, { onConflict: "key" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["band-balance-config"] });
      toast({ title: "Settings saved successfully" });
    },
    onError: () => {
      toast({ title: "Failed to save settings", variant: "destructive" });
    },
  });

  const saveAllSettings = () => {
    saveMutation.mutate([
      // Chemistry
      { key: "band_chemistry_gain_rehearsal", value: chemistryGainPerRehearsal, category: "band_chemistry", description: "Chemistry points gained per rehearsal" },
      { key: "band_chemistry_gain_gig", value: chemistryGainPerGig, category: "band_chemistry", description: "Chemistry points gained per gig" },
      { key: "band_chemistry_decay_week", value: chemistryDecayPerWeek, category: "band_chemistry", description: "Chemistry points lost per week of inactivity" },
      { key: "band_max_chemistry", value: maxChemistry, category: "band_chemistry", description: "Maximum chemistry level" },
      // Limits
      { key: "band_max_members", value: maxBandMembers, category: "band_limits", description: "Maximum band members" },
      { key: "band_max_touring_members", value: maxTouringMembers, category: "band_limits", description: "Maximum touring/session members" },
      { key: "band_min_members_gig", value: minMembersForGig, category: "band_limits", description: "Minimum members required for a gig" },
      // Leadership
      { key: "band_voting_frequency_days", value: votingFrequencyDays, category: "band_leadership", description: "Days between leadership votes" },
      { key: "band_leader_decision_weight", value: leaderDecisionWeight, category: "band_leadership", description: "Leader vote weight multiplier" },
      // Bonuses
      { key: "band_songwriting_chemistry_bonus", value: songwritingChemistryBonus, category: "band_bonuses", description: "Max % bonus to songwriting from chemistry" },
      { key: "band_performance_chemistry_bonus", value: performanceChemistryBonus, category: "band_bonuses", description: "Max % bonus to performance from chemistry" },
      { key: "band_rehearsal_chemistry_bonus", value: rehearsalChemistryBonus, category: "band_bonuses", description: "Max % bonus to rehearsal effectiveness from chemistry" },
      // Growth (NEW)
      { key: "band_daily_fame_min", value: dailyFameMin, category: "band_growth", description: "Minimum daily passive fame gain for bands" },
      { key: "band_daily_fame_max", value: dailyFameMax, category: "band_growth", description: "Maximum daily passive fame gain for bands" },
      { key: "band_daily_fans_min", value: dailyFansMin, category: "band_growth", description: "Minimum daily passive fans gain for bands" },
      { key: "band_daily_fans_max", value: dailyFansMax, category: "band_growth", description: "Maximum daily passive fans gain for bands" },
      { key: "band_fame_to_fans_rate", value: fameToFansRate, category: "band_growth", description: "Percentage of band fame added as bonus fans daily" },
      { key: "band_player_fame_share", value: playerFameShare, category: "band_growth", description: "Percentage of band fame gain given to player character" },
      { key: "band_player_fans_share", value: playerFansShare, category: "band_growth", description: "Percentage of band fans gain given to player character" },
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
              <h1 className="text-3xl font-bold">Band & Chemistry Administration</h1>
              <p className="text-muted-foreground">Manage band mechanics, chemistry systems, and collaboration features</p>
            </div>
          </div>
          <Button onClick={saveAllSettings} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save All Settings
          </Button>
        </div>

        <Tabs defaultValue="chemistry" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="chemistry" className="flex items-center gap-2">
              <Heart className="h-4 w-4" />
              <span className="hidden sm:inline">Chemistry</span>
            </TabsTrigger>
            <TabsTrigger value="limits" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Limits</span>
            </TabsTrigger>
            <TabsTrigger value="leadership" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Leadership</span>
            </TabsTrigger>
            <TabsTrigger value="bonuses" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Bonuses</span>
            </TabsTrigger>
            <TabsTrigger value="growth" className="flex items-center gap-2">
              <Sprout className="h-4 w-4" />
              <span className="hidden sm:inline">Growth</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chemistry">
            <Card>
              <CardHeader>
                <CardTitle>Chemistry System</CardTitle>
                <CardDescription>Configure how chemistry is gained, lost, and impacts band performance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Chemistry Gain per Rehearsal: {chemistryGainPerRehearsal}</Label>
                    <Slider value={[chemistryGainPerRehearsal]} onValueChange={([v]) => setChemistryGainPerRehearsal(v)} min={0} max={20} step={1} />
                    <p className="text-xs text-muted-foreground">Points added after each band rehearsal</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Chemistry Gain per Gig: {chemistryGainPerGig}</Label>
                    <Slider value={[chemistryGainPerGig]} onValueChange={([v]) => setChemistryGainPerGig(v)} min={0} max={30} step={1} />
                    <p className="text-xs text-muted-foreground">Points added after completing a gig</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Chemistry Decay per Week: {chemistryDecayPerWeek}</Label>
                    <Slider value={[chemistryDecayPerWeek]} onValueChange={([v]) => setChemistryDecayPerWeek(v)} min={0} max={10} step={1} />
                    <p className="text-xs text-muted-foreground">Points lost per week without band activity</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Maximum Chemistry Level</Label>
                    <Input type="number" value={maxChemistry} onChange={(e) => setMaxChemistry(Number(e.target.value))} min={50} max={200} />
                    <p className="text-xs text-muted-foreground">The cap for band chemistry</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="limits">
            <Card>
              <CardHeader>
                <CardTitle>Band Limits</CardTitle>
                <CardDescription>Set maximum members, touring member limits, and role requirements</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label>Maximum Band Members</Label>
                    <Input type="number" value={maxBandMembers} onChange={(e) => setMaxBandMembers(Number(e.target.value))} min={2} max={12} />
                    <p className="text-xs text-muted-foreground">Max permanent members in a band</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Maximum Touring Members</Label>
                    <Input type="number" value={maxTouringMembers} onChange={(e) => setMaxTouringMembers(Number(e.target.value))} min={0} max={10} />
                    <p className="text-xs text-muted-foreground">Max session/touring musicians</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Minimum Members for Gig</Label>
                    <Input type="number" value={minMembersForGig} onChange={(e) => setMinMembersForGig(Number(e.target.value))} min={1} max={6} />
                    <p className="text-xs text-muted-foreground">Minimum members to perform live</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leadership">
            <Card>
              <CardHeader>
                <CardTitle>Leadership System</CardTitle>
                <CardDescription>Configure leadership voting and permissions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Voting Frequency (Days)</Label>
                    <Input type="number" value={votingFrequencyDays} onChange={(e) => setVotingFrequencyDays(Number(e.target.value))} min={7} max={90} />
                    <p className="text-xs text-muted-foreground">Days between leadership elections</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Leader Decision Weight: {leaderDecisionWeight}x</Label>
                    <Slider value={[leaderDecisionWeight]} onValueChange={([v]) => setLeaderDecisionWeight(v)} min={1} max={5} step={0.5} />
                    <p className="text-xs text-muted-foreground">Leader's vote counts as this many votes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bonuses">
            <Card>
              <CardHeader>
                <CardTitle>Collaboration Bonuses</CardTitle>
                <CardDescription>Configure chemistry bonuses for band activities</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label>Songwriting Bonus: {songwritingChemistryBonus}%</Label>
                    <Slider value={[songwritingChemistryBonus]} onValueChange={([v]) => setSongwritingChemistryBonus(v)} min={0} max={50} step={5} />
                    <p className="text-xs text-muted-foreground">Max bonus to songwriting quality from 100% chemistry</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Performance Bonus: {performanceChemistryBonus}%</Label>
                    <Slider value={[performanceChemistryBonus]} onValueChange={([v]) => setPerformanceChemistryBonus(v)} min={0} max={50} step={5} />
                    <p className="text-xs text-muted-foreground">Max bonus to gig performance from 100% chemistry</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Rehearsal Bonus: {rehearsalChemistryBonus}%</Label>
                    <Slider value={[rehearsalChemistryBonus]} onValueChange={([v]) => setRehearsalChemistryBonus(v)} min={0} max={50} step={5} />
                    <p className="text-xs text-muted-foreground">Max bonus to rehearsal effectiveness from 100% chemistry</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="growth">
            <Card>
              <CardHeader>
                <CardTitle>Daily Growth Rates</CardTitle>
                <CardDescription>
                  Configure how bands passively gain fame and fans each day, and how much is shared with player characters.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Daily Fame Range: {dailyFameMin} - {dailyFameMax}</Label>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <Slider value={[dailyFameMin]} onValueChange={([v]) => setDailyFameMin(Math.min(v, dailyFameMax))} min={1} max={50} step={1} />
                        <p className="text-xs text-muted-foreground mt-1">Min</p>
                      </div>
                      <div className="flex-1">
                        <Slider value={[dailyFameMax]} onValueChange={([v]) => setDailyFameMax(Math.max(v, dailyFameMin))} min={1} max={50} step={1} />
                        <p className="text-xs text-muted-foreground mt-1">Max</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Random passive fame gained by bands each day</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Daily Fans Range: {dailyFansMin} - {dailyFansMax}</Label>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <Slider value={[dailyFansMin]} onValueChange={([v]) => setDailyFansMin(Math.min(v, dailyFansMax))} min={1} max={100} step={1} />
                        <p className="text-xs text-muted-foreground mt-1">Min</p>
                      </div>
                      <div className="flex-1">
                        <Slider value={[dailyFansMax]} onValueChange={([v]) => setDailyFansMax(Math.max(v, dailyFansMin))} min={1} max={100} step={1} />
                        <p className="text-xs text-muted-foreground mt-1">Max</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Random passive fans gained by bands each day</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t">
                  <div className="space-y-2">
                    <Label>Fame to Fans Rate: {fameToFansRate}%</Label>
                    <Slider value={[fameToFansRate]} onValueChange={([v]) => setFameToFansRate(v)} min={0.1} max={2} step={0.1} />
                    <p className="text-xs text-muted-foreground">% of band's fame added as bonus fans daily</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Player Fame Share: {playerFameShare}%</Label>
                    <Slider value={[playerFameShare]} onValueChange={([v]) => setPlayerFameShare(v)} min={85} max={100} step={1} />
                    <p className="text-xs text-muted-foreground">% of band fame gain given to player character</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Player Fans Share: {playerFansShare}%</Label>
                    <Slider value={[playerFansShare]} onValueChange={([v]) => setPlayerFansShare(v)} min={85} max={100} step={1} />
                    <p className="text-xs text-muted-foreground">% of band fans gain given to player character</p>
                  </div>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg mt-4">
                  <h4 className="font-medium mb-2">How it works</h4>
                  <p className="text-sm text-muted-foreground">
                    Every day, bands passively gain fame ({dailyFameMin}-{dailyFameMax}) and fans ({dailyFansMin}-{dailyFansMax}), 
                    plus an additional {fameToFansRate}% of their current fame as bonus fans. When bands gain fame/fans, 
                    each player character in the band also receives {playerFameShare}% of the fame and {playerFansShare}% of the fans 
                    (a {100 - playerFameShare}-{100 - playerFansShare}% deduction to represent the band taking some credit).
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

export default BandAdmin;