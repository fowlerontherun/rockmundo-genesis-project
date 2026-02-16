import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Music, Radio, Disc, TrendingUp, Search, PlayCircle, Trash2, Archive, ArchiveRestore, Flame, Star, TrendingDown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";
import { BandRepertoireHeader } from "@/components/band/BandRepertoireHeader";
import { SongDetailDialog } from "@/components/songs/SongDetailDialog";
import { useToast } from "@/hooks/use-toast";
import { removeFromRepertoire, backfillSongOwnership } from "@/utils/bandRoyalties";

interface BandRepertoireTabProps {
  bandId: string;
  bandName?: string;
}

interface RepertoireSong {
  id: string;
  title: string;
  genre: string | null;
  quality_score: number;
  status: string;
  created_at: string;
  audio_url: string | null;
  streams: number;
  revenue: number;
  user_id: string;
  archived: boolean | null;
  fame: number;
  popularity: number;
  is_fan_favourite: boolean;
  ownership?: {
    user_id: string;
    ownership_percentage: number;
    role: string;
    is_active_member: boolean;
  }[];
}

export function BandRepertoireTab({ bandId, bandName }: BandRepertoireTabProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("songs");
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [songView, setSongView] = useState<"active" | "archived">("active");

  // Backfill ownership records on mount
  useQuery({
    queryKey: ["backfill-ownership", bandId],
    queryFn: async () => {
      await backfillSongOwnership(bandId);
      return true;
    },
    enabled: !!bandId,
    staleTime: 60000, // Only run once per minute
  });

  // Fetch band songs with ownership data and aggregated streaming stats
  const { data: songs = [], isLoading: loadingSongs, refetch: refetchSongs } = useQuery({
    queryKey: ["band-repertoire-songs", bandId],
    queryFn: async () => {
      if (!bandId) return [];

      const { data: songsData, error } = await supabase
        .from("songs")
        .select(`
          id,
          title,
          genre,
          quality_score,
          status,
          created_at,
          audio_url,
          user_id,
          archived,
          fame,
          popularity,
          is_fan_favourite
        `)
        .eq("band_id", bandId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const songIds = songsData?.map(s => s.id) || [];
      if (songIds.length === 0) return [];

      // Fetch streaming data from song_releases (the real source of streams/revenue)
      const { data: streamingData } = await supabase
        .from("song_releases")
        .select("song_id, total_streams, total_revenue")
        .in("song_id", songIds);

      // Aggregate streams/revenue by song_id
      const streamsBySong = (streamingData || []).reduce((acc, rel) => {
        if (!acc[rel.song_id]) {
          acc[rel.song_id] = { streams: 0, revenue: 0 };
        }
        acc[rel.song_id].streams += rel.total_streams || 0;
        acc[rel.song_id].revenue += rel.total_revenue || 0;
        return acc;
      }, {} as Record<string, { streams: number; revenue: number }>);

      // Fetch ownership data for each song
      const { data: ownershipData } = await supabase
        .from("band_song_ownership")
        .select("*")
        .in("song_id", songIds);

      return (songsData || []).map(song => ({
        ...song,
        fame: (song as any).fame || 0,
        popularity: (song as any).popularity || 0,
        is_fan_favourite: !!(song as any).is_fan_favourite,
        streams: streamsBySong[song.id]?.streams || 0,
        revenue: streamsBySong[song.id]?.revenue || 0,
        ownership: ownershipData?.filter(o => o.song_id === song.id) || []
      }));
    },
    enabled: !!bandId,
  });

  // Fetch streaming analytics from song_releases table (correct source)
  const { data: streamingStats } = useQuery({
    queryKey: ["band-streaming-stats", bandId],
    queryFn: async () => {
      if (!bandId) return { totalStreams: 0, totalRevenue: 0 };

      const { data } = await supabase
        .from("song_releases")
        .select("total_streams, total_revenue")
        .eq("band_id", bandId)
        .eq("is_active", true);

      const totalStreams = data?.reduce((sum, r) => sum + (r.total_streams || 0), 0) || 0;
      const totalRevenue = data?.reduce((sum, r) => sum + (r.total_revenue || 0), 0) || 0;

      return { totalStreams, totalRevenue };
    },
    enabled: !!bandId,
  });

  // Fetch radio plays - first get band songs, then get their radio plays
  const { data: radioPlays = [], isLoading: loadingRadio } = useQuery({
    queryKey: ["band-radio-plays", bandId],
    queryFn: async () => {
      if (!bandId) return [];

      // Get all song IDs for this band
      const { data: bandSongs } = await supabase
        .from("songs")
        .select("id, title")
        .eq("band_id", bandId);

      if (!bandSongs?.length) return [];

      const songIds = bandSongs.map(s => s.id);
      const songTitles = bandSongs.reduce((acc, s) => {
        acc[s.id] = s.title;
        return acc;
      }, {} as Record<string, string>);

      const { data } = await supabase
        .from("radio_plays")
        .select(`
          id,
          played_at,
          listeners,
          hype_gained,
          streams_boost,
          song_id
        `)
        .in("song_id", songIds)
        .order("played_at", { ascending: false })
        .limit(50);

      // Attach song title to each play
      return (data || []).map(play => ({
        ...play,
        song_title: songTitles[play.song_id] || "Unknown Song"
      }));
    },
    enabled: !!bandId,
  });

  // Fetch gig history - use correct column names and disambiguate FK
  const { data: gigs = [], isLoading: loadingGigs } = useQuery({
    queryKey: ["band-gigs", bandId],
    queryFn: async () => {
      if (!bandId) return [];

      const { data } = await supabase
        .from("gigs")
        .select(`
          id,
          venue_id,
          scheduled_date,
          status,
          payment,
          attendance,
          tickets_sold,
          venues!gigs_venue_id_fkey(name, city)
        `)
        .eq("band_id", bandId)
        .order("scheduled_date", { ascending: false })
        .limit(20);

      return data || [];
    },
    enabled: !!bandId,
  });

  // Fetch recordings - query directly by band_id on recording_sessions
  const { data: recordings = [], isLoading: loadingRecordings } = useQuery({
    queryKey: ["band-recordings", bandId],
    queryFn: async () => {
      if (!bandId) return [];

      const { data } = await supabase
        .from("recording_sessions")
        .select(`
          id,
          status,
          scheduled_start,
          completed_at,
          quality_improvement,
          song_id,
          songs(id, title)
        `)
        .eq("band_id", bandId)
        .order("scheduled_start", { ascending: false })
        .limit(20);

      return data || [];
    },
    enabled: !!bandId,
  });

  const handleRemoveFromRepertoire = async (songId: string, songTitle: string) => {
    try {
      await removeFromRepertoire(songId, bandId);
      toast({
        title: "Removed from Repertoire",
        description: `"${songTitle}" has been removed from the band's repertoire`,
      });
      refetchSongs();
      queryClient.invalidateQueries({ queryKey: ["band-repertoire-songs", bandId] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to remove song",
        variant: "destructive",
      });
    }
  };

  const handleToggleArchive = async (songId: string, songTitle: string, currentlyArchived: boolean) => {
    try {
      const { error } = await supabase
        .from("songs")
        .update({ archived: !currentlyArchived })
        .eq("id", songId);
      if (error) throw error;
      toast({
        title: currentlyArchived ? "Song Restored" : "Song Archived",
        description: currentlyArchived
          ? `"${songTitle}" is now active in your repertoire`
          : `"${songTitle}" has been archived`,
      });
      refetchSongs();
      queryClient.invalidateQueries({ queryKey: ["band-repertoire-songs", bandId] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update song",
        variant: "destructive",
      });
    }
  };

  const activeSongs = songs.filter(s => !s.archived);
  const archivedSongs = songs.filter(s => s.archived);
  const displaySongs = songView === "active" ? activeSongs : archivedSongs;

  const filteredSongs = displaySongs.filter(song =>
    song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (song.genre?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getQualityColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    if (score >= 40) return "text-orange-500";
    return "text-red-500";
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "outline" => {
    switch (status) {
      case "released":
        return "default";
      case "recorded":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Header */}
      <BandRepertoireHeader
        totalSongs={songs.length}
        totalStreams={streamingStats?.totalStreams || 0}
        totalRevenue={streamingStats?.totalRevenue || 0}
        totalGigs={gigs.length}
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="songs" className="flex items-center gap-2">
            <Music className="h-4 w-4" />
            Songs
          </TabsTrigger>
          <TabsTrigger value="recordings" className="flex items-center gap-2">
            <Disc className="h-4 w-4" />
            Recordings
          </TabsTrigger>
          <TabsTrigger value="streaming" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Streaming
          </TabsTrigger>
          <TabsTrigger value="radio" className="flex items-center gap-2">
            <Radio className="h-4 w-4" />
            Radio
          </TabsTrigger>
          <TabsTrigger value="gigs" className="flex items-center gap-2">
            <PlayCircle className="h-4 w-4" />
            Gigs
          </TabsTrigger>
        </TabsList>

        {/* Songs Tab */}
        <TabsContent value="songs" className="space-y-4">
          {/* Active / Archived toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant={songView === "active" ? "default" : "outline"}
              size="sm"
              onClick={() => setSongView("active")}
            >
              <Music className="h-4 w-4 mr-1" />
              Active
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">{activeSongs.length}</Badge>
            </Button>
            <Button
              variant={songView === "archived" ? "default" : "outline"}
              size="sm"
              onClick={() => setSongView("archived")}
            >
              <Archive className="h-4 w-4 mr-1" />
              Archived
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">{archivedSongs.length}</Badge>
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search songs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {loadingSongs ? (
            <div className="text-center py-8 text-muted-foreground">Loading songs...</div>
          ) : filteredSongs.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Music className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Songs Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Add songs to your band's repertoire from the songwriting page.
                </p>
                <Button onClick={() => navigate("/songwriting")}>
                  Go to Songwriting
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {filteredSongs.map((song) => (
                <Card key={song.id} className="hover:bg-accent/50 transition-colors">
                  <CardContent className="py-3 px-3 sm:px-4">
                    {/* Top row: icon + title + actions */}
                    <div 
                      className="flex items-start gap-3 cursor-pointer"
                      onClick={() => setSelectedSongId(song.id)}
                    >
                      <div className="p-2 bg-muted rounded-lg shrink-0 mt-0.5">
                        <Music className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-semibold text-sm truncate">{song.title}</h3>
                          {song.is_fan_favourite && (
                            <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400 shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                          {song.genre && <span className="truncate max-w-[120px]">{song.genre}</span>}
                          <span>•</span>
                          <span className="shrink-0">{new Date(song.created_at).toLocaleDateString()}</span>
                        </div>
                        
                        {/* Stats row — visible on all screens */}
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-0.5">
                                  <Flame className={`h-3.5 w-3.5 ${song.fame >= 1000 ? 'text-orange-500' : song.fame >= 500 ? 'text-yellow-500' : 'text-muted-foreground'}`} />
                                  <span className="text-xs font-medium">{song.fame}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent><p>Fame</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-0.5">
                                  {song.popularity >= 200 ? (
                                    <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                                  ) : (
                                    <TrendingDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                                  )}
                                  <span className="text-xs font-medium">{song.popularity}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent><p>Popularity</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <Badge variant={getStatusVariant(song.status)} className="text-[10px] px-1.5 py-0">{song.status}</Badge>

                          <span className={`text-xs font-bold ${getQualityColor(song.quality_score)}`}>
                            Q{song.quality_score}
                          </span>

                          <span className="text-xs text-muted-foreground hidden sm:inline">
                            {(song.streams || 0).toLocaleString()} streams
                          </span>
                        </div>
                      </div>

                      {/* Action buttons — compact */}
                      <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title={song.archived ? "Restore to active" : "Archive song"}
                          onClick={() => handleToggleArchive(song.id, song.title, !!song.archived)}
                        >
                          {song.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleRemoveFromRepertoire(song.id, song.title)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Recordings Tab */}
        <TabsContent value="recordings" className="space-y-4">
          {loadingRecordings ? (
            <div className="text-center py-8 text-muted-foreground">Loading recordings...</div>
          ) : recordings.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Disc className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Recordings Yet</h3>
                <p className="text-muted-foreground">
                  Record your songs at a studio to see them here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {recordings.map((recording: any) => (
                <Card key={recording.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <p className="font-medium">{recording.songs?.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(recording.scheduled_start).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={recording.status === "completed" ? "default" : "secondary"}>
                        {recording.status}
                      </Badge>
                      {recording.quality_score && (
                        <Badge variant="outline">Quality: {recording.quality_score}</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Streaming Tab */}
        <TabsContent value="streaming" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Total Streams</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {(streamingStats?.totalStreams || 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Streaming Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-600">
                  ${(streamingStats?.totalRevenue || 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Song Performance</CardTitle>
              <CardDescription>Streams and revenue by song</CardDescription>
            </CardHeader>
            <CardContent>
              {songs.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No streaming data available</p>
              ) : (
                <div className="space-y-3">
                  {songs.map((song) => (
                    <div 
                      key={song.id} 
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                      onClick={() => setSelectedSongId(song.id)}
                    >
                      <div>
                        <p className="font-medium">{song.title}</p>
                        <p className="text-sm text-muted-foreground">{song.genre}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{(song.streams || 0).toLocaleString()} streams</p>
                        <p className="text-sm text-green-600">${(song.revenue || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Radio Tab */}
        <TabsContent value="radio" className="space-y-4">
          {loadingRadio ? (
            <div className="text-center py-8 text-muted-foreground">Loading radio plays...</div>
          ) : radioPlays.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Radio className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Radio Plays Yet</h3>
                <p className="text-muted-foreground">
                  Submit your songs to radio stations to get airplay.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {radioPlays.map((play: any) => (
                <Card key={play.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <p className="font-medium">{play.song_title}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(play.played_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {(play.listeners || 0).toLocaleString()} listeners
                      </Badge>
                      {play.hype_gained > 0 && (
                        <Badge variant="secondary">+{play.hype_gained} hype</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Gigs Tab */}
        <TabsContent value="gigs" className="space-y-4">
          {loadingGigs ? (
            <div className="text-center py-8 text-muted-foreground">Loading gigs...</div>
          ) : gigs.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <PlayCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Gigs Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Book gigs to build your fanbase and earn money.
                </p>
                <Button onClick={() => navigate("/gigs")}>
                  Book a Gig
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {gigs.map((gig: any) => (
                <Card key={gig.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <p className="font-medium">{gig.venues?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {gig.venues?.city} • {gig.scheduled_date ? new Date(gig.scheduled_date).toLocaleDateString() : "No date"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={gig.status === "completed" ? "default" : "secondary"}>
                        {gig.status}
                      </Badge>
                      {gig.payment > 0 && (
                        <span className="text-green-600 font-medium">
                          ${gig.payment.toLocaleString()}
                        </span>
                      )}
                      {gig.attendance > 0 && (
                        <span className="text-muted-foreground text-sm">
                          {gig.attendance} attended
                        </span>
                      )}
                      {gig.tickets_sold > 0 && (
                        <span className="text-muted-foreground text-sm">
                          {gig.tickets_sold} tickets
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Song Detail Dialog */}
      <SongDetailDialog 
        songId={selectedSongId} 
        onClose={() => setSelectedSongId(null)} 
      />
    </div>
  );
}
