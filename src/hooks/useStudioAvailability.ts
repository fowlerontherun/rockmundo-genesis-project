import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { STUDIO_SLOTS, FacilitySlot, getSlotTimeRange } from "@/utils/facilitySlots";
import { startOfDay, endOfDay } from "date-fns";

export interface StudioSlotAvailability {
  slot: FacilitySlot;
  isAvailable: boolean;
  isBooked: boolean;
  bookedByBand?: string;
  bookingId?: string;
  isYourBooking?: boolean;
}

export function useStudioAvailability(
  studioId: string | undefined,
  date: Date | undefined,
  currentBandId?: string | null,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['studio-availability', studioId, date?.toISOString(), currentBandId],
    queryFn: async (): Promise<StudioSlotAvailability[]> => {
      if (!studioId || !date) return [];

      // Fetch recording sessions for this studio and date
      const { data: sessions } = await supabase
        .from('recording_sessions')
        .select(`
          id,
          scheduled_start,
          scheduled_end,
          band_id,
          bands(name)
        `)
        .eq('studio_id', studioId)
        .in('status', ['scheduled', 'in_progress'])
        .gte('scheduled_start', startOfDay(date).toISOString())
        .lt('scheduled_start', endOfDay(date).toISOString());

      return STUDIO_SLOTS.map(slot => {
        const { start, end } = getSlotTimeRange(slot, date);
        
        // Find if any session overlaps with this slot
        const overlappingSession = sessions?.find(session => {
          const sessionStart = new Date(session.scheduled_start);
          const sessionEnd = session.scheduled_end ? new Date(session.scheduled_end) : null;
          
          // Check if session overlaps with slot
          return sessionStart < end && (!sessionEnd || sessionEnd > start);
        });

        const isBooked = !!overlappingSession;
        const isYourBooking = overlappingSession?.band_id === currentBandId;

        return {
          slot,
          isAvailable: !isBooked,
          isBooked,
          bookedByBand: isBooked ? (overlappingSession?.bands as any)?.name || 'Another band' : undefined,
          bookingId: overlappingSession?.id,
          isYourBooking
        };
      });
    },
    enabled: enabled && !!studioId && !!date,
    staleTime: 30000 // 30 seconds
  });
}

export function useStudioWeekAvailability(
  studioId: string | undefined,
  startDate: Date | undefined,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['studio-week-availability', studioId, startDate?.toISOString()],
    queryFn: async () => {
      if (!studioId || !startDate) return {};

      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 7);

      const { data: sessions } = await supabase
        .from('recording_sessions')
        .select(`
          id,
          scheduled_start,
          scheduled_end,
          band_id,
          bands(name)
        `)
        .eq('studio_id', studioId)
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

        STUDIO_SLOTS.forEach(slot => {
          const { start, end } = getSlotTimeRange(slot, currentDate);
          
          const overlappingSession = sessions?.find(session => {
            const sessionStart = new Date(session.scheduled_start);
            const sessionEnd = session.scheduled_end ? new Date(session.scheduled_end) : null;
            return sessionStart < end && (!sessionEnd || sessionEnd > start);
          });

          availability[dateKey][slot.id] = {
            isBooked: !!overlappingSession,
            bandName: overlappingSession ? (overlappingSession.bands as any)?.name : undefined
          };
        });
      }

      return availability;
    },
    enabled: enabled && !!studioId && !!startDate,
    staleTime: 60000 // 1 minute
  });
}
