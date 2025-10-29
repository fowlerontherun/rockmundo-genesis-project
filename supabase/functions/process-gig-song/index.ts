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
  const weights = {
    songQuality: 0.25,
    rehearsal: 0.20,
    chemistry: 0.15,
    equipment: 0.15,
    crew: 0.10,
    memberSkills: 0.15
  };

  const breakdown = {
    songQuality: (factors.songQuality / 100) * 25 * weights.songQuality / weights.songQuality,
    rehearsal: (factors.rehearsalLevel / 100) * 25 * weights.rehearsal / weights.rehearsal,
    chemistry: (factors.bandChemistry / 100) * 25 * weights.chemistry / weights.chemistry,
    equipment: (factors.equipmentQuality / 100) * 25 * weights.equipment / weights.equipment,
    crew: (factors.crewSkillLevel / 100) * 25 * weights.crew / weights.crew,
    memberSkills: (factors.memberSkillAverage / 100) * 25 * weights.memberSkills / weights.memberSkills
  };

  const score = 
    breakdown.songQuality * weights.songQuality +
    breakdown.rehearsal * weights.rehearsal +
    breakdown.chemistry * weights.chemistry +
    breakdown.equipment * weights.equipment +
    breakdown.crew * weights.crew +
    breakdown.memberSkills * weights.memberSkills;

  let crowdResponse = 'mixed';
  if (score >= 22) crowdResponse = 'ecstatic';
  else if (score >= 19) crowdResponse = 'enthusiastic';
  else if (score >= 15) crowdResponse = 'engaged';
  else if (score < 10) crowdResponse = 'disappointed';

  return { score, crowdResponse, breakdown };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { gigId, outcomeId, songId, position } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get gig details
    const { data: gig } = await supabaseClient
      .from('gigs')
      .select('*, bands!inner(*), venues!inner(*)')
      .eq('id', gigId)
      .single();

    if (!gig) throw new Error('Gig not found');

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