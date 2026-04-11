import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Video, TrendingUp, Music, BarChart3, Loader2, Users, Flame, DollarSign, Sparkles, Trophy } from "lucide-react";
import { PageLayout } from "@/components/ui/PageLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { useGameData } from "@/hooks/useGameData";
import { useDikCokVideos } from "@/hooks/useDikCokVideos";
import { useDikCokChallenges } from "@/hooks/useDikCokChallenges";
import { useDikCokForYouFeed } from "@/hooks/useDikCokForYouFeed";
import { DikCokVideoCard } from "@/components/dikcok/DikCokVideoCard";
import { DikCokCreateDialog } from "@/components/dikcok/DikCokCreateDialog";
import { DikCokCreatorDashboard } from "@/components/dikcok/DikCokCreatorDashboard";
import { DikCokChallengeCard } from "@/components/dikcok/DikCokChallengeCard";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function DikCok() {
  const { profileId } = useActiveProfile();
  const { profile } = useGameData();
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);

  const { data: userBands, isLoading: bandsLoading } = useQuery({
    queryKey: ["user-bands-dikcok", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await supabase
        .from("band_members")
        .select("band_id, bands!band_members_band_id_fkey(id, name, genre, logo_url, fame, total_fans, band_balance)")
        .eq("profile_id", profileId)
        .eq("member_status", "active");
      if (error) throw error;
      return data?.filter(m => m.bands) || [];
    },
    enabled: !!profileId,
  });

  const selectedBand = selectedBandId 
    ? userBands?.find(b => b.band_id === selectedBandId)?.bands as any
    : userBands?.[0]?.bands as any;
  
  const effectiveBandId = selectedBand?.id || null;

  const { videos, trending, isLoading, incrementViews } = useDikCokVideos(effectiveBandId);
  const { challenges, pastChallenges, enterChallenge, enteredChallengeIds } = useDikCokChallenges(effectiveBandId);

  const bandGenres = userBands?.map(b => (b.bands as any)?.genre).filter(Boolean) || [];
  const { forYouVideos, isLoading: forYouLoading } = useDikCokForYouFeed(
    bandGenres,
    selectedBand?.fame || 0
  );

  // Tips received total
  const { data: tipsReceived } = useQuery({
    queryKey: ["dikcok-tips-received", effectiveBandId],
    queryFn: async () => {
      if (!effectiveBandId) return 0;
      const { data: myVideos } = await supabase
        .from("dikcok_videos")
        .select("id")
        .eq("band_id", effectiveBandId);
      if (!myVideos?.length) return 0;
      const videoIds = myVideos.map(v => v.id);
      const { data: tips } = await supabase
        .from("dikcok_fan_tips")
        .select("amount")
        .in("video_id", videoIds);
      return tips?.reduce((sum, t) => sum + t.amount, 0) || 0;
    },
    enabled: !!effectiveBandId,
  });

  if (!profile || bandsLoading) return <div className="container mx-auto p-6 flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  if (!userBands?.length) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="text-center py-12">
          <Video className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-3xl font-bold mb-2">Join the DikCok Revolution</h1>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Create viral short-form videos to grow your fanbase. You need to be in a band first!
          </p>
          <div className="flex gap-4 justify-center">
            <Link to="/band">
              <Button>Join or Create a Band</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const myBandVideos = videos?.filter(v => v.band_id === effectiveBandId) || [];
  const totalViews = myBandVideos.reduce((sum, v) => sum + (v.views || 0), 0);
  const totalHype = myBandVideos.reduce((sum, v) => sum + (v.hype_gained || 0), 0);
  const dikCokFollowers = Math.max(0, Number(selectedBand?.total_fans || 0));
  const estimatedRevenue = myBandVideos.reduce((sum, v) => {
    const views = Number(v.views || 0);
    const fame = Number(v.band?.fame || selectedBand?.fame || 0);
    return sum + views * (0.0012 + fame / 500000);
  }, 0);

  return (
    <PageLayout>
      <PageHeader
        title="DikCok"
        subtitle="Create viral short-form videos and grow your fanbase"
        icon={Video}
        backTo="/hub/world-social"
        backLabel="Back to World & Social"
        actions={
          <div className="flex items-center gap-3">
            {userBands.length > 1 && (
              <Select value={effectiveBandId || ""} onValueChange={setSelectedBandId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select band" />
                </SelectTrigger>
                <SelectContent>
                  {userBands.map((m) => (
                    <SelectItem key={m.band_id} value={m.band_id}>
                      {(m.bands as any)?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedBand && <DikCokCreateDialog bandId={selectedBand.id} userId={profile.user_id} bandName={selectedBand.name} bandGenre={selectedBand.genre} />}
          </div>
        }
      />

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{dikCokFollowers.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Followers</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{totalViews.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total Views</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Flame className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-2xl font-bold">{totalHype}</p>
              <p className="text-sm text-muted-foreground">Hype</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">${estimatedRevenue.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">Revenue</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-pink-500" />
            <div>
              <p className="text-2xl font-bold">${tipsReceived || 0}</p>
              <p className="text-sm text-muted-foreground">Tips Received</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="foryou" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="foryou"><Sparkles className="h-4 w-4 mr-1" />For You</TabsTrigger>
          <TabsTrigger value="trending"><TrendingUp className="h-4 w-4 mr-1" />Trending</TabsTrigger>
          <TabsTrigger value="my-videos"><Video className="h-4 w-4 mr-1" />My Videos</TabsTrigger>
          <TabsTrigger value="challenges"><Trophy className="h-4 w-4 mr-1" />Challenges</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart3 className="h-4 w-4 mr-1" />Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="foryou">
          {forYouLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : forYouVideos.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                <h3 className="font-semibold mb-2">Your For You feed is empty</h3>
                <p className="text-sm text-muted-foreground">Create some videos or check back when more content is posted!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {forYouVideos.map((v: any) => (
                <DikCokVideoCard key={v.id} video={v} onView={incrementViews} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="trending">
          {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div> : 
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{trending?.map(v => <DikCokVideoCard key={v.id} video={v} onView={incrementViews} />)}</div>}
        </TabsContent>

        <TabsContent value="my-videos">
          {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div> : 
            myBandVideos.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Video className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                  <h3 className="font-semibold mb-2">No videos yet</h3>
                  <p className="text-sm text-muted-foreground">Create your first DikCok video to get started!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{myBandVideos.map(v => <DikCokVideoCard key={v.id} video={v} onView={incrementViews} />)}</div>
            )}
        </TabsContent>

        <TabsContent value="challenges" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>🔥 Active Challenges</CardTitle>
              <CardDescription>Complete challenges to earn bonus hype, fans, and exclusive rewards.</CardDescription>
            </CardHeader>
            <CardContent>
              {challenges && challenges.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {challenges.map((c: any) => (
                    <DikCokChallengeCard
                      key={c.id}
                      challenge={c}
                      onEnter={(id) => enterChallenge.mutate({ challengeId: id })}
                      hasEntered={enteredChallengeIds.has(c.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Music className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No active challenges right now. Check back soon!</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Past Challenges */}
          {pastChallenges && pastChallenges.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>📜 Past Challenges</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pastChallenges.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                      <div>
                        <p className="font-medium text-sm">{c.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">{c.theme}</Badge>
                          {c.sponsor && <Badge variant="secondary" className="text-xs">{c.sponsor}</Badge>}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs text-muted-foreground">Ended</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analytics">
          {selectedBand && <DikCokCreatorDashboard band={selectedBand} videos={myBandVideos} />}
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
}
