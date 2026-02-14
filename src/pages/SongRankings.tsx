import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useSongRankings, useSongGenres, type RankingType, type RankedSong } from "@/hooks/useSongRankings";
import { CoverSongDialog } from "@/components/songs/CoverSongDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Trophy, BarChart3, Headphones, Star, Music, Search, Copy } from "lucide-react";
import { SongPlayer } from "@/components/audio/SongPlayer";

const SongRankings = () => {
  const { user } = useAuth();
  const [rankingType, setRankingType] = useState<RankingType>("quality");
  const [genreFilter, setGenreFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [coverSong, setCoverSong] = useState<RankedSong | null>(null);
  const [coverDialogOpen, setCoverDialogOpen] = useState(false);

  const { data: songs, isLoading } = useSongRankings(rankingType, genreFilter);
  const { data: genres } = useSongGenres();

  // Get user's band
  const { data: userBand } = useQuery({
    queryKey: ["user-band-for-covers", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("band_members")
        .select("band_id, bands!band_members_band_id_fkey(id, name)")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      return (data?.bands as any as { id: string; name: string }) || null;
    },
    enabled: !!user,
  });

  const filteredSongs = (songs || []).filter(s =>
    !search || s.title.toLowerCase().includes(search.toLowerCase()) ||
    (s.band_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (s.artist_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const getMetricValue = (song: RankedSong) => {
    switch (rankingType) {
      case "quality": return song.quality_score;
      case "sales": return song.total_sales;
      case "streams": return song.streams;
    }
  };

  const getMetricLabel = () => {
    switch (rankingType) {
      case "quality": return "Quality";
      case "sales": return "Units Sold";
      case "streams": return "Streams";
    }
  };

  const getRankBadge = (index: number) => {
    if (index === 0) return <span className="text-2xl">🥇</span>;
    if (index === 1) return <span className="text-2xl">🥈</span>;
    if (index === 2) return <span className="text-2xl">🥉</span>;
    return <span className="text-lg font-bold text-muted-foreground">#{index + 1}</span>;
  };

  const handleCover = (song: RankedSong) => {
    setCoverSong(song);
    setCoverDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trophy className="h-8 w-8 text-primary" />
            Song Rankings
          </h1>
          <p className="text-muted-foreground">Discover top songs and cover them for your band</p>
        </div>
      </div>

      <Tabs value={rankingType} onValueChange={(v) => setRankingType(v as RankingType)}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <TabsList>
            <TabsTrigger value="quality" className="gap-1">
              <Star className="h-4 w-4" /> Quality
            </TabsTrigger>
            <TabsTrigger value="sales" className="gap-1">
              <BarChart3 className="h-4 w-4" /> Sales
            </TabsTrigger>
            <TabsTrigger value="streams" className="gap-1">
              <Headphones className="h-4 w-4" /> Streams
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2 flex-1 w-full sm:w-auto">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search songs or artists..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={genreFilter} onValueChange={setGenreFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Genres" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Genres</SelectItem>
                {(genres || []).map(g => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {["quality", "sales", "streams"].map(tab => (
          <TabsContent key={tab} value={tab}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{getMetricLabel()} Rankings</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading rankings...</div>
                ) : filteredSongs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Music className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    <p>No songs found</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredSongs.map((song, index) => (
                      <div
                        key={song.id}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-card/50 hover:bg-accent/30 transition-colors"
                      >
                        <div className="w-10 text-center flex-shrink-0">
                          {getRankBadge(index)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{song.title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {song.band_name || song.artist_name || "Unknown Artist"}
                          </p>
                        </div>

                        {song.genre && (
                          <Badge variant="outline" className="hidden sm:flex text-xs">
                            {song.genre}
                          </Badge>
                        )}

                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-primary">
                            {getMetricValue(song).toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">{getMetricLabel()}</p>
                        </div>

                        {song.audio_url && (
                          <div className="w-32 hidden md:block flex-shrink-0">
                            <SongPlayer
                              audioUrl={song.audio_url}
                              title={song.title}
                              artist={song.band_name || song.artist_name || "Artist"}
                              compact
                            />
                          </div>
                        )}

                        {userBand && song.band_id !== userBand.id && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 flex-shrink-0"
                            onClick={() => handleCover(song)}
                          >
                            <Copy className="h-3 w-3" />
                            Cover
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {userBand && (
        <CoverSongDialog
          song={coverSong}
          bandId={userBand.id}
          open={coverDialogOpen}
          onOpenChange={setCoverDialogOpen}
        />
      )}
    </div>
  );
};

export default SongRankings;
