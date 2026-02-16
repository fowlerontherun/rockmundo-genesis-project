import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calculateSongPerformance, calculateMerchSales, type PerformanceFactors } from "@/utils/gigPerformanceCalculator";
import { markCountryAsPerformed } from "@/utils/regionalFame";

export interface GigPerformanceData {
  gigId: string;
  bandId: string;
  venueCapacity: number;
  actualAttendance: number;
  ticketPrice: number;
}

export const useEquipment = (bandId: string | null) => {
  return useQuery({
    queryKey: ['band-equipment', bandId],
    queryFn: async () => {
      if (!bandId) return [];
      
      const { data, error } = await supabase
        .from('band_stage_equipment')
        .select('*')
        .eq('band_id', bandId);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!bandId
  });
};

export const useCrew = (bandId: string | null) => {
  return useQuery({
    queryKey: ['band-crew', bandId],
    queryFn: async () => {
      if (!bandId) return [];
      
      const { data, error } = await supabase
        .from('band_crew_members')
        .select('*')
        .eq('band_id', bandId);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!bandId
  });
};

export const useMerchandise = (bandId: string | null) => {
  return useQuery({
    queryKey: ['player-merchandise', bandId],
    queryFn: async () => {
      if (!bandId) return [];
      
      const { data, error } = await supabase
        .from('player_merchandise')
        .select('*')
        .eq('band_id', bandId)
        .gt('stock_quantity', 0);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!bandId
  });
};

export const useSongRehearsals = (bandId: string | null, songIds: string[]) => {
  return useQuery({
    queryKey: ['song-rehearsals', bandId, songIds],
    queryFn: async () => {
      if (!bandId || songIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('song_rehearsals')
        .select('*')
        .eq('band_id', bandId)
        .in('song_id', songIds);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!bandId && songIds.length > 0
  });
};

export const useCompleteGigPerformance = () => {
  return useMutation({
    mutationFn: async ({
      gigId,
      bandId,
      setlistSongs,
      venueCapacity,
      actualAttendance,
      ticketPrice,
    }: {
      gigId: string;
      bandId: string;
      setlistSongs: Array<{ id: string; quality_score: number; position: number }>;
      venueCapacity: number;
      actualAttendance: number;
      ticketPrice: number;
    }) => {
      // Fetch all necessary data
      const [equipmentRes, crewRes, rehearsalsRes, bandRes, membersRes, merchRes] = await Promise.all([
        supabase.from('band_stage_equipment').select('*').eq('band_id', bandId),
        supabase.from('band_crew_members').select('*').eq('band_id', bandId),
        supabase.from('song_rehearsals').select('*').eq('band_id', bandId).in('song_id', setlistSongs.map(s => s.id)),
        supabase.from('bands').select('chemistry_level, fame, performance_count').eq('id', bandId).single(),
        supabase.from('band_members').select('*').eq('band_id', bandId),
        supabase.from('player_merchandise').select('*').eq('band_id', bandId).gt('stock_quantity', 0)
      ]);

      const equipment = equipmentRes.data || [];
      const crew = crewRes.data || [];
      const rehearsals = rehearsalsRes.data || [];
      const band = bandRes.data;
      const members = membersRes.data || [];
      const merch = merchRes.data || [];

      // Calculate average equipment quality (default to 40 if none)
      const equipmentQuality = equipment.length > 0
        ? equipment.reduce((sum, eq) => sum + eq.quality_rating, 0) / equipment.length
        : 40;

      // Calculate average crew skill (default to 40 if none)
      const crewSkillLevel = crew.length > 0
        ? crew.reduce((sum, c) => sum + c.skill_level, 0) / crew.length
        : 40;

      // Calculate band chemistry level
      const bandChemistry = band?.chemistry_level || 0;

      // Calculate member skill average from individual members
      let totalSkills = 0;
      for (const member of members) {
        totalSkills += member.skill_contribution || 50; // Use stored contribution or default
      }
      const memberSkillAverage = members.length > 0 ? totalSkills / members.length : 50;

      // Calculate venue capacity utilization
      const venueCapacityUsed = (actualAttendance / venueCapacity) * 100;

      // Calculate performance for each song
      const songPerformances = setlistSongs.map(song => {
        const rehearsal = rehearsals.find(r => r.song_id === song.id);
        const rehearsalLevel = rehearsal?.rehearsal_level || 0;

        const factors: PerformanceFactors = {
          songQuality: song.quality_score,
          rehearsalLevel,
          bandChemistry,
          equipmentQuality,
          crewSkillLevel,
          memberSkillAverage,
          venueCapacityUsed
        };

        const result = calculateSongPerformance(factors);

        return {
          gig_id: gigId,
          song_id: song.id,
          setlist_position: song.position,
          performance_score: result.score,
          song_quality_contribution: result.breakdown.songQuality,
          rehearsal_contribution: result.breakdown.rehearsal,
          chemistry_contribution: result.breakdown.chemistry,
          equipment_contribution: result.breakdown.equipment,
          crew_contribution: result.breakdown.crew,
          member_skills_contribution: result.breakdown.memberSkills,
          crowd_response: result.crowdResponse
        };
      });

      // Calculate overall rating
      const overallRating = songPerformances.reduce((sum, p) => sum + p.performance_score, 0) / songPerformances.length;

      // Calculate merch sales
      const merchSales = calculateMerchSales(
        actualAttendance,
        band?.fame || 0,
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

      // Get active band count for market bonus (early game boost)
      const { count: activeBandCount } = await supabase
        .from('bands')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
      
      // Market scarcity bonus: fewer bands = more attention (max 10x at 10 bands, 1x at 100+)
      const marketBonus = Math.max(1, Math.min(10, 100 / (activeBandCount || 100)));
      
      // Calculate fame gained (based on performance and attendance) with market bonus
      const baseFame = (overallRating / 25) * actualAttendance * 0.8; // Increased from 0.5 to 0.8
      const fameGained = Math.round(baseFame * marketBonus);
      
      // Calculate XP to award (scales with fame gained)
      const baseXp = Math.round(fameGained * 2); // Increased from 1.5 to 2

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

      // Get performance grade
      const { getPerformanceGrade } = await import('@/utils/gigPerformanceCalculator');
      const gradeData = getPerformanceGrade(overallRating);

      // First insert the outcome to get the ID
      const { data: outcome, error: outcomeError } = await supabase
        .from('gig_outcomes')
        .insert([{
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
        }])
        .select()
        .single();

      if (outcomeError) throw outcomeError;

      // Now insert song performances with the outcome ID
      const songPerformancesWithOutcome = songPerformances.map((sp: any) => ({
        gig_outcome_id: outcome.id,
        song_id: sp.song_id,
        position: sp.setlist_position,
        performance_score: sp.performance_score,
        crowd_response: sp.crowd_response,
        song_quality_contrib: sp.song_quality_contribution,
        rehearsal_contrib: sp.rehearsal_contribution,
        chemistry_contrib: sp.chemistry_contribution,
        equipment_contrib: sp.equipment_contribution,
        crew_contrib: sp.crew_contribution,
        member_skill_contrib: sp.member_skills_contribution
      }));

      const { error: perfError } = await supabase
        .from('gig_song_performances')
        .insert(songPerformancesWithOutcome);

      if (outcomeError) throw outcomeError;

      // Update gig status
      await supabase
        .from('gigs')
        .update({ status: 'completed' })
        .eq('id', gigId);

      // Mark the country as performed for radio access
      const { data: gigVenue } = await supabase
        .from('gigs')
        .select('venues!inner(city_id, cities!inner(country))')
        .eq('id', gigId)
        .maybeSingle();
      
      const gigCountry = (gigVenue as any)?.venues?.cities?.country;
      if (gigCountry) {
        await markCountryAsPerformed(bandId, gigCountry);
      }

      // Update band stats and balance
      if (band) {
        const { data: currentBand } = await supabase
          .from('bands')
          .select('band_balance')
          .eq('id', bandId)
          .single();

        const newBalance = (currentBand?.band_balance || 0) + Math.round(netProfit);

        await supabase
          .from('bands')
          .update({
            fame: (band.fame || 0) + fameGained,
            chemistry_level: Math.max(0, Math.min(100, bandChemistry + chemistryImpact)),
            performance_count: (band.performance_count || 0) + 1,
            band_balance: newBalance
          })
          .eq('id', bandId);

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
      }

      // Award XP to each band member
      const nonTouringMembers = members.filter(m => !m.is_touring_member && m.user_id);
      if (nonTouringMembers.length > 0 && baseXp > 0) {
        const xpPerMember = Math.max(10, Math.floor(baseXp / nonTouringMembers.length));
        
        for (const member of nonTouringMembers) {
          if (!member.user_id) continue;
          
          // Get profile for user
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('user_id', member.user_id)
            .single();
          
          if (!profile) continue;
          
          // Add to experience ledger
          await supabase
            .from('experience_ledger')
            .insert({
              user_id: member.user_id,
              profile_id: profile.id,
              activity_type: 'gig_performance',
              xp_amount: xpPerMember,
              metadata: {
                gig_id: gigId,
                band_id: bandId,
                rating: overallRating.toFixed(1),
                attendance: actualAttendance,
                fame_gained: fameGained,
                market_bonus: marketBonus
              }
            });
          
          // Update XP wallet
          const { data: wallet } = await supabase
            .from('player_xp_wallet')
            .select('xp_balance, lifetime_xp')
            .eq('profile_id', profile.id)
            .single();
          
          if (wallet) {
            await supabase
              .from('player_xp_wallet')
              .update({
                xp_balance: (wallet.xp_balance || 0) + xpPerMember,
                lifetime_xp: (wallet.lifetime_xp || 0) + xpPerMember
              })
              .eq('profile_id', profile.id);
          } else {
            await supabase
              .from('player_xp_wallet')
              .insert({
                profile_id: profile.id,
                xp_balance: xpPerMember,
                lifetime_xp: xpPerMember,
                xp_spent: 0
              });
          }
        }
        
        console.log(`Awarded ${xpPerMember} XP to ${nonTouringMembers.length} band members for gig performance`);
      }

      return { outcome, songPerformances, fameGained, xpAwarded: baseXp };
    }
  });
};

export const useGigOutcome = (gigId: string | null) => {
  return useQuery({
    queryKey: ['gig-outcome', gigId],
    queryFn: async () => {
      if (!gigId) return null;
      
      const { data, error } = await supabase
        .from('gig_outcomes')
        .select('*, gig_song_performances(*)')
        .eq('gig_id', gigId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }
      return data;
    },
    enabled: !!gigId
  });
};
