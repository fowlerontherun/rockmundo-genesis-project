import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GIG_SLOTS, GigSlot } from "@/utils/gigSlots";
import { startOfDay, endOfDay } from "date-fns";

export interface SlotAvailability {
  slot: GigSlot;
  isAvailable: boolean;
  isBooked: boolean;
  bookedByBand?: string;
  meetsRequirements: boolean;
  requirementsNotMet?: string[];
}

export function useSlotAvailability(
  venueId: string | undefined,
  date: Date | undefined,
  bandFame: number,
  venuePrestige: number,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['slot-availability', venueId, date?.toISOString(), bandFame, venuePrestige],
    queryFn: async () => {
      if (!venueId || !date) return [];

      // Fetch booked gigs for this venue and date
      const { data: bookedGigs } = await supabase
        .from('gigs')
        .select(`
          time_slot,
          band_id,
          bands!inner(name)
        `)
        .eq('venue_id', venueId)
        .in('status', ['scheduled', 'in_progress'])
        .gte('scheduled_date', startOfDay(date).toISOString())
        .lt('scheduled_date', endOfDay(date).toISOString());

      const bookedSlotsMap = new Map(
        bookedGigs?.map(g => [g.time_slot, (g.bands as any)?.name]) || []
      );

      return GIG_SLOTS.map(slot => {
        const isBooked = bookedSlotsMap.has(slot.id);
        const meetsPrestige = venuePrestige >= slot.minPrestigeLevel;
        const meetsFame = bandFame >= slot.minBandFame;
        
        const requirementsNotMet: string[] = [];
        if (!meetsPrestige) {
          requirementsNotMet.push(`Venue prestige ${slot.minPrestigeLevel}+ required`);
        }
        if (!meetsFame) {
          requirementsNotMet.push(`${slot.minBandFame}+ fame required`);
        }

        return {
          slot,
          isAvailable: !isBooked,
          isBooked,
          bookedByBand: isBooked ? bookedSlotsMap.get(slot.id) : undefined,
          meetsRequirements: meetsPrestige && meetsFame,
          requirementsNotMet: requirementsNotMet.length > 0 ? requirementsNotMet : undefined
        };
      });
    },
    enabled: enabled && !!venueId && !!date
  });
}
