import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Music, Calendar } from "lucide-react";
import { format } from "date-fns";
import { LastNightGigs } from "@/components/news/LastNightGigs";
import { BandInvitations } from "@/components/band/BandInvitations";
import { TrendingHashtags } from "@/components/news/TrendingHashtags";
import { ChartMoversSection } from "@/components/news/ChartMoversSection";
import { MilestoneNews } from "@/components/news/MilestoneNews";
import { DealAnnouncements } from "@/components/news/DealAnnouncements";
import { PersonalUpdates } from "@/components/news/PersonalUpdates";
import { TopTracksNews } from "@/components/news/TopTracksNews";
import { PlayerGainsNews } from "@/components/news/PlayerGainsNews";
import { BandGainsNews } from "@/components/news/BandGainsNews";
import { OtherBandsGigOutcomes } from "@/components/news/OtherBandsGigOutcomes";
import { MerchSalesNews } from "@/components/news/MerchSalesNews";
import { RandomEventsNews } from "@/components/news/RandomEventsNews";
import { EarningsNews } from "@/components/news/EarningsNews";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameCalendar } from "@/hooks/useGameCalendar";
export default function TodaysNewsPage() {
  const { t } = useTranslation();
  const { data: calendar } = useGameCalendar();
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
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl sm:text-3xl font-oswald">{t('todaysNews.title')}</h1>
        <div className="flex items-center gap-3">
          {calendar && (
            <Badge variant="outline" className="gap-1.5 text-xs">
              {calendar.seasonEmoji} <span className="capitalize">{calendar.season}</span> · Day {calendar.gameDay}, Yr {calendar.gameYear}
            </Badge>
          )}
          <p className="text-xs sm:text-sm text-muted-foreground">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
      </div>

      {/* Random Events - urgent attention */}
      <RandomEventsNews />

      {/* Personal Updates - highlighted */}
      <PersonalUpdates />

      {/* Player XP, Skills, and Earnings */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <PlayerGainsNews />
        <BandGainsNews />
        <EarningsNews />
      </div>

      {/* Merchandise Sales */}
      <MerchSalesNews />

      {/* Top Tracks - playable songs */}
      <TopTracksNews />

      {/* Last Night's Gigs - full width */}
      <LastNightGigs />

      {/* Other Bands' Gig Outcomes */}
      <OtherBandsGigOutcomes />

      {/* Band Invitations */}
      <BandInvitations />

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <TrendingHashtags />
        <ChartMoversSection />
        <MilestoneNews />
        <DealAnnouncements />

        {/* New Bands */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" />
              {t('todaysNews.newBandsFormed')}
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
              <p className="text-sm text-muted-foreground py-2">{t('todaysNews.noNewBands')}</p>
            )}
          </CardContent>
        </Card>

        {/* Released Songs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Music className="h-5 w-5" />
              {t('todaysNews.songsReleased')}
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
              <p className="text-sm text-muted-foreground py-2">{t('todaysNews.noSongsReleased')}</p>
            )}
          </CardContent>
        </Card>

        {/* Festivals */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5" />
              {t('todaysNews.festivalsStarting')}
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
              <p className="text-sm text-muted-foreground py-2">{t('todaysNews.noFestivals')}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
