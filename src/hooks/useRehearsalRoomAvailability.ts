import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { REHEARSAL_SLOTS, FacilitySlot, getSlotTimeRange } from "@/utils/facilitySlots";
import { startOfDay, endOfDay } from "date-fns";

export interface RehearsalSlotAvailability {
  slot: FacilitySlot;
  isAvailable: boolean;
  isBooked: boolean;
  bookedByBand?: string;
  bookingId?: string;
  isYourBooking?: boolean;
}

export function useRehearsalRoomAvailability(
  roomId: string | undefined,
  date: Date | undefined,
  currentBandId?: string | null,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['rehearsal-room-availability', roomId, date?.toISOString(), currentBandId],
    queryFn: async (): Promise<RehearsalSlotAvailability[]> => {
      if (!roomId || !date) return [];

      // Fetch rehearsals for this room and date
      const { data: rehearsals } = await supabase
        .from('band_rehearsals')
        .select(`
          id,
          scheduled_start,
          scheduled_end,
          band_id,
          bands(name)
        `)
        .eq('rehearsal_room_id', roomId)
        .in('status', ['scheduled', 'in_progress'])
        .gte('scheduled_start', startOfDay(date).toISOString())
        .lt('scheduled_start', endOfDay(date).toISOString());

      return REHEARSAL_SLOTS.map(slot => {
        const { start, end } = getSlotTimeRange(slot, date);
        
        // Find if any rehearsal overlaps with this slot
        const overlappingRehearsal = rehearsals?.find(rehearsal => {
          const rehearsalStart = new Date(rehearsal.scheduled_start);
          const rehearsalEnd = new Date(rehearsal.scheduled_end);
          
          // Check if rehearsal overlaps with slot
          return rehearsalStart < end && rehearsalEnd > start;
        });

        const isBooked = !!overlappingRehearsal;
        const isYourBooking = overlappingRehearsal?.band_id === currentBandId;

        return {
          slot,
          isAvailable: !isBooked,
          isBooked,
          bookedByBand: isBooked ? (overlappingRehearsal?.bands as any)?.name || 'Another band' : undefined,
          bookingId: overlappingRehearsal?.id,
          isYourBooking
        };
      });
    },
    enabled: enabled && !!roomId && !!date,
    staleTime: 30000 // 30 seconds
  });
}

export function useRehearsalRoomWeekAvailability(
  roomId: string | undefined,
  startDate: Date | undefined,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['rehearsal-room-week-availability', roomId, startDate?.toISOString()],
    queryFn: async () => {
      if (!roomId || !startDate) return {};

      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 7);

      const { data: rehearsals } = await supabase
        .from('band_rehearsals')
        .select(`
          id,
          scheduled_start,
          scheduled_end,
          band_id,
          bands(name)
        `)
        .eq('rehearsal_room_id', roomId)
        .in('status', ['scheduled', 'in_progress'])
        .gte('scheduled_start', startDate.toISOString())
        .lt('scheduled_start', endDate.toISOString());

      // Group by date and slot
      const availability: Record<string, Record<string, { isBooked: boolean; bandName?: string }>> = {};
      
      for (let d = 0; d < 7; d++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(currentDate.getDate() + d);
        const dateKey = currentDate.toISOString().split('T')[0];
        availability[dateKey] = {};

        REHEARSAL_SLOTS.forEach(slot => {
          const { start, end } = getSlotTimeRange(slot, currentDate);
          
          const overlappingRehearsal = rehearsals?.find(rehearsal => {
            const rehearsalStart = new Date(rehearsal.scheduled_start);
            const rehearsalEnd = new Date(rehearsal.scheduled_end);
            return rehearsalStart < end && rehearsalEnd > start;
          });

          availability[dateKey][slot.id] = {
            isBooked: !!overlappingRehearsal,
            bandName: overlappingRehearsal ? (overlappingRehearsal.bands as any)?.name : undefined
          };
        });
      }

      return availability;
    },
    enabled: enabled && !!roomId && !!startDate,
    staleTime: 60000 // 1 minute
  });
}
