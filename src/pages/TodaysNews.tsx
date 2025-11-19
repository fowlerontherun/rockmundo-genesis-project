import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Users, Pause, Music, Video, Calendar, Mic2 } from "lucide-react";
import { format } from "date-fns";
import { LastNightGigs } from "@/components/news/LastNightGigs";
import { BandInvitations } from "@/components/band/BandInvitations";

export default function TodaysNewsPage() {
  const today = new Date().toISOString().split('T')[0];

  // New bands formed today
  const { data: newBands } = useQuery({
    queryKey: ["news-new-bands", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bands")
        .select("id, name, genre, leader_id, created_at")
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Bands going on hiatus today
  const { data: hiatusBands } = useQuery({
    queryKey: ["news-hiatus", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bands")
        .select("id, name, genre, hiatus_reason, hiatus_started_at")
        .eq("status", "on_hiatus")
        .gte("hiatus_started_at", `${today}T00:00:00`)
        .lte("hiatus_started_at", `${today}T23:59:59`)
        .order("hiatus_started_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Songs released today
  const { data: releasedSongs } = useQuery({
    queryKey: ["news-songs", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("releases")
        .select("id, title, release_type, release_date, band_id, bands(name)")
        .eq("release_status", "released")
        .gte("release_date", `${today}T00:00:00`)
        .lte("release_date", `${today}T23:59:59`)
        .order("release_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Music videos released today
  const { data: releasedVideos } = useQuery({
    queryKey: ["news-videos", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("music_videos")
        .select("id, title, created_at, band_id, bands(name)")
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Festivals starting today
  const { data: festivals } = useQuery({
    queryKey: ["news-festivals", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_events")
        .select("id, title, event_type, start_date, end_date")
        .eq("event_type", "festival")
        .gte("start_date", `${today}T00:00:00`)
        .lte("start_date", `${today}T23:59:59`)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Top 10 chart bands with gigs today
  const { data: topGigs } = useQuery({
    queryKey: ["news-top-gigs", today],
    queryFn: async () => {
      // Get top 10 bands from charts
      const { data: topSongs } = await supabase
        .from("chart_entries")
        .select("song_id, rank, songs(band_id, bands(id, name))")
        .lte("rank", 10)
        .order("rank", { ascending: true })
        .limit(10);

      if (!topSongs) return [];

      const topBandIds = Array.from(
        new Set(
          topSongs
            .map((entry: any) => entry.songs?.bands?.id)
            .filter(Boolean)
        )
      );

      // Get their gigs today
      const { data: gigs, error } = await supabase
        .from("gigs")
        .select("id, scheduled_date, bands(name), venues(name, cities(name))")
        .in("band_id", topBandIds)
        .gte("scheduled_date", `${today}T00:00:00`)
        .lte("scheduled_date", `${today}T23:59:59`)
        .order("scheduled_date", { ascending: true });

      if (error) throw error;
      return gigs || [];
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-oswald">Today's News</h1>
        <p className="text-sm text-muted-foreground">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* New Bands */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" />
              New Bands Formed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {newBands && newBands.length > 0 ? (
              newBands.map((band) => (
                <div key={band.id} className="flex items-center justify-between py-1">
                  <div>
                    <p className="font-medium">{band.name}</p>
                    <p className="text-xs text-muted-foreground">{band.genre}</p>
                  </div>
                  <Badge variant="secondary">{format(new Date(band.created_at), 'HH:mm')}</Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground py-2">No new bands today</p>
            )}
          </CardContent>
        </Card>

        {/* Hiatus */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Pause className="h-5 w-5" />
              Bands on Hiatus
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {hiatusBands && hiatusBands.length > 0 ? (
              hiatusBands.map((band) => (
                <div key={band.id} className="py-1">
                  <p className="font-medium">{band.name}</p>
                  <p className="text-xs text-muted-foreground">{band.hiatus_reason || 'Taking a break'}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground py-2">No bands on hiatus today</p>
            )}
          </CardContent>
        </Card>

        {/* Released Songs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Music className="h-5 w-5" />
              Songs Released
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {releasedSongs && releasedSongs.length > 0 ? (
              releasedSongs.map((release: any) => (
                <div key={release.id} className="py-1">
                  <p className="font-medium">{release.title}</p>
                  <p className="text-xs text-muted-foreground">{release.bands?.name}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground py-2">No songs released today</p>
            )}
          </CardContent>
        </Card>

        {/* Music Videos */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Video className="h-5 w-5" />
              Music Videos Released
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {releasedVideos && releasedVideos.length > 0 ? (
              releasedVideos.map((video: any) => (
                <div key={video.id} className="py-1">
                  <p className="font-medium">{video.title}</p>
                  <p className="text-xs text-muted-foreground">{video.bands?.name}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground py-2">No music videos released today</p>
            )}
          </CardContent>
        </Card>

        {/* Festivals */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5" />
              Festivals Starting
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {festivals && festivals.length > 0 ? (
              festivals.map((fest) => (
                <div key={fest.id} className="py-1">
                  <p className="font-medium">{fest.title}</p>
                  <p className="text-xs text-muted-foreground">{fest.event_type}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground py-2">No festivals starting today</p>
            )}
          </CardContent>
        </Card>

        {/* Top Chart Gigs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mic2 className="h-5 w-5" />
              Top 10 Chart Bands Playing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topGigs && topGigs.length > 0 ? (
              topGigs.map((gig: any) => (
                <div key={gig.id} className="flex items-center justify-between py-1">
                  <div>
                    <p className="font-medium">{gig.bands?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {gig.venues?.name} • {gig.venues?.cities?.name}
                    </p>
                  </div>
                  <Badge variant="outline">{format(new Date(gig.scheduled_date), 'HH:mm')}</Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground py-2">No top chart bands playing today</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
