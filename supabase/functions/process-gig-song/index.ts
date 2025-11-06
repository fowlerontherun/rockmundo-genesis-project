import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PerformanceFactors {
  songQuality: number;
  rehearsalLevel: number;
  bandChemistry: number;
  equipmentQuality: number;
  crewSkillLevel: number;
  memberSkillAverage: number;
  venueCapacityUsed: number;
}

function calculateSongPerformance(factors: PerformanceFactors) {
  // Clamp all factors to 0-100 range to prevent overflow
  const clampedFactors = {
    songQuality: Math.min(100, Math.max(0, factors.songQuality || 0)),
    rehearsalLevel: Math.min(100, Math.max(0, factors.rehearsalLevel || 0)),
    bandChemistry: Math.min(100, Math.max(0, factors.bandChemistry || 0)),
    equipmentQuality: Math.min(100, Math.max(0, factors.equipmentQuality || 0)),
    crewSkillLevel: Math.min(100, Math.max(0, factors.crewSkillLevel || 0)),
    memberSkillAverage: Math.min(100, Math.max(0, factors.memberSkillAverage || 0)),
    venueCapacityUsed: Math.min(100, Math.max(0, factors.venueCapacityUsed || 0))
  };

  const weights = {
    songQuality: 0.25,
    rehearsal: 0.20,
    chemistry: 0.15,
    equipment: 0.15,
    crew: 0.10,
    memberSkills: 0.15
  };

  // Calculate raw contributions (0-25 range)
  const breakdown = {
    songQuality: (clampedFactors.songQuality / 100) * 25,
    rehearsal: (clampedFactors.rehearsalLevel / 100) * 25,
    chemistry: (clampedFactors.bandChemistry / 100) * 25,
    equipment: (clampedFactors.equipmentQuality / 100) * 25,
    crew: (clampedFactors.crewSkillLevel / 100) * 25,
    memberSkills: (clampedFactors.memberSkillAverage / 100) * 25
  };

  // Calculate weighted score and round to 2 decimal places
  const score = Number((
    breakdown.songQuality * weights.songQuality +
    breakdown.rehearsal * weights.rehearsal +
    breakdown.chemistry * weights.chemistry +
    breakdown.equipment * weights.equipment +
    breakdown.crew * weights.crew +
    breakdown.memberSkills * weights.memberSkills
  ).toFixed(2));

  let crowdResponse = 'mixed';
  if (score >= 22) crowdResponse = 'ecstatic';
  else if (score >= 19) crowdResponse = 'enthusiastic';
  else if (score >= 15) crowdResponse = 'engaged';
  else if (score < 10) crowdResponse = 'disappointed';

  // Round all breakdown values to 2 decimal places
  return { 
    score, 
    crowdResponse, 
    breakdown: {
      songQuality: Number(breakdown.songQuality.toFixed(2)),
      rehearsal: Number(breakdown.rehearsal.toFixed(2)),
      chemistry: Number(breakdown.chemistry.toFixed(2)),
      equipment: Number(breakdown.equipment.toFixed(2)),
      crew: Number(breakdown.crew.toFixed(2)),
      memberSkills: Number(breakdown.memberSkills.toFixed(2))
    }
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { gigId, outcomeId, songId, position } = await req.json();

    console.log('[process-gig-song] Received:', { gigId, outcomeId, songId, position });

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

    // Get song details
    const { data: song } = await supabaseClient
      .from('songs')
      .select('*')
      .eq('id', songId)
      .single();

    if (!song) throw new Error('Song not found');

    // Fetch performance factors
    const [equipmentRes, crewRes, rehearsalsRes, membersRes] = await Promise.all([
      supabaseClient.from('band_stage_equipment').select('*').eq('band_id', bandId),
      supabaseClient.from('band_crew_members').select('*').eq('band_id', bandId),
      supabaseClient.from('song_rehearsals').select('*').eq('band_id', bandId).eq('song_id', songId),
      supabaseClient.from('band_members').select('*').eq('band_id', bandId).eq('is_touring_member', false)
    ]);

    const equipment = equipmentRes.data || [];
    const crew = crewRes.data || [];
    const rehearsal = rehearsalsRes.data?.[0];
    const members = membersRes.data || [];

    const equipmentQuality = equipment.length > 0
      ? equipment.reduce((sum: number, eq: any) => sum + eq.quality_rating, 0) / equipment.length
      : 40;

    const crewSkillLevel = crew.length > 0
      ? crew.reduce((sum: number, c: any) => sum + c.skill_level, 0) / crew.length
      : 40;

    const memberSkillAverage = members.length > 0
      ? members.reduce((sum: number, m: any) => sum + (m.skill_contribution || 50), 0) / members.length
      : 50;

    const { data: outcomeData } = await supabaseClient
      .from('gig_outcomes')
      .select('actual_attendance')
      .eq('id', outcomeId)
      .single();

    const venueCapacityUsed = outcomeData 
      ? (outcomeData.actual_attendance / venueCapacity) * 100
      : 70;

    // Calculate performance
    const factors: PerformanceFactors = {
      songQuality: song.quality_score || 50,
      rehearsalLevel: rehearsal?.rehearsal_level || 0,
      bandChemistry: gig.bands.chemistry_level || 0,
      equipmentQuality,
      crewSkillLevel,
      memberSkillAverage,
      venueCapacityUsed
    };

    const result = calculateSongPerformance(factors);

    // Insert song performance
    const { data: performance, error: perfError } = await supabaseClient
      .from('gig_song_performances')
      .insert({
        gig_outcome_id: outcomeId,
        song_id: songId,
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