import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListMusic, TrendingUp, Users, DollarSign, Send } from "lucide-react";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useAuth } from "@/hooks/use-auth-context";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PlaylistsTabProps {
  userId: string;
}

export const PlaylistsTab = ({ userId }: PlaylistsTabProps) => {
  const { user } = useAuth();
  const { playlists, userSubmissions, isLoadingPlaylists, submitToPlaylist, isSubmitting } = usePlaylists(user?.id);
  const [selectedSong, setSelectedSong] = useState<string>("");

  const { data: userSongs = [] } = useQuery({
    queryKey: ["user-songs", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("songs")
        .select("id, title, genre")
        .eq("user_id", userId)
        .eq("status", "completed");
      return data || [];
    },
  });

  const handleSubmit = (playlistId: string) => {
    if (!selectedSong) return;
    submitToPlaylist({ playlistId, songId: selectedSong });
  };

  if (isLoadingPlaylists) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">Loading playlists...</p>
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
            Submit your songs to curated playlists for increased exposure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <label className="text-sm font-medium mb-2 block">Select a song to submit:</label>
            <Select value={selectedSong} onValueChange={setSelectedSong}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a song..." />
              </SelectTrigger>
              <SelectContent>
                {userSongs.map((song) => (
                  <SelectItem key={song.id} value={song.id}>
                    {song.title} ({song.genre})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {userSubmissions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {userSubmissions.map((submission) => (
                <div key={submission.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{submission.song?.title}</p>
                    <p className="text-sm text-muted-foreground">{submission.playlist?.name}</p>
                  </div>
                  <Badge variant={submission.status === 'accepted' ? 'default' : submission.status === 'rejected' ? 'destructive' : 'secondary'}>
                    {submission.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {playlists.map((playlist) => (
          <Card key={playlist.id}>
            <CardHeader>
              <CardTitle className="text-lg">{playlist.name}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <Badge variant="outline">{playlist.curator}</Badge>
                <Badge variant="outline">{playlist.genre}</Badge>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{(playlist.follower_count / 1000).toFixed(0)}K followers</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                  <span>{playlist.acceptance_rate}% acceptance</span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-1 text-sm font-medium">
                  <DollarSign className="h-4 w-4" />
                  <span>${playlist.submission_fee} fee</span>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleSubmit(playlist.id)}
                  disabled={!selectedSong || isSubmitting}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Submit
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
