import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, CalendarDays, ChevronLeft, ChevronRight, Clock, ExternalLink, GraduationCap, Music, Package, Sparkles, Zap } from "lucide-react";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { DaySchedule } from "@/components/schedule/DaySchedule";
import { addDays, startOfWeek, format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GigLocationWarning } from "@/components/notifications/GigLocationWarning";
import { HubLayout } from "@/components/hub/HubLayout";
import { scheduleHubNavigation } from "@/config/hubNavigation";
import { useScheduledActivities } from "@/hooks/useScheduledActivities";
import { PageEmptyState, PageErrorState, PageLoadingState } from "@/components/ui/page-state";
import { formatDurationMinutes, getDisplayDurationMinutes } from "@/utils/activityBookingTime";

const bookingOptions = [
  { label: "Education", description: "Book classes, reading, mentorship and skill study.", path: "/booking/education", icon: GraduationCap },
  { label: "Performance", description: "Start existing performance booking workflows.", path: "/booking/performance", icon: Zap },
  { label: "Work", description: "Schedule employment and work activity.", path: "/booking/work", icon: Package },
  { label: "Songwriting", description: "Reserve time for writing music.", path: "/booking/songwriting", icon: Sparkles },
  { label: "Practice", description: "Open the Music practice area.", path: "/music/practice", icon: Music },
];

function CurrentActivityPanel({ userId }: { userId?: string }) {
  const today = useMemo(() => new Date(), []);
  const { data: activities = [], isLoading, error, refetch } = useScheduledActivities(today, userId);
  const now = Date.now();
  const current = activities.find((activity) => {
    const start = new Date(activity.scheduled_start).getTime();
    const end = new Date(activity.scheduled_end).getTime();
    return activity.status === "in_progress" || (activity.status === "scheduled" && start <= now && end > now);
  });

  if (isLoading) return <PageLoadingState title="Loading current activity" description="Checking what is active right now..." />;
  if (error) return <PageErrorState title="Current activity unavailable" description="Schedule data could not be loaded." onRetry={() => void refetch()} />;
  if (!current) return <PageEmptyState title="No current activity" description="You are free right now. Review today or book your next activity." action={<Button asChild size="sm"><Link to="/schedule/book">Book activity</Link></Button>} />;

  const remainingMs = Math.max(0, new Date(current.scheduled_end).getTime() - now);
  const remainingMinutes = Math.ceil(remainingMs / 60000);
  const duration = formatDurationMinutes(getDisplayDurationMinutes(current));

  return (
    <Card>
      <CardHeader className="gap-3 pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4 text-primary" />Current activity</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Server schedule status is authoritative; remaining time never goes below zero.</p>
        </div>
        <Badge variant="secondary">{current.status.replace("_", " ")}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">{current.title || "Scheduled activity"}</h2>
          <p className="text-sm text-muted-foreground">{format(new Date(current.scheduled_start), "h:mm a")}–{format(new Date(current.scheduled_end), "h:mm a")}{duration ? ` · ${duration}` : ""}</p>
          {current.location && <p className="text-sm text-muted-foreground">Location: {current.location}</p>}
          <p className="text-sm font-medium">{remainingMinutes} min remaining</p>
        </div>
        <Button asChild size="sm" variant="outline"><Link to="/schedule/today">View in today <ExternalLink className="ml-1 h-3 w-3" /></Link></Button>
      </CardContent>
    </Card>
  );
}

function BookingLauncher() {
  return (
    <Card>
      <CardHeader><CardTitle>Book activity</CardTitle></CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {bookingOptions.map((option) => {
          const Icon = option.icon;
          return <Button key={option.path} asChild variant="outline" className="h-auto justify-start p-4 text-left"><Link to={option.path}><Icon className="mr-3 h-4 w-4" /><span><span className="block font-medium">{option.label}</span><span className="block text-xs font-normal text-muted-foreground">{option.description}</span></span></Link></Button>;
        })}
      </CardContent>
    </Card>
  );
}

const Schedule = () => {
  const { userId } = useActiveProfile();
  const location = useLocation();
  const initialDate = new URLSearchParams(location.search).get("date");
  const [currentDate, setCurrentDate] = useState(initialDate ? new Date(`${initialDate}T12:00:00`) : new Date());
  const path = location.pathname;
  const viewMode: "day" | "week" = path.includes("/week") || path.includes("/calendar") ? "week" : "day";
  const isBook = path.includes("/book");
  const isCurrent = path.includes("/current");
  const isHistory = path.includes("/history");
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <HubLayout title="Schedule" description="Today is the default schedule view. Review current, upcoming and historical activity, then launch the owning booking workflow." icon={Calendar} overviewPath="/schedule" navigation={scheduleHubNavigation} actions={[{ label: "Book activity", path: "/schedule/book", variant: "outline" }]}>
      <GigLocationWarning />
      {isBook ? <BookingLauncher /> : isCurrent ? <CurrentActivityPanel userId={userId ?? undefined} /> : isHistory ? (
        <Card><CardHeader><CardTitle>Activity history</CardTitle></CardHeader><CardContent><DaySchedule date={currentDate} userId={userId ?? undefined} /></CardContent></Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 md:gap-4">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setCurrentDate(addDays(currentDate, viewMode === 'day' ? -1 : -7))}><ChevronLeft className="h-3 w-3 md:h-4 md:w-4" /></Button>
              <Button size="sm" variant="outline" onClick={() => setCurrentDate(new Date())}><span className="text-xs md:text-sm">Today</span></Button>
              <Button size="sm" variant="outline" onClick={() => setCurrentDate(addDays(currentDate, viewMode === 'day' ? 1 : 7))}><ChevronRight className="h-3 w-3 md:h-4 md:w-4" /></Button>
            </div>
            <div className="flex gap-2">
              <Button asChild size="sm" variant={viewMode === 'day' ? 'default' : 'outline'}><Link to="/schedule/today"><Calendar className="h-3 w-3 md:mr-1" /><span className="hidden md:inline">Today</span></Link></Button>
              <Button asChild size="sm" variant={viewMode === 'week' ? 'default' : 'outline'}><Link to="/schedule/week"><CalendarDays className="h-3 w-3 md:mr-1" /><span className="hidden md:inline">Week</span></Link></Button>
            </div>
          </div>
          {viewMode === 'day' ? <DaySchedule date={currentDate} userId={userId ?? undefined} /> : (
            <Tabs defaultValue={format(weekDays[0], 'yyyy-MM-dd')} className="w-full"><TabsList className="grid h-auto w-full grid-cols-7">{weekDays.map(day => <TabsTrigger key={day.toISOString()} value={format(day, 'yyyy-MM-dd')} className="flex flex-col py-1.5 md:py-2"><span className="text-xs">{format(day, 'EEE')}</span><span className="text-base font-bold md:text-lg">{format(day, 'd')}</span></TabsTrigger>)}</TabsList>{weekDays.map(day => <TabsContent key={day.toISOString()} value={format(day, 'yyyy-MM-dd')}><DaySchedule date={day} userId={userId ?? undefined} /></TabsContent>)}</Tabs>
          )}
        </>
      )}
    </HubLayout>
  );
};

export default Schedule;
