import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Music, Calendar } from "lucide-react";
import { format } from "date-fns";

import { NewspaperMasthead } from "@/components/news/NewspaperMasthead";
import { BreakingNewsTicker } from "@/components/news/BreakingNewsTicker";
import { TopStoryHero } from "@/components/news/TopStoryHero";
import { GossipColumn } from "@/components/news/GossipColumn";
import { WeatherReport } from "@/components/news/WeatherReport";
import { ClassifiedAds } from "@/components/news/ClassifiedAds";
import { InterviewNews } from "@/components/news/InterviewNews";

import { LastNightGigs } from "@/components/news/LastNightGigs";
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
import { ElectionCoverage } from "@/components/news/ElectionCoverage";
import { ParliamentDigest } from "@/components/news/ParliamentDigest";
import { PartyPowerRankings } from "@/components/news/PartyPowerRankings";

export default function TodaysNewsPage() {
  const today = new Date().toISOString().split("T")[0];

  const { data: newBands } = useQuery({
    queryKey: ["news-new-bands", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bands")
        .select("id, name, genre, created_at")
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
        .select("id, title, release_type, release_date, bands(name)")
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
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Masthead */}
      <NewspaperMasthead />

      {/* Breaking News Ticker */}
      <BreakingNewsTicker />

      {/* Top Story */}
      <TopStoryHero />

      {/* Urgent: Random Events */}
      <RandomEventsNews />

      {/* Personal Updates */}
      <PersonalUpdates />

      {/* === FRONT PAGE: Two-column layout === */}
      <div className="grid gap-6 lg:grid-cols-3 mb-8">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section Header */}
          <SectionDivider title="Entertainment" />

          <TopTracksNews />
          <LastNightGigs />
          <OtherBandsGigOutcomes />
          <InterviewNews />

          <SectionDivider title="Charts & Music" />

          <div className="grid gap-4 sm:grid-cols-2">
            <ChartMoversSection />
            {/* New Releases */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-serif flex items-center gap-2">
                  <Music className="h-5 w-5" />
                  New Releases
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {releasedSongs && releasedSongs.length > 0 ? (
                  releasedSongs.slice(0, 5).map((release: any) => (
                    <div key={release.id} className="py-1 border-b border-border/50 last:border-0">
                      <p className="font-semibold text-sm font-serif">{release.title}</p>
                      <p className="text-xs text-muted-foreground">{release.bands?.name} · {release.release_type}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground italic font-serif py-2">No releases today</p>
                )}
              </CardContent>
            </Card>
          </div>

          <SectionDivider title="Your Column" />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <PlayerGainsNews />
            <BandGainsNews />
            <EarningsNews />
          </div>

          <MerchSalesNews />

          <SectionDivider title="Business & Deals" />

          <div className="grid gap-4 sm:grid-cols-2">
            <DealAnnouncements />
            {/* New Bands */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-serif flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  New Bands Formed
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {newBands && newBands.length > 0 ? (
                  newBands.slice(0, 5).map((band) => (
                    <div key={band.id} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
                      <div>
                        <p className="font-semibold text-sm font-serif">{band.name}</p>
                        <p className="text-xs text-muted-foreground">{band.genre}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs">{format(new Date(band.created_at!), "HH:mm")}</Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground italic font-serif py-2">No new bands today</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Festivals */}
          {festivals && festivals.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-serif flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Festivals Starting Today
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {festivals.slice(0, 5).map((fest) => (
                  <div key={fest.id} className="py-1 border-b border-border/50 last:border-0">
                    <p className="font-semibold text-sm font-serif">{fest.title}</p>
                    <p className="text-xs text-muted-foreground">{fest.event_type}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <WeatherReport />
          <GossipColumn />
          <TrendingHashtags />
          <MilestoneNews />
          <ElectionCoverage />
          <ParliamentDigest />
          <PartyPowerRankings />
          <ClassifiedAds />
        </div>
      </div>
    </div>
  );
}

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 pt-4">
      <div className="h-px flex-1 bg-border" />
      <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground font-serif">{title}</h3>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
