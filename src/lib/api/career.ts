// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/lib/supabase-types";

export type GigOutcomeRow = Tables<"gig_outcomes">;
export type GigRow = Pick<
  Tables<"gigs">,
  "id" | "scheduled_date" | "completed_at" | "status" | "payment"
>;
export type VenueRow = Pick<Tables<"venues">, "id" | "name" | "reputation">;
export type PromoterRow = Pick<Tables<"promoters">, "id" | "name" | "reputation">;
export type PlayerSkillsRow = Tables<"skill_progress">;
export type BandRow = Pick<
  Tables<"bands">,
  "id" | "name" | "fame" | "popularity" | "weekly_fans"
>;

export interface GigOutcomeWithDetails extends GigOutcomeRow {
  gig: (GigRow & {
    venue: VenueRow | null;
    promoter: PromoterRow | null;
  }) | null;
}

export interface VenuePerformanceSummary {
  id: string | null;
  name: string;
  shows: number;
  averageRating: number | null;
  averageReputation: number | null;
  totalRevenue: number;
}

export interface PromoterPerformanceSummary {
  id: string | null;
  name: string;
  shows: number;
  averageReputation: number | null;
}

export interface CareerGigHighlight {
  id: string;
  gigId: string;
  date: string | null;
  venueName: string | null;
  promoterName: string | null;
  rating: number;
  revenue: number;
  netProfit: number;
}

export interface CareerOverview {
  band: {
    id: string | null;
    name: string | null;
    fame: number | null;
    popularity: number | null;
    weeklyFans: number | null;
  };
  gigSummary: {
    totalGigs: number;
    averageRating: number | null;
    totalRevenue: number;
    totalNetProfit: number;
    lastGigDate: string | null;
    bestGig: CareerGigHighlight | null;
    averageVenueReputation: number | null;
    averagePromoterReputation: number | null;
    venuePerformances: VenuePerformanceSummary[];
    promoterPerformances: PromoterPerformanceSummary[];
    recentGigs: CareerGigHighlight[];
  };
  skillSummary: {
    skillTotals: Record<string, number>;
    totalPoints: number;
    topSkills: Array<{ key: string; value: number }>;
  };
  reputationSummary: {
    bandFame: number | null;
    averageVenueReputation: number | null;
    averagePromoterReputation: number | null;
  };
}

const SKILL_SLUGS = [
  "bass",
  "composition",
  "creativity",
  "drums",
  "guitar",
  "performance",
  "songwriting",
  "technical",
  "vocals",
];

const sum = (values: Array<number | null | undefined>) =>
  values.reduce((acc, value) => acc + (typeof value === "number" ? value : 0), 0);

const average = (values: Array<number | null | undefined>) => {
  const filtered = values.filter((value): value is number => typeof value === "number");
  if (filtered.length === 0) {
    return null;
  }
  const total = filtered.reduce((acc, value) => acc + value, 0);
  return total / filtered.length;
};

const mapGigToHighlight = (gig: GigOutcomeWithDetails): CareerGigHighlight => ({
  id: gig.id,
  gigId: gig.gig_id,
  date: gig.completed_at ?? gig.gig?.completed_at ?? gig.gig?.scheduled_date ?? null,
  venueName: gig.gig?.venue?.name ?? gig.venue_name ?? null,
  promoterName: gig.gig?.promoter?.name ?? null,
  rating: gig.overall_rating,
  revenue:
    gig.total_revenue ??
    gig.ticket_revenue ??
    0,
  netProfit: gig.net_profit ?? 0,
});

export const fetchCareerOverview = async (userId: string): Promise<CareerOverview> => {
  // Fetch ALL band memberships for this player
  const { data: memberships, error: membershipError } = await supabase
    .from("band_members")
    .select(
      `band_id, band:bands (id, name, fame, popularity, weekly_fans)`
    )
    .eq("user_id", userId)
    .order("joined_at", { ascending: false });

  if (membershipError) {
    throw membershipError;
  }

  // Use first (most recent) band for display info
  const primaryMembership = memberships?.[0] ?? null;
  const bandInfo = primaryMembership?.band ?? null;
  
  // Get all band IDs for aggregating gig data
  const allBandIds = memberships?.map(m => m.band_id).filter(Boolean) ?? [];

  let gigRows: GigOutcomeWithDetails[] = [];

  if (allBandIds.length > 0) {
    // Fetch gig outcomes for ALL bands the player has been in
    const { data: gigsData, error: gigsError } = await supabase
      .from("gig_outcomes")
      .select(
        `*, gig:gigs!inner(
          id,
          scheduled_date,
          completed_at,
          status,
          payment,
          band_id,
          venue:venues(id, name, reputation),
          promoter:promoters(id, name, reputation)
        )`
      )
      .in("gig.band_id", allBandIds)
      .order("completed_at", { ascending: false })
      .limit(200);

    if (gigsError) {
      throw gigsError;
    }

    gigRows = (gigsData as GigOutcomeWithDetails[]) ?? [];
  }

  // Fetch skills from skill_progress via profile
  const { data: playerProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  let skillRows: { skill_slug: string; current_level: number }[] = [];
  if (playerProfile?.id) {
    const { data: progressData, error: skillsError } = await supabase
      .from("skill_progress")
      .select("skill_slug, current_level")
      .eq("profile_id", playerProfile.id);

    if (skillsError) {
      throw skillsError;
    }
    skillRows = (progressData ?? []) as { skill_slug: string; current_level: number }[];
  }

  const totalGigs = gigRows.length;
  const totalRevenue = sum(gigRows.map(gig => gig.total_revenue ?? gig.ticket_revenue ?? 0));
  const totalNetProfit = sum(gigRows.map(gig => gig.net_profit ?? 0));
  const averageRating = average(gigRows.map(gig => gig.overall_rating));
  const sortedByDate = [...gigRows].sort((a, b) => {
    const dateA = new Date(a.completed_at ?? a.gig?.completed_at ?? a.gig?.scheduled_date ?? "1970-01-01");
    const dateB = new Date(b.completed_at ?? b.gig?.completed_at ?? b.gig?.scheduled_date ?? "1970-01-01");
    return dateB.getTime() - dateA.getTime();
  });
  const lastGigDate = sortedByDate[0]
    ? sortedByDate[0].completed_at ?? sortedByDate[0].gig?.completed_at ?? sortedByDate[0].gig?.scheduled_date ?? null
    : null;

  const bestGig = gigRows.reduce<CareerGigHighlight | null>((currentBest, gig) => {
    if (!currentBest || gig.overall_rating > currentBest.rating) {
      return mapGigToHighlight(gig);
    }
    return currentBest;
  }, null);

  const recentGigs = sortedByDate.slice(0, 5).map(mapGigToHighlight);

  const venueAggregate = new Map<
    string,
    {
      id: string | null;
      name: string;
      shows: number;
      totalRating: number;
      ratingCount: number;
      totalReputation: number;
      reputationCount: number;
      totalRevenue: number;
    }
  >();

  const promoterAggregate = new Map<
    string,
    {
      id: string | null;
      name: string;
      shows: number;
      totalReputation: number;
      reputationCount: number;
    }
  >();

  for (const gig of gigRows) {
    const venue = gig.gig?.venue ?? null;
    const venueKey = venue?.id ?? (gig.venue_name ? `named:${gig.venue_name}` : "unknown");
    if (!venueAggregate.has(venueKey)) {
      venueAggregate.set(venueKey, {
        id: venue?.id ?? null,
        name: venue?.name ?? gig.venue_name ?? "Unknown venue",
        shows: 0,
        totalRating: 0,
        ratingCount: 0,
        totalReputation: 0,
        reputationCount: 0,
        totalRevenue: 0,
      });
    }
    const venueStats = venueAggregate.get(venueKey)!;
    venueStats.shows += 1;
    venueStats.totalRating += gig.overall_rating ?? 0;
    if (typeof gig.overall_rating === "number") {
      venueStats.ratingCount += 1;
    }
    if (typeof venue?.reputation === "number") {
      venueStats.totalReputation += venue.reputation;
      venueStats.reputationCount += 1;
    }
    venueStats.totalRevenue += gig.total_revenue ?? gig.ticket_revenue ?? 0;

    const promoter = gig.gig?.promoter ?? null;
    if (promoter) {
      const promoterKey = promoter.id ?? promoter.name;
      if (!promoterAggregate.has(promoterKey)) {
        promoterAggregate.set(promoterKey, {
          id: promoter.id ?? null,
          name: promoter.name ?? "Unknown promoter",
          shows: 0,
          totalReputation: 0,
          reputationCount: 0,
        });
      }
      const promoterStats = promoterAggregate.get(promoterKey)!;
      promoterStats.shows += 1;
      if (typeof promoter.reputation === "number") {
        promoterStats.totalReputation += promoter.reputation;
        promoterStats.reputationCount += 1;
      }
    }
  }

  const venuePerformances: VenuePerformanceSummary[] = Array.from(venueAggregate.values())
    .map(entry => ({
      id: entry.id,
      name: entry.name,
      shows: entry.shows,
      averageRating: entry.ratingCount > 0 ? entry.totalRating / entry.ratingCount : null,
      averageReputation:
        entry.reputationCount > 0 ? entry.totalReputation / entry.reputationCount : null,
      totalRevenue: entry.totalRevenue,
    }))
    .sort((a, b) => {
      if (b.shows !== a.shows) {
        return b.shows - a.shows;
      }
      const ratingA = a.averageRating ?? 0;
      const ratingB = b.averageRating ?? 0;
      return ratingB - ratingA;
    });

  const promoterPerformances: PromoterPerformanceSummary[] = Array.from(promoterAggregate.values())
    .map(entry => ({
      id: entry.id,
      name: entry.name,
      shows: entry.shows,
      averageReputation:
        entry.reputationCount > 0 ? entry.totalReputation / entry.reputationCount : null,
    }))
    .sort((a, b) => b.shows - a.shows);

  const averageVenueReputation = average(
    venuePerformances.map(performance => performance.averageReputation)
  );

  const averagePromoterReputation = average(
    promoterPerformances.map(performance => performance.averageReputation)
  );

  const skillTotals: Record<string, number> = {};
  let totalSkillPoints = 0;
  for (const row of skillRows) {
    if (SKILL_SLUGS.includes(row.skill_slug)) {
      skillTotals[row.skill_slug] = row.current_level || 0;
      totalSkillPoints += row.current_level || 0;
    }
  }

  const topSkills = Object.entries(skillTotals)
    .sort(([, aValue], [, bValue]) => bValue - aValue)
    .slice(0, 5)
    .map(([key, value]) => ({ key, value }));

  return {
    band: {
      id: bandInfo?.id ?? null,
      name: bandInfo?.name ?? null,
      fame: bandInfo?.fame ?? null,
      popularity: bandInfo?.popularity ?? null,
      weeklyFans: bandInfo?.weekly_fans ?? null,
    },
    gigSummary: {
      totalGigs,
      averageRating,
      totalRevenue,
      totalNetProfit,
      lastGigDate,
      bestGig,
      averageVenueReputation,
      averagePromoterReputation,
      venuePerformances,
      promoterPerformances,
      recentGigs,
    },
    skillSummary: {
      skillTotals,
      totalPoints: totalSkillPoints,
      topSkills,
    },
    reputationSummary: {
      bandFame: bandInfo?.fame ?? null,
      averageVenueReputation,
      averagePromoterReputation,
    },
  };
};
