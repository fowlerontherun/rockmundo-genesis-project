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
 * - 20% of all skill levels
 */
export function calculateInheritance(
  currentCash: number,
  skills: Record<string, number>
): { cash: number; skills: Record<string, number> } {
  const inheritedCash = Math.floor(currentCash * 0.5);

  const inheritedSkills: Record<string, number> = {};
  for (const [skillId, value] of Object.entries(skills)) {
    inheritedSkills[skillId] = Math.floor(value * 0.2);
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

    // 2. Fetch player skills (flat structure with skill columns)
    const { data: playerSkillsData } = await supabase
      .from("player_skills")
      .select("vocals, guitar, bass, drums, songwriting, performance, creativity, technical, composition")
      .eq("user_id", userId)
      .single();

    const skillsMap: Record<string, number> = {};
    if (playerSkillsData) {
      const skillKeys = ['vocals', 'guitar', 'bass', 'drums', 'songwriting', 'performance', 'creativity', 'technical', 'composition'];
      skillKeys.forEach(key => {
        const value = playerSkillsData[key as keyof typeof playerSkillsData];
        if (typeof value === 'number') {
          skillsMap[key] = value;
        }
      });
    }

    // 3. Fetch player attributes (flat structure with attribute columns)
    const { data: playerAttributesData } = await supabase
      .from("player_attributes")
      .select("charisma, looks, mental_focus, musicality, physical_endurance, stage_presence, crowd_engagement, social_reach")
      .eq("profile_id", profileId)
      .single();

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

    // 4. Calculate career stats (using RPC or simple count)
    const songCount = 0;
    const gigCount = 0;
    const albumCount = 0;

    // 5. Get peak chart position
    const { data: chartData } = await supabase
      .from("chart_entries")
      .select("rank")
      .order("rank", { ascending: true })
      .limit(1);

    const peakPosition = chartData?.[0]?.rank || null;

    // 6. Get current generation number
    const { data: generations } = await supabase
      .from("character_generations")
      .select("generation_number")
      .eq("user_id", userId)
      .order("generation_number", { ascending: false })
      .limit(1);

    const currentGeneration = generations?.[0]?.generation_number || 1;

    // 7. Calculate inheritance
    const inheritance = calculateInheritance(profile.cash || 0, skillsMap);

    // 8. Create hall of fame entry
    const { data: hofEntry, error: hofError } = await supabase
      .from("hall_of_fame")
      .insert({
        user_id: userId,
        character_name: profile.display_name || profile.username || "Unknown Artist",
        avatar_url: profile.avatar_url,
        final_age: profile.age || 80,
        years_active: (profile.age || 80) - 16,
        total_fame: profile.fame || 0,
        total_cash_earned: profile.cash || 0,
        total_songs: songCount || 0,
        total_gigs: gigCount || 0,
        total_albums: albumCount || 0,
        peak_chart_position: peakPosition,
        notable_achievements: [],
        final_skills: skillsMap,
        final_attributes: attributesMap,
        retirement_type: retirementType,
        generation_number: currentGeneration,
      })
      .select()
      .single();

    if (hofError) {
      console.error("Hall of fame insert error:", hofError);
      return { success: false, error: "Failed to create hall of fame entry" };
    }

    // 9. Create character generation record
    await supabase.from("character_generations").insert({
      user_id: userId,
      generation_number: currentGeneration + 1,
      parent_character_id: hofEntry.id,
      inherited_cash: inheritance.cash,
      inherited_skills: inheritance.skills,
    });

    // 10. Reset profile for new character
    await supabase
      .from("profiles")
      .update({
        display_name: null,
        avatar_url: null,
        bio: null,
        age: 16,
        fame: 0,
        cash: inheritance.cash,
        experience: 0,
        level: 1,
        health: 100,
        energy: 100,
        last_retirement_prompt_age: 0,
        character_birth_date: null,
      })
      .eq("id", profileId);

    // 11. Reset or apply inherited skills
    if (Object.keys(inheritance.skills).length > 0) {
      await supabase
        .from("player_skills")
        .update({
          vocals: inheritance.skills.vocals || 0,
          guitar: inheritance.skills.guitar || 0,
          bass: inheritance.skills.bass || 0,
          drums: inheritance.skills.drums || 0,
          songwriting: inheritance.skills.songwriting || 0,
          performance: inheritance.skills.performance || 0,
          creativity: inheritance.skills.creativity || 0,
          technical: inheritance.skills.technical || 0,
          composition: inheritance.skills.composition || 0,
        })
        .eq("user_id", userId);
    }

    return {
      success: true,
      hallOfFameId: hofEntry.id,
      inheritance: {
        inheritedCash: inheritance.cash,
        inheritedSkills: inheritance.skills,
        generationNumber: currentGeneration + 1,
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
