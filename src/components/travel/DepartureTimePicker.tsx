import { useState, useMemo } from "react";
import { format, addDays, isSameDay } from "date-fns";
import { Calendar, Clock, ArrowRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getAvailableDepartures,
  getTransportSchedule,
  getNextAvailableDeparture,
  calculateArrivalTime,
  formatHourToTime,
  DepartureSlot,
} from "@/utils/transportSchedules";

interface DepartureTimePickerProps {
  transportType: string;
  durationHours: number;
  selectedDate: Date | null;
  selectedHour: number | null;
  onDateChange: (date: Date) => void;
  onHourChange: (hour: number) => void;
  maxDaysAhead?: number;
}

export function DepartureTimePicker({
  transportType,
  durationHours,
  selectedDate,
  selectedHour,
  onDateChange,
  onHourChange,
  maxDaysAhead = 14,
}: DepartureTimePickerProps) {
  const schedule = getTransportSchedule(transportType);
  
  // Generate available dates (today + next N days)
  const availableDates = useMemo(() => {
    const dates: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < maxDaysAhead; i++) {
      dates.push(addDays(today, i));
    }
    return dates;
  }, [maxDaysAhead]);

  // Get departure slots for selected date
  const departureSlots = useMemo(() => {
    if (!selectedDate) return [];
    return getAvailableDepartures(transportType, selectedDate);
  }, [transportType, selectedDate]);

  // Calculate arrival time
  const arrivalTime = useMemo(() => {
    if (!selectedDate || selectedHour === null) return null;
    return calculateArrivalTime(selectedDate, selectedHour, durationHours);
  }, [selectedDate, selectedHour, durationHours]);

  // Handle "Next Available" button
  const handleNextAvailable = () => {
    const next = getNextAvailableDeparture(transportType);
    onDateChange(next.date);
    onHourChange(next.hour);
  };

  // Format date for display
  const formatDateLabel = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = addDays(today, 1);

    if (isSameDay(date, today)) return "Today";
    if (isSameDay(date, tomorrow)) return "Tomorrow";
    return format(date, "EEE, MMM d");
  };

  // Check if slot is selected
  const isSlotSelected = (hour: number) => selectedHour === hour;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Schedule Departure
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextAvailable}
            className="h-7 text-xs"
          >
            <Zap className="h-3 w-3 mr-1" />
            Next Available
          </Button>
        </CardTitle>
        <p className="text-xs text-muted-foreground">{schedule.label}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Date Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Select Date
          </label>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {availableDates.slice(0, 7).map((date) => (
              <Button
                key={date.toISOString()}
                variant={selectedDate && isSameDay(date, selectedDate) ? "default" : "outline"}
                size="sm"
                onClick={() => onDateChange(date)}
                className={cn(
                  "flex-shrink-0 min-w-[80px]",
                  selectedDate && isSameDay(date, selectedDate) && "ring-2 ring-primary"
                )}
              >
                {formatDateLabel(date)}
              </Button>
            ))}
          </div>
        </div>

        {/* Time Slot Selection */}
        {selectedDate && (
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Select Time
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
              {departureSlots.map((slot) => (
                <Button
                  key={slot.hour}
                  variant={isSlotSelected(slot.hour) ? "default" : "outline"}
                  size="sm"
                  disabled={!slot.available}
                  onClick={() => onHourChange(slot.hour)}
                  className={cn(
                    "text-xs",
                    !slot.available && "opacity-40 line-through",
                    isSlotSelected(slot.hour) && "ring-2 ring-primary"
                  )}
                >
                  {slot.label}
                </Button>
              ))}
            </div>
            {departureSlots.filter(s => !s.available).length > 0 && (
              <p className="text-xs text-muted-foreground">
                Grayed out times have already passed
              </p>
            )}
          </div>
        )}

        {/* Journey Summary */}
        {selectedDate && selectedHour !== null && arrivalTime && (
          <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex-1">
              <div className="text-xs text-muted-foreground">Depart</div>
              <div className="font-semibold">
                {formatDateLabel(selectedDate)}, {formatHourToTime(selectedHour)}
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-primary" />
            <div className="flex-1 text-right">
              <div className="text-xs text-muted-foreground">Arrive</div>
              <div className="font-semibold">
                {format(arrivalTime, "EEE, MMM d")}, {format(arrivalTime, "h:mm a")}
              </div>
            </div>
          </div>
        )}

        {/* Duration Badge */}
        <div className="flex justify-center">
          <Badge variant="secondary" className="text-xs">
            Journey time: {durationHours < 1 
              ? `${Math.round(durationHours * 60)} minutes`
              : `${Math.floor(durationHours)}h ${Math.round((durationHours % 1) * 60)}m`
            }
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
