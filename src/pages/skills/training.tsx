import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Brain,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  PlayCircle,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth-context";
import { useToast } from "@/hooks/use-toast";
import {
  listTrainingCourses,
  listTrainingEnrollments,
  upsertTrainingEnrollment,
  type TrainingCourseRecord,
  type TrainingEnrollmentRecord,
} from "@/lib/api/training";
import {
  calculateNextTrainingSession,
  estimateWeeklyTrainingMinutes,
  generateTrainingSchedule,
  minutesUntilNextSession,
} from "@/lib/schedulers/training";
import { cn } from "@/lib/utils";

interface CourseWithEnrollment extends TrainingCourseRecord {
  enrollment?: TrainingEnrollmentRecord | null;
}

const difficultyConfig: Record<string, string> = {
  beginner: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  intermediate: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  advanced: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
};

const statusLabels: Record<string, string> = {
  enrolled: "Enrolled",
  in_progress: "In Progress",
  completed: "Completed",
  dropped: "Dropped",
};

const formatMinutes = (minutes: number | null) => {
  if (minutes === null) {
    return "—";
  }

  const hours = Math.trunc(minutes / 60);
  const remainder = Math.abs(minutes % 60);

  if (hours === 0) {
    return `${remainder}m`;
  }

  return `${hours}h ${remainder}m`;
};

const describeTimeUntil = (minutes: number | null) => {
  if (minutes === null) {
    return "Scheduling";
  }

  if (minutes <= 0) {
    return "Due now";
  }

  return `In ${formatMinutes(minutes)}`;
};

const useTrainingData = (profileId: string | null | undefined) => {
  const [courses, setCourses] = useState<TrainingCourseRecord[]>([]);
  const [enrollments, setEnrollments] = useState<TrainingEnrollmentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const [courseData, enrollmentData] = await Promise.all([
          listTrainingCourses(),
          listTrainingEnrollments(profileId),
        ]);

        if (!mounted) {
          return;
        }

        setCourses(courseData);
        setEnrollments(enrollmentData);
      } catch (error) {
        console.error("Failed to load training data", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [profileId]);

  return { courses, enrollments, setEnrollments, loading };
};

const TrainingPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { courses, enrollments, setEnrollments, loading } = useTrainingData(user?.id);
  const [enrollingCourseId, setEnrollingCourseId] = useState<string | null>(null);

  const coursesWithEnrollment = useMemo<CourseWithEnrollment[]>(() => {
    if (!courses.length) {
      return [];
    }

    const enrollmentMap = new Map(
      enrollments.map((enrollment) => [enrollment.course_id, enrollment])
    );

    return courses.map((course) => ({
      ...course,
      enrollment: enrollmentMap.get(course.id) ?? null,
    }));
  }, [courses, enrollments]);

  const handleEnroll = async (course: TrainingCourseRecord) => {
    if (!user?.id) {
      toast({
        title: "Log in required",
        description: "Sign in to reserve a seat in this training cohort.",
        variant: "destructive",
      });
      return;
    }

    setEnrollingCourseId(course.id);
    try {
      const enrollment = await upsertTrainingEnrollment({
        profileId: user.id,
        course,
        progress: 0,
        status: "enrolled",
        startDate: new Date(),
      });

      setEnrollments((previous) => {
        const existingIndex = previous.findIndex((entry) => entry.course_id === course.id);
        if (existingIndex >= 0) {
          const next = [...previous];
          next[existingIndex] = enrollment;
          return next;
        }
        return [enrollment, ...previous];
      });

      toast({
        title: "Enrollment confirmed",
        description: `${course.title} is now on your development calendar.`,
      });
    } catch (error) {
      console.error("Failed to enroll in course", error);
      toast({
        title: "Unable to enroll",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setEnrollingCourseId(null);
    }
  };

  const activeEnrollments = useMemo(() => enrollments.filter((item) => item.status !== "dropped"), [
    enrollments,
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <header className="space-y-4 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Intensive Skill Tracks
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Training Programs & Masterclasses
          </h1>
          <p className="text-muted-foreground sm:text-lg">
            Join guided cohorts and daily drills designed to accelerate your artistry, performance, and production mastery.
          </p>
        </div>
      </header>

      <section className="mt-10 grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Brain className="h-5 w-5 text-primary" aria-hidden="true" />
                Available Courses
              </CardTitle>
              <CardDescription>
                Select a track to enroll and we’ll queue up the schedule that complements your weekly routine.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="grid gap-4 rounded-lg border p-4">
                      <Skeleton className="h-6 w-1/3" />
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ))}
                </div>
              ) : coursesWithEnrollment.length === 0 ? (
                <div className="rounded-lg border border-dashed p-10 text-center">
                  <PlayCircle className="mx-auto mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />
                  <p className="font-medium">No training courses available yet.</p>
                  <p className="text-sm text-muted-foreground">
                    Our faculty is curating the next wave of masterclasses. Check back soon.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {coursesWithEnrollment.map((course) => {
                    const { enrollment } = course;
                    const schedulePreview = (() => {
                      const preferredWeekdays = enrollment?.preferred_weekdays ?? course.default_weekdays ?? undefined;
                      const preferredStart = enrollment?.preferred_start_time ?? course.default_start_time ?? undefined;
                      const baseOptions = {
                        cadence: course.cadence,
                        sessionsPerWeek: course.sessions_per_week,
                        preferredWeekdays,
                        preferredTime: preferredStart,
                        lastCompletedAt: enrollment?.last_session_at
                          ? new Date(enrollment.last_session_at)
                          : undefined,
                        startDate: new Date(),
                      } as const;
                      const nextSessionDate = enrollment?.next_session_at
                        ? new Date(enrollment.next_session_at)
                        : calculateNextTrainingSession(baseOptions);

                      if (!nextSessionDate) {
                        return [];
                      }

                      const futureSessions = generateTrainingSchedule({
                        ...baseOptions,
                        lastCompletedAt: nextSessionDate,
                        startDate: nextSessionDate,
                        occurrences: 2,
                      });

                      return [nextSessionDate, ...futureSessions];
                    })();

                    const weeklyMinutes = estimateWeeklyTrainingMinutes({
                      cadence: course.cadence,
                      sessionsPerWeek: course.sessions_per_week,
                      preferredWeekdays: course.default_weekdays ?? undefined,
                      preferredTime: course.default_start_time ?? undefined,
                      durationMinutes: course.session_duration_minutes ?? 60,
                    });

                    const nextSessionMinutes = minutesUntilNextSession(
                      enrollment?.next_session_at ?? schedulePreview[0]
                    );

                    return (
                      <div key={course.id} className="rounded-lg border p-5 transition hover:border-primary/40">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-xl font-semibold text-foreground">
                                {course.title}
                              </h3>
                              <Badge
                                variant="outline"
                                className={cn("capitalize", difficultyConfig[course.difficulty] ?? "")}
                              >
                                {course.difficulty}
                              </Badge>
                              <Badge variant="secondary" className="capitalize">
                                {course.focus}
                              </Badge>
                              <Badge variant="outline" className="uppercase tracking-wide">
                                {course.format}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground max-w-2xl">
                              {course.description}
                            </p>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                                {course.duration_weeks} week series · {course.sessions_per_week} sessions/wk
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4" aria-hidden="true" />
                                {weeklyMinutes} min weekly load
                              </span>
                              {course.mentor && (
                                <span className="flex items-center gap-1">
                                  <TrendingUp className="h-4 w-4" aria-hidden="true" />
                                  Mentored by {course.mentor}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-stretch gap-3 md:w-48">
                            {enrollment ? (
                              <Badge variant="secondary" className="justify-center gap-1">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                                {statusLabels[enrollment.status] ?? enrollment.status}
                              </Badge>
                            ) : null}
                            <Button
                              onClick={() => handleEnroll(course)}
                              disabled={enrollingCourseId === course.id}
                              variant={enrollment ? "outline" : "default"}
                            >
                              {enrollingCourseId === course.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                              ) : null}
                              {enrollment ? "Update Schedule" : "Enroll"}
                            </Button>
                            <div className="rounded-md bg-muted/40 p-3 text-left text-xs text-muted-foreground">
                              <p className="font-medium text-foreground">Next session</p>
                              <p className="mt-1 text-sm text-foreground">
                                {schedulePreview[0]
                                  ? format(schedulePreview[0], "EEE, MMM d · p")
                                  : "To be scheduled"}
                              </p>
                              <p className="mt-1">{describeTimeUntil(nextSessionMinutes)}</p>
                            </div>
                          </div>
                        </div>
                        {schedulePreview.length > 0 && (
                          <div className="mt-4 rounded-md bg-muted/30 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Upcoming cadence
                            </p>
                            <div className="mt-2 grid gap-2 sm:grid-cols-3">
                              {schedulePreview.slice(0, 3).map((session, index) => (
                                <div
                                  key={`${course.id}-session-${index}`}
                                  className="rounded border bg-background p-2 text-xs"
                                >
                                  <div className="font-medium text-foreground">
                                    {format(session, "EEE, MMM d")}
                                  </div>
                                  <div className="text-muted-foreground">{format(session, "p")}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarDays className="h-5 w-5 text-primary" aria-hidden="true" />
                Your Enrollments
              </CardTitle>
              <CardDescription>
                Track your session tempo, completion rate, and next milestones for each live commitment.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 2 }).map((_, index) => (
                    <div key={index} className="rounded-lg border p-4">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="mt-2 h-3 w-full" />
                      <Skeleton className="mt-2 h-3 w-2/3" />
                    </div>
                  ))}
                </div>
              ) : activeEnrollments.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  You haven’t committed to a guided track yet. Enroll above to see your calendar populate.
                </div>
              ) : (
                <div className="space-y-4">
                  {activeEnrollments.map((enrollment) => {
                    const course = courses.find((item) => item.id === enrollment.course_id);
                    if (!course) {
                      return null;
                    }

                    const progressValue = Math.min(100, Math.max(0, Math.round(enrollment.progress ?? 0)));
                    const nextSessionLabel = enrollment.next_session_at
                      ? format(new Date(enrollment.next_session_at), "MMM d · p")
                      : "Awaiting schedule";

                    return (
                      <div key={enrollment.id} className="rounded-lg border p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-foreground">{course.title}</p>
                            <p className="text-xs text-muted-foreground">{statusLabels[enrollment.status] ?? enrollment.status}</p>
                          </div>
                          <Badge variant="outline" className="capitalize">
                            {course.difficulty}
                          </Badge>
                        </div>
                        <Separator className="my-3" />
                        <div className="space-y-2 text-xs text-muted-foreground">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1 text-foreground">
                              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                              Next session
                            </span>
                            <span>{nextSessionLabel}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1 text-foreground">
                              <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />
                              Progress
                            </span>
                            <span>{progressValue}%</span>
                          </div>
                          <Progress value={progressValue} className="h-2" />
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1 text-foreground">
                              <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                              Sessions this week
                            </span>
                            <span>{course.sessions_per_week}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden="true" />
                Why enroll?
              </CardTitle>
              <CardDescription>
                Guided practice accelerates skill unlocks, earns mentor affinity, and syncs with your daily XP caps.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Enrolling locks in consistent repetitions so you never skip the fundamentals. Each completed session pumps XP directly into the linked skills and attributes.
              </p>
              <p>
                Cohort-based formats trigger live feedback moments, unlocking reputation bonuses and new gig pipelines faster than solo drills.
              </p>
            </CardContent>
          </Card>
        </aside>
      </section>
    </div>
  );
};

export default TrainingPage;
