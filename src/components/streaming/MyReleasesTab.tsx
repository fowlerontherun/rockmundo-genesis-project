import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Music, TrendingUp, DollarSign } from "lucide-react";

interface MyReleasesTabProps {
  userId: string;
}

export const MyReleasesTab = ({ userId }: MyReleasesTabProps) => {
  const { data: releases, isLoading } = useQuery({
    queryKey: ["song-releases", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("song_releases")
        .select(`
          *,
          songs (
            title,
            genre,
            quality_score
          ),
          streaming_platforms (
            platform_name,
            base_payout_per_stream
          )
        `)
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("release_date", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="text-center py-8">Loading releases...</div>;
  }

  if (!releases || releases.length === 0) {
    return (
      <Card>
        <CardContent className="pt-12 pb-12 text-center space-y-4">
          <Music className="h-16 w-16 mx-auto text-muted-foreground" />
          <div>
            <h3 className="font-semibold text-lg">No Releases Yet</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Release your first song to start earning from streams
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {releases.map((release: any) => (
        <Card key={release.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">
                  {release.songs?.title || "Unknown Song"}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {release.streaming_platforms?.platform_name}
                </p>
              </div>
              <Badge>{release.release_type}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-lg bg-secondary/30">
                <div className="text-2xl font-bold text-primary">
                  {release.total_streams.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Total Streams
                </div>
              </div>
              <div className="text-center p-3 rounded-lg bg-secondary/30">
                <div className="text-2xl font-bold text-green-500">
                  ${release.total_revenue.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  Revenue
                </div>
              </div>
              <div className="text-center p-3 rounded-lg bg-secondary/30">
                <div className="text-2xl font-bold">
                  {release.songs?.quality_score || 0}
                </div>
                <div className="text-xs text-muted-foreground">Quality</div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1">
                View Analytics
              </Button>
              <Button variant="outline" size="sm" className="flex-1">
                Take Down
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
