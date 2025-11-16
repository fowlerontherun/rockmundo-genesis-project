import { Building2, CalendarRange, Globe2, MapPin, Sparkles, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { LanguageProficiencyLevel } from "@/types/education";
import { LANGUAGE_PROFICIENCY_LABELS } from "@/types/education";

interface ExchangeMilestone {
  id: string;
  title: string;
  status: "completed" | "in_progress" | "upcoming";
  description: string;
}

export interface LanguageExchangeProgramProgress {
  id: string;
  language: string;
  hostCity: string;
  hostInstitution: string;
  mentorName: string;
  cohortName: string;
  immersionHours: number;
  culturalActivitiesCompleted: number;
  culturalActivitiesPlanned: number;
  weeksCompleted: number;
  totalWeeks: number;
  proficiencyStartLevel: LanguageProficiencyLevel;
  proficiencyCurrentLevel: LanguageProficiencyLevel;
  proficiencyScoreDelta: number;
  upcomingHighlight: string;
  milestones: ExchangeMilestone[];
}

const milestoneStyles = {
  completed: "border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-400",
  in_progress: "border-primary/40 bg-primary/10 text-primary",
  upcoming: "border-muted-foreground/20 bg-muted/20 text-muted-foreground",
};

type MilestoneStatus = keyof typeof milestoneStyles;

interface LanguageExchangeProgramTrackerProps {
  program: LanguageExchangeProgramProgress;
}

export function LanguageExchangeProgramTracker({ program }: LanguageExchangeProgramTrackerProps) {
  const immersionCompletion = program.totalWeeks
    ? Math.min(100, Math.round((program.weeksCompleted / program.totalWeeks) * 100))
    : 0;

  const culturalProgress = program.culturalActivitiesPlanned
    ? Math.min(100, Math.round((program.culturalActivitiesCompleted / program.culturalActivitiesPlanned) * 100))
    : 0;

  const milestoneCounts = program.milestones.reduce(
    (acc, milestone) => {
      acc[milestone.status] += 1;
      return acc;
    },
    { completed: 0, in_progress: 0, upcoming: 0 } as Record<MilestoneStatus, number>,
  );

  return (
    <Card className="h-full border-primary/30 bg-background/70">
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-2xl font-semibold">{program.language} Exchange</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-3 text-base">
              <span className="flex items-center gap-1">
                <Globe2 className="h-4 w-4" />
                {program.hostCity}
              </span>
              <span className="flex items-center gap-1">
                <Building2 className="h-4 w-4" />
                {program.hostInstitution}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                Cohort {program.cohortName}
              </span>
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2 text-right">
            <Badge variant="secondary">Mentored by {program.mentorName}</Badge>
            <Badge variant="outline">{LANGUAGE_PROFICIENCY_LABELS[program.proficiencyCurrentLevel]}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-xl border bg-muted/40 p-4">
            <div className="flex items-center justify-between text-sm font-medium">
              <span className="flex items-center gap-2 text-muted-foreground">
                <CalendarRange className="h-4 w-4" />
                Program Timeline
              </span>
              <span>
                {program.weeksCompleted} / {program.totalWeeks} weeks
              </span>
            </div>
            <Progress value={immersionCompletion} className="h-2.5" />
            <p className="text-xs text-muted-foreground">
              Level up from {LANGUAGE_PROFICIENCY_LABELS[program.proficiencyStartLevel]} to
              {" "}
              {LANGUAGE_PROFICIENCY_LABELS[program.proficiencyCurrentLevel]} ({program.proficiencyScoreDelta} pts)
            </p>
          </div>

          <div className="space-y-3 rounded-xl border bg-muted/40 p-4">
            <div className="flex items-center justify-between text-sm font-medium">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Sparkles className="h-4 w-4" />
                Cultural Immersion
              </span>
              <span>
                {program.culturalActivitiesCompleted}/{program.culturalActivitiesPlanned} activities
              </span>
            </div>
            <Progress value={culturalProgress} className="h-2.5" />
            <p className="text-xs text-muted-foreground">
              {program.immersionHours} hours immersed across hosted family, campus, and community events
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-lg border bg-background/70 p-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Next Highlight</h3>
            <p className="text-base font-medium text-foreground">{program.upcomingHighlight}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {program.hostCity} cultural district
            </div>
          </div>

          <div className="space-y-3 rounded-lg border bg-background/70 p-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Milestone Overview</h3>
            <div className="grid grid-cols-3 gap-3 text-center text-xs font-medium">
              <div className="rounded-md border border-green-500/40 bg-green-500/10 p-3">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{milestoneCounts.completed}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
              <div className="rounded-md border border-primary/40 bg-primary/10 p-3">
                <p className="text-2xl font-bold text-primary">{milestoneCounts.in_progress}</p>
                <p className="text-xs text-muted-foreground">In progress</p>
              </div>
              <div className="rounded-md border border-muted-foreground/20 bg-muted/20 p-3">
                <p className="text-2xl font-bold text-muted-foreground">{milestoneCounts.upcoming}</p>
                <p className="text-xs text-muted-foreground">Upcoming</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground">Program Milestones</h3>
          <div className="space-y-3">
            {program.milestones.map((milestone) => (
              <div
                key={milestone.id}
                className={`rounded-lg border p-4 text-sm shadow-sm transition hover:shadow-md ${milestoneStyles[milestone.status]}`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-foreground">{milestone.title}</p>
                  <Badge variant="secondary">
                    {milestone.status === "completed"
                      ? "Completed"
                      : milestone.status === "in_progress"
                      ? "In Progress"
                      : "Upcoming"}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{milestone.description}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
