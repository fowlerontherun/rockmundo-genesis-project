import { supabase } from "@/integrations/supabase/client";

export interface RetirementStats {
  characterName: string;
  avatarUrl: string | null;
  finalAge: number;
  yearsActive: number;
  totalFame: number;
  totalCashEarned: number;
  totalSongs: number;
  totalGigs: number;
  totalAlbums: number;
  peakChartPosition: number | null;
  notableAchievements: string[];
  finalSkills: Record<string, number>;
  finalAttributes: Record<string, number>;
}

export interface InheritanceResult {
  inheritedCash: number;
  inheritedSkills: Record<string, number>;
  generationNumber: number;
}

/**
 * Calculate what the new character inherits
 * - 50% of cash
 * - 10% of all skill levels
 */
export function calculateInheritance(
  currentCash: number,
  skills: Record<string, number>
): { cash: number; skills: Record<string, number> } {
  const inheritedCash = Math.floor(currentCash * 0.5);

  const inheritedSkills: Record<string, number> = {};
  for (const [skillId, value] of Object.entries(skills)) {
    inheritedSkills[skillId] = Math.floor(value * 0.1);
  }

  return {
    cash: inheritedCash,
    skills: inheritedSkills,
  };
}

/**
 * Process character retirement and create hall of fame entry
 */
export async function processRetirement(
  userId: string,
  profileId: string,
  retirementType: "voluntary" | "mandatory" = "voluntary"
): Promise<{ success: boolean; hallOfFameId?: string; inheritance?: InheritanceResult; error?: string }> {
  try {
    // 1. Fetch current profile data
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", profileId)
      .single();

    if (profileError || !profile) {
      return { success: false, error: "Failed to fetch profile" };
    }

    // 2. Fetch player skills from skill_progress
    const { data: skillProgressData, error: skillReadError } = await supabase
      .from("skill_progress")
      .select("skill_slug, current_level")
      .eq("profile_id", profileId);

    if (skillReadError) throw skillReadError;
    const skillsMap: Record<string, number> = {};
    if (skillProgressData) {
      for (const row of skillProgressData) {
        if (typeof row.current_level === 'number') {
          skillsMap[row.skill_slug] = row.current_level;
        }
      }
    }

    // 3. Fetch player attributes (flat structure with attribute columns)
    const { data: playerAttributesData, error: attributesError } = await supabase
      .from("player_attributes")
      .select("charisma, looks, mental_focus, musicality, physical_endurance, stage_presence, crowd_engagement, social_reach")
      .eq("profile_id", profileId)
      .single();

    if (attributesError) throw attributesError;
    const attributesMap: Record<string, number> = {};
    if (playerAttributesData) {
      const attrKeys = ['charisma', 'looks', 'mental_focus', 'musicality', 'physical_endurance', 'stage_presence', 'crowd_engagement', 'social_reach'];
      attrKeys.forEach(key => {
        const value = playerAttributesData[key as keyof typeof playerAttributesData];
        if (typeof value === 'number') {
          attributesMap[key] = value;
        }
      });
    }

    // Only songs directly owned by this character count toward their career.
    const { count: songCount, error: songCountError } = await supabase
      .from("songs").select("id", { count: "exact", head: true })
      .eq("profile_id", profileId);
    if (songCountError) throw songCountError;
    const { data: ownedSongs, error: ownedSongsError } = await supabase
      .from("songs").select("id").eq("profile_id", profileId);
    if (ownedSongsError) throw ownedSongsError;
    const ownedIds = (ownedSongs ?? []).map(song => song.id);
    const { data: releaseLinks, error: releaseLinksError } = ownedIds.length
      ? await supabase.from("release_songs").select("release_id").in("song_id", ownedIds)
      : { data: [], error: null };
    if (releaseLinksError) throw releaseLinksError;
    const releaseIds = [...new Set((releaseLinks ?? []).map(link => link.release_id).filter(Boolean))];
    const { count: albumCount, error: albumCountError } = releaseIds.length
      ? await supabase.from("releases").select("id", { count: "exact", head: true })
        .in("id", releaseIds).eq("release_type", "album")
      : { count: 0, error: null };
    if (albumCountError) throw albumCountError;

    const { data: performances, error: performancesError } = await supabase
      .from("gig_performances").select("gig_id").eq("user_id", userId);
    if (performancesError) throw performancesError;
    const gigCount = new Set((performances ?? []).map(p => p.gig_id)).size;

    let peakPosition: number | null = null;
    if (ownedIds.length) {
      const { data: chartData, error: chartError } = await supabase
        .from("chart_entries").select("rank")
        .in("song_id", ownedIds)
        .order("rank", { ascending: true }).limit(1);
      if (chartError) throw chartError;
      peakPosition = chartData?.[0]?.rank ?? null;
    }

    // The database completes the Hall of Fame, generation, reset and skill
    // replacement in one transaction. Any failure rolls everything back.
    const { data, error } = await supabase.rpc("finalize_character_retirement" as any, {
      p_profile_id: profileId,
      p_type: retirementType,
      p_stats: {
        total_songs: songCount ?? 0,
        total_gigs: gigCount,
        total_albums: albumCount ?? 0,
        peak_chart_position: peakPosition,
      },
      p_skills: skillsMap,
      p_attributes: attributesMap,
    });
    if (error) throw error;
    const result = data as { hall_of_fame_id: string; inherited_cash: number; inherited_skills: Record<string, number>; generation_number: number } | null;
    if (!result?.hall_of_fame_id) throw new Error("Retirement transaction returned no Hall of Fame record");
    return {
      success: true,
      hallOfFameId: result.hall_of_fame_id,
      inheritance: {
        inheritedCash: result.inherited_cash,
        inheritedSkills: result.inherited_skills,
        generationNumber: result.generation_number,
      },
    };
  } catch (error) {
    console.error("Retirement processing error:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Get hall of fame entries sorted by fame
 */
export async function getHallOfFame(limit: number = 50) {
  const { data, error } = await supabase
    .from("hall_of_fame")
    .select("*")
    .order("total_fame", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching hall of fame:", error);
    return [];
  }

  return data;
}
