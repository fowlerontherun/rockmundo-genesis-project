import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { gigId } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log(`Completing gig ${gigId}`);

    // Get gig and outcome
    const { data: gig, error: gigError } = await supabaseClient
      .from('gigs')
      .select('*, bands!gigs_band_id_fkey(*)')
      .eq('id', gigId)
      .single();

    if (gigError || !gig) {
      throw new Error('Gig not found');
    }

    const { data: outcome, error: outcomeError } = await supabaseClient
      .from('gig_outcomes')
      .select('id, actual_attendance, ticket_revenue')
      .eq('gig_id', gigId)
      .single();

    if (outcomeError || !outcome) {
      throw new Error('Gig outcome not found');
    }

    // Get all song performances
    const { data: performances, error: perfError } = await supabaseClient
      .from('gig_song_performances')
      .select('*')
      .eq('gig_outcome_id', outcome.id)
      .order('position');

    if (perfError) {
      console.error('Error fetching performances:', perfError);
      throw perfError;
    }

    if (!performances || performances.length === 0) {
      console.log('No performances found, gig may not have been processed yet');
      throw new Error('No song performances found - gig may not have been processed');
    }

    // Calculate overall rating (average of all songs) - max is 25
    const avgRating = performances.reduce((sum, p) => sum + (p.performance_score || 0), 0) / performances.length;

    // Calculate averages for each factor
    const avgEquipment = performances.reduce((sum, p) => sum + (p.equipment_contrib || 0), 0) / performances.length;
    const avgCrew = performances.reduce((sum, p) => sum + (p.crew_contrib || 0), 0) / performances.length;
    const avgChemistry = performances.reduce((sum, p) => sum + (p.chemistry_contrib || 0), 0) / performances.length;
    const avgMemberSkill = performances.reduce((sum, p) => sum + (p.member_skill_contrib || 0), 0) / performances.length;

    // Calculate merchandise sales (based on attendance and performance)
    // Rating is 0-25, so divide by 25 to get 0-1 range, then scale to 5%-25% purchase rate
    const merchMultiplier = Math.max(0.05, Math.min(0.25, (avgRating / 25) * 0.25));
    const merchItemsSold = Math.floor(outcome.actual_attendance * merchMultiplier);
    const merchRevenue = merchItemsSold * 25; // $25 average per item

    // Calculate costs (ensure integers for database)
    const crewCost = Math.floor(avgCrew * 5); // Crew cost based on skill
    const equipmentCost = Math.floor(avgEquipment * 2); // Wear and tear
    const totalCosts = crewCost + equipmentCost;

    // Calculate total revenue and profit
    const totalRevenue = outcome.ticket_revenue + merchRevenue;
    const netProfit = totalRevenue - totalCosts;

    // Calculate fame gained - balanced formula
    // Base: rating/25 * 200 (max 200 for perfect show at small venue)
    // Attendance multiplier: scales logarithmically with venue size (1.0 to 3.0)
    // Small venue (100): ~1.0x, Medium (1000): ~1.5x, Large (10000): ~2.0x, Arena (25000): ~2.5x
    const attendanceMultiplier = 1.0 + Math.log10(Math.max(1, outcome.actual_attendance / 100)) * 0.5;
    const baseFame = (avgRating / 25) * 200;
    const fameGained = Math.floor(baseFame * Math.min(3.0, attendanceMultiplier));
    
    // Calculate individual member XP (higher for good performances)
    const memberXpBase = Math.floor(fameGained * 1.5); // Members get 1.5x fame as XP

    // Calculate chemistry impact (-2 to +3 based on performance)
    let chemistryChange = 0;
    if (avgRating >= 22) chemistryChange = 3;
    else if (avgRating >= 19) chemistryChange = 2;
    else if (avgRating >= 15) chemistryChange = 1;
    else if (avgRating < 10) chemistryChange = -2;
    else if (avgRating < 13) chemistryChange = -1;

    // Get performance grade
    let performanceGrade = 'C';
    if (avgRating >= 23) performanceGrade = 'S';
    else if (avgRating >= 20) performanceGrade = 'A';
    else if (avgRating >= 16) performanceGrade = 'B';
    else if (avgRating >= 12) performanceGrade = 'C';
    else if (avgRating >= 8) performanceGrade = 'D';
    else performanceGrade = 'F';

    // Update outcome with final calculations
    const { error: updateError } = await supabaseClient
      .from('gig_outcomes')
      .update({
        overall_rating: avgRating,
        performance_grade: performanceGrade,
        merch_revenue: merchRevenue,
        merch_items_sold: merchItemsSold,
        total_revenue: totalRevenue,
        crew_cost: crewCost,
        equipment_cost: equipmentCost,
        total_costs: totalCosts,
        net_profit: netProfit,
        fame_gained: fameGained,
        chemistry_change: chemistryChange,
        equipment_quality_avg: Math.round(avgEquipment),
        crew_skill_avg: Math.round(avgCrew),
        band_chemistry_level: Math.round(avgChemistry),
        member_skill_avg: Math.round(avgMemberSkill * 100) / 100,
        completed_at: new Date().toISOString()
      })
      .eq('id', outcome.id);

    if (updateError) throw updateError;

    // Update band stats
    const newChemistry = Math.max(0, Math.min(100, (gig.bands.chemistry_level || 50) + chemistryChange));
    const newFame = Math.max(0, (gig.bands.fame || 0) + fameGained);
    const newBalance = (gig.bands.band_balance || 0) + netProfit;

    const { error: bandError } = await supabaseClient
      .from('bands')
      .update({
        chemistry_level: newChemistry,
        fame: newFame,
        band_balance: newBalance,
        performance_count: (gig.bands.performance_count || 0) + 1
      })
      .eq('id', gig.band_id);

    if (bandError) throw bandError;

    // Add earnings record
    const { error: earningsError } = await supabaseClient
      .from('band_earnings')
      .insert({
        band_id: gig.band_id,
        source: 'gig_performance',
        amount: netProfit,
        description: `Gig performance earnings`,
        metadata: { gig_id: gigId, outcome_id: outcome.id }
      });

    if (earningsError) console.error('Error adding earnings:', earningsError);

    // Distribute XP to band members
    const { data: members } = await supabaseClient
      .from('band_members')
      .select('user_id')
      .eq('band_id', gig.band_id)
      .eq('is_touring_member', false);

    if (members && members.length > 0) {
      const xpPerMember = Math.floor(memberXpBase / members.length);
      
      // Award XP to each member
      for (const member of members) {
        await supabaseClient
          .from('experience_ledger')
          .insert({
            user_id: member.user_id,
            activity_type: 'gig_performance',
            xp_amount: xpPerMember,
            metadata: { 
              gig_id: gigId, 
              band_id: gig.band_id,
              rating: avgRating.toFixed(1),
              attendance: outcome.actual_attendance
            }
          });
      }
    }

    // Mark gig as completed
    const { error: gigUpdateError } = await supabaseClient
      .from('gigs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', gigId);

    if (gigUpdateError) throw gigUpdateError;

    console.log(`Gig ${gigId} completed successfully. Rating: ${avgRating.toFixed(1)}, Profit: $${netProfit}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        outcome: {
          overall_rating: avgRating,
          net_profit: netProfit,
          fame_gained: fameGained,
          chemistry_change: chemistryChange
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error in complete-gig:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
