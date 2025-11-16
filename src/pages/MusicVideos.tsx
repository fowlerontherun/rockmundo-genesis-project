import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMusicVideos } from "@/hooks/useMusicVideos";
import { Play, TrendingUp, Eye, Heart, Calendar, Award, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState as useReactState } from "react";

const MusicVideos = () => {
  const [user, setUser] = useReactState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const { videos, myVideos, trendingVideos, isLoading, logPlay } = useMusicVideos(user?.id);
  const [activeTab, setActiveTab] = useState<"all" | "trending" | "my">("all");

  const displayVideos = activeTab === "trending" ? trendingVideos : activeTab === "my" ? myVideos : videos;

  const handlePlay = (videoId: string, duration: number = 120) => {
    logPlay({ videoId, watchDuration: duration });
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Music Videos</h1>
          <p className="text-muted-foreground">Discover and track music video performance</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Videos</CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{videos.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {videos.reduce((sum, v) => sum + v.views_count, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trending Now</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trendingVideos.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Videos</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{myVideos.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Videos List */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="all">All Videos</TabsTrigger>
          <TabsTrigger value="trending">Trending</TabsTrigger>
          <TabsTrigger value="my">My Videos</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                Loading videos...
              </CardContent>
            </Card>
          ) : displayVideos.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                {activeTab === "my" ? "No videos yet. Create your first music video!" : "No videos found"}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {displayVideos.map((video) => (
                <Card key={video.id} className="overflow-hidden">
                  <div className="relative aspect-video bg-muted">
                    {video.thumbnail_url ? (
                      <img
                        src={video.thumbnail_url}
                        alt={video.video_title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Play className="h-12 w-12 text-muted-foreground/50" />
                      </div>
                    )}
                    {video.is_trending && (
                      <Badge className="absolute top-2 right-2" variant="destructive">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        Trending
                      </Badge>
                    )}
                  </div>

                  <CardHeader>
                    <CardTitle className="text-lg line-clamp-2">{video.video_title}</CardTitle>
                    <CardDescription>
                      {(video.song as any)?.title} • {(video.band as any)?.name || "Independent"}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Eye className="h-4 w-4 text-muted-foreground" />
                        <span>{video.views_count.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Heart className="h-4 w-4 text-muted-foreground" />
                        <span>{video.likes_count.toLocaleString()}</span>
                      </div>
                      {video.chart_peak_position && (
                        <Badge variant="outline">
                          #{video.chart_peak_position} Peak
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {video.weeks_on_chart > 0 && (
                        <div className="text-muted-foreground">
                          {video.weeks_on_chart} weeks on chart
                        </div>
                      )}
                      {video.release_date && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {new Date(video.release_date).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => handlePlay(video.id)}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Play
                      </Button>
                      {video.video_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(video.video_url!, "_blank")}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MusicVideos;
