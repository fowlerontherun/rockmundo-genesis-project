import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Music, TrendingUp, DollarSign } from "lucide-react";
import { useGameData } from "@/hooks/useGameData";
import { useStreaming } from "@/hooks/useStreaming";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

export default function StreamingNew() {
  const navigate = useNavigate();
  const { userId } = useGameData();
  const { releases, platforms, analytics, releaseToStreaming, takeDown } = useStreaming(userId || "");
  
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);
  const [selectedSong, setSelectedSong] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("");

  const { data: recordedSongs } = useQuery({
    queryKey: ["recorded-songs", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recording_sessions")
        .select("*, song:songs(*)")
        .eq("status", "completed")
        .order("completed_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const handleRelease = () => {
    if (!selectedSong || !selectedPlatform || !userId) return;

    releaseToStreaming.mutate({
      songId: selectedSong,
      platformId: selectedPlatform,
      userId,
      bandId: undefined,
    }, {
      onSuccess: () => {
        setReleaseDialogOpen(false);
        setSelectedSong("");
        setSelectedPlatform("");
      },
    });
  };

  const totalStreams = analytics?.reduce((sum, a) => sum + (a.daily_streams || 0), 0) || 0;
  const totalRevenue = analytics?.reduce((sum, a) => sum + (a.daily_revenue || 0), 0) || 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/music-hub")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Music Hub
          </Button>
          <div>
            <h1 className="text-4xl font-bold">Streaming Platforms</h1>
            <p className="text-muted-foreground">Release and track your music across streaming services</p>
          </div>
        </div>
        
        <Button size="lg" onClick={() => setReleaseDialogOpen(true)}>
          <Music className="h-4 w-4 mr-2" />
          Release Song
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <p className="text-sm text-muted-foreground">Total Streams</p>
            </div>
            <p className="text-3xl font-bold">{totalStreams.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-green-500" />
              <p className="text-sm text-muted-foreground">Total Revenue</p>
            </div>
            <p className="text-3xl font-bold text-green-500">${totalRevenue.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Music className="h-4 w-4" />
              <p className="text-sm text-muted-foreground">Active Releases</p>
            </div>
            <p className="text-3xl font-bold">{releases?.filter(r => r.is_active).length || 0}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="releases" className="w-full">
        <TabsList>
          <TabsTrigger value="releases">My Releases</TabsTrigger>
          <TabsTrigger value="platforms">Platforms</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="releases" className="space-y-4">
          {releases && releases.length > 0 ? (
            <div className="grid gap-4">
              {releases.map((release: any) => (
                <Card key={release.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{release.song?.title}</h3>
                          <Badge variant={release.is_active ? "default" : "secondary"}>
                            {release.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{release.platform?.platform_name}</p>
                        <div className="grid grid-cols-2 gap-4 pt-2">
                          <div>
                            <p className="text-xs text-muted-foreground">Streams</p>
                            <p className="text-lg font-semibold">{release.total_streams?.toLocaleString() || 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Revenue</p>
                            <p className="text-lg font-semibold text-green-500">
                              ${release.total_revenue?.toLocaleString() || 0}
                            </p>
                          </div>
                        </div>
                      </div>
                      {release.is_active && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => takeDown.mutate(release.id)}
                        >
                          Take Down
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <Music className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-semibold mb-2">No Releases Yet</h3>
                <p className="text-muted-foreground mb-4">Release your first song to streaming platforms</p>
                <Button onClick={() => setReleaseDialogOpen(true)}>
                  <Music className="h-4 w-4 mr-2" />
                  Release Song
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="platforms" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {platforms?.map((platform) => (
              <Card key={platform.id}>
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-2">{platform.platform_name}</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Revenue per stream</span>
                      <span className="font-semibold">${platform.base_payout_per_stream}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Quality Multiplier</span>
                      <span className="font-semibold">{platform.quality_multiplier}x</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Detailed analytics coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={releaseDialogOpen} onOpenChange={setReleaseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Release to Streaming</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Song</Label>
              <Select value={selectedSong} onValueChange={setSelectedSong}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a recorded song" />
                </SelectTrigger>
                <SelectContent>
                  {recordedSongs?.map((session) => (
                    <SelectItem key={session.id} value={session.song_id}>
                      {session.song?.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Select Platform</Label>
              <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a platform" />
                </SelectTrigger>
                <SelectContent>
                  {platforms?.map((platform) => (
                    <SelectItem key={platform.id} value={platform.id}>
                      {platform.platform_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleRelease} className="w-full">
              Release Song
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
