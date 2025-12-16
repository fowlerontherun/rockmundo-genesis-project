import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Radio, Users, TrendingUp, Zap, Music, Award } from "lucide-react";

interface MyAirplayStatsProps {
  userId: string;
}

export function MyAirplayStats({ userId }: MyAirplayStatsProps) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["my-airplay-stats", userId],
    queryFn: async () => {
      // Get user's songs
      const { data: userSongs } = await supabase
        .from("songs")
        .select("id")
        .eq("user_id", userId);

      if (!userSongs?.length) {
        return {
          totalPlays: 0,
          totalListeners: 0,
          totalHype: 0,
          totalStreamsBoost: 0,
          weeklyPlays: 0,
          activeStations: 0,
          topSong: null,
        };
      }

      const songIds = userSongs.map((s) => s.id);

      // Get all radio plays for user's songs
      const { data: allPlays } = await supabase
        .from("radio_plays")
        .select("id, listeners, hype_gained, streams_boost, station_id, song_id, played_at")
        .in("song_id", songIds);

      // Get plays from last 7 days
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const weeklyPlays = allPlays?.filter((p) => p.played_at && p.played_at >= weekAgo) || [];

      // Calculate totals
      const totalPlays = allPlays?.length || 0;
      const totalListeners = allPlays?.reduce((sum, p) => sum + (p.listeners || 0), 0) || 0;
      const totalHype = allPlays?.reduce((sum, p) => sum + (p.hype_gained || 0), 0) || 0;
      const totalStreamsBoost = allPlays?.reduce((sum, p) => sum + (p.streams_boost || 0), 0) || 0;

      // Count unique stations
      const activeStations = new Set(allPlays?.map((p) => p.station_id) || []).size;

      // Find top song
      const songPlayCounts: Record<string, number> = {};
      allPlays?.forEach((p) => {
        songPlayCounts[p.song_id] = (songPlayCounts[p.song_id] || 0) + 1;
      });

      let topSongId: string | null = null;
      let maxPlays = 0;
      Object.entries(songPlayCounts).forEach(([songId, plays]) => {
        if (plays > maxPlays) {
          maxPlays = plays;
          topSongId = songId;
        }
      });

      let topSong = null;
      if (topSongId) {
        const { data: songData } = await supabase
          .from("songs")
          .select("title")
          .eq("id", topSongId)
          .single();
        if (songData) {
          topSong = { title: songData.title, plays: maxPlays };
        }
      }

      return {
        totalPlays,
        totalListeners,
        totalHype,
        totalStreamsBoost,
        weeklyPlays: weeklyPlays.length,
        activeStations,
        topSong,
      };
    },
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Airplays</CardTitle>
            <Radio className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalPlays.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              +{stats?.weeklyPlays} this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Listeners</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalListeners.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Across all stations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hype Earned</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalHype.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              From radio plays
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Stations</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeStations}</div>
            <p className="text-xs text-muted-foreground">
              Playing your music
            </p>
          </CardContent>
        </Card>
      </div>

      {stats?.topSong && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Award className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Most Played Song</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Music className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{stats.topSong.title}</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {stats.topSong.plays} plays
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
