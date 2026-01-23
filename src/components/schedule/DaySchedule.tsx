import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, addHours, isSameHour, isPast } from "date-fns";
import { 
  Clock, Play, CheckCircle, Plus, X, ArrowRight,
  Music, Guitar, Headphones, Briefcase, GraduationCap,
  BookOpen, Users, Video, Heart, MapPin, Target, Mic, Star, Clapperboard, Eye
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useScheduledActivities, useStartActivity, useCompleteActivity, useDeleteScheduledActivity, type ActivityType } from "@/hooks/useScheduledActivities";
import { ScheduleActivityDialog } from "./ScheduleActivityDialog";
import { GigDetailsDialog } from "./GigDetailsDialog";
import { formatTimeInCityTimezone, getCityTimeLabel } from "@/utils/timezoneUtils";

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
  skill_practice: Target,
  open_mic: Mic,
  pr_appearance: Star,
  film_production: Clapperboard,
  other: Clock,
};

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  songwriting: "bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-300",
  gig: "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300",
  rehearsal: "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300",
  busking: "bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-300",
  recording: "bg-pink-500/10 border-pink-500/30 text-pink-700 dark:text-pink-300",
  travel: "bg-cyan-500/10 border-cyan-500/30 text-cyan-700 dark:text-cyan-300",
  work: "bg-gray-500/10 border-gray-500/30 text-gray-700 dark:text-gray-300",
  university: "bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-300",
  reading: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300",
  mentorship: "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300",
  youtube_video: "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300",
  health: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300",
  skill_practice: "bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-300",
  open_mic: "bg-violet-500/10 border-violet-500/30 text-violet-700 dark:text-violet-300",
  pr_appearance: "bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-700 dark:text-fuchsia-300",
  film_production: "bg-teal-500/10 border-teal-500/30 text-teal-700 dark:text-teal-300",
  other: "bg-slate-500/10 border-slate-500/30 text-slate-700 dark:text-slate-300",
};

type ActivityPosition = 'start' | 'middle' | 'end' | 'single';

export function DaySchedule({ date, userId }: DayScheduleProps) {
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [gigDetailsOpen, setGigDetailsOpen] = useState(false);
  const [selectedGigId, setSelectedGigId] = useState<string | null>(null);
  
  const { data: activities = [] } = useScheduledActivities(date, userId);
  const startActivity = useStartActivity();
  const completeActivity = useCompleteActivity();
  const deleteActivity = useDeleteScheduledActivity();

  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Updated to show activities in ALL hours they span
  const getActivitiesForHour = (hour: number) => {
    return activities.filter(activity => {
      const activityStart = new Date(activity.scheduled_start);
      const activityEnd = new Date(activity.scheduled_end);
      
      // Create hour boundaries for comparison
      const hourStart = new Date(date);
      hourStart.setHours(hour, 0, 0, 0);
      const hourEnd = new Date(date);
      hourEnd.setHours(hour + 1, 0, 0, 0);
      
      // Activity overlaps this hour if it starts before hour ends AND ends after hour starts
      return activityStart < hourEnd && activityEnd > hourStart;
    });
  };

  // Determine where in the activity duration this hour falls
  const getActivityPosition = (activity: typeof activities[0], hour: number): ActivityPosition => {
    const activityStart = new Date(activity.scheduled_start);
    const activityEnd = new Date(activity.scheduled_end);
    const startHour = activityStart.getHours();
    
    // Calculate end hour (handle midnight crossing)
    let endHour = activityEnd.getHours();
    if (activityEnd.getMinutes() === 0 && endHour > 0) {
      // If ends exactly on the hour (e.g., 14:00), the last visible hour is the previous one
      endHour = endHour - 1;
    }
    
    // Single-hour activity
    if (startHour === hour && (endHour === hour || (endHour === startHour))) {
      return 'single';
    }
    
    if (hour === startHour) return 'start';
    if (hour === endHour) return 'end';
    return 'middle';
  };

  const handleAddActivity = (hour: number) => {
    // Check if this hour is blocked by work
    const hourActivities = getActivitiesForHour(hour);
    const hasWorkShift = hourActivities.some(a => a.metadata?.auto_scheduled);
    if (hasWorkShift) {
      return; // Don't allow adding activities during work hours
    }
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
    if (confirm('Delete this activity?')) {
      await deleteActivity.mutateAsync(activityId);
    }
  };

  const handleViewGigDetails = (activity: typeof activities[0]) => {
    const gigId = activity.metadata?.gig_id as string;
    if (gigId) {
      setSelectedGigId(gigId);
      setGigDetailsOpen(true);
    }
  };

  const getHourStatus = (hour: number) => {
    const hourDate = addHours(new Date(date).setHours(hour, 0, 0, 0), 0);
    if (isPast(hourDate) && !isSameHour(hourDate, new Date())) return 'past';
    if (isSameHour(hourDate, new Date())) return 'current';
    return 'future';
  };

  // Get display time with timezone support
  const getDisplayTime = (activity: typeof activities[0]) => {
    const metadata = activity.metadata as Record<string, any> | null;
    const venueTimezone = metadata?.venue_timezone;
    const venueCityName = metadata?.venue_city_name;
    
    if (venueTimezone) {
      const localTime = formatTimeInCityTimezone(activity.scheduled_start, venueTimezone);
      const cityLabel = venueCityName ? getCityTimeLabel(venueCityName) : 'Local';
      return { time: localTime, label: cityLabel, hasTimezone: true };
    }
    
    return { 
      time: format(new Date(activity.scheduled_start), 'h:mm a'), 
      label: null, 
      hasTimezone: false 
    };
  };

  // Get position badge for multi-hour activities
  const getPositionBadge = (position: ActivityPosition) => {
    switch (position) {
      case 'start':
        return (
          <Badge variant="outline" className="text-xs shrink-0 bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300">
            Starts
          </Badge>
        );
      case 'middle':
        return (
          <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
        );
      case 'end':
        return (
          <Badge variant="outline" className="text-xs shrink-0 bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-300">
            Ends
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2 md:pb-3">
          <CardTitle className="text-sm md:text-lg">{format(date, 'EEEE, MMMM d, yyyy')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0.5 md:space-y-1 p-3 md:p-6">
          {hours.map(hour => {
            const hourActivities = getActivitiesForHour(hour);
            const status = getHourStatus(hour);
            
            return (
              <div
                key={hour}
                className={cn(
                  "flex items-center gap-1.5 md:gap-2 p-1.5 md:p-2 rounded border transition-colors",
                  status === 'current' && "bg-primary/5 border-primary/20",
                  status === 'past' && "opacity-60",
                  hourActivities.length === 0 && "hover:bg-accent/50"
                )}
              >
                <div className="w-12 md:w-16 text-xs md:text-sm font-medium text-muted-foreground">
                  {format(addHours(new Date().setHours(hour, 0, 0, 0), 0), 'HH:mm')}
                </div>
                
                <div className="flex-1 min-w-0">
                  {hourActivities.length === 0 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 md:h-8 w-full justify-start text-xs"
                      onClick={() => handleAddActivity(hour)}
                    >
                      <Plus className="h-2.5 w-2.5 md:h-3 md:w-3 mr-1" />
                      <span className="text-muted-foreground">Add</span>
                    </Button>
                  ) : (
                    <div className="space-y-1">
                      {hourActivities.map(activity => {
                        const Icon = ACTIVITY_ICONS[activity.activity_type as ActivityType];
                        const colorClass = ACTIVITY_COLORS[activity.activity_type as ActivityType];
                        const isAutoScheduled = activity.metadata?.auto_scheduled;
                        const position = getActivityPosition(activity, hour);
                        const displayTime = getDisplayTime(activity);
                        
                        return (
                          <div
                            key={`${activity.id}-${hour}`}
                            className={cn(
                              "flex items-center gap-1.5 md:gap-2 p-1.5 md:p-2 rounded border text-xs md:text-sm",
                              colorClass,
                              isAutoScheduled && "opacity-80",
                              position === 'middle' && "border-dashed opacity-70"
                            )}
                          >
                            <Icon className="h-3 w-3 md:h-4 md:w-4 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate flex items-center gap-1.5">
                                {activity.title}
                                {getPositionBadge(position)}
                              </div>
                              {activity.location && position !== 'middle' && (
                                <div className="text-xs text-muted-foreground truncate hidden md:block">
                                  {activity.location}
                                  {displayTime.hasTimezone && (
                                    <span className="ml-1 text-primary/70">
                                      ({displayTime.time} {displayTime.label})
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            {position !== 'middle' && (
                              <>
                                <Badge variant="outline" className="text-xs shrink-0 hidden md:inline-flex">
                                  {activity.status}
                                </Badge>
                                <div className="flex gap-0.5 md:gap-1 shrink-0">
                                  {activity.status === 'scheduled' && status !== 'past' && position === 'start' && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 md:h-7 px-1.5 md:px-2"
                                      onClick={() => handleStart(activity.id)}
                                    >
                                      <Play className="h-2.5 w-2.5 md:h-3 md:w-3" />
                                    </Button>
                                  )}
                                  {activity.status === 'in_progress' && position === 'start' && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 md:h-7 px-1.5 md:px-2"
                                      onClick={() => handleComplete(activity.id)}
                                    >
                                      <CheckCircle className="h-2.5 w-2.5 md:h-3 md:w-3" />
                                    </Button>
                                  )}
                                  {activity.activity_type === 'gig' && activity.metadata?.gig_id && position === 'start' && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 md:h-7 px-1.5 md:px-2"
                                      onClick={() => handleViewGigDetails(activity)}
                                      title="View gig details"
                                    >
                                      <Eye className="h-2.5 w-2.5 md:h-3 md:w-3" />
                                    </Button>
                                  )}
                                  {!isAutoScheduled && position === 'start' && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 md:h-7 px-1.5 md:px-2 text-destructive"
                                      onClick={() => handleDelete(activity.id)}
                                    >
                                      <X className="h-2.5 w-2.5 md:h-3 md:w-3" />
                                    </Button>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <ScheduleActivityDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        date={date}
        selectedHour={selectedHour}
      />

      {selectedGigId && (
        <GigDetailsDialog
          open={gigDetailsOpen}
          onOpenChange={setGigDetailsOpen}
          gigId={selectedGigId}
        />
      )}
    </>
  );
}
