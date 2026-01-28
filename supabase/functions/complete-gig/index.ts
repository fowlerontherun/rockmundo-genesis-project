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

    // Get gig and outcome with venue and city info for proper country tracking
    const { data: gig, error: gigError } = await supabaseClient
      .from('gigs')
      .select('*, bands!gigs_band_id_fkey(*), venues!gigs_venue_id_fkey(id, name, capacity, city_id, cities!venues_city_id_fkey(id, name, country)), ticket_operator_id')
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
    
    // === TICKET OPERATOR TOUT MECHANICS ===
    // If a ticket operator was used, calculate tout impact on attendance and fan gains
    let toutAttendanceReduction = 0;
    let actualAttendanceForFans = outcome.actual_attendance;
    let fanGainPenalty = 1.0;
    
    if (gig.ticket_operator_id) {
      // Tout levels by operator (match the frontend data)
      const OPERATOR_TOUT_LEVELS: Record<string, number> = {
        'feemaster': 0,
        'tickethoarder': 0.15,
        'seatsnatcher': 0.25,
        'queuemaster': 0.35,
        'clickfastloseanyway': 0.45
      };
      
      const toutLevel = OPERATOR_TOUT_LEVELS[gig.ticket_operator_id] || 0;
      
      if (toutLevel > 0) {
        // Touts buy tickets but don't attend (60% no-show rate for touted tickets)
        const toutedTickets = Math.floor(outcome.actual_attendance * toutLevel);
        const toutNoShows = Math.floor(toutedTickets * 0.6);
        toutAttendanceReduction = toutNoShows;
        actualAttendanceForFans = Math.max(0, outcome.actual_attendance - toutNoShows);
        
        // Fan gain penalty from touting (up to 40% reduction)
        fanGainPenalty = Math.max(0.6, 1 - (toutLevel * 0.4 / 0.45));
        
        console.log(`Ticket operator ${gig.ticket_operator_id} tout impact: ${toutedTickets} touted, ${toutNoShows} no-shows, ${fanGainPenalty.toFixed(2)} fan penalty`);
      }
    }
    
    // Calculate fans with tout penalty applied
    const baseFansFromAttendance = Math.floor(actualAttendanceForFans * conversionRate);
    const newFansTotal = Math.floor(baseFansFromAttendance * fanGainPenalty);
    
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

    console.log(`Fan conversion: ${newFansTotal} new fans (${casualFans} casual, ${dedicatedFans} dedicated, ${superfans} super)${toutAttendanceReduction > 0 ? ` [tout reduction: ${toutAttendanceReduction}]` : ''}`);

    // Update outcome with final calculations including fan conversion and tout impact
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
        tout_attendance_reduction: toutAttendanceReduction,
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

    // Add regional fame for the gig's country and city
    const venueCity = gig.venues?.cities;
    const venueCountry = venueCity?.country;
    const venueCityId = venueCity?.id;
    const venueCityName = venueCity?.name || 'Unknown City';
    
    if (venueCountry && gig.band_id) {
      try {
        // Update country-level fame and fans
        await supabaseClient.rpc("add_band_country_fame", {
          p_band_id: gig.band_id,
          p_country: venueCountry,
          p_fame_amount: fameGained,
          p_fans_amount: newFansTotal,
        });
        console.log(`Added ${fameGained} fame and ${newFansTotal} fans to ${venueCountry} for band`);
      } catch (e) {
        console.log('add_band_country_fame RPC may not exist, skipping regional fame:', e);
      }
      
      // Update city-level fans tracking
      if (venueCityId) {
        try {
          // Upsert to band_city_fans
          const { data: existingCityFans } = await supabaseClient
            .from('band_city_fans')
            .select('*')
            .eq('band_id', gig.band_id)
            .eq('city_id', venueCityId)
            .maybeSingle();
          
          if (existingCityFans) {
            await supabaseClient
              .from('band_city_fans')
              .update({
                total_fans: (existingCityFans.total_fans || 0) + newFansTotal,
                casual_fans: (existingCityFans.casual_fans || 0) + casualFans,
                dedicated_fans: (existingCityFans.dedicated_fans || 0) + dedicatedFans,
                superfans: (existingCityFans.superfans || 0) + superfans,
                city_fame: (existingCityFans.city_fame || 0) + fameGained,
                gigs_in_city: (existingCityFans.gigs_in_city || 0) + 1,
                last_gig_date: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingCityFans.id);
          } else {
            await supabaseClient
              .from('band_city_fans')
              .insert({
                band_id: gig.band_id,
                city_id: venueCityId,
                city_name: venueCityName,
                country: venueCountry,
                total_fans: newFansTotal,
                casual_fans: casualFans,
                dedicated_fans: dedicatedFans,
                superfans: superfans,
                city_fame: fameGained,
                gigs_in_city: 1,
                last_gig_date: new Date().toISOString(),
              });
          }
          console.log(`Updated city fans for ${venueCityName}: +${newFansTotal} fans`);
        } catch (e) {
          console.log('Error updating city fans:', e);
        }
      }
      
      // Record fame history for Today's News
      try {
        await supabaseClient
          .from('band_fame_history')
          .insert({
            band_id: gig.band_id,
            city_id: venueCityId,
            country: venueCountry,
            scope: 'city',
            event_type: 'gig',
            fame_value: (gig.bands.fame || 0) + fameGained,
            fame_change: fameGained,
          });
        console.log(`Recorded fame history: +${fameGained} fame in ${venueCityName}`);
      } catch (e) {
        console.log('Error recording fame history:', e);
      }
      
      // Distribute fans across demographics
      try {
        const { data: demographics } = await supabaseClient
          .from('age_demographics')
          .select('id, name, genre_preferences');
        
        if (demographics && demographics.length > 0) {
          const bandGenre = gig.bands.genre || 'rock';
          
          for (const demo of demographics) {
            // Calculate fan allocation based on genre preferences
            const genrePrefs = demo.genre_preferences as Record<string, number> | null;
            const genreMatch = genrePrefs?.[bandGenre] || 0.5;
            const demoFans = Math.floor(newFansTotal * (genreMatch / demographics.length));
            
            if (demoFans > 0) {
              const { data: existingDemo } = await supabaseClient
                .from('band_demographic_fans')
                .select('*')
                .eq('band_id', gig.band_id)
                .eq('demographic_id', demo.id)
                .eq('city_id', venueCityId)
                .maybeSingle();
              
              if (existingDemo) {
                await supabaseClient
                  .from('band_demographic_fans')
                  .update({
                    fan_count: (existingDemo.fan_count || 0) + demoFans,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', existingDemo.id);
              } else {
                await supabaseClient
                  .from('band_demographic_fans')
                  .insert({
                    band_id: gig.band_id,
                    demographic_id: demo.id,
                    city_id: venueCityId,
                    country: venueCountry,
                    fan_count: demoFans,
                  });
              }
            }
          }
          console.log(`Distributed fans across ${demographics.length} demographics`);
        }
      } catch (e) {
        console.log('Error distributing demographic fans:', e);
      }
    }

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

    // Create inbox message for band leader
    if (gig.bands?.leader_id) {
      const venueName = gig.venues?.name || 'Unknown Venue';
      const ratingStars = avgRating >= 20 ? '⭐⭐⭐⭐⭐' : avgRating >= 16 ? '⭐⭐⭐⭐' : avgRating >= 12 ? '⭐⭐⭐' : avgRating >= 8 ? '⭐⭐' : '⭐';
      
      await supabaseClient.from("player_inbox").insert({
        user_id: gig.bands.leader_id,
        category: "gig_result",
        priority: avgRating >= 20 ? "high" : "normal",
        title: avgRating >= 16 ? `🎸 Great Show at ${venueName}!` : `Gig Complete: ${venueName}`,
        message: `${ratingStars} Performance Rating: ${avgRating.toFixed(1)}/25\n💰 Net Profit: $${netProfit.toLocaleString()}\n👥 New Fans: ${newFansTotal}\n🎤 Attendance: ${outcome.actual_attendance}`,
        metadata: { 
          gig_id: gigId, 
          rating: avgRating, 
          profit: netProfit, 
          fans: newFansTotal,
          attendance: outcome.actual_attendance,
          merch_sold: merchItemsSold
        },
        action_type: "navigate",
        action_data: { route: "/gigs" },
        related_entity_type: "gig",
        related_entity_id: gigId,
      });
    }

    // Log first gig milestone if applicable
    if (gig.bands?.leader_id) {
      try {
        // Check if this is the band's first completed gig
        const { count: completedGigsCount } = await supabaseClient
          .from('gigs')
          .select('id', { count: 'exact', head: true })
          .eq('band_id', gig.band_id)
          .eq('status', 'completed');

        if (completedGigsCount === 1) {
          // This is the first gig! Log the milestone
          const venueName = gig.venues?.name || 'Unknown Venue';
          await supabaseClient.functions.invoke('log-career-milestone', {
            body: {
              profile_id: gig.bands.leader_id,
              band_id: gig.band_id,
              milestone_type: 'first_gig_completed',
              title: '🎸 First Gig Completed!',
              metadata: {
                venue: venueName,
                attendance: outcome.actual_attendance,
                rating: avgRating.toFixed(1),
                gig_id: gigId,
              },
              related_entity_type: 'gig',
              related_entity_id: gigId,
            },
          });
          console.log('First gig milestone logged');
        }
      } catch (milestoneError) {
        console.log('Error logging milestone (non-critical):', milestoneError);
      }
    }

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
