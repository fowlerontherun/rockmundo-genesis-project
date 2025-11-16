import { differenceInDays, format } from "date-fns";
import { BookOpen, BrainCircuit, CalendarCheck, Flame, GraduationCap, Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { LanguageProficiencyLevel } from "@/types/education";
import { LANGUAGE_PROFICIENCY_DESCRIPTORS, LANGUAGE_PROFICIENCY_LABELS } from "@/types/education";

interface CourseModule {
  id: string;
  title: string;
  focus: string;
  completed: boolean;
}

export interface LanguageCourseProgress {
  id: string;
  language: string;
  provider: string;
  format: "online" | "in_person" | "hybrid";
  startDate: string;
  endDate: string;
  level: LanguageProficiencyLevel;
  xpEarned: number;
  xpTarget: number;
  dailyPracticeMinutes: number;
  immersionHours: number;
  studyStreakDays: number;
  currentFocus: string;
  modules: CourseModule[];
}

const formatCourseFormat = (format: LanguageCourseProgress["format"]) => {
  switch (format) {
    case "online":
      return "Online";
    case "hybrid":
      return "Hybrid";
    case "in_person":
    default:
      return "In Person";
  }
};

const statusBadgeVariant = (level: LanguageProficiencyLevel) => {
  switch (level) {
    case "foundation":
    case "elementary":
      return "outline";
    case "intermediate":
    case "upper_intermediate":
      return "secondary";
    case "advanced":
      return "default";
    case "native":
    default:
      return "destructive";
  }
};

interface LanguageCourseProgressTrackerProps {
  course: LanguageCourseProgress;
}

export function LanguageCourseProgressTracker({ course }: LanguageCourseProgressTrackerProps) {
  const modulesCompleted = course.modules.filter((module) => module.completed).length;
  const courseCompletion = course.modules.length
    ? Math.round((modulesCompleted / course.modules.length) * 100)
    : 0;

  const xpCompletion = course.xpTarget > 0 ? Math.min(100, Math.round((course.xpEarned / course.xpTarget) * 100)) : 0;

  const endDate = course.endDate ? new Date(course.endDate) : null;
  const startDate = course.startDate ? new Date(course.startDate) : null;
  const daysRemaining = endDate ? Math.max(0, differenceInDays(endDate, new Date())) : null;
  const totalCourseDays = startDate && endDate ? Math.max(1, differenceInDays(endDate, startDate)) : null;
  const daysCompleted = startDate ? Math.max(0, differenceInDays(new Date(), startDate)) : null;
  const scheduleProgress = totalCourseDays && daysCompleted ? Math.min(100, Math.round((daysCompleted / totalCourseDays) * 100)) : 0;

  return (
    <Card className="h-full border-primary/30 bg-background/70 backdrop-blur">
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-2xl font-semibold">
              {course.language} Immersion
            </CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2 text-base text-muted-foreground">
              <span className="flex items-center gap-1">
                <BookOpen className="h-4 w-4" />
                {course.provider}
              </span>
              <span className="flex items-center gap-1">
                <CalendarCheck className="h-4 w-4" />
                {startDate ? format(startDate, "MMM d") : "Unknown"} -
                {" "}
                {endDate ? format(endDate, "MMM d, yyyy") : "Ongoing"}
              </span>
              <span className="flex items-center gap-1">
                <GraduationCap className="h-4 w-4" />
                {formatCourseFormat(course.format)} format
              </span>
            </CardDescription>
          </div>
          <Badge variant={statusBadgeVariant(course.level)}>{LANGUAGE_PROFICIENCY_LABELS[course.level]}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-xl border bg-muted/40 p-4">
            <div className="flex items-center justify-between text-sm font-medium">
              <span className="flex items-center gap-2 text-muted-foreground">
                <BrainCircuit className="h-4 w-4" />
                Course Progress
              </span>
              <span>
                {modulesCompleted}/{course.modules.length} modules
              </span>
            </div>
            <Progress value={courseCompletion} className="h-2.5" />
            <p className="text-xs text-muted-foreground">{LANGUAGE_PROFICIENCY_DESCRIPTORS[course.level]}</p>
          </div>

          <div className="space-y-4 rounded-xl border bg-muted/40 p-4">
            <div className="flex items-center justify-between text-sm font-medium">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Target className="h-4 w-4" />
                XP Goal
              </span>
              <span>
                {course.xpEarned.toLocaleString()} / {course.xpTarget.toLocaleString()} XP
              </span>
            </div>
            <Progress value={xpCompletion} className="h-2.5" />
            <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Flame className="h-3.5 w-3.5 text-orange-500" />
                {course.studyStreakDays}-day streak
              </span>
              <span className="flex items-center gap-1">
                <GraduationCap className="h-3.5 w-3.5 text-primary" />
                {course.dailyPracticeMinutes} min/day
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-lg border bg-background/70 p-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Current Focus</h3>
            <p className="text-base font-medium leading-relaxed text-foreground">{course.currentFocus}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Flame className="h-4 w-4" />
              {course.immersionHours} immersion hours logged
            </div>
          </div>

          <div className="space-y-3 rounded-lg border bg-background/70 p-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Schedule Progress</h3>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <CalendarCheck className="h-4 w-4" />
                Timeline completion
              </span>
              <span>{scheduleProgress}%</span>
            </div>
            <Progress value={scheduleProgress} className="h-2.5" />
            <p className="text-xs text-muted-foreground">
              {daysRemaining === null
                ? "Course pacing data unavailable"
                : daysRemaining === 0
                ? "Final assessments ongoing"
                : `${daysRemaining} days remaining in program`}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Module Checklist</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {course.modules.map((module) => (
              <div
                key={module.id}
                className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3 text-sm"
              >
                <div className={`mt-1 h-3 w-3 rounded-full ${module.completed ? "bg-primary" : "bg-muted-foreground/40"}`} />
                <div className="space-y-1">
                  <p className="font-medium text-foreground">{module.title}</p>
                  <p className="text-xs text-muted-foreground">{module.focus}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
