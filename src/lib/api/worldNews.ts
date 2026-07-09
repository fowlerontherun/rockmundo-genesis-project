import { supabase } from "@/integrations/supabase/client";

export type WorldNewsCategory = "Charts" | "Release" | "Festival" | "Gig" | "Award" | "Milestone";

export interface WorldNewsItem {
  id: string;
  category: WorldNewsCategory;
  title: string;
  description: string;
  timestamp: string;
  source: string;
  href?: string;
}

interface SourceResult {
  items: WorldNewsItem[];
  error: unknown | null;
}

const db = supabase as any;
const NEWS_LIMIT = 10;

const asArray = <T>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

const isWorldNewsItem = (item: WorldNewsItem | null): item is WorldNewsItem => item !== null;

const validDate = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const collect = async (loader: () => Promise<WorldNewsItem[]>): Promise<SourceResult> => {
  try {
    return { items: await loader(), error: null };
  } catch (error) {
    return { items: [], error };
  }
};

export const fetchWorldNews = async (limit = NEWS_LIMIT): Promise<WorldNewsItem[]> => {
  const [charts, releases, festivals, gigs, awards, milestones] = await Promise.all([
    collect(async () => {
      const { data, error } = await db
        .from("chart_entries")
        .select("id, rank, previous_rank, trend, chart_date, chart_type, country, songs(title, genre, bands(name), profiles:user_id(stage_name))")
        .order("chart_date", { ascending: false, nullsFirst: false })
        .order("rank", { ascending: true })
        .limit(12);
      if (error) throw error;
      return (data ?? []).map((entry: any): WorldNewsItem | null => {
        const song = asArray(entry.songs);
        const movement = Number(entry.previous_rank ?? 0) - Number(entry.rank ?? 0);
        const timestamp = validDate(entry.chart_date);
        if (!timestamp) return null;
        const artist = song?.bands?.name ?? song?.profiles?.stage_name ?? "an emerging artist";
        return {
          id: `chart-${entry.id}`,
          category: "Charts",
          title: `${song?.title ?? "Untitled track"} charts at #${entry.rank}`,
          description: `${artist} ${movement > 0 ? `climbed ${movement} places` : movement < 0 ? `slipped ${Math.abs(movement)} places` : "held steady"} on the ${entry.country ?? entry.chart_type ?? "global"} chart.`,
          timestamp,
          source: "chart_entries",
          href: "/country-charts",
        };
      }).filter(isWorldNewsItem);
    }),
    collect(async () => {
      const { data, error } = await db
        .from("song_releases")
        .select("id, release_date, release_type, platform_name, total_streams, songs(title, genre), bands(name)")
        .order("release_date", { ascending: false, nullsFirst: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []).map((release: any): WorldNewsItem | null => {
        const song = asArray(release.songs);
        const band = asArray(release.bands);
        const timestamp = validDate(release.release_date);
        if (!timestamp) return null;
        return {
          id: `release-${release.id}`,
          category: "Release",
          title: `${song?.title ?? "A new track"} released`,
          description: `${band?.name ?? "An artist"} dropped a ${release.release_type ?? "release"}${release.platform_name ? ` on ${release.platform_name}` : ""}.`,
          timestamp,
          source: "song_releases",
          href: "/releases",
        };
      }).filter(isWorldNewsItem);
    }),
    collect(async () => {
      const { data, error } = await db
        .from("festivals")
        .select("id, name, city, start_date, end_date, genre, status")
        .order("start_date", { ascending: false, nullsFirst: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []).map((festival: any): WorldNewsItem | null => {
        const timestamp = validDate(festival.start_date);
        if (!timestamp) return null;
        return {
          id: `festival-${festival.id}`,
          category: "Festival",
          title: `${festival.name ?? "A festival"} is on the calendar`,
          description: `${festival.genre ?? "Music"} fans are gathering${festival.city ? ` in ${festival.city}` : ""}${festival.status ? ` · ${festival.status}` : ""}.`,
          timestamp,
          source: "festivals",
          href: "/festivals",
        };
      }).filter(isWorldNewsItem);
    }),
    collect(async () => {
      const { data, error } = await db
        .from("gigs")
        .select("id, venue_name, city, scheduled_date, status, expected_attendance, bands(name)")
        .order("scheduled_date", { ascending: false, nullsFirst: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []).map((gig: any): WorldNewsItem | null => {
        const band = asArray(gig.bands);
        const timestamp = validDate(gig.scheduled_date);
        if (!timestamp) return null;
        return {
          id: `gig-${gig.id}`,
          category: "Gig",
          title: `${band?.name ?? "A band"} booked ${gig.venue_name ?? "a venue"}`,
          description: `${gig.status ?? "Scheduled"}${gig.city ? ` in ${gig.city}` : ""}${gig.expected_attendance ? ` · ${gig.expected_attendance} expected` : ""}.`,
          timestamp,
          source: "gigs",
          href: "/schedule",
        };
      }).filter(isWorldNewsItem);
    }),
    collect(async () => {
      const { data, error } = await db
        .from("award_shows")
        .select("id, name, ceremony_date, status")
        .order("ceremony_date", { ascending: false, nullsFirst: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []).map((show: any): WorldNewsItem | null => {
        const timestamp = validDate(show.ceremony_date);
        if (!timestamp) return null;
        return {
          id: `award-${show.id}`,
          category: "Award",
          title: `${show.name ?? "An awards show"} approaches`,
          description: `The ceremony is ${show.status ?? "scheduled"}; nominees and winners will make headlines here.`,
          timestamp,
          source: "award_shows",
          href: "/awards",
        };
      }).filter(isWorldNewsItem);
    }),
    collect(async () => {
      const { data, error } = await db
        .from("bands")
        .select("id, name, genre, fame, weekly_fans, updated_at")
        .order("weekly_fans", { ascending: false, nullsFirst: false })
        .order("fame", { ascending: false, nullsFirst: false })
        .limit(8);
      if (error) throw error;
      return (data ?? [])
        .filter((band: any) => Number(band.weekly_fans ?? band.fame ?? 0) > 0)
        .map((band: any): WorldNewsItem | null => {
          const timestamp = validDate(band.updated_at);
          if (!timestamp) return null;
          return {
            id: `milestone-${band.id}`,
            category: "Milestone",
            title: `${band.name ?? "A band"} is gaining momentum`,
            description: `${band.genre ?? "Genre-fluid"} act with ${Number(band.weekly_fans ?? 0).toLocaleString()} weekly fans and ${Number(band.fame ?? 0).toLocaleString()} fame.`,
            timestamp,
            source: "bands",
            href: "/band-rankings",
          };
        }).filter(isWorldNewsItem);
    }),
  ]);

  const results = [charts, releases, festivals, gigs, awards, milestones];
  const items = results.flatMap((result) => result.items);
  if (items.length === 0 && results.some((result) => result.error)) {
    throw new Error("World news could not be loaded from the available read-only data sources.");
  }

  return items
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, Math.min(Math.max(limit, 5), NEWS_LIMIT));
};
