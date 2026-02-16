/**
 * Centralized skill and gear performance calculation utility.
 * Factors in skill levels and equipped gear bonuses for performance calculations.
 */

import { supabase } from "@/integrations/supabase/client";
import { getTieredBonusPercent } from "./tieredSkillBonus";

export interface SkillProgressEntry {
  skill_slug: string;
  current_level: number | null;
}

export interface GearBonusEntry {
  skill_slug: string;
  bonus_multiplier: number;
}

export interface PerformanceModifiers {
  skillLevel: number;        // 0-100 scale
  gearMultiplier: number;    // 1.0 to 1.5+
  effectiveLevel: number;    // skillLevel * gearMultiplier
  breakdown: {
    baseSkill: number;
    gearBonus: number;
    totalBonus: number;
  };
}

// Map band roles to relevant skill slugs
export const ROLE_SKILL_MAP: Record<string, string[]> = {
  "Lead Guitar": [
    "instruments_basic_electric_guitar",
    "instruments_professional_electric_guitar",
    "instruments_mastery_electric_guitar",
    "instruments_basic_acoustic_guitar",
    "instruments_professional_acoustic_guitar"
  ],
  "Rhythm Guitar": [
    "instruments_basic_acoustic_guitar",
    "instruments_professional_acoustic_guitar",
    "instruments_basic_electric_guitar",
    "instruments_professional_electric_guitar"
  ],
  "Bass": [
    "instruments_basic_bass_guitar",
    "instruments_professional_bass_guitar",
    "instruments_mastery_bass_guitar",
    "instruments_basic_upright_bass",
    "instruments_professional_upright_bass"
  ],
  "Drums": [
    "instruments_basic_rock_drums",
    "instruments_professional_rock_drums",
    "instruments_mastery_rock_drums",
    "instruments_basic_jazz_drums",
    "instruments_professional_jazz_drums"
  ],
  "Vocals": [
    "instruments_basic_vocal_performance",
    "instruments_professional_vocal_performance",
    "instruments_mastery_vocal_performance"
  ],
  "Lead Vocals": [
    "instruments_basic_vocal_performance",
    "instruments_professional_vocal_performance",
    "instruments_mastery_vocal_performance",
    "instruments_mastery_lead_vocals"
  ],
  "Keys": [
    "instruments_basic_classical_piano",
    "instruments_professional_classical_piano",
    "instruments_basic_jazz_piano",
    "instruments_professional_jazz_piano",
    "instruments_basic_rhodes",
    "instruments_professional_rhodes"
  ],
  "Keyboard": [
    "instruments_basic_classical_piano",
    "instruments_professional_classical_piano",
    "instruments_basic_analog_synth",
    "instruments_professional_analog_synth"
  ],
  "Synth": [
    "instruments_basic_analog_synth",
    "instruments_professional_analog_synth",
    "instruments_mastery_analog_synth",
    "instruments_basic_digital_synth",
    "instruments_professional_digital_synth"
  ],
  "DJ": [
    "instruments_basic_turntablism",
    "instruments_professional_turntablism",
    "instruments_mastery_turntablism",
    "instruments_basic_push_launchpad",
    "instruments_professional_push_launchpad"
  ],
  "Saxophone": [
    "instruments_basic_alto_sax",
    "instruments_professional_alto_sax",
    "instruments_basic_tenor_sax",
    "instruments_professional_tenor_sax"
  ],
  "Trumpet": [
    "instruments_basic_trumpet",
    "instruments_professional_trumpet",
    "instruments_mastery_trumpet"
  ],
  "Trombone": [
    "instruments_basic_trombone",
    "instruments_professional_trombone",
    "instruments_mastery_trombone"
  ],
  "Violin": [
    "instruments_basic_violin",
    "instruments_professional_violin",
    "instruments_mastery_violin"
  ],
  "Cello": [
    "instruments_basic_cello",
    "instruments_professional_cello",
    "instruments_mastery_cello"
  ],
  "Percussion": [
    "instruments_basic_latin_percussion",
    "instruments_professional_latin_percussion",
    "instruments_basic_cajon",
    "instruments_professional_cajon"
  ]
};

// Equipment categories that map to skill types
export const EQUIPMENT_SKILL_CATEGORIES: Record<string, string[]> = {
  "guitar": ["acoustic_guitar", "electric_guitar", "classical_guitar"],
  "acoustic_guitar": ["acoustic_guitar", "12_string_guitar"],
  "electric_guitar": ["electric_guitar", "lead_guitar"],
  "bass": ["bass_guitar", "upright_bass"],
  "keyboard": ["classical_piano", "jazz_piano", "rhodes", "wurlitzer"],
  "synth": ["analog_synth", "digital_synth", "eurorack"],
  "drums": ["rock_drums", "jazz_drums", "electronic_drums"],
  "percussion": ["latin_percussion", "african_drums", "cajon", "tabla"],
  "microphone": ["vocal_performance"],
  "wind": ["flute", "clarinet", "saxophone"],
  "brass": ["trumpet", "trombone", "french_horn"],
  "strings": ["violin", "viola", "cello"],
  "dj": ["turntablism", "push_launchpad", "mpc"]
};

/**
 * Get skill level from skill_progress entries
 */
function getSkillLevelFromProgress(
  progress: SkillProgressEntry[],
  skillSlugs: string[]
): number {
  let maxLevel = 0;
  let totalLevel = 0;
  let count = 0;

  for (const slug of skillSlugs) {
    const entry = progress.find(p => p.skill_slug === slug);
    if (entry && entry.current_level != null) {
      const level = Math.min(100, Math.max(0, entry.current_level));
      maxLevel = Math.max(maxLevel, level);
      totalLevel += level;
      count++;
    }
  }

  // Weight towards max level but consider average
  if (count === 0) return 0;
  const avgLevel = totalLevel / count;
  const blendedLevel = Math.round(maxLevel * 0.6 + avgLevel * 0.4);

  // Apply tiered scaling: raw level → tiered bonus percentage → scale to 0-100
  // At level 20 (mastered), tiered bonus is ~28%, which maps to score 100
  const tieredPercent = getTieredBonusPercent(blendedLevel);
  // Scale: 28% tiered → 100 score (full mastery)
  return Math.min(100, Math.round((tieredPercent / 28) * 100));
}

/**
 * Calculate gear bonus multiplier from equipped items
 */
function calculateGearBonus(
  gearBonuses: GearBonusEntry[],
  relevantSkills: string[]
): number {
  let totalBonus = 0;
  let matchCount = 0;

  for (const bonus of gearBonuses) {
    // Check if the gear bonus matches any of the relevant skills
    const skillBase = bonus.skill_slug.replace(/^instruments_(basic|professional|mastery)_/, '');
    for (const skill of relevantSkills) {
      const targetBase = skill.replace(/^instruments_(basic|professional|mastery)_/, '');
      if (skillBase === targetBase || skill.includes(skillBase) || skillBase.includes(targetBase.substring(0, 6))) {
        totalBonus += bonus.bonus_multiplier;
        matchCount++;
        break;
      }
    }
  }

  // Cap total gear bonus at 50%
  const gearMultiplier = 1 + Math.min(0.5, totalBonus);
  return Number(gearMultiplier.toFixed(2));
}

/**
 * Helper to check if equipment category matches a role
 */
function doesCategoryMatchRole(category: string, subcategory: string | null, role: string): boolean {
  const roleCategories: Record<string, string[]> = {
    "Lead Guitar": ["guitar", "electric_guitar"],
    "Rhythm Guitar": ["guitar", "acoustic_guitar", "electric_guitar"],
    "Bass": ["bass"],
    "Drums": ["drums"],
    "Vocals": ["microphone"],
    "Lead Vocals": ["microphone"],
    "Keys": ["keyboard", "piano"],
    "Keyboard": ["keyboard", "piano", "synth"],
    "Synth": ["synth", "keyboard"],
    "DJ": ["dj", "controller"],
    "Saxophone": ["wind", "saxophone"],
    "Trumpet": ["brass", "trumpet"],
    "Trombone": ["brass", "trombone"],
    "Violin": ["strings", "violin"],
    "Cello": ["strings", "cello"],
    "Percussion": ["percussion", "drums"]
  };

  const validCategories = roleCategories[role] || [];
  const catLower = category.toLowerCase();
  const subLower = (subcategory || "").toLowerCase();

  return validCategories.some(vc => 
    catLower.includes(vc) || subLower.includes(vc) || vc.includes(catLower)
  );
}

/**
 * Calculate performance modifiers for a profile based on role
 */
export async function calculatePerformanceModifiers(
  profileId: string,
  role: string
): Promise<PerformanceModifiers> {
  const defaultResult: PerformanceModifiers = {
    skillLevel: 50,
    gearMultiplier: 1.0,
    effectiveLevel: 50,
    breakdown: {
      baseSkill: 50,
      gearBonus: 0,
      totalBonus: 0
    }
  };

  try {
    // Get relevant skills for this role
    const relevantSkills: string[] = [];
    const baseSkills = ROLE_SKILL_MAP[role] || [];
    relevantSkills.push(...baseSkills);
    
    if (relevantSkills.length === 0) {
      // Try to find partial match
      const roleKey = Object.keys(ROLE_SKILL_MAP).find(k => 
        role.toLowerCase().includes(k.toLowerCase()) || 
        k.toLowerCase().includes(role.toLowerCase())
      );
      if (roleKey) {
        relevantSkills.push(...ROLE_SKILL_MAP[roleKey]);
      }
    }

    // Fetch skill progress - use explicit typing to avoid TS2589
    const skillQuery = supabase
      .from('skill_progress')
      .select('skill_slug, current_level')
      .eq('profile_id', profileId);
    
    if (relevantSkills.length > 0) {
      skillQuery.in('skill_slug', relevantSkills);
    }

    const { data: skillProgressData, error: skillError } = await skillQuery;
    const skillProgress = (skillProgressData || []) as SkillProgressEntry[];

    if (skillError) {
      console.error('Error fetching skill progress:', skillError);
      return defaultResult;
    }

    const skillLevel = getSkillLevelFromProgress(skillProgress, relevantSkills);

    // Fetch equipped gear - use any to bypass TS2589 complex type inference
    let playerEquipment: Array<{ equipment_id: string; is_equipped: boolean }> = [];
    let equipError: Error | null = null;
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const query = (supabase as any)
        .from('player_equipment')
        .select('equipment_id, is_equipped')
        .eq('user_id', profileId)
        .eq('is_equipped', true);
      
      const result = await query;
      playerEquipment = (result.data || []) as typeof playerEquipment;
      equipError = result.error;
    } catch (e) {
      equipError = e as Error;
    }

    if (equipError) {
      console.error('Error fetching equipment:', equipError);
    }

    let gearMultiplier = 1.0;

    if (playerEquipment.length > 0) {
      const equipmentIds = playerEquipment.map(pe => pe.equipment_id);
      
      // Get equipment items - use explicit typing
      const { data: itemsData } = await supabase
        .from('equipment_items')
        .select('id, name, category, subcategory, rarity, stat_boosts')
        .in('id', equipmentIds);

      const items = (itemsData || []) as Array<{
        id: string;
        name: string;
        category: string;
        subcategory: string | null;
        rarity: string | null;
        stat_boosts: Record<string, number> | null;
      }>;

      if (items.length > 0) {
        // Calculate gear bonus based on rarity and stat_boosts
        const rarityBonuses: Record<string, number> = {
          'common': 0.05,
          'uncommon': 0.10,
          'rare': 0.18,
          'epic': 0.25,
          'legendary': 0.35
        };

        let totalBonus = 0;
        for (const item of items) {
          const rarityBonus = rarityBonuses[item.rarity || 'common'] || 0.05;
          
          // Check if item matches role (category-based matching)
          const categoryMatches = doesCategoryMatchRole(item.category, item.subcategory, role);
          if (categoryMatches) {
            totalBonus += rarityBonus;
            
            // Add performance stat boost if exists
            if (item.stat_boosts && typeof item.stat_boosts === 'object') {
              const perfBoost = item.stat_boosts['performance'] || 0;
              totalBonus += perfBoost / 100; // Convert to multiplier
            }
          }
        }
        
        gearMultiplier = 1 + Math.min(totalBonus, 0.5); // Cap at 50% bonus
      }
    }

    const effectiveLevel = Math.round(skillLevel * gearMultiplier);
    const gearBonus = effectiveLevel - skillLevel;

    return {
      skillLevel,
      gearMultiplier: Number(gearMultiplier.toFixed(2)),
      effectiveLevel: Math.min(100, effectiveLevel),
      breakdown: {
        baseSkill: skillLevel,
        gearBonus,
        totalBonus: effectiveLevel - 50
      }
    };
  } catch (error) {
    console.error('Error calculating performance modifiers:', error);
    return defaultResult;
  }
}

/**
 * Calculate band-wide skill average from all members
 */
export async function calculateBandSkillAverage(bandId: string): Promise<{
  avgSkill: number;
  avgGearBonus: number;
  memberBreakdown: Array<{ memberId: string; role: string; effectiveLevel: number }>;
}> {
  const defaultResult = { avgSkill: 50, avgGearBonus: 0, memberBreakdown: [] };

  try {
    // Get band members with their roles
    const { data: members, error: memberError } = await supabase
      .from('band_members')
      .select('id, user_id, instrument_role')
      .eq('band_id', bandId)
      .eq('is_touring_member', false);

    if (memberError || !members || members.length === 0) {
      return defaultResult;
    }

    const memberBreakdown: Array<{ memberId: string; role: string; effectiveLevel: number }> = [];
    let totalSkill = 0;
    let totalGearBonus = 0;

    for (const member of members) {
      if (!member.user_id) continue;

      // Get profile for this user
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', member.user_id)
        .single();

      if (!profile) continue;

      const modifiers = await calculatePerformanceModifiers(
        profile.id,
        member.instrument_role || 'Vocals'
      );

      totalSkill += modifiers.effectiveLevel;
      totalGearBonus += modifiers.breakdown.gearBonus;
      memberBreakdown.push({
        memberId: member.id,
        role: member.instrument_role || 'Unknown',
        effectiveLevel: modifiers.effectiveLevel
      });
    }

    const memberCount = memberBreakdown.length || 1;
    return {
      avgSkill: Math.round(totalSkill / memberCount),
      avgGearBonus: Math.round(totalGearBonus / memberCount),
      memberBreakdown
    };
  } catch (error) {
    console.error('Error calculating band skill average:', error);
    return defaultResult;
  }
}

/**
 * Quick skill modifier calculation (0.8 to 1.3 based on skill levels)
 */
export function calculateSkillModifier(skillProgress: SkillProgressEntry[] | null): number {
  if (!skillProgress || skillProgress.length === 0) {
    return 1.0; // Neutral modifier
  }

  let totalLevel = 0;
  let count = 0;

  for (const entry of skillProgress) {
    if (entry.current_level != null) {
      totalLevel += entry.current_level;
      count++;
    }
  }

  if (count === 0) return 1.0;

  const avgLevel = totalLevel / count;
  
  // Apply tiered scaling: avgLevel → tiered bonus → modifier
  // Levels 0-20, tiered curve gives 0-28%, map to 0.8-1.3
  const tieredPercent = getTieredBonusPercent(Math.min(20, avgLevel));
  const modifier = 0.8 + (tieredPercent / 28) * 0.5;
  return Number(Math.min(1.3, Math.max(0.8, modifier)).toFixed(2));
}
