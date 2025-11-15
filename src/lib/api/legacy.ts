// @ts-nocheck
import { supabase } from "@/lib/supabase-client";
import { logger } from "@/lib/logger";

export interface LegacyMilestone {
  id: string;
  title: string;
  description: string;
  category: string;
  isAchieved: boolean;
  achievedAt?: string | null;
  targetDate?: string | null;
  highlight?: string | null;
}

interface LegacyMilestoneRow {
  id: string;
  profile_id?: string | null;
  title: string;
  description?: string | null;
  category?: string | null;
  is_achieved?: boolean | null;
  achieved_at?: string | null;
  target_date?: string | null;
  highlight?: string | null;
  sort_order?: number | null;
}

const FALLBACK_MILESTONES: LegacyMilestone[] = [
  {
    id: "foundation",
    title: "Formed the Band",
    description: "You gathered the founding lineup and established your signature sound.",
    category: "career",
    isAchieved: true,
    achievedAt: "2024-03-12T00:00:00Z",
    highlight: "Our first rehearsal felt like lightning in a bottle.",
  },
  {
    id: "first-tour",
    title: "Completed First Tour",
    description: "Wrapped a 12-city run with sold-out final shows and growing momentum.",
    category: "touring",
    isAchieved: true,
    achievedAt: "2024-08-22T00:00:00Z",
    highlight: "Fans were singing the encore louder than the PA system.",
  },
  {
    id: "breakthrough-single",
    title: "Breakthrough Single Released",
    description: "Your hit single crossed 5M streams and opened the door to global playlists.",
    category: "releases",
    isAchieved: true,
    achievedAt: "2024-12-02T00:00:00Z",
    highlight: "We woke up to messages from producers we idolized.",
  },
  {
    id: "charity",
    title: "Headlined Charity Gala",
    description: "Raised funds for music education programs in three partner cities.",
    category: "impact",
    isAchieved: false,
    targetDate: "2025-05-01T00:00:00Z",
    highlight: "Building bridges with the community keeps us grounded.",
  },
  {
    id: "world-tour",
    title: "Global Tour Announcement",
    description: "Finalize routing for 40+ dates spanning three continents and major festivals.",
    category: "vision",
    isAchieved: false,
    targetDate: "2025-11-10T00:00:00Z",
    highlight: "The world is ready for our sound—now it’s logistics time.",
  },
];

const mapRowToMilestone = (row: LegacyMilestoneRow): LegacyMilestone => ({
  id: row.id,
  title: row.title,
  description: row.description ?? "",
  category: row.category ?? "career",
  isAchieved: Boolean(row.is_achieved ?? row.achieved_at),
  achievedAt: row.achieved_at ?? null,
  targetDate: row.target_date ?? null,
  highlight: row.highlight ?? null,
});

const withSafeFallback = (): LegacyMilestone[] =>
  FALLBACK_MILESTONES.map((milestone) => ({ ...milestone }));

export const fetchLegacyMilestones = async (
  profileId?: string | null
): Promise<LegacyMilestone[]> => {
  if (!profileId) {
    return withSafeFallback();
  }

  const { data, error } = await supabase
    .from("legacy_milestones")
    .select(
      "id, profile_id, title, description, category, is_achieved, achieved_at, target_date, highlight, sort_order"
    )
    .eq("profile_id", profileId)
    .order("sort_order", { ascending: true })
    .order("achieved_at", { ascending: true, nullsFirst: true })
    .order("target_date", { ascending: true, nullsFirst: true });

  if (error) {
    logger.warn("Failed to fetch legacy milestones from Supabase", {
      error: error.message,
      code: error.code,
    });
    return withSafeFallback();
  }

  if (!data || data.length === 0) {
    return withSafeFallback();
  }

  return (data as LegacyMilestoneRow[]).map(mapRowToMilestone);
};

export default fetchLegacyMilestones;
