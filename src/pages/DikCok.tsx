import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Video, TrendingUp, Music, BarChart3, Loader2 } from "lucide-react";
import { useGameData } from "@/hooks/useGameData";
import { useDikCokVideos } from "@/hooks/useDikCokVideos";
import { useDikCokVideoTypes } from "@/hooks/useDikCokVideoTypes";
import { useDikCokChallenges } from "@/hooks/useDikCokChallenges";
import { DikCokVideoCard } from "@/components/dikcok/DikCokVideoCard";
import { DikCokCreateDialog } from "@/components/dikcok/DikCokCreateDialog";
import { DikCokBandAnalytics } from "@/components/dikcok/DikCokBandAnalytics";
import { Badge } from "@/components/ui/badge";

export default function DikCok() {
  const { profile } = useGameData();
  const selectedBand = null; // Will be replaced with actual band selection
  const { videos, trending, isLoading, incrementViews } = useDikCokVideos(selectedBand?.id);
  const { videoTypes, isLoading: typesLoading } = useDikCokVideoTypes();
  const { challenges } = useDikCokChallenges();

  if (!profile) return <div className="container mx-auto p-6 flex items-center justify-center min-h-[50vh]"><p className="text-muted-foreground">Loading...</p></div>;

  const myBandVideos = videos?.filter(v => v.band_id === selectedBand?.id) || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-bold flex items-center gap-3"><Video className="h-10 w-10" />DikCok</h1>
          <p className="text-muted-foreground mt-1">Create viral short-form videos and grow your fanbase</p>
        </div>
        {selectedBand && <DikCokCreateDialog bandId={selectedBand.id} userId={profile.user_id} bandName={selectedBand.name} />}
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
          {selectedBand && <DikCokBandAnalytics band={selectedBand} videos={myBandVideos} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
