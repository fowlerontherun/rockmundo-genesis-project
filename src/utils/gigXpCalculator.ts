import { supabase } from "@/integrations/supabase/client";

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

// XP calculation constants
const BASE_XP_PER_SONG = 15;
const ATTENDANCE_XP_DIVISOR = 20; // XP = attendance / 20
const PERFORMANCE_GRADE_MULTIPLIERS: Record<string, number> = {
  'S+': 2.5,
  'S': 2.0,
  'A': 1.6,
  'B': 1.3,
  'C': 1.0,
  'D': 0.8,
  'F': 0.5,
};

/**
 * Calculate XP for all band members after a gig
 */
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

  // Fetch band members (non-touring)
  const { data: members, error: membersError } = await supabase
    .from('band_members')
    .select('user_id, instrument_role')
    .eq('band_id', bandId)
    .eq('is_touring_member', false);

  if (membersError) throw membersError;
  if (!members || members.length === 0) {
    return { totalXpAwarded: 0, playerResults: [], xpBreakdown: { baseXp: 0, performanceBonus: 0, crowdBonus: 0, milestoneBonus: 0 } };
  }

  // Fetch profiles for members
  const userIds = members.map(m => m.user_id).filter(Boolean) as string[];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, user_id')
    .in('user_id', userIds);

  const profileMap = new Map(profiles?.map(p => [p.user_id, p.id]) || []);

  // Fetch existing gig count for each member (for milestone checks)
  const { data: existingGigXp } = await supabase
    .from('player_gig_xp')
    .select('user_id')
    .in('user_id', userIds);

  const gigCountMap = new Map<string, number>();
  existingGigXp?.forEach(xp => {
    gigCountMap.set(xp.user_id, (gigCountMap.get(xp.user_id) || 0) + 1);
  });

  // Fetch milestones
  const { data: milestones } = await supabase
    .from('gig_milestones')
    .select('*');

  // Fetch already achieved milestones
  const { data: achievedMilestones } = await supabase
    .from('player_gig_milestones')
    .select('user_id, milestone_id')
    .in('user_id', userIds);

  const achievedMap = new Map<string, Set<string>>();
  achievedMilestones?.forEach(am => {
    if (!achievedMap.has(am.user_id)) {
      achievedMap.set(am.user_id, new Set());
    }
    achievedMap.get(am.user_id)!.add(am.milestone_id);
  });

  // Calculate XP for each member
  const gradeMultiplier = PERFORMANCE_GRADE_MULTIPLIERS[performanceGrade] || 1.0;
  const attendanceRatio = actualAttendance / venueCapacity;

  // Base XP calculation
  const baseXp = Math.round(BASE_XP_PER_SONG * songCount);
  
  // Performance bonus based on rating (0-25 scale)
  const performanceBonusXp = Math.round(overallRating * 4); // Max ~100 XP
  
  // Crowd bonus based on attendance
  const crowdBonusXp = Math.round(actualAttendance / ATTENDANCE_XP_DIVISOR);

  const playerResults: PlayerGigXpResult[] = [];
  let totalMilestoneBonus = 0;

  for (const member of members) {
    if (!member.user_id) continue;

    const currentGigCount = (gigCountMap.get(member.user_id) || 0) + 1;
    const alreadyAchieved = achievedMap.get(member.user_id) || new Set();
    
    // Check for new milestones
    const newMilestones: string[] = [];
    let milestoneBonusXp = 0;

    for (const milestone of milestones || []) {
      if (alreadyAchieved.has(milestone.id)) continue;

      let earned = false;
      switch (milestone.milestone_type) {
        case 'streak':
          earned = currentGigCount >= milestone.threshold_value;
          break;
        case 'attendance':
          earned = actualAttendance >= milestone.threshold_value;
          break;
        case 'performance':
          earned = overallRating >= milestone.threshold_value;
          break;
        case 'revenue':
          earned = netProfit >= milestone.threshold_value;
          break;
      }

      if (earned) {
        newMilestones.push(milestone.name);
        milestoneBonusXp += milestone.xp_reward;
        
        // Insert milestone achievement
        await supabase
          .from('player_gig_milestones')
          .insert({
            user_id: member.user_id,
            milestone_id: milestone.id,
            gig_id: gigId,
          });
      }
    }

    totalMilestoneBonus += milestoneBonusXp;

    // Calculate total XP with multiplier
    const rawTotal = baseXp + performanceBonusXp + crowdBonusXp + milestoneBonusXp;
    const totalXp = Math.round(rawTotal * gradeMultiplier);

    // Determine skill improvement based on instrument role
    const skillMapping: Record<string, string> = {
      'lead_guitar': 'guitar',
      'rhythm_guitar': 'guitar',
      'bass': 'bass',
      'drums': 'drums',
      'vocals': 'vocals',
      'keys': 'technical',
      'keyboard': 'technical',
    };
    const skillTypeImproved = skillMapping[member.instrument_role || ''] || 'performance';
    const skillImprovementAmount = performanceGrade === 'S+' ? 2 : performanceGrade === 'S' || performanceGrade === 'A' ? 1 : 0;

    const result: PlayerGigXpResult = {
      userId: member.user_id,
      profileId: profileMap.get(member.user_id) || null,
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

    // Insert player gig XP record
    await supabase
      .from('player_gig_xp')
      .insert({
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

    // Update player profile XP
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

    // Update skill progress if earned improvement
    if (skillImprovementAmount > 0 && member.user_id && skillTypeImproved) {
      // Look up profile_id for skill_progress
      const { data: memberProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', member.user_id)
        .maybeSingle();

      if (memberProfile?.id) {
        const { data: existingSkill } = await supabase
          .from('skill_progress')
          .select('id, current_level, current_xp, required_xp')
          .eq('profile_id', memberProfile.id)
          .eq('skill_slug', skillTypeImproved)
          .maybeSingle();

        if (existingSkill) {
          // Add XP to existing skill progress
          const xpGain = skillImprovementAmount * 10; // Convert to XP
          await supabase
            .from('skill_progress')
            .update({ current_xp: (existingSkill.current_xp || 0) + xpGain })
            .eq('id', existingSkill.id);
        } else {
          // Create new skill progress entry
          await supabase
            .from('skill_progress')
            .insert({
              profile_id: memberProfile.id,
              skill_slug: skillTypeImproved,
              current_level: 0,
              current_xp: skillImprovementAmount * 10,
              required_xp: 100,
            });
        }
      }
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
