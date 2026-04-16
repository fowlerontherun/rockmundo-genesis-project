import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Music, TrendingUp, DollarSign, Trash2, Play, Pause, Flame, Star, RotateCcw, ChevronDown, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SongPlayer } from "@/components/audio/SongPlayer";
import { PlatformIcon, getPlatformColor } from "./PlatformIcon";
import { StreamSparkline } from "./StreamSparkline";
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
  userId: string;     // account-level user_id (auth.uid)
  profileId: string;  // active character profile id
}

export const StreamingMyReleasesTab = ({ userId, profileId }: StreamingMyReleasesTabProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [takeDownId, setTakeDownId] = useState<string | null>(null);
  const [expandedSongs, setExpandedSongs] = useState<Set<string>>(new Set());

  const toggleSong = (songId: string) => {
    setExpandedSongs((prev) => {
      const next = new Set(prev);
      if (next.has(songId)) next.delete(songId);
      else next.add(songId);
      return next;
    });
  };

  // First fetch user's band IDs (band_members keyed on profile_id)
  const { data: userBandIds } = useQuery({
    queryKey: ["user-band-ids-streaming", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("profile_id", profileId);
      return data?.map(b => b.band_id) || [];
    },
    enabled: !!profileId,
  });

  // Fetch streaming releases — include solo (user_id) AND band releases
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
            band_id,
            hype,
            fame
          ),
          platform:streaming_platforms(
            id,
            platform_name,
            base_payout_per_stream
          )
        `)
        .eq("release_type", "streaming")
        .order("release_date", { ascending: false });

      // Solo + band releases (don't early-return when no bands)
      if (userBandIds && userBandIds.length > 0) {
        query = query.or(`user_id.eq.${userId},band_id.in.(${userBandIds.join(',')})`);
      } else {
        query = query.eq("user_id", userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!userId && userBandIds !== undefined,
  });

  // Fetch 7 days of stream analytics for all visible releases in one batched query
  const releaseIds = releases?.map((r) => r.id) ?? [];
  const { data: sparklineRows } = useQuery({
    queryKey: ["streaming-sparkline-7d", releaseIds.sort().join(",")],
    queryFn: async () => {
      if (releaseIds.length === 0) return [];
      const since = new Date();
      since.setDate(since.getDate() - 6); // include today + 6 prior days = 7 buckets
      const sinceStr = since.toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("streaming_analytics_daily")
        .select("song_release_id, analytics_date, daily_streams")
        .in("song_release_id", releaseIds)
        .gte("analytics_date", sinceStr)
        .order("analytics_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: releaseIds.length > 0,
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

  // Re-release mutation (no confirmation needed — bringing a song back is non-destructive)
  const reReleaseMutation = useMutation({
    mutationFn: async (releaseId: string) => {
      const { error } = await supabase
        .from("song_releases")
        .update({ is_active: true, release_date: new Date().toISOString() })
        .eq("id", releaseId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Re-released",
        description: "Your song is back live on the platform.",
      });
      queryClient.invalidateQueries({ queryKey: ["streaming-releases"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Re-release Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Build a 7-day series per release_id (fill missing days with 0)
  const buildSeriesForReleases = (relIds: string[]) => {
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().split("T")[0]);
    }
    const totalsByDate = new Map<string, number>(days.map((d) => [d, 0]));
    (sparklineRows || []).forEach((row: any) => {
      if (!relIds.includes(row.song_release_id)) return;
      const key = row.analytics_date;
      if (totalsByDate.has(key)) {
        totalsByDate.set(key, (totalsByDate.get(key) || 0) + (row.daily_streams || 0));
      }
    });
    return days.map((d) => ({
      date: new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      streams: totalsByDate.get(d) || 0,
    }));
  };

  // Group releases by song for cleaner display
  const groupedBySong = releases?.reduce((acc, release) => {
    const songId = release.song_id;
    if (!acc[songId]) {
      acc[songId] = {
        song: release.song,
        platforms: [],
        releaseIds: [],
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
      releaseDate: release.release_date,
      isActive: release.is_active !== false,
    });
    acc[songId].releaseIds.push(release.id);
    if (release.is_active !== false) {
      acc[songId].totalStreams += release.total_streams || 0;
      acc[songId].totalRevenue += release.total_revenue || 0;
    }
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

  const allExpanded = songEntries.length > 0 && songEntries.every(([id]) => expandedSongs.has(id));
  const expandAll = () => setExpandedSongs(new Set(songEntries.map(([id]) => id)));
  const collapseAll = () => setExpandedSongs(new Set());

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-muted-foreground">
          {songEntries.length} song{songEntries.length !== 1 ? "s" : ""} on streaming
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={allExpanded ? collapseAll : expandAll}
        >
          {allExpanded ? (
            <><ChevronsDownUp className="h-4 w-4 mr-1" /> Collapse all</>
          ) : (
            <><ChevronsUpDown className="h-4 w-4 mr-1" /> Expand all</>
          )}
        </Button>
      </div>
      <div className="grid gap-4">
        {songEntries.map(([songId, data]) => {
          const isOpen = expandedSongs.has(songId);
          return (
            <Collapsible key={songId} open={isOpen} onOpenChange={() => toggleSong(songId)}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="pb-2 cursor-pointer hover:bg-accent/30 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`}
                          />
                          {data.song?.title || "Unknown Song"}
                        </CardTitle>
                        <div className="flex flex-wrap items-center gap-2 mt-1 pl-6">
                          <span className="text-sm text-muted-foreground">{data.song?.genre}</span>
                          {data.song?.quality_score && (
                            <Badge variant="outline" className="text-xs">
                              Quality: {data.song.quality_score}
                            </Badge>
                          )}
                          {(data.song?.hype || 0) > 0 && (
                            <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-500 border-orange-500/20">
                              <Flame className="h-3 w-3 mr-1" />
                              {data.song.hype} Hype
                            </Badge>
                          )}
                          {(data.song?.fame || 0) > 0 && (
                            <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-500 border-purple-500/20">
                              <Star className="h-3 w-3 mr-1" />
                              {data.song.fame} Fame
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge variant="secondary">
                          {data.platforms.length} Platform{data.platforms.length !== 1 ? "s" : ""}
                        </Badge>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="flex items-center gap-1 text-primary font-medium">
                            <TrendingUp className="h-3 w-3" />
                            {data.totalStreams.toLocaleString()}
                          </span>
                          <span className="flex items-center gap-1 text-green-500 font-medium">
                            <DollarSign className="h-3 w-3" />
                            {data.totalRevenue.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
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

                    {/* 7-Day Stream Sparkline */}
                    <div className="p-3 rounded-lg border bg-card">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-muted-foreground">Last 7 days</span>
                      </div>
                      <StreamSparkline data={buildSeriesForReleases(data.releaseIds)} />
                    </div>

                    {/* Platform Breakdown */}
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Platform Breakdown</p>
                      <div className="grid gap-2">
                        {data.platforms.map((p: any) => (
                          <div
                            key={p.id}
                            className={`flex items-center justify-between p-2 rounded-lg border ${
                              p.isActive ? "bg-secondary/20" : "bg-muted/30 border-dashed opacity-70"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <PlatformIcon platformName={p.platformName || ""} />
                              <span className={`font-medium ${getPlatformColor(p.platformName || "")}`}>
                                {p.platformName || "Unknown Platform"}
                              </span>
                              {!p.isActive && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                  Taken down
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-sm">
                                {(p.streams || 0).toLocaleString()} streams
                              </span>
                              <span className="text-sm text-green-500">
                                ${(p.revenue || 0).toLocaleString()}
                              </span>
                              {p.isActive ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => setTakeDownId(p.id)}
                                  title="Take down"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8"
                                  disabled={reReleaseMutation.isPending}
                                  onClick={() => reReleaseMutation.mutate(p.id)}
                                >
                                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                                  Re-release
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
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