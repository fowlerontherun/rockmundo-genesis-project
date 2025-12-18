import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronLeft, ChevronRight, Calendar, Clock, User, Music } from 'lucide-react';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GIG_SLOTS, getSlotBadgeVariant } from '@/utils/gigSlots';

interface VenueScheduleProps {
  venueId: string;
  venueName: string;
  currentBandId?: string;
  onSlotClick?: (date: Date, slotId: string) => void;
}

export const VenueSchedule = ({ venueId, venueName, currentBandId, onSlotClick }: VenueScheduleProps) => {
  const [startDate, setStartDate] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

  const { data: weekAvailability, isLoading } = useQuery({
    queryKey: ['venue-week-availability', venueId, startDate.toISOString()],
    queryFn: async () => {
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 7);

      const { data: gigs } = await supabase
        .from('gigs')
        .select(`
          id,
          scheduled_date,
          time_slot,
          band_id,
          bands(name)
        `)
        .eq('venue_id', venueId)
        .in('status', ['scheduled', 'in_progress'])
        .gte('scheduled_date', startDate.toISOString())
        .lt('scheduled_date', endDate.toISOString());

      // Group by date and slot
      const availability: Record<string, Record<string, { isBooked: boolean; bandName?: string; isYourBooking?: boolean }>> = {};
      
      for (let d = 0; d < 7; d++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(currentDate.getDate() + d);
        const dateKey = currentDate.toISOString().split('T')[0];
        availability[dateKey] = {};

        GIG_SLOTS.forEach(slot => {
          const matchingGig = gigs?.find(gig => {
            const gigDate = new Date(gig.scheduled_date).toISOString().split('T')[0];
            return gigDate === dateKey && gig.time_slot === slot.id;
          });

          availability[dateKey][slot.id] = {
            isBooked: !!matchingGig,
            bandName: matchingGig ? (matchingGig.bands as any)?.name : undefined,
            isYourBooking: matchingGig?.band_id === currentBandId
          };
        });
      }

      return availability;
    },
    enabled: !!venueId,
    staleTime: 30000
  });

  const weekStart = startOfWeek(startDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();

  const getSlotStatus = (dateKey: string, slotId: string): 'available' | 'booked' | 'your-booking' => {
    const dayData = weekAvailability?.[dateKey];
    if (!dayData) return 'available';
    
    const slotData = dayData[slotId];
    if (!slotData) return 'available';
    
    if (slotData.isYourBooking) return 'your-booking';
    if (slotData.isBooked) return 'booked';
    return 'available';
  };

  const getStatusColor = (status: 'available' | 'booked' | 'your-booking'): string => {
    switch (status) {
      case 'available':
        return 'bg-green-500/20 border-green-500/50 text-green-700 dark:text-green-400';
      case 'booked':
        return 'bg-red-500/20 border-red-500/50 text-red-700 dark:text-red-400';
      case 'your-booking':
        return 'bg-blue-500/20 border-blue-500/50 text-blue-700 dark:text-blue-400';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            Gig Schedule
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setStartDate(addDays(startDate, -7))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[140px] text-center">
              {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d')}
            </span>
            <Button variant="outline" size="icon" onClick={() => setStartDate(addDays(startDate, 7))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{venueName}</p>
      </CardHeader>
      <CardContent>
        {/* Legend */}
        <div className="flex items-center gap-4 mb-4 text-xs flex-wrap">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500/50 border border-green-500" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-500/50 border border-red-500" />
            <span>Booked</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-blue-500/50 border border-blue-500" />
            <span>Your Gig</span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-2 text-left text-sm font-medium border-b w-24">Slot</th>
                  {days.map(day => {
                    const isToday = isSameDay(day, today);
                    const isPast = day < today && !isToday;
                    return (
                      <th 
                        key={day.toISOString()} 
                        className={cn(
                          "p-2 text-center text-sm font-medium border-b min-w-[80px]",
                          isToday && "bg-primary/10",
                          isPast && "opacity-50"
                        )}
                      >
                        <div>{format(day, 'EEE')}</div>
                        <div className="text-xs text-muted-foreground">{format(day, 'MMM d')}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {GIG_SLOTS.map(slot => (
                  <tr key={slot.id}>
                    <td className="p-2 text-sm border-b">
                      <div className="font-medium">{slot.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {slot.startTime}
                      </div>
                    </td>
                    {days.map(day => {
                      const dateKey = day.toISOString().split('T')[0];
                      const status = getSlotStatus(dateKey, slot.id);
                      const bandName = weekAvailability?.[dateKey]?.[slot.id]?.bandName;
                      const isToday = isSameDay(day, today);
                      const isPast = day < today && !isToday;
                      const canBook = status === 'available' && !isPast;

                      return (
                        <td 
                          key={`${dateKey}-${slot.id}`} 
                          className={cn(
                            "p-1 border-b text-center",
                            isToday && "bg-primary/5"
                          )}
                        >
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => canBook && onSlotClick?.(day, slot.id)}
                                  disabled={!canBook}
                                  className={cn(
                                    "w-full h-10 rounded border transition-colors text-xs font-medium",
                                    getStatusColor(status),
                                    canBook && "hover:opacity-80 cursor-pointer",
                                    !canBook && "cursor-not-allowed",
                                    isPast && "opacity-40"
                                  )}
                                >
                                  {status === 'available' ? '✓' : status === 'your-booking' ? '★' : '×'}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-sm">
                                  <div className="font-medium">{slot.name}</div>
                                  <div>{format(day, 'EEEE, MMM d')}</div>
                                  <div>{slot.startTime} - {slot.endTime}</div>
                                  {bandName && (
                                    <div className="flex items-center gap-1 mt-1 text-muted-foreground">
                                      <User className="h-3 w-3" />
                                      {bandName}
                                    </div>
                                  )}
                                  {canBook && (
                                    <div className="mt-1 text-primary">Click to book</div>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
