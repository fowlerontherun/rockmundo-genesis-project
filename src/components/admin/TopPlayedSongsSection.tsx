import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Play, Loader2, Music, Trophy, Wand2 } from "lucide-react";
import { SongPlayer } from "@/components/audio/SongPlayer";

type TopPlayedSong = {
  song_id: string;
  title: string;
  band_id: string | null;
  band_name: string | null;
  audio_url: string | null;
  unique_plays: number;
  quality_score: number | null;
  genre: string | null;
};

export function TopPlayedSongsSection() {
  const queryClient = useQueryClient();
  const [extendingId, setExtendingId] = useState<string | null>(null);

  const { data: topSongs, isLoading } = useQuery({
    queryKey: ["top-played-songs"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_top_played_songs", { p_limit: 10 });
      if (error) throw error;
      return data as TopPlayedSong[];
    },
  });

  const extendMutation = useMutation({
    mutationFn: async (songId: string) => {
      setExtendingId(songId);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-generate-song-audio`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ 
            songId, 
            extend: true,
            customPrompt: "Extended version with additional verses and instrumental sections"
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Extension failed");
      return result;
    },
    onSuccess: (data) => {
      toast.success(`Extended version created for "${data.songTitle}"`);
      queryClient.invalidateQueries({ queryKey: ["top-played-songs"] });
      setExtendingId(null);
    },
    onError: (error: Error) => {
      toast.error(`Extension failed: ${error.message}`);
      setExtendingId(null);
    },
  });

  const getRankBadge = (index: number) => {
    if (index === 0) return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">🥇 #1</Badge>;
    if (index === 1) return <Badge className="bg-gray-400/20 text-gray-300 border-gray-400/30">🥈 #2</Badge>;
    if (index === 2) return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">🥉 #3</Badge>;
    return <Badge variant="outline">#{index + 1}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Most Played Songs (Anti-Gaming)
        </CardTitle>
        <CardDescription>
          Top 10 songs by unique plays. Band members' plays count as ONE combined play to prevent gaming.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : topSongs && topSongs.length > 0 ? (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead>Song</TableHead>
                  <TableHead>Band/Artist</TableHead>
                  <TableHead className="text-center">Unique Plays</TableHead>
                  <TableHead className="text-center">Quality</TableHead>
                  <TableHead className="w-48">Player</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topSongs.map((song, index) => (
                  <TableRow key={song.song_id}>
                    <TableCell>{getRankBadge(index)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Music className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{song.title}</p>
                          <p className="text-xs text-muted-foreground">{song.genre || "Unknown genre"}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{song.band_name || "Solo Artist"}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="font-mono">
                        {song.unique_plays}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {song.quality_score ? (
                        <Badge variant="outline">{song.quality_score}</Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {song.audio_url ? (
                        <SongPlayer
                          audioUrl={song.audio_url}
                          title={song.title}
                          artist={song.band_name || "Artist"}
                          compact
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">No audio</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => extendMutation.mutate(song.song_id)}
                        disabled={!song.audio_url || extendingId === song.song_id}
                      >
                        {extendingId === song.song_id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Wand2 className="h-4 w-4 mr-1" />
                            Extend
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Play className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p>No songs with plays yet</p>
            <p className="text-sm">Plays will appear here once users start listening</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
