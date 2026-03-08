import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Role → skill slug mapping (mirrors client-side skillGearPerformance.ts) ──
const ROLE_SKILL_MAP: Record<string, string[]> = {
  "Lead Guitar": [
    "instruments_basic_electric_guitar", "instruments_professional_electric_guitar",
    "instruments_mastery_electric_guitar", "instruments_basic_acoustic_guitar",
    "instruments_professional_acoustic_guitar"
  ],
  "Rhythm Guitar": [
    "instruments_basic_acoustic_guitar", "instruments_professional_acoustic_guitar",
    "instruments_basic_electric_guitar", "instruments_professional_electric_guitar"
  ],
  "Bass": [
    "instruments_basic_bass_guitar", "instruments_professional_bass_guitar",
    "instruments_mastery_bass_guitar", "instruments_basic_upright_bass",
    "instruments_professional_upright_bass"
  ],
  "Drums": [
    "instruments_basic_rock_drums", "instruments_professional_rock_drums",
    "instruments_mastery_rock_drums", "instruments_basic_jazz_drums",
    "instruments_professional_jazz_drums"
  ],
  "Vocals": [
    "instruments_basic_vocal_performance", "instruments_professional_vocal_performance",
    "instruments_mastery_vocal_performance"
  ],
  "Lead Vocals": [
    "instruments_basic_vocal_performance", "instruments_professional_vocal_performance",
    "instruments_mastery_vocal_performance", "instruments_mastery_lead_vocals"
  ],
  "Keys": [
    "instruments_basic_classical_piano", "instruments_professional_classical_piano",
    "instruments_basic_jazz_piano", "instruments_professional_jazz_piano",
    "instruments_basic_rhodes", "instruments_professional_rhodes"
  ],
  "Keyboard": [
    "instruments_basic_classical_piano", "instruments_professional_classical_piano",
    "instruments_basic_analog_synth", "instruments_professional_analog_synth"
  ],
  "Synth": [
    "instruments_basic_analog_synth", "instruments_professional_analog_synth",
    "instruments_mastery_analog_synth", "instruments_basic_digital_synth",
    "instruments_professional_digital_synth"
  ],
  "DJ": [
    "instruments_basic_turntablism", "instruments_professional_turntablism",
    "instruments_mastery_turntablism", "instruments_basic_push_launchpad",
    "instruments_professional_push_launchpad"
  ],
  "Saxophone": [
    "instruments_basic_alto_sax", "instruments_professional_alto_sax",
    "instruments_basic_tenor_sax", "instruments_professional_tenor_sax"
  ],
  "Trumpet": [
    "instruments_basic_trumpet", "instruments_professional_trumpet",
    "instruments_mastery_trumpet"
  ],
  "Trombone": [
    "instruments_basic_trombone", "instruments_professional_trombone",
    "instruments_mastery_trombone"
  ],
  "Violin": [
    "instruments_basic_violin", "instruments_professional_violin",
    "instruments_mastery_violin"
  ],
  "Cello": [
    "instruments_basic_cello", "instruments_professional_cello",
    "instruments_mastery_cello"
  ],
  "Percussion": [
    "instruments_basic_latin_percussion", "instruments_professional_latin_percussion",
    "instruments_basic_cajon", "instruments_professional_cajon"
  ]
};

// Rarity → gear bonus multiplier
const RARITY_BONUSES: Record<string, number> = {
  common: 0.05, uncommon: 0.10, rare: 0.18, epic: 0.25, legendary: 0.35
};

// ── Tiered bonus (matches client-side tieredSkillBonus.ts) ──
function getTieredBonusPercent(level: number): number {
  if (level <= 0) return 0;
  if (level >= 20) return 28;
  // Quadratic curve: grows slowly at first, faster at higher levels
  return (level / 20) * (level / 20) * 28;
}

function getSkillLevelFromProgress(
  progress: Array<{ skill_slug: string; current_level: number | null }>,
  skillSlugs: string[]
): number {
  let maxLevel = 0;
  let totalLevel = 0;
  let count = 0;
  for (const slug of skillSlugs) {
    const entry = progress.find(p => p.skill_slug === slug);
    if (entry?.current_level != null) {
      const level = Math.min(100, Math.max(0, entry.current_level));
      maxLevel = Math.max(maxLevel, level);
      totalLevel += level;
      count++;
    }
  }
  if (count === 0) return 0;
  const avgLevel = totalLevel / count;
  const blendedLevel = Math.round(maxLevel * 0.6 + avgLevel * 0.4);
  const tieredPercent = getTieredBonusPercent(blendedLevel);
  return Math.min(100, Math.round((tieredPercent / 28) * 100));
}

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
  return validCategories.some(vc => catLower.includes(vc) || subLower.includes(vc) || vc.includes(catLower));
}

// ── Stage Behavior Modifiers (mirrored from client stageBehaviors.ts) ──

const BEHAVIOR_MODIFIERS: Record<string, { baseBonus: number; varianceMult: number; chemMult: number; crowdMult: number }> = {
  standard:    { baseBonus: 0,   varianceMult: 0.9,  chemMult: 1.0,  crowdMult: 1.0  },
  aggressive:  { baseBonus: 8,   varianceMult: 1.3,  chemMult: 0.9,  crowdMult: 1.25 },
  confident:   { baseBonus: 5,   varianceMult: 1.0,  chemMult: 0.95, crowdMult: 1.0  },
  arrogant:    { baseBonus: 3,   varianceMult: 1.0,  chemMult: 0.8,  crowdMult: 0.95 },
  friendly:    { baseBonus: 0,   varianceMult: 0.85, chemMult: 1.2,  crowdMult: 1.1  },
  nervous:     { baseBonus: -8,  varianceMult: 1.4,  chemMult: 1.0,  crowdMult: 0.9  },
  legendary:   { baseBonus: 12,  varianceMult: 1.2,  chemMult: 0.85, crowdMult: 1.2  },
  enigmatic:   { baseBonus: 0,   varianceMult: 0.7,  chemMult: 1.0,  crowdMult: 0.85 },
  chaotic:     { baseBonus: 15,  varianceMult: 1.6,  chemMult: 0.75, crowdMult: 1.3  },
  virtuoso:    { baseBonus: 10,  varianceMult: 0.75, chemMult: 1.15, crowdMult: 0.9  },
  provocateur: { baseBonus: 0,   varianceMult: 1.25, chemMult: 0.7,  crowdMult: 1.25 },
  zen:         { baseBonus: 0,   varianceMult: 0.6,  chemMult: 1.25, crowdMult: 0.85 },
};

function getBehaviorMods(key: string) {
  return BEHAVIOR_MODIFIERS[key] || BEHAVIOR_MODIFIERS.standard;
}

// ── Interfaces ──

interface PerformanceFactors {
  songQuality: number;
  rehearsalLevel: number;
  bandChemistry: number;
  equipmentQuality: number;
  crewSkillLevel: number;
  memberSkillAverage: number;
  stageSkillAverage: number;
  venueCapacityUsed: number;
  stageBehavior?: string;
}

interface PerformanceItemFactors {
  crowdAppeal: number;
  skillMatch: number;
  bandChemistry: number;
  energyCost: number;
  memberSkillAverage: number;
}

// ── Performance calculators ──

function calculateSongPerformance(factors: PerformanceFactors) {
  const bMods = getBehaviorMods(factors.stageBehavior || 'standard');

  const normalizedSongQuality = Math.min(100, (factors.songQuality / 1000) * 100);
  const normalizedMemberSkills = Math.min(100, (factors.memberSkillAverage / 150) * 100);
  const normalizedStageSkills = Math.min(100, Math.max(0, factors.stageSkillAverage || 0));

  const clamp = (v: number) => Math.min(100, Math.max(0, v || 0));

  const WEIGHTS = {
    songQuality: 0.25, rehearsal: 0.20, chemistry: 0.15,
    equipment: 0.12, crew: 0.08, memberSkills: 0.10, stageSkills: 0.10
  };

  const songQualityContrib = normalizedSongQuality * WEIGHTS.songQuality;
  const rehearsalContrib = clamp(factors.rehearsalLevel) * WEIGHTS.rehearsal;
  const chemistryContrib = clamp(factors.bandChemistry * bMods.chemMult) * WEIGHTS.chemistry;
  const equipmentContrib = clamp(factors.equipmentQuality) * WEIGHTS.equipment;
  const crewContrib = clamp(factors.crewSkillLevel) * WEIGHTS.crew;
  const memberSkillsContrib = normalizedMemberSkills * WEIGHTS.memberSkills;
  const stageSkillsContrib = normalizedStageSkills * WEIGHTS.stageSkills;

  const baseScore =
    songQualityContrib + rehearsalContrib + chemistryContrib +
    equipmentContrib + crewContrib + memberSkillsContrib + stageSkillsContrib +
    bMods.baseBonus;

  let capacityMultiplier = 1.0;
  const cap = factors.venueCapacityUsed;
  if (cap >= 95) capacityMultiplier = 1.15;
  else if (cap >= 80) capacityMultiplier = 1.08;
  else if (cap >= 60) capacityMultiplier = 1.0;
  else if (cap >= 40) capacityMultiplier = 0.95;
  else capacityMultiplier = 0.85;

  const variance = 0.85 + Math.random() * (0.30 * bMods.varianceMult);

  // Random event chance (matching client-side)
  let eventMultiplier = 1.0;
  const eventRoll = Math.random();
  if (eventRoll < 0.08) eventMultiplier = 1.15 + Math.random() * 0.10;
  else if (eventRoll < 0.14) eventMultiplier = 0.80 + Math.random() * 0.10;
  else if (eventRoll < 0.20) eventMultiplier = 1.08 + Math.random() * 0.07;

  // Quality difficulty curve (matching client-side)
  const qualityDifficulty = 0.75 + (normalizedSongQuality / 100) * 0.25;

  // Convert to 25-star scale
  const finalScore = (baseScore / 100) * 25 * capacityMultiplier * variance * qualityDifficulty * eventMultiplier;
  const score = Number(Math.max(0, Math.min(25, finalScore)).toFixed(2));

  let crowdResponse = 'mixed';
  if (score >= 22) crowdResponse = 'ecstatic';
  else if (score >= 18) crowdResponse = 'enthusiastic';
  else if (score >= 14) crowdResponse = 'engaged';
  else if (score >= 10) crowdResponse = 'mixed';
  else crowdResponse = 'disappointed';

  const breakdown = {
    songQuality: Number(((songQualityContrib / 100) * 25).toFixed(2)),
    rehearsal: Number(((rehearsalContrib / 100) * 25).toFixed(2)),
    chemistry: Number(((chemistryContrib / 100) * 25).toFixed(2)),
    equipment: Number(((equipmentContrib / 100) * 25).toFixed(2)),
    crew: Number(((crewContrib / 100) * 25).toFixed(2)),
    memberSkills: Number(((memberSkillsContrib / 100) * 25).toFixed(2)),
    stageSkills: Number(((stageSkillsContrib / 100) * 25).toFixed(2))
  };

  return { score, crowdResponse, breakdown };
}

function calculatePerformanceItemScore(factors: PerformanceItemFactors) {
  const clamp = (v: number) => Math.min(100, Math.max(0, v || 50));
  const weights = { crowdAppeal: 0.35, skillMatch: 0.25, chemistry: 0.20, memberSkills: 0.20 };
  const score = Number((
    (clamp(factors.crowdAppeal) / 100) * 25 * weights.crowdAppeal +
    (clamp(factors.skillMatch) / 100) * 25 * weights.skillMatch +
    (clamp(factors.bandChemistry) / 100) * 25 * weights.chemistry +
    (clamp(factors.memberSkillAverage) / 100) * 25 * weights.memberSkills
  ).toFixed(2));
  let crowdResponse = 'engaged';
  if (score >= 20) crowdResponse = 'ecstatic';
  else if (score >= 16) crowdResponse = 'enthusiastic';
  else if (score >= 12) crowdResponse = 'engaged';
  else if (score < 8) crowdResponse = 'mixed';
  return { score, crowdResponse };
}

// ── Live skill fetching helpers ──

async function fetchLiveMemberSkillAverage(
  supabaseClient: any,
  members: any[]
): Promise<number> {
  if (!members || members.length === 0) return 50;

  let totalEffective = 0;
  let counted = 0;

  for (const member of members) {
    // NPC members (no user_id) get a baseline skill level based on their tier
    if (!member.user_id) {
      const npcTier = member.touring_member_tier || 1;
      // NPC baseline: tier 1=40, tier 2=60, tier 3=80, tier 4=100
      const npcBaseline = Math.min(120, 30 + npcTier * 20);
      totalEffective += npcBaseline;
      counted++;
      console.log(`[process-gig-song] NPC member role=${member.instrument_role}: baseline=${npcBaseline} (tier ${npcTier})`);
      continue;
    }

    // Get profile_id for this user
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('user_id', member.user_id)
      .single();

    if (!profile) {
      console.log(`[process-gig-song] No profile found for user ${member.user_id}`);
      totalEffective += 50; // Default baseline
      counted++;
      continue;
    }

    const role = member.instrument_role || 'Vocals';
    const relevantSlugs = ROLE_SKILL_MAP[role] ||
      ROLE_SKILL_MAP[Object.keys(ROLE_SKILL_MAP).find(k =>
        role.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(role.toLowerCase())
      ) || ''] || [];

    console.log(`[process-gig-song] Member ${member.user_id} role=${role}, slugs=${relevantSlugs.length}`);

    // Fetch skill progress
    let skillLevel = 0;
    if (relevantSlugs.length > 0) {
      const { data: skillData } = await supabaseClient
        .from('skill_progress')
        .select('skill_slug, current_level')
        .eq('profile_id', profile.id)
        .in('skill_slug', relevantSlugs);

      skillLevel = getSkillLevelFromProgress(skillData || [], relevantSlugs);
      console.log(`[process-gig-song] Skill progress for role slugs: found ${skillData?.length || 0} entries, level=${skillLevel}`);
    }

    // If no role-specific skills found, try ALL instrument skills as fallback
    if (skillLevel === 0) {
      const { data: allSkills } = await supabaseClient
        .from('skill_progress')
        .select('skill_slug, current_level')
        .eq('profile_id', profile.id)
        .like('skill_slug', 'instruments_%');

      if (allSkills && allSkills.length > 0) {
        skillLevel = Math.round(getSkillLevelFromProgress(allSkills, allSkills.map((s: any) => s.skill_slug)) * 0.5);
        console.log(`[process-gig-song] Fallback: using best instrument skills (${allSkills.length} entries), level=${skillLevel}`);
      }
    }

    // Factor in player attributes as a baseline
    // Query by profile_id first, fall back to user_id
    let attrs: any = null;
    const { data: attrsByProfile } = await supabaseClient
      .from('player_attributes')
      .select('musical_ability, technical_mastery, rhythm_sense')
      .eq('profile_id', profile.id)
      .maybeSingle();
    
    if (attrsByProfile) {
      attrs = attrsByProfile;
    } else {
      const { data: attrsByUser } = await supabaseClient
        .from('player_attributes')
        .select('musical_ability, technical_mastery, rhythm_sense')
        .eq('user_id', member.user_id)
        .maybeSingle();
      attrs = attrsByUser;
    }

    if (attrs) {
      const rawMusical = attrs.musical_ability ?? 5;
      const rawTechnical = attrs.technical_mastery ?? 5;
      const rawRhythm = attrs.rhythm_sense ?? 5;
      
      // Normalize: attributes can be 0-1000+, map to 0-50 bonus range
      const attrAvg = rawMusical * 0.4 + rawTechnical * 0.3 + rawRhythm * 0.3;
      const normalizedAttrBonus = Math.round(Math.min(50, (Math.min(attrAvg, 1000) / 1000) * 50));
      
      // Blend: if skill tree is trained, it dominates; otherwise attributes provide a baseline
      if (skillLevel === 0) {
        skillLevel = normalizedAttrBonus;
      } else {
        skillLevel = Math.round(skillLevel * 0.7 + normalizedAttrBonus * 0.3);
      }
      console.log(`[process-gig-song] After attribute blend: skillLevel=${skillLevel}, attrs musical=${rawMusical} technical=${rawTechnical} rhythm=${rawRhythm}`);
    }

    // Fetch equipped gear bonus
    let gearMultiplier = 1.0;
    const { data: equipment } = await supabaseClient
      .from('player_equipment')
      .select('equipment_id, is_equipped')
      .eq('user_id', member.user_id)
      .eq('is_equipped', true);

    if (equipment && equipment.length > 0) {
      const equipIds = equipment.map((e: any) => e.equipment_id);
      const { data: items } = await supabaseClient
        .from('equipment_items')
        .select('id, name, category, subcategory, rarity, stat_boosts')
        .in('id', equipIds);

      if (items && items.length > 0) {
        let totalBonus = 0;
        for (const item of items) {
          if (doesCategoryMatchRole(item.category, item.subcategory, role)) {
            totalBonus += RARITY_BONUSES[item.rarity || 'common'] || 0.05;
            if (item.stat_boosts && typeof item.stat_boosts === 'object') {
              const perfBoost = (item.stat_boosts as Record<string, number>)['performance'] || 0;
              totalBonus += perfBoost / 100;
            }
          }
        }
        gearMultiplier = 1 + Math.min(totalBonus, 0.5);
      }
    }

    const effectiveLevel = Math.min(150, Math.round(skillLevel * gearMultiplier));
    console.log(`[process-gig-song] Member ${member.user_id}: final effectiveLevel=${effectiveLevel}, gearMultiplier=${gearMultiplier}`);
    totalEffective += effectiveLevel;
    counted++;
  }

  const result = counted > 0 ? Math.round(totalEffective / counted) : 50;
  console.log(`[process-gig-song] Member skill average: ${result} (${counted} members counted)`);
  return result;
}

async function fetchStageSkillAverage(
  supabaseClient: any,
  members: any[]
): Promise<number> {
  if (!members || members.length === 0) return 50;

  let totalStage = 0;
  let counted = 0;

  for (const member of members) {
    if (!member.user_id) {
      // NPC members get baseline stage skills based on tier
      const npcTier = member.touring_member_tier || 1;
      const npcStage = Math.min(80, 25 + npcTier * 15);
      totalStage += npcStage;
      counted++;
      continue;
    }

    // Try profile_id first, then user_id
    let attrs: any = null;
    const { data: profile } = await supabaseClient
      .from('profiles').select('id').eq('user_id', member.user_id).maybeSingle();
    
    if (profile) {
      const { data: a } = await supabaseClient
        .from('player_attributes')
        .select('stage_presence, charisma, crowd_engagement')
        .eq('profile_id', profile.id)
        .maybeSingle();
      attrs = a;
    }
    if (!attrs) {
      const { data: a } = await supabaseClient
        .from('player_attributes')
        .select('stage_presence, charisma, crowd_engagement')
        .eq('user_id', member.user_id)
        .maybeSingle();
      attrs = a;
    }

    if (!attrs) {
      totalStage += 40;
      counted++;
      continue;
    }

    const stagePresence = attrs.stage_presence ?? 5;
    const charisma = attrs.charisma ?? 5;
    // Attributes can be 0-1000+, normalize to 0-100
    const raw = stagePresence * 0.6 + charisma * 0.4;
    const normalized = Math.min(100, (Math.min(raw, 1000) / 1000) * 100);
    console.log(`[process-gig-song] Stage skills for ${member.user_id}: presence=${stagePresence}, charisma=${charisma}, normalized=${normalized}`);
    totalStage += normalized;
    counted++;
  }

  const result = counted > 0 ? Math.round(totalStage / counted) : 50;
  console.log(`[process-gig-song] Stage skill average: ${result} (${counted} members counted)`);
  return result;
}

// ── Main handler ──

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { gigId, outcomeId, songId, performanceItemId, position, itemType } = await req.json();

    console.log('[process-gig-song] Received:', { gigId, outcomeId, songId, performanceItemId, position, itemType });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get gig details with proper relationship hint
    const { data: gig, error: gigError } = await supabaseClient
      .from('gigs')
      .select('*, bands!gigs_band_id_fkey(*), venues!gigs_venue_id_fkey(*)')
      .eq('id', gigId)
      .single();

    if (gigError || !gig) {
      console.error('[process-gig-song] Gig fetch error:', gigError);
      throw new Error('Gig not found');
    }

    const bandId = gig.band_id;
    const venueCapacity = gig.venues.capacity || 100;

    // Fetch band members (shared by both paths)
    const { data: members } = await supabaseClient
      .from('band_members')
      .select('*')
      .eq('band_id', bandId)
      .eq('is_touring_member', false);

    // Handle PERFORMANCE ITEM
    if (itemType === 'performance_item' && performanceItemId) {
      console.log('[process-gig-song] Processing performance item:', performanceItemId);
      
      const { data: perfItem, error: itemError } = await supabaseClient
        .from('performance_items_catalog')
        .select('*')
        .eq('id', performanceItemId)
        .single();

      if (itemError || !perfItem) {
        console.error('[process-gig-song] Performance item not found:', itemError);
        throw new Error('Performance item not found');
      }

      // Use live skill data for performance items too
      const memberSkillAverage = await fetchLiveMemberSkillAverage(supabaseClient, members || []);

      let skillMatch = 70;
      if (perfItem.required_skill) {
        const minRequired = perfItem.min_skill_level || 0;
        skillMatch = Math.min(100, (memberSkillAverage / Math.max(1, minRequired)) * 100);
      }

      const itemFactors: PerformanceItemFactors = {
        crowdAppeal: perfItem.crowd_appeal || 50,
        skillMatch,
        bandChemistry: gig.bands.chemistry_level || 50,
        energyCost: 100 - (perfItem.energy_cost || 10),
        memberSkillAverage
      };

      const result = calculatePerformanceItemScore(itemFactors);

      const { data: performance, error: perfError } = await supabaseClient
        .from('gig_song_performances')
        .insert({
          gig_outcome_id: outcomeId,
          song_id: null,
          performance_item_id: performanceItemId,
          item_type: 'performance_item',
          song_title: perfItem.name,
          position,
          performance_score: result.score,
          crowd_response: result.crowdResponse,
          song_quality_contrib: result.score * 0.35,
          rehearsal_contrib: 0,
          chemistry_contrib: result.score * 0.20,
          equipment_contrib: 0,
          crew_contrib: 0,
          member_skill_contrib: result.score * 0.20,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (perfError) {
        console.error('[process-gig-song] Insert error:', perfError);
        throw perfError;
      }

      return new Response(
        JSON.stringify({ success: true, performance, isPerformanceItem: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Handle SONG
    if (!songId) {
      throw new Error('Song ID required for song processing');
    }

    const { data: song } = await supabaseClient
      .from('songs')
      .select('*')
      .eq('id', songId)
      .single();

    if (!song) throw new Error('Song not found');

    // Fetch performance factors in parallel
    const [equipmentRes, crewRes, rehearsalsRes, liveSkillAvg, stageSkillAvg] = await Promise.all([
      supabaseClient.from('band_stage_equipment').select('*').eq('band_id', bandId),
      supabaseClient.from('band_crew_members').select('*').eq('band_id', bandId),
      supabaseClient.from('song_rehearsals').select('*').eq('band_id', bandId).eq('song_id', songId),
      fetchLiveMemberSkillAverage(supabaseClient, members || []),
      fetchStageSkillAverage(supabaseClient, members || [])
    ]);

    const equipment = equipmentRes.data || [];
    const crew = crewRes.data || [];
    const rehearsal = rehearsalsRes.data?.[0];

    const equipmentQuality = equipment.length > 0
      ? equipment.reduce((sum: number, eq: any) => sum + eq.quality_rating, 0) / equipment.length
      : 40;

    const crewSkillLevel = crew.length > 0
      ? crew.reduce((sum: number, c: any) => sum + c.skill_level, 0) / crew.length
      : 40;

    const { data: outcomeData } = await supabaseClient
      .from('gig_outcomes')
      .select('actual_attendance')
      .eq('id', outcomeId)
      .single();

    const venueCapacityUsed = outcomeData 
      ? (outcomeData.actual_attendance / venueCapacity) * 100
      : 70;

    console.log('[process-gig-song] Live skill data:', {
      memberSkillAverage: liveSkillAvg,
      stageSkillAverage: stageSkillAvg,
      equipmentQuality,
      crewSkillLevel,
      songQuality: song.quality_score,
      rehearsalLevel: (rehearsal?.rehearsal_level || 0) * 10
    });

    // Fetch leader's stage behavior
    const { data: bandLeader } = await supabaseClient.from('bands').select('leader_id').eq('id', bandId).single();
    let stageBehavior = 'standard';
    if (bandLeader?.leader_id) {
      const { data: behaviorData } = await supabaseClient.from('player_behavior_settings').select('stage_behavior').eq('user_id', bandLeader.leader_id).maybeSingle();
      if (behaviorData?.stage_behavior) stageBehavior = behaviorData.stage_behavior;
    }

    const factors: PerformanceFactors = {
      songQuality: song.quality_score || 50,
      rehearsalLevel: (rehearsal?.rehearsal_level || 0) * 10,
      bandChemistry: gig.bands.chemistry_level || 0,
      equipmentQuality,
      crewSkillLevel,
      memberSkillAverage: liveSkillAvg,
      stageSkillAverage: stageSkillAvg,
      venueCapacityUsed,
      stageBehavior,
    };

    const result = calculateSongPerformance(factors);

    const { data: performance, error: perfError } = await supabaseClient
      .from('gig_song_performances')
      .insert({
        gig_outcome_id: outcomeId,
        song_id: songId,
        performance_item_id: null,
        item_type: 'song',
        song_title: song.title,
        position,
        performance_score: result.score,
        crowd_response: result.crowdResponse,
        song_quality_contrib: result.breakdown.songQuality,
        rehearsal_contrib: result.breakdown.rehearsal,
        chemistry_contrib: result.breakdown.chemistry,
        equipment_contrib: result.breakdown.equipment,
        crew_contrib: result.breakdown.crew,
        member_skill_contrib: result.breakdown.memberSkills,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (perfError) throw perfError;

    return new Response(
      JSON.stringify({ success: true, performance }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error in process-gig-song:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
