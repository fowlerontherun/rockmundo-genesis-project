import { useState } from "react";
import { useAuth } from "@/hooks/use-auth-context";
import { usePrimaryBand } from "@/hooks/usePrimaryBand";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Music, Radio, Disc, Users, TrendingUp, Search, ArrowLeft, PlayCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { RepertoireSongCard } from "@/components/band/RepertoireSongCard";
import { BandRepertoireHeader } from "@/components/band/BandRepertoireHeader";

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
  ownership?: {
    user_id: string;
    ownership_percentage: number;
    role: string;
    is_active_member: boolean;
  }[];
}

const BandRepertoire = () => {
  const { user } = useAuth();
  const { data: primaryBand } = usePrimaryBand();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("songs");

  const bandId = primaryBand?.bands?.id;
  const bandName = primaryBand?.bands?.name;

  // Fetch band songs with ownership data
  const { data: songs = [], isLoading: loadingSongs } = useQuery({
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
          streams,
          revenue
        `)
        .eq("band_id", bandId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch ownership data for each song
      const songIds = songsData?.map(s => s.id) || [];
      if (songIds.length > 0) {
        const { data: ownershipData } = await supabase
          .from("band_song_ownership")
          .select("*")
          .in("song_id", songIds);

        return (songsData || []).map(song => ({
          ...song,
          ownership: ownershipData?.filter(o => o.song_id === song.id) || []
        }));
      }

      return songsData || [];
    },
    enabled: !!bandId,
  });

  // Fetch streaming analytics
  const { data: streamingStats, isLoading: loadingStreaming } = useQuery({
    queryKey: ["band-streaming-stats", bandId],
    queryFn: async () => {
      if (!bandId) return { totalStreams: 0, totalRevenue: 0 };

      const { data } = await supabase
        .from("songs")
        .select("streams, revenue")
        .eq("band_id", bandId);

      const totalStreams = data?.reduce((sum, s) => sum + (s.streams || 0), 0) || 0;
      const totalRevenue = data?.reduce((sum, s) => sum + (s.revenue || 0), 0) || 0;

      return { totalStreams, totalRevenue };
    },
    enabled: !!bandId,
  });

  // Fetch radio plays
  const { data: radioPlays = [], isLoading: loadingRadio } = useQuery({
    queryKey: ["band-radio-plays", bandId],
    queryFn: async () => {
      if (!bandId) return [];

      const { data } = await supabase
        .from("radio_plays")
        .select(`
          id,
          played_at,
          listener_count,
          songs!inner(id, title, band_id)
        `)
        .eq("songs.band_id", bandId)
        .order("played_at", { ascending: false })
        .limit(50);

      return data || [];
    },
    enabled: !!bandId,
  });

  // Fetch gig history
  const { data: gigs = [], isLoading: loadingGigs } = useQuery({
    queryKey: ["band-gigs", bandId],
    queryFn: async () => {
      if (!bandId) return [];

      const { data } = await supabase
        .from("gigs")
        .select(`
          id,
          venue_id,
          gig_date,
          status,
          actual_earnings,
          actual_attendance,
          venues(name, city)
        `)
        .eq("band_id", bandId)
        .order("gig_date", { ascending: false })
        .limit(20);

      return data || [];
    },
    enabled: !!bandId,
  });

  // Fetch recordings
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
          quality_score,
          songs!inner(id, title, band_id)
        `)
        .eq("songs.band_id", bandId)
        .order("scheduled_start", { ascending: false })
        .limit(20);

      return data || [];
    },
    enabled: !!bandId,
  });

  const filteredSongs = songs.filter(song =>
    song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (song.genre?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (!bandId) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Band Found</h2>
            <p className="text-muted-foreground mb-4">
              You need to be part of a band to view the repertoire.
            </p>
            <Button onClick={() => navigate("/band")}>
              Go to Band Manager
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/band")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{bandName} Repertoire</h1>
          <p className="text-muted-foreground">All songs, recordings, and performance data</p>
        </div>
      </div>

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
            <div className="grid gap-4">
              {filteredSongs.map((song) => (
                <RepertoireSongCard key={song.id} song={song} bandId={bandId} />
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
                    <div key={song.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
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
                      <p className="font-medium">{play.songs?.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(play.played_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {(play.listener_count || 0).toLocaleString()} listeners
                    </Badge>
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
                        {gig.venues?.city} • {new Date(gig.gig_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={gig.status === "completed" ? "default" : "secondary"}>
                        {gig.status}
                      </Badge>
                      {gig.actual_earnings && (
                        <span className="text-green-600 font-medium">
                          ${gig.actual_earnings.toLocaleString()}
                        </span>
                      )}
                      {gig.actual_attendance && (
                        <span className="text-muted-foreground text-sm">
                          {gig.actual_attendance} attended
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
    </div>
  );
};

export default BandRepertoire;
