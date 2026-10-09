import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Newspaper, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";

import { NewspaperMasthead } from "@/components/news/NewspaperMasthead";
import { BreakingNewsTicker } from "@/components/news/BreakingNewsTicker";
import { GossipColumn } from "@/components/news/GossipColumn";
import { ClassifiedAds } from "@/components/news/ClassifiedAds";

import { LastNightGigs } from "@/components/news/LastNightGigs";
import { TrendingHashtags } from "@/components/news/TrendingHashtags";
import { ChartMoversSection } from "@/components/news/ChartMoversSection";
import { DealAnnouncements } from "@/components/news/DealAnnouncements";
import { PersonalUpdates } from "@/components/news/PersonalUpdates";
import { RandomEventsNews } from "@/components/news/RandomEventsNews";
import { BattleOfTheBandsNews } from "@/components/news/BattleOfTheBandsNews";
import { LocalDailyBrief } from "@/components/news/LocalDailyBrief";
import { NewsList } from "@/components/news/NewsList";

export default function TodaysNewsPage() {
  const today = new Date().toISOString().split("T")[0];
  const dayStart = `${today}T00:00:00`;
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);

  // Keep this edition focused on bands formed today.
  const { data: newBands } = useQuery({
    queryKey: ["news-new-bands", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bands")
        .select("id, name, genre, created_at, popularity, total_fans")
        .gte("created_at", dayStart)
        .lt("created_at", `${tomorrow}T00:00:00`)
        .order("created_at", { ascending: false })
        .limit(100);
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
        .gte("release_date", dayStart)
        .lt("release_date", `${tomorrow}T00:00:00`)
        .order("release_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: festivalBandAnnouncements } = useQuery({
    queryKey: ["news-festival-band-announcements", today],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("recent_festival_band_announcements", { p_limit: 100 });
      if (error) throw error;
      return (data ?? []) as Array<{ booking_id: string; band_name: string; festival_name: string; billing_position: string; confirmed_at: string }>;
    },
  });

  const { data: festivals } = useQuery({
    queryKey: ["news-festivals", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_events")
        .select("id, title, event_type, start_date, end_date")
        .eq("event_type", "festival")
        .gte("start_date", dayStart)
        .lt("start_date", `${tomorrow}T00:00:00`)
        .order("start_date", { ascending: true })
        .limit(100);
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

        <div className="mt-6 space-y-3">
          <NewsCategory title="Your Character & Local News" description="Your location, local highlights and recent character activity" defaultOpen>
            <div className="grid items-start gap-4 md:grid-cols-2">
              <PersonalUpdates />
              <RandomEventsNews />
            </div>
            <LocalDailyBrief />
          </NewsCategory>
          <NewsCategory title="Music, Charts & Releases" description="New music and chart movement">
            <div className="grid items-start gap-4 md:grid-cols-2">
              <ChartMoversSection />
              {!!releasedSongs?.length && <NewsList title="New Releases" items={releasedSongs ?? []} itemKey={r => r.id} defaultOpen
                renderItem={release => (
                  <>
                    <p className="font-semibold text-sm font-serif">{release.title}</p>
                    <p className="text-xs text-muted-foreground">{release.bands?.name || "Independent"} · {release.release_type}</p>
                  </>
                )} />}
            </div>
          </NewsCategory>
          <NewsCategory title="Festivals & Live Events" description="Line-ups, battles and live performances">
            <div className="grid gap-4 lg:grid-cols-2">
              {!!festivalBandAnnouncements?.length && <NewsList title="Festival Line-up Announcements" items={festivalBandAnnouncements ?? []} itemKey={a => a.booking_id}
                renderItem={announcement => (
                  <>
                    <p className="font-semibold font-serif">{announcement.band_name} confirmed for {announcement.festival_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{announcement.billing_position.replaceAll("_", " ")} · {format(new Date(announcement.confirmed_at), "d MMM")}</p>
                  </>
                )} />}
              {!!festivals?.length && <NewsList title="Festival Diary" items={festivals ?? []} itemKey={f => f.id}
                renderItem={fest => (
                  <>
                    <p className="font-semibold text-sm font-serif">{fest.title}</p>
                    <p className="text-xs text-muted-foreground">{fest.start_date ? format(new Date(fest.start_date), "EEE d MMM") : fest.event_type}</p>
                  </>
                )} />}
            </div>
            <div className="grid items-start gap-4 md:grid-cols-2">
              <BattleOfTheBandsNews />
              <LastNightGigs />
            </div>
          </NewsCategory>
          <NewsCategory title="Bands & Business" description="New bands and music industry announcements">
            <div className="grid gap-4 lg:grid-cols-2">
              {!!newBands?.length && <NewsList title="New Bands Formed" items={newBands ?? []} itemKey={b => b.id}
                renderItem={band => (
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm font-serif">{band.name}</p>
                      <p className="text-xs text-muted-foreground">{band.genre || "Genre TBC"}{band.total_fans ? ` · ${band.total_fans.toLocaleString()} fans` : ""}</p>
                    </div>
                    {band.created_at && <Badge variant="secondary">{format(new Date(band.created_at), "d MMM")}</Badge>}
                  </div>
                )} />}
              <DealAnnouncements />
            </div>
          </NewsCategory>
          <NewsCategory title="Community & Social" description="Conversations and community updates">
            <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
              <TrendingHashtags />
              <ClassifiedAds />
              <GossipColumn />
            </div>
          </NewsCategory>
        </div>

        <footer className="mt-8 border-t-2 border-foreground pt-2 text-center text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          The Rockmundo Times · Printed daily in every city on the map ·
          {" "}{format(new Date(), "yyyy")}
        </footer>
      </div>
    </FMPageScaffold>
  );
}

function NewsCategory({ title, description, children, defaultOpen = false }: {
  title: string; description?: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <details open={isOpen} onToggle={event => setIsOpen(event.currentTarget.open)} className="group rounded-md border border-foreground/50 bg-card/30">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-serif text-lg font-black [&::-webkit-details-marker]:hidden">
        <span className="flex flex-col gap-1"><span>{title}</span>{description && <span className="font-sans text-xs font-normal text-muted-foreground">{description}</span>}</span>
        <ChevronDown aria-hidden="true" className="h-5 w-5 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-4 border-t border-border p-4">{children}</div>
    </details>
  );
}
