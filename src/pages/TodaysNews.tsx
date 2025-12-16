import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Pause, Music, Video, Calendar, Mic2 } from "lucide-react";
import { format } from "date-fns";
import { LastNightGigs } from "@/components/news/LastNightGigs";
import { BandInvitations } from "@/components/band/BandInvitations";
import { TrendingHashtags } from "@/components/news/TrendingHashtags";
import { ChartMoversSection } from "@/components/news/ChartMoversSection";
import { MilestoneNews } from "@/components/news/MilestoneNews";
import { DealAnnouncements } from "@/components/news/DealAnnouncements";
import { PersonalUpdates } from "@/components/news/PersonalUpdates";

export default function TodaysNewsPage() {
  const today = new Date().toISOString().split('T')[0];

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-oswald">Today's News</h1>
        <p className="text-sm text-muted-foreground">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      {/* Personal Updates - highlighted */}
      <PersonalUpdates />

      {/* Last Night's Gigs - full width */}
      <LastNightGigs />

      {/* Band Invitations */}
      <BandInvitations />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <TrendingHashtags />
        <ChartMoversSection />
        <MilestoneNews />
        <DealAnnouncements />

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
              newBands.slice(0, 5).map((band) => (
                <div key={band.id} className="flex items-center justify-between py-1">
                  <div>
                    <p className="font-medium">{band.name}</p>
                    <p className="text-xs text-muted-foreground">{band.genre}</p>
                  </div>
                  <Badge variant="secondary">{format(new Date(band.created_at!), 'HH:mm')}</Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground py-2">No new bands today</p>
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
              releasedSongs.slice(0, 5).map((release: any) => (
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
              festivals.slice(0, 5).map((fest) => (
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
      </div>
    </div>
  );
}
