import { supabase } from "@/integrations/supabase/client";

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

function getRelevantSkillLevel(skills: PlayerSkills, instrumentRole: string): number {
  const role = instrumentRole.toLowerCase();
  
  if (role.includes('guitar') && !role.includes('bass')) return skills.guitar || 1;
  if (role.includes('bass')) return skills.bass || 1;
  if (role.includes('drum')) return skills.drums || 1;
  if (role.includes('vocal') || role.includes('sing')) return skills.vocals || 1;
  if (role.includes('keyboard') || role.includes('piano')) return skills.technical || 1;
  
  return skills.performance || 1;
}

function detectRoleMismatch(skills: PlayerSkills, instrumentRole: string): boolean {
  const roleSkill = getRelevantSkillLevel(skills, instrumentRole);
  const maxSkill = Math.max(
    skills.guitar,
    skills.bass,
    skills.drums,
    skills.vocals,
    skills.technical
  );
  
  return roleSkill < maxSkill * 0.7;
}

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
      let mismatchPenalty = 1.0;

      if (member.is_touring_member && member.touring_member_tier) {
        relevantSkillLevel = getRandomSkillForTier(member.touring_member_tier);
      } else if (member.user_id) {
        const { data: skills } = await supabase
          .from('player_skills')
          .select('*')
          .eq('user_id', member.user_id)
          .single();

        if (skills) {
          relevantSkillLevel = getRelevantSkillLevel(skills as PlayerSkills, member.instrument_role);
          if (detectRoleMismatch(skills as PlayerSkills, member.instrument_role)) {
            mismatchPenalty = 0.4;
          }
        }
      }

      const memberScore = relevantSkillLevel * mismatchPenalty;
      totalScore += memberScore;
      memberCount++;

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
