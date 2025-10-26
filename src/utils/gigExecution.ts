import { supabase } from "@/integrations/supabase/client";
import { calculateSongPerformance, calculateMerchSales, getPerformanceGrade, type PerformanceFactors } from "./gigPerformanceCalculator";

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

  // Calculate performance factors
  const equipmentQuality = equipment.length > 0
    ? equipment.reduce((sum, eq) => sum + eq.quality_rating, 0) / equipment.length
    : 40;

  const crewSkillLevel = crew.length > 0
    ? crew.reduce((sum, c) => sum + c.skill_level, 0) / crew.length
    : 40;

  const bandChemistry = band.chemistry_level || 0;

  const memberSkillAverage = members.length > 0
    ? members.reduce((sum, m) => sum + (m.skill_contribution || 50), 0) / members.length
    : 50;

  // Calculate actual attendance (with some variance)
  const baseAttendance = Math.floor(venueCapacity * 0.7); // Base 70% capacity
  const variance = Math.random() * 0.3 - 0.15; // -15% to +15% variance
  const actualAttendance = Math.max(1, Math.floor(baseAttendance * (1 + variance)));
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
      venueCapacityUsed
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
  const merchSales = calculateMerchSales(
    actualAttendance,
    band.fame || 0,
    overallRating,
    merch
  );

  // Calculate costs
  const crewCosts = crew.reduce((sum, c) => sum + c.salary_per_gig, 0);
  const equipmentWearCost = equipment.reduce((sum, eq) => {
    const wearRate = 0.02; // 2% depreciation per gig
    return sum + (eq.purchase_cost || 0) * wearRate;
  }, 0);

  // Calculate revenue and profit
  const ticketRevenue = actualAttendance * ticketPrice;
  const totalRevenue = ticketRevenue + merchSales.totalRevenue;
  const netProfit = totalRevenue - crewCosts - equipmentWearCost;

  // Calculate fame gained
  const fameGained = Math.round((overallRating / 25) * actualAttendance * 0.5);

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

  // Insert gig outcome
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
      merch_items_sold: merchSales.itemsSold
    })
    .select()
    .single();

  if (outcomeError) throw outcomeError;

  // Insert song performances
  const songPerfsWithOutcome = songPerformances.map(sp => ({
    gig_outcome_id: outcome.id,
    song_id: sp.song_id,
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
