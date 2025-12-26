import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Users, Globe, TrendingUp, Music, ListMusic, BarChart3, MapPin } from "lucide-react";
import { PlatformLogo } from "@/components/streaming/PlatformLogo";
import { StreamingChartList } from "@/components/streaming/StreamingChartList";
import { PlatformPlaylistGrid } from "@/components/streaming/PlatformPlaylistGrid";
import { useGameData } from "@/hooks/useGameData";
import { useStreaming } from "@/hooks/useStreaming";

const StreamingPlatformDetail = () => {
  const { platformId } = useParams<{ platformId: string }>();
  const navigate = useNavigate();
  const { profile } = useGameData();
  const userId = profile?.user_id;
  const { releases } = useStreaming(userId || "");

  const { data: platform, isLoading } = useQuery<any>({
    queryKey: ["streaming-platform", platformId],
    queryFn: async (): Promise<any> => {
      const { data, error } = await supabase
        .from("streaming_platforms")
        .select("*")
        .eq("id", platformId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!platformId,
  });

  // Get user's releases on this platform
  const platformReleases = releases?.filter((r: any) => r.platform_id === platformId) || [];

  // Calculate user stats on this platform
  const totalStreams = platformReleases.reduce((sum: number, r: any) => sum + (r.total_streams || 0), 0);
  const totalRevenue = platformReleases.reduce((sum: number, r: any) => sum + (r.total_revenue || 0), 0);

  const formatNumber = (num: number) => {
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!platform) {
    return (
      <div className="container mx-auto py-8">
        <Button variant="ghost" onClick={() => navigate("/streaming-platforms")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Streaming
        </Button>
        <p className="text-muted-foreground mt-4">Platform not found.</p>
      </div>
    );
  }

  const brandColor = platform.brand_color || "#6366f1";

  return (
    <div className="container mx-auto py-8 space-y-6">
      <Button variant="ghost" onClick={() => navigate("/streaming-platforms")}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Streaming
      </Button>

      {/* Platform Header */}
      <Card className="overflow-hidden">
        <div 
          className="h-32 flex items-center px-6"
          style={{ 
            background: `linear-gradient(135deg, ${brandColor}40 0%, ${brandColor}10 100%)`,
            borderBottom: `3px solid ${brandColor}`
          }}
        >
          <div className="flex items-center gap-6">
            <PlatformLogo platformName={platform.platform_name} size="xl" />
            <div>
              <h1 className="text-3xl font-bold">{platform.platform_name}</h1>
              <p className="text-muted-foreground mt-1">{platform.description}</p>
            </div>
          </div>
        </div>

        <CardContent className="p-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumber(platform.total_users || 0)}</p>
                <p className="text-sm text-muted-foreground">Users Worldwide</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumber(totalStreams)}</p>
                <p className="text-sm text-muted-foreground">Your Streams</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Music className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{platformReleases.length}</p>
                <p className="text-sm text-muted-foreground">Your Releases</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <Globe className="h-5 w-5 text-cyan-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{(platform.regions_available || []).length}</p>
                <p className="text-sm text-muted-foreground">Regions</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="charts" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="charts" className="flex items-center gap-1">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Charts</span>
          </TabsTrigger>
          <TabsTrigger value="playlists" className="flex items-center gap-1">
            <ListMusic className="h-4 w-4" />
            <span className="hidden sm:inline">Playlists</span>
          </TabsTrigger>
          <TabsTrigger value="my-releases" className="flex items-center gap-1">
            <Music className="h-4 w-4" />
            <span className="hidden sm:inline">My Releases</span>
          </TabsTrigger>
          <TabsTrigger value="regions" className="flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            <span className="hidden sm:inline">Regions</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="charts">
          <Card>
            <CardHeader>
              <CardTitle>Platform Charts</CardTitle>
              <CardDescription>Top songs on {platform.platform_name}</CardDescription>
            </CardHeader>
            <CardContent>
              <StreamingChartList platformId={platformId!} brandColor={brandColor} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="playlists">
          <Card>
            <CardHeader>
              <CardTitle>Platform Playlists</CardTitle>
              <CardDescription>Browse and submit to curated playlists</CardDescription>
            </CardHeader>
            <CardContent>
              <PlatformPlaylistGrid platformId={platformId!} brandColor={brandColor} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="my-releases">
          <Card>
            <CardHeader>
              <CardTitle>My Releases on {platform.platform_name}</CardTitle>
              <CardDescription>Your songs distributed to this platform</CardDescription>
            </CardHeader>
            <CardContent>
              {platformReleases.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Music className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-lg font-medium">No Releases Yet</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    You haven't released any songs to {platform.platform_name} yet.
                  </p>
                  <Button onClick={() => navigate("/streaming-platforms")} style={{ backgroundColor: brandColor }}>
                    Release a Song
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {platformReleases.map((release: any) => (
                    <Card key={release.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{release.song?.title || "Unknown Song"}</p>
                            <p className="text-sm text-muted-foreground">
                              Released {new Date(release.release_date).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{formatNumber(release.total_streams || 0)} streams</p>
                            <p className="text-sm text-muted-foreground">
                              ${(release.total_revenue || 0).toFixed(2)} earned
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="regions">
          <Card>
            <CardHeader>
              <CardTitle>Available Regions</CardTitle>
              <CardDescription>{platform.platform_name} is available in these regions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {(platform.regions_available || ["GLOBAL"]).map((region: string) => (
                  <Badge 
                    key={region} 
                    variant="outline" 
                    className="px-3 py-1"
                    style={{ borderColor: brandColor, color: brandColor }}
                  >
                    <Globe className="h-3 w-3 mr-1" />
                    {region}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StreamingPlatformDetail;
