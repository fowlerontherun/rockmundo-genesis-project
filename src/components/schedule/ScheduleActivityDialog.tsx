import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { type ActivityType } from "@/hooks/useScheduledActivities";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Music, Guitar, Users, Headphones, MapPin, Briefcase, GraduationCap, BookOpen, Video, Heart, Calendar, Target, Mic } from "lucide-react";

interface ScheduleActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  selectedHour?: number | null;
}

const ACTIVITY_ROUTES: Record<ActivityType, { path: string; icon: any; label: string; description: string }> = {
  songwriting: { path: '/songwriting', icon: Music, label: 'Songwriting', description: 'Write and compose new songs' },
  gig: { path: '/gigs', icon: Guitar, label: 'Gig Performance', description: 'Book and perform live gigs' },
  rehearsal: { path: '/rehearsals', icon: Users, label: 'Band Rehearsal', description: 'Practice with your band' },
  busking: { path: '/performance', icon: Music, label: 'Busking', description: 'Perform on the streets for tips' },
  recording: { path: '/recording', icon: Headphones, label: 'Recording Session', description: 'Record tracks in the studio' },
  travel: { path: '/travel', icon: MapPin, label: 'Travel', description: 'Plan trips between cities' },
  work: { path: '/employment', icon: Briefcase, label: 'Work Shift', description: 'Schedule work shifts for income' },
  university: { path: '/education', icon: GraduationCap, label: 'University Class', description: 'Attend university courses' },
  reading: { path: '/education', icon: BookOpen, label: 'Reading', description: 'Read books to gain knowledge' },
  mentorship: { path: '/education', icon: Users, label: 'Mentorship Session', description: 'Learn from experienced mentors' },
  youtube_video: { path: '/education', icon: Video, label: 'YouTube Learning', description: 'Watch educational videos' },
  health: { path: '/my-character/edit', icon: Heart, label: 'Health Activity', description: 'Rest and recover health' },
  skill_practice: { path: '/skills', icon: Target, label: 'Skill Practice', description: 'Practice individual skills' },
  open_mic: { path: '/open-mic', icon: Mic, label: 'Open Mic Night', description: 'Perform at open mic venues' },
  other: { path: '/schedule', icon: Calendar, label: 'Other Activity', description: 'Schedule a custom activity' },
};

export function ScheduleActivityDialog({ open, onOpenChange, date, selectedHour }: ScheduleActivityDialogProps) {
  const navigate = useNavigate();

  const handleActivityClick = (activityType: ActivityType) => {
    const route = ACTIVITY_ROUTES[activityType];
    onOpenChange(false);
    
    // Navigate to the actual booking page
    navigate(route.path, { 
      state: { 
        scheduledDate: date,
        scheduledHour: selectedHour,
        fromSchedule: true 
      } 
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule Activity</DialogTitle>
          <DialogDescription>
            Choose what you'd like to do. You'll be taken to the booking page to complete the details.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-4">
          {(Object.entries(ACTIVITY_ROUTES) as [ActivityType, typeof ACTIVITY_ROUTES[ActivityType]][]).map(([type, route]) => {
            const Icon = route.icon;
            
            return (
              <Card 
                key={type}
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => handleActivityClick(type)}
              >
                <CardHeader className="p-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon className="h-5 w-5" />
                    {route.label}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {route.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
