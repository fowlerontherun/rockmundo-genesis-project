import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Disc, Music, BarChart3, Globe, TrendingUp, DollarSign, Users, Plus, ListMusic } from "lucide-react";
import { PageLayout } from "@/components/ui/PageLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { useGameData } from "@/hooks/useGameData";
import { StreamingMyReleasesTab } from "@/components/streaming/StreamingMyReleasesTab";
import { DetailedAnalyticsTab } from "@/components/streaming/DetailedAnalyticsTab";
import { PlaylistsTab } from "@/components/streaming/PlaylistsTab";
import { ReleaseToStreamDialog } from "@/components/streaming/ReleaseToStreamDialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EnhancedPlatformCard } from "@/components/streaming/EnhancedPlatformCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveProfile } from "@/hooks/useActiveProfile";

const StreamingPlatforms = () => {
  const { profile } = useGameData();
  const { profileId } = useActiveProfile();
  const userId = profile?.user_id;
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);

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

  // Fetch user's band IDs (band_members keyed on profile_id)
  const { data: userBandIds = [] } = useQuery({
    queryKey: ["user-band-ids", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data: members } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("profile_id", profileId);
      return members?.map(m => m.band_id) || [];
    },
    enabled: !!profileId,
  });

  // Aggregate user stats from song_releases (parent table — correct source)
  const { data: userStatsByPlatform = {} } = useQuery<
    Record<string, { totalStreams: number; totalRevenue: number; releaseCount: number }>
  >({
    queryKey: ["user-streaming-stats", userId, userBandIds],
    queryFn: async () => {
      if (!userId) return {};
      let query = supabase
        .from("song_releases")
        .select("platform_id, total_streams, total_revenue")
        .eq("release_type", "streaming")
        .eq("is_active", true);

      if (userBandIds.length > 0) {
        query = query.or(`user_id.eq.${userId},band_id.in.(${userBandIds.join(",")})`);
      } else {
        query = query.eq("user_id", userId);
      }

      const { data: releases } = await query;
      if (!releases?.length) return {};

      const stats: Record<string, { totalStreams: number; totalRevenue: number; releaseCount: number }> = {};
      releases.forEach((r: any) => {
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

  // KPI strip totals
  const kpis = useMemo(() => {
    const values = Object.values(userStatsByPlatform);
    const totalStreams = values.reduce((s, v) => s + v.totalStreams, 0);
    const totalRevenue = values.reduce((s, v) => s + v.totalRevenue, 0);
    const totalReleases = values.reduce((s, v) => s + v.releaseCount, 0);
    const activePlatforms = values.filter(v => v.releaseCount > 0).length;
    return { totalStreams, totalRevenue, totalReleases, activePlatforms };
  }, [userStatsByPlatform]);

  const formatNumber = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  if (!userId) {
    return (
      <div className="container mx-auto py-8">
        <p className="text-muted-foreground">Please log in to access streaming platforms.</p>
      </div>
    );
  }

  return (
    <PageLayout>
      <PageHeader
        title="Streaming Platforms"
        subtitle="Release your music and track performance across platforms"
        icon={Disc}
        backTo="/hub/music"
        backLabel="Back to Music Hub"
        actions={
          <Button onClick={() => setReleaseDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Release to Stream
          </Button>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <TrendingUp className="h-3 w-3" /> Total Streams
            </div>
            <p className="text-xl md:text-2xl font-bold">{formatNumber(kpis.totalStreams)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <DollarSign className="h-3 w-3" /> Revenue
            </div>
            <p className="text-xl md:text-2xl font-bold text-green-500">
              ${formatNumber(kpis.totalRevenue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Music className="h-3 w-3" /> Active Releases
            </div>
            <p className="text-xl md:text-2xl font-bold">{kpis.totalReleases}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Users className="h-3 w-3" /> Platforms
            </div>
            <p className="text-xl md:text-2xl font-bold">{kpis.activePlatforms} / {platforms.length}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="my-music" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="my-music" className="flex items-center gap-1">
            <Music className="h-4 w-4" />
            <span>My Music</span>
          </TabsTrigger>
          <TabsTrigger value="platforms" className="flex items-center gap-1">
            <Globe className="h-4 w-4" />
            <span>Platforms</span>
          </TabsTrigger>
          <TabsTrigger value="playlists" className="flex items-center gap-1">
            <ListMusic className="h-4 w-4" />
            <span>Playlists</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-1">
            <BarChart3 className="h-4 w-4" />
            <span>Analytics</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-music" className="space-y-6">
          <StreamingMyReleasesTab userId={userId} profileId={profileId || ""} />
        </TabsContent>

        <TabsContent value="platforms">
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold">Browse Platforms</h2>
              <p className="text-muted-foreground text-sm">
                Click any platform to view charts, playlists, and your performance
              </p>
            </div>

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
                    userStats={userStatsByPlatform[platform.id]}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="playlists" className="space-y-6">
          <PlaylistsTab userId={userId} profileId={profileId || ""} />
        </TabsContent>

        <TabsContent value="analytics">
          <DetailedAnalyticsTab userId={userId} profileId={profileId || ""} />
        </TabsContent>
      </Tabs>

      <ReleaseToStreamDialog
        open={releaseDialogOpen}
        onOpenChange={setReleaseDialogOpen}
        userId={userId}
      />
    </PageLayout>
  );
};

export default StreamingPlatforms;
