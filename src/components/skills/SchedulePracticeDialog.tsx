import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { type PracticeRestrictions, usePracticeSkill } from "@/hooks/useSkillPractice";
import { setHours, setMinutes, setSeconds, setMilliseconds } from "date-fns";
import { validateFutureBooking } from "@/utils/activityBookingTime";
import { toast } from "sonner";
import { availablePracticeHours, nextPracticeHour } from "@/utils/skillPracticeScheduling";

interface SchedulePracticeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skillSlug: string;
  skillName: string;
  practiceConfig?: PracticeRestrictions;
}

export function SchedulePracticeDialog({
  open,
  onOpenChange,
  skillSlug,
  skillName,
  practiceConfig,
}: SchedulePracticeDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedHour, setSelectedHour] = useState<number | null>(() => nextPracticeHour());
  const practiceSkill = usePracticeSkill();

  const hourOptions = useMemo(() => availablePracticeHours(selectedDate), [selectedDate]);

  useEffect(() => {
    if (!hourOptions.includes(selectedHour ?? -1)) setSelectedHour(hourOptions[0] ?? null);
  }, [hourOptions, selectedHour]);

  const handleSchedule = () => {
    if (selectedHour === null || !hourOptions.includes(selectedHour)) {
      toast.error("No future practice slots are available on this date.");
      return;
    }
    // Create date with selected hour
    let practiceDate = setHours(selectedDate, selectedHour);
    practiceDate = setMinutes(practiceDate, 0);
    practiceDate = setSeconds(practiceDate, 0);
    practiceDate = setMilliseconds(practiceDate, 0);

    const bookingError = validateFutureBooking(practiceDate);
    if (bookingError) {
      toast.error(bookingError);
      return;
    }

    practiceSkill.mutate(
      {
        skillSlug,
        skillName,
        scheduledStart: practiceDate,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Practice: {skillName}</DialogTitle>
          <DialogDescription>
            Choose when you'd like to practice this skill. Practice sessions last {practiceConfig?.durationOptionsHours.join("/") ?? 1} hour(s).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Select Date</Label>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              disabled={(day) => day < new Date(new Date().setHours(0, 0, 0, 0))}
              className="rounded-md border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hour">Select Time</Label>
            <select
              id="hour"
              value={selectedHour ?? ""}
              onChange={(e) => setSelectedHour(Number(e.target.value))}
              className="w-full rounded-md border border-input bg-background px-3 py-2"
            >
              {hourOptions.length === 0 && <option value="">No slots remaining today</option>}
              {hourOptions.map((hour) => (
                <option key={hour} value={hour}>
                  {hour.toString().padStart(2, '0')}:00
                </option>
              ))}
            </select>
            {hourOptions.length === 0 && (
              <p className="text-sm text-muted-foreground">There are no full future hourly slots left today. Choose a future date.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button aria-label={`Schedule practice for ${skillName}`} onClick={handleSchedule} disabled={practiceSkill.isPending || selectedHour === null}>
            {practiceSkill.isPending ? "Scheduling..." : "Schedule Practice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
