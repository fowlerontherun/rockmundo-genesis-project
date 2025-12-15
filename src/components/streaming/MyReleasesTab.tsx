import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Music, TrendingUp, DollarSign, Clock, CheckCircle, Radio, Factory, Disc3 } from "lucide-react";
import { formatDistanceToNow, differenceInDays, isPast } from "date-fns";

interface MyReleasesTabProps {
  userId: string;
}

export const MyReleasesTab = ({ userId }: MyReleasesTabProps) => {
  // First fetch the user's band IDs
  const { data: userBandIds } = useQuery({
    queryKey: ["user-band-ids", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("user_id", userId);
      return data?.map(b => b.band_id) || [];
    }
  });

  const { data: releases, isLoading } = useQuery({
    queryKey: ["releases", userId, userBandIds],
    queryFn: async () => {
      // Fetch releases for user or their bands
      let query = supabase
        .from("releases")
        .select(`
          *,
          release_songs (
            song_id,
            track_number,
            recording_version,
            songs (title, genre, quality_score)
          ),
          release_formats (format_type, quantity, manufacturing_cost, color_variant)
        `)
        .order("created_at", { ascending: false });

      // Build OR condition for user releases or band releases
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

  const getStatusConfig = (release: any) => {
    const status = release.release_status;
    const manufacturingComplete = release.manufacturing_complete_at 
      ? isPast(new Date(release.manufacturing_complete_at)) 
      : false;
    const hasStreamingPlatforms = release.streaming_platforms?.length > 0;

    if (status === "manufacturing") {
      if (manufacturingComplete) {
        return {
          label: "Ready for Release",
          variant: "default" as const,
          icon: <CheckCircle className="h-3 w-3" />,
          color: "text-green-500"
        };
      }
      const daysLeft = differenceInDays(new Date(release.manufacturing_complete_at), new Date());
      return {
        label: `Manufacturing (${daysLeft}d left)`,
        variant: "secondary" as const,
        icon: <Factory className="h-3 w-3" />,
        color: "text-yellow-500"
      };
    }

    if (status === "released") {
      if (hasStreamingPlatforms) {
        return {
          label: "Streaming",
          variant: "default" as const,
          icon: <Radio className="h-3 w-3" />,
          color: "text-primary"
        };
      }
      return {
        label: "Released",
        variant: "outline" as const,
        icon: <Disc3 className="h-3 w-3" />,
        color: "text-green-500"
      };
    }

    return {
      label: status || "Unknown",
      variant: "secondary" as const,
      icon: <Clock className="h-3 w-3" />,
      color: "text-muted-foreground"
    };
  };

  const getManufacturingProgress = (release: any) => {
    if (!release.manufacturing_complete_at || !release.created_at) return 100;
    
    const start = new Date(release.created_at).getTime();
    const end = new Date(release.manufacturing_complete_at).getTime();
    const now = Date.now();
    
    if (now >= end) return 100;
    
    const total = end - start;
    const elapsed = now - start;
    return Math.min(100, Math.round((elapsed / total) * 100));
  };

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
              Create your first release to start distributing your music
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {releases.map((release: any) => {
        const statusConfig = getStatusConfig(release);
        const manufacturingProgress = getManufacturingProgress(release);
        const isManufacturing = release.release_status === "manufacturing" && manufacturingProgress < 100;

        return (
          <Card key={release.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {release.title}
                    <Badge variant="outline" className="text-xs capitalize">
                      {release.release_type}
                    </Badge>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {release.artist_name}
                  </p>
                </div>
                <Badge variant={statusConfig.variant} className="flex items-center gap-1">
                  {statusConfig.icon}
                  {statusConfig.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Manufacturing Progress */}
              {isManufacturing && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Manufacturing Progress</span>
                    <span className="font-medium">{manufacturingProgress}%</span>
                  </div>
                  <Progress value={manufacturingProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    Ready {formatDistanceToNow(new Date(release.manufacturing_complete_at), { addSuffix: true })}
                  </p>
                </div>
              )}

              {/* Track List */}
              <div className="space-y-1">
                <p className="text-sm font-medium">Tracks ({release.release_songs?.length || 0})</p>
                <div className="flex flex-wrap gap-1">
                  {release.release_songs?.slice(0, 5).map((rs: any, idx: number) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {rs.songs?.title || `Track ${rs.track_number}`}
                      {rs.recording_version && rs.recording_version !== "Standard" && (
                        <span className="ml-1 opacity-70">({rs.recording_version})</span>
                      )}
                    </Badge>
                  ))}
                  {(release.release_songs?.length || 0) > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{release.release_songs.length - 5} more
                    </Badge>
                  )}
                </div>
              </div>

              {/* Formats */}
              {release.release_formats && release.release_formats.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-medium">Formats</p>
                  <div className="flex flex-wrap gap-1">
                    {release.release_formats.map((format: any, idx: number) => (
                      <Badge key={idx} variant="outline" className="text-xs capitalize">
                        {format.format_type}
                        {format.color_variant && format.color_variant !== "black" && (
                          <span className="ml-1">({format.color_variant})</span>
                        )}
                        {format.quantity && <span className="ml-1">x{format.quantity}</span>}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Streaming Platforms */}
              {release.streaming_platforms && release.streaming_platforms.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-medium">Distribution</p>
                  <div className="flex flex-wrap gap-1">
                    {release.streaming_platforms.map((platform: string, idx: number) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        <Radio className="h-3 w-3 mr-1" />
                        {platform}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Stats for released items */}
              {release.release_status === "released" && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 rounded-lg bg-secondary/30">
                    <div className="text-2xl font-bold text-primary">
                      {(release.total_streams || 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      Streams
                    </div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-secondary/30">
                    <div className="text-2xl font-bold text-green-500">
                      ${(release.total_revenue || 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      Revenue
                    </div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-secondary/30">
                    <div className="text-2xl font-bold">
                      {release.units_sold || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Units Sold
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  View Details
                </Button>
                {release.release_status === "manufacturing" && manufacturingProgress >= 100 && (
                  <Button size="sm" className="flex-1">
                    Release Now
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
