import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Music, PlayCircle, TrendingUp, Radio, MapPin, 
  ChevronRight, Users, Calendar, BarChart3, Globe
} from "lucide-react";
import { SongPlayer } from "@/components/audio/SongPlayer";

interface SongRotationData {
  song_id: string;
  song_title: string;
  song_genre: string;
  audio_url: string | null;
  audio_generation_status: string | null;
  total_plays: number;
  weekly_plays: number;
  total_listeners: number;
  total_hype: number;
}

interface SongsInRotationProps {
  userId: string;
}

export function SongsInRotation({ userId }: SongsInRotationProps) {
  const [selectedSong, setSelectedSong] = useState<SongRotationData | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Fetch songs in rotation with aggregated play data
  const { data: songsInRotation = [], isLoading } = useQuery({
    queryKey: ["songs-in-rotation", userId],
    queryFn: async () => {
      // Get accepted submissions to find songs in rotation
      const { data: acceptedSubmissions, error: subError } = await supabase
        .from("radio_submissions")
        .select(`
          song_id,
          songs!inner(id, title, genre, audio_url, audio_generation_status)
        `)
        .eq("user_id", userId)
        .eq("status", "accepted");

      if (subError) throw subError;

      // Get unique song IDs
      const songIds = [...new Set(acceptedSubmissions?.map(s => s.song_id) || [])];
      if (songIds.length === 0) return [];

      // Get play counts for each song
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      
      const results: SongRotationData[] = [];
      
      for (const songId of songIds) {
        const submission = acceptedSubmissions?.find(s => s.song_id === songId);
        const song = submission?.songs as any;
        if (!song) continue;

        // Get total plays
        const { count: totalPlays } = await supabase
          .from("radio_plays")
          .select("*", { count: "exact", head: true })
          .eq("song_id", songId);

        // Get weekly plays
        const { count: weeklyPlays } = await supabase
          .from("radio_plays")
          .select("*", { count: "exact", head: true })
          .eq("song_id", songId)
          .gte("played_at", weekAgo);

        // Get aggregated stats
        const { data: stats } = await supabase
          .from("radio_plays")
          .select("listeners, hype_gained")
          .eq("song_id", songId);

        const totalListeners = stats?.reduce((sum, p) => sum + (p.listeners || 0), 0) || 0;
        const totalHype = stats?.reduce((sum, p) => sum + (p.hype_gained || 0), 0) || 0;

        results.push({
          song_id: songId,
          song_title: song.title || "Unknown",
          song_genre: song.genre || "Unknown",
          audio_url: song.audio_url,
          audio_generation_status: song.audio_generation_status,
          total_plays: totalPlays || 0,
          weekly_plays: weeklyPlays || 0,
          total_listeners: totalListeners,
          total_hype: totalHype,
        });
      }

      // Sort by total plays
      return results.sort((a, b) => b.total_plays - a.total_plays);
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const openDetails = (song: SongRotationData) => {
    setSelectedSong(song);
    setDetailsOpen(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Music className="h-5 w-5" />
            Songs in Rotation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Music className="h-5 w-5" />
            Songs in Rotation
          </CardTitle>
          <CardDescription className="text-sm">
            Your songs currently being played on radio stations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {songsInRotation.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground">
              <Radio className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>No songs in rotation yet</p>
              <p className="text-sm">Get your songs accepted by radio stations to appear here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {songsInRotation.map((song) => (
                <div
                  key={song.song_id}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer group"
                  onClick={() => openDetails(song)}
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <PlayCircle className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{song.song_title}</span>
                      <Badge variant="outline" className="text-xs shrink-0">{song.song_genre}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <Radio className="h-3 w-3" />
                        {song.total_plays} plays
                      </span>
                      <span className="flex items-center gap-1 text-emerald-500">
                        <TrendingUp className="h-3 w-3" />
                        +{song.weekly_plays} this week
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Song Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Music className="h-5 w-5" />
              {selectedSong?.song_title}
            </DialogTitle>
            <DialogDescription>
              Detailed airplay breakdown by station, country, and city
            </DialogDescription>
          </DialogHeader>
          
          {selectedSong && (
            <SongAirplayDetails 
              songId={selectedSong.song_id} 
              songTitle={selectedSong.song_title}
              audioUrl={selectedSong.audio_url}
              audioStatus={selectedSong.audio_generation_status}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

interface SongAirplayDetailsProps {
  songId: string;
  songTitle: string;
  audioUrl: string | null;
  audioStatus: string | null;
}

function SongAirplayDetails({ songId, songTitle, audioUrl, audioStatus }: SongAirplayDetailsProps) {
  // Fetch detailed breakdown
  const { data, isLoading } = useQuery({
    queryKey: ["song-airplay-details", songId],
    queryFn: async () => {
      // Get all plays with station info
      const { data: plays, error } = await supabase
        .from("radio_plays")
        .select(`
          id,
          played_at,
          listeners,
          hype_gained,
          streams_boost,
          radio_stations!inner(
            id, name, country, station_type, 
            city:cities(name, country)
          )
        `)
        .eq("song_id", songId)
        .order("played_at", { ascending: false });

      if (error) throw error;

      // Aggregate by station
      const stationMap = new Map<string, {
        name: string;
        country: string;
        city: string | null;
        station_type: string;
        plays: number;
        listeners: number;
        hype: number;
      }>();

      // Aggregate by country
      const countryMap = new Map<string, { plays: number; listeners: number; hype: number }>();

      // Aggregate by city
      const cityMap = new Map<string, { country: string; plays: number; listeners: number; hype: number }>();

      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      let weeklyPlays = 0;

      for (const play of plays || []) {
        const station = play.radio_stations as any;
        const stationId = station.id;
        const country = station.country || "Unknown";
        const cityName = station.city?.name || null;

        // Weekly count
        if (new Date(play.played_at!) > weekAgo) weeklyPlays++;

        // Station aggregation
        if (!stationMap.has(stationId)) {
          stationMap.set(stationId, {
            name: station.name,
            country,
            city: cityName,
            station_type: station.station_type,
            plays: 0,
            listeners: 0,
            hype: 0,
          });
        }
        const stationData = stationMap.get(stationId)!;
        stationData.plays++;
        stationData.listeners += play.listeners || 0;
        stationData.hype += play.hype_gained || 0;

        // Country aggregation
        if (!countryMap.has(country)) {
          countryMap.set(country, { plays: 0, listeners: 0, hype: 0 });
        }
        const countryData = countryMap.get(country)!;
        countryData.plays++;
        countryData.listeners += play.listeners || 0;
        countryData.hype += play.hype_gained || 0;

        // City aggregation
        if (cityName) {
          const cityKey = `${cityName}, ${country}`;
          if (!cityMap.has(cityKey)) {
            cityMap.set(cityKey, { country, plays: 0, listeners: 0, hype: 0 });
          }
          const cityData = cityMap.get(cityKey)!;
          cityData.plays++;
          cityData.listeners += play.listeners || 0;
          cityData.hype += play.hype_gained || 0;
        }
      }

      return {
        totalPlays: plays?.length || 0,
        weeklyPlays,
        stations: Array.from(stationMap.entries())
          .map(([id, data]) => ({ id, ...data }))
          .sort((a, b) => b.plays - a.plays),
        countries: Array.from(countryMap.entries())
          .map(([name, data]) => ({ name, ...data }))
          .sort((a, b) => b.plays - a.plays),
        cities: Array.from(cityMap.entries())
          .map(([name, data]) => ({ name, ...data }))
          .sort((a, b) => b.plays - a.plays),
      };
    },
    enabled: !!songId,
  });

  if (isLoading) {
    return (
      <div className="space-y-3 py-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Audio Player */}
      {(audioUrl || audioStatus) && (
        <div className="mb-4">
          <SongPlayer audioUrl={audioUrl} generationStatus={audioStatus} compact />
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{data?.totalPlays || 0}</p>
            <p className="text-xs text-muted-foreground">Total Plays</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-emerald-500">+{data?.weeklyPlays || 0}</p>
            <p className="text-xs text-muted-foreground">This Week</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{data?.stations.length || 0}</p>
            <p className="text-xs text-muted-foreground">Stations</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{data?.countries.length || 0}</p>
            <p className="text-xs text-muted-foreground">Countries</p>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown Tabs */}
      <Tabs defaultValue="stations" className="flex-1 overflow-hidden flex flex-col">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="stations" className="text-xs sm:text-sm">
            <Radio className="h-3.5 w-3.5 mr-1" />
            Stations
          </TabsTrigger>
          <TabsTrigger value="countries" className="text-xs sm:text-sm">
            <Globe className="h-3.5 w-3.5 mr-1" />
            Countries
          </TabsTrigger>
          <TabsTrigger value="cities" className="text-xs sm:text-sm">
            <MapPin className="h-3.5 w-3.5 mr-1" />
            Cities
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stations" className="flex-1 overflow-hidden mt-2">
          <ScrollArea className="h-[250px]">
            <div className="space-y-2 pr-2">
              {data?.stations.map((station) => (
                <div key={station.id} className="flex items-center justify-between p-2.5 rounded-lg border">
                  <div className="flex items-center gap-2 min-w-0">
                    <Radio className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{station.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {station.city ? `${station.city}, ` : ""}{station.country}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-sm">
                    <Badge variant="secondary">{station.plays} plays</Badge>
                    <span className="text-muted-foreground text-xs hidden sm:inline">
                      {station.listeners.toLocaleString()} listeners
                    </span>
                  </div>
                </div>
              ))}
              {(!data?.stations || data.stations.length === 0) && (
                <p className="text-center py-6 text-muted-foreground">No station data yet</p>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="countries" className="flex-1 overflow-hidden mt-2">
          <ScrollArea className="h-[250px]">
            <div className="space-y-2 pr-2">
              {data?.countries.map((country) => (
                <div key={country.name} className="flex items-center justify-between p-2.5 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">{country.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Badge variant="secondary">{country.plays} plays</Badge>
                    <span className="text-muted-foreground text-xs hidden sm:inline">
                      {country.listeners.toLocaleString()} listeners
                    </span>
                  </div>
                </div>
              ))}
              {(!data?.countries || data.countries.length === 0) && (
                <p className="text-center py-6 text-muted-foreground">No country data yet</p>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="cities" className="flex-1 overflow-hidden mt-2">
          <ScrollArea className="h-[250px]">
            <div className="space-y-2 pr-2">
              {data?.cities.map((city) => (
                <div key={city.name} className="flex items-center justify-between p-2.5 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">{city.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Badge variant="secondary">{city.plays} plays</Badge>
                    <span className="text-muted-foreground text-xs hidden sm:inline">
                      {city.listeners.toLocaleString()} listeners
                    </span>
                  </div>
                </div>
              ))}
              {(!data?.cities || data.cities.length === 0) && (
                <p className="text-center py-6 text-muted-foreground">No city data yet</p>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
