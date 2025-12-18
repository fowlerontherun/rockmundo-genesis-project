import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Video, TrendingUp, Music, BarChart3, Loader2, Users, Flame, Trophy } from "lucide-react";
import { useGameData } from "@/hooks/useGameData";
import { useDikCokVideos } from "@/hooks/useDikCokVideos";
import { useDikCokVideoTypes } from "@/hooks/useDikCokVideoTypes";
import { useDikCokChallenges } from "@/hooks/useDikCokChallenges";
import { DikCokVideoCard } from "@/components/dikcok/DikCokVideoCard";
import { DikCokCreateDialog } from "@/components/dikcok/DikCokCreateDialog";
import { DikCokBandAnalytics } from "@/components/dikcok/DikCokBandAnalytics";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth-context";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";

export default function DikCok() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { profile } = useGameData();
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);

  // Fetch user's bands
  const { data: userBands, isLoading: bandsLoading } = useQuery({
    queryKey: ["user-bands-dikcok", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("band_members")
        .select("band_id, bands!band_members_band_id_fkey(id, name, genre, logo_url)")
        .eq("user_id", user.id)
        .eq("member_status", "active");
      if (error) throw error;
      return data?.filter(m => m.bands) || [];
    },
    enabled: !!user?.id,
  });

  // Set default selected band
  const selectedBand = selectedBandId 
    ? userBands?.find(b => b.band_id === selectedBandId)?.bands as any
    : userBands?.[0]?.bands as any;
  
  const effectiveBandId = selectedBand?.id || null;

  const { videos, trending, isLoading, incrementViews } = useDikCokVideos(effectiveBandId);
  const { videoTypes, isLoading: typesLoading } = useDikCokVideoTypes();
  const { challenges } = useDikCokChallenges();

  if (!profile || bandsLoading) return <div className="container mx-auto p-6 flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  // No bands - show call to action
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-bold flex items-center gap-3"><Video className="h-10 w-10" />DikCok</h1>
          <p className="text-muted-foreground mt-1">Create viral short-form videos and grow your fanbase</p>
        </div>
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
          {selectedBand && <DikCokCreateDialog bandId={selectedBand.id} userId={profile.user_id} bandName={selectedBand.name} />}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Video className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{myBandVideos.length}</p>
              <p className="text-sm text-muted-foreground">Videos Created</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{myBandVideos.reduce((sum, v) => sum + (v.views || 0), 0).toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total Views</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Flame className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-2xl font-bold">{myBandVideos.reduce((sum, v) => sum + (v.hype_gained || 0), 0)}</p>
              <p className="text-sm text-muted-foreground">Hype Generated</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Trophy className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">{myBandVideos.reduce((sum, v) => sum + (v.fan_gain || 0), 0)}</p>
              <p className="text-sm text-muted-foreground">Fans Gained</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="trending" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="trending"><TrendingUp className="h-4 w-4 mr-2" />Trending</TabsTrigger>
          <TabsTrigger value="my-videos"><Video className="h-4 w-4 mr-2" />My Videos</TabsTrigger>
          <TabsTrigger value="challenges"><Music className="h-4 w-4 mr-2" />Challenges</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart3 className="h-4 w-4 mr-2" />Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="trending">
          {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div> : 
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{trending?.map(v => <DikCokVideoCard key={v.id} video={v} onView={incrementViews} />)}</div>}
        </TabsContent>

        <TabsContent value="my-videos">
          {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div> : 
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{myBandVideos.map(v => <DikCokVideoCard key={v.id} video={v} onView={incrementViews} />)}</div>}
        </TabsContent>

        <TabsContent value="challenges">
          <Card><CardHeader><CardTitle>Active Challenges</CardTitle></CardHeader><CardContent>
            {challenges?.map(c => <Card key={c.id} className="mb-4"><CardHeader><CardTitle className="text-lg">{c.name}</CardTitle><CardDescription>{c.theme}</CardDescription></CardHeader></Card>)}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="analytics">
          {selectedBand && <DikCokBandAnalytics band={selectedBand as any} videos={myBandVideos} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
