import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListMusic, TrendingUp, Users, DollarSign, Send, Music, CheckCircle, Clock, XCircle } from "lucide-react";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useAuth } from "@/hooks/use-auth-context";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface PlaylistsTabProps {
  userId: string;
}

export const PlaylistsTab = ({ userId }: PlaylistsTabProps) => {
  const { user } = useAuth();
  const { playlists, userSubmissions, isLoadingPlaylists, isLoadingSubmissions, submitToPlaylist, isSubmitting } = usePlaylists(user?.id);
  const [selectedRelease, setSelectedRelease] = useState<string>("");

  // Fetch user's active streaming releases (song_releases) - these are what get submitted
  const { data: userReleases = [], isLoading: isLoadingReleases } = useQuery({
    queryKey: ["user-streaming-releases", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("song_releases")
        .select(`
          id,
          song:songs(id, title, genre),
          platform:streaming_platforms(platform_name)
        `)
        .eq("release_type", "streaming")
        .eq("is_active", true);
      
      // Filter to user's songs
      const filtered = (data || []).filter((r: any) => r.song?.id);
      return filtered;
    },
    enabled: !!userId,
  });

  const handleSubmit = (playlistId: string) => {
    if (!selectedRelease) return;
    submitToPlaylist({ playlistId, releaseId: selectedRelease });
  };

  const getAcceptanceRate = (criteria: Record<string, any>): number => {
    // Estimate acceptance rate from criteria
    const minQuality = criteria?.min_quality || 50;
    // Higher quality requirement = lower acceptance rate
    return Math.max(5, Math.min(50, 100 - minQuality));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" => {
    switch (status) {
      case 'accepted':
        return 'default';
      case 'rejected':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  if (isLoadingPlaylists) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  if (playlists.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <Music className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">No Playlists Available</h3>
          <p className="text-muted-foreground mt-2">
            Playlists will appear here once they are created by curators.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListMusic className="h-5 w-5" />
            Playlist Submissions
          </CardTitle>
          <CardDescription>
            Submit your streaming releases to curated playlists for increased exposure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <label className="text-sm font-medium mb-2 block">Select a release to submit:</label>
            <Select value={selectedRelease} onValueChange={setSelectedRelease}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a streaming release..." />
              </SelectTrigger>
              <SelectContent>
                {isLoadingReleases ? (
                  <SelectItem value="loading" disabled>Loading releases...</SelectItem>
                ) : userReleases.length === 0 ? (
                  <SelectItem value="none" disabled>No streaming releases available</SelectItem>
                ) : (
                  userReleases.map((release: any) => (
                    <SelectItem key={release.id} value={release.id}>
                      {release.song?.title} ({release.song?.genre}) - {release.platform?.platform_name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {userReleases.length === 0 && !isLoadingReleases && (
              <p className="text-xs text-muted-foreground mt-2">
                You need to release songs to streaming platforms first before submitting to playlists.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoadingSubmissions ? (
        <Skeleton className="h-32 w-full" />
      ) : userSubmissions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {userSubmissions.map((submission) => (
                <div key={submission.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(submission.submission_status)}
                    <div>
                      <p className="font-medium">{submission.playlist?.playlist_name || "Unknown Playlist"}</p>
                      <p className="text-xs text-muted-foreground">
                        Submitted {new Date(submission.submitted_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Badge variant={getStatusVariant(submission.submission_status)}>
                    {submission.submission_status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Available Playlists ({playlists.length})</h3>
        <p className="text-sm text-muted-foreground">
          Submit your songs to these curated playlists. Higher follower counts mean more exposure!
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {playlists.map((playlist) => {
          const acceptanceRate = getAcceptanceRate(playlist.acceptance_criteria || {});
          const submissionCost = playlist.submission_cost || 0;
          
          return (
            <Card key={playlist.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{playlist.playlist_name}</CardTitle>
                <CardDescription className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{playlist.curator_type}</Badge>
                  {playlist.platform?.platform_name && (
                    <Badge variant="secondary">{playlist.platform.platform_name}</Badge>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>
                      {playlist.follower_count >= 1000000 
                        ? `${(playlist.follower_count / 1000000).toFixed(1)}M`
                        : playlist.follower_count >= 1000 
                        ? `${(playlist.follower_count / 1000).toFixed(0)}K`
                        : playlist.follower_count} followers
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <TrendingUp className="h-4 w-4" />
                    <span>~{acceptanceRate}% acceptance</span>
                  </div>
                </div>
                
                {playlist.boost_multiplier > 1 && (
                  <div className="text-xs text-primary">
                    ⚡ {playlist.boost_multiplier}x stream boost on acceptance
                  </div>
                )}
                
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-1 text-sm font-medium">
                    <DollarSign className="h-4 w-4" />
                    <span>${(submissionCost / 100).toFixed(2)} fee</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleSubmit(playlist.id)}
                    disabled={!selectedRelease || isSubmitting}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {isSubmitting ? "Submitting..." : "Submit"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
