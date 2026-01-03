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
      .select('*, bands!gigs_band_id_fkey(*), venues!gigs_venue_id_fkey(city_id)')
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

    // === MERCHANDISE SALES FROM ACTUAL INVENTORY ===
    const { data: merchInventory } = await supabaseClient
      .from('player_merchandise')
      .select('id, item_type, design_name, selling_price, cost_to_produce, stock_quantity')
      .eq('band_id', gig.band_id)
      .gt('stock_quantity', 0);

    let merchRevenue = 0;
    let merchItemsSold = 0;
    let merchCost = 0;
    const merchSalesDetails: { item_id: string; item_type: string; quantity: number; revenue: number; cost: number }[] = [];

    if (merchInventory && merchInventory.length > 0) {
      // Purchase rate: 5-25% based on performance rating (0-25 scale)
      const basePurchaseRate = 0.05 + (Math.min(1, (gig.bands.fame || 0) / 5000) * 0.05);
      const performanceBonus = Math.min(1.5, avgRating / 18);
      const actualPurchaseRate = basePurchaseRate * performanceBonus;
      
      const numberOfBuyers = Math.round(outcome.actual_attendance * actualPurchaseRate);
      
      // Simulate purchases from actual inventory
      for (let i = 0; i < numberOfBuyers; i++) {
        const itemCount = Math.random() < 0.7 ? 1 : 2; // 70% buy 1, 30% buy 2
        
        for (let j = 0; j < itemCount; j++) {
          // Get available items (check stock in real-time from our tracking)
          const availableItems = merchInventory.filter(item => {
            const soldSoFar = merchSalesDetails.filter(s => s.item_id === item.id).reduce((sum, s) => sum + s.quantity, 0);
            return (item.stock_quantity - soldSoFar) > 0;
          });
          
          if (availableItems.length === 0) break;
          
          const randomItem = availableItems[Math.floor(Math.random() * availableItems.length)];
          
          // Track this sale
          const existingSale = merchSalesDetails.find(s => s.item_id === randomItem.id);
          if (existingSale) {
            existingSale.quantity++;
            existingSale.revenue += randomItem.selling_price;
            existingSale.cost += randomItem.cost_to_produce;
          } else {
            merchSalesDetails.push({
              item_id: randomItem.id,
              item_type: randomItem.item_type,
              quantity: 1,
              revenue: randomItem.selling_price,
              cost: randomItem.cost_to_produce
            });
          }
          
          merchRevenue += randomItem.selling_price;
          merchCost += randomItem.cost_to_produce;
          merchItemsSold++;
        }
      }
      
      // Update inventory stock quantities
      for (const sale of merchSalesDetails) {
        const { error: stockError } = await supabaseClient
          .from('player_merchandise')
          .update({ 
            stock_quantity: supabaseClient.rpc('decrement_stock', { row_id: sale.item_id, amount: sale.quantity })
          })
          .eq('id', sale.item_id);
        
        // Fallback: direct update if RPC doesn't exist
        if (stockError) {
          const item = merchInventory.find(i => i.id === sale.item_id);
          if (item) {
            await supabaseClient
              .from('player_merchandise')
              .update({ stock_quantity: Math.max(0, item.stock_quantity - sale.quantity) })
              .eq('id', sale.item_id);
          }
        }
      }
      
      console.log(`Merch sales: ${merchItemsSold} items, $${merchRevenue} revenue, $${merchCost} cost`);
    }

    // Calculate costs (ensure integers for database)
    const crewCost = Math.floor(avgCrew * 5); // Crew cost based on skill
    const equipmentCost = Math.floor(avgEquipment * 2); // Wear and tear
    const totalCosts = crewCost + equipmentCost + merchCost;

    // Calculate total revenue and profit
    const totalRevenue = outcome.ticket_revenue + merchRevenue;
    const netProfit = totalRevenue - totalCosts;

    // Calculate fame gained - balanced formula
    const attendanceMultiplier = 1.0 + Math.log10(Math.max(1, outcome.actual_attendance / 100)) * 0.5;
    const baseFame = (avgRating / 25) * 200;
    const fameGained = Math.floor(baseFame * Math.min(3.0, attendanceMultiplier));
    
    // Calculate individual member XP (higher for good performances)
    const memberXpBase = Math.floor(fameGained * 1.5);

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

    // === FAN CONVERSION CALCULATION ===
    const BASE_CONVERSION_RATE = 0.02;
    const GRADE_MULTIPLIERS: Record<string, number> = {
      'S': 3.0, 'A': 2.0, 'B': 1.5, 'C': 1.0, 'D': 0.5, 'F': 0.2
    };

    // Calculate new fans from this gig
    const gradeMultiplier = GRADE_MULTIPLIERS[performanceGrade] || 1.0;
    const ratingBonus = avgRating / 25; // 0-1 based on rating
    const famePenalty = Math.max(0.3, 1 - ((gig.bands.fame || 0) / 10000)); // Higher fame = harder to impress
    const conversionRate = BASE_CONVERSION_RATE * gradeMultiplier * (1 + ratingBonus) * famePenalty;
    
    const newFansTotal = Math.floor(outcome.actual_attendance * conversionRate);
    
    // Distribute into tiers based on performance
    let casualFans = 0, dedicatedFans = 0, superfans = 0;
    if (avgRating >= 22) {
      // Amazing show: more dedicated and superfans
      superfans = Math.floor(newFansTotal * 0.15);
      dedicatedFans = Math.floor(newFansTotal * 0.35);
      casualFans = newFansTotal - superfans - dedicatedFans;
    } else if (avgRating >= 16) {
      // Good show: mostly casual and some dedicated
      superfans = Math.floor(newFansTotal * 0.05);
      dedicatedFans = Math.floor(newFansTotal * 0.25);
      casualFans = newFansTotal - superfans - dedicatedFans;
    } else {
      // Average/poor show: mostly casual
      superfans = Math.floor(newFansTotal * 0.02);
      dedicatedFans = Math.floor(newFansTotal * 0.10);
      casualFans = newFansTotal - superfans - dedicatedFans;
    }

    console.log(`Fan conversion: ${newFansTotal} new fans (${casualFans} casual, ${dedicatedFans} dedicated, ${superfans} super)`);

    // Update outcome with final calculations including fan conversion
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
        new_followers: newFansTotal,
        casual_fans_gained: casualFans,
        dedicated_fans_gained: dedicatedFans,
        superfans_gained: superfans,
        completed_at: new Date().toISOString()
      })
      .eq('id', outcome.id);

    if (updateError) throw updateError;

    // Update band stats including total fans
    const newChemistry = Math.max(0, Math.min(100, (gig.bands.chemistry_level || 50) + chemistryChange));
    const newFame = Math.max(0, (gig.bands.fame || 0) + fameGained);
    const newBalance = (gig.bands.band_balance || 0) + netProfit;
    const newTotalFans = (gig.bands.total_fans || 0) + newFansTotal;
    const newCasualFans = (gig.bands.casual_fans || 0) + casualFans;
    const newDedicatedFans = (gig.bands.dedicated_fans || 0) + dedicatedFans;
    const newSuperfans = (gig.bands.superfans || 0) + superfans;

    const { error: bandError } = await supabaseClient
      .from('bands')
      .update({
        chemistry_level: newChemistry,
        fame: newFame,
        band_balance: newBalance,
        performance_count: (gig.bands.performance_count || 0) + 1,
        total_fans: newTotalFans,
        casual_fans: newCasualFans,
        dedicated_fans: newDedicatedFans,
        superfans: newSuperfans
      })
      .eq('id', gig.band_id);

    if (bandError) throw bandError;

    // Record fan conversion in gig_fan_conversions table if it exists
    try {
      await supabaseClient
        .from('gig_fan_conversions')
        .insert({
          gig_id: gigId,
          band_id: gig.band_id,
          venue_id: gig.venue_id,
          attendance: outcome.actual_attendance,
          new_fans: newFansTotal,
          casual_fans: casualFans,
          dedicated_fans: dedicatedFans,
          superfans: superfans,
          conversion_rate: conversionRate,
          performance_grade: performanceGrade
        });
    } catch (e) {
      console.log('gig_fan_conversions table may not exist, skipping');
    }

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

    console.log(`Gig ${gigId} completed successfully. Rating: ${avgRating.toFixed(1)}, Profit: $${netProfit}, New Fans: ${newFansTotal}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        outcome: {
          overall_rating: avgRating,
          net_profit: netProfit,
          fame_gained: fameGained,
          chemistry_change: chemistryChange,
          new_fans: newFansTotal,
          merch_items_sold: merchItemsSold,
          merch_revenue: merchRevenue
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
