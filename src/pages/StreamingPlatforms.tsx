import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Disc, ArrowLeft, Music, Radio, BarChart3, ListMusic, Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameData } from "@/hooks/useGameData";
import { StreamingMyReleasesTab } from "@/components/streaming/StreamingMyReleasesTab";
import { ReleaseSongTab } from "@/components/streaming/ReleaseSongTab";
import { AnalyticsTab } from "@/components/streaming/AnalyticsTab";
import { DetailedAnalyticsTab } from "@/components/streaming/DetailedAnalyticsTab";
import { PlaylistsTab } from "@/components/streaming/PlaylistsTab";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EnhancedPlatformCard } from "@/components/streaming/EnhancedPlatformCard";
import { Skeleton } from "@/components/ui/skeleton";

const StreamingPlatforms = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { profile } = useGameData();
  const userId = profile?.user_id;

  // Fetch platforms
  const { data: platforms = [], isLoading: platformsLoading } = useQuery({
    queryKey: ["streaming-platforms-enhanced"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("streaming_platforms")
        .select("*")
        .order("platform_name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch user's band IDs first
  const { data: userBandIds = [] } = useQuery({
    queryKey: ["user-band-ids", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data: members } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("user_id", userId);
      return members?.map(m => m.band_id) || [];
    },
    enabled: !!userId,
  });

  // Fetch user stats per platform from song_releases (correct source)
  const { data: userStats = {} } = useQuery<Record<string, { totalStreams: number; totalRevenue: number; releaseCount: number }>>({
    queryKey: ["user-streaming-stats", userId, userBandIds],
    queryFn: async (): Promise<Record<string, { totalStreams: number; totalRevenue: number; releaseCount: number }>> => {
      if (!userId) return {};
      
      // Get all streaming releases for user or their bands
      const { data: releases } = await supabase
        .from("song_releases")
        .select("platform_id, total_streams, total_revenue, song:songs(user_id, band_id)")
        .eq("release_type", "streaming")
        .eq("is_active", true);

      if (!releases?.length) return {};

      // Filter to user's releases
      const userReleases = releases.filter((r: any) => {
        const song = r.song;
        if (!song) return false;
        return song.user_id === userId || userBandIds.includes(song.band_id);
      });

      const stats: Record<string, { totalStreams: number; totalRevenue: number; releaseCount: number }> = {};
      
      userReleases.forEach((r: any) => {
        if (!r.platform_id) return;
        if (!stats[r.platform_id]) {
          stats[r.platform_id] = { totalStreams: 0, totalRevenue: 0, releaseCount: 0 };
        }
        stats[r.platform_id].totalStreams += r.total_streams || 0;
        stats[r.platform_id].totalRevenue += r.total_revenue || 0;
        stats[r.platform_id].releaseCount += 1;
      });

      return stats;
    },
    enabled: !!userId,
  });

  if (!userId) {
    return (
      <div className="container mx-auto py-8">
        <p className="text-muted-foreground">Please log in to access streaming platforms.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="space-y-4">
        <Button
          variant="ghost"
          onClick={() => navigate("/music-hub")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Music Hub
        </Button>

        <div className="flex items-center gap-3">
          <Disc className="h-10 w-10 text-primary" />
          <div>
            <h1 className="text-4xl font-bold">Streaming Platforms</h1>
            <p className="text-muted-foreground">
              Release your music and track performance across platforms
            </p>
          </div>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            For full release management including physical formats (CD, Vinyl), use the <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/release-manager')}>Release Manager</Button>
          </AlertDescription>
        </Alert>
      </div>

      <Tabs defaultValue="platforms" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="platforms" className="flex items-center gap-1">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Platforms</span>
          </TabsTrigger>
          <TabsTrigger value="releases" className="flex items-center gap-1">
            <Music className="h-4 w-4" />
            <span className="hidden sm:inline">My Releases</span>
          </TabsTrigger>
          <TabsTrigger value="new-release" className="flex items-center gap-1">
            <Radio className="h-4 w-4" />
            <span className="hidden sm:inline">Release</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-1">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="detailed-analytics" className="flex items-center gap-1">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="playlists" className="flex items-center gap-1">
            <ListMusic className="h-4 w-4" />
            <span className="hidden sm:inline">Playlists</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="platforms">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Browse Platforms</h2>
            <p className="text-muted-foreground">
              Click on any platform to view charts, playlists, and your performance
            </p>
            
            {platformsLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-64 w-full" />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {platforms.map((platform: any) => (
                  <EnhancedPlatformCard
                    key={platform.id}
                    platform={platform}
                    userStats={userStats[platform.id]}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="releases">
          <StreamingMyReleasesTab userId={userId} />
        </TabsContent>

        <TabsContent value="new-release">
          <ReleaseSongTab userId={userId} />
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsTab userId={userId} />
        </TabsContent>

        <TabsContent value="detailed-analytics">
          <DetailedAnalyticsTab userId={userId} />
        </TabsContent>

        <TabsContent value="playlists">
          <PlaylistsTab userId={userId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StreamingPlatforms;
