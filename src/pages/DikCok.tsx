import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Video, TrendingUp, Music, Trophy, Users, Sparkles } from "lucide-react";
import type { DikCokBand, DikCokVideoType, DikCokTrack, DikCokTrendVideo } from "@/types/dikcok";

export default function DikCok() {
  const [selectedBand] = useState<DikCokBand | null>(null);

  // Mock data - will be replaced with real data fetching
  const videoTypes: DikCokVideoType[] = [
    {
      id: "1",
      name: "Performance Clip",
      category: "Music",
      description: "Short performance videos",
      difficulty: "Easy",
      unlockRequirement: "Available from start",
      durationHint: "15-30 seconds",
      signatureEffects: ["Music overlay", "Stage lighting"]
    }
  ];

  const myBands: DikCokBand[] = [
    {
      id: "1",
      name: "Demo Band",
      genre: "Rock",
      hype: 1500,
      fans: 5000,
      fameTier: "Bronze",
      trendTag: "#RisingStars",
      momentum: "Rising",
      analytics: {
        videosCreated: 12,
        averageEngagement: 8.5,
        duetParticipationRate: 15,
        fanConversionRate: 3.2
      }
    }
  ];

  const trendingVideos: DikCokTrendVideo[] = [
    {
      id: "1",
      title: "Epic Guitar Solo",
      creator: "RockLegends",
      bandId: "1",
      videoTypeId: "1",
      views: 150000,
      hypeGain: 500,
      fanGain: 200,
      trendingTag: "#ViralSound",
      engagementVelocity: "Exploding",
      bestForFeeds: ["ForYou", "Trending"]
    }
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold flex items-center gap-2">
            <Video className="h-8 w-8" />
            DikCok
          </h1>
          <p className="text-muted-foreground">Create viral music content and grow your fanbase</p>
        </div>
        <Button size="lg">
          <Video className="h-4 w-4 mr-2" />
          Create Video
        </Button>
      </div>

      <Tabs defaultValue="create" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="create">Create</TabsTrigger>
          <TabsTrigger value="trending">Trending</TabsTrigger>
          <TabsTrigger value="mybands">My Bands</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Video Types</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {videoTypes.map((type) => (
                  <Card key={type.id}>
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <h3 className="font-semibold">{type.name}</h3>
                          <Badge variant={type.difficulty === "Easy" ? "default" : "secondary"}>
                            {type.difficulty}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{type.description}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Video className="h-3 w-3" />
                          {type.durationHint}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {type.signatureEffects.map((effect, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {effect}
                            </Badge>
                          ))}
                        </div>
                        <Button className="w-full" size="sm">Create Video</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Trending Videos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {trendingVideos.map((video) => (
                  <Card key={video.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <h3 className="font-semibold">{video.title}</h3>
                          <p className="text-sm text-muted-foreground">by {video.creator}</p>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">{video.trendingTag}</Badge>
                            <Badge variant={video.engagementVelocity === "Exploding" ? "default" : "secondary"}>
                              {video.engagementVelocity}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-4 pt-2">
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Views</p>
                              <p className="text-sm font-semibold">{video.views.toLocaleString()}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Hype Gain</p>
                              <p className="text-sm font-semibold text-primary">+{video.hypeGain}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Fan Gain</p>
                              <p className="text-sm font-semibold text-green-500">+{video.fanGain}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mybands" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                My Bands on DikCok
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {myBands.map((band) => (
                  <Card key={band.id}>
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-lg">{band.name}</h3>
                            <p className="text-sm text-muted-foreground">{band.genre}</p>
                          </div>
                          <Badge variant="outline">{band.fameTier}</Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Hype</p>
                            <p className="text-lg font-bold text-primary">{band.hype.toLocaleString()}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Fans</p>
                            <p className="text-lg font-bold">{band.fans.toLocaleString()}</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Momentum</span>
                            <Badge variant={band.momentum === "Surging" ? "default" : "secondary"}>
                              {band.momentum}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <span className="text-muted-foreground">{band.trendTag}</span>
                          </div>
                        </div>

                        <Button className="w-full" size="sm">View Details</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          {selectedBand ? (
            <Card>
              <CardHeader>
                <CardTitle>Analytics for {selectedBand.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Videos Created</p>
                        <p className="text-2xl font-bold">{selectedBand.analytics.videosCreated}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Avg Engagement</p>
                        <p className="text-2xl font-bold">{selectedBand.analytics.averageEngagement}%</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Duet Rate</p>
                        <p className="text-2xl font-bold">{selectedBand.analytics.duetParticipationRate}%</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Fan Conversion</p>
                        <p className="text-2xl font-bold">{selectedBand.analytics.fanConversionRate}%</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Select a band to view analytics</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
