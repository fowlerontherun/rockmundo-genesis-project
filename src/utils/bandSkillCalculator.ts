import { supabase } from "@/integrations/supabase/client";
import { ROLE_SKILL_MAP, calculatePerformanceModifiers } from "./skillGearPerformance";

export interface BandMember {
  id: string;
  user_id: string | null;
  band_id: string;
  instrument_role: string;
  vocal_role: string | null;
  is_touring_member: boolean;
  touring_member_tier: number | null;
  joined_at: string;
}

export interface PlayerSkills {
  guitar: number;
  bass: number;
  drums: number;
  vocals: number;
  technical: number;
  composition: number;
  performance: number;
  songwriting: number;
  creativity: number;
}

const TOURING_MEMBER_SKILL_RANGES: Record<number, [number, number]> = {
  1: [20, 40],
  2: [41, 60],
  3: [61, 80],
  4: [81, 100],
  5: [101, 150],
};

function getRandomSkillForTier(tier: number): number {
  const range = TOURING_MEMBER_SKILL_RANGES[tier] || [20, 40];
  return Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
}

/**
 * Calculate band skill rating using the skill_progress table (skill tree)
 * instead of the legacy player_skills table.
 */
export async function calculateBandSkillRating(
  bandId: string,
  chemistryLevel: number = 0
): Promise<number> {
  try {
    const { data: members, error: membersError } = await supabase
      .from('band_members')
      .select('*')
      .eq('band_id', bandId);

    if (membersError || !members || members.length === 0) {
      console.error('Error fetching band members:', membersError);
      return 0;
    }

    let totalScore = 0;
    let memberCount = 0;

    for (const member of members) {
      let relevantSkillLevel = 0;

      if (member.is_touring_member && member.touring_member_tier) {
        // Touring members use tier-based random skill
        relevantSkillLevel = getRandomSkillForTier(member.touring_member_tier);
      } else if (member.user_id) {
        // Player members: look up profile_id then use skill_progress via calculatePerformanceModifiers
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', member.user_id)
          .single();

        if (profile) {
          const modifiers = await calculatePerformanceModifiers(
            profile.id,
            member.instrument_role || 'Vocals'
          );
          // effectiveLevel already includes gear bonus
          relevantSkillLevel = modifiers.effectiveLevel;
        }
      }

      const memberScore = relevantSkillLevel;
      totalScore += memberScore;
      memberCount++;

      // Update skill_contribution on band_members with the new value
      await supabase
        .from('band_members')
        .update({ skill_contribution: Math.round(memberScore) })
        .eq('id', member.id);
    }

    const averageSkill = totalScore / Math.max(1, memberCount);
    const chemistryBonus = 1 + (chemistryLevel / 200);
    
    return Math.round(averageSkill * chemistryBonus);
  } catch (error) {
    console.error('Error calculating band skill rating:', error);
    return 0;
  }
}
