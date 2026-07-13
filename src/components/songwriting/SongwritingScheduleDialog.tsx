import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import logger from "@/lib/logger";
import { addDurationHours, buildScheduledDateTime, validateBookingWindow } from "@/utils/activityBookingTime";

interface SongwritingScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  projectTitle?: string;
  projectStatus?: string;
  profileId?: string | null;
}

export function SongwritingScheduleDialog({
  open,
  onOpenChange,
  projectId,
  projectTitle,
  projectStatus,
  profileId
}: SongwritingScheduleDialogProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [hour, setHour] = useState("9");
  const [duration, setDuration] = useState("1");
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();

  const handleSchedule = async () => {
    if (isSaving) return;
    if (!profileId) {
      toast.error("Select an active character before scheduling songwriting.");
      return;
    }
    if (!projectId) {
      toast.error("Select a songwriting project before scheduling.");
      return;
    }
    if (projectStatus === "completed" || projectStatus === "converted") {
      toast.error("The selected project is no longer available.");
      return;
    }
    if (!date) {
      toast.error("Please select a date");
      return;
    }

    const scheduledStart = buildScheduledDateTime(date, parseInt(hour));
    const scheduledEnd = addDurationHours(scheduledStart, Number(duration));
    if (scheduledStart <= new Date()) {
      toast.error("That time is in the past.");
      return;
    }
    const bookingError = validateBookingWindow(scheduledStart, scheduledEnd);
    if (bookingError) {
      toast.error(bookingError);
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await (supabase as any).rpc("schedule_songwriting_session", {
        p_profile_id: profileId,
        p_project_id: projectId,
        p_scheduled_start: scheduledStart.toISOString(),
        p_effort_hours: Number(duration),
        p_session_type: "balanced",
        p_idempotency_key: `schedule-${profileId}-${projectId}-${scheduledStart.toISOString()}-${duration}`,
      });
      if (error) {
        logger.error("Songwriting schedule RPC failed", {
          action: "schedule_songwriting_session",
          rpc: "schedule_songwriting_session",
          profileId,
          projectId,
          userId: user?.id,
          duration: Number(duration),
          scheduledStart: scheduledStart.toISOString(),
          postgrestCode: (error as any).code,
          httpStatus: (error as any).status,
          domainError: error.message,
          details: (error as any).details,
        });
        throw new Error(error.message || "Failed to schedule session");
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["songwriting-projects"] }),
        queryClient.invalidateQueries({ queryKey: ["scheduled-activities"] }),
        queryClient.invalidateQueries({ queryKey: ["weekly-schedule"] }),
        queryClient.invalidateQueries({ queryKey: ["activity-status"] }),
      ]);
      toast.success("Songwriting session scheduled!");
      onOpenChange(false);
      return data;
    } catch (error: any) {
      toast.error(error.message || "Failed to schedule session");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule Songwriting Session</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Date</Label>
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              disabled={(day) => day < new Date(new Date().setHours(0, 0, 0, 0))}
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
                <SelectItem value="1">1 hour</SelectItem>
                <SelectItem value="2">2 hours</SelectItem>
                <SelectItem value="4">4 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSchedule} className="flex-1" disabled={isSaving || !projectId || projectStatus === "completed" || projectStatus === "converted"}>
              {isSaving ? "Scheduling..." : "Schedule Session"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
