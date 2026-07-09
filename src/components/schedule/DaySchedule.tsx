import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, differenceInMinutes } from "date-fns";
import {
  Clock, ExternalLink, Music, Guitar, Headphones, Briefcase, GraduationCap,
  BookOpen, Users, Video, Heart, MapPin, Target, Mic, Star, Clapperboard
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useScheduledActivities, type ActivityType, type ScheduledActivity } from "@/hooks/useScheduledActivities";
import { PageEmptyState, PageErrorState, PageLoadingState } from "@/components/ui/page-state";

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
  festival_attendance: Music,
  festival_performance: Guitar,
  release_manufacturing: Headphones,
  release_promo: Star,
  teaching: GraduationCap,
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
  festival_attendance: "bg-lime-500/10 border-lime-500/30 text-lime-700 dark:text-lime-300",
  festival_performance: "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300",
  release_manufacturing: "bg-sky-500/10 border-sky-500/30 text-sky-700 dark:text-sky-300",
  release_promo: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300",
  teaching: "bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-300",
  other: "bg-slate-500/10 border-slate-500/30 text-slate-700 dark:text-slate-300",
};

const TYPE_LABELS: Record<ActivityType, string> = {
  songwriting: "Songwriting", gig: "Gig", rehearsal: "Rehearsal", busking: "Busking", recording: "Recording",
  travel: "Travel", work: "Work", university: "Education", reading: "Reading", mentorship: "Mentorship",
  youtube_video: "Video", health: "Health", skill_practice: "Practice", open_mic: "Open mic",
  pr_appearance: "PR", film_production: "Film", festival_attendance: "Festival", festival_performance: "Festival gig",
  release_manufacturing: "Release", release_promo: "Promotion", teaching: "Teaching", other: "Other",
};

function getDetailHref(activity: ScheduledActivity) {
  if (activity.linked_gig_id) return `/gigs/perform/${activity.linked_gig_id}`;
  if (activity.linked_rehearsal_id) return "/rehearsals";
  if (activity.linked_recording_id) return "/recording-studio";
  if (activity.activity_type === "travel") return "/tour-manager";
  if (activity.activity_type === "work") return "/employment";
  if (activity.activity_type === "university" || activity.activity_type === "teaching") return "/education";
  return null;
}

function formatDuration(activity: ScheduledActivity) {
  if (activity.duration_minutes) return `${activity.duration_minutes} min`;
  if (!activity.scheduled_end) return null;
  const minutes = differenceInMinutes(new Date(activity.scheduled_end), new Date(activity.scheduled_start));
  if (minutes <= 0) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function DaySchedule({ date, userId }: DayScheduleProps) {
  const { data: activities = [], isLoading, error, refetch } = useScheduledActivities(date, userId);

  return (
    <Card>
      <CardHeader className="pb-2 md:pb-3">
        <CardTitle className="text-sm md:text-lg">{format(date, 'EEEE, MMMM d, yyyy')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 p-3 md:p-6">
        {isLoading ? (
          <PageLoadingState title="Loading schedule" description="Checking your booked activities..." />
        ) : error ? (
          <PageErrorState title="Schedule could not be loaded" description="Your booked activities are temporarily unavailable." onRetry={() => void refetch()} />
        ) : activities.length === 0 ? (
          <PageEmptyState title="No activities booked yet." description="Booked rehearsals, gigs, recording sessions, and other scheduled activities will appear here." />
        ) : (
          <div className="space-y-2">
            {activities.map((activity) => {
              const Icon = ACTIVITY_ICONS[activity.activity_type] ?? Clock;
              const href = getDetailHref(activity);
              const duration = formatDuration(activity);
              return (
                <div key={activity.id} className={cn("rounded-lg border p-3", ACTIVITY_COLORS[activity.activity_type])}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 gap-3">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-semibold md:text-base">{activity.title}</h3>
                          <Badge variant="outline" className="bg-background/50 text-xs">{TYPE_LABELS[activity.activity_type] ?? activity.activity_type}</Badge>
                          {activity.status && <Badge variant="secondary" className="text-xs capitalize">{activity.status.replace('_', ' ')}</Badge>}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span><Clock className="mr-1 inline h-3 w-3" />{format(new Date(activity.scheduled_start), 'h:mm a')}</span>
                          {activity.scheduled_end && <span>Ends {format(new Date(activity.scheduled_end), 'h:mm a')}{duration ? ` · ${duration}` : ''}</span>}
                          {activity.location && <span><MapPin className="mr-1 inline h-3 w-3" />{activity.location}</span>}
                        </div>
                        {activity.description && <p className="text-xs text-muted-foreground">{activity.description}</p>}
                      </div>
                    </div>
                    {href && (
                      <Button asChild size="sm" variant="outline" className="shrink-0 bg-background/50">
                        <Link to={href} aria-label={`Open details for ${activity.title}`}>
                          Details <ExternalLink className="ml-1 h-3 w-3" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
