import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createScheduledActivity } from "@/hooks/useActivityBooking";
import { toast } from "sonner";

interface BuskingScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationName?: string;
}

export function BuskingScheduleDialog({
  open,
  onOpenChange,
  locationName
}: BuskingScheduleDialogProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [hour, setHour] = useState("14");
  const [duration, setDuration] = useState("2");

  const handleSchedule = async () => {
    if (!date) {
      toast.error("Please select a date");
      return;
    }

    const scheduledStart = new Date(date);
    scheduledStart.setHours(parseInt(hour), 0, 0, 0);

    const scheduledEnd = new Date(scheduledStart);
    scheduledEnd.setHours(scheduledStart.getHours() + parseInt(duration));

    try {
      await createScheduledActivity({
        activityType: 'busking',
        scheduledStart,
        scheduledEnd,
        title: 'Busking Performance',
        description: locationName ? `At ${locationName}` : 'Street performance',
        location: locationName,
        metadata: { locationName },
      });

      toast.success("Busking session scheduled!");
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to schedule session");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule Busking Session</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Date</Label>
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              disabled={(date) => date < new Date()}
              className="rounded-md border"
            />
          </div>

          <div>
            <Label>Start Time</Label>
            <Select value={hour} onValueChange={setHour}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => (
                  <SelectItem key={i} value={i.toString()}>
                    {i.toString().padStart(2, '0')}:00
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Duration</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.5">30 minutes</SelectItem>
                <SelectItem value="1">1 hour</SelectItem>
                <SelectItem value="2">2 hours (Standard)</SelectItem>
                <SelectItem value="3">3 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSchedule} className="flex-1">
              Schedule Session
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
