import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp } from "lucide-react";
import { StreamingStatsCard } from "./StreamingStatsCard";

interface AnalyticsTabProps {
  userId: string;
}

export const AnalyticsTab = ({ userId }: AnalyticsTabProps) => {
  const { data: releases } = useQuery({
    queryKey: ["song-releases-analytics", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("song_releases")
        .select(`
          *,
          songs (
            title,
            genre,
            quality_score
          )
        `)
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("total_streams", { ascending: false });

      if (error) throw error;

      // Aggregate by song
      const songMap = new Map();
      data?.forEach((release: any) => {
        const songId = release.song_id;
        if (songMap.has(songId)) {
          const existing = songMap.get(songId);
          existing.totalStreams += release.total_streams || 0;
          existing.totalRevenue += release.total_revenue || 0;
        } else {
          songMap.set(songId, {
            song: release.songs,
            totalStreams: release.total_streams || 0,
            totalRevenue: release.total_revenue || 0,
            songId
          });
        }
      });

      return Array.from(songMap.values());
    },
  });

  const totalStats = releases?.reduce(
    (acc, curr) => ({
      streams: acc.streams + curr.totalStreams,
      revenue: acc.revenue + curr.totalRevenue,
    }),
    { streams: 0, revenue: 0 }
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Analytics Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="p-4 rounded-lg bg-primary/5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <TrendingUp className="h-4 w-4" />
                Total Streams
              </div>
              <div className="text-3xl font-bold text-primary">
                {totalStats?.streams.toLocaleString() || 0}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-green-500/5">
              <div className="text-sm text-muted-foreground mb-1">Total Revenue</div>
              <div className="text-3xl font-bold text-green-500">
                ${totalStats?.revenue.toLocaleString() || 0}
              </div>
            </div>
          </div>

          {!releases || releases.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Release songs to start tracking performance.
            </p>
          ) : (
            <div className="space-y-4">
              <h3 className="font-semibold">Song Performance</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {releases.map((release) => (
                  <StreamingStatsCard
                    key={release.songId}
                    song={release.song}
                    totalStreams={release.totalStreams}
                    totalRevenue={release.totalRevenue}
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
