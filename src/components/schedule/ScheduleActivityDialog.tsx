import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateScheduledActivity, type ActivityType } from "@/hooks/useScheduledActivities";
import { addHours, setHours, setMinutes } from "date-fns";

interface ScheduleActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  selectedHour?: number | null;
}

const ACTIVITY_OPTIONS: { value: ActivityType; label: string }[] = [
  { value: 'songwriting', label: 'Songwriting' },
  { value: 'gig', label: 'Gig Performance' },
  { value: 'rehearsal', label: 'Band Rehearsal' },
  { value: 'busking', label: 'Busking' },
  { value: 'recording', label: 'Recording Session' },
  { value: 'travel', label: 'Travel' },
  { value: 'work', label: 'Work Shift' },
  { value: 'university', label: 'University Class' },
  { value: 'reading', label: 'Reading' },
  { value: 'mentorship', label: 'Mentorship Session' },
  { value: 'youtube_video', label: 'YouTube Learning' },
  { value: 'health', label: 'Health Activity' },
  { value: 'other', label: 'Other' },
];

const DURATION_OPTIONS = [
  { value: '30', label: '30 minutes' },
  { value: '60', label: '1 hour' },
  { value: '90', label: '1.5 hours' },
  { value: '120', label: '2 hours' },
  { value: '180', label: '3 hours' },
  { value: '240', label: '4 hours' },
];

export function ScheduleActivityDialog({ open, onOpenChange, date, selectedHour }: ScheduleActivityDialogProps) {
  const [activityType, setActivityType] = useState<ActivityType>('other');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [hour, setHour] = useState(selectedHour?.toString() || '9');
  const [minute, setMinute] = useState('0');
  const [durationMinutes, setDurationMinutes] = useState('60');

  const createActivity = useCreateScheduledActivity();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) return;

    const startDate = setMinutes(setHours(date, parseInt(hour)), parseInt(minute));
    const endDate = addHours(startDate, parseInt(durationMinutes) / 60);

    await createActivity.mutateAsync({
      activity_type: activityType,
      scheduled_start: startDate,
      scheduled_end: endDate,
      title: title.trim(),
      description: description.trim() || undefined,
      location: location.trim() || undefined,
    });

    // Reset form
    setTitle('');
    setDescription('');
    setLocation('');
    setDurationMinutes('60');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Activity</DialogTitle>
          <DialogDescription>
            Add an activity to your daily schedule. You can start it now or later.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="activity-type">Activity Type</Label>
            <Select value={activityType} onValueChange={(v) => setActivityType(v as ActivityType)}>
              <SelectTrigger id="activity-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Write new song lyrics"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-2">
              <Label htmlFor="hour">Hour</Label>
              <Select value={hour} onValueChange={setHour}>
                <SelectTrigger id="hour">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, i) => (
                    <SelectItem key={i} value={i.toString()}>
                      {i.toString().padStart(2, '0')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minute">Minute</Label>
              <Select value={minute} onValueChange={setMinute}>
                <SelectTrigger id="minute">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">00</SelectItem>
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="30">30</SelectItem>
                  <SelectItem value="45">45</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duration</Label>
              <Select value={durationMinutes} onValueChange={setDurationMinutes}>
                <SelectTrigger id="duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location (Optional)</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Home Studio, The Venue"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Notes (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Any additional notes..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || createActivity.isPending}>
              {createActivity.isPending ? 'Scheduling...' : 'Schedule Activity'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
