import { supabase } from '@/integrations/supabase/client';

/**
 * Enhanced Performance Simulation Engine
 * Calculates gig success using the comprehensive formula:
 * Performance_Score = (Avg_Skill_Performance * Band_Synergy_Mod * Crowd_Engagement * Setlist_Quality)
 *                    + Random(-5 to +5) + Promoter_Mod
 */

interface PerformanceInputs {
  bandId: string;
  venueId: string;
  setlistId: string;
  promoterId?: string;
  cityId?: string;
}

interface PerformanceResult {
  performance_score: number;
  skill_performance_avg: number;
  band_synergy_modifier: number;
  crowd_engagement: number;
  setlist_quality_score: number;
  promoter_modifier: number;
  audience_memory_impact: number;
  venue_loyalty_bonus: number;
  random_factor: number;
  breakdown: {
    skill_contribution: number;
    synergy_contribution: number;
    crowd_contribution: number;
    setlist_contribution: number;
    promoter_contribution: number;
    audience_memory_contribution: number;
    venue_loyalty_contribution: number;
  };
}

/**
 * Calculate average skill performance of band members
 */
async function calculateSkillPerformance(bandId: string): Promise<number> {
  const { data: members } = await supabase
    .from('band_members')
    .select('user_id, role')
    .eq('band_id', bandId)
    .eq('is_touring_member', false);

  if (!members || members.length === 0) return 50;

  let totalSkill = 0;
  let count = 0;

  for (const member of members) {
    const { data: skills } = await supabase
      .from('player_skills')
      .select('*')
      .eq('user_id', member.user_id)
      .single();

    if (skills) {
      const roleSkills = [
        skills.guitar || 1,
        skills.bass || 1,
        skills.drums || 1,
        skills.vocals || 1,
        skills.performance || 1,
      ];
      totalSkill += roleSkills.reduce((a, b) => a + b, 0) / roleSkills.length;
      count++;
    }
  }

  return count > 0 ? totalSkill / count : 50;
}

/**
 * Calculate band synergy modifier (improves with chemistry and rehearsal)
 */
async function calculateBandSynergy(bandId: string, setlistId: string): Promise<number> {
  const { data: band } = await supabase
    .from('bands')
    .select('chemistry_level, performance_count')
    .eq('id', bandId)
    .single();

  if (!band) return 1.0;

  // Base synergy from chemistry (0.7 to 1.3)
  const chemistryMod = 0.7 + (band.chemistry_level / 100) * 0.6;

  // Experience bonus (0 to 0.2)
  const experienceMod = Math.min(0.2, (band.performance_count || 0) * 0.01);

  // Rehearsal bonus
  const { data: setlistSongs } = await supabase
    .from('setlist_songs')
    .select('song_id')
    .eq('setlist_id', setlistId);

  if (!setlistSongs || setlistSongs.length === 0) return chemistryMod + experienceMod;

  const songIds = setlistSongs.map(s => s.song_id);
  const { data: rehearsals } = await supabase
    .from('song_rehearsals')
    .select('rehearsal_level')
    .eq('band_id', bandId)
    .in('song_id', songIds);

  const avgRehearsal = rehearsals && rehearsals.length > 0
    ? rehearsals.reduce((sum, r) => sum + (r.rehearsal_level || 0), 0) / rehearsals.length
    : 0;

  const rehearsalMod = (avgRehearsal / 10) * 0.2; // 0 to 0.2

  return chemistryMod + experienceMod + rehearsalMod;
}

/**
 * Calculate crowd engagement based on fame, hype, and social activity
 */
async function calculateCrowdEngagement(
  bandId: string,
  venueId: string,
  cityId?: string
): Promise<{ engagement: number; audienceMemoryImpact: number }> {
  const { data: band } = await supabase
    .from('bands')
    .select('fame')
    .eq('id', bandId)
    .single();

  const fame = band?.fame || 0;

  // Base engagement from fame (0.5 to 1.5)
  let engagement = 0.5 + (Math.min(fame, 10000) / 10000) * 1.0;

  // Audience memory impact
  let audienceMemoryImpact = 0;
  if (cityId) {
    const { data: memory } = await supabase
      .from('audience_memory')
      .select('avg_experience_score, loyalty_level')
      .eq('city_id', cityId)
      .eq('band_id', bandId)
      .single();

    if (memory) {
      audienceMemoryImpact = ((memory.avg_experience_score || 50) - 50) / 100;
      engagement += audienceMemoryImpact;
    }
  }

  // Social buzz (check recent Twaater activity)
  const { count: recentTwaats } = await supabase
    .from('twaats')
    .select('id', { count: 'exact', head: true })
    .eq('linked_type', 'gig')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  const socialBonus = Math.min(0.3, (recentTwaats || 0) * 0.05);
  engagement += socialBonus;

  return { engagement: Math.max(0.3, Math.min(2.0, engagement)), audienceMemoryImpact };
}

/**
 * Calculate setlist quality based on song quality, energy curve, and genre match
 */
async function calculateSetlistQuality(
  setlistId: string,
  venueId: string
): Promise<number> {
  const { data: setlistSongs } = await supabase
    .from('setlist_songs')
    .select('song_id, position, is_encore, energy_level, songs(quality_score, genre)')
    .eq('setlist_id', setlistId)
    .order('position');

  if (!setlistSongs || setlistSongs.length === 0) return 50;

  // Average song quality (0-100)
  const avgQuality = setlistSongs.reduce((sum, s) => 
    sum + ((s.songs as any)?.quality_score || 50), 0
  ) / setlistSongs.length;

  // Energy curve analysis (ideal: start medium, peak mid-set, encore high)
  let energyCurveScore = 70;
  const energyLevels = setlistSongs
    .filter(s => !s.is_encore)
    .map(s => s.energy_level || 5);

  if (energyLevels.length >= 3) {
    const start = energyLevels.slice(0, 2).reduce((a, b) => a + b, 0) / 2;
    const middle = energyLevels.slice(2, -2).reduce((a, b) => a + b, 0) / (energyLevels.length - 4);
    const end = energyLevels.slice(-2).reduce((a, b) => a + b, 0) / 2;

    // Ideal curve: 5 -> 7+ -> 6+
    if (start >= 4 && start <= 6 && middle >= 7 && end >= 6) {
      energyCurveScore = 90;
    } else if (start < 7 && middle > start && end > start) {
      energyCurveScore = 80;
    }
  }

  // Genre match with venue
  const { data: venue } = await supabase
    .from('venues')
    .select('genre_bias')
    .eq('id', venueId)
    .single();

  let genreMatchScore = 70;
  if (venue?.genre_bias) {
    const venueBias = venue.genre_bias as Record<string, number>;
    const songGenres = setlistSongs.map(s => (s.songs as any)?.genre).filter(Boolean);
    const genreScores = songGenres.map(genre => venueBias[genre] || 0.7);
    genreMatchScore = genreScores.length > 0
      ? (genreScores.reduce((a, b) => a + b, 0) / genreScores.length) * 100
      : 70;
  }

  // Weighted average
  return (avgQuality * 0.4) + (energyCurveScore * 0.3) + (genreMatchScore * 0.3);
}

/**
 * Get promoter modifier
 */
async function getPromoterModifier(promoterId?: string): Promise<number> {
  if (!promoterId) return 0;

  const { data: promoter } = await supabase
    .from('promoters')
    .select('quality_tier, crowd_engagement_bonus, reputation')
    .eq('id', promoterId)
    .single();

  if (!promoter) return 0;

  const tierBonus = {
    amateur: -2,
    standard: 0,
    professional: 3,
    legendary: 5,
  }[promoter.quality_tier as string] || 0;

  const reputationBonus = ((promoter.reputation || 50) - 50) / 10;

  return tierBonus + reputationBonus + (promoter.crowd_engagement_bonus || 0);
}

/**
 * Get venue loyalty bonus
 */
async function getVenueLoyaltyBonus(bandId: string, venueId: string): Promise<number> {
  const { data: relationship } = await supabase
    .from('venue_relationships')
    .select('payout_bonus, relationship_tier')
    .eq('band_id', bandId)
    .eq('venue_id', venueId)
    .single();

  if (!relationship) return 0;

  // Convert payout bonus to performance points (0-3 points)
  return (relationship.payout_bonus || 0) * 10;
}

/**
 * Main enhanced performance calculation
 */
export async function calculateEnhancedPerformance(
  inputs: PerformanceInputs
): Promise<PerformanceResult> {
  const skillPerformance = await calculateSkillPerformance(inputs.bandId);
  const bandSynergy = await calculateBandSynergy(inputs.bandId, inputs.setlistId);
  const { engagement: crowdEngagement, audienceMemoryImpact } = await calculateCrowdEngagement(
    inputs.bandId,
    inputs.venueId,
    inputs.cityId
  );
  const setlistQuality = await calculateSetlistQuality(inputs.setlistId, inputs.venueId);
  const promoterMod = await getPromoterModifier(inputs.promoterId);
  const venueLoyaltyBonus = await getVenueLoyaltyBonus(inputs.bandId, inputs.venueId);
  const randomFactor = (Math.random() * 10) - 5; // -5 to +5

  // Apply formula
  const baseScore = (skillPerformance / 100) * bandSynergy * crowdEngagement * (setlistQuality / 100) * 25;
  const performanceScore = Math.max(0, Math.min(25, baseScore + promoterMod + venueLoyaltyBonus + randomFactor));

  return {
    performance_score: performanceScore,
    skill_performance_avg: skillPerformance,
    band_synergy_modifier: bandSynergy,
    crowd_engagement: crowdEngagement,
    setlist_quality_score: setlistQuality,
    promoter_modifier: promoterMod,
    audience_memory_impact: audienceMemoryImpact,
    venue_loyalty_bonus: venueLoyaltyBonus,
    random_factor: randomFactor,
    breakdown: {
      skill_contribution: (skillPerformance / 100) * 25,
      synergy_contribution: (bandSynergy - 1.0) * 10,
      crowd_contribution: (crowdEngagement - 1.0) * 10,
      setlist_contribution: (setlistQuality / 100) * 10,
      promoter_contribution: promoterMod,
      audience_memory_contribution: audienceMemoryImpact * 5,
      venue_loyalty_contribution: venueLoyaltyBonus,
    },
  };
}

/**
 * Generate random stage event
 */
export async function generateStageEvent(gigId: string, songPosition: number): Promise<void> {
  const eventChance = Math.random();
  
  let eventType: string | null = null;
  let severity: string = 'minor';
  let impactScore = 0;
  let description = '';

  if (eventChance < 0.05) { // 5% chance of mishap
    eventType = 'mishap';
    severity = Math.random() < 0.7 ? 'minor' : 'moderate';
    impactScore = severity === 'minor' ? -1 : -3;
    const mishaps = [
      'Guitar string broke mid-solo',
      'Microphone feedback disrupted the song',
      'Drummer dropped a stick',
      'Wrong lyrics sung in the chorus',
    ];
    description = mishaps[Math.floor(Math.random() * mishaps.length)];
  } else if (eventChance > 0.95 && songPosition > 3) { // 5% chance of perfect moment
    eventType = 'perfect_moment';
    impactScore = 3;
    description = 'The crowd went absolutely wild! Perfect execution!';
  } else if (Math.random() < 0.02) { // 2% rare events
    const rare = Math.random();
    if (rare < 0.33) {
      eventType = 'surprise_guest';
      impactScore = 5;
      description = 'A local celebrity jumped on stage to join the performance!';
    } else if (rare < 0.66) {
      eventType = 'crowd_surge';
      impactScore = 2;
      description = 'The crowd surged forward in excitement!';
    } else {
      eventType = 'technical_failure';
      severity = 'major';
      impactScore = -5;
      description = 'Sound system failed for 30 seconds';
    }
  }

  if (eventType) {
    await supabase.from('stage_events').insert({
      gig_id: gigId,
      event_type: eventType,
      song_position: songPosition,
      severity,
      impact_score: impactScore,
      description,
    });
  }
}
