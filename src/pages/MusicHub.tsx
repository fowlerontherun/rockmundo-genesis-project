import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Music, Disc, ShoppingBag, ListMusic, Package, Mic, PenLine, Radio } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useGameData } from "@/hooks/useGameData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const MusicHub = () => {
  const navigate = useNavigate();
  const { profile } = useGameData();
  const userId = profile?.user_id;

  const { data: stats } = useQuery({
    queryKey: ["music-hub-stats", userId],
    queryFn: async () => {
      if (!userId) return null;

      const [songsResult, releasesResult] = await Promise.all([
        supabase
          .from("songs")
          .select("id, quality_score", { count: "exact" })
          .eq("user_id", userId),
        supabase
          .from("song_releases")
          .select("total_streams, total_revenue", { count: "exact" })
          .eq("user_id", userId)
          .eq("is_active", true),
      ]);

      const totalSongs = songsResult.count || 0;
      const avgQuality = songsResult.data && songsResult.data.length > 0
        ? Math.round(
            songsResult.data.reduce((sum, s) => sum + (s.quality_score || 0), 0) /
              songsResult.data.length
          )
        : 0;

      const totalReleases = releasesResult.count || 0;
      const totalStreams = releasesResult.data?.reduce(
        (sum, r) => sum + (r.total_streams || 0),
        0
      ) || 0;
      const totalRevenue = releasesResult.data?.reduce(
        (sum, r) => sum + (r.total_revenue || 0),
        0
      ) || 0;

      return {
        totalSongs,
        avgQuality,
        totalReleases,
        totalStreams,
        totalRevenue,
      };
    },
    enabled: !!userId,
  });

  const sections = [
    {
      title: "Songwriting Studio",
      description: "Write and compose original songs from scratch",
      icon: PenLine,
      path: "/studio/songwriting",
      stats: "Create songs with themes, progressions, and lyrics",
      color: "text-yellow-500",
    },
    {
      title: "Song Catalog",
      description: "Manage and view all your completed songs",
      icon: ListMusic,
      path: "/song-manager",
      stats: stats ? `${stats.totalSongs} songs • ${stats.avgQuality} avg quality` : "Loading...",
      color: "text-blue-500",
    },
    {
      title: "Streaming Platforms",
      description: "Release music to Spotify, Apple Music, and more",
      icon: Disc,
      path: "/streaming-platforms",
      stats: stats
        ? `${stats.totalReleases} releases • ${stats.totalStreams.toLocaleString()} streams`
        : "Loading...",
      color: "text-green-500",
    },
    {
      title: "Song Marketplace",
      description: "Buy, sell, and auction original songs",
      icon: ShoppingBag,
      path: "/song-market",
      stats: "Browse listings and track royalties",
      color: "text-purple-500",
    },
    {
      title: "Release Manager",
      description: "Create Singles, EPs, and Albums for physical and digital release",
      icon: Package,
      path: "/release-manager",
      stats: "Manufacture CDs, Vinyl, Digital, and more",
      color: "text-orange-500",
    },
    {
      title: "Recording Studio",
      description: "Book studio sessions to record your songs",
      icon: Mic,
      path: "/recording-studio",
      stats: "Professional recording and production",
      color: "text-red-500",
    },
    {
      title: "Radio Airplay",
      description: "Submit songs to national and local radio stations",
      icon: Radio,
      path: "/radio",
      stats: "Build hype and reach new listeners",
      color: "text-cyan-500",
    },
  ];

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Music className="h-10 w-10 text-primary" />
        <div>
          <h1 className="text-4xl font-bold">Music Hub</h1>
          <p className="text-muted-foreground">
            Manage your music catalog, releases, and marketplace
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-primary">{stats.totalSongs}</div>
              <div className="text-sm text-muted-foreground">Total Songs</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-primary">{stats.totalReleases}</div>
              <div className="text-sm text-muted-foreground">Active Releases</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-primary">
                {stats.totalStreams.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Total Streams</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-primary">
                ${stats.totalRevenue.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Streaming Revenue</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.path} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Icon className={`h-8 w-8 ${section.color}`} />
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{section.description}</p>
                <div className="text-xs text-muted-foreground bg-muted px-3 py-2 rounded">
                  {section.stats}
                </div>
                <Button onClick={() => navigate(section.path)} className="w-full">
                  Open {section.title}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default MusicHub;
