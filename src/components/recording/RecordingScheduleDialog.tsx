import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createScheduledActivity } from "@/hooks/useActivityBooking";
import { toast } from "sonner";

interface RecordingScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  songTitle?: string;
  studioName?: string;
}

export function RecordingScheduleDialog({
  open,
  onOpenChange,
  songTitle,
  studioName
}: RecordingScheduleDialogProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [hour, setHour] = useState("10");
  const [duration, setDuration] = useState("4");

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
        activityType: 'recording',
        scheduledStart,
        scheduledEnd,
        title: songTitle ? `Recording: ${songTitle}` : 'Recording Session',
        description: studioName ? `At ${studioName}` : 'Studio recording session',
        location: studioName,
        metadata: { songTitle, studioName },
      });

      toast.success("Recording session scheduled!");
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to schedule session");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule Recording Session</DialogTitle>
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
                <SelectItem value="2">2 hours</SelectItem>
                <SelectItem value="4">4 hours (Standard)</SelectItem>
                <SelectItem value="6">6 hours</SelectItem>
                <SelectItem value="8">8 hours (Full Day)</SelectItem>
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
