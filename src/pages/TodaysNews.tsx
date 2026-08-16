import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Users, Music, Calendar, Newspaper } from "lucide-react";
import { format } from "date-fns";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";

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
import { BattleOfTheBandsNews } from "@/components/news/BattleOfTheBandsNews";
import { WorldWire } from "@/components/news/WorldWire";
import { WorldAtAGlance } from "@/components/news/WorldAtAGlance";

export default function TodaysNewsPage() {
  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  // Bands formed recently (falls back to the last week so the page is never empty)
  const { data: newBands } = useQuery({
    queryKey: ["news-new-bands", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bands")
        .select("id, name, genre, created_at, popularity, total_fans")
        .gte("created_at", weekAgo)
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: releasedSongs } = useQuery({
    queryKey: ["news-releases", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("releases")
        .select("id, title, release_type, release_date, bands(name)")
        .eq("release_status", "released")
        .lte("release_date", `${today}T23:59:59`)
        .order("release_date", { ascending: false })
        .limit(6);
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
        .gte("start_date", weekAgo)
        .order("start_date", { ascending: true })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <FMPageScaffold
      title="Today's News"
      subtitle="The world is reading…"
      icon={Newspaper}
      backTo="/hub/media"
    >
      <div className="mx-auto max-w-[1400px] border-x border-y-2 border-foreground/70 bg-card/40 px-3 py-4 sm:px-6 sm:py-6">
        <NewspaperMasthead />
        <BreakingNewsTicker />

        {/* Front page splash */}
        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-5">
            <TopStoryHero />
            <RandomEventsNews />
            <PersonalUpdates />
          </div>
          <aside className="space-y-5 lg:border-l lg:border-border lg:pl-5">
            <WorldAtAGlance />
            <WeatherReport />
            <GossipColumn />
          </aside>
        </div>

        <div className="my-6 border-t-4 border-double border-foreground" />

        {/* Wire section — real world activity */}
        <WorldWire limit={12} />

        <div className="my-6 border-t-4 border-double border-foreground" />

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-5">
            <SectionDivider title="Entertainment" page="Page 2" />

            <TopTracksNews />
            <BattleOfTheBandsNews />
            <LastNightGigs />
            <OtherBandsGigOutcomes />
            <InterviewNews />

            <SectionDivider title="Charts & Music" page="Page 3" />

            <div className="grid gap-4 sm:grid-cols-2">
              <ChartMoversSection />
              <NewsPanel title="Latest Releases" icon={Music}>
                {releasedSongs && releasedSongs.length > 0 ? (
                  releasedSongs.map((release: any) => (
                    <div
                      key={release.id}
                      className="py-1 border-b border-border/50 last:border-0"
                    >
                      <p className="font-semibold text-sm font-serif">
                        {release.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {release.bands?.name || "Independent"} · {release.release_type}
                        {release.release_date
                          ? ` · ${format(new Date(release.release_date), "d MMM")}`
                          : ""}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground italic font-serif py-2">
                    No records have hit the shelves yet.
                  </p>
                )}
              </NewsPanel>
            </div>

            <SectionDivider title="Your Column" page="Page 4" />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <PlayerGainsNews />
              <BandGainsNews />
              <EarningsNews />
            </div>

            <MerchSalesNews />

            <SectionDivider title="Business & Deals" page="Page 5" />

            <div className="grid gap-4 sm:grid-cols-2">
              <DealAnnouncements />
              <NewsPanel title="New Bands Formed" icon={Users}>
                {newBands && newBands.length > 0 ? (
                  newBands.map((band: any) => (
                    <div
                      key={band.id}
                      className="flex items-start justify-between gap-2 py-1 border-b border-border/50 last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-sm font-serif break-words">
                          {band.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {band.genre || "Genre TBC"}
                          {band.total_fans
                            ? ` · ${band.total_fans.toLocaleString()} fans`
                            : ""}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs flex-shrink-0">
                        {format(new Date(band.created_at!), "d MMM")}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground italic font-serif py-2">
                    No new bands this week.
                  </p>
                )}
              </NewsPanel>
            </div>

            {festivals && festivals.length > 0 && (
              <NewsPanel title="Festival Diary" icon={Calendar}>
                {festivals.map((fest: any) => (
                  <div
                    key={fest.id}
                    className="py-1 border-b border-border/50 last:border-0"
                  >
                    <p className="font-semibold text-sm font-serif">{fest.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {fest.start_date
                        ? format(new Date(fest.start_date), "EEE d MMM")
                        : fest.event_type}
                    </p>
                  </div>
                ))}
              </NewsPanel>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-5 lg:border-l lg:border-border lg:pl-5">
            <SectionDivider title="World Desk" page="Page 6" />
            <TrendingHashtags />
            <MilestoneNews />
            <ElectionCoverage />
            <ParliamentDigest />
            <PartyPowerRankings />
            <ClassifiedAds />
          </div>
        </div>

        <footer className="mt-8 border-t-2 border-foreground pt-2 text-center text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          The Rockmundo Times · Printed daily in every city on the map ·
          {" "}{format(new Date(), "yyyy")}
        </footer>
      </div>
    </FMPageScaffold>
  );
}

function SectionDivider({ title, page }: { title: string; page?: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <h3 className="text-[11px] font-black uppercase tracking-[0.25em] font-serif">
        {title}
      </h3>
      <div className="h-px flex-1 bg-foreground/40" />
      {page && (
        <span className="text-[10px] font-mono text-muted-foreground">{page}</span>
      )}
    </div>
  );
}

function NewsPanel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-foreground/40 bg-card/60 p-3">
      <h4 className="font-serif text-base font-black flex items-center gap-2 border-b border-foreground/40 pb-1 mb-2">
        <Icon className="h-4 w-4" />
        {title}
      </h4>
      <div className="space-y-1">{children}</div>
    </section>
  );
}
