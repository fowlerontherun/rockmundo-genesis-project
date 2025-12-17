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
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, MessageSquare, Shield, TrendingUp, Users, Save, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const TwaaterAdmin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Trending algorithm
  const [likesWeight, setLikesWeight] = useState(30);
  const [repliesWeight, setRepliesWeight] = useState(40);
  const [retwaatsWeight, setRetwaatsWeight] = useState(30);
  const [trendingDecayHours, setTrendingDecayHours] = useState(24);
  const [viralThreshold, setViralThreshold] = useState(100);

  // Engagement mechanics
  const [xpPerTwaat, setXpPerTwaat] = useState(5);
  const [xpPerLike, setXpPerLike] = useState(1);
  const [dailyTwaatLimit, setDailyTwaatLimit] = useState(10);
  const [followerFameMultiplier, setFollowerFameMultiplier] = useState(0.01);
  const [verifiedBonusMultiplier, setVerifiedBonusMultiplier] = useState(2);

  // Platform features
  const [hashtagsEnabled, setHashtagsEnabled] = useState(true);
  const [pollsEnabled, setPollsEnabled] = useState(true);
  const [verifiedBadgesEnabled, setVerifiedBadgesEnabled] = useState(true);
  const [mediaUploadsEnabled, setMediaUploadsEnabled] = useState(true);

  // Limits
  const [maxTwaatLength, setMaxTwaatLength] = useState(280);
  const [maxFollowersGainedDaily, setMaxFollowersGainedDaily] = useState(100);
  const [followerGainBaseChance, setFollowerGainBaseChance] = useState(5);

  const { data: config, isLoading } = useQuery({
    queryKey: ["twaater-balance-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_balance_config")
        .select("*")
        .like("key", "twaater_%");
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
      const getBool = (key: string, defaultVal: boolean) => {
        const item = config.find((c: any) => c.key === key);
        return item ? Number(item.value) === 1 : defaultVal;
      };
      setLikesWeight(getVal("twaater_likes_weight", 30));
      setRepliesWeight(getVal("twaater_replies_weight", 40));
      setRetwaatsWeight(getVal("twaater_retwaats_weight", 30));
      setTrendingDecayHours(getVal("twaater_trending_decay_hours", 24));
      setViralThreshold(getVal("twaater_viral_threshold", 100));
      setXpPerTwaat(getVal("twaater_xp_per_twaat", 5));
      setXpPerLike(getVal("twaater_xp_per_like", 1));
      setDailyTwaatLimit(getVal("twaater_daily_limit", 10));
      setFollowerFameMultiplier(getVal("twaater_follower_fame_mult", 0.01));
      setVerifiedBonusMultiplier(getVal("twaater_verified_bonus", 2));
      setHashtagsEnabled(getBool("twaater_hashtags_enabled", true));
      setPollsEnabled(getBool("twaater_polls_enabled", true));
      setVerifiedBadgesEnabled(getBool("twaater_verified_enabled", true));
      setMediaUploadsEnabled(getBool("twaater_media_enabled", true));
      setMaxTwaatLength(getVal("twaater_max_length", 280));
      setMaxFollowersGainedDaily(getVal("twaater_max_followers_daily", 100));
      setFollowerGainBaseChance(getVal("twaater_follower_gain_chance", 5));
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
      queryClient.invalidateQueries({ queryKey: ["twaater-balance-config"] });
      toast({ title: "Twaater settings saved successfully" });
    },
    onError: () => {
      toast({ title: "Failed to save settings", variant: "destructive" });
    },
  });

  const saveAllSettings = () => {
    saveMutation.mutate([
      { key: "twaater_likes_weight", value: likesWeight, category: "twaater_trending", description: "Weight of likes in trending" },
      { key: "twaater_replies_weight", value: repliesWeight, category: "twaater_trending", description: "Weight of replies in trending" },
      { key: "twaater_retwaats_weight", value: retwaatsWeight, category: "twaater_trending", description: "Weight of retwaats in trending" },
      { key: "twaater_trending_decay_hours", value: trendingDecayHours, category: "twaater_trending", description: "Hours before trending decays" },
      { key: "twaater_viral_threshold", value: viralThreshold, category: "twaater_trending", description: "Engagement needed for viral status" },
      { key: "twaater_xp_per_twaat", value: xpPerTwaat, category: "twaater_engagement", description: "XP earned per twaat" },
      { key: "twaater_xp_per_like", value: xpPerLike, category: "twaater_engagement", description: "XP earned per like received" },
      { key: "twaater_daily_limit", value: dailyTwaatLimit, category: "twaater_engagement", description: "Max twaats per day for XP" },
      { key: "twaater_follower_fame_mult", value: followerFameMultiplier, category: "twaater_engagement", description: "Fame per follower multiplier" },
      { key: "twaater_verified_bonus", value: verifiedBonusMultiplier, category: "twaater_engagement", description: "Verified account bonus multiplier" },
      { key: "twaater_hashtags_enabled", value: hashtagsEnabled ? 1 : 0, category: "twaater_features", description: "Hashtags feature toggle" },
      { key: "twaater_polls_enabled", value: pollsEnabled ? 1 : 0, category: "twaater_features", description: "Polls feature toggle" },
      { key: "twaater_verified_enabled", value: verifiedBadgesEnabled ? 1 : 0, category: "twaater_features", description: "Verified badges toggle" },
      { key: "twaater_media_enabled", value: mediaUploadsEnabled ? 1 : 0, category: "twaater_features", description: "Media uploads toggle" },
      { key: "twaater_max_length", value: maxTwaatLength, category: "twaater_limits", description: "Max twaat character length" },
      { key: "twaater_max_followers_daily", value: maxFollowersGainedDaily, category: "twaater_limits", description: "Max followers gained per day" },
      { key: "twaater_follower_gain_chance", value: followerGainBaseChance, category: "twaater_limits", description: "Base % chance to gain follower" },
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
              <h1 className="text-3xl font-bold">Twaater Administration</h1>
              <p className="text-muted-foreground">Manage social media platform, moderation, and engagement</p>
            </div>
          </div>
          <Button onClick={saveAllSettings} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save All Settings
          </Button>
        </div>

        <Tabs defaultValue="trending" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="trending" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Trending</span>
            </TabsTrigger>
            <TabsTrigger value="engagement" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Engagement</span>
            </TabsTrigger>
            <TabsTrigger value="features" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Features</span>
            </TabsTrigger>
            <TabsTrigger value="limits" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Limits</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="trending">
            <Card>
              <CardHeader>
                <CardTitle>Trending Algorithm</CardTitle>
                <CardDescription>Configure what makes posts go viral</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Likes Weight: {likesWeight}%</Label>
                    <Slider value={[likesWeight]} onValueChange={([v]) => setLikesWeight(v)} min={0} max={100} step={5} />
                  </div>
                  <div className="space-y-2">
                    <Label>Replies Weight: {repliesWeight}%</Label>
                    <Slider value={[repliesWeight]} onValueChange={([v]) => setRepliesWeight(v)} min={0} max={100} step={5} />
                  </div>
                  <div className="space-y-2">
                    <Label>Retwaats Weight: {retwaatsWeight}%</Label>
                    <Slider value={[retwaatsWeight]} onValueChange={([v]) => setRetwaatsWeight(v)} min={0} max={100} step={5} />
                  </div>
                  <div className="space-y-2">
                    <Label>Trending Decay (hours)</Label>
                    <Input type="number" value={trendingDecayHours} onChange={(e) => setTrendingDecayHours(Number(e.target.value))} min={1} max={168} />
                    <p className="text-xs text-muted-foreground">How long posts stay trending</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Viral Threshold</Label>
                    <Input type="number" value={viralThreshold} onChange={(e) => setViralThreshold(Number(e.target.value))} min={10} />
                    <p className="text-xs text-muted-foreground">Engagement score needed for viral status</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Current total: {likesWeight + repliesWeight + retwaatsWeight}%
                  {likesWeight + repliesWeight + retwaatsWeight !== 100 && (
                    <span className="text-destructive ml-2">(Should be 100%)</span>
                  )}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="engagement">
            <Card>
              <CardHeader>
                <CardTitle>Engagement Mechanics</CardTitle>
                <CardDescription>XP gains, fame conversion, and follower mechanics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>XP per Twaat</Label>
                    <Input type="number" value={xpPerTwaat} onChange={(e) => setXpPerTwaat(Number(e.target.value))} min={0} max={50} />
                    <p className="text-xs text-muted-foreground">XP earned for posting (first {dailyTwaatLimit} per day)</p>
                  </div>
                  <div className="space-y-2">
                    <Label>XP per Like Received</Label>
                    <Input type="number" value={xpPerLike} onChange={(e) => setXpPerLike(Number(e.target.value))} min={0} max={10} />
                  </div>
                  <div className="space-y-2">
                    <Label>Follower → Fame Multiplier: {followerFameMultiplier}</Label>
                    <Slider value={[followerFameMultiplier * 100]} onValueChange={([v]) => setFollowerFameMultiplier(v / 100)} min={0} max={10} step={0.1} />
                    <p className="text-xs text-muted-foreground">Fame gained per follower</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Verified Bonus: {verifiedBonusMultiplier}x</Label>
                    <Slider value={[verifiedBonusMultiplier]} onValueChange={([v]) => setVerifiedBonusMultiplier(v)} min={1} max={5} step={0.5} />
                    <p className="text-xs text-muted-foreground">Multiplier for verified accounts</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="features">
            <Card>
              <CardHeader>
                <CardTitle>Platform Features</CardTitle>
                <CardDescription>Enable/disable platform capabilities</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label>Hashtags</Label>
                      <p className="text-xs text-muted-foreground">Allow # tagging and trending topics</p>
                    </div>
                    <Switch checked={hashtagsEnabled} onCheckedChange={setHashtagsEnabled} />
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label>Polls</Label>
                      <p className="text-xs text-muted-foreground">Allow users to create polls</p>
                    </div>
                    <Switch checked={pollsEnabled} onCheckedChange={setPollsEnabled} />
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label>Verified Badges</Label>
                      <p className="text-xs text-muted-foreground">Show verification checkmarks</p>
                    </div>
                    <Switch checked={verifiedBadgesEnabled} onCheckedChange={setVerifiedBadgesEnabled} />
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label>Media Uploads</Label>
                      <p className="text-xs text-muted-foreground">Allow image/video uploads</p>
                    </div>
                    <Switch checked={mediaUploadsEnabled} onCheckedChange={setMediaUploadsEnabled} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="limits">
            <Card>
              <CardHeader>
                <CardTitle>Anti-Exploit Limits</CardTitle>
                <CardDescription>Prevent farming and abuse</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label>Max Twaat Length</Label>
                    <Input type="number" value={maxTwaatLength} onChange={(e) => setMaxTwaatLength(Number(e.target.value))} min={100} max={500} />
                    <p className="text-xs text-muted-foreground">Character limit per post</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Daily XP Twaat Limit</Label>
                    <Input type="number" value={dailyTwaatLimit} onChange={(e) => setDailyTwaatLimit(Number(e.target.value))} min={1} max={50} />
                    <p className="text-xs text-muted-foreground">Posts per day that give XP</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Max Followers/Day</Label>
                    <Input type="number" value={maxFollowersGainedDaily} onChange={(e) => setMaxFollowersGainedDaily(Number(e.target.value))} min={10} max={1000} />
                    <p className="text-xs text-muted-foreground">Cap on daily follower gains</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Base Follower Gain Chance: {followerGainBaseChance}%</Label>
                    <Slider value={[followerGainBaseChance]} onValueChange={([v]) => setFollowerGainBaseChance(v)} min={1} max={20} step={1} />
                    <p className="text-xs text-muted-foreground">Chance to gain follower per engagement</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4">
            <Button variant="outline" onClick={() => navigate("/admin/twaater-moderation")}>
              <Shield className="h-4 w-4 mr-2" />
              Content Moderation
            </Button>
          </CardContent>
        </Card>
      </div>
    </AdminRoute>
  );
};

export default TwaaterAdmin;
