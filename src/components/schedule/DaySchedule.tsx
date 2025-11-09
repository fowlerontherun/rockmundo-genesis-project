import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, addHours, isSameHour, isPast, isFuture } from "date-fns";
import { 
  Clock, Play, CheckCircle, Plus, X, Calendar,
  Music, Guitar, Headphones, Briefcase, GraduationCap,
  BookOpen, Users, Video, Heart, MapPin
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useScheduledActivities, useStartActivity, useCompleteActivity, useDeleteScheduledActivity, type ScheduledActivity, type ActivityType } from "@/hooks/useScheduledActivities";
import { ScheduleActivityDialog } from "./ScheduleActivityDialog";

interface DayScheduleProps {
  date: Date;
  userId?: string;
}

const ACTIVITY_ICONS: Record<ActivityType, typeof Music> = {
  songwriting: Music,
  gig: Guitar,
  rehearsal: Users,
  busking: Music,
  recording: Headphones,
  travel: MapPin,
  work: Briefcase,
  university: GraduationCap,
  reading: BookOpen,
  mentorship: Users,
  youtube_video: Video,
  health: Heart,
  other: Calendar,
};

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  songwriting: "bg-purple-500/20 border-purple-500/50 text-purple-700 dark:text-purple-300",
  gig: "bg-red-500/20 border-red-500/50 text-red-700 dark:text-red-300",
  rehearsal: "bg-blue-500/20 border-blue-500/50 text-blue-700 dark:text-blue-300",
  busking: "bg-orange-500/20 border-orange-500/50 text-orange-700 dark:text-orange-300",
  recording: "bg-pink-500/20 border-pink-500/50 text-pink-700 dark:text-pink-300",
  travel: "bg-cyan-500/20 border-cyan-500/50 text-cyan-700 dark:text-cyan-300",
  work: "bg-gray-500/20 border-gray-500/50 text-gray-700 dark:text-gray-300",
  university: "bg-indigo-500/20 border-indigo-500/50 text-indigo-700 dark:text-indigo-300",
  reading: "bg-amber-500/20 border-amber-500/50 text-amber-700 dark:text-amber-300",
  mentorship: "bg-green-500/20 border-green-500/50 text-green-700 dark:text-green-300",
  youtube_video: "bg-rose-500/20 border-rose-500/50 text-rose-700 dark:text-rose-300",
  health: "bg-emerald-500/20 border-emerald-500/50 text-emerald-700 dark:text-emerald-300",
  other: "bg-slate-500/20 border-slate-500/50 text-slate-700 dark:text-slate-300",
};

export function DaySchedule({ date, userId }: DayScheduleProps) {
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  
  const { data: activities = [] } = useScheduledActivities(date, userId);
  const startActivity = useStartActivity();
  const completeActivity = useCompleteActivity();
  const deleteActivity = useDeleteScheduledActivity();

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getActivitiesForHour = (hour: number) => {
    return activities.filter(activity => {
      const activityStart = new Date(activity.scheduled_start);
      return activityStart.getHours() === hour;
    });
  };

  const handleAddActivity = (hour: number) => {
    setSelectedHour(hour);
    setScheduleDialogOpen(true);
  };

  const handleStart = async (activityId: string) => {
    await startActivity.mutateAsync(activityId);
  };

  const handleComplete = async (activityId: string) => {
    await completeActivity.mutateAsync(activityId);
  };

  const handleDelete = async (activityId: string) => {
    if (confirm('Are you sure you want to delete this scheduled activity?')) {
      await deleteActivity.mutateAsync(activityId);
    }
  };

  const getHourStatus = (hour: number) => {
    const hourDate = addHours(new Date(date).setHours(hour, 0, 0, 0), 0);
    if (isPast(hourDate) && !isSameHour(hourDate, new Date())) return 'past';
    if (isSameHour(hourDate, new Date())) return 'current';
    return 'future';
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Day Schedule - {format(date, 'EEEE, MMMM d, yyyy')}
          </CardTitle>
          <CardDescription>
            Plan your day in 1-hour chunks. Click + to schedule activities.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {hours.map(hour => {
              const hourActivities = getActivitiesForHour(hour);
              const status = getHourStatus(hour);
              
              return (
                <div
                  key={hour}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                    status === 'current' && "bg-primary/5 border-primary/20",
                    status === 'past' && "opacity-60 bg-muted/30",
                    status === 'future' && "hover:bg-muted/50"
                  )}
                >
                  <div className="flex-shrink-0 w-16 text-right">
                    <div className={cn(
                      "text-sm font-medium",
                      status === 'current' && "text-primary"
                    )}>
                      {format(addHours(new Date().setHours(hour, 0, 0, 0), 0), 'HH:mm')}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    {hourActivities.length === 0 ? (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground italic">Free</span>
                        {status !== 'past' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAddActivity(hour)}
                            className="h-7 px-2"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Schedule
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {hourActivities.map(activity => {
                          const Icon = ACTIVITY_ICONS[activity.activity_type];
                          const duration = Math.round((activity.duration_minutes || 60) / 60 * 10) / 10;
                          
                          return (
                            <div
                              key={activity.id}
                              className={cn(
                                "flex items-center gap-2 p-2 rounded border",
                                ACTIVITY_COLORS[activity.activity_type]
                              )}
                            >
                              <Icon className="h-4 w-4 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">{activity.title}</div>
                                {activity.location && (
                                  <div className="text-xs opacity-80 truncate">{activity.location}</div>
                                )}
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {duration}h
                              </Badge>
                              
                              <div className="flex items-center gap-1">
                                {activity.status === 'scheduled' && status !== 'past' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleStart(activity.id)}
                                    disabled={startActivity.isPending}
                                    className="h-7 w-7 p-0"
                                    title="Start now"
                                  >
                                    <Play className="h-3 w-3" />
                                  </Button>
                                )}
                                
                                {activity.status === 'in_progress' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleComplete(activity.id)}
                                    disabled={completeActivity.isPending}
                                    className="h-7 w-7 p-0"
                                    title="Mark complete"
                                  >
                                    <CheckCircle className="h-3 w-3" />
                                  </Button>
                                )}
                                
                                {activity.status === 'completed' && (
                                  <Badge variant="outline" className="text-xs bg-green-500/20">
                                    ✓
                                  </Badge>
                                )}
                                
                                {activity.status === 'scheduled' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(activity.id)}
                                    disabled={deleteActivity.isPending}
                                    className="h-7 w-7 p-0 text-destructive"
                                    title="Delete"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <ScheduleActivityDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        date={date}
        selectedHour={selectedHour}
      />
    </>
  );
}
