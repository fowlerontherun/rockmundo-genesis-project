import { supabase } from "@/integrations/supabase/client";
import {
  calculateSongPerformance,
  calculateMerchSales,
  getPerformanceGrade,
  type PerformanceFactors,
} from "./gigPerformanceCalculator";
import {
  EMPTY_GEAR_EFFECTS,
  calculateGearModifiers,
  mapEquippedGearRows,
  type EquippedGearItem,
  type GearModifierEffects,
  type PlayerEquipmentRow,
} from "./gearModifiers";

interface GigExecutionData {
  gigId: string;
  bandId: string;
  setlistId: string;
  venueCapacity: number;
  ticketPrice: number;
}

export async function executeGigPerformance(data: GigExecutionData) {
  const { gigId, bandId, setlistId, venueCapacity, ticketPrice } = data;

  // Fetch setlist songs
  const { data: setlistSongs, error: setlistError } = await supabase
    .from('setlist_songs')
    .select('*, songs!inner(id, title, genre, quality_score)')
    .eq('setlist_id', setlistId)
    .order('position');

  if (setlistError) throw setlistError;
  if (!setlistSongs || setlistSongs.length === 0) {
    throw new Error('No songs in setlist');
  }

  // Fetch all necessary data in parallel
  const [equipmentRes, crewRes, rehearsalsRes, bandRes, membersRes, merchRes] = await Promise.all([
    supabase.from('band_stage_equipment').select('*').eq('band_id', bandId),
    supabase.from('band_crew_members').select('*').eq('band_id', bandId),
    supabase.from('song_rehearsals').select('*').eq('band_id', bandId).in('song_id', setlistSongs.map(s => s.song_id)),
    supabase.from('bands').select('chemistry_level, fame, performance_count, band_balance').eq('id', bandId).single(),
    supabase.from('band_members').select('user_id, skill_contribution').eq('band_id', bandId).eq('is_touring_member', false),
    supabase.from('player_merchandise').select('*').eq('band_id', bandId).gt('stock_quantity', 0)
  ]);

  const equipment = equipmentRes.data || [];
  const crew = crewRes.data || [];
  const rehearsals = rehearsalsRes.data || [];
  const band = bandRes.data;
  const members = membersRes.data || [];
  const merch = merchRes.data || [];

  if (!band) throw new Error('Band not found');

  // Fetch equipped player gear for modifier calculations
  let equippedGearItems: EquippedGearItem[] = [];
  let gearEffects: GearModifierEffects = { ...EMPTY_GEAR_EFFECTS };

  const memberIds = members
    .map((member) => member.user_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  if (memberIds.length > 0) {
    const { data: gearRows, error: gearError } = await supabase
      .from('player_equipment')
      .select(
        'id, user_id, equipment_id, is_equipped, equipment:equipment_items!equipment_id (id, name, category, subcategory, rarity, stat_boosts)'
      )
      .in('user_id', memberIds)
      .eq('is_equipped', true);

    if (gearError) {
      throw gearError;
    }

    equippedGearItems = mapEquippedGearRows(gearRows as PlayerEquipmentRow[]);
    gearEffects = calculateGearModifiers(equippedGearItems);
  }

  // Calculate performance factors
  const baseEquipmentQuality = equipment.length > 0
    ? equipment.reduce((sum, eq) => sum + eq.quality_rating, 0) / equipment.length
    : 40;

  const equipmentQuality = Math.min(100, baseEquipmentQuality + gearEffects.equipmentQualityBonus);

  const crewSkillLevel = crew.length > 0
    ? crew.reduce((sum, c) => sum + c.skill_level, 0) / crew.length
    : 40;

  const bandChemistry = band.chemistry_level || 0;

  const memberSkillAverage = members.length > 0
    ? members.reduce((sum, m) => sum + (m.skill_contribution || 50), 0) / members.length
    : 50;

  // Calculate actual attendance (with variance adjusted by gear reliability and hype)
  const baseAttendance = Math.floor(venueCapacity * 0.7); // Base 70% capacity
  const riskVarianceExpansion = gearEffects.breakdownRiskPercent / 150;
  const attendanceVarianceRange = 0.3 + riskVarianceExpansion - gearEffects.reliabilityStability * 1.2;
  const boundedVarianceRange = Math.min(0.6, Math.max(0.1, attendanceVarianceRange));
  const varianceSwing = Math.random() * boundedVarianceRange - boundedVarianceRange / 2;
  const stabilityBias = gearEffects.reliabilityStability - gearEffects.breakdownRiskPercent / 200;
  const attendanceFromVariance = Math.max(0, 1 + varianceSwing + stabilityBias);
  const gearAttendanceMultiplier = Math.max(0.5, gearEffects.crowdEngagementMultiplier);
  const attendanceBeforeCap = baseAttendance * attendanceFromVariance * gearAttendanceMultiplier;
  const actualAttendance = Math.max(1, Math.min(venueCapacity, Math.floor(attendanceBeforeCap)));
  const venueCapacityUsed = (actualAttendance / venueCapacity) * 100;

  // Calculate performance for each song
  const songPerformances = setlistSongs.map((song, index) => {
    const rehearsal = rehearsals.find(r => r.song_id === song.song_id);
    const rehearsalLevel = rehearsal?.rehearsal_level || 0;

    const factors: PerformanceFactors = {
      songQuality: song.songs?.quality_score || 50,
      rehearsalLevel,
      bandChemistry,
      equipmentQuality,
      crewSkillLevel,
      memberSkillAverage,
      venueCapacityUsed,
      gearReliabilityBonus: gearEffects.reliabilityStability
    };

    const result = calculateSongPerformance(factors);

    return {
      song_id: song.song_id,
      song_title: song.songs?.title || 'Unknown',
      position: index + 1,
      performance_score: result.score,
      crowd_response: result.crowdResponse,
      song_quality_contrib: result.breakdown.songQuality,
      rehearsal_contrib: result.breakdown.rehearsal,
      chemistry_contrib: result.breakdown.chemistry,
      equipment_contrib: result.breakdown.equipment,
      crew_contrib: result.breakdown.crew,
      member_skill_contrib: result.breakdown.memberSkills
    };
  });

  // Calculate overall rating
  const overallRating = songPerformances.reduce((sum, p) => sum + p.performance_score, 0) / songPerformances.length;

  // Calculate merch sales
  const merchBase = calculateMerchSales(
    actualAttendance,
    band.fame || 0,
    overallRating,
    merch
  );

  const merchSales = {
    totalRevenue: Math.round(merchBase.totalRevenue * gearEffects.revenueMultiplier),
    itemsSold: Math.max(0, Math.round(merchBase.itemsSold * gearEffects.revenueMultiplier))
  };

  // Calculate costs
  const crewCosts = crew.reduce((sum, c) => sum + c.salary_per_gig, 0);
  const equipmentWearCost = equipment.reduce((sum, eq) => {
    const wearRate = 0.02; // 2% depreciation per gig
    return sum + (eq.purchase_cost || 0) * wearRate;
  }, 0);

  // Calculate revenue and profit
  const ticketRevenue = Math.round(actualAttendance * ticketPrice * gearEffects.revenueMultiplier);
  const totalRevenue = ticketRevenue + merchSales.totalRevenue;
  const netProfit = totalRevenue - crewCosts - equipmentWearCost;

  // Calculate fame gained
  const fameGained = Math.round((overallRating / 25) * actualAttendance * 0.5 * gearEffects.fameMultiplier);

  // Calculate chemistry impact
  let chemistryImpact = 0;
  if (overallRating >= 20) {
    chemistryImpact = 3;
  } else if (overallRating >= 17) {
    chemistryImpact = 2;
  } else if (overallRating >= 14) {
    chemistryImpact = 1;
  } else if (overallRating < 10) {
    chemistryImpact = -1;
  }

  const gradeData = getPerformanceGrade(overallRating);

  // Fetch venue info
  const { data: venueData } = await supabase
    .from('venues')
    .select('name, capacity')
    .eq('id', (await supabase.from('gigs').select('venue_id').eq('id', gigId).single()).data?.venue_id)
    .single();

  // Insert gig outcome with venue info
  const { data: outcome, error: outcomeError } = await supabase
    .from('gig_outcomes')
    .insert({
      gig_id: gigId,
      overall_rating: overallRating,
      actual_attendance: actualAttendance,
      attendance_percentage: (actualAttendance / venueCapacity) * 100,
      ticket_revenue: ticketRevenue,
      merch_revenue: merchSales.totalRevenue,
      total_revenue: totalRevenue,
      venue_cost: 0,
      crew_cost: crewCosts,
      equipment_cost: Math.round(equipmentWearCost),
      total_costs: crewCosts + Math.round(equipmentWearCost),
      net_profit: Math.round(netProfit),
      performance_grade: gradeData.grade,
      equipment_quality_avg: equipmentQuality,
      crew_skill_avg: crewSkillLevel,
      band_chemistry_level: bandChemistry,
      member_skill_avg: memberSkillAverage,
      fame_gained: fameGained,
      chemistry_change: chemistryImpact,
      merch_items_sold: merchSales.itemsSold,
      venue_name: venueData?.name,
      venue_capacity: venueData?.capacity,
      band_synergy_modifier: Number(gearEffects.equipmentQualityBonus.toFixed(2)),
      social_buzz_impact: Number(gearEffects.attendanceBonusPercent.toFixed(2)),
      audience_memory_impact: Number(gearEffects.reliabilitySwingReductionPercent.toFixed(2)),
      promoter_modifier: Number(gearEffects.revenueBonusPercent.toFixed(2)),
      venue_loyalty_bonus: Number(gearEffects.fameBonusPercent.toFixed(2))
    })
    .select()
    .single();

  if (outcomeError) throw outcomeError;

  // Insert song performances with song titles
  const songPerfsWithOutcome = songPerformances.map(sp => ({
    gig_outcome_id: outcome.id,
    song_id: sp.song_id,
    song_title: sp.song_title,
    position: sp.position,
    performance_score: sp.performance_score,
    crowd_response: sp.crowd_response,
    song_quality_contrib: sp.song_quality_contrib,
    rehearsal_contrib: sp.rehearsal_contrib,
    chemistry_contrib: sp.chemistry_contrib,
    equipment_contrib: sp.equipment_contrib,
    crew_contrib: sp.crew_contrib,
    member_skill_contrib: sp.member_skill_contrib
  }));

  await supabase
    .from('gig_song_performances')
    .insert(songPerfsWithOutcome);

  // Update gig status
  await supabase
    .from('gigs')
    .update({ status: 'completed' })
    .eq('id', gigId);

  // Update band stats and balance
  const newBalance = (band.band_balance || 0) + Math.round(netProfit);

  await supabase
    .from('bands')
    .update({
      fame: (band.fame || 0) + fameGained,
      chemistry_level: Math.max(0, Math.min(100, bandChemistry + chemistryImpact)),
      performance_count: (band.performance_count || 0) + 1,
      band_balance: newBalance
    })
    .eq('id', bandId);

  // Distribute fame to band members
  const famePerMember = Math.floor(fameGained / Math.max(1, members.length));
  for (const member of members) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('fame')
      .eq('user_id', member.user_id)
      .single();

    if (profile) {
      await supabase
        .from('profiles')
        .update({ fame: (profile.fame || 0) + famePerMember })
        .eq('user_id', member.user_id);
    }
  }

  // Record earnings in band_earnings table
  await supabase
    .from('band_earnings')
    .insert({
      band_id: bandId,
      amount: Math.round(netProfit),
      source: 'gig',
      description: `Gig performance (${actualAttendance} attendance, rating: ${overallRating.toFixed(1)})`,
      metadata: {
        gig_id: gigId,
        ticket_revenue: ticketRevenue,
        merch_sales: merchSales.totalRevenue,
        crew_costs: crewCosts,
        equipment_wear: Math.round(equipmentWearCost)
      }
    });

  return {
    outcome,
    songPerformances,
    actualAttendance,
    overallRating,
    netProfit,
    fameGained
  };
}
