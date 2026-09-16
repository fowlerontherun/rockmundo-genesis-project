import { supabase } from "@/integrations/supabase/client";
import { applyLearningMultiplier } from "./skillLearningMultiplier";

export interface GigXpCalculationInput {
  gigId: string;
  bandId: string;
  overallRating: number;
  actualAttendance: number;
  venueCapacity: number;
  netProfit: number;
  performanceGrade: string;
  songCount: number;
}

export interface PlayerGigXpResult {
  userId: string;
  profileId: string | null;
  baseXp: number;
  performanceBonusXp: number;
  crowdBonusXp: number;
  milestoneBonusXp: number;
  totalXp: number;
  xpMultiplier: number;
  skillTypeImproved: string | null;
  skillImprovementAmount: number;
  milestonesUnlocked: string[];
}

export interface GigXpSummary {
  totalXpAwarded: number;
  playerResults: PlayerGigXpResult[];
  xpBreakdown: {
    baseXp: number;
    performanceBonus: number;
    crowdBonus: number;
    milestoneBonus: number;
  };
}

const BASE_XP_PER_SONG = 20;
const ATTENDANCE_XP_DIVISOR = 15;
const PERFORMANCE_GRADE_MULTIPLIERS: Record<string, number> = {
  'S+': 2.5,
  'S': 2.0,
  'A': 1.6,
  'B': 1.3,
  'C': 1.0,
  'D': 0.8,
  'F': 0.5,
};

const getSkillMaxLevel = async (skillSlug: string): Promise<number> => {
  const { data, error } = await (supabase as any).rpc("progression_skill_max_level", {
    p_skill_slug: skillSlug,
  });
  if (error) throw error;
  const value = Number(data);
  return Number.isFinite(value) && value > 0 ? value : 20;
};

const getRequiredSkillXp = async (level: number): Promise<number> => {
  const { data, error } = await (supabase as any).rpc("progression_skill_required_xp", {
    p_level: level,
  });
  if (error) throw error;
  const value = Number(data);
  return Number.isFinite(value) && value > 0 ? value : 100;
};

const awardGigSkillXp = async (profileId: string, skillSlug: string, amount: number) => {
  if (amount <= 0) return;

  const { data: unlocked, error: unlockError } = await (supabase as any).rpc("skill_tier_unlocked", {
    p_profile_id: profileId,
    p_slug: skillSlug,
  });
  if (unlockError) throw unlockError;
  if (unlocked === false) return;

  const maxLevel = await getSkillMaxLevel(skillSlug);
  const { data: existing, error: loadError } = await supabase
    .from('skill_progress')
    .select('id, current_level, current_xp, required_xp')
    .eq('profile_id', profileId)
    .eq('skill_slug', skillSlug)
    .maybeSingle();
  if (loadError) throw loadError;

  let level = Math.min(Math.max(Number(existing?.current_level ?? 0), 0), maxLevel);
  let currentXp = Math.max(Number(existing?.current_xp ?? 0), 0);
  let requiredXp = Number(existing?.required_xp ?? 0);

  if (level < maxLevel) {
    if (requiredXp <= 0) requiredXp = await getRequiredSkillXp(level);
    currentXp += amount;
    while (level < maxLevel && currentXp >= requiredXp) {
      currentXp -= requiredXp;
      level += 1;
      requiredXp = level < maxLevel ? await getRequiredSkillXp(level) : 0;
    }
  }

  if (level >= maxLevel) {
    level = maxLevel;
    currentXp = 0;
    requiredXp = 0;
  }

  if (existing) {
    const { error } = await supabase
      .from('skill_progress')
      .update({
        current_level: level,
        current_xp: currentXp,
        required_xp: requiredXp,
        last_practiced_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('skill_progress')
      .insert({
        profile_id: profileId,
        skill_slug: skillSlug,
        current_level: level,
        current_xp: currentXp,
        required_xp: requiredXp,
        last_practiced_at: new Date().toISOString(),
      });
    if (error) throw error;
  }
};

/** Calculate XP for all band members after a gig. */
export async function calculateGigXp(input: GigXpCalculationInput): Promise<GigXpSummary> {
  const {
    gigId,
    bandId,
    overallRating,
    actualAttendance,
    venueCapacity,
    netProfit,
    performanceGrade,
    songCount,
  } = input;

  const { data: members, error: membersError } = await supabase
    .from('band_members')
    .select('user_id, profile_id, instrument_role')
    .eq('band_id', bandId)
    .eq('is_touring_member', false);

  if (membersError) throw membersError;
  if (!members || members.length === 0) {
    return { totalXpAwarded: 0, playerResults: [], xpBreakdown: { baseXp: 0, performanceBonus: 0, crowdBonus: 0, milestoneBonus: 0 } };
  }

  const userIds = members.map(m => m.user_id).filter(Boolean) as string[];

  const { data: existingGigXp } = await supabase
    .from('player_gig_xp')
    .select('user_id')
    .in('user_id', userIds);

  const gigCountMap = new Map<string, number>();
  existingGigXp?.forEach(xp => {
    gigCountMap.set(xp.user_id, (gigCountMap.get(xp.user_id) || 0) + 1);
  });

  const { data: milestones } = await supabase
    .from('gig_milestones')
    .select('*');

  const { data: achievedMilestones } = await supabase
    .from('player_gig_milestones')
    .select('user_id, milestone_id')
    .in('user_id', userIds);

  const achievedMap = new Map<string, Set<string>>();
  achievedMilestones?.forEach(am => {
    if (!achievedMap.has(am.user_id)) achievedMap.set(am.user_id, new Set());
    achievedMap.get(am.user_id)!.add(am.milestone_id);
  });

  const gradeMultiplier = PERFORMANCE_GRADE_MULTIPLIERS[performanceGrade] || 1.0;
  const baseXp = Math.round(BASE_XP_PER_SONG * songCount);
  const performanceBonusXp = Math.round(overallRating * 4);
  const crowdBonusXp = Math.round(actualAttendance / ATTENDANCE_XP_DIVISOR);

  const playerResults: PlayerGigXpResult[] = [];
  let totalMilestoneBonus = 0;

  for (const member of members) {
    if (!member.user_id) continue;

    const currentGigCount = (gigCountMap.get(member.user_id) || 0) + 1;
    const alreadyAchieved = achievedMap.get(member.user_id) || new Set();
    const newMilestones: string[] = [];
    let milestoneBonusXp = 0;

    for (const milestone of milestones || []) {
      if (alreadyAchieved.has(milestone.id)) continue;

      let earned = false;
      switch (milestone.milestone_type) {
        case 'streak': earned = currentGigCount >= milestone.threshold_value; break;
        case 'attendance': earned = actualAttendance >= milestone.threshold_value; break;
        case 'performance': earned = overallRating >= milestone.threshold_value; break;
        case 'revenue': earned = netProfit >= milestone.threshold_value; break;
      }

      if (earned) {
        newMilestones.push(milestone.name);
        milestoneBonusXp += milestone.xp_reward;
        await supabase.from('player_gig_milestones').insert({
          user_id: member.user_id,
          milestone_id: milestone.id,
          gig_id: gigId,
        });
      }
    }

    totalMilestoneBonus += milestoneBonusXp;

    const rawTotal = baseXp + performanceBonusXp + crowdBonusXp + milestoneBonusXp;
    const totalXp = Math.round(rawTotal * gradeMultiplier);

    const skillMapping: Record<string, string> = {
      'lead_guitar': 'guitar',
      'rhythm_guitar': 'guitar',
      'bass': 'bass',
      'drums': 'drums',
      'vocals': 'vocals',
      'keys': 'basic_keyboard',
      'keyboard': 'basic_keyboard',
    };
    const skillTypeImproved = skillMapping[member.instrument_role || ''] || 'performance';
    const skillImprovementAmount = performanceGrade === 'S+' ? 2 : performanceGrade === 'S' || performanceGrade === 'A' ? 1 : 0;

    const result: PlayerGigXpResult = {
      userId: member.user_id,
      profileId: member.profile_id || null,
      baseXp,
      performanceBonusXp,
      crowdBonusXp,
      milestoneBonusXp,
      totalXp,
      xpMultiplier: gradeMultiplier,
      skillTypeImproved: skillImprovementAmount > 0 ? skillTypeImproved : null,
      skillImprovementAmount,
      milestonesUnlocked: newMilestones,
    };

    playerResults.push(result);

    await supabase.from('player_gig_xp').insert({
      gig_id: gigId,
      user_id: member.user_id,
      profile_id: result.profileId,
      band_id: bandId,
      base_xp: baseXp,
      performance_bonus_xp: performanceBonusXp,
      crowd_bonus_xp: crowdBonusXp,
      milestone_bonus_xp: milestoneBonusXp,
      total_xp: totalXp,
      xp_multiplier: gradeMultiplier,
      attendance_count: actualAttendance,
      performance_rating: Math.round(overallRating),
      skill_type_improved: result.skillTypeImproved,
      skill_improvement_amount: skillImprovementAmount,
    });

    if (result.profileId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('experience')
        .eq('id', result.profileId)
        .single();

      if (profile) {
        await supabase
          .from('profiles')
          .update({ experience: (profile.experience || 0) + totalXp })
          .eq('id', result.profileId);
      }
    }

    if (skillImprovementAmount > 0 && result.profileId && skillTypeImproved) {
      const { data: attrs } = await supabase
        .from('player_attributes')
        .select('*')
        .eq('profile_id', result.profileId)
        .maybeSingle();

      const baseSkillXp = skillImprovementAmount * 10;
      const { xp: boostedXp } = applyLearningMultiplier(baseSkillXp, skillTypeImproved, attrs);
      await awardGigSkillXp(result.profileId, skillTypeImproved, boostedXp);
    }
  }

  const totalXpAwarded = playerResults.reduce((sum, r) => sum + r.totalXp, 0);

  return {
    totalXpAwarded,
    playerResults,
    xpBreakdown: {
      baseXp,
      performanceBonus: performanceBonusXp,
      crowdBonus: crowdBonusXp,
      milestoneBonus: totalMilestoneBonus,
    },
  };
}
