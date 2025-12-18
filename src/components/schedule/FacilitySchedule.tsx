import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronLeft, ChevronRight, Calendar, Clock, User } from 'lucide-react';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { FacilitySlot, getSlotStatusColor } from '@/utils/facilitySlots';

interface SlotData {
  isBooked: boolean;
  bandName?: string;
  isYourBooking?: boolean;
}

interface FacilityScheduleProps {
  title: string;
  facilityName: string;
  slots: FacilitySlot[];
  weekAvailability: Record<string, Record<string, SlotData>> | undefined;
  isLoading: boolean;
  onSlotClick?: (date: Date, slot: FacilitySlot) => void;
  startDate: Date;
  onDateChange: (date: Date) => void;
}

export const FacilitySchedule = ({
  title,
  facilityName,
  slots,
  weekAvailability,
  isLoading,
  onSlotClick,
  startDate,
  onDateChange
}: FacilityScheduleProps) => {
  const weekStart = startOfWeek(startDate, { weekStartsOn: 1 }); // Monday

  const handlePrevWeek = () => {
    onDateChange(addDays(startDate, -7));
  };

  const handleNextWeek = () => {
    onDateChange(addDays(startDate, 7));
  };

  const getDaysOfWeek = () => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  };

  const getSlotStatus = (dateKey: string, slotId: string): 'available' | 'booked' | 'your-booking' => {
    const dayData = weekAvailability?.[dateKey];
    if (!dayData) return 'available';
    
    const slotData = dayData[slotId];
    if (!slotData) return 'available';
    
    if (slotData.isYourBooking) return 'your-booking';
    if (slotData.isBooked) return 'booked';
    return 'available';
  };

  const getSlotBandName = (dateKey: string, slotId: string): string | undefined => {
    return weekAvailability?.[dateKey]?.[slotId]?.bandName;
  };

  const days = getDaysOfWeek();
  const today = new Date();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {title}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrevWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[140px] text-center">
              {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
            </span>
            <Button variant="outline" size="icon" onClick={handleNextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{facilityName}</p>
      </CardHeader>
      <CardContent>
        {/* Legend */}
        <div className="flex items-center gap-4 mb-4 text-xs">
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
            <span>Your Booking</span>
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
                {slots.map(slot => (
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
                      const bandName = getSlotBandName(dateKey, slot.id);
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
                                  onClick={() => canBook && onSlotClick?.(day, slot)}
                                  disabled={!canBook}
                                  className={cn(
                                    "w-full h-10 rounded border transition-colors text-xs font-medium",
                                    getSlotStatusColor(status),
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
