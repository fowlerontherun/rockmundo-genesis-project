import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Clock, CalendarIcon, CheckCircle, AlertCircle, Ban } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { STUDIO_SLOTS, FacilitySlot, getSlotTimeRange } from '@/utils/facilitySlots';
import { useStudioAvailability } from '@/hooks/useStudioAvailability';
import { isSlotInPast } from '@/utils/timeSlotValidation';

interface StudioSlotSelectorProps {
  studioId: string;
  studioName: string;
  currentBandId?: string | null;
  selectedDate: Date;
  selectedSlotId: string;
  onDateChange: (date: Date) => void;
  onSlotChange: (slotId: string) => void;
}

export const StudioSlotSelector = ({
  studioId,
  studioName,
  currentBandId,
  selectedDate,
  selectedSlotId,
  onDateChange,
  onSlotChange
}: StudioSlotSelectorProps) => {
  const { data: slotAvailability, isLoading } = useStudioAvailability(
    studioId,
    selectedDate,
    currentBandId,
    !!studioId
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Select Recording Time
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Date Selection */}
        <div className="space-y-2">
          <Label>Recording Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !selectedDate && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, 'PPP') : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  if (date) {
                    onDateChange(date);
                    onSlotChange(''); // Reset slot when date changes
                  }
                }}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Time Slot Selection */}
        <div className="space-y-2">
          <Label>Time Slot at {studioName}</Label>
          {isLoading ? (
            <div className="flex justify-center py-4">
              <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary" />
            </div>
          ) : (
            <RadioGroup value={selectedSlotId} onValueChange={onSlotChange}>
              <div className="grid grid-cols-2 gap-2">
              {STUDIO_SLOTS.map((slot) => {
                  const slotData = slotAvailability?.find(s => s.slot.id === slot.id);
                  const isBooked = slotData?.isBooked || false;
                  const isYourBooking = slotData?.isYourBooking || false;
                  const bookedBy = slotData?.bookedByBand;
                  const isPast = selectedDate && isSlotInPast(slot, selectedDate);
                  const canSelect = !isBooked && !isPast;

                  return (
                    <div
                      key={slot.id}
                      className={cn(
                        'flex items-center space-x-2 rounded-lg border p-3 transition-colors',
                        selectedSlotId === slot.id && 'border-primary bg-primary/5',
                        isPast && 'bg-muted/50 border-muted opacity-60 cursor-not-allowed',
                        isBooked && !isYourBooking && !isPast && 'bg-red-500/10 border-red-500/30',
                        isYourBooking && !isPast && 'bg-blue-500/10 border-blue-500/30',
                        !canSelect && !isPast && 'opacity-50 cursor-not-allowed',
                        canSelect && 'cursor-pointer hover:bg-accent/50'
                      )}
                      onClick={() => canSelect && onSlotChange(slot.id)}
                    >
                      <RadioGroupItem value={slot.id} disabled={!canSelect} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <Label className={cn(
                            "text-sm font-medium",
                            canSelect && "cursor-pointer",
                            isPast && "text-muted-foreground"
                          )}>{slot.name}</Label>
                          {isPast ? (
                            <Badge variant="secondary" className="text-xs">
                              <Ban className="h-3 w-3 mr-1" />
                              Passed
                            </Badge>
                          ) : isBooked ? (
                            <Badge variant="destructive" className="text-xs">
                              {isYourBooking ? 'Your session' : 'Booked'}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs bg-green-500/10 text-green-700 dark:text-green-400">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Available
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3" />
                          {slot.startTime} - {slot.endTime} ({slot.duration}h)
                        </div>
                        {bookedBy && !isYourBooking && !isPast && (
                          <p className="text-xs text-destructive mt-1">{bookedBy}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </RadioGroup>
          )}
        </div>

        {selectedSlotId && (
          <div className="flex items-center gap-2 p-2 rounded bg-primary/10 text-sm">
            <CheckCircle className="h-4 w-4 text-primary" />
            <span>
              Session on {format(selectedDate, 'MMM d')} at{' '}
              {STUDIO_SLOTS.find(s => s.id === selectedSlotId)?.startTime}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
