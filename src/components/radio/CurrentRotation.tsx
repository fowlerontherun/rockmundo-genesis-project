import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Music, Radio, Users, TrendingUp } from "lucide-react";
import { SongPlayer } from "@/components/audio/SongPlayer";

interface CurrentRotationProps {
  stationId: string;
}

export function CurrentRotation({ stationId }: CurrentRotationProps) {
  const { data: rotation, isLoading } = useQuery<any[]>({
    queryKey: ["current-rotation", stationId],
    queryFn: async (): Promise<any[]> => {
      // First get shows for this station
      const { data: shows } = await supabase
        .from("radio_shows")
        .select("id")
        .eq("station_id", stationId)
        .eq("is_active", true);

      if (!shows?.length) return [];

      const showIds = shows.map((s) => s.id);

      const { data, error } = await supabase
        .from("radio_playlists")
        .select("id, show_id, song_id, times_played, added_at, is_active")
        .in("show_id", showIds)
        .eq("is_active", true)
        .order("times_played", { ascending: false })
        .limit(10);

      if (error) throw error;
      if (!data?.length) return [];

      // Fetch songs separately
      const songIds = data.map((p) => p.song_id);
      const { data: songs } = await supabase
        .from("songs")
        .select("id, title, genre, quality_score, audio_url, audio_generation_status, band_id")
        .in("id", songIds);

      // Get band names
      const bandIds = songs?.filter((s) => s.band_id).map((s) => s.band_id) || [];
      let bands: any[] = [];
      if (bandIds.length > 0) {
        const { data: bandData } = await supabase
          .from("bands")
          .select("id, name")
          .in("id", bandIds);
        bands = bandData || [];
      }

      // Combine data
      return data.map((playlist) => {
        const song = songs?.find((s) => s.id === playlist.song_id);
        const band = bands?.find((b) => b.id === song?.band_id);
        return {
          ...playlist,
          plays_this_week: playlist.times_played,
          songs: song ? { ...song, bands: band } : null,
        };
      });
    },
    enabled: !!stationId,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!rotation?.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Radio className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-lg font-medium">No Songs in Rotation</p>
          <p className="text-sm text-muted-foreground">
            This station's playlist is empty. Submit your songs to get airplay!
          </p>
        </CardContent>
      </Card>
    );
  }

  const getRotationBadge = (timesPlayed: number) => {
    if (timesPlayed >= 10) {
      return <Badge className="bg-emerald-500">Heavy Rotation</Badge>;
    } else if (timesPlayed >= 5) {
      return <Badge variant="secondary">Medium Rotation</Badge>;
    } else {
      return <Badge variant="outline">Light Rotation</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Current Rotation</h3>
        <Badge variant="outline">{rotation.length} songs</Badge>
      </div>

      <div className="space-y-3">
        {rotation.map((item: any, index: number) => (
          <Card key={item.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium">{item.songs?.title || "Unknown"}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.songs?.bands?.name || "Unknown Artist"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {getRotationBadge(item.plays_this_week || 0)}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <TrendingUp className="h-3 w-3" />
                    {item.plays_this_week || 0} plays this week
                  </div>
                </div>
              </div>

              {/* Audio Player */}
              {(item.songs?.audio_url || item.songs?.audio_generation_status) && (
                <div className="mt-3 pt-3 border-t">
                  <SongPlayer
                    audioUrl={item.songs.audio_url}
                    generationStatus={item.songs.audio_generation_status}
                    compact
                  />
                </div>
              )}

              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Music className="h-3 w-3" />
                  {item.songs?.genre || "Unknown"}
                </div>
                <div className="flex items-center gap-1">
                  Quality: {item.songs?.quality_score || 0}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
