import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Music, TrendingUp, DollarSign, Trash2, Play, Pause } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SongPlayer } from "@/components/audio/SongPlayer";
import { PlatformIcon, getPlatformColor } from "./PlatformIcon";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface StreamingMyReleasesTabProps {
  userId: string;
}

export const StreamingMyReleasesTab = ({ userId }: StreamingMyReleasesTabProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [takeDownId, setTakeDownId] = useState<string | null>(null);

  // First fetch user's band IDs
  const { data: userBandIds } = useQuery({
    queryKey: ["user-band-ids-streaming", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("user_id", userId);
      return data?.map(b => b.band_id) || [];
    }
  });

  // Fetch streaming releases
  const { data: releases, isLoading } = useQuery({
    queryKey: ["streaming-releases", userId, userBandIds],
    queryFn: async () => {
      let query = supabase
        .from("song_releases")
        .select(`
          *,
          song:songs(
            id,
            title,
            genre,
            quality_score,
            audio_url,
            audio_generation_status,
            user_id,
            band_id
          ),
          platform:streaming_platforms(
            id,
            platform_name,
            base_payout_per_stream
          )
        `)
        .eq("release_type", "streaming")
        .eq("is_active", true)
        .order("release_date", { ascending: false });

      // Filter by user or their bands
      if (userBandIds && userBandIds.length > 0) {
        query = query.or(`user_id.eq.${userId},band_id.in.(${userBandIds.join(',')})`);
      } else {
        query = query.eq("user_id", userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: userBandIds !== undefined
  });

  // Take down mutation
  const takeDownMutation = useMutation({
    mutationFn: async (releaseId: string) => {
      const { error } = await supabase
        .from("song_releases")
        .update({ is_active: false })
        .eq("id", releaseId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Song Taken Down",
        description: "Your song has been removed from streaming.",
      });
      queryClient.invalidateQueries({ queryKey: ["streaming-releases"] });
      setTakeDownId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Take Down Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Group releases by song for cleaner display
  const groupedBySong = releases?.reduce((acc, release) => {
    const songId = release.song_id;
    if (!acc[songId]) {
      acc[songId] = {
        song: release.song,
        platforms: [],
        totalStreams: 0,
        totalRevenue: 0
      };
    }
    acc[songId].platforms.push({
      id: release.id,
      platform: release.platform,
      platformName: release.platform_name || release.platform?.platform_name,
      streams: release.total_streams || 0,
      revenue: release.total_revenue || 0,
      releaseDate: release.release_date
    });
    acc[songId].totalStreams += release.total_streams || 0;
    acc[songId].totalRevenue += release.total_revenue || 0;
    return acc;
  }, {} as Record<string, any>) || {};

  if (isLoading) {
    return <div className="text-center py-8">Loading streaming releases...</div>;
  }

  const songEntries = Object.entries(groupedBySong);

  if (songEntries.length === 0) {
    return (
      <Card>
        <CardContent className="pt-12 pb-12 text-center space-y-4">
          <Music className="h-16 w-16 mx-auto text-muted-foreground" />
          <div>
            <h3 className="font-semibold text-lg">No Streaming Releases</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Release songs to streaming platforms to start earning streams
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-4">
        {songEntries.map(([songId, data]) => (
          <Card key={songId}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{data.song?.title || "Unknown Song"}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {data.song?.genre}
                    {data.song?.quality_score && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        Quality: {data.song.quality_score}
                      </Badge>
                    )}
                  </p>
                </div>
                <Badge variant="secondary">
                  {data.platforms.length} Platform{data.platforms.length !== 1 ? "s" : ""}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* AI Audio Player */}
              {data.song?.audio_url && (
                <SongPlayer
                  audioUrl={data.song.audio_url}
                  title={data.song.title}
                  generationStatus={data.song.audio_generation_status}
                  compact
                />
              )}

              {/* Total Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-primary/5">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                    <TrendingUp className="h-3 w-3" />
                    Total Streams
                  </div>
                  <div className="text-2xl font-bold text-primary">
                    {data.totalStreams.toLocaleString()}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-green-500/5">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                    <DollarSign className="h-3 w-3" />
                    Total Revenue
                  </div>
                  <div className="text-2xl font-bold text-green-500">
                    ${data.totalRevenue.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Platform Breakdown */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Platform Breakdown</p>
                <div className="grid gap-2">
                  {data.platforms.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between p-2 rounded-lg border bg-secondary/20">
                      <div className="flex items-center gap-2">
                        <PlatformIcon platformName={p.platformName || ""} />
                        <span className={`font-medium ${getPlatformColor(p.platformName || "")}`}>
                          {p.platformName || "Unknown Platform"}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm">
                          {(p.streams || 0).toLocaleString()} streams
                        </span>
                        <span className="text-sm text-green-500">
                          ${(p.revenue || 0).toLocaleString()}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setTakeDownId(p.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Take Down Confirmation Dialog */}
      <AlertDialog open={!!takeDownId} onOpenChange={(open) => !open && setTakeDownId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Take Down Song?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove your song from streaming. You can re-release it later, but you will lose any accumulated stream counts and playlists.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => takeDownId && takeDownMutation.mutate(takeDownId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Take Down
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};