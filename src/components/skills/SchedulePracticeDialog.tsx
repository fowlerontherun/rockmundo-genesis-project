import { useState } from "react";
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
import { usePracticeSkill } from "@/hooks/useSkillPractice";
import { addHours, setHours, setMinutes, setSeconds, setMilliseconds } from "date-fns";

interface SchedulePracticeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skillSlug: string;
  skillName: string;
}

export function SchedulePracticeDialog({
  open,
  onOpenChange,
  skillSlug,
  skillName,
}: SchedulePracticeDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedHour, setSelectedHour] = useState<number>(9);
  const practiceSkill = usePracticeSkill();

  const handleSchedule = () => {
    // Create date with selected hour
    let practiceDate = setHours(selectedDate, selectedHour);
    practiceDate = setMinutes(practiceDate, 0);
    practiceDate = setSeconds(practiceDate, 0);
    practiceDate = setMilliseconds(practiceDate, 0);

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

  // Generate hour options (0-23)
  const hourOptions = Array.from({ length: 24 }, (_, i) => i);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Practice: {skillName}</DialogTitle>
          <DialogDescription>
            Choose when you'd like to practice this skill. Practice sessions last 1 hour.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Select Date</Label>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              disabled={(date) => date < new Date()}
              className="rounded-md border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hour">Select Time</Label>
            <select
              id="hour"
              value={selectedHour}
              onChange={(e) => setSelectedHour(Number(e.target.value))}
              className="w-full rounded-md border border-input bg-background px-3 py-2"
            >
              {hourOptions.map((hour) => (
                <option key={hour} value={hour}>
                  {hour.toString().padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSchedule} disabled={practiceSkill.isPending}>
            {practiceSkill.isPending ? "Scheduling..." : "Schedule Practice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
