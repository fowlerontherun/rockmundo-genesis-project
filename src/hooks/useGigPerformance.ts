import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calculateSongPerformance, calculateMerchSales, type PerformanceFactors } from "@/utils/gigPerformanceCalculator";

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

      // Calculate fame gained (based on performance and attendance)
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

      // Insert song performances
      const { error: perfError } = await supabase
        .from('gig_song_performances')
        .insert(songPerformances);

      if (perfError) throw perfError;

      // Insert gig outcome
      const { data: outcome, error: outcomeError } = await supabase
        .from('gig_outcomes')
        .insert([{
          gig_id: gigId,
          overall_rating: overallRating,
          actual_attendance: actualAttendance,
          attendance_percentage: (actualAttendance / venueCapacity) * 100,
          ticket_revenue: ticketRevenue,
          merch_sales: merchSales.totalRevenue,
          total_revenue: totalRevenue,
          crew_costs: crewCosts,
          equipment_wear_cost: Math.round(equipmentWearCost),
          net_profit: Math.round(netProfit),
          fame_gained: fameGained,
          chemistry_impact: chemistryImpact,
          breakdown_data: {
            equipment_quality: equipmentQuality,
            crew_skill: crewSkillLevel,
            band_chemistry: bandChemistry,
            member_skills: memberSkillAverage,
            merch_items_sold: merchSales.itemsSold
          }
        }])
        .select()
        .single();

      if (outcomeError) throw outcomeError;

      // Update gig status
      await supabase
        .from('gigs')
        .update({ status: 'completed' })
        .eq('id', gigId);

      // Update band stats
      if (band) {
        await supabase
          .from('bands')
          .update({
            fame: (band.fame || 0) + fameGained,
            chemistry_level: Math.max(0, Math.min(100, bandChemistry + chemistryImpact)),
            performance_count: (band.performance_count || 0) + 1
          })
          .eq('id', bandId);
      }

      return { outcome, songPerformances };
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
